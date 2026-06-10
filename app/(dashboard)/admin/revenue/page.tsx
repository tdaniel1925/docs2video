'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface RevenueData {
  summary: {
    mrr: number
    totalRevenue30d: number
    netRevenue30d: number
    activeSubscriptions: number
    activeSubscribers: number
    totalUsers: number
    conversionRate: number
  }
  tierBreakdown: Record<string, number>
  dailyRevenue: { date: string; amount: number }[]
  recentPayments: {
    id: string
    amount: number
    currency: string
    customer: string | null
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

  const { summary, tierBreakdown, dailyRevenue, recentPayments } = data
  const maxDailyRev = Math.max(...dailyRevenue.map(d => d.amount), 1)

  return (
    <div style={s.page}>
      <div style={s.container}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={s.title}>Stripe Revenue</h1>
            <p style={s.subtitle}>Live data from Stripe</p>
          </div>
          <Link href="/admin" style={s.backLink}>&larr; Admin</Link>
        </div>

        {/* Summary Cards */}
        <div style={s.grid4}>
          <div style={{ ...s.card, borderLeft: '4px solid #22c55e' }}>
            <div style={s.cardLabel}>Monthly Recurring Revenue</div>
            <div style={s.cardValue}>{fmtCents(summary.mrr)}</div>
            <div style={s.cardSub}>{summary.activeSubscriptions} active subscriptions</div>
          </div>
          <div style={{ ...s.card, borderLeft: '4px solid #3b82f6' }}>
            <div style={s.cardLabel}>Revenue (30 days)</div>
            <div style={s.cardValue}>{fmtCents(summary.totalRevenue30d)}</div>
            <div style={s.cardSub}>Gross charges</div>
          </div>
          <div style={{ ...s.card, borderLeft: '4px solid #8b5cf6' }}>
            <div style={s.cardLabel}>Net Revenue (30 days)</div>
            <div style={s.cardValue}>{fmtCents(summary.netRevenue30d)}</div>
            <div style={s.cardSub}>After Stripe fees</div>
          </div>
          <div style={{ ...s.card, borderLeft: '4px solid #f59e0b' }}>
            <div style={s.cardLabel}>Conversion Rate</div>
            <div style={s.cardValue}>{summary.conversionRate}%</div>
            <div style={s.cardSub}>{summary.activeSubscribers} of {summary.totalUsers} users</div>
          </div>
        </div>

        {/* Tier Breakdown + Daily Revenue */}
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20, marginBottom: 24 }}>
          <div style={s.card}>
            <h2 style={s.sectionTitle}>Subscribers by Tier</h2>
            {Object.entries(tierBreakdown).length > 0 ? (
              Object.entries(tierBreakdown).sort((a, b) => b[1] - a[1]).map(([tier, count]) => (
                <div key={tier} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-light, #f3f4f6)' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', textTransform: 'capitalize' }}>{tier}</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)' }}>{count}</span>
                </div>
              ))
            ) : (
              <p style={{ fontSize: 13, color: 'var(--ink-light)' }}>No active subscriptions</p>
            )}
          </div>

          <div style={s.card}>
            <h2 style={s.sectionTitle}>Daily Revenue (30 days)</h2>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 120 }}>
              {dailyRevenue.map(d => (
                <div key={d.date} style={{ flex: 1 }}>
                  <div style={{
                    width: '100%', borderRadius: '4px 4px 0 0',
                    background: d.amount > 0 ? '#22c55e' : 'var(--border-light)',
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
        <div style={s.card}>
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
                  <td style={{ ...s.td, textAlign: 'right', fontWeight: 700, color: '#22c55e' }}>{fmtCents(p.amount)}</td>
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
  error: { textAlign: 'center', padding: 48, color: '#DC2626' },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 },
  card: { padding: 20, borderRadius: 10, background: 'white', border: '1px solid var(--border-light, #e5e7eb)' },
  cardLabel: { fontSize: 12, fontWeight: 600, color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 },
  cardValue: { fontSize: 28, fontWeight: 800, color: 'var(--ink)' },
  cardSub: { fontSize: 12, color: 'var(--ink-light)', marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 16 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--border-light)', fontWeight: 600, color: 'var(--ink-light)', fontSize: 11, textTransform: 'uppercase' },
  td: { padding: '8px 12px', borderBottom: '1px solid var(--border-light, #f3f4f6)', color: 'var(--ink)' },
}
