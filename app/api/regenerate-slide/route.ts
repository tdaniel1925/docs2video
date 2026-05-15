import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { generateSlide } from '../../_lib/gemini'
import { compositeSlide } from '../../_lib/composite'
import type { SlideStyleId } from '../../_lib/types'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { videoId, slideIndex } = await request.json()
  if (!videoId || slideIndex == null) {
    return NextResponse.json({ error: 'Missing videoId or slideIndex' }, { status: 400 })
  }

  // Load video (must belong to user)
  const { data: video } = await supabase
    .from('videos')
    .select('*, brand:brands(*)')
    .eq('id', videoId)
    .eq('user_id', user.id)
    .single()

  if (!video) return NextResponse.json({ error: 'Video not found' }, { status: 404 })
  if (video.status !== 'completed') return NextResponse.json({ error: 'Video is not completed' }, { status: 400 })

  const slideUrls = video.slide_urls as string[] | null
  if (!slideUrls || slideIndex < 0 || slideIndex >= slideUrls.length) {
    return NextResponse.json({ error: 'Invalid slide index' }, { status: 400 })
  }

  // Extract pipeline input from script
  const pipelineInput = (video.script as any)?._pipeline_input
  const policyData = pipelineInput?.policyData
  const styleId: SlideStyleId = pipelineInput?.styleId ?? 'executive'
  const scenes = Array.isArray(video.script) ? video.script : []
  const scene = scenes[slideIndex]
  const slidePrompt = scene?.slidePrompt

  if (!policyData) {
    return NextResponse.json({ error: 'No policy data found for regeneration' }, { status: 400 })
  }

  // Get brand info
  let brandName: string | null = null
  let logoUrl: string | null = null
  let colors = { primary: '#1B365D', secondary: '#4A90D9', accent: '#FFB347', background: '#0a1628', text: '#FFFFFF' }

  if (video.brand) {
    const brand = video.brand
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

  // Get agent photos from profile
  let photoUrl: string | null = null
  let standingPhotoUrl: string | null = null
  const { data: profile } = await supabase
    .from('profiles')
    .select('photo_url, photo_standing_url')
    .eq('id', user.id)
    .single()
  if (profile) {
    photoUrl = profile.photo_url
    standingPhotoUrl = profile.photo_standing_url ?? null
  }

  try {
    // Download logo for Gemini
    let logoBuffer: Buffer | null = null
    if (logoUrl) {
      try {
        const logoRes = await fetch(logoUrl, { signal: AbortSignal.timeout(8000) })
        if (logoRes.ok) logoBuffer = Buffer.from(await logoRes.arrayBuffer())
      } catch { /* proceed without logo */ }
    }

    const isLastSlide = slideIndex === slideUrls.length - 1

    let imageBuffer = await generateSlide(
      policyData, slideIndex, styleId, brandName, logoUrl, colors, slidePrompt, !!photoUrl, undefined,
      logoBuffer
    )

    imageBuffer = await compositeSlide(imageBuffer, photoUrl, logoUrl, slideIndex === 0, isLastSlide, standingPhotoUrl)

    // Upload to Supabase storage, replacing old slide
    const admin = createAdminClient()
    const fileName = `${videoId}/slide-${slideIndex}-${Date.now()}.png`
    const { error: uploadError } = await admin.storage
      .from('slides')
      .upload(fileName, imageBuffer, {
        contentType: 'image/png',
        upsert: true,
      })

    if (uploadError) {
      return NextResponse.json({ error: 'Failed to upload slide: ' + uploadError.message }, { status: 500 })
    }

    const { data: urlData } = admin.storage.from('slides').getPublicUrl(fileName)
    const newUrl = urlData.publicUrl

    // Update the slide_urls array in the video record
    const updatedSlideUrls = [...slideUrls]
    updatedSlideUrls[slideIndex] = newUrl

    await supabase
      .from('videos')
      .update({ slide_urls: updatedSlideUrls })
      .eq('id', videoId)

    return NextResponse.json({ slideUrl: newUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to regenerate slide'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
