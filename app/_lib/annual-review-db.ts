import type { SupabaseClient } from '@supabase/supabase-js'
import { addDays, parseDate, reviewDue, safeTz, todayIn, type ClientDates, type ReviewRow } from './annual-review'
import { alertMissingSchema, isMissingSchema } from './feature-tables'

// =============================================================================
// ANNUAL REVIEWS — the database side. Fails SAFE: a missing column/table →
// `available: false` (screens hide the feature) + one owner alert.
// =============================================================================

type Admin = SupabaseClient

export const CLIENT_DATE_COLS = 'id, user_id, name, email, phone, anniversary_date, anniversary_confirmed, anniversary_tz, anniversary_source'
export const REVIEW_COLS = 'id, user_id, client_id, cycle_date, status, video_id, prior_video_id, send_on, send_to, send_tz, send_attempts, last_error, sent_at, reminded_30_at, reminded_7_at, created_at, updated_at'

export type ClientWithDates = ClientDates & { email: string | null; phone: string | null; anniversary_source: string | null }
export type ReviewFull = ReviewRow & { prior_video_id: string | null; send_to: string | null; send_attempts: number; last_error: string | null; created_at: string; updated_at: string }

export type ReviewSummary = { due: number; prepared: number; sent: number; watched: number; booked: number }

export type ReviewItem = {
  client: { id: string; name: string; email: string | null; phone: string | null }
  anniversary: string
  cycleDate: string
  daysLeft: number
  review: ReviewFull | null
  watched: boolean
  booked: boolean
}

const BOOKING_EVENTS = ['booking_click', 'book_meeting']

/** Check the anniversary fields an agent typed. null = clear it. */
export function cleanAnniversary(body: Record<string, unknown>): { ok: true; patch: Record<string, unknown> } | { ok: false; error: string } | null {
  if (!('anniversary_date' in body) && !('anniversary_confirmed' in body)) return null
  const patch: Record<string, unknown> = {}
  if ('anniversary_date' in body) {
    const v = body.anniversary_date
    if (v === null || v === '') {
      patch.anniversary_date = null
      patch.anniversary_confirmed = false
      patch.anniversary_source = null
    } else {
      const p = parseDate(v)
      if (!p || p.y < 1900 || p.y > 2100) return { ok: false, error: 'That policy date doesn’t look right.' }
      patch.anniversary_date = String(v).slice(0, 10)
      patch.anniversary_source = body.anniversary_source === 'document' ? 'document' : 'agent'
      // A date read from a document waits for the agent's OK; one they typed is confirmed.
      patch.anniversary_confirmed = body.anniversary_confirmed === undefined ? patch.anniversary_source === 'agent' : body.anniversary_confirmed === true
    }
  } else {
    patch.anniversary_confirmed = body.anniversary_confirmed === true
  }
  if (typeof body.anniversary_tz === 'string') patch.anniversary_tz = safeTz(body.anniversary_tz)
  return { ok: true, patch }
}

/** Save the anniversary fields on their own, so a missing column never
 *  breaks the rest of a client save. */
export async function saveAnniversary(admin: Admin, userId: string, clientId: string, patch: Record<string, unknown>): Promise<{ ok: boolean; missing?: boolean }> {
  const { error } = await admin.from('clients').update(patch).eq('id', clientId).eq('user_id', userId)
  if (!error) return { ok: true }
  if (isMissingSchema(error)) { await alertMissingSchema('reviews', error.message); return { ok: false, missing: true } }
  console.error('[annual-review] save date failed:', error.message)
  return { ok: false }
}

/** Everything the Reviews box, the Clients chips and the review page need. */
export async function loadReviews(admin: Admin, userId: string, now: Date = new Date()): Promise<{ available: false } | { available: true; items: ReviewItem[]; reviews: ReviewFull[]; summary: ReviewSummary; clients: ClientWithDates[] }> {
  const [cRes, rRes] = await Promise.all([
    admin.from('clients').select(CLIENT_DATE_COLS).eq('user_id', userId).not('anniversary_date', 'is', null).limit(2000),
    admin.from('client_reviews').select(REVIEW_COLS).eq('user_id', userId)
      .gte('cycle_date', addDays(todayIn('UTC', now), -400)).order('cycle_date', { ascending: false }).limit(2000),
  ])
  const err = cRes.error ?? rRes.error
  if (err) {
    if (isMissingSchema(err)) { await alertMissingSchema('reviews', err.message); return { available: false } }
    console.error('[annual-review] load failed:', err.message)
    return { available: false }
  }
  const clients = (cRes.data ?? []) as ClientWithDates[]
  const reviews = (rRes.data ?? []) as ReviewFull[]

  // Watched / booked: what the client did on the review video's page.
  const vids = [...new Set(reviews.map((r) => r.video_id).filter((x): x is string => !!x))]
  const watched = new Set<string>(), booked = new Set<string>()
  if (vids.length) {
    const { data: ev } = await admin.from('video_analytics').select('video_id, event_type')
      .in('video_id', vids.slice(0, 500)).in('event_type', ['view', ...BOOKING_EVENTS]).limit(5000)
    for (const e of (ev ?? []) as { video_id: string; event_type: string }[]) {
      if (e.event_type === 'view') watched.add(e.video_id)
      else booked.add(e.video_id)
    }
  }

  const byKey = new Map(reviews.map((r) => [`${r.client_id}|${r.cycle_date}`, r]))
  const items: ReviewItem[] = []
  for (const c of clients) {
    if (!c.anniversary_date || !c.anniversary_confirmed) continue
    const due = reviewDue(c.anniversary_date, c.anniversary_tz, now)
    if (!due) continue
    const review = byKey.get(`${c.id}|${due.cycleDate}`) ?? null
    // Show the current cycle when due soon, or when work on it has started.
    if (!due.due && !review) continue
    items.push({
      client: { id: c.id, name: c.name, email: c.email, phone: c.phone },
      anniversary: c.anniversary_date, cycleDate: due.cycleDate, daysLeft: due.daysLeft, review,
      watched: !!review?.video_id && watched.has(review.video_id),
      booked: !!review?.video_id && booked.has(review.video_id),
    })
  }
  items.sort((a, b) => a.daysLeft - b.daysLeft)

  const sent = reviews.filter((r) => r.status === 'sent')
  const summary: ReviewSummary = {
    due: items.filter((i) => i.daysLeft <= 30 && (!i.review || (i.review.status === 'due' && !i.review.video_id))).length,
    prepared: reviews.filter((r) => !!r.video_id && ['due', 'prepared', 'scheduled', 'sending', 'send_failed'].includes(r.status)).length,
    sent: sent.length,
    watched: sent.filter((r) => r.video_id && watched.has(r.video_id)).length,
    booked: sent.filter((r) => r.video_id && booked.has(r.video_id)).length,
  }
  return { available: true, items, reviews, summary, clients }
}
