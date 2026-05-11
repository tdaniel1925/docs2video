import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { generateSlide } from '../../_lib/gemini'
import { compositeSlide } from '../../_lib/composite'
import type { ExtractedPolicyData, SlideStyleId } from '../../_lib/types'
import type { ExtractedData } from '../../_lib/extract-types'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json()
  const { policyData, slideIndex, styleId, brandId, slidePrompt, isLastSlide } = body as {
    policyData: ExtractedPolicyData | ExtractedData
    slideIndex: number
    styleId: SlideStyleId
    brandId: string | null
    slidePrompt?: string
    isLastSlide?: boolean
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

    let imageBuffer = await generateSlide(
      policyData, slideIndex, styleId, brandName, logoUrl, colors, slidePrompt, !!photoUrl, undefined,
      logoBuffer
    )

    // Composite real photo onto the slide (logo now handled by Gemini)
    imageBuffer = await compositeSlide(imageBuffer, photoUrl, logoUrl, slideIndex === 0, isLastSlide ?? false, standingPhotoUrl)

    const base64 = `data:image/png;base64,${imageBuffer.toString('base64')}`
    return NextResponse.json({ image: base64 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate slide'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
