import { NextResponse } from 'next/server'
import { createClient } from '../../../../_lib/supabase/server'
import { createAdminClient } from '../../../../_lib/supabase/admin'
import { summarizeViewing, type ShareRow, type ViewEvent } from '../../../../_lib/viewing'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * GET /api/videos/<id>/viewing — "Who watched", for the result page.
 *
 * Owner only. Reads what is already stored — the emails sent about this
 * video (sent_emails) and the share page's events (video_analytics) — and
 * returns, per email sent, whether it was opened and how far into the video
 * that person got (in quarters: the finest the share page reports), plus
 * anyone else who watched, by device. Viewer IPs are used to tell viewers
 * apart and never leave the server. Nothing new is stored, no migration.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createAdminClient()
  const { data: video } = await admin.from('videos').select('id').eq('id', id).eq('user_id', user.id).maybeSingle()
  if (!video) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Share emails only (email_type arrives with migration 20260926). Without
  // that column, every email sent about this video is a share email anyway —
  // the follow-up emails are filed under their own rows elsewhere.
  let shares: ShareRow[] = []
  const typed = await admin.from('sent_emails')
    .select('id, to_email, to_name, created_at, opened_at')
    .eq('video_id', id).eq('email_type', 'share')
    .order('created_at', { ascending: false }).limit(20)
  if (!typed.error) {
    shares = (typed.data ?? []) as ShareRow[]
  } else {
    const all = await admin.from('sent_emails')
      .select('id, to_email, created_at, opened_at')
      .eq('video_id', id)
      .order('created_at', { ascending: false }).limit(20)
    if (!all.error) shares = (all.data ?? []) as ShareRow[]
  }

  const { data: events, error } = await admin.from('video_analytics')
    .select('event_type, created_at, metadata, viewer_ip, user_agent')
    .eq('video_id', id)
    .order('created_at', { ascending: false })
    .limit(2000)
  if (error) {
    // The table can be missing on a fresh database; say "nothing yet".
    return NextResponse.json({ ...summarizeViewing([], shares), available: false })
  }

  return NextResponse.json({ ...summarizeViewing((events ?? []) as ViewEvent[], shares), available: true })
}
