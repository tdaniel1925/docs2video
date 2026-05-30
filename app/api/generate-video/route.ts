// Video generation pipeline — flipbook illustrated mode
import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { generateScript } from '../../_lib/script-generator'
// Cover/closing slides generated on VPS
import { sendNotification, createJob, updateJobProgress } from '../../_lib/notify'
import type { Brand, ExtractedPolicyData, SlideStyleId } from '../../_lib/types'
import type { ExtractedData } from '../../_lib/extract-types'
import { isAdmin } from '../../_lib/admin'
import { logError } from '../../_lib/error-logger'
import { validateScript } from '../../_lib/script-validator'
import { rateLimit, getRateLimitKey, LIMITS } from '../../_lib/rate-limit'
import { buildSimpleSlidePrompt, getStylePrompt } from '../../_lib/slide-engine/simple-prompt'
import type { SimpleSlideInput } from '../../_lib/slide-engine/simple-prompt'
import { DEFAULT_PROMPT_VERSIONS } from '../../_lib/prompts'
import { PHONE_REGEX, phoneToSpoken, isPhoneInSource } from '../../_lib/phone-utils'
import { estimateVideoCost, exceedsCeiling } from '../../_lib/cost-estimator'
import { deductCredits, calculateVideoCost, checkCredits } from '../../_lib/credits'

export const runtime = 'nodejs'

const VIDEO_ASSEMBLY_URL = process.env.VIDEO_ASSEMBLY_URL
if (!VIDEO_ASSEMBLY_URL) console.error('[generate-video] VIDEO_ASSEMBLY_URL env var is not set!')
const VIDEO_ASSEMBLY_SECRET = (process.env.VIDEO_ASSEMBLY_SECRET || '').trim().replace(/[\r\n]/g, '')

export const maxDuration = 300

// Format narration for TTS — convert numbers to spoken words
function formatForTTS(text: string): string {
  const dw: Record<string, string> = { '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine' }
  return text
    // Phone numbers — use unified PHONE_REGEX
    .replace(PHONE_REGEX, (match) => phoneToSpoken(match))
    // Percentages: 7.5% → seven point five percent
    .replace(/(\d+)\.(\d+)%/g, (_, a: string, b: string) => {
      return `${a.split('').map(d => dw[d] || d).join(' ')} point ${b.split('').map(d => dw[d] || d).join(' ')} percent`
    })
}

// Track in-flight requests to prevent duplicates
const inFlightVideos = new Set<string>()

// Scene filter helpers — only truly empty scenes get removed
export function isSceneEmpty(scene: any): boolean {
  const narration = scene.narration?.trim() || ''
  const slidePrompt = scene.slidePrompt?.trim() || ''
  const hasNarration = narration.length > 0
  const hasSlideContent = slidePrompt.length > 0
  return !hasNarration && !hasSlideContent
}

export function isSceneSuspiciouslyShort(scene: any): boolean {
  const narration = scene.narration?.trim() || ''
  const minByBeat: Record<string, number> = {
    hook: 15,
    disclaimer: 100,
    'disclaimer-close': 100,
    context: 30,
    stakes: 30,
    evidence: 40,
    implication: 30,
    action: 20,
  }
  const min = minByBeat[scene.beat] || 30
  return narration.length < min
}

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
  const { videoId, policyData, brandId, voiceId, styleId, customStylePrompt, styleReferenceUrl, approvedSlides, preGeneratedScenes, detailed, musicUrl, aiMusic, musicPrompt, narrationStyle, assetUrls, purpose, uploadMode, industry } = body as {
    videoId: string
    policyData: ExtractedPolicyData | ExtractedData
    brandId: string | null
    voiceId: string
    styleId?: SlideStyleId
    customStylePrompt?: string
    styleReferenceUrl?: string
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

  // --- Credit deduction ---
  if (!isAdmin(user.email)) {
    const videoCost = calculateVideoCost({
      outputType: (body as any).outputType || 'video',
      detailLevel: (body as any).detailLevel || (detailed ? 'detailed' : 'standard'),
      narrationStyle: narrationStyle || 'solo',
    })

    const creditCheck = await checkCredits(user.id, videoCost)
    if (!creditCheck.allowed) {
      inFlightVideos.delete(videoId)
      return NextResponse.json(
        { error: `Not enough credits. Need ${videoCost}, have ${creditCheck.remaining}.` },
        { status: 402 }
      )
    }

    const deducted = await deductCredits(user.id, videoCost, 'video_generation', videoId)
    if (!deducted) {
      inFlightVideos.delete(videoId)
      return NextResponse.json(
        { error: 'Credit deduction failed. Please try again.' },
        { status: 402 }
      )
    }
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
      // FIX 9: Validate pre-generated scenes have minimum required fields
      const validScenes = preGeneratedScenes.filter((s: any) => {
        const hasNarration = typeof s.narration === 'string' && s.narration.trim().length > 0
        const hasTitle = typeof s.title === 'string' && s.title.trim().length > 0
        const hasSlideContent = s.slidePrompt || s.slideData
        return hasNarration && hasTitle && hasSlideContent
      })
      if (validScenes.length < preGeneratedScenes.length) {
        console.warn(`[video ${videoId}] Filtered ${preGeneratedScenes.length - validScenes.length} invalid pre-generated scenes (missing narration, title, or slide content)`)
      }
      if (validScenes.length === 0) {
        inFlightVideos.delete(videoId)
        return NextResponse.json({ error: 'All pre-generated scenes are invalid (missing narration, title, or slide content). Please regenerate your script.' }, { status: 400 })
      }
      // Replace with validated scenes
      const preGenScenes = validScenes
      console.log(`[video ${videoId}] Using ${preGenScenes.length} pre-generated scenes.`)
      // Replace {{BRAND_NAME}} placeholder and strip invented contact info
      const actualBrandName = brand?.name || ''
      const sourceText = JSON.stringify(policyData) // original document data

      function stripFakePhones(text: string): string {
        return text.replace(PHONE_REGEX, (match) => {
          // Keep the number ONLY if it exists in the original source data
          if (isPhoneInSource(match, sourceText) || sourceText.includes(match)) return match
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

      scenes = preGenScenes.map((s: any) => ({
        ...s,
        title: cleanText(s.title || ''),
        narration: formatForTTS(cleanText(s.narration || '')),
        dialogue: s.dialogue?.map((d: any) => ({
          ...d,
          text: cleanText(d.text || ''),
        })),
        slideData: s.slideData ? {
          ...s.slideData,
          headline: cleanText(s.slideData.headline || s.title || ''),
          bullets: s.slideData.bullets?.filter((b: string) => !PHONE_REGEX.test(b) || sourceText.includes(b)).map((b: string) => cleanText(b)),
          stats: s.slideData.stats?.map((st: any) => ({ label: cleanText(st.label || ''), value: cleanText(st.value || '') })),
        } : s.slideData,
      }))

      // Strip carrier name from slide data (F18 — compliance)
      if (policyData && typeof policyData === 'object' && 'carrier' in (policyData as any)) {
        const carrierName = (policyData as any).carrier
        if (carrierName && typeof carrierName === 'string' && carrierName.length > 1) {
          const carrierRegex = new RegExp(carrierName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
          scenes.forEach((scene: any) => {
            if (scene.slidePrompt) {
              scene.slidePrompt = scene.slidePrompt.replace(carrierRegex, 'the carrier')
            }
            if (scene.slideData) {
              if (scene.slideData.headline) {
                scene.slideData.headline = scene.slideData.headline.replace(carrierRegex, 'the carrier')
              }
              if (scene.slideData.bullets) {
                scene.slideData.bullets = scene.slideData.bullets.map((b: string) =>
                  typeof b === 'string' ? b.replace(carrierRegex, 'the carrier') : b
                )
              }
              if (scene.slideData.stats) {
                scene.slideData.stats = scene.slideData.stats.map((st: any) => ({
                  ...st,
                  label: st.label ? st.label.replace(carrierRegex, 'the carrier') : st.label,
                  value: st.value ? st.value.replace(carrierRegex, 'the carrier') : st.value,
                }))
              }
            }
          })
          console.log(`[video ${videoId}] Stripped carrier name "${carrierName}" from slide data`)
        }
      }

      // Remove truly empty scenes (no narration AND no slide content)
      const beforeCount = scenes.length
      scenes = scenes
        .filter((s: any) => !isSceneEmpty(s))
        .map((s: any, idx: number) => ({ ...s, scene: idx + 1 }))
      if (scenes.length < beforeCount) {
        console.log(`[video ${videoId}] Removed ${beforeCount - scenes.length} empty scenes`)
      }
      // Log suspiciously short scenes but keep them
      scenes.forEach((s: any, idx: number) => {
        if (isSceneSuspiciouslyShort(s)) {
          console.warn(`[video ${videoId}] Scene ${idx + 1} (${s.beat || 'unknown'}) is suspiciously short: "${s.narration?.slice(0, 50)}..."`)
        }
      })

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

      await admin.from('videos').update({ script: scenes, status: 'generating_audio', progress_detail: 'Script ready', progress_pct: 15, prompt_versions: { ...DEFAULT_PROMPT_VERSIONS } }).eq('id', videoId)
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
          generateScript(policyData, brand?.name ?? null, colors, detailed ?? false, 0, voiceId, (brand as any)?.tone ?? undefined, contactInfoForScript, purpose, uploadMode, industry, (body as any).detailLevel || (detailed ? 'detailed' : 'standard'), narrationStyle, (policyData as any)?.classification ?? null),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Script generation timed out. This document may be too large — try pasting the key sections instead.')), 60000)),
        ])
      } catch (scriptErr) {
        throw scriptErr
      }

      if (!scenes || scenes.length === 0) {
        throw new Error('Script generation produced no scenes. Try providing more content or a clearer purpose.')
      }

      // Format narration for TTS
      scenes = scenes.map((s: any) => ({ ...s, narration: s.narration ? formatForTTS(s.narration) : s.narration }))

      await admin.from('videos').update({ script: scenes, status: 'generating_audio', progress_detail: 'Script complete', progress_pct: 15, prompt_versions: { ...DEFAULT_PROMPT_VERSIONS } }).eq('id', videoId)
    }

    // Save script revision
    try {
      const { data: latestRevision } = await admin
        .from('script_revisions')
        .select('revision_number')
        .eq('video_id', videoId)
        .order('revision_number', { ascending: false })
        .limit(1)
        .single()

      const revisionNumber = (latestRevision?.revision_number ?? 0) + 1

      await admin.from('script_revisions').insert({
        video_id: videoId,
        revision_number: revisionNumber,
        scenes: scenes,
        prompt_versions: DEFAULT_PROMPT_VERSIONS,
      })
      console.log(`[video ${videoId}] Saved script revision #${revisionNumber}`)
    } catch (revErr) {
      // Non-fatal — don't block video generation if revision save fails
      console.warn(`[video ${videoId}] Failed to save script revision:`, revErr instanceof Error ? revErr.message : 'unknown')
    }

    // --- GUARD: Pre-flight script validation ---
    const isInsurance = 'policyType' in (policyData as any)
    const validation = validateScript(scenes, {
      industry: industry ?? (isInsurance ? 'insurance' : undefined),
      contactInfo: undefined,
      detailLevel: detailed ? 'detailed' : 'standard',
      requireDisclaimer: isInsurance,
    })

    if (!validation.ok) {
      inFlightVideos.delete(videoId)
      await admin.from('videos').update({
        status: 'failed',
        error_message: `Script validation failed: ${validation.errors.map(e => e.message).join('; ')}`
      }).eq('id', videoId)
      if (jobId) await updateJobProgress(admin, jobId, 0, 'failed', { error_message: 'Script validation failed' })
      return NextResponse.json({
        error: 'Script validation failed',
        details: validation.errors,
      }, { status: 422 })
    }

    if (validation.warnings.length > 0) {
      console.log(`[video ${videoId}] Script warnings:`, validation.warnings)
    }

    // --- Cost estimate ---
    const totalNarrationChars = scenes.reduce((sum: number, s: any) => sum + (s.narration?.length ?? 0), 0)
    const costEstimate = estimateVideoCost(scenes.length, totalNarrationChars, !!(aiMusic || musicPrompt))
    console.log(`[video ${videoId}] Estimated cost: ${costEstimate.estimated_cost_cents}¢`)

    // Save cost estimate to video record
    await admin.from('videos').update({ estimated_cost_cents: costEstimate.estimated_cost_cents }).eq('id', videoId)

    // Check daily spend ceiling (env-gated via COST_CEILINGS_ENABLED)
    const userTier = subStatus || 'free'
    const ceilingExceeded = await exceedsCeiling(user.id, costEstimate.estimated_cost_cents, userTier, admin)
    if (ceilingExceeded) {
      inFlightVideos.delete(videoId)
      await admin.from('videos').update({ status: 'failed', error_message: 'Daily usage limit reached.' }).eq('id', videoId)
      if (jobId) await updateJobProgress(admin, jobId, 0, 'failed', { error_message: 'Daily usage limit reached.' })
      return NextResponse.json({ error: 'Daily usage limit reached.' }, { status: 429 })
    }

    // STAGE 2: Build slide prompts — simple, direct prompts for OpenAI
    console.log(`[video ${videoId}] Building slide prompts for ${scenes.length} scenes...`)
    // Save style reference URL if provided (custom uploaded style)
    if (styleReferenceUrl) {
      await admin.from('videos').update({ style_reference_url: styleReferenceUrl }).eq('id', videoId)
    }
    await admin.from('videos').update({ progress_detail: 'Preparing slide designs...', progress_pct: 16 }).eq('id', videoId)

    const templateId = (styleId ?? brand?.deck_style_id ?? (policyData as any)?.classification?.recommendedTemplate ?? 'corporate-clean') as string
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

      // 1 slide per scene — single prompt with full narration context
      const fp = scene.framePrompts?.[0] || scene.slidePrompt || scene.title
      return `${stylePrompt}\n\n${fp}\n\nNarration context (illustrate this): "${scene.narration?.slice(0, 300)}"\n\nCRITICAL COLOR RULE: Use brand colors prominently — primary: ${brandColors.primary}, secondary: ${brandColors.secondary}. These colors MUST dominate the palette.`
    })

    // Video metadata
    const videoTitle = scenes[0]?.title || (policyData as any)?.title || purpose || 'Presentation'
    const effectiveBrandName = brand?.name || (body as any).companyName || null
    const contactForClosing = {
      phone: brandGuide?.phone || (policyData as any)?.contactPhone || (policyData as any)?.contactInfo?.phone || undefined,
      email: brandGuide?.email || (policyData as any)?.contactEmail || (policyData as any)?.contactInfo?.email || undefined,
      website: (policyData as any)?.contactWebsite || (policyData as any)?.contactInfo?.website || undefined,
    }

    // Build cover narration (short intro)
    const coverNarration = effectiveBrandName
      ? `Welcome. This is a presentation from ${effectiveBrandName}. ${videoTitle}.`
      : `Welcome to this presentation. ${videoTitle}.`

    // Build closing narration (short outro with contact info)
    const contactParts: string[] = []
    if (contactForClosing.website) contactParts.push(`Visit ${contactForClosing.website}`)
    if (contactForClosing.phone) contactParts.push(`or call ${contactForClosing.phone}`)
    if (contactForClosing.email) contactParts.push(`or email ${contactForClosing.email}`)
    const closingNarration = effectiveBrandName
      ? `Thank you for watching. ${contactParts.length > 0 ? `To learn more, ${contactParts.join(' ')}.` : `We appreciate your time.`} ${effectiveBrandName} looks forward to serving you.`
      : `Thank you for watching. ${contactParts.length > 0 ? `To learn more, ${contactParts.join(' ')}.` : `We appreciate your time.`}`

    // Prepend cover + append closing to scenes for VPS
    // VPS treats ALL slides the same — cover/closing are just the first/last
    const coverScene = { title: videoTitle, narration: coverNarration, slidePrompt: 'cover' }
    const closingScene = { title: 'Thank You', narration: closingNarration, slidePrompt: 'closing' }
    const allScenes = [coverScene, ...scenes, closingScene]

    // Build cover slide prompt
    const coverPrompt = `COVER_SLIDE:${effectiveBrandName || videoTitle}:${videoTitle}`
    // Build closing slide prompt
    const closingPrompt = `CLOSING_SLIDE:${effectiveBrandName || 'Thank You'}:${[contactForClosing.website, contactForClosing.phone, contactForClosing.email].filter(Boolean).join('|')}`

    // Prepend/append to slidePrompts
    const allSlidePrompts = [coverPrompt, ...slidePrompts, closingPrompt]

    // STAGE 3: Hand off to VPS — all slides have matching narration
    console.log(`[video ${videoId}] Handing off to VPS: ${allScenes.length} total slides (cover + ${scenes.length} content + closing), voice=${voiceId}`)
    await admin.from('videos').update({ progress_detail: 'Sending to video server...', progress_pct: 18 }).eq('id', videoId)

    const vpsRes = await fetch(`${VIDEO_ASSEMBLY_URL}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-secret': VIDEO_ASSEMBLY_SECRET },
      body: JSON.stringify({
        videoId,
        voiceId,
        scenes: allScenes,
        userId: user.id,
        slidePrompts: allSlidePrompts,
        videoTitle,
        contactForClosing,
        logoUrl,
        brandName: effectiveBrandName,
        brandColors,
        noContactBar: (body as any).noContactBar || false,
        musicPrompt: musicPrompt || (aiMusic ? 'Professional ambient background music, subtle and warm' : ''),
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
    logError('generate-video', err, { videoId, userId: user.id })
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
