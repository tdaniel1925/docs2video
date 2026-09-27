import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { isOwnedStoragePath } from '../../../_lib/wizard-draft'
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

/**
 * Update what the owner can change after a video is made. Owner-scoped.
 * Body (any of):
 *   title                  — shown on the preview page AND the share page
 *   agent_note             — the short note on the share page (max 400
 *                            characters, the wizard's limit; '' clears it)
 *   allow_source_download  — the "Download the original PDF" button on the
 *                            share page. It can only be switched ON when this
 *                            video really has an uploaded PDF in the owner's
 *                            own folder — the download route checks the same.
 * Answers with the values really stored, so the page never claims more.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as {
    title?: unknown
    agent_note?: unknown
    allow_source_download?: unknown
  }

  const updates: Record<string, unknown> = {}
  if ('title' in body) {
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 120) : ''
    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    updates.title = title
  }
  if ('agent_note' in body) {
    if (body.agent_note !== null && typeof body.agent_note !== 'string') {
      return NextResponse.json({ error: 'The note must be text' }, { status: 400 })
    }
    const note = typeof body.agent_note === 'string' ? body.agent_note.trim().slice(0, 400) : ''
    updates.agent_note = note || null
  }
  if ('allow_source_download' in body) {
    if (typeof body.allow_source_download !== 'boolean') {
      return NextResponse.json({ error: 'allow_source_download must be true or false' }, { status: 400 })
    }
    if (body.allow_source_download) {
      const { data: v } = await supabase
        .from('videos')
        .select('source_pdf_path')
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle()
      if (!v) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      if (!isOwnedStoragePath(v.source_pdf_path, user.id)) {
        return NextResponse.json({ error: 'No original PDF is saved for this one, so there is nothing to download.' }, { status: 400 })
      }
    }
    updates.allow_source_download = body.allow_source_download
  }
  // Old callers send only { title }; an empty body still means "no title".
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('videos')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id, title, agent_note, allow_source_download')
    .single()

  if (error || !data) return NextResponse.json({ error: error?.message || 'Not found' }, { status: error ? 500 : 404 })
  return NextResponse.json({
    success: true,
    title: data.title,
    agent_note: data.agent_note ?? null,
    allow_source_download: data.allow_source_download === true,
  })
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
