import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { deductCredits, CREDIT_COSTS, checkCredits } from '../../_lib/credits'
import { logError } from '../../_lib/error-logger'
import { buildSimpleSlidePrompt, getStylePrompt } from '../../_lib/slide-engine/simple-prompt'
import type { SimpleSlideInput } from '../../_lib/slide-engine/simple-prompt'
import { generatePptx } from '../../_lib/pptx-generator'
import type { DeckSlide, DeckOptions } from '../../_lib/pptx-generator'
import type { Video, Brand, VideoScene } from '../../_lib/types'

export const runtime = 'nodejs'
export const maxDuration = 300

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json()
  const { videoId } = body as { videoId: string }

  if (!videoId) {
    return NextResponse.json({ error: 'videoId is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Load the video record
  const { data: video, error: videoErr } = await admin
    .from('videos')
    .select('*, brand:brands(*)')
    .eq('id', videoId)
    .single()

  if (videoErr || !video) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 })
  }

  // Verify ownership
  if (video.user_id !== user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  // Check credits
  const creditCheck = await checkCredits(user.id, CREDIT_COSTS.pptx)
  if (!creditCheck.allowed) {
    return NextResponse.json({
      error: `Insufficient credits. Need ${CREDIT_COSTS.pptx}, have ${creditCheck.remaining}.`,
    }, { status: 402 })
  }

  try {
    // Deduct credits
    const deducted = await deductCredits(user.id, CREDIT_COSTS.pptx, 'pptx', videoId, `PPTX generation: ${videoId}`)
    if (!deducted) {
      return NextResponse.json({ error: 'Failed to deduct credits' }, { status: 402 })
    }

    // Update status
    await admin.from('videos').update({
      status: 'generating_slides',
      progress_detail: 'Preparing slide designs...',
      progress_pct: 5,
    }).eq('id', videoId)

    // Extract data from the video record
    const scenes: VideoScene[] = video.script || video.draft_data?.script || []
    if (!scenes.length) {
      throw new Error('No script/scenes found on this video record.')
    }

    const brand: Brand | null = video.brand || null
    const draft = video.draft_data as Record<string, any> | null

    const brandColors = {
      primary: brand?.primary_color ?? '#1B365D',
      secondary: brand?.secondary_color ?? '#4A90D9',
    }
    const fullColors = {
      primary: brandColors.primary,
      secondary: brandColors.secondary,
      accent: brand?.accent_color ?? '#FFB347',
      text: brand?.text_color ?? '#FFFFFF',
    }

    // Determine style
    const templateId = (draft?.styleId ?? brand?.deck_style_id ?? 'executive') as string
    let stylePrompt: string
    if (draft?.customStylePrompt) {
      stylePrompt = draft.customStylePrompt
    } else if (brand && brand.primary_color !== '#1B365D') {
      stylePrompt = `Modern, visually striking presentation style. Primary brand color: ${brand.primary_color}, secondary: ${brand.secondary_color}. Use these colors boldly.`
    } else {
      stylePrompt = getStylePrompt(templateId)
    }

    const brandGuide = brand?.brand_guide_data as Record<string, string> | null

    // Generate slide images using OpenAI gpt-image-2
    const openai = getOpenAI()
    const slideImages: Buffer[] = []

    await admin.from('videos').update({
      progress_detail: 'Generating slide images...',
      progress_pct: 10,
    }).eq('id', videoId)

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i]
      const isFirst = i === 0
      const isLast = i === scenes.length - 1
      const sd = scene.slideData

      const contactInfo = (isFirst || isLast) ? {
        phone: brandGuide?.phone || undefined,
        website: brandGuide?.website?.toLowerCase() || undefined,
        email: brandGuide?.email?.toLowerCase() || undefined,
        calendly: brandGuide?.calendly || undefined,
      } : undefined

      const slideBullets = sd?.bullets?.map((b: string) => ({ text: b }))
      const slideStats = sd?.stats

      const input: SimpleSlideInput = {
        type: isFirst ? 'cover' : isLast ? 'closing' : 'content',
        stylePrompt,
        headline: sd?.headline || scene.title || '',
        subtitle: isFirst ? brand?.name : undefined,
        brandName: brand?.name,
        brandColors,
        stats: slideStats,
        bullets: slideBullets,
        contactInfo,
        narrationContext: scene.narration?.slice(0, 200),
        pageNumber: i + 1,
        totalPages: scenes.length,
      }

      const prompt = buildSimpleSlidePrompt(input)

      console.log(`[generate-pptx ${videoId}] Generating slide ${i + 1}/${scenes.length}...`)

      const imgResponse = await openai.images.generate({
        model: 'gpt-image-1',
        prompt,
        n: 1,
        size: '1536x1024',
        quality: 'medium',
      })

      const b64 = imgResponse.data?.[0]?.b64_json
      if (!b64) {
        throw new Error(`Failed to generate image for slide ${i + 1}`)
      }

      slideImages.push(Buffer.from(b64, 'base64'))

      // Update progress
      const pct = 10 + Math.round((i + 1) / scenes.length * 70)
      await admin.from('videos').update({
        progress_detail: `Generated slide ${i + 1} of ${scenes.length}`,
        progress_pct: pct,
      }).eq('id', videoId)
    }

    // Build DeckSlide array for pptx-generator
    await admin.from('videos').update({
      progress_detail: 'Assembling PPTX file...',
      progress_pct: 85,
    }).eq('id', videoId)

    const deckSlides: DeckSlide[] = scenes.map((scene, i) => {
      const isFirst = i === 0
      const isLast = i === scenes.length - 1
      const sd = scene.slideData

      return {
        headline: sd?.headline || scene.title || '',
        subheadline: isFirst ? brand?.name || '' : undefined,
        bodyPoints: sd?.bullets || [],
        stats: sd?.stats,
        slideType: isFirst ? 'cover' : isLast ? 'closing' : (sd?.stats?.length ? 'data' : 'content'),
        backgroundImage: slideImages[i],
      }
    })

    // Fetch logo buffer if available
    let logoBuffer: Buffer | null = null
    const logoUrl = brand?.logo_file_url ?? brand?.logo_url ?? null
    if (logoUrl) {
      try {
        const logoRes = await fetch(logoUrl)
        if (logoRes.ok) {
          logoBuffer = Buffer.from(await logoRes.arrayBuffer())
        }
      } catch {
        console.warn(`[generate-pptx ${videoId}] Failed to fetch logo, skipping`)
      }
    }

    const deckOptions: DeckOptions = {
      brandName: brand?.name ?? 'Presentation',
      primaryColor: fullColors.primary,
      secondaryColor: fullColors.secondary,
      accentColor: fullColors.accent,
      textColor: fullColors.text,
      logoBuffer,
      contactInfo: {
        phone: brandGuide?.phone,
        website: brandGuide?.website,
      },
    }

    // Generate PPTX buffer
    const pptxBuffer = await generatePptx(deckSlides, deckOptions)

    // Upload to Supabase Storage
    await admin.from('videos').update({
      progress_detail: 'Uploading file...',
      progress_pct: 92,
    }).eq('id', videoId)

    const storagePath = `${user.id}/${videoId}.pptx`
    const { error: uploadErr } = await admin.storage.from('videos').upload(storagePath, pptxBuffer, {
      contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      upsert: true,
    })

    if (uploadErr) {
      throw new Error(`Storage upload failed: ${uploadErr.message}`)
    }

    const { data: urlData } = admin.storage.from('videos').getPublicUrl(storagePath)
    const downloadUrl = urlData.publicUrl

    // Also store slide images as individual URLs for thumbnails
    const slideUrls: string[] = []
    for (let i = 0; i < slideImages.length; i++) {
      const slidePath = `${user.id}/${videoId}/slide-${i + 1}.png`
      await admin.storage.from('videos').upload(slidePath, slideImages[i], {
        contentType: 'image/png',
        upsert: true,
      })
      const { data: slideUrlData } = admin.storage.from('videos').getPublicUrl(slidePath)
      slideUrls.push(slideUrlData.publicUrl)
    }

    // Update video record
    await admin.from('videos').update({
      status: 'completed',
      video_url: downloadUrl,
      slide_urls: slideUrls,
      thumbnail_url: slideUrls[0] || null,
      progress_detail: 'PPTX ready!',
      progress_pct: 100,
      output_type: 'pptx',
    }).eq('id', videoId)

    console.log(`[generate-pptx ${videoId}] Complete! ${scenes.length} slides, ${(pptxBuffer.length / 1024).toFixed(0)}KB`)

    return NextResponse.json({ success: true, url: downloadUrl })

  } catch (err) {
    console.error(`[generate-pptx ${videoId}] Error:`, err)
    logError('generate-pptx', err, { videoId, userId: user.id })
    const message = err instanceof Error ? err.message : 'PPTX generation failed'
    await admin.from('videos').update({
      status: 'failed',
      error_message: message,
      progress_detail: 'Generation failed',
      progress_pct: 0,
    }).eq('id', videoId)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
