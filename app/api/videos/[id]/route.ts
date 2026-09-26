import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
export const maxDuration = 30

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data, error } = await supabase
    .from('videos')
    .select('*, brand:brands(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

/** Update the video's title (shown on the preview page AND the public share
 *  page). Owner-scoped. Body: { title: string }. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { title?: string }
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 120) : ''
  if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('videos')
    .update({ title })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id, title')
    .single()

  if (error || !data) return NextResponse.json({ error: error?.message || 'Not found' }, { status: error ? 500 : 404 })
  return NextResponse.json({ success: true, title: data.title })
}

/**
 * Delete a video (owner only) — and only say "deleted" when a row really went.
 *
 * Campaign contacts point at videos WITHOUT "on delete" rules, so a video a
 * campaign uses can't be deleted: the database refuses. That used to come
 * back as a raw error (or, from the video page, as a silent "success" that
 * then reappeared). Now:
 *   * contacts that were never emailed just lose the link (marked skipped),
 *     and the delete goes ahead;
 *   * if a contact WAS emailed this video, we stop and explain — deleting it
 *     would break the link that person already has.
 */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: owned } = await supabase.from('videos').select('id').eq('id', id).eq('user_id', user.id).maybeSingle()
  if (!owned) return NextResponse.json({ error: 'Video not found' }, { status: 404 })

  const attempt = () => supabase.from('videos').delete().eq('id', id).eq('user_id', user.id).select('id')
  let { data, error } = await attempt()

  if (error?.code === '23503') {
    // Something still points at this video. The known case is campaign contacts.
    const { createAdminClient } = await import('../../../_lib/supabase/admin')
    const admin = createAdminClient()
    const { data: refs } = await admin.from('campaign_contacts').select('id, video_status, email_sent_at').eq('video_id', id)
    const sent = (refs ?? []).filter(r => r.video_status === 'sent' || r.email_sent_at)
    if (sent.length > 0) {
      return NextResponse.json({
        error: `This video was already emailed to ${sent.length} campaign contact${sent.length === 1 ? '' : 's'}, so it can’t be deleted — their link would stop working.`,
      }, { status: 409 })
    }
    if ((refs ?? []).length > 0) {
      const { error: clearErr } = await admin
        .from('campaign_contacts')
        .update({ video_id: null, video_status: 'skipped' })
        .eq('video_id', id)
      if (clearErr) {
        console.error('[videos/delete] could not clear campaign links:', clearErr.message)
        return NextResponse.json({ error: 'This video is used by a campaign and could not be unlinked. Nothing was deleted.' }, { status: 409 })
      }
      ;({ data, error } = await attempt())
    }
    if (error?.code === '23503') {
      return NextResponse.json({ error: 'Something else still uses this video, so it wasn’t deleted.' }, { status: 409 })
    }
  }

  if (error) {
    console.error('[videos/delete] failed:', error.message)
    return NextResponse.json({ error: 'The video could not be deleted. Please try again.' }, { status: 500 })
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'The video could not be deleted. Please try again.' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
