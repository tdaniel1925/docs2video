import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../_lib/supabase/admin'
import { isOwnedStoragePath } from '../../../../_lib/wizard-draft'

export const runtime = 'nodejs'

/**
 * GET /api/watch/{videoId}/source-pdf
 * Public, unauthenticated. Streams the ORIGINAL source PDF to the client via a
 * short-lived signed URL — but ONLY when the agent enabled it
 * (`allow_source_download`) AND a stored path exists. The source lives in the
 * PRIVATE 'creation-assets' bucket, so we never expose the bucket; we mint a
 * 5-minute signed URL and redirect to it. 404 in every other case (don't reveal
 * anything about videos that didn't opt in).
 *
 * The stored path must sit inside the VIDEO OWNER's own folder (H6). This
 * route signs files from a private bucket for anyone holding the link, so a
 * row pointing at someone else's upload would hand that file to a stranger.
 */
const BUCKET = 'creation-assets'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const admin = createAdminClient()

  const { data: video } = await admin
    .from('videos')
    .select('user_id, allow_source_download, source_pdf_path, source_pdf_name')
    .eq('id', id)
    .maybeSingle()

  if (!video || !video.allow_source_download || !video.source_pdf_path) {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }
  if (!isOwnedStoragePath(video.source_pdf_path, video.user_id)) {
    console.warn(`[source-pdf] refused a path outside the owner's folder for video ${id}`)
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }

  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(video.source_pdf_path, 300, {
      download: video.source_pdf_name || true, // force a download with the original filename
    })
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }
  return NextResponse.redirect(data.signedUrl)
}
