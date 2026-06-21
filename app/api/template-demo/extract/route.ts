import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { videoServiceUrl } from '../../../_lib/video-service'

export const runtime = 'nodejs'
export const maxDuration = 120

/**
 * POST /api/template-demo/extract
 * Accepts a PPTX file, sends to VPS /convert to extract slides as images,
 * then classifies each slide type.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const VIDEO_ASSEMBLY_URL = videoServiceUrl()
  const VIDEO_ASSEMBLY_SECRET = (process.env.VIDEO_ASSEMBLY_SECRET || '').trim()

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')

    // Send to VPS /convert endpoint to extract slides as images
    const vpsRes = await fetch(`${VIDEO_ASSEMBLY_URL}/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-secret': VIDEO_ASSEMBLY_SECRET },
      body: JSON.stringify({
        fileBase64: base64,
        fileName: file.name,
        mimeType: file.type || 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      }),
      signal: AbortSignal.timeout(60000),
    })

    const vpsData = await vpsRes.json()
    if (!vpsRes.ok || !vpsData.slides) {
      throw new Error(vpsData.error || 'Failed to extract slides from PPTX')
    }

    // Classify each slide type based on position and content
    const slides = vpsData.slides.map((slideBase64: string, i: number) => {
      const isFirst = i === 0
      const isLast = i === vpsData.slides.length - 1
      let type: 'cover' | 'content' | 'data' | 'closing' | 'unknown' = 'content'
      if (isFirst) type = 'cover'
      else if (isLast) type = 'closing'

      return {
        index: i,
        imageBase64: slideBase64,
        type,
        detectedText: [], // Text detection would need OCR — for demo, user fills in manually
      }
    })

    console.log(`[template-demo] Extracted ${slides.length} slides from ${file.name}`)
    return NextResponse.json({ slides, count: slides.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Extraction failed'
    console.error('[template-demo/extract] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
