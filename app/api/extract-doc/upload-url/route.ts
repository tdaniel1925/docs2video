import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'

export const runtime = 'nodejs'

const BUCKET = 'creation-assets'
const MAX_BYTES = 100 * 1024 * 1024 // 100MB hard cap
const ALLOWED_EXT = ['pdf', 'docx', 'pptx', 'txt', 'csv', 'xlsx']

/**
 * Mints a one-time signed upload URL so the browser uploads the document
 * DIRECTLY to Supabase Storage (big bytes never transit a Vercel function).
 * The client then calls POST /api/extract-doc with the returned { path }.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let body: { fileName?: string; size?: number }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const fileName = (body.fileName || '').trim()
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  if (!fileName || !ALLOWED_EXT.includes(ext)) {
    return NextResponse.json({ error: `Unsupported file type. Allowed: ${ALLOWED_EXT.join(', ').toUpperCase()}` }, { status: 400 })
  }
  if (typeof body.size === 'number' && body.size > MAX_BYTES) {
    return NextResponse.json({ error: `File too large. Maximum ${Math.round(MAX_BYTES / 1024 / 1024)}MB. Try a smaller file or paste the text.` }, { status: 413 })
  }

  // userId FIRST so it satisfies the bucket RLS policy
  // (auth.uid() = foldername[1]); 'doc-uploads' subfolder for organization.
  const path = `${user.id}/doc-uploads/${crypto.randomUUID()}.${ext}`
  const admin = createAdminClient()
  const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path)
  if (error || !data) {
    return NextResponse.json({ error: 'Could not start upload' }, { status: 500 })
  }
  return NextResponse.json({ bucket: BUCKET, path: data.path, token: data.token })
}
