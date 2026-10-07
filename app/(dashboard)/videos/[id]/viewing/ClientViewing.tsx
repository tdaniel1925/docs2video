'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { ViewerSummary, ViewingSummary } from '../../../../_lib/viewing'

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

/** "Watched to the end", "Got halfway", … — from the deepest quarter reached. */
function howFar(v: ViewerSummary, isDeck: boolean): string {
  if (isDeck) return v.played ? 'Opened it and clicked through' : 'Opened it'
  if (v.furthest >= 100) return 'Watched to the end'
  if (v.furthest >= 75) return 'Watched three quarters'
  if (v.furthest >= 50) return 'Watched half'
  if (v.furthest >= 25) return 'Watched a quarter'
  return v.played ? 'Started it' : 'Opened the page, didn’t press play'
}

/** Four sections, one per quarter — the finest step the share page reports. */
function QuarterBar({ v }: { v: ViewerSummary }) {
  return (
    <div className="res-qbar" role="img" aria-label={`Watched ${v.furthest}%`}>
      {v.reached.map((on, i) => <span key={i} className={`res-q${on ? ' on' : ''}`} />)}
    </div>
  )
}

function Clicks({ v }: { v: ViewerSummary }) {
  const out: string[] = []
  if (v.clicked.booking) out.push('Pressed Book a call')
  if (v.clicked.payment) out.push('Pressed Pay')
  if (v.clicked.download) out.push('Downloaded the PDF')
  if (!out.length) return null
  return <div className="res-clicks">{out.map((t) => <span key={t} className="kit-chip kit-chip--ok">{t}</span>)}</div>
}

/**
 * "Who watched" — per email you sent: whether the email was opened, whether
 * they opened the page, and how far into the video they got (quarters —
 * the finest the share page reports), then anyone else who watched, by
 * device. From /api/videos/<id>/viewing (data already collected; nothing new
 * stored). The "your client watched it" email already exists — this links to
 * its setting instead of adding another.
 */
export default function ClientViewing({ videoId, isDeck, refreshKey }: { videoId: string; isDeck: boolean; refreshKey: number }) {
  const [data, setData] = useState<ViewingSummary | null>(null)
  const [totals, setTotals] = useState<{ views: number; plays: number } | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/videos/${videoId}/viewing`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => { if (!cancelled) { setData(d); setFailed(false) } })
      .catch(() => { if (!cancelled) setFailed(true) })
    // Exact counts (the list above reads the newest events only).
    fetch(`/api/video-analytics?videoId=${videoId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d) setTotals({ views: d.views ?? 0, plays: d.plays ?? 0 }) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [videoId, refreshKey])

  const views = totals?.views ?? data?.totals.views ?? 0
  const plays = totals?.plays ?? data?.totals.plays ?? 0
  const nothing = data && data.shares.length === 0 && data.others.length === 0

  return (
    <section className="res-card" aria-label="Who watched">
      <div className="res-card-head">
        <h2 className="res-h2">Who watched</h2>
        <div className="res-stats">
          <span><strong>{views}</strong> {views === 1 ? 'view' : 'views'}</span>
          <span><strong>{plays}</strong> {isDeck ? (plays === 1 ? 'click-in' : 'click-ins') : (plays === 1 ? 'play' : 'plays')}</span>
        </div>
      </div>
      <p className="res-hint">
        {isDeck
          ? 'Presentations report when they’re opened and clicked into — not how far someone went.'
          : 'How far each person got, in quarters. Your own visits don’t count.'}
        {' '}We email you when a client opens it — <Link href="/activity#view-alerts">change when</Link>.
      </p>

      {failed && <p className="res-hint">Couldn’t load who watched just now. Refresh the page to try again.</p>}
      {!data && !failed && <p className="res-hint">Loading…</p>}
      {nothing && <p className="res-empty">Nobody has opened it yet. Send it above, and you’ll see here when they do.</p>}

      {data && data.shares.length > 0 && (
        <ul className="res-viewers">
          {data.shares.map((s) => (
            <li key={s.id} className="res-viewer">
              <div className="res-viewer-who">
                <strong>{s.name || s.to}</strong>
                {s.name && <span className="res-hint"> {s.to}</span>}
                <div className="res-hint">
                  Emailed {when(s.sentAt)} · {s.emailOpenedAt ? `email opened ${when(s.emailOpenedAt)}` : 'email not opened yet'}
                </div>
              </div>
              {s.viewer ? (
                <div className="res-viewer-how">
                  {!isDeck && <QuarterBar v={s.viewer} />}
                  <div className="res-viewer-far">{howFar(s.viewer, isDeck)} <span className="res-hint">· last {when(s.viewer.lastSeen)}</span></div>
                  <Clicks v={s.viewer} />
                </div>
              ) : (
                <div className="res-viewer-how res-hint">Hasn’t opened the page from this email yet.</div>
              )}
            </li>
          ))}
        </ul>
      )}

      {data && data.others.length > 0 && (
        <>
          <div className="rts-eyebrow res-gap">{data.shares.length > 0 ? 'Others who opened the link' : 'People who opened the link'}</div>
          <ul className="res-viewers">
            {data.others.slice(0, 10).map((v, i) => (
              <li key={i} className="res-viewer">
                <div className="res-viewer-who">
                  <strong>{v.device}</strong>
                  <div className="res-hint">First {when(v.firstSeen)}{v.visits > 1 ? ` · ${v.visits} visits` : ''}</div>
                </div>
                <div className="res-viewer-how">
                  {!isDeck && <QuarterBar v={v} />}
                  <div className="res-viewer-far">{howFar(v, isDeck)} <span className="res-hint">· last {when(v.lastSeen)}</span></div>
                  <Clicks v={v} />
                </div>
              </li>
            ))}
          </ul>
          {data.others.length > 10 && <p className="res-hint">And {data.others.length - 10} more.</p>}
        </>
      )}
    </section>
  )
}
