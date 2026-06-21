'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import InlineConfirm from '../../../_components/InlineConfirm'
import { useToast } from '../../../_components/Toast'

interface Sub {
  subscriptionId: string
  customerId: string
  email: string
  name: string
  tier: string
  status: string
  pauseCollection: boolean
  cancelAtPeriodEnd: boolean
  monthlyAmount: number
  currentPeriodEnd: number
}

interface BillingData {
  mrr: number
  activeCount: number
  pastDueCount: number
  pausedCount: number
  subscriptions: Sub[]
}

const money = (cents: number) => `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
const fmtDate = (unix: number) => unix ? new Date(unix * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

const STATUS_COLORS: Record<string, string> = {
  active: 'mint', trialing: 'sky', past_due: 'rose', unpaid: 'rose', paused: 'peach', canceled: 'peach',
}

export default function AdminBillingPage() {
  const notify = useToast()
  const [data, setData] = useState<BillingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/admin/billing')
      .then(r => r.json())
      .then(d => { if (d.error) setErr(d.error); else setData(d) })
      .catch(() => setErr('Failed to load billing data'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  async function act(subscriptionId: string, action: string) {
    setBusy(subscriptionId + action)
    try {
      const res = await fetch('/api/admin/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId, action }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Action failed')
      notify(`Subscription ${action.replace('_', ' ')}d.`, 'success')
      load()
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Action failed', 'error')
    } finally {
      setBusy(null)
    }
  }

  const subs = (data?.subscriptions ?? []).filter(s =>
    !search || s.email.toLowerCase().includes(search.toLowerCase()) || s.name.toLowerCase().includes(search.toLowerCase()))

  const card: React.CSSProperties = { flex: 1, background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, padding: '16px 20px' }
  const th: React.CSSProperties = { textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-light)', padding: '10px 14px', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: '10px 14px', fontSize: 13, borderTop: '1px solid var(--border-light)', verticalAlign: 'middle' }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Billing &amp; Sales</h1>
          <p>All customer subscriptions, live from Stripe. Cancel, pause, or resume.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/admin/revenue" className="btn btn-sm btn-soft">Revenue charts →</Link>
          <button onClick={load} className="btn btn-sm btn-soft">Refresh</button>
        </div>
      </div>

      {err && <div style={{ background: 'rgba(220,38,38,0.08)', border: '1.5px solid rgba(220,38,38,0.3)', color: '#b91c1c', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontWeight: 600 }}>{err}</div>}

      {/* Stat cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={card}><div style={{ fontSize: 26, fontWeight: 800 }}>{data ? money(data.mrr) : '—'}</div><div style={{ fontSize: 12, color: 'var(--ink-light)', fontWeight: 600 }}>MRR</div></div>
        <div style={card}><div style={{ fontSize: 26, fontWeight: 800 }}>{data?.activeCount ?? '—'}</div><div style={{ fontSize: 12, color: 'var(--ink-light)', fontWeight: 600 }}>Active subscribers</div></div>
        <div style={card}><div style={{ fontSize: 26, fontWeight: 800, color: '#b91c1c' }}>{data?.pastDueCount ?? '—'}</div><div style={{ fontSize: 12, color: 'var(--ink-light)', fontWeight: 600 }}>Past due</div></div>
        <div style={card}><div style={{ fontSize: 26, fontWeight: 800, color: '#b45309' }}>{data?.pausedCount ?? '—'}</div><div style={{ fontSize: 12, color: 'var(--ink-light)', fontWeight: 600 }}>Paused</div></div>
      </div>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search by email or name…"
        style={{ width: '100%', maxWidth: 360, padding: '10px 14px', borderRadius: 8, border: '1.5px solid var(--border-light)', fontSize: 14, marginBottom: 16, fontFamily: 'inherit' }}
      />

      {loading ? (
        <p style={{ color: 'var(--ink-light)' }}>Loading…</p>
      ) : subs.length === 0 ? (
        <div style={{ background: 'white', border: '1px dashed var(--border)', borderRadius: 10, padding: '48px', textAlign: 'center', color: 'var(--ink-soft)' }}>No subscriptions found.</div>
      ) : (
        <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
            <thead style={{ background: 'var(--bg-soft)' }}>
              <tr>
                <th style={th}>Customer</th>
                <th style={th}>Plan</th>
                <th style={th}>Status</th>
                <th style={{ ...th, textAlign: 'right' }}>MRR</th>
                <th style={th}>Renews</th>
                <th style={{ ...th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {subs.map(s => {
                const paused = s.pauseCollection
                const ending = s.cancelAtPeriodEnd
                return (
                  <tr key={s.subscriptionId}>
                    <td style={{ ...td, maxWidth: 260 }}>
                      <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.email}</div>
                      {s.name && <div style={{ fontSize: 12, color: 'var(--ink-light)' }}>{s.name}</div>}
                    </td>
                    <td style={{ ...td, textTransform: 'capitalize' }}>{s.tier}</td>
                    <td style={td}>
                      <span className={`tag ${STATUS_COLORS[s.status] ?? 'peach'}`} style={{ fontSize: 11 }}>
                        {paused ? 'Paused' : ending ? 'Ending' : s.status}
                      </span>
                    </td>
                    <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{money(s.monthlyAmount)}</td>
                    <td style={{ ...td, color: 'var(--ink-light)', whiteSpace: 'nowrap' }}>{fmtDate(s.currentPeriodEnd)}</td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {paused ? (
                        <button className="btn btn-soft btn-sm" disabled={busy?.startsWith(s.subscriptionId)} onClick={() => act(s.subscriptionId, 'resume')}>Resume</button>
                      ) : ending ? (
                        <button className="btn btn-soft btn-sm" disabled={busy?.startsWith(s.subscriptionId)} onClick={() => act(s.subscriptionId, 'resume')}>Reactivate</button>
                      ) : (
                        <>
                          <button className="btn btn-soft btn-sm" style={{ marginRight: 6 }} disabled={busy?.startsWith(s.subscriptionId)} onClick={() => act(s.subscriptionId, 'pause')}>Pause</button>
                          <InlineConfirm message="Cancel at period end?" confirmLabel="Cancel" onConfirm={() => act(s.subscriptionId, 'cancel')}>
                            <button className="btn btn-danger btn-sm" disabled={busy?.startsWith(s.subscriptionId)}>Cancel</button>
                          </InlineConfirm>
                        </>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
