import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../_lib/supabase/admin'

export const runtime = 'nodejs'
export const maxDuration = 30

/** GET → serve the stored presentation HTML with a real text/html content
 *  type. Supabase Storage serves HTML objects as text/plain (anti-XSS), so
 *  iframes pointed at the raw storage URL render source code instead of the
 *  presentation. Link-gated like the share page: the id is the credential.
 *  Query params (?share=1, ?record=1, ?theme=) ride along on this URL and are
 *  read by the page's own script. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: video } = await admin
    .from('videos')
    .select('id, status, output_type')
    .eq('id', id)
    .single()
  if (!video || video.status !== 'completed'
    || (video.output_type !== 'interactive' && video.output_type !== 'deck')) {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }

  const dl = await admin.storage.from('videos').download(`presentations/${id}.html`)
  if (dl.error || !dl.data) return NextResponse.json({ error: 'Not available' }, { status: 404 })
  const html = await dl.data.text()

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Short cache + must-revalidate: the deck is re-rendered in place on edits,
      // so a long cache would keep showing the old one. The viewer also appends
      // ?v=<updated_at>, which busts it immediately; this covers links that don't.
      'Cache-Control': 'public, max-age=30, must-revalidate',
      'X-Frame-Options': 'SAMEORIGIN',
    },
  })
}
