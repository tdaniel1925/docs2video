import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { REVIEW_COLS, type ReviewFull } from '../../../_lib/annual-review-db'
import { addDays, parseDate, safeTz, todayIn } from '../../../_lib/annual-review'
import { alertMissingSchema, isMissingSchema } from '../../../_lib/feature-tables'

export const runtime = 'nodejs'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * PATCH /api/reviews/{id}
 *   { action: 'schedule', sendOn: 'YYYY-MM-DD', sendTo: email, tz }
 *        The review video goes out by email on that morning (the daily
 *        reviews job sends it through the normal Send path). The video must
 *        be made first.
 *   { action: 'unschedule' }   back to prepared — nothing goes out.
 *   { action: 'skip' } / { action: 'reopen' }   skip this year / undo that.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { id } = await ctx.params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Review not found' }, { status: 404 })
  const admin = createAdminClient()
  const { data, error } = await admin.from('client_reviews').select(REVIEW_COLS).eq('id', id).eq('user_id', user.id).maybeSingle()
  if (error) {
    if (isMissingSchema(error)) { await alertMissingSchema('reviews', error.message); return NextResponse.json({ error: 'Annual reviews aren’t switched on yet.' }, { status: 503 }) }
    return NextResponse.json({ error: 'Could not load the review.' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Review not found' }, { status: 404 })
  const r = data as ReviewFull
  const body = await req.json().catch(() => ({})) as { action?: string; sendOn?: string; sendTo?: string; tz?: string }
  const now = new Date().toISOString()
  let patch: Record<string, unknown>

  switch (body.action) {
    case 'schedule': {
      if (['sent', 'sending'].includes(r.status)) return NextResponse.json({ error: 'This review has already been sent.' }, { status: 400 })
      if (!r.video_id) return NextResponse.json({ error: 'Prepare the review video first.' }, { status: 400 })
      const { data: v } = await admin.from('videos').select('status').eq('id', r.video_id).eq('user_id', user.id).maybeSingle()
      if (v?.status !== 'completed') return NextResponse.json({ error: 'Make the review video first — then pick the day it goes out.' }, { status: 400 })
      const tz = safeTz(body.tz)
      const sendOn = String(body.sendOn ?? '').slice(0, 10)
      const today = todayIn(tz)
      if (!parseDate(sendOn) || sendOn < today) return NextResponse.json({ error: 'Pick today or a day after.' }, { status: 400 })
      if (sendOn > addDays(today, 120)) return NextResponse.json({ error: 'Pick a day in the next four months.' }, { status: 400 })
      const to = String(body.sendTo ?? '').trim().toLowerCase()
      if (!EMAIL_RE.test(to)) return NextResponse.json({ error: 'Add your client’s email address.' }, { status: 400 })
      patch = { status: 'scheduled', send_on: sendOn, send_to: to, send_tz: tz, send_attempts: 0, last_error: null }
      break
    }
    case 'unschedule':
      if (r.status !== 'scheduled' && r.status !== 'send_failed') return NextResponse.json({ error: 'Nothing is scheduled.' }, { status: 400 })
      patch = { status: 'prepared', send_on: null }
      break
    case 'skip':
      if (['sent', 'sending'].includes(r.status)) return NextResponse.json({ error: 'This review has already been sent.' }, { status: 400 })
      patch = { status: 'skipped', send_on: null }
      break
    case 'reopen':
      if (r.status !== 'skipped') return NextResponse.json({ error: 'This review isn’t skipped.' }, { status: 400 })
      patch = { status: r.video_id ? 'prepared' : 'due' }
      break
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
  const { data: saved, error: upErr } = await admin.from('client_reviews').update({ ...patch, updated_at: now }).eq('id', r.id).eq('user_id', user.id).select(REVIEW_COLS).single()
  if (upErr) return NextResponse.json({ error: 'Could not save that. Please try again.' }, { status: 500 })
  return NextResponse.json({ review: saved })
}
