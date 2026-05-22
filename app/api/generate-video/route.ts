import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { generateScript } from '../../_lib/script-generator'
import { sendNotification, createJob, updateJobProgress } from '../../_lib/notify'
import type { Brand, ExtractedPolicyData, SlideStyleId } from '../../_lib/types'
import type { ExtractedData } from '../../_lib/extract-types'
import { isAdmin } from '../../_lib/admin'
import { rateLimit, getRateLimitKey, LIMITS } from '../../_lib/rate-limit'
import { buildSimpleSlidePrompt, getStylePrompt } from '../../_lib/slide-engine/simple-prompt'
import type { SimpleSlideInput } from '../../_lib/slide-engine/simple-prompt'

export const runtime = 'nodejs'

const VIDEO_ASSEMBLY_URL = process.env.VIDEO_ASSEMBLY_URL
if (!VIDEO_ASSEMBLY_URL) console.error('[generate-video] VIDEO_ASSEMBLY_URL env var is not set!')
const VIDEO_ASSEMBLY_SECRET = (process.env.VIDEO_ASSEMBLY_SECRET || '').trim().replace(/[\r\n]/g, '')

export const maxDuration = 120

// Track in-flight requests to prevent duplicates
const inFlightVideos = new Set<string>()

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const rl = rateLimit(getRateLimitKey(user.id, 'generation'), LIMITS.generation.limit, LIMITS.generation.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 })
  }

  // --- Credit check ---
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status, referred_by, card_on_file, free_videos_remaining')
    .eq('id', user.id)
    .single()

  const subStatus = (profile?.subscription_status ?? '').toLowerCase()
  const isPaidUser = ['active', 'professional', 'pro', 'business', 'enterprise', 'starter'].includes(subStatus)
  const hasReferralDiscount = !!profile?.referred_by
  const cardOnFile = profile?.card_on_file ?? false
  const freeRemaining = profile?.free_videos_remaining ?? 0

  if (!isAdmin(user.email)) {
    if (!isPaidUser && !hasReferralDiscount) {
      if (freeRemaining <= 0 && !cardOnFile) {
        return NextResponse.json(
          { error: 'Free videos used. Please add a payment method to continue.' },
          { status: 403 }
        )
      }
    }
  }

  const body = await request.json()
  const { videoId, policyData, brandId, voiceId, styleId, customStylePrompt, approvedSlides, preGeneratedScenes, detailed, musicUrl, aiMusic, musicPrompt, narrationStyle, assetUrls, purpose, uploadMode, industry } = body as {
    videoId: string
    policyData: ExtractedPolicyData | ExtractedData
    brandId: string | null
    voiceId: string
    styleId?: SlideStyleId
    customStylePrompt?: string
    approvedSlides?: string[]
    preGeneratedScenes?: any[]
    detailed?: boolean
    musicUrl?: string
    aiMusic?: boolean
    musicPrompt?: string
    narrationStyle?: 'solo' | 'podcast'
    assetUrls?: { url: string; tag: string }[]
    purpose?: string
    uploadMode?: string
    industry?: string
  }

  // --- GUARD: Duplicate submission prevention ---
  if (inFlightVideos.has(videoId)) {
    return NextResponse.json({ error: 'This video is already being generated.' }, { status: 409 })
  }
  inFlightVideos.add(videoId)

  // --- GUARD: Server-side purpose validation ---
  if (!purpose?.trim() && !preGeneratedScenes?.length) {
    inFlightVideos.delete(videoId)
    return NextResponse.json({ error: 'Please describe what this video should accomplish.' }, { status: 400 })
  }

  // --- GUARD: Minimum content check ---
  const contentData = policyData as any
  const hasContent = contentData?.sections?.length > 0 ||
    contentData?.keyMetrics?.length > 0 ||
    contentData?.bulletPoints?.length > 0 ||
    contentData?.policyType ||
    preGeneratedScenes?.length
  if (!hasContent) {
    inFlightVideos.delete(videoId)
    return NextResponse.json({
      error: 'Not enough content extracted from your document. Try pasting the text directly or uploading a different file.'
    }, { status: 400 })
  }

  let brand: Brand | null = null
  if (brandId) {
    const { data } = await supabase.from('brands').select('*').eq('id', brandId).single()
    brand = data as Brand | null
  }

  const colors = {
    primary: brand?.primary_color ?? '#1B365D',
    secondary: brand?.secondary_color ?? '#4A90D9',
    accent: brand?.accent_color ?? '#FFB347',
    background: brand?.background_color ?? '#0a1628',
    text: brand?.text_color ?? '#FFFFFF',
  }

  const admin = createAdminClient()
  const jobId = await createJob(admin, user.id, {
    type: 'video',
    title: `Video: ${videoId.slice(0, 8)}...`,
    metadata: { videoId },
  })

  try {
    if (jobId) await updateJobProgress(admin, jobId, 5, 'running')

    // --- GUARD: VPS health check before doing any work ---
    try {
      const healthRes = await fetch(`${VIDEO_ASSEMBLY_URL}/health`, { signal: AbortSignal.timeout(5000) })
      if (!healthRes.ok) throw new Error('VPS not healthy')
    } catch {
      throw new Error('Video server is temporarily offline. Please try again in a few minutes.')
    }

    // STAGE 1: Generate script (or reuse pre-generated scenes)
    let scenes
    if (preGeneratedScenes && preGeneratedScenes.length > 0) {
      console.log(`[video ${videoId}] Using ${preGeneratedScenes.length} pre-generated scenes.`)
      // Replace {{BRAND_NAME}} placeholder and strip invented contact info
      const actualBrandName = brand?.name || ''
      const sourceText = JSON.stringify(policyData) // original document data
      const phonePattern = /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\+\d[\d\s-]{7,15}\d|\d{3,4}[\s-]\d{3,4}[\s-]\d{3,4}/g

      function stripFakePhones(text: string): string {
        return text.replace(phonePattern, (match) => {
          // Keep the number ONLY if it exists in the original source data
          const digits = match.replace(/\D/g, '')
          if (sourceText.includes(digits) || sourceText.includes(match)) return match
          console.log(`[video ${videoId}] Stripped invented phone: ${match}`)
          return ''
        }).replace(/\s{2,}/g, ' ').trim()
      }

      // Clean function: strip "undefined", fake phones, brand placeholder
      function cleanText(t: string): string {
        return stripFakePhones(
          (t || '').replaceAll('{{BRAND_NAME}}', actualBrandName).replace(/\bundefined\b/gi, '').replace(/\s{2,}/g, ' ').trim()
        )
      }

      scenes = preGeneratedScenes.map((s: any) => ({
        ...s,
        title: cleanText(s.title || ''),
        narration: cleanText(s.narration || ''),
        dialogue: s.dialogue?.map((d: any) => ({
          ...d,
          text: cleanText(d.text || ''),
        })),
        slideData: s.slideData ? {
          ...s.slideData,
          headline: cleanText(s.slideData.headline || s.title || ''),
          bullets: s.slideData.bullets?.filter((b: string) => !phonePattern.test(b) || sourceText.includes(b)).map((b: string) => cleanText(b)),
          stats: s.slideData.stats?.map((st: any) => ({ label: cleanText(st.label || ''), value: cleanText(st.value || '') })),
        } : s.slideData,
      }))

      // Remove any scenes with empty/trivial narration — no silent slides
      // BUT never drop the closing/action scene
      const beforeCount = scenes.length
      scenes = scenes.filter((s: any, idx: number) => {
        const words = s.narration?.trim().split(/\s+/).length || 0
        const isClosing = s.beat === 'action' || s.beat === 'disclaimer-close' || idx === scenes.length - 1
        if (isClosing) return true // never drop closing scenes
        return words >= 5
      })
      if (scenes.length < beforeCount) {
        console.log(`[video ${videoId}] Removed ${beforeCount - scenes.length} empty/trivial scenes`)
      }
      // Ensure scene count matches — renumber
      scenes.forEach((s: any, idx: number) => { s.scene = idx + 1 })

      // Inject contact info into last scene narration if available
      const pd = policyData as any
      const closingPhone = pd?.contactPhone || pd?.contactInfo?.phone || brand?.brand_guide_data?.phone
      const closingEmail = pd?.contactEmail || pd?.contactInfo?.email || brand?.brand_guide_data?.email
      const closingWebsite = pd?.contactWebsite || pd?.contactInfo?.website
      if (scenes.length > 0 && (closingPhone || closingEmail || closingWebsite)) {
        const lastScene = scenes[scenes.length - 1]
        const lastWords = lastScene.narration?.trim().split(/\s+/).length || 0
        // If last scene is short (likely just "thank you"), add contact mention
        if (lastWords < 30) {
          const parts: string[] = []
          if (closingPhone) parts.push(`give us a call at ${closingPhone.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3')}`)
          if (closingEmail) parts.push(`email us at ${closingEmail}`)
          if (closingWebsite) parts.push(`or visit our website for more information`)
          lastScene.narration = `Thank you for watching. To learn more, ${parts.join(', ')}. We look forward to hearing from you.`
          console.log(`[video ${videoId}] Injected contact info into closing narration`)
        }
      }

      await admin.from('videos').update({ script: scenes, status: 'generating_audio', progress_detail: 'Script ready', progress_pct: 15 }).eq('id', videoId)
    } else {
      console.log(`[video ${videoId}] Generating script...`)
      await admin.from('videos').update({ status: 'scripting', progress_detail: 'Writing your script...', progress_pct: 5 }).eq('id', videoId)
      const guideDataForScript = brand?.brand_guide_data as Record<string, string> | null
      const pd = policyData as any
      const contactInfoForScript = {
        phone: guideDataForScript?.phone ?? pd?.contactPhone ?? pd?.contactInfo?.phone ?? undefined,
        email: guideDataForScript?.email ?? pd?.contactEmail ?? pd?.contactInfo?.email ?? undefined,
        website: pd?.contactWebsite ?? pd?.contactInfo?.website ?? undefined,
        calendly: guideDataForScript?.calendly ?? undefined,
      }

      // Script generation with 60s timeout
      try {
        scenes = await Promise.race([
          generateScript(policyData, brand?.name ?? null, colors, detailed ?? false, 0, voiceId, (brand as any)?.tone ?? undefined, contactInfoForScript, purpose, uploadMode, industry),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Script generation timed out. This document may be too large — try pasting the key sections instead.')), 60000)),
        ])
      } catch (scriptErr) {
        throw scriptErr
      }

      if (!scenes || scenes.length === 0) {
        throw new Error('Script generation produced no scenes. Try providing more content or a clearer purpose.')
      }

      await admin.from('videos').update({ script: scenes, status: 'generating_audio', progress_detail: 'Script complete', progress_pct: 15 }).eq('id', videoId)
    }

    // STAGE 2: Build slide prompts — simple, direct prompts for OpenAI
    console.log(`[video ${videoId}] Building slide prompts for ${scenes.length} scenes...`)
    await admin.from('videos').update({ progress_detail: 'Preparing slide designs...', progress_pct: 16 }).eq('id', videoId)

    const templateId = (styleId ?? brand?.deck_style_id ?? 'executive') as string
    const logoUrl = brand?.logo_file_url ?? brand?.logo_url ?? null
    const brandGuide = brand?.brand_guide_data as Record<string, string> | null
    const brandColors = {
      primary: brand?.primary_color ?? '#1B365D',
      secondary: brand?.secondary_color ?? '#4A90D9',
    }

    // Build style prompt: custom theme > brand-colored style > template default
    let stylePrompt: string
    if (customStylePrompt) {
      stylePrompt = customStylePrompt
    } else if (brand && brand.primary_color !== '#1B365D') {
      // Brand has custom colors — generate a creative style that matches them
      stylePrompt = `Modern, visually striking presentation style. Primary brand color: ${brand.primary_color}, secondary: ${brand.secondary_color}. Use these colors boldly — gradient backgrounds, colored accent panels, glowing highlights, subtle patterns. Mix light and dark sections for visual variety. Each slide should feel like a premium design portfolio piece — creative layouts, interesting typography hierarchy, layered depth with shadows and glass effects. NOT a boring corporate template — make it look like a designer crafted each slide by hand. Think Apple keynote meets luxury brand lookbook.`
    } else {
      stylePrompt = getStylePrompt(templateId)
    }

    const slidePrompts = scenes.map((scene: any, i: number) => {
      const isFirst = i === 0
      const isLast = i === scenes.length - 1

      // Use slideData from script generator (preferred) or fall back to narration extraction
      const sd = scene.slideData as { headline?: string; stats?: { label: string; value: string }[]; bullets?: string[] } | undefined
      const cleanNarration = scene.narration?.replace(/^(Host|Expert|Advisor|Client|Narrator|Clarifier|Alex|Jordan):\s*/gim, '') || ''

      // Contact info for closing slide: brand guide + user-entered from review page
      const pd = policyData as any
      const sceneContactInfo = (isFirst || isLast)
        ? {
            phone: brandGuide?.phone || pd?.contactPhone || (pd?.contactInfo?.phone) || undefined,
            website: (brandGuide?.website || pd?.contactWebsite || pd?.contactInfo?.website || '')?.toLowerCase() || undefined,
            email: (brandGuide?.email || pd?.contactEmail || pd?.contactInfo?.email || '')?.toLowerCase() || undefined,
            calendly: brandGuide?.calendly || undefined,
          }
        : undefined

      // Build slide content: slideData > explicit bullets > narration fallback
      let slideStats = sd?.stats || scene.stats || scene.keyMetrics?.map((m: any) => ({ value: m.value, label: m.label }))
      let slideBullets = sd?.bullets?.map((b: string) => ({ text: b }))
        || (scene.bullets?.length > 0 ? scene.bullets : undefined)
      if (!slideBullets && !slideStats && !isFirst && !isLast) {
        // Last resort: extract from narration
        slideBullets = cleanNarration.split(/[.!?]+/).filter((s: string) => s.trim().length > 10).slice(0, 4).map((s: string) => ({ text: s.trim() }))
      }

      // Filter out any bullets that look like invented contact info
      const contactPattern = /\b(?:\d{3}[-.\s]?\d{3,4}[-.\s]?\d{4}|\+\d{2}|@\w+\.\w+|www\.\w+|\.co\.uk|\.com\/|contact us|call us|reach out|get in touch|visit our)\b/i
      if (slideBullets) {
        slideBullets = slideBullets.filter((b: { text: string }) => !contactPattern.test(b.text))
      }

      const input: SimpleSlideInput = {
        type: isFirst ? 'cover' : isLast ? 'closing' : 'content',
        stylePrompt,
        headline: sd?.headline || scene.title || (isFirst ? (policyData as any)?.title || 'Presentation' : isLast ? 'Thank You' : ''),
        subtitle: scene.subtitle || (isFirst ? brand?.name : undefined),
        brandName: brand?.name,
        brandColors,
        stats: slideStats,
        bullets: slideBullets,
        contactInfo: sceneContactInfo,
        narrationContext: scene.narration?.slice(0, 200),
        pageNumber: i + 1,
        totalPages: scenes.length,
      }

      return buildSimpleSlidePrompt(input)
    })

    // STAGE 3: Hand off to VPS with pre-built prompts
    console.log(`[video ${videoId}] Handing off to VPS: ${scenes.length} scenes, voice=${voiceId}, style=${templateId}`)
    await admin.from('videos').update({ progress_detail: 'Sending to video server...', progress_pct: 18 }).eq('id', videoId)

    const vpsRes = await fetch(`${VIDEO_ASSEMBLY_URL}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-secret': VIDEO_ASSEMBLY_SECRET },
      body: JSON.stringify({
        videoId,
        voiceId,
        scenes,
        userId: user.id,
        slidePrompts,
        logoUrl,
        musicPrompt: musicPrompt || '',
        industry: industry || '',
        narrationStyle: narrationStyle || 'solo',
      }),
      signal: AbortSignal.timeout(10000),
    })

    const vpsData = await vpsRes.json()
    if (!vpsData.success) {
      throw new Error(vpsData.error || 'VPS rejected the generation request')
    }

    console.log(`[video ${videoId}] VPS accepted — generation running in background. Returning.`)
    return NextResponse.json({ success: true })

  } catch (err) {
    console.error(`[video ${videoId}] Error:`, err)
    const message = err instanceof Error ? err.message : 'Video generation failed'
    await admin.from('videos').update({ status: 'failed', error_message: message }).eq('id', videoId)
    if (jobId) await updateJobProgress(admin, jobId, 0, 'failed', { error_message: message })
    await sendNotification(admin, user.id, {
      type: 'video_failed',
      title: 'Video generation failed',
      message,
      link: `/videos/${videoId}`,
    })
    return NextResponse.json({ error: message }, { status: 500 })
  } finally {
    // Always clean up in-flight tracking
    inFlightVideos.delete(videoId)
  }
}
