import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { generateSlide } from '../../_lib/gemini'
import { compositeSlide } from '../../_lib/composite'
import { generateCoverOverlay } from '../../_lib/cover-overlay'
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
  const { policyData, slideIndex, styleId, brandId, slidePrompt, isLastSlide, assetUrl, previousSlideBase64 } = body as {
    policyData: ExtractedPolicyData | ExtractedData
    slideIndex: number
    styleId: SlideStyleId
    brandId: string | null
    slidePrompt?: string
    isLastSlide?: boolean
    assetUrl?: string
    previousSlideBase64?: string
  }

  let brandName: string | null = null
  let logoUrl: string | null = null
  let photoUrl: string | null = null
  let colors = { primary: '#1B365D', secondary: '#4A90D9', accent: '#FFB347', background: '#0a1628', text: '#FFFFFF' }

  if (brandId) {
    const { data: brand } = await supabase.from('brands').select('*').eq('id', brandId).single()
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
    // Download logo for Gemini integration
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
    try {
      const refPath = path.join(process.cwd(), 'public', 'style-previews', `${styleId}.png`)
      templateRefBuffer = await fs.readFile(refPath)
    } catch { /* template preview not found, skip */ }

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

    let imageBuffer = await generateSlide(
      policyData, slideIndex, styleId, brandName, logoUrl, colors, slidePrompt, !!photoUrl, undefined,
      logoBuffer, undefined, undefined, undefined, undefined, undefined, templateRefBuffer ?? previousSlideBuffer, assetBuffer
    )

    // Generate GPT overlay for cover/closing slides (logo + title on transparent bg)
    let overlayBuffer: Buffer | null = null
    const isCover = slideIndex === 0
    const isClosing = isLastSlide ?? false
    if (logoBuffer && (isCover || isClosing)) {
      try {
        const isInsurance = policyData && 'policyType' in policyData
        const title = isInsurance
          ? `${(policyData as any).policyType} Policy Overview`
          : (policyData as ExtractedData).title || 'Presentation'
        const subtitle = isInsurance
          ? `Prepared for ${(policyData as any).insuredName}`
          : (policyData as ExtractedData).subtitle || undefined

        overlayBuffer = await generateCoverOverlay({
          logoBuffer,
          title,
          subtitle: isCover ? subtitle : brandName ?? undefined,
          colors,
          isCover,
        })
      } catch { /* proceed without overlay */ }
    }

    // Composite overlay + photo onto the slide
    imageBuffer = await compositeSlide(imageBuffer, photoUrl, logoUrl, isCover, isClosing, standingPhotoUrl, null, null, undefined, overlayBuffer)

    const base64 = `data:image/png;base64,${imageBuffer.toString('base64')}`
    return NextResponse.json({ image: base64 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate slide'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
