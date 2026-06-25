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
import { getFlag, getSetting } from '../../_lib/app-settings'
import { buildV3Payload } from '../../_lib/v3-render'
import { isLambdaConfigured, renderV3OnLambda } from '../../_lib/v3-lambda'
import { buildEditorialPayload } from '../../_lib/editorial-render'
import { buildPresenter, resolvePhotoPlacement, isPersonProfile } from '../../_lib/presenter'
import { cleanRecipientName } from '../../_lib/text-format'
import { waitUntil } from '@vercel/functions'
import { logError } from '../../_lib/error-logger'
import { validateScript } from '../../_lib/script-validator'
import { rateLimit, getRateLimitKey, LIMITS } from '../../_lib/rate-limit'
import { buildSimpleSlidePrompt, getStylePrompt } from '../../_lib/slide-engine/simple-prompt'
import type { SimpleSlideInput } from '../../_lib/slide-engine/simple-prompt'
import { DEFAULT_PROMPT_VERSIONS } from '../../_lib/prompts'
import { PHONE_REGEX, phoneToSpoken, isPhoneInSource, formatPhoneDisplay } from '../../_lib/phone-utils'
import { estimateVideoCost, exceedsCeiling } from '../../_lib/cost-estimator'
import { deductCredits, calculateVideoCost, checkCredits, addTopupCredits, refundVideoCredits } from '../../_lib/credits'
import { isPaidTier, maxConcurrentForTier } from '../../_lib/subscription'
import { safeEqual } from '../../_lib/api-auth'
import { inngest } from '../../_lib/inngest/client'

export const runtime = 'nodejs'

const VIDEO_ASSEMBLY_URL = process.env.VIDEO_ASSEMBLY_URL
if (!VIDEO_ASSEMBLY_URL) console.error('[generate-video] VIDEO_ASSEMBLY_URL env var is not set!')
const VIDEO_ASSEMBLY_SECRET = (process.env.VIDEO_ASSEMBLY_SECRET || '').trim().replace(/[\r\n]/g, '')

export const maxDuration = 300

// Format narration for TTS — convert numbers, URLs, emails to spoken words
function formatForTTS(text: string): string {
  const dw: Record<string, string> = { '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine' }

  // Helper: spell out a string that isn't a real word (e.g. "tdaniel" → "t daniel", "jsmith123" → "j smith one two three")
  function spellUsername(user: string): string {
    // Split camelCase and number boundaries: "tdaniel" → "t daniel", "jsmith123" → "j smith 1 2 3"
    return user
      .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase
      .replace(/([a-zA-Z])(\d)/g, '$1 $2') // letter→digit
      .replace(/(\d)([a-zA-Z])/g, '$1 $2') // digit→letter
      .replace(/\./g, ' dot ')
      .replace(/_/g, ' ')
      .replace(/-/g, ' ')
      .toLowerCase()
  }

  return text
    // Phone numbers with separators — use unified PHONE_REGEX
    .replace(PHONE_REGEX, (match) => phoneToSpoken(match))
    // Bare 10-digit phone numbers (no separators): 4807254677 → digit by digit
    .replace(/\b(\d{10})\b/g, (match) => {
      // Only convert if it looks like a phone number (not a dollar amount or year)
      return `${match.slice(0, 3).split('').map(d => dw[d]).join(' ')}, ${match.slice(3, 6).split('').map(d => dw[d]).join(' ')}, ${match.slice(6).split('').map(d => dw[d]).join(' ')}`
    })
    // Percentages: 7.5% → seven point five percent
    .replace(/(\d+)\.(\d+)%/g, (_, a: string, b: string) => {
      return `${a.split('').map(d => dw[d] || d).join(' ')} point ${b.split('').map(d => dw[d] || d).join(' ')} percent`
    })
    // Email addresses FIRST (before URL, since emails contain dots)
    // info@example.com → "info at example dot com"
    // tdaniel@tonnerow.com → "t daniel at tonnerow dot com"
    .replace(/([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,})/g, (_, user: string, domain: string) => {
      return `${spellUsername(user)} at ${domain.replace(/\./g, ' dot ')}`
    })
    // URLs: www.example.com → example dot com
    .replace(/(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,})(?:\/\S*)?/g, (_, domain: string) => {
      return domain.replace(/\./g, ' dot ')
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
  // --- Internal service auth (public API v1) ---
  // The /api/v1 layer authenticates the API key, charges the SEPARATE API
  // credit pool, then calls this route server-to-server with a trusted header
  // and the resolved owner's user id. When that header is valid we act as that
  // user and skip the session lookup + UI-credit deduction (already metered).
  const internalSecret = (process.env.INTERNAL_API_SECRET || '').trim()
  const reqInternalSecret = (request.headers.get('x-internal-service') || '').trim()
  const internalUserId = request.headers.get('x-internal-user-id') || ''
  // Constant-time compare (audit L2) — this header grants impersonate-any-user
  // + skip-billing, the most powerful auth path in the app.
  const isInternalCall =
    !!internalSecret && safeEqual(reqInternalSecret, internalSecret) && !!internalUserId

  const supabase = await createClient()
  let user: { id: string; email?: string } | null = null
  if (isInternalCall) {
    user = { id: internalUserId }
  } else {
    const { data } = await supabase.auth.getUser()
    user = data.user
  }
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const rl = rateLimit(getRateLimitKey(user.id, 'generation'), LIMITS.generation.limit, LIMITS.generation.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 })
  }

  // --- Credit check ---
  // Use the admin (service-role) client for profile/credit reads on internal
  // calls — there is no session to scope the anon client.
  const db = isInternalCall ? createAdminClient() : supabase
  const { data: profile } = await db
    .from('profiles')
    .select('subscription_status, is_admin, is_beta')
    .eq('id', user.id)
    .single()

  // BILLING MODEL = CREDITS ONLY. The credit wallet (checkCredits/deductCredits
  // below) is the single paywall. The legacy free_videos_remaining / card_on_file
  // 403 gate was removed (audit B4: the counter was never decremented, so it
  // either let everyone through or duplicated the credit gate). Privileged users
  // (admin/beta/internal API) still skip the credit deduction.
  // Internal API calls are already metered against the API credit pool by the
  // /api/v1 layer, so they bypass UI-credit checks here.
  const isPrivileged = isInternalCall || isAdmin(user.email) || profile?.is_admin === true || profile?.is_beta === true
  const subStatus = (profile?.subscription_status ?? '').toLowerCase()
  const isPaidUser = isPaidTier(subStatus)

  // Per-plan concurrent-generation cap (audit L1). Previously enforced ONLY on
  // the legacy /api/videos path; the live wizard path was uncapped. Skip for
  // privileged/internal callers.
  if (!isPrivileged) {
    const maxConcurrent = maxConcurrentForTier(subStatus, {
      isAdmin: profile?.is_admin === true,
      isBeta: profile?.is_beta === true,
    })
    const { count: inProgressCount } = await db
      .from('videos')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('status', ['pending', 'scripting', 'generating_audio', 'generating_slides', 'assembling'])
    if (inProgressCount && inProgressCount >= maxConcurrent) {
      return NextResponse.json({
        error: `You can generate up to ${maxConcurrent === 1 ? '1 video' : `${maxConcurrent} videos`} at a time. ${inProgressCount} currently in progress.`,
        code: 'CONCURRENT_LIMIT',
      }, { status: 409 })
    }
  }

  const body = await request.json()
  const { videoId, policyData, brandId, voiceId, styleId, customStylePrompt, styleReferenceUrl, approvedSlides, preGeneratedScenes, detailed, musicUrl, aiMusic, musicPrompt, narrationStyle, assetUrls, purpose, uploadMode, industry, barText, recipientName, presenterIntro, introduceInOpening, showContactClosing, photoPlacement } = body as {
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
    barText?: string
    recipientName?: string
    // Personalization (presenter): per-video overrides on top of the selected profile.
    presenterIntro?: string
    introduceInOpening?: boolean
    showContactClosing?: boolean
    photoPlacement?: 'auto' | 'cover' | 'closing' | 'both' | 'none'
  }

  // Podcast (two-voice) mode sunset 2026-06-11 — all videos render solo
  const effectiveNarrationStyle = 'solo' as const

  // Pipeline v2 (Inngest + Creatomate) — opt-in via env flag
  const useV2 = process.env.USE_PIPELINE_V2 === 'true'
  // V3 (Remotion: cinematic / infographic) — toggled from admin back office,
  // DB-backed so it flips without a redeploy. Read once per request.
  const useV3 = await getFlag('video_engine_v3')
  // Render target: 'auto' (prefer Lambda if configured, else VPS), 'lambda'
  // (force Lambda), or 'vps' (force VPS). Set in admin Settings. Default 'auto'.
  const renderTarget = (await getSetting('video_render_target')) || 'auto'
  // Visual style: a per-video choice from the wizard (body.videoStyle) WINS over
  // the global admin default. One of 'cinematic' | 'editorial' | 'time' | 'explainer'.
  // ('editorial' = clean magazine, 'time' = bold red newsmagazine, 'explainer' =
  // friendly sans/navy educational — all three render through the editorial
  // engine with a `variant`.)
  const videoStyle = (body as any).videoStyle || (await getSetting('video_style')) || 'cinematic'
  const isMagazine = videoStyle === 'editorial' || videoStyle === 'time' || videoStyle === 'explainer'
  const editorialVariant: 'editorial' | 'time' | 'explainer' =
    videoStyle === 'editorial' ? 'editorial' : videoStyle === 'explainer' ? 'explainer' : 'time'

  // --- GUARD: Duplicate submission prevention ---
  // In-memory set = fast same-instance check. DB compare-and-set below is the
  // real guard (serverless instances don't share memory) — audit H3.
  if (inFlightVideos.has(videoId)) {
    return NextResponse.json({ error: 'This video is already being generated.' }, { status: 409 })
  }
  inFlightVideos.add(videoId)

  // DB-backed claim: only ONE request can move this video out of a non-running
  // state. If another instance already claimed it, rowCount is 0 → 409. This
  // prevents the double-charge + racing-jobs bug across Lambdas/cold starts.
  {
    const claimDb = createAdminClient()
    const { data: claimed } = await claimDb
      .from('videos')
      .update({ status: 'scripting', progress_updated_at: new Date().toISOString() })
      .eq('id', videoId)
      .in('status', ['draft', 'failed', 'pending'])
      .select('id')
    if (!claimed || claimed.length === 0) {
      inFlightVideos.delete(videoId)
      return NextResponse.json({ error: 'This video is already being generated.' }, { status: 409 })
    }
  }

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
  let deductedCost = 0
  if (!isPrivileged) {
    // CARD-ON-FILE GATE: free/trial users must save a card before producing
    // (collected via /setup-payment → Stripe SetupIntent → confirm-card). Paid
    // subscribers and admins/beta (isPrivileged, handled above) are exempt.
    // The client catches code:'card_required' and routes to /setup-payment.
    {
      const { data: gateProfile } = await createAdminClient()
        .from('profiles')
        .select('card_on_file, subscription_status')
        .eq('id', user.id)
        .single()
      const status = gateProfile?.subscription_status || 'free'
      const isPaid = ['starter', 'pro', 'business', 'enterprise', 'agency'].includes(status)
      if (!isPaid && !gateProfile?.card_on_file) {
        inFlightVideos.delete(videoId)
        return NextResponse.json(
          { error: 'Add a card to start your free trial.', code: 'card_required' },
          { status: 402 }
        )
      }
    }

    const videoCost = calculateVideoCost({
      outputType: (body as any).outputType || 'video',
      detailLevel: (body as any).detailLevel || (detailed ? 'detailed' : 'standard'),
      narrationStyle: effectiveNarrationStyle,
      userId: user.id, // honors grandfathered (old-rate) customers like Aziz
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
    deductedCost = videoCost
    // Persist the charge on the row so the stuck-video cron can refund the
    // exact amount if this job is later force-failed (audit H1/M3).
    await createAdminClient().from('videos').update({ deducted_cost: videoCost }).eq('id', videoId)
  }

  // Guarded-exit helper (audit H2): any early return AFTER deduction must refund
  // and leave a terminal status, or the user is silently charged for nothing.
  const failAndRefund = async (status: number, message: string, videoStatus: 'failed' | 'review_required' = 'failed') => {
    inFlightVideos.delete(videoId)
    const adminC = createAdminClient()
    await adminC.from('videos').update({ status: videoStatus, error_message: videoStatus === 'failed' ? message : null }).eq('id', videoId)
    if (deductedCost > 0) {
      // refund-now policy (incl. insurance review holds: refund now, recharge on approval)
      await refundVideoCredits(user.id, deductedCost, videoId)
    }
    return NextResponse.json({ error: message }, { status })
  }

  let brand: Brand | null = null
  if (brandId) {
    const { data } = await db.from('brands').select('*').eq('id', brandId).single()
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

    // --- GUARD: VPS health check before doing any work (v1 only) ---
    if (!useV2) {
      try {
        const healthRes = await fetch(`${VIDEO_ASSEMBLY_URL}/health`, { signal: AbortSignal.timeout(5000) })
        if (!healthRes.ok) throw new Error('VPS not healthy')
      } catch {
        throw new Error('Video server is temporarily offline. Please try again in a few minutes.')
      }
    }

    // STAGE 1: Generate script (or reuse pre-generated scenes)
    let scenes
    // User-edited cover/closing scenes (from the editor, flagged _role). When
    // present they override the auto-generated bookends so front/back are editable.
    let editedCover: any = null
    let editedClosing: any = null
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
        return await failAndRefund(400, 'All pre-generated scenes are invalid (missing narration, title, or slide content). Please regenerate your script.')
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
        narration: cleanText(s.narration || ''),
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

      // Pull out user-edited cover/closing (flagged _role by the editor) so they
      // OVERRIDE the auto-built bookends below, and remove them from the content
      // list so they aren't treated as content scenes. (Cleaned/carrier-stripped
      // already above.) If absent, the auto-build path runs as before.
      editedCover = scenes.find((s: any) => s._role === 'cover') || null
      editedClosing = scenes.find((s: any) => s._role === 'closing') || null
      scenes = scenes.filter((s: any) => s._role !== 'cover' && s._role !== 'closing')

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

      // Inject contact info into last scene narration if available — BRAND ONLY
      // (never scraped/extracted document contact, which is the source site's number)
      const guide = brand?.brand_guide_data as Record<string, string> | null | undefined
      const closingPhone = guide?.phone
      const closingEmail = guide?.email
      const closingWebsite = guide?.website
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
      // BRAND ONLY — never feed scraped/extracted document contact into the script
      const contactInfoForScript = {
        phone: guideDataForScript?.phone ?? undefined,
        email: guideDataForScript?.email ?? undefined,
        website: guideDataForScript?.website ?? undefined,
        calendly: guideDataForScript?.calendly ?? undefined,
      }

      // The user-approved brief (from the Review step) steers what the script
      // covers — honor it on this fallback path too, not just generate-script.
      const { data: draftRow } = await admin.from('videos').select('draft_data').eq('id', videoId).single()
      const approvedBrief = (draftRow?.draft_data as any)?.brief || null

      // Script generation with 60s timeout
      try {
        scenes = await Promise.race([
          generateScript(policyData, brand?.name ?? null, colors, detailed ?? false, 0, voiceId, (brand as any)?.tone ?? undefined, contactInfoForScript, purpose, uploadMode, industry, (body as any).detailLevel || (detailed ? 'detailed' : 'standard'), effectiveNarrationStyle, (policyData as any)?.classification ?? null, approvedBrief),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Script generation timed out. This document may be too large — try pasting the key sections instead.')), 60000)),
        ])
      } catch (scriptErr) {
        throw scriptErr
      }

      if (!scenes || scenes.length === 0) {
        throw new Error('Script generation produced no scenes. Try providing more content or a clearer purpose.')
      }

      // Narration stays original here — formatForTTS applied only when building VPS payload

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

    // --- GUARD: Insurance reconciliation/sanity gate (tiered) ---
    const isInsurance = 'policyType' in (policyData as any)
    if (isInsurance) {
      const sanityFlags = (policyData as any).sanityFlags as string[] | undefined
      if (sanityFlags?.length) {
        // TIER 1: Impossible values — extraction errors, never legitimate products. Block outright.
        const TIER1_PREFIXES = [
          'RECONCILIATION_FAILED', 'OPUS_EXTRACTION_FAILED',
          'CV_YEAR_EXCEEDS_MAX', 'SV_YEAR_EXCEEDS_MAX',
          'PREMIUM_NEGATIVE', 'DB_NEGATIVE', 'AGE_ABSURD', 'LOAN_RATE_ABSURD',
          'MISSING_POLICY_TYPE', 'MISSING_CARRIER', 'MISSING_INSURED_NAME', 'NO_CV_PROJECTIONS',
        ]
        const tier1Flags = sanityFlags.filter((f: string) => TIER1_PREFIXES.some(p => f.startsWith(p)))

        // TIER 2: Unusual but possibly legitimate — requires human approval before shipping.
        const TIER2_PREFIXES = [
          'CV_GUARANTEED_DIP', 'CV_CURRENT_DIP', 'SV_GUARANTEED_DIP', 'SV_CURRENT_DIP',
          'SV_EXCEEDS_CV', 'SV_EXCEEDS_CV_CURRENT',
          'DB_PREMIUM_RATIO_LOW', 'DB_PREMIUM_RATIO_HIGH',
          'PREMIUM_EXTREME', 'DB_EXTREME',
          'RECONCILIATION_REVIEW',
        ]
        const tier2Flags = sanityFlags.filter((f: string) => TIER2_PREFIXES.some(p => f.startsWith(p)))

        if (tier1Flags.length > 0) {
          // BLOCK: impossible values — bad reads, not unusual products.
          // Refund now (policy: refund on hold, recharge on approval) — audit H2.
          inFlightVideos.delete(videoId)
          const flagSummary = tier1Flags.join('; ')
          console.error(`[video ${videoId}] Insurance BLOCKED (Tier 1 — impossible values): ${flagSummary}`)
          await admin.from('videos').update({
            status: 'review_required',
            progress_detail: `Extraction errors detected: ${flagSummary}`,
            progress_pct: 0,
          }).eq('id', videoId)
          if (deductedCost > 0) await refundVideoCredits(user.id, deductedCost, videoId)
          return NextResponse.json({ error: 'Insurance data contains extraction errors that must be corrected before generating a video. Please review the extracted data.', reviewRequired: true, tier: 1, flags: tier1Flags }, { status: 422 })
        }

        if (tier2Flags.length > 0) {
          // HOLD: unusual values — human must approve before shipping. Refund now;
          // re-charge happens when a reviewer approves and re-runs (audit H2).
          inFlightVideos.delete(videoId)
          const flagSummary = tier2Flags.join('; ')
          console.warn(`[video ${videoId}] Insurance HELD for review (Tier 2 — unusual values): ${flagSummary}`)
          await admin.from('videos').update({
            status: 'review_required',
            progress_detail: `Unusual values flagged for review: ${flagSummary}`,
            progress_pct: 0,
          }).eq('id', videoId)
          if (deductedCost > 0) await refundVideoCredits(user.id, deductedCost, videoId)
          return NextResponse.json({ error: 'Insurance data contains unusual values that need human verification before generating a video. A reviewer can approve and release this.', reviewRequired: true, tier: 2, flags: tier2Flags }, { status: 422 })
        }
      }
    }

    // --- GUARD: Pre-flight script validation ---
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
      // Refund — the user didn't get a video (audit H2).
      if (deductedCost > 0) await refundVideoCredits(user.id, deductedCost, videoId)
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
      // Refund — blocked by our ceiling, not the user's fault (audit H2).
      if (deductedCost > 0) await refundVideoCredits(user.id, deductedCost, videoId)
      return NextResponse.json({ error: 'Daily usage limit reached.' }, { status: 429 })
    }

    // STAGE 2: Build slide prompts — simple, direct prompts for OpenAI
    console.log(`[video ${videoId}] Building slide prompts for ${scenes.length} scenes...`)
    // Save style reference URL if provided (custom uploaded style)
    if (styleReferenceUrl) {
      await admin.from('videos').update({ style_reference_url: styleReferenceUrl }).eq('id', videoId)
    }
    await admin.from('videos').update({ progress_detail: 'Preparing slide designs...', progress_pct: 16 }).eq('id', videoId)

    const templateId = (styleId ?? brand?.deck_style_id ?? 'isometric-3d') as string
    // Logo not used in video pipeline — branding is text-only
    const logoUrl = null
    const brandGuide = brand?.brand_guide_data as Record<string, string> | null
    // Colors come from the selected brand — single source of truth. body.brandColors
    // is still honored if present (legacy drafts) but the wizard no longer sends it.
    const bodyColors = (body as any).brandColors as { primary?: string; secondary?: string } | undefined
    const brandColors = {
      primary: bodyColors?.primary || brand?.primary_color || '#1B365D',
      secondary: bodyColors?.secondary || brand?.secondary_color || '#4A90D9',
    }
    if (!brand?.primary_color && !bodyColors?.primary) {
      console.warn(`[video ${videoId}] No brand colors found (brandId=${brandId ?? 'none'}) — using defaults`)
    }

    // Build style prompt: custom theme > isometric-3d (default)
    let stylePrompt: string
    if (customStylePrompt) {
      stylePrompt = customStylePrompt
    } else {
      stylePrompt = getStylePrompt(templateId)
    }

    const slidePrompts = scenes.map((scene: any, i: number) => {
      const isFirst = i === 0
      const isLast = i === scenes.length - 1

      // Use slideData from script generator (preferred) or fall back to narration extraction
      const sd = scene.slideData as { headline?: string; stats?: { label: string; value: string }[]; bullets?: string[] } | undefined
      const cleanNarration = scene.narration?.replace(/^(Host|Expert|Advisor|Client|Narrator|Clarifier|Alex|Jordan):\s*/gim, '') || ''

      // Contact info for cover/closing slide — BRAND ONLY (never scraped/extracted
      // document contact, which carries the source website's phone number)
      const sceneContactInfo = (isFirst || isLast)
        ? {
            phone: brandGuide?.phone || undefined,
            website: (brandGuide?.website || '')?.toLowerCase() || undefined,
            email: (brandGuide?.email || '')?.toLowerCase() || undefined,
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

      // 1 slide per scene — headline + key points only, narration is spoken not displayed
      const fp = scene.framePrompts?.[0] || scene.slidePrompt || scene.title

      // NO contact bar / footer bar on content slides. Asking Gemini to draw a
      // "thin footer bar with contact info" produced an empty solid stripe (the
      // model drew the bar shape but not legible text), wasting slide space on
      // every frame. Contact info belongs on the closing slide only, composited
      // as real text — never drawn by the image model. (Removed 2026-06-17.)
      return `${stylePrompt}\n\n${fp}\n\nTopic context (for visual inspiration only, do NOT put this text on the slide): "${scene.narration?.slice(0, 150)}"\n\nCRITICAL TEXT RULE: Maximum 25 words of visible text on this slide. Use a short headline (3-6 words), 2-4 bullet points (3-5 words each), and large numbers/icons. The narration provides the detail — the slide is VISUAL SUPPORT only. NO paragraphs, NO sentences, NO long text blocks.\n\nCRITICAL COLOR RULE: Use these EXACT brand colors as the dominant palette — primary: ${brandColors.primary}, secondary: ${brandColors.secondary}. If the style description above mentions any other colors, IGNORE them and use these brand colors instead — the brand colors always win. No logos, no brand marks, no fictional emblems.\n\n⛔ NO FOOTER BAR, NO CONTACT INFO: Do NOT draw any footer bar, banner, or strip along the bottom of the slide. Do NOT render any phone number, email address, or website URL anywhere on this slide.\n\n⛔ SAFE MARGINS — KEEP CONTENT AWAY FROM ALL EDGES: Leave a clear margin of at least 8% of the frame on EVERY edge (top, bottom, left, right). All text, headlines, numbers, icons and important artwork must sit comfortably INSIDE this safe area — never touching or running off any edge. Do NOT place the title at the very top edge. Do NOT add any solid colored bar, band, strip, or footer along the bottom (or top) of the slide — the background should fade or stay plain at the edges, not form a hard colored band. The slide must look balanced and fully contained within the frame.`
    })

    // Video metadata
    const videoTitle = scenes[0]?.title || (policyData as any)?.title || purpose || 'Presentation'
    // For a PERSON profile that opted out of showing their name on slides, don't
    // force the name as the on-screen brand/masthead — let the doc title lead.
    // (The name still appears in the spoken intro + closing card.)
    const personHidesName = isPersonProfile(brand) && brand?.show_name_on_slides === false
    const effectiveBrandName = personHidesName ? null : (brand?.name || (body as any).companyName || null)

    // Save title to DB so it shows in the library
    await admin.from('videos').update({ title: videoTitle }).eq('id', videoId)
    // Contact info comes ONLY from the agent's saved brand — never from
    // scraped/extracted document data, which carries the SOURCE site's phone
    // (e.g. a number off the scraped website leaking onto the closing slide).
    const contactForClosing = {
      phone: brandGuide?.phone || undefined,
      email: brandGuide?.email || undefined,
      website: brandGuide?.website || undefined,
    }
    // VISUAL phone is formatted x-xxx-xxx-xxxx for the on-screen contact line +
    // closing card (fixes raw "9366417130" showing in existing/new videos). The
    // SPOKEN narration keeps the raw value (TTS reads digits naturally).
    const contactDisplayPhone = contactForClosing.phone ? formatPhoneDisplay(contactForClosing.phone) : undefined

    // Presenter (Person profile) — the human who made this video. Drives a
    // personal spoken opening + the closing card. Null for company profiles or
    // when the person opted out of being introduced.
    const presenter = buildPresenter(brand, { intro: presenterIntro, introduceInOpening })
    const photoPlacementResolved = resolvePhotoPlacement(videoStyle, photoPlacement)

    // Build cover narration (short intro) — formatted for natural speech.
    // Use recipient name from draft data or request body — but scrub generic
    // placeholders ("Mr. Client", "Valued Client", "John Doe", etc.) so they
    // never reach the greeting/slides. No real name → no name (lead with topic).
    const recipient = cleanRecipientName(
      recipientName || (policyData as any)?.recipientName || (policyData as any)?.insuredName || ''
    )
    // If a presenter wrote their own intro line, speak THAT (optionally greeting
    // the recipient first); otherwise fall back to the generic welcome.
    let coverNarration: string
    if (presenter?.intro) {
      const greet = recipient ? `Hello ${recipient}. ` : ''
      coverNarration = formatForTTS(`${greet}${presenter.intro}`)
    } else {
      const greeting = recipient ? `Hello ${recipient}, thank you for your time today.` : `Thank you for your time today.`
      coverNarration = formatForTTS(`${greeting} ${videoTitle}.`)
    }

    // Build closing narration (short outro). Contact info is spoken only when the
    // user wants it on the closing (default on). For a presenter, sign off in
    // their voice ("...prepared by Sarah Talls"); else use the company name.
    const wantContactClosing = showContactClosing !== false
    const contactParts: string[] = []
    if (wantContactClosing && contactForClosing.website) contactParts.push(`Visit ${contactForClosing.website}`)
    if (wantContactClosing && contactForClosing.phone) contactParts.push(`or call ${contactForClosing.phone}`)
    if (wantContactClosing && contactForClosing.email) contactParts.push(`or email ${contactForClosing.email}`)
    const signoff = presenter?.name
      ? `Prepared for you by ${presenter.name}${presenter.role ? `, ${presenter.role}` : ''}.`
      : (effectiveBrandName ? `${effectiveBrandName} looks forward to serving you.` : '')
    const closingNarration = formatForTTS(
      `Thank you for watching. ${contactParts.length > 0 ? `To learn more, ${contactParts.join(' ')}.` : `We appreciate your time.`} ${signoff}`.trim())

    // Prepend cover + append closing to scenes for VPS.
    // If the user edited them in the editor (editedCover/editedClosing), their
    // narration + on-slide text WIN — we don't regenerate or re-append contact.
    const coverScene = {
      title: editedCover?.title || videoTitle,
      narration: formatForTTS(editedCover?.narration?.trim() || coverNarration),
      slidePrompt: 'cover',
      slideData: editedCover?.slideData || undefined,
    }
    const closingScene = {
      title: editedClosing?.title || 'Thank You',
      narration: formatForTTS(editedClosing?.narration?.trim() || closingNarration),
      slidePrompt: 'closing',
      slideData: editedClosing?.slideData || undefined,
    }
    // Apply formatForTTS only for VPS scenes (narration stays original in slidePrompts for image context)
    const ttsScenes = scenes.map((s: any) => ({ ...s, narration: s.narration ? formatForTTS(s.narration) : s.narration }))
    const allScenes = [coverScene, ...ttsScenes, closingScene]

    // Build cover slide prompt — same format as content slides so Gemini uses consistent style
    const contactLine = [contactDisplayPhone, contactForClosing.email, contactForClosing.website].filter(Boolean).join(' | ')
    // Hard rule: when no contact info was provided, forbid ANY phone/email/URL
    // outright — Gemini will otherwise hallucinate a plausible phone number on
    // the closing slide (a serious problem on a compliance-sensitive video).
    const noContactRule = '\n\n⛔ ABSOLUTE RULE — NO CONTACT INFO: Do NOT render any phone number, email address, website URL, or street address anywhere on this slide. Not a real one, not a placeholder, not an example. There must be ZERO digits arranged like a phone number (e.g. nothing resembling 555-123-4567) and ZERO "@" symbols or ".com" text. Contact details were NOT provided and inventing them is forbidden.'
    const contactRule = (line: string) => `\n\nCONTACT INFO: Display EXACTLY this contact line and nothing else resembling contact info: ${line}. Do not add, modify, or invent any other phone, email, or URL.`
    const colorRule = `\n\nCRITICAL COLOR RULE: Use these EXACT brand colors as the dominant palette — primary: ${brandColors.primary}, secondary: ${brandColors.secondary}. If the style description above mentions any other colors, IGNORE them and use these brand colors instead — the brand colors always win. No logos, no brand marks, no fictional emblems.`
    // Cover is a CLEAN TITLE CARD, not a data dashboard. We pass the style for
    // visual treatment (palette, mood) but explicitly forbid the data/metric
    // elements the style describes — otherwise Gemini fills the cover with
    // INVENTED placeholder stats (fake dollar amounts, "loss prevention", etc.)
    // that have nothing to do with the actual content.
    const titleCardRule = `\n\n⛔ THIS IS A TITLE CARD, NOT AN INFOGRAPHIC: Show ONLY the title text (and brand name) as the focal point, with simple decorative background artwork in the style's palette. Do NOT include any data, statistics, dollar amounts, percentages, charts, metric callouts, coins, shields, plants, gauges, or labeled icons. Do NOT invent or display ANY numbers or figures. Keep it minimal and clean — a single bold title on an attractive background.\n\n⛔ SAFE MARGINS: Keep the title and all content at least 8% away from every edge — never touching or running off the top, bottom, or sides. Do NOT add any solid colored bar, band, strip, or footer along the bottom or top of the slide; let the background stay plain or fade at the edges.`
    // If the user edited the cover/closing on-slide text, render EXACTLY that.
    const coverHeadline = (editedCover?.slideData?.headline || '').trim()
    const closingCta = (editedClosing?.slideData?.cta || '').trim()
    const coverTitleForSlide = coverHeadline || videoTitle
    const coverPrompt = `${stylePrompt}\n\nCreate a professional COVER / TITLE SLIDE for a presentation titled "${coverTitleForSlide}"${effectiveBrandName ? ` by ${effectiveBrandName}` : ''}. This is the opening slide — bold and eye-catching, with the title as the clear focal point. Leave the top-left corner empty for logo placement.${titleCardRule}${colorRule}${noContactRule}`
    // The closing slide is a CALL-TO-ACTION + CONTACT card — NOT a title card and
    // NOT a data dashboard. It should drive the viewer to act and show the real
    // contact line (when provided). Still forbid INVENTED data/stats so Gemini
    // doesn't fill it with fake dollar figures like it did on the cover.
    const ctaCardRule = `\n\n⛔ THIS IS A CALL-TO-ACTION SLIDE, NOT A DATA INFOGRAPHIC: Show a clear "Thank You" heading plus a short call-to-action encouraging the viewer to get in touch / take the next step. Do NOT include any statistics, dollar amounts, percentages, charts, or metric callouts, and do NOT invent ANY numbers. Keep it clean, warm, and focused on the contact details and CTA.`
    const closingCtaInstruction = closingCta ? `\n\nUse EXACTLY this call-to-action text on the slide: "${closingCta}".` : ''
    const closingPrompt = `${stylePrompt}\n\nCreate a professional CLOSING / CALL-TO-ACTION SLIDE. Display "Thank You" as the main heading with a brief, inviting call to action. This is the final slide — warm and conclusive. Leave the top-left corner empty for logo placement.${closingCtaInstruction}${ctaCardRule}${colorRule}${contactLine ? contactRule(contactLine) : noContactRule}`

    // Prepend/append to slidePrompts
    const allSlidePrompts = [coverPrompt, ...slidePrompts, closingPrompt]

    // STAGE 3 (v2): queue the Inngest + Creatomate pipeline and return.
    // Completion is driven by the Creatomate webhook; failure by Inngest onFailure.
    if (useV2) {
      console.log(`[video ${videoId}] Pipeline v2: queueing ${allScenes.length} slides (cover + ${scenes.length} content + closing), voice=${voiceId}`)
      if (aiMusic || musicPrompt) {
        console.warn(`[video ${videoId}] Pipeline v2 does not support AI music yet — continuing without it`)
      }
      // Cover/closing in v2 are pure decorative backgrounds — brand name and
      // title are overlaid as real text by Creatomate (mirrors VPS behavior,
      // where these prompts are ignored and text is composited with Sharp).
      const v2Prompts = [...allSlidePrompts]
      const v2ColorRule = `Use these EXACT brand colors as the dominant palette: primary ${brandColors.primary}, secondary ${brandColors.secondary}. If the style description mentions other colors, IGNORE them — the brand colors always win.`
      v2Prompts[0] = `${stylePrompt}\n\nCreate a stunning decorative BACKGROUND artwork for a premium video title card. Rich depth, layered composition, abstract shapes and visual metaphors. Keep the CENTER of the image (middle 60%) visually calm and uncluttered — large text will be overlaid there. ${v2ColorRule}\n\nABSOLUTELY NO TEXT, NO WORDS, NO LETTERS, NO LOGOS, NO RESERVED BLANK BOXES anywhere. Pure illustrated artwork filling the entire 1920x1080 canvas.`
      v2Prompts[v2Prompts.length - 1] = `${stylePrompt}\n\nCreate a stunning decorative BACKGROUND artwork for a video closing card. Warm, hopeful, conclusive feel — soft light, path toward a bright horizon. Keep the CENTER of the image (middle 60%) visually calm and uncluttered — text will be overlaid there. ${v2ColorRule}\n\nABSOLUTELY NO TEXT, NO WORDS, NO LETTERS, NO LOGOS, NO RESERVED BLANK BOXES anywhere. Pure illustrated artwork filling the entire 1920x1080 canvas.`

      await admin.from('videos').update({ progress_detail: 'Queueing video pipeline...', progress_pct: 18 }).eq('id', videoId)
      await inngest.send({
        name: 'video/render.v2',
        data: {
          videoId,
          userId: user.id,
          voiceId,
          scenes: allScenes.map((s: any) => ({ narration: s.narration || '' })),
          slidePrompts: v2Prompts,
          deductedCost,
          musicUrl: musicUrl || undefined,
          brandName: effectiveBrandName || undefined,
          videoTitle,
          contactLine: contactLine || undefined,
          primaryColor: brandColors.primary,
          // Trial watermark for free users — same rule as the VPS
          watermark: !isPaidUser && !isPrivileged,
        },
      })
      return NextResponse.json({ success: true, pipeline: 'v2' })
    }

    // STAGE 3 (V3): if the admin enabled the V3 engine, render with Remotion on
    // the VPS instead of the classic /generate path. Theme is auto-picked by
    // content (data-heavy → infographic, else cinematic); brand colors + logo
    // variants applied. Same ACK-timeout-safe handoff as v1.
    if (useV3) {
      // EDITORIAL style: build magazine-archetype scenes and render the
      // EditorialVideo composition on the VPS (/render-editorial). Separate from
      // the cinematic path so neither affects the other.
      if (isMagazine) {
        console.log(`[video ${videoId}] magazine style (${editorialVariant}) — structuring archetypes`)
        await admin.from('videos').update({ progress_detail: 'Designing your report...', progress_pct: 16 }).eq('id', videoId)
        const edPayload = await buildEditorialPayload({
          videoId, userId: user.id, voiceId,
          scenes, brand, brandName: effectiveBrandName,
          extracted: policyData,
          contactLine: wantContactClosing ? (contactLine || undefined) : undefined,
          musicUrl: musicUrl || undefined, musicPrompt: musicPrompt || undefined, aiMusic: aiMusic || undefined,
          presenter, photoPlacement: photoPlacement || undefined,
          variant: editorialVariant,
        })
        console.log(`[video ${videoId}] editorial: ${edPayload.scenes.length} scenes, archetypes=${edPayload.scenes.map(s => s.archetype).join(',')}`)
        try {
          const edRes = await fetch(`${VIDEO_ASSEMBLY_URL}/render-editorial`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-secret': VIDEO_ASSEMBLY_SECRET },
            body: JSON.stringify(edPayload),
            signal: AbortSignal.timeout(25000),
          })
          const edText = await edRes.text()
          let edData: { success?: boolean; error?: string } | null = null
          try { edData = JSON.parse(edText) } catch { /* non-JSON */ }
          if (!edRes.ok || !edData?.success) throw new Error(edData?.error || `Editorial render error (HTTP ${edRes.status})`)
          console.log(`[video ${videoId}] editorial accepted — rendering in background.`)
          inFlightVideos.delete(videoId)
          return NextResponse.json({ success: true, pipeline: 'editorial' })
        } catch (edErr) {
          const isAbort = edErr instanceof Error && (edErr.name === 'TimeoutError' || edErr.name === 'AbortError')
          if (isAbort) {
            await admin.from('videos').update({ status: 'assembling', progress_detail: 'Rendering your report...', progress_updated_at: new Date().toISOString() }).eq('id', videoId)
            inFlightVideos.delete(videoId)
            return NextResponse.json({ success: true, queued: true, pipeline: 'editorial' })
          }
          throw edErr
        }
      }

      console.log(`[video ${videoId}] V3 engine ON — building Remotion payload (${scenes.length} content scenes)`)
      await admin.from('videos').update({ progress_detail: 'Preparing cinematic render...', progress_pct: 18 }).eq('id', videoId)

      const v3Payload = buildV3Payload({
        videoId, userId: user.id, voiceId,
        scenes, brand, brandName: effectiveBrandName,
        classification: (policyData as any)?.classification ?? null,
        industry,
        keyMetrics: (policyData as any)?.keyMetrics ?? [],
        musicUrl: musicUrl || undefined,
        musicPrompt: musicPrompt || undefined,
        aiMusic: aiMusic || undefined,
        contactLine: wantContactClosing ? (contactLine || undefined) : undefined,
        contact: wantContactClosing ? { phone: contactDisplayPhone, email: contactForClosing.email, website: contactForClosing.website } : undefined,
        presenter, photoPlacement: photoPlacement || undefined,
        videoStyle,
      })
      console.log(`[video ${videoId}] V3 theme=${v3Payload.theme}, logo=${v3Payload.logo ? 'yes' : 'no'}, presenter=${presenter ? 'yes' : 'no'}`)

      // PREFERRED: render on Remotion Lambda (fast, parallel) when configured.
      // Runs in the background (waitUntil) — generates assets, renders, finalizes
      // the row. Falls back to the VPS path below if Lambda env isn't set.
      // Choose renderer per the admin setting. 'vps' forces the VPS path below;
      // 'lambda'/'auto' use Lambda when it's configured (else fall back to VPS).
      const wantLambda = renderTarget !== 'vps' && isLambdaConfigured()
      if (wantLambda) {
        console.log(`[video ${videoId}] V3 via Lambda (target=${renderTarget})`)
        waitUntil((async () => {
          try {
            await renderV3OnLambda(v3Payload)
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Lambda render failed'
            console.error(`[video ${videoId}] Lambda render CRASH: ${message}`)
            // Capture the REAL reason in error_logs — otherwise a render failure
            // refunds silently and leaves nothing to diagnose (the "no logs" bug).
            logError('generate-video:lambda', err, { videoId, userId: user.id })
            await admin.from('videos').update({ status: 'failed', error_message: 'Video rendering failed. Your credits were refunded.', progress_detail: null }).eq('id', videoId)
            if (deductedCost && deductedCost > 0) await refundVideoCredits(user.id, deductedCost, videoId).catch(() => {})
          }
        })())
        inFlightVideos.delete(videoId)
        return NextResponse.json({ success: true, pipeline: 'v3-lambda' })
      }

      let v3Res: Response
      try {
        v3Res = await fetch(`${VIDEO_ASSEMBLY_URL}/render-v3`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-secret': VIDEO_ASSEMBLY_SECRET },
          body: JSON.stringify(v3Payload),
          signal: AbortSignal.timeout(25000),
        })
      } catch (v3Err) {
        const isAbort = v3Err instanceof Error && (v3Err.name === 'TimeoutError' || v3Err.name === 'AbortError')
        if (isAbort) {
          console.warn(`[video ${videoId}] V3 ACK timed out — treating as maybe-queued; cron will reconcile.`)
          await admin.from('videos').update({
            status: 'assembling', progress_detail: 'Rendering cinematic video...',
            progress_updated_at: new Date().toISOString(),
          }).eq('id', videoId)
          inFlightVideos.delete(videoId)
          return NextResponse.json({ success: true, queued: true, pipeline: 'v3' })
        }
        throw v3Err
      }

      const v3Text = await v3Res.text()
      let v3Data: { success?: boolean; error?: string } | null = null
      try { v3Data = JSON.parse(v3Text) } catch { /* non-JSON */ }
      if (!v3Res.ok || !v3Data?.success) {
        console.error(`[video ${videoId}] V3 error (HTTP ${v3Res.status}):`, v3Text.slice(0, 500))
        throw new Error(v3Data?.error || `V3 render server error (HTTP ${v3Res.status})`)
      }
      console.log(`[video ${videoId}] V3 accepted — rendering in background.`)
      inFlightVideos.delete(videoId)
      return NextResponse.json({ success: true, pipeline: 'v3' })
    }

    // STAGE 3: Hand off to VPS — all slides have matching narration
    console.log(`[video ${videoId}] Handing off to VPS: ${allScenes.length} total slides (cover + ${scenes.length} content + closing), voice=${voiceId}`)
    await admin.from('videos').update({ progress_detail: 'Sending to video server...', progress_pct: 18 }).eq('id', videoId)

    const vpsBody = JSON.stringify({
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
      barText: barText || undefined,
      musicPrompt: musicPrompt || (aiMusic ? 'Professional ambient background music, subtle and warm' : ''),
      industry: industry || '',
      narrationStyle: effectiveNarrationStyle,
      styleId: templateId || 'apex-corporate',
      customStylePrompt: customStylePrompt || undefined,
      templateRefUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://docs2video.com'}/style-previews/${templateId}.png`,
    })

    let vpsRes: Response
    try {
      vpsRes = await fetch(`${VIDEO_ASSEMBLY_URL}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-secret': VIDEO_ASSEMBLY_SECRET },
        body: vpsBody,
        // 25s ACK window (audit M4) — a busy VPS can take >10s just to acknowledge.
        signal: AbortSignal.timeout(25000),
      })
    } catch (vpsErr) {
      // ACK timeout / network abort: the VPS MAY have received and started the
      // job. Do NOT refund+fail (that produced free/confusing videos). Leave the
      // row in-progress with a fresh progress stamp so fix-stuck-videos
      // reconciles it via the MP4's appearance (audit M4).
      const isAbort = vpsErr instanceof Error && (vpsErr.name === 'TimeoutError' || vpsErr.name === 'AbortError')
      if (isAbort) {
        console.warn(`[video ${videoId}] VPS ACK timed out — treating as maybe-queued; cron will reconcile.`)
        await admin.from('videos').update({
          status: 'assembling',
          progress_detail: 'Sent to video server — finishing up...',
          progress_updated_at: new Date().toISOString(),
        }).eq('id', videoId)
        inFlightVideos.delete(videoId)
        return NextResponse.json({ success: true, queued: true })
      }
      throw vpsErr
    }

    const vpsText = await vpsRes.text()
    let vpsData: { success?: boolean; error?: string } | null = null
    try { vpsData = JSON.parse(vpsText) } catch { /* non-JSON (e.g. proxy error page) */ }
    if (!vpsRes.ok || !vpsData?.success) {
      console.error(`[video ${videoId}] VPS error response (HTTP ${vpsRes.status}):`, vpsText.slice(0, 500))
      throw new Error(vpsData?.error || `Video server error (HTTP ${vpsRes.status})`)
    }

    console.log(`[video ${videoId}] VPS accepted — generation running in background. Returning.`)
    return NextResponse.json({ success: true })

  } catch (err) {
    console.error(`[video ${videoId}] Error:`, err)
    logError('generate-video', err, { videoId, userId: user.id })
    if (deductedCost > 0) {
      try {
        await refundVideoCredits(user.id, deductedCost, videoId)
        console.log(`[video ${videoId}] Refunded ${deductedCost} credits after generation failure`)
      } catch (refundErr) {
        console.error(`[video ${videoId}] Credit refund failed:`, refundErr)
      }
    }
    const message = err instanceof Error ? err.message : 'Video generation failed'
    await admin.from('videos').update({ status: 'failed', error_message: message }).eq('id', videoId)
    if (jobId) await updateJobProgress(admin, jobId, 0, 'failed', { error_message: message })
    await sendNotification(admin, user.id, {
      type: 'video_failed',
      title: 'Video generation failed',
      message,
      link: `/videos/${videoId}`,
    })
    // API jobs: refund the metered API pool (UI pool was never charged) and
    // fire the caller's webhook so external apps learn of the failure.
    if (isInternalCall) {
      const { data: vrow } = await admin.from('videos').select('draft_data').eq('id', videoId).single()
      const dd = (vrow?.draft_data as any) || {}
      if (dd.source === 'api') {
        try {
          const { refundApiCredits } = await import('../../_lib/api-auth')
          const { fireApiWebhook } = await import('../../_lib/api-webhook')
          if (dd.apiCost && dd.apiCost > 0) await refundApiCredits(user.id, dd.apiCost)
          await fireApiWebhook(videoId)
        } catch (e) {
          console.error(`[video ${videoId}] API failure handling error:`, e)
        }
      }
    }
    return NextResponse.json({ error: message }, { status: 500 })
  } finally {
    // Always clean up in-flight tracking
    inFlightVideos.delete(videoId)
  }
}
