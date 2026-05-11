import { NextResponse } from 'next/server'
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
  let speakerNotes: string[] = []

  if (videoId) {
    const { data: video } = await supabase
      .from('videos')
      .select('slide_urls, thumbnail_url, script')
      .eq('id', videoId)
      .single()
    if (video?.slide_urls && (video.slide_urls as string[]).length > 0) {
      imageUrls = video.slide_urls as string[]
    } else if (video?.thumbnail_url) {
      imageUrls = [video.thumbnail_url]
    }
    // Extract narration text as speaker notes
    if (video?.script && Array.isArray(video.script)) {
      speakerNotes = (video.script as { narration?: string; title?: string }[]).map(
        scene => scene.narration ?? scene.title ?? ''
      )
    }
  } else if (rawImageUrls?.length) {
    imageUrls = rawImageUrls
  }

  if (!imageUrls.length) {
    return NextResponse.json({ error: 'No images provided' }, { status: 400 })
  }

  try {
    const PptxGenJS = (await import('pptxgenjs')).default

    const pptx = new PptxGenJS()
    pptx.defineLayout({ name: 'CUSTOM', width: 13.33, height: 7.5 })
    pptx.layout = 'CUSTOM'
    pptx.title = title ?? 'Docs2Video Export'

    for (let i = 0; i < imageUrls.length; i++) {
      const slide = pptx.addSlide()
      const res = await fetch(imageUrls[i])
      if (!res.ok) continue
      const buffer = Buffer.from(await res.arrayBuffer())
      const base64 = buffer.toString('base64')

      slide.addImage({
        data: `image/png;base64,${base64}`,
        x: 0,
        y: 0,
        w: '100%',
        h: '100%',
      })

      // Add narration as speaker notes
      if (speakerNotes[i]) {
        slide.addNotes(speakerNotes[i])
      }
    }

    const pptxBuffer = await pptx.write({ outputType: 'nodebuffer' }) as Buffer

    const filename = (title ?? 'Docs2Video-Export').replace(/[^a-zA-Z0-9-_ ]/g, '')
    return new NextResponse(new Uint8Array(pptxBuffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${filename}.pptx"`,
      },
    })
  } catch (err) {
    console.error('[download-pptx] Error:', err)
    const message = err instanceof Error ? err.message : 'PPTX generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
