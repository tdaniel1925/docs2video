import { NextResponse } from 'next/server'
import { PDFDocument } from 'pdf-lib'
import { createClient } from '../../_lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json()
  const { videoId, imageUrls: rawImageUrls, title } = body as {
    videoId?: string
    imageUrls?: string[]
    title?: string
  }

  let imageUrls: string[] = []

  // If videoId provided, load slide_urls from the video record
  if (videoId) {
    const { data: video } = await supabase
      .from('videos')
      .select('slide_urls, thumbnail_url')
      .eq('id', videoId)
      .eq('user_id', user.id) // defense-in-depth: only the owner's video
      .single()
    if (video?.slide_urls && (video.slide_urls as string[]).length > 0) {
      imageUrls = video.slide_urls as string[]
    } else if (video?.thumbnail_url) {
      // Fallback to thumbnail for older videos
      imageUrls = [video.thumbnail_url]
    }
  } else if (rawImageUrls?.length) {
    imageUrls = rawImageUrls
  }

  if (!imageUrls.length) {
    return NextResponse.json({ error: 'No images provided' }, { status: 400 })
  }

  try {
    const pdfDoc = await PDFDocument.create()

    pdfDoc.setTitle(title ?? 'Docs2Video Export')
    pdfDoc.setCreator('Docs2Video')
    pdfDoc.setProducer('Docs2Video')

    for (const url of imageUrls) {
      try {
        const imgRes = await fetch(url)
        if (!imgRes.ok) continue
        const imgBuffer = Buffer.from(await imgRes.arrayBuffer())

        // Detect format and embed accordingly
        let embeddedImage
        if (imgBuffer[0] === 0xFF && imgBuffer[1] === 0xD8) {
          embeddedImage = await pdfDoc.embedJpg(imgBuffer)
        } else {
          embeddedImage = await pdfDoc.embedPng(imgBuffer)
        }
        const imgWidth = embeddedImage.width
        const imgHeight = embeddedImage.height

        // Page size matches image exactly (pixels * 0.75 = points at 96dpi)
        const pageWidth = imgWidth * 0.75
        const pageHeight = imgHeight * 0.75

        const page = pdfDoc.addPage([pageWidth, pageHeight])
        page.drawImage(embeddedImage, {
          x: 0,
          y: 0,
          width: pageWidth,
          height: pageHeight,
        })
      } catch (imgErr) {
        console.error(`[download-pdf] Failed to embed image: ${url}`, imgErr)
        continue
      }
    }

    const pdfBytes = await pdfDoc.save()

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${(title ?? 'Docs2Video-Export').replace(/[^a-zA-Z0-9-_ ]/g, '')}.pdf"`,
      },
    })
  } catch (err) {
    console.error('[download-pdf] Error:', err)
    const message = err instanceof Error ? err.message : 'PDF generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
