'use client'

import { useEffect, useState } from 'react'

interface AnalyticsData {
  totalViews: number
  topVideos: { id: string; title: string; view_count: number; thumbnail_url: string | null }[]
  dailyViews: { date: string; count: number }[]
  quoteStats: { total: number; viewed: number; accepted: number }
  emailStats: { total: number; opened: number; openRate: number }
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analytics')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="page-wrap"><p>Loading analytics...</p></div>
  if (!data) return <div className="page-wrap"><p>Failed to load analytics.</p></div>

  const maxDaily = Math.max(...data.dailyViews.map(d => d.count), 1)

  return (
    <div className="page-wrap">
      <div className="page-head">
        <h1>Analytics</h1>
      </div>

      {/* Stats row */}
      <div className="stats-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        <div className="settings-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--mint)' }}>{data.totalViews}</div>
          <div className="ssub">Total Views</div>
        </div>
        <div className="settings-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--mint)' }}>{data.quoteStats.total}</div>
          <div className="ssub">Quotes Sent</div>
        </div>
        <div className="settings-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--mint)' }}>{data.quoteStats.accepted}</div>
          <div className="ssub">Conversions</div>
        </div>
        <div className="settings-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--mint)' }}>{data.emailStats.openRate}%</div>
          <div className="ssub">Email Open Rate</div>
        </div>
      </div>

      {/* Daily views chart */}
      <div className="settings-card" style={{ marginBottom: 32 }}>
        <h3 style={{ marginBottom: 16 }}>Views - Last 30 Days</h3>
        {data.dailyViews.length === 0 ? (
          <p className="ssub">No views in the last 30 days.</p>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 120 }}>
            {data.dailyViews.map(d => (
              <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div
                  style={{
                    width: '100%',
                    maxWidth: 24,
                    height: `${(d.count / maxDaily) * 100}px`,
                    background: 'var(--mint)',
                    borderRadius: 4,
                    minHeight: 4,
                  }}
                  title={`${d.date}: ${d.count} views`}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top videos */}
      <div className="settings-card" style={{ marginBottom: 32 }}>
        <h3 style={{ marginBottom: 16 }}>Top Videos by Views</h3>
        {data.topVideos.length === 0 ? (
          <p className="ssub">No videos yet.</p>
        ) : (
          <div>
            {data.topVideos.map(v => (
              <div key={v.id} className="activity-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
                <span style={{ fontWeight: 500 }}>{v.title || 'Untitled'}</span>
                <span style={{ color: 'var(--ink-light)', fontWeight: 600 }}>{v.view_count ?? 0} views</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Email stats */}
      <div className="settings-card">
        <h3 style={{ marginBottom: 16 }}>Email Performance</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{data.emailStats.total}</div>
            <div className="ssub">Sent</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{data.emailStats.opened}</div>
            <div className="ssub">Opened</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{data.emailStats.openRate}%</div>
            <div className="ssub">Open Rate</div>
          </div>
        </div>
      </div>
    </div>
  )
}
