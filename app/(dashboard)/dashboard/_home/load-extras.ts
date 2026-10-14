import { createAdminClient } from '../../../_lib/supabase/admin'
import { loadReviews, type ReviewItem } from '../../../_lib/annual-review-db'
import { dateWords, dueWords } from '../../../_lib/annual-review'
import { isMissingSchema } from '../../../_lib/feature-tables'
import type { ActionCard } from './derive'

// =============================================================================
// Two more kinds of "Today's clients" card (built 2026-10-10):
//   question — a client asked something under a video; the answer waits on you
//   review   — a client's policy anniversary is within 30 days
// Read straight from client_questions / client_reviews + clients, so they show
// even before the daily reviews job has run. Missing tables → no cards.
// =============================================================================

type QRow = { id: string; video_id: string; question: string; asker_name: string | null; asker_email: string | null; status: string; created_at: string; client_id: string | null }

export function questionCards(rows: QRow[], titles: Map<string, string>): ActionCard[] {
  return rows.slice(0, 4).map((q) => {
    const who = q.asker_name || q.asker_email || 'A client'
    const short = q.question.length > 90 ? q.question.slice(0, 87) + '…' : q.question
    return {
      key: `q:${q.id}`,
      kind: 'question',
      eyebrow: q.status === 'drafted' ? 'Asked a question · answer drafted' : 'Asked a question',
      who,
      what: ` asked about ${titles.get(q.video_id) ?? 'your video'}`,
      detail: `“${short}”`,
      primary: { label: q.status === 'drafted' ? 'Check the answer' : 'Answer', href: `/questions/${q.id}` },
      personKey: q.client_id ? `client:${q.client_id}` : `asker:${(q.asker_email || q.asker_name || q.id).toLowerCase()}`,
      at: q.created_at,
    }
  })
}

export function reviewCards(items: ReviewItem[]): ActionCard[] {
  return items
    .filter((i) => i.daysLeft <= 30 && (!i.review || ['due', 'prepared', 'send_failed'].includes(i.review.status)))
    .slice(0, 4)
    .map((i) => {
      const prepared = !!i.review?.video_id
      return {
        key: `r:${i.client.id}:${i.cycleDate}`,
        kind: 'review',
        eyebrow: dueWords(i.daysLeft),
        who: i.client.name,
        what: prepared ? '’s annual review is ready to schedule' : '’s policy anniversary is coming up',
        detail: `Anniversary ${dateWords(i.cycleDate)}. ${prepared ? 'Pick the day it goes out.' : 'A short “year in review” video is a friendly reason to get in touch.'}`,
        primary: { label: prepared ? 'Pick a send day' : 'Prepare review', href: `/clients/${i.client.id}/review` },
        ...(i.client.phone ? { secondary: { label: 'Call', href: `tel:${i.client.phone}` } } : {}),
        personKey: `client:${i.client.id}`,
        at: i.cycleDate,
      }
    })
}

export async function loadHomeExtras(userId: string): Promise<ActionCard[]> {
  const admin = createAdminClient()
  const out: ActionCard[] = []
  try {
    const { data, error } = await admin.from('client_questions')
      .select('id, video_id, question, asker_name, asker_email, status, created_at, client_id')
      .eq('user_id', userId).in('status', ['new', 'drafted', 'needs_reply'])
      .order('created_at', { ascending: false }).limit(8)
    if (error) { if (!isMissingSchema(error)) console.error('[home] questions failed:', error.message) }
    else if (data?.length) {
      const ids = [...new Set((data as QRow[]).map((q) => q.video_id))]
      const { data: vids } = await admin.from('videos').select('id, title').eq('user_id', userId).in('id', ids)
      const titles = new Map(((vids ?? []) as { id: string; title: string | null }[]).map((v) => [v.id, v.title || 'your video']))
      out.push(...questionCards(data as QRow[], titles))
    }
  } catch (e) { console.error('[home] questions failed:', e) }
  try {
    const r = await loadReviews(admin, userId)
    if (r.available) out.push(...reviewCards(r.items))
  } catch (e) { console.error('[home] reviews failed:', e) }
  return out
}
