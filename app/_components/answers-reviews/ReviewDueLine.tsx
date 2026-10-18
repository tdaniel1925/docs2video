'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Chip } from '../kit'
import { dueWords, reviewDue, REVIEW_STATUS_WORDS } from '../../_lib/annual-review'
import s from './ar.module.css'

// "Review due in 30 days · Prepare review" under a client's name on Clients.
// One /api/reviews read for the whole list (useReviewsState); the due date
// itself is worked out here from the client's policy date, in this browser's
// time zone.

export type ReviewsState = { available: boolean; byClient: Map<string, { status: string; video_id: string | null }> }

export function useReviewsState(): ReviewsState | null {
  const [state, setState] = useState<ReviewsState | null>(null)
  useEffect(() => {
    let live = true
    fetch('/api/reviews').then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (!live) return
      const byClient = new Map<string, { status: string; video_id: string | null }>()
      for (const i of (j?.items ?? []) as { client: { id: string }; review: { status: string; video_id: string | null } | null }[]) {
        if (i.review) byClient.set(i.client.id, i.review)
      }
      setState({ available: !!j?.available, byClient })
    }).catch(() => { if (live) setState({ available: false, byClient: new Map() }) })
    return () => { live = false }
  }, [])
  return state
}

export default function ReviewDueLine({ client, reviews }: {
  client: { id: string; anniversary_date?: string | null; anniversary_confirmed?: boolean | null }
  reviews: ReviewsState | null
}) {
  if (!reviews?.available || !client.anniversary_date) return null
  if (!client.anniversary_confirmed) {
    return (
      <div className={s.due}>
        <Chip tone="neutral">Policy date to confirm</Chip>
        <Link href={`/clients/${client.id}`} className={s.dueLink}>Confirm</Link>
      </div>
    )
  }
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const due = reviewDue(client.anniversary_date, tz)
  const r = reviews.byClient.get(client.id)
  if (!due || (!due.due && !r)) return null
  if (r && r.status !== 'due') {
    return (
      <div className={s.due} data-testid="review-due">
        <Chip tone={r.status === 'sent' ? 'ok' : r.status === 'send_failed' ? 'stop' : 'info'}>Review: {REVIEW_STATUS_WORDS[r.status] ?? r.status}</Chip>
        <Link href={`/clients/${client.id}/review`} className={s.dueLink}>Open</Link>
      </div>
    )
  }
  return (
    <div className={s.due} data-testid="review-due">
      <Chip tone={due.daysLeft <= 7 ? 'warn' : 'info'}>{dueWords(due.daysLeft)}</Chip>
      <Link href={`/clients/${client.id}/review`} className={s.dueLink}>Prepare review</Link>
    </div>
  )
}
