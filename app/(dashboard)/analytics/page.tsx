'use client'

import { useEffect, useState } from 'react'

interface AnalyticsData {
  totalViews: number
  topVideos: { id: string; title: string; view_count: number; thumbnail_url: string | null }[]
  dailyViews: { date: string; count: number }[]
  quoteStats: { total: number; viewed: number; accepted: number }
  emailStats: { total: number; opened: number; openRate: number }
}

interface BenchmarkData {
  watchThroughRate: { user: number; platform: number }
  timeToFirstView: { user: number | null; platform: number }
  conversionRate: { user: number; platform: number }
  viewsThisMonth: number
  viewsLastMonth: number
  clientEngagement: { user: number; platform: number }
}

function BenchmarkRow({ label, userVal, platformVal, unit, invert }: {
  label: string; userVal: string; platformVal: string; unit?: string; invert?: boolean
}) {
  const userNum = parseFloat(userVal)
  const platNum = parseFloat(platformVal)
  const isAbove = invert ? userNum < platNum : userNum > platNum
  const diff = invert
    ? platNum > 0 ? `${Math.round(((platNum - userNum) / platNum) * 100)}% faster` : ''
    : `${Math.abs(Math.round(userNum - platNum))}%`

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
      <span style={{ fontSize: 14, fontWeight: 500 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>{userVal}{unit}</span>
        <span style={{ fontSize: 12, color: 'var(--ink-light)' }}>(avg: {platformVal}{unit})</span>
        <span style={{
          fontSize: 12,
          fontWeight: 700,
          color: isAbove ? '#16a34a' : '#dc2626',
        }}>
          {isAbove ? '\u2191' : '\u2193'} {diff}
        </span>
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [benchmarks, setBenchmarks] = useState<BenchmarkData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/analytics').then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/benchmarks').then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([analyticsData, benchmarkData]) => {
      // Validate shape so a new user (no data) or an error response can't crash
      // the page (data.dailyViews.map used to throw on a white screen).
      if (analyticsData && Array.isArray(analyticsData.dailyViews)) {
        setData(analyticsData)
      } else {
        setData({ ...(analyticsData ?? {}), dailyViews: [], totals: (analyticsData?.totals ?? {}) } as AnalyticsData)
      }
      setBenchmarks(benchmarkData)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="page-wrap"><p>Loading analytics...</p></div>
  if (!data) return <div className="page-wrap"><p>Failed to load analytics.</p></div>

  const dailyViews = data.dailyViews ?? []
  const maxDaily = Math.max(...dailyViews.map(d => d.count), 1)

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
        {dailyViews.length === 0 ? (
          <p className="ssub">No views in the last 30 days.</p>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 120 }}>
            {dailyViews.map(d => (
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
      <div className="settings-card" style={{ marginBottom: 32 }}>
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

      {/* Benchmarks */}
      {benchmarks && (
        <div className="settings-card" style={{ marginBottom: 32 }}>
          <h3 style={{ marginBottom: 4 }}>Your Performance vs. Platform Average</h3>
          <p className="ssub" style={{ marginBottom: 16 }}>See how your presentations compare to other users on the platform.</p>
          <BenchmarkRow
            label="Watch-through rate"
            userVal={String(benchmarks.watchThroughRate.user)}
            platformVal={String(benchmarks.watchThroughRate.platform)}
            unit="%"
          />
          <BenchmarkRow
            label="Time to first view"
            userVal={benchmarks.timeToFirstView.user != null ? String(benchmarks.timeToFirstView.user) : '0'}
            platformVal={String(benchmarks.timeToFirstView.platform)}
            unit=" hrs"
            invert
          />
          <BenchmarkRow
            label="Client engagement"
            userVal={String(benchmarks.clientEngagement.user)}
            platformVal={String(benchmarks.clientEngagement.platform)}
            unit=" interactions"
          />
          <BenchmarkRow
            label="Conversion rate"
            userVal={String(benchmarks.conversionRate.user)}
            platformVal={String(benchmarks.conversionRate.platform)}
            unit="%"
          />
          <div style={{ marginTop: 16, display: 'flex', gap: 24 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{benchmarks.viewsThisMonth}</div>
              <div className="ssub">Views this month</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{benchmarks.viewsLastMonth}</div>
              <div className="ssub">Views last month</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: benchmarks.viewsThisMonth >= benchmarks.viewsLastMonth ? '#16a34a' : '#dc2626' }}>
                {benchmarks.viewsLastMonth > 0
                  ? `${benchmarks.viewsThisMonth >= benchmarks.viewsLastMonth ? '+' : ''}${Math.round(((benchmarks.viewsThisMonth - benchmarks.viewsLastMonth) / benchmarks.viewsLastMonth) * 100)}%`
                  : '--'}
              </div>
              <div className="ssub">Month-over-month</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
