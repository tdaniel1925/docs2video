import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { generateSlide } from '../../_lib/gemini'
import { compositeSlide } from '../../_lib/composite'
import { generateCoverOverlay, generateBottomBar, generateTopLeftLogo } from '../../_lib/cover-overlay'
import type { ExtractedPolicyData, SlideStyleId } from '../../_lib/types'
import type { ExtractedData } from '../../_lib/extract-types'
import { rateLimit, getRateLimitKey, LIMITS } from '../../_lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const rl = rateLimit(getRateLimitKey(user.id, 'generation'), LIMITS.generation.limit, LIMITS.generation.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 })
  }

  const body = await request.json()
  const { policyData, slideIndex, styleId, brandId, slidePrompt, isLastSlide, assetUrl, previousSlideBase64, styleReferenceUrl } = body as {
    policyData: ExtractedPolicyData | ExtractedData
    slideIndex: number
    styleId: SlideStyleId
    brandId: string | null
    slidePrompt?: string
    isLastSlide?: boolean
    assetUrl?: string
    previousSlideBase64?: string
    styleReferenceUrl?: string
  }

  let brandName: string | null = null
  let logoUrl: string | null = null
  let photoUrl: string | null = null
  let colors = { primary: '#1B365D', secondary: '#4A90D9', accent: '#FFB347', background: '#0a1628', text: '#FFFFFF' }

  if (brandId) {
    // Scope to owner (review S3): brands RLS may be off in prod — never fetch by bare id.
    const { data: brand } = await supabase.from('brands').select('*').eq('id', brandId).eq('user_id', user.id).single()
    if (brand) {
      brandName = brand.name
      logoUrl = brand.logo_file_url ?? brand.logo_url
      colors = {
        primary: brand.primary_color,
        secondary: brand.secondary_color,
        accent: brand.accent_color,
        background: brand.background_color,
        text: brand.text_color,
      }
    }
  }

  // Get agent photos from profile
  let standingPhotoUrl: string | null = null
  const { data: profile } = await supabase.from('profiles').select('photo_url, photo_standing_url').eq('id', user.id).single()
  if (profile) {
    photoUrl = profile.photo_url
    standingPhotoUrl = profile.photo_standing_url ?? null
  }

  try {
    // Download logo for Sharp compositing (NOT passed to Gemini)
    let logoBuffer: Buffer | null = null
    if (logoUrl) {
      try {
        const logoRes = await fetch(logoUrl, { signal: AbortSignal.timeout(8000) })
        if (logoRes.ok) logoBuffer = Buffer.from(await logoRes.arrayBuffer())
      } catch { /* proceed without logo */ }
    }

    // Load template reference image for visual consistency
    const fs = await import('fs/promises')
    const path = await import('path')
    let templateRefBuffer: Buffer | null = null
    // Priority: styleReferenceUrl (custom upload) > local style preview file
    if (styleReferenceUrl) {
      try {
        const refRes = await fetch(styleReferenceUrl, { signal: AbortSignal.timeout(8000) })
        if (refRes.ok) templateRefBuffer = Buffer.from(await refRes.arrayBuffer())
      } catch { /* proceed without custom reference */ }
    }
    if (!templateRefBuffer) {
      try {
        const refPath = path.join(process.cwd(), 'public', 'style-previews', `${styleId}.png`)
        templateRefBuffer = await fs.readFile(refPath)
      } catch { /* template preview not found, skip */ }
    }

    // Download asset image if provided
    let assetBuffer: Buffer | null = null
    if (assetUrl) {
      try {
        const assetRes = await fetch(assetUrl, { signal: AbortSignal.timeout(8000) })
        if (assetRes.ok) assetBuffer = Buffer.from(await assetRes.arrayBuffer())
      } catch { /* proceed without asset */ }
    }

    // Convert previous slide base64 to buffer for visual consistency
    let previousSlideBuffer: Buffer | null = null
    if (previousSlideBase64) {
      try {
        const base64Data = previousSlideBase64.replace(/^data:image\/\w+;base64,/, '')
        previousSlideBuffer = Buffer.from(base64Data, 'base64')
      } catch { /* proceed without consistency reference */ }
    }

    // Logo is NOT passed to Gemini — Sharp composites it afterward
    // brandName NOT passed to Gemini — Sharp composites the actual logo afterward
    let imageBuffer = await generateSlide(
      policyData, slideIndex, styleId, null, null, colors, slidePrompt, !!photoUrl, undefined,
      null, undefined, undefined, undefined, undefined, undefined, templateRefBuffer ?? previousSlideBuffer, assetBuffer
    )

    // Generate Sharp overlay for logo/brand placement
    const isCover = slideIndex === 0
    const isClosing = isLastSlide ?? false
    let overlayBuffer: Buffer | null = null

    // Top-left logo on every slide (logo or company name fallback)
    try {
      overlayBuffer = await generateTopLeftLogo(
        logoBuffer ?? null,
        brandName,
        { primary: colors.primary, text: colors.text }
      )
    } catch { /* proceed without top-left logo */ }

    // Composite overlay + photo onto the slide
    imageBuffer = await compositeSlide(imageBuffer, photoUrl, null, isCover, isClosing, standingPhotoUrl, null, null, undefined, overlayBuffer)

    const base64 = `data:image/png;base64,${imageBuffer.toString('base64')}`
    return NextResponse.json({ image: base64 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate slide'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
