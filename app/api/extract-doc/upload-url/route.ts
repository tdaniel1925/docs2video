import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { docUploadExt, docUploadProblem } from '../../../_lib/doc-upload'

export const runtime = 'nodejs'

const BUCKET = 'creation-assets'

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
  const ext = docUploadExt(fileName)
  const problem = fileName ? docUploadProblem(fileName, body.size) : 'No file name given.'
  if (problem) return NextResponse.json({ error: problem }, { status: /MB/.test(problem) ? 413 : 400 })

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
