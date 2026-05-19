import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { buildSlidePrompt, extractLogoColors } from '../../_lib/slide-engine/prompt-builder'
import { getTemplateSpec } from '../../_lib/slide-engine/templates'
import type { SlideContent, BrandColors } from '../../_lib/slide-engine/types'
import OpenAI from 'openai'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { videoId, slideIndex, instruction } = await request.json()
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

  // Extract pipeline input
  const pipelineInput = (video.script as any)?._pipeline_input
  const policyData = pipelineInput?.policyData
  const scenes = Array.isArray(video.script) ? video.script : []
  const scene = scenes[slideIndex]
  const styleId = pipelineInput?.styleId ?? 'executive'

  if (!policyData) {
    return NextResponse.json({ error: 'No content data found for regeneration' }, { status: 400 })
  }

  // Get brand info
  const brand = video.brand
  const logoUrl = brand?.logo_file_url ?? brand?.logo_url ?? null

  try {
    // Build brand colors
    let brandColors: BrandColors = {
      primary: brand?.primary_color ?? '#1B365D',
      secondary: brand?.secondary_color ?? '#4A90D9',
    }

    // Fetch logo for color extraction and image reference
    let logoBase64: string | null = null
    if (logoUrl) {
      try {
        const logoRes = await fetch(logoUrl, { signal: AbortSignal.timeout(8000) })
        if (logoRes.ok) {
          const logoBuffer = Buffer.from(await logoRes.arrayBuffer())
          logoBase64 = logoBuffer.toString('base64')
          brandColors = await extractLogoColors(logoBuffer)
        }
      } catch { /* proceed without logo */ }
    }

    // Build slide content from scene data
    const template = getTemplateSpec(styleId)
    const isFirst = slideIndex === 0
    const isLast = slideIndex === slideUrls.length - 1
    const brandGuide = brand?.brand_guide_data as Record<string, string> | null

    let content: SlideContent
    if (isFirst) {
      content = {
        layout: 'title',
        headline: scene?.title || (policyData as any)?.title || 'Presentation',
        subtitle: scene?.subtitle || brand?.name || '',
        brandName: brand?.name,
        contactInfo: { phone: brandGuide?.phone, website: brandGuide?.website, email: brandGuide?.email },
        pageNumber: 1,
        totalPages: slideUrls.length,
      }
    } else if (isLast) {
      content = {
        layout: 'closing',
        headline: scene?.title || 'Thank You',
        brandName: brand?.name,
        contactInfo: { phone: brandGuide?.phone, website: brandGuide?.website, email: brandGuide?.email, calendly: brandGuide?.calendly },
        pageNumber: slideUrls.length,
        totalPages: slideUrls.length,
      }
    } else {
      const hasStats = scene?.stats?.length > 0 || scene?.keyMetrics?.length > 0
      const hasBullets = scene?.bullets?.length > 0
      const hasChart = scene?.chartData != null
      let layout: SlideContent['layout'] = 'bullets'
      if (hasStats) layout = 'stats'
      else if (hasChart) layout = 'chart'

      content = {
        layout,
        headline: scene?.title || '',
        subtitle: scene?.subtitle,
        stats: scene?.stats || scene?.keyMetrics?.map((m: any) => ({ value: m.value, label: m.label })),
        bullets: hasBullets ? scene.bullets : scene?.slidePrompt ? [{ text: scene.slidePrompt }] : undefined,
        chartData: scene?.chartData,
        brandName: brand?.name,
        pageNumber: slideIndex + 1,
        totalPages: slideUrls.length,
      }
    }

    // Build the base prompt
    let prompt = buildSlidePrompt({
      template,
      brandColors,
      logoDescription: logoUrl ? (brand?.name ?? 'brand logo') : undefined,
      content,
    })

    // Append user instruction if provided
    if (instruction?.trim()) {
      prompt += `\n\n=== USER EDIT REQUEST ===\nThe user wants this specific change: "${instruction.trim()}"\nApply this change while keeping everything else the same.`
    }

    // Generate with OpenAI
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    let imageBuffer: Buffer
    if (logoBase64) {
      const response = await openai.images.edit({
        model: 'gpt-image-1',
        prompt: `Use the provided brand logo image in this slide. Keep the logo in its ORIGINAL colors.\n\n${prompt}`,
        image: new File([Buffer.from(logoBase64, 'base64')], 'logo.png', { type: 'image/png' }),
        size: '1536x1024',
        quality: 'high',
        n: 1,
      } as any)
      const data = response.data?.[0]
      if (!data?.b64_json) throw new Error('No image returned')
      imageBuffer = Buffer.from(data.b64_json, 'base64')
    } else {
      const response = await openai.images.generate({
        model: 'gpt-image-1',
        prompt,
        size: '1536x1024',
        quality: 'high',
        n: 1,
      })
      const data = response.data?.[0]
      if (!data?.b64_json) throw new Error('No image returned')
      imageBuffer = Buffer.from(data.b64_json, 'base64')
    }

    // Upload to Supabase storage
    const admin = createAdminClient()
    const fileName = `${videoId}/slide-${slideIndex}-${Date.now()}.png`
    const { error: uploadError } = await admin.storage
      .from('slides')
      .upload(fileName, imageBuffer, { contentType: 'image/png', upsert: true })

    if (uploadError) {
      return NextResponse.json({ error: 'Failed to upload slide: ' + uploadError.message }, { status: 500 })
    }

    const { data: urlData } = admin.storage.from('slides').getPublicUrl(fileName)
    const newUrl = urlData.publicUrl

    // Update the slide_urls array
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
