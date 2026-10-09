'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, BellRing, CheckCircle2, ChevronRight, CreditCard, Hourglass, Users, Wallet, Cpu } from 'lucide-react'
import { Chip } from '../../../_components/kit'
import type { NeedsYou, NeedSection } from '../../../_lib/admin/needs-you'
import { ReviewButtons } from './VideoActions'

/*
 * "WHAT NEEDS YOU" — the first thing on the admin home. The same list the
 * daily email sends (one server function, /api/admin/needs-you). Each line
 * is one click to the right page; videos waiting for review have Approve /
 * Reject right here.
 */
const ICONS: Record<NeedSection['key'], typeof AlertTriangle> = {
  failed: AlertTriangle, review: Hourglass, payments: CreditCard, past_due: CreditCard,
  slipping: Users, payouts: Wallet, providers: Cpu,
}

const when = (d?: string | null) => d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : null

export default function NeedsYouCard() {
  const [data, setData] = useState<NeedsYou | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(() => {
    fetch('/api/admin/needs-you')
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setData(d); setErr(null) })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Could not load'))
  }, [])
  useEffect(() => { load() }, [load])

  return (
    <section className="kit-card admin-needs" aria-labelledby="needs-title">
      <div className="admin-needs-head">
        <h2 id="needs-title" className="admin-needs-title"><BellRing size={20} aria-hidden="true" /> What needs you</h2>
        {data && <Chip tone={data.total ? 'warn' : 'ok'}>{data.total ? `${data.total} to look at` : 'All clear'}</Chip>}
      </div>
      <p className="admin-muted">The same list is emailed to you every morning.</p>
      {err && <p className="admin-muted">{err}</p>}
      {!data && !err && <p className="admin-muted">Checking…</p>}
      {data && data.sections.map((s) => <Section key={s.key} s={s} onChanged={load} />)}
    </section>
  )
}

function Section({ s, onChanged }: { s: NeedSection; onChanged: () => void }) {
  const Icon = ICONS[s.key]
  const empty = s.items.length === 0
  if (empty && s.key !== 'providers' && !s.note) {
    return (
      <div className="admin-needs-sec is-empty">
        <CheckCircle2 size={16} aria-hidden="true" className="admin-ok-icon" />
        <span>{s.title}: nothing</span>
      </div>
    )
  }
  return (
    <div className={`admin-needs-sec tone-${s.tone}`}>
      <div className="admin-needs-sec-head">
        <Icon size={16} aria-hidden="true" />
        <h3>{s.title}</h3>
        {s.key !== 'providers' && <Chip tone={s.tone === 'stop' ? 'stop' : 'warn'}>{s.items.length}</Chip>}
        <Link href={s.href} className="admin-link">See all <ChevronRight size={14} aria-hidden="true" /></Link>
      </div>
      {s.note && <p className="admin-muted">{s.note}</p>}
      <ul className="admin-needs-list">
        {s.items.slice(0, 6).map((i) => (
          <li key={i.id}>
            <div className="admin-needs-item">
              {/^https?:/.test(i.href)
                ? <a href={i.href} target="_blank" rel="noopener noreferrer" className="admin-needs-item-title">{i.title}</a>
                : <Link href={i.href} className="admin-needs-item-title">{i.title}</Link>}
              <span className="admin-needs-item-detail">{i.detail}{i.when ? ` · ${when(i.when)}` : ''}</span>
              {i.technical && (
                <details className="admin-tech"><summary>Technical details</summary><pre>{i.technical}</pre></details>
              )}
            </div>
            {i.videoId && s.key === 'review' && (
              <div className="admin-actions"><ReviewButtons videoId={i.videoId} title={i.title} onDone={onChanged} /></div>
            )}
          </li>
        ))}
        {s.items.length > 6 && <li className="admin-muted"><Link href={s.href} className="admin-link">…and {s.items.length - 6} more</Link></li>}
      </ul>
    </div>
  )
}
