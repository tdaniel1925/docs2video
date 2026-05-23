import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * Proxy: accepts file upload (FormData), converts to base64,
 * forwards to VPS /extract-document for OpenAI extraction.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const VIDEO_ASSEMBLY_URL = process.env.VIDEO_ASSEMBLY_URL || 'http://5.161.215.156:4000'
  const VIDEO_ASSEMBLY_SECRET = (process.env.VIDEO_ASSEMBLY_SECRET || '').trim().replace(/[\r\n]/g, '')

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const purpose = formData.get('purpose') as string | null

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')

    const vpsRes = await fetch(`${VIDEO_ASSEMBLY_URL}/extract-document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-secret': VIDEO_ASSEMBLY_SECRET },
      body: JSON.stringify({
        fileBase64: base64,
        fileName: file.name,
        purpose: purpose || undefined,
        mimeType: file.type || 'application/pdf',
      }),
    })

    const result = await vpsRes.json()
    if (!vpsRes.ok) return NextResponse.json({ error: result.error || 'Extraction failed' }, { status: vpsRes.status })
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Extraction failed' }, { status: 500 })
  }
}
