import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { videoServiceUrl } from '../../_lib/video-service'

export const runtime = 'nodejs'
export const maxDuration = 300

const VIDEO_ASSEMBLY_URL = videoServiceUrl()
const VIDEO_ASSEMBLY_SECRET = (process.env.VIDEO_ASSEMBLY_SECRET || '').trim().replace(/[\r\n]/g, '')

/**
 * Converts a PPTX/PPT file to slide images via the Hetzner VPS.
 * Returns an array of base64 PNG slide images (1920x1080).
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  if (file.size > 50 * 1024 * 1024) {
    return NextResponse.json({ error: 'File must be under 50MB' }, { status: 400 })
  }

  try {
    const arrayBuffer = await file.arrayBuffer()
    const fileBase64 = Buffer.from(arrayBuffer).toString('base64')

    // Send to VPS for conversion
    const res = await fetch(`${VIDEO_ASSEMBLY_URL}/convert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-secret': VIDEO_ASSEMBLY_SECRET,
      },
      body: JSON.stringify({
        fileBase64,
        fileName: file.name,
      }),
      signal: AbortSignal.timeout(90000),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Conversion failed' }))
      return NextResponse.json({ error: err.error || 'Slide conversion failed' }, { status: 500 })
    }

    const data = await res.json()
    return NextResponse.json({
      slides: data.slides, // array of base64 PNG strings
      count: data.count,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Conversion failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
