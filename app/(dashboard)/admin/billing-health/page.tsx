'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useToast } from '../../../_components/Toast'

type DriftKind = 'flagged_paid_no_stripe_sub' | 'has_stripe_sub_not_flagged' | 'tier_mismatch' | 'past_due'

interface DriftRow {
  userId: string
  email: string
  name: string | null
  flag: string | null
  stripeStatus: string | null
  stripePlan: string | null
  monthlyCents: number
  kind: DriftKind
  detail: string
  dismissed: boolean
}

interface HealthData {
  checkedProfiles: number
  activeStripeSubs: number
  driftCount: number
  dismissedCount: number
  counts: Record<DriftKind, number>
  drift: DriftRow[]
}

const KIND_META: Record<DriftKind, { label: string; color: string; bg: string }> = {
  has_stripe_sub_not_flagged: { label: 'Paying but locked out', color: '#b91c1c', bg: 'rgba(220,38,38,0.08)' },
  flagged_paid_no_stripe_sub: { label: 'Free paid features', color: '#b45309', bg: 'rgba(217,119,6,0.08)' },
  past_due: { label: 'Past due', color: '#b91c1c', bg: 'rgba(220,38,38,0.06)' },
  tier_mismatch: { label: 'Plan name mismatch', color: '#6b7280', bg: 'rgba(107,114,128,0.08)' },
}

const money = (cents: number) => `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}`

export default function AdminBillingHealthPage() {
  const notify = useToast()
  const [data, setData] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [showDismissed, setShowDismissed] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setErr(null)
    fetch('/api/admin/billing-health')
      .then(r => r.json())
      .then(d => { if (d.error) setErr(d.error); else setData(d) })
      .catch(() => setErr('Failed to load billing health'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  // Resolve a row by aligning the app flag with the Stripe truth.
  async function fix(row: DriftRow) {
    let plan: string | null = null
    let confirmMsg = ''
    if (row.kind === 'flagged_paid_no_stripe_sub') {
      plan = 'free'
      confirmMsg = `Set ${row.email} to FREE? They have no active Stripe subscription.`
    } else if (row.kind === 'has_stripe_sub_not_flagged') {
      plan = row.stripePlan
      confirmMsg = `Set ${row.email} to ${plan?.toUpperCase()}? They're actively paying for it in Stripe.`
    } else if (row.kind === 'tier_mismatch') {
      plan = row.stripePlan
      confirmMsg = `Set ${row.email} to ${plan?.toUpperCase()} to match Stripe?`
    }
    if (!plan || !confirm(confirmMsg)) return

    setBusy(row.userId)
    try {
      const res = await fetch('/api/admin/user-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'change_plan', userId: row.userId, value: plan, reason: `billing-health fix: ${row.kind}` }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed')
      notify(`Set ${row.email} to ${plan}.`, 'success')
      load()
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Fix failed', 'error')
    } finally {
      setBusy(null)
    }
  }

  // Acknowledge a known-good comp (or restore it to the active list).
  async function toggleDismiss(row: DriftRow) {
    setBusy(row.userId)
    try {
      const res = await fetch('/api/admin/billing-health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: row.userId, dismiss: !row.dismissed }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed')
      notify(row.dismissed ? `Restored ${row.email} to the report.` : `Dismissed ${row.email} as a known comp.`, 'success')
      load()
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Failed', 'error')
    } finally {
      setBusy(null)
    }
  }

  const card: React.CSSProperties = { flex: 1, minWidth: 150, background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, padding: '16px 20px' }
  const th: React.CSSProperties = { textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-light)', padding: '10px 14px', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: '10px 14px', fontSize: 13, borderTop: '1px solid var(--border-light)', verticalAlign: 'middle' }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Billing Health</h1>
          <p>Where the app&apos;s plan flags disagree with the live Stripe truth. These are revenue leaks and access bugs.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/admin/billing" className="btn btn-sm btn-soft">Subscriptions →</Link>
          <button onClick={load} className="btn btn-sm btn-soft" disabled={loading}>Refresh</button>
        </div>
      </div>

      {err && <div style={{ background: 'rgba(220,38,38,0.08)', border: '1.5px solid rgba(220,38,38,0.3)', color: '#b91c1c', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontWeight: 600 }}>{err}</div>}

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={card}><div style={{ fontSize: 26, fontWeight: 800, color: data?.driftCount ? '#b91c1c' : '#059669' }}>{data?.driftCount ?? '—'}</div><div style={{ fontSize: 12, color: 'var(--ink-light)', fontWeight: 600 }}>Total drift</div></div>
        <div style={card}><div style={{ fontSize: 26, fontWeight: 800, color: '#b91c1c' }}>{data?.counts.has_stripe_sub_not_flagged ?? '—'}</div><div style={{ fontSize: 12, color: 'var(--ink-light)', fontWeight: 600 }}>Paying, locked out</div></div>
        <div style={card}><div style={{ fontSize: 26, fontWeight: 800, color: '#b45309' }}>{data?.counts.flagged_paid_no_stripe_sub ?? '—'}</div><div style={{ fontSize: 12, color: 'var(--ink-light)', fontWeight: 600 }}>Free paid features</div></div>
        <div style={card}><div style={{ fontSize: 26, fontWeight: 800 }}>{data?.counts.past_due ?? '—'}</div><div style={{ fontSize: 12, color: 'var(--ink-light)', fontWeight: 600 }}>Past due</div></div>
        <div style={card}><div style={{ fontSize: 26, fontWeight: 800 }}>{data?.checkedProfiles ?? '—'}</div><div style={{ fontSize: 12, color: 'var(--ink-light)', fontWeight: 600 }}>Profiles checked</div></div>
      </div>

      {data && data.dismissedCount > 0 && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, fontSize: 13, color: 'var(--ink-light)', cursor: 'pointer' }}>
          <input type="checkbox" checked={showDismissed} onChange={e => setShowDismissed(e.target.checked)} />
          Show {data.dismissedCount} dismissed (known comps)
        </label>
      )}

      {(() => {
        const rows = (data?.drift ?? []).filter(r => showDismissed || !r.dismissed)
        if (loading) return <p style={{ color: 'var(--ink-light)' }}>Cross-referencing every profile against live Stripe…</p>
        if (!data || rows.length === 0) return (
          <div style={{ background: 'white', border: '1px dashed var(--border)', borderRadius: 10, padding: 48, textAlign: 'center', color: 'var(--ink-soft)' }}>
            ✓ No active drift — every plan flag matches Stripe{data && data.dismissedCount > 0 ? ' (dismissed comps excluded)' : ''}.
          </div>
        )
        return (
        <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
            <thead style={{ background: 'var(--bg-soft)' }}>
              <tr>
                <th style={th}>Customer</th>
                <th style={th}>Issue</th>
                <th style={th}>App flag</th>
                <th style={th}>Stripe</th>
                <th style={{ ...th, textAlign: 'right' }}>MRR</th>
                <th style={{ ...th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const meta = KIND_META[row.kind]
                const canFix = row.kind !== 'past_due'
                return (
                  <tr key={row.userId} style={{ background: row.dismissed ? 'transparent' : meta.bg, opacity: row.dismissed ? 0.5 : 1 }}>
                    <td style={{ ...td, maxWidth: 260 }}>
                      <Link href={`/admin/users/${row.userId}`} style={{ fontWeight: 600, color: 'var(--ink)', textDecoration: 'none' }}>{row.email}</Link>
                      {row.name && <div style={{ fontSize: 12, color: 'var(--ink-light)' }}>{row.name}</div>}
                    </td>
                    <td style={td}>
                      <span style={{ fontWeight: 700, color: meta.color }}>{meta.label}</span>
                      {row.dismissed && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-light)', marginLeft: 6 }}>· dismissed</span>}
                      <div style={{ fontSize: 12, color: 'var(--ink-light)', maxWidth: 320 }}>{row.detail}</div>
                    </td>
                    <td style={{ ...td, textTransform: 'capitalize' }}>{row.flag || 'free'}</td>
                    <td style={{ ...td, textTransform: 'capitalize' }}>{row.stripeStatus ? `${row.stripeStatus}${row.stripePlan ? ` · ${row.stripePlan}` : ''}` : 'none'}</td>
                    <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.monthlyCents ? money(row.monthlyCents) : '—'}</td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {canFix && !row.dismissed && (
                        <button className="btn btn-sm btn-soft" style={{ marginRight: 6 }} disabled={busy === row.userId} onClick={() => fix(row)}>
                          {busy === row.userId ? '…' : 'Align flag'}
                        </button>
                      )}
                      {row.kind === 'past_due' ? (
                        <Link href="/admin/billing" className="btn btn-sm btn-soft">Manage</Link>
                      ) : (
                        <button className="btn btn-sm btn-soft" disabled={busy === row.userId} onClick={() => toggleDismiss(row)}>
                          {row.dismissed ? 'Restore' : 'Dismiss'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        )
      })()}
    </div>
  )
}
