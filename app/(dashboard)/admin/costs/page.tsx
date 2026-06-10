'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface CostData {
  summary: {
    totalVideosAllTime: number
    totalVideos30d: number
    totalVideos7d: number
    totalCostAllTime: number
    totalCost30d: number
    totalCost7d: number
    avgCostPerVideo: number
    totalCreditsUsed30d: number
    totalUsers: number
  }
  breakdown: { anthropic: number; google: number; openai: number }
  dailyCosts: { date: string; count: number; cost: number }[]
  topUsers: { userId: string; count: number; cost: number }[]
  costPerAction: Record<string, number>
}

function fmt(n: number) { return `$${n.toFixed(2)}` }

export default function CostsPage() {
  const [data, setData] = useState<CostData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/costs')
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setData(d) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={s.page}><div style={s.container}><p style={s.loading}>Loading cost data...</p></div></div>
  if (error) return <div style={s.page}><div style={s.container}><p style={s.error}>{error}</p></div></div>
  if (!data) return null

  const { summary, breakdown, dailyCosts, topUsers, costPerAction } = data
  const maxDailyCost = Math.max(...dailyCosts.map(d => d.cost), 0.01)

  return (
    <div style={s.page}>
      <div style={s.container}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={s.title}>API Cost Analytics</h1>
            <p style={s.subtitle}>Estimated costs based on usage volume</p>
          </div>
          <Link href="/admin" style={s.backLink}>&larr; Admin</Link>
        </div>

        {/* Summary Cards */}
        <div style={s.grid4}>
          <div style={s.card}>
            <div style={s.cardLabel}>Total Cost (30 days)</div>
            <div style={s.cardValue}>{fmt(summary.totalCost30d)}</div>
            <div style={s.cardSub}>{summary.totalVideos30d} videos</div>
          </div>
          <div style={s.card}>
            <div style={s.cardLabel}>Cost (7 days)</div>
            <div style={s.cardValue}>{fmt(summary.totalCost7d)}</div>
            <div style={s.cardSub}>{summary.totalVideos7d} videos</div>
          </div>
          <div style={s.card}>
            <div style={s.cardLabel}>Avg Cost / Video</div>
            <div style={s.cardValue}>{fmt(summary.avgCostPerVideo)}</div>
            <div style={s.cardSub}>{summary.totalVideosAllTime} total videos</div>
          </div>
          <div style={s.card}>
            <div style={s.cardLabel}>Credits Used (30d)</div>
            <div style={s.cardValue}>{summary.totalCreditsUsed30d.toLocaleString()}</div>
            <div style={s.cardSub}>{summary.totalUsers} users</div>
          </div>
        </div>

        {/* Provider Breakdown */}
        <div style={{ ...s.card, marginBottom: 24 }}>
          <h2 style={s.sectionTitle}>Cost by Provider (30 days)</h2>
          <div style={s.grid3}>
            <div style={s.providerCard}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#7C3AED' }}>Anthropic (Claude)</div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{fmt(breakdown.anthropic)}</div>
              <div style={s.cardSub}>Script generation + analysis</div>
            </div>
            <div style={s.providerCard}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#2563EB' }}>Google (Gemini + Lyria)</div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{fmt(breakdown.google)}</div>
              <div style={s.cardSub}>Slides + music</div>
            </div>
            <div style={s.providerCard}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#059669' }}>OpenAI (TTS + Extract)</div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{fmt(breakdown.openai)}</div>
              <div style={s.cardSub}>Voice + document extraction</div>
            </div>
          </div>
        </div>

        {/* Daily Cost Chart */}
        <div style={{ ...s.card, marginBottom: 24 }}>
          <h2 style={s.sectionTitle}>Daily API Spend (30 days)</h2>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 120 }}>
            {dailyCosts.map(d => (
              <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                  width: '100%', borderRadius: '4px 4px 0 0',
                  background: 'var(--mint, #C7E8A8)',
                  height: Math.max(2, (d.cost / maxDailyCost) * 100),
                }} title={`${d.date}: ${fmt(d.cost)} (${d.count} videos)`} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--ink-light)' }}>{dailyCosts[0]?.date}</span>
            <span style={{ fontSize: 11, color: 'var(--ink-light)' }}>{dailyCosts[dailyCosts.length - 1]?.date}</span>
          </div>
        </div>

        {/* Cost Per Action Table */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
          <div style={s.card}>
            <h2 style={s.sectionTitle}>Cost Per Action</h2>
            <table style={s.table}>
              <thead>
                <tr><th style={s.th}>Action</th><th style={{ ...s.th, textAlign: 'right' }}>Est. Cost</th></tr>
              </thead>
              <tbody>
                {Object.entries(costPerAction).map(([action, cost]) => (
                  <tr key={action}>
                    <td style={s.td}>{action.replace(/_/g, ' ')}</td>
                    <td style={{ ...s.td, textAlign: 'right', fontWeight: 700 }}>{fmt(cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={s.card}>
            <h2 style={s.sectionTitle}>Top Users by Cost (30d)</h2>
            <table style={s.table}>
              <thead>
                <tr><th style={s.th}>User</th><th style={{ ...s.th, textAlign: 'right' }}>Videos</th><th style={{ ...s.th, textAlign: 'right' }}>Cost</th></tr>
              </thead>
              <tbody>
                {topUsers.map(u => (
                  <tr key={u.userId}>
                    <td style={s.td}><Link href={`/admin/users/${u.userId}`} style={{ color: '#2563EB', textDecoration: 'none' }}>{u.userId.slice(0, 8)}...</Link></td>
                    <td style={{ ...s.td, textAlign: 'right' }}>{u.count}</td>
                    <td style={{ ...s.td, textAlign: 'right', fontWeight: 700 }}>{fmt(u.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 },
  card: { padding: 20, borderRadius: 10, background: 'white', border: '1px solid var(--border-light, #e5e7eb)' },
  cardLabel: { fontSize: 12, fontWeight: 600, color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 },
  cardValue: { fontSize: 28, fontWeight: 800, color: 'var(--ink)' },
  cardSub: { fontSize: 12, color: 'var(--ink-light)', marginTop: 2 },
  providerCard: { padding: 16, borderRadius: 8, background: 'var(--bg-soft, #f8f9fa)', textAlign: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 16 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--border-light)', fontWeight: 600, color: 'var(--ink-light)', fontSize: 11, textTransform: 'uppercase' },
  td: { padding: '8px 12px', borderBottom: '1px solid var(--border-light, #f3f4f6)', color: 'var(--ink)' },
}
