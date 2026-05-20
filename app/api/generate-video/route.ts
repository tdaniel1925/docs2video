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
      scenes = preGeneratedScenes
      await admin.from('videos').update({ script: scenes, status: 'generating_audio', progress_detail: 'Script ready', progress_pct: 15 }).eq('id', videoId)
    } else {
      console.log(`[video ${videoId}] Generating script...`)
      await admin.from('videos').update({ status: 'scripting', progress_detail: 'Writing your script...', progress_pct: 5 }).eq('id', videoId)
      const guideDataForScript = brand?.brand_guide_data as Record<string, string> | null
      const contactInfoForScript = {
        phone: guideDataForScript?.phone ?? undefined,
        email: guideDataForScript?.email ?? undefined,
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
    const stylePrompt = customStylePrompt || getStylePrompt(templateId)
    const logoUrl = brand?.logo_file_url ?? brand?.logo_url ?? null
    const brandGuide = brand?.brand_guide_data as Record<string, string> | null
    const brandColors = {
      primary: brand?.primary_color ?? '#1B365D',
      secondary: brand?.secondary_color ?? '#4A90D9',
    }

    const slidePrompts = scenes.map((scene: any, i: number) => {
      const isFirst = i === 0
      const isLast = i === scenes.length - 1

      // Extract bullet content from narration if no explicit bullets
      // Strip speaker tags from narration
      const hasBullets = scene.bullets?.length > 0
      const cleanNarration = scene.narration?.replace(/^(Host|Expert|Advisor|Client|Narrator|Clarifier|Alex|Jordan):\s*/gim, '') || ''
      const narrativeBullets = !hasBullets && cleanNarration
        ? cleanNarration.split(/[.!?]+/).filter((s: string) => s.trim().length > 10).slice(0, 4).map((s: string) => ({ text: s.trim() }))
        : undefined

      // If narration mentions a phone number, include it in slide contact info
      const phoneInNarration = cleanNarration.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/)
      const urlInNarration = cleanNarration.match(/(?:https?:\/\/)?[\w.-]+\.[a-z]{2,}(?:\/\S*)?/i)

      const sceneContactInfo = (isFirst || isLast)
        ? { phone: brandGuide?.phone, website: brandGuide?.website?.toLowerCase(), email: brandGuide?.email?.toLowerCase(), calendly: brandGuide?.calendly }
        : phoneInNarration || urlInNarration
          ? { phone: phoneInNarration?.[0], website: urlInNarration?.[0]?.toLowerCase() }
          : undefined

      const input: SimpleSlideInput = {
        type: isFirst ? 'cover' : isLast ? 'closing' : 'content',
        stylePrompt,
        headline: scene.title || (isFirst ? (policyData as any)?.title || 'Presentation' : isLast ? 'Thank You' : ''),
        subtitle: scene.subtitle || (isFirst ? brand?.name : undefined),
        brandName: brand?.name,
        brandColors,
        stats: scene.stats || scene.keyMetrics?.map((m: any) => ({ value: m.value, label: m.label })),
        bullets: hasBullets ? scene.bullets : narrativeBullets,
        contactInfo: sceneContactInfo,
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
