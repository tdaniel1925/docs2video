'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarHeart } from 'lucide-react'
import { Card } from '../kit'
import { dueWords } from '../../_lib/annual-review'
import s from './ar.module.css'

// THE REVIEWS BOX (Home, beside "This month"): this year's annual reviews in
// five numbers — due, prepared, sent, watched, booked — and the next few
// clients. Hidden until annual reviews are switched on (migration).

type Summary = { due: number; prepared: number; sent: number; watched: number; booked: number }
type Item = { client: { id: string; name: string }; daysLeft: number; review: { status: string; video_id: string | null } | null }

export default function ReviewsBox() {
  const [data, setData] = useState<{ summary: Summary; items: Item[] } | null>(null)
  useEffect(() => {
    let live = true
    fetch('/api/reviews').then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (live && j?.available) setData({ summary: j.summary, items: j.items ?? [] })
    }).catch(() => {})
    return () => { live = false }
  }, [])
  if (!data) return null
  const { summary, items } = data
  const next = items.filter((i) => i.daysLeft <= 30 && i.review?.status !== 'sent' && i.review?.status !== 'skipped').slice(0, 3)
  const cells: [keyof Summary, string][] = [['due', 'Due'], ['prepared', 'Prepared'], ['sent', 'Sent'], ['watched', 'Watched'], ['booked', 'Booked']]
  return (
    <Card className="ar-reviews-box">
      <div data-testid="reviews-box" style={{ marginTop: 0 }}>
        <h3 className={s.boxTitle}><CalendarHeart size={18} aria-hidden="true" /> Annual reviews</h3>
        <div className={s.counts}>
          {cells.map(([k, label]) => (
            <div key={k} className={s.count}><b>{summary[k]}</b><span>{label}</span></div>
          ))}
        </div>
        {next.length > 0 ? (
          <ul className={s.list} style={{ gap: 4 }}>
            {next.map((i) => (
              <li key={i.client.id} className={s.boxRow}>
                <span className={s.small}><strong>{i.client.name}</strong> · {dueWords(i.daysLeft).replace('Review due', 'due')}</span>
                <Link href={`/clients/${i.client.id}/review`} className={s.dueLink}>{i.review?.video_id ? 'Open' : 'Prepare'}</Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className={s.small}>Nobody is due in the next 30 days. Add a policy date to a client on <Link href="/clients">Clients</Link> and we’ll remind you a month ahead.</p>
        )}
      </div>
    </Card>
  )
}
