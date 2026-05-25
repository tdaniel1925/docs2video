import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { PDFDocument } from 'pdf-lib'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { deductCredits, CREDIT_COSTS, checkCredits } from '../../_lib/credits'
import { logError } from '../../_lib/error-logger'
import { buildSimpleSlidePrompt, getStylePrompt } from '../../_lib/slide-engine/simple-prompt'
import type { SimpleSlideInput } from '../../_lib/slide-engine/simple-prompt'
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
  const creditCheck = await checkCredits(user.id, CREDIT_COSTS.pdf)
  if (!creditCheck.allowed) {
    return NextResponse.json({
      error: `Insufficient credits. Need ${CREDIT_COSTS.pdf}, have ${creditCheck.remaining}.`,
    }, { status: 402 })
  }

  try {
    // Deduct credits
    const deducted = await deductCredits(user.id, CREDIT_COSTS.pdf, 'pdf', videoId, `PDF generation: ${videoId}`)
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

    // Generate slide images using OpenAI gpt-image-1
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

      console.log(`[generate-pdf ${videoId}] Generating slide ${i + 1}/${scenes.length}...`)

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

    // Build PDF from slide images using pdf-lib
    await admin.from('videos').update({
      progress_detail: 'Assembling PDF file...',
      progress_pct: 85,
    }).eq('id', videoId)

    const pdfDoc = await PDFDocument.create()
    pdfDoc.setTitle(brand?.name ? `${brand.name} Presentation` : 'Presentation')
    pdfDoc.setCreator('Docs2Video')

    // Slide dimensions: 1536x1024 pixels -> 16:10.67 ratio
    // Standard widescreen PDF page: 1920x1080 -> use 960x540 points (PDF points = 1/72 inch)
    // For best quality, use landscape A4-like dimensions matching 3:2 ratio
    const pageWidth = 1536 * 0.5  // 768 points
    const pageHeight = 1024 * 0.5 // 512 points

    for (let i = 0; i < slideImages.length; i++) {
      const pngImage = await pdfDoc.embedPng(slideImages[i])
      const page = pdfDoc.addPage([pageWidth, pageHeight])
      page.drawImage(pngImage, {
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
      })
    }

    const pdfBytes = await pdfDoc.save()
    const pdfBuffer = Buffer.from(pdfBytes)

    // Upload to Supabase Storage
    await admin.from('videos').update({
      progress_detail: 'Uploading file...',
      progress_pct: 92,
    }).eq('id', videoId)

    const storagePath = `${user.id}/${videoId}.pdf`
    const { error: uploadErr } = await admin.storage.from('videos').upload(storagePath, pdfBuffer, {
      contentType: 'application/pdf',
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
      progress_detail: 'PDF ready!',
      progress_pct: 100,
      output_type: 'pdf',
    }).eq('id', videoId)

    console.log(`[generate-pdf ${videoId}] Complete! ${scenes.length} slides, ${(pdfBuffer.length / 1024).toFixed(0)}KB`)

    return NextResponse.json({ success: true, url: downloadUrl })

  } catch (err) {
    console.error(`[generate-pdf ${videoId}] Error:`, err)
    logError('generate-pdf', err, { videoId, userId: user.id })
    const message = err instanceof Error ? err.message : 'PDF generation failed'
    await admin.from('videos').update({
      status: 'failed',
      error_message: message,
      progress_detail: 'Generation failed',
      progress_pct: 0,
    }).eq('id', videoId)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
