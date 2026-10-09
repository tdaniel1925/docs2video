'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface RevenueData {
  summary: {
    mrr: number
    totalRevenue30d: number
    netRevenue30d: number
    otherProducts30d: number
    paying: number
    trialing: number
    pastDue: number
    paused: number
    cancelling: number
    conversionRate: number
    conversionPaying: number
    conversionEligible: number
  }
  byPlan: { name: string; paying: number; trialing: number; pastDue: number; mrrCents: number }[]
  other: { count: number; payingMrrCents: number; byName: { name: string; count: number; payingMrrCents: number }[] }
  dailyRevenue: { date: string; amount: number }[]
  recentPayments: {
    id: string
    amount: number
    currency: string
    description: string
    date: string
    email: string
  }[]
}

function fmtCents(cents: number) { return `$${(cents / 100).toFixed(2)}` }

export default function RevenuePage() {
  const [data, setData] = useState<RevenueData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/revenue')
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setData(d) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={s.page}><div style={s.container}><p style={s.loading}>Loading revenue data...</p></div></div>
  if (error) return <div style={s.page}><div style={s.container}><p style={s.error}>{error}</p></div></div>
  if (!data) return null

  const { summary, byPlan, other, dailyRevenue, recentPayments } = data
  const maxDailyRev = Math.max(...dailyRevenue.map(d => d.amount), 1)

  return (
    <div style={s.page}>
      <div style={s.container}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={s.title}>Stripe Revenue</h1>
            <p style={s.subtitle}>Live from Stripe. Docs2Video customers only — the same numbers as the Dashboard and Billing.</p>
          </div>
          <Link href="/admin" style={s.backLink}>&larr; Admin</Link>
        </div>

        {/* Summary Cards */}
        <div style={s.grid4}>
          <div style={{ ...s.card, borderLeft: '4px solid var(--success)' }}>
            <div style={s.cardLabel}>MRR (paying only)</div>
            <div style={s.cardValue}>{fmtCents(summary.mrr)}</div>
            <div style={s.cardSub}>{summary.paying} paying · {summary.trialing} on trial · {summary.pastDue} late</div>
          </div>
          <div style={{ ...s.card, borderLeft: '4px solid var(--link)' }}>
            <div style={s.cardLabel}>Revenue (30 days)</div>
            <div style={s.cardValue}>{fmtCents(summary.totalRevenue30d)}</div>
            <div style={s.cardSub}>Gross charges{summary.otherProducts30d > 0 ? ` · other products: ${fmtCents(summary.otherProducts30d)} (not included)` : ''}</div>
          </div>
          <div style={{ ...s.card, borderLeft: '4px solid var(--ink-soft)' }}>
            <div style={s.cardLabel}>Net Revenue (30 days)</div>
            <div style={s.cardValue}>{fmtCents(summary.netRevenue30d)}</div>
            <div style={s.cardSub}>After Stripe fees</div>
          </div>
          <div style={{ ...s.card, borderLeft: '4px solid var(--warning)' }}>
            <div style={s.cardLabel}>Conversion Rate</div>
            <div style={s.cardValue}>{summary.conversionRate}%</div>
            <div style={s.cardSub}>{summary.conversionPaying} of {summary.conversionEligible} real sign-ups pay (no test, banned or admin accounts)</div>
          </div>
        </div>

        {/* Tier Breakdown + Daily Revenue */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 24 }}>
          <div style={s.card}>
            <h2 style={s.sectionTitle}>Paying by plan</h2>
            {byPlan.length > 0 ? byPlan.map((p) => (
              <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{p.name}</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)' }}>{p.paying}{p.trialing ? <span style={{ fontWeight: 500, color: 'var(--ink-light)' }}> +{p.trialing} trial</span> : null}</span>
              </div>
            )) : (
              <p style={{ fontSize: 13, color: 'var(--ink-light)' }}>No Docs2Video subscriptions</p>
            )}
            {other.count > 0 && (
              <p style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: 12 }}>
                Also on this Stripe account (not Docs2Video, not counted): {other.byName.map((o) => `${o.name} ×${o.count}`).join(', ')}.
              </p>
            )}
          </div>

          <div style={s.card}>
            <h2 style={s.sectionTitle}>Daily Revenue (30 days)</h2>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 120 }}>
              {dailyRevenue.map(d => (
                <div key={d.date} style={{ flex: 1 }}>
                  <div style={{
                    width: '100%', borderRadius: '4px 4px 0 0',
                    background: d.amount > 0 ? 'var(--success)' : 'var(--border-light)',
                    height: Math.max(2, (d.amount / maxDailyRev) * 100),
                  }} title={`${d.date}: ${fmtCents(d.amount)}`} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ fontSize: 11, color: 'var(--ink-light)' }}>{dailyRevenue[0]?.date}</span>
              <span style={{ fontSize: 11, color: 'var(--ink-light)' }}>{dailyRevenue[dailyRevenue.length - 1]?.date}</span>
            </div>
          </div>
        </div>

        {/* Recent Payments */}
        <div style={{ ...s.card, overflowX: 'auto' }}>
          <h2 style={s.sectionTitle}>Recent Payments</h2>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Date</th>
                <th style={s.th}>Email</th>
                <th style={s.th}>Description</th>
                <th style={{ ...s.th, textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {recentPayments.map(p => (
                <tr key={p.id}>
                  <td style={s.td}>{new Date(p.date).toLocaleDateString()}</td>
                  <td style={s.td}>{p.email || '—'}</td>
                  <td style={s.td}>{p.description}</td>
                  <td style={{ ...s.td, textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>{fmtCents(p.amount)}</td>
                </tr>
              ))}
              {recentPayments.length === 0 && (
                <tr><td colSpan={4} style={{ ...s.td, textAlign: 'center', color: 'var(--ink-light)' }}>No payments yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', padding: '24px 16px 48px' },
  container: { maxWidth: 1100, margin: '0 auto' },
  title: { fontSize: 28, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 },
  subtitle: { fontSize: 14, color: 'var(--ink-soft)', marginBottom: 0 },
  backLink: { fontSize: 13, color: 'var(--ink-light)', textDecoration: 'none' },
  loading: { textAlign: 'center', padding: 48, color: 'var(--ink-light)' },
  error: { textAlign: 'center', padding: 48, color: 'var(--error)' },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 },
  card: { padding: 20, borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border-light)' },
  cardLabel: { fontSize: 12, fontWeight: 600, color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 },
  cardValue: { fontSize: 28, fontWeight: 800, color: 'var(--ink)' },
  cardSub: { fontSize: 12, color: 'var(--ink-light)', marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 16 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--border-light)', fontWeight: 600, color: 'var(--ink-light)', fontSize: 11, textTransform: 'uppercase' },
  td: { padding: '8px 12px', borderBottom: '1px solid var(--border-light)', color: 'var(--ink)' },
}
