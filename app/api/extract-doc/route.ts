import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { logError } from '../../_lib/error-logger'

export const runtime = 'nodejs'
export const maxDuration = 300

const BUCKET = 'creation-assets'
const VIDEO_ASSEMBLY_URL = process.env.VIDEO_ASSEMBLY_URL || 'http://5.161.215.156:4000'
const VIDEO_ASSEMBLY_SECRET = (process.env.VIDEO_ASSEMBLY_SECRET || '').trim().replace(/[\r\n]/g, '')

/**
 * Bulletproofed document extraction.
 *
 * The file is uploaded by the browser DIRECTLY to Supabase Storage (via a signed
 * URL from /api/extract-doc/upload-url), so the large bytes never transit this
 * Vercel function — eliminating the OOM + browser→Vercel TLS-corruption failures.
 *
 * This route receives only { path, purpose }, downloads the file server-to-server
 * (reliable), pre-checks the VPS is healthy, then forwards to /extract-document
 * with a retry. Always cleans up the temp upload. Backward-compatible: still
 * accepts a legacy multipart `file` if present.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createAdminClient()
  let storagePath: string | null = null

  try {
    let buffer: Buffer
    let fileName: string
    let mimeType: string
    let purpose: string | undefined

    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      // New path: file already in storage.
      const body = await request.json() as { path?: string; purpose?: string }
      if (!body.path) return NextResponse.json({ error: 'No file path provided' }, { status: 400 })
      // Path must belong to this user (path = <userId>/doc-uploads/<uuid>.ext).
      if (!body.path.startsWith(`${user.id}/`)) {
        return NextResponse.json({ error: 'Invalid file path' }, { status: 403 })
      }
      storagePath = body.path
      purpose = body.purpose || undefined
      const { data, error } = await admin.storage.from(BUCKET).download(body.path)
      if (error || !data) {
        return NextResponse.json({ error: 'Uploaded file not found — please re-upload.' }, { status: 404 })
      }
      buffer = Buffer.from(await data.arrayBuffer())
      fileName = body.path.split('/').pop() || 'document'
      mimeType = data.type || 'application/pdf'
    } else {
      // Legacy fallback: multipart file (kept so nothing breaks mid-deploy).
      const formData = await request.formData()
      const file = formData.get('file') as File | null
      if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      buffer = Buffer.from(await file.arrayBuffer())
      fileName = file.name
      mimeType = file.type || 'application/pdf'
      purpose = (formData.get('purpose') as string | null) || undefined
    }

    // Pre-check the VPS is up — fail fast with a clear message if it's down.
    try {
      const health = await fetch(`${VIDEO_ASSEMBLY_URL}/health`, { signal: AbortSignal.timeout(6000) })
      if (!health.ok) throw new Error(`health ${health.status}`)
    } catch {
      logError('extract-doc', new Error('VPS health check failed before extraction'), { userId: user.id })
      return NextResponse.json({ error: 'The document service is temporarily unavailable. Please try again in a moment.' }, { status: 503 })
    }

    const base64 = buffer.toString('base64')

    // Forward to VPS with one retry (the box may be momentarily busy).
    const forward = async () => fetch(`${VIDEO_ASSEMBLY_URL}/extract-document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-secret': VIDEO_ASSEMBLY_SECRET },
      body: JSON.stringify({ fileBase64: base64, fileName, purpose, mimeType }),
      signal: AbortSignal.timeout(260000),
    })

    let vpsRes: Response
    try {
      vpsRes = await forward()
      if (!vpsRes.ok && vpsRes.status >= 500) {
        await new Promise(r => setTimeout(r, 1500))
        vpsRes = await forward() // one retry on a server error
      }
    } catch (e) {
      // network/timeout — one retry
      await new Promise(r => setTimeout(r, 1500))
      vpsRes = await forward()
    }

    const result = await vpsRes.json().catch(() => ({ error: 'Extraction service returned an invalid response' }))
    if (!vpsRes.ok) {
      logError('extract-doc', new Error(`VPS extraction ${vpsRes.status}: ${result.error}`), { userId: user.id })
      return NextResponse.json({ error: result.error || 'We could not read this document. Try a different file or paste the text.' }, { status: vpsRes.status >= 500 ? 502 : vpsRes.status })
    }

    console.log(`[extract-doc] done: "${result.title || 'untitled'}", ${result.sections?.length || 0} sections`)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Extraction failed'
    const errName = err instanceof Error ? err.name : ''
    logError('extract-doc', err, { userId: user.id })
    if (message.includes('aborted') || errName === 'TimeoutError' || errName === 'AbortError') {
      return NextResponse.json({ error: 'Document extraction took too long. Try a smaller file or paste the text directly.' }, { status: 504 })
    }
    return NextResponse.json({ error: 'Something went wrong reading the document. Please try again or paste the text.' }, { status: 500 })
  } finally {
    // Clean up the temp upload so storage doesn't fill with one-shot files.
    if (storagePath) admin.storage.from(BUCKET).remove([storagePath]).catch(() => {})
  }
}
