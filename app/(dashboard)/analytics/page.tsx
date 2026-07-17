'use client'

import { useEffect, useState } from 'react'

interface AnalyticsData {
  totalViews: number
  topVideos: { id: string; title: string; view_count: number; thumbnail_url: string | null }[]
  dailyViews: { date: string; count: number }[]
  quoteStats: { total: number; viewed: number; accepted: number }
  emailStats: { total: number; opened: number; openRate: number }
}

interface EngagementData {
  watchFunnel: { view: number; p25: number; p50: number; p75: number; p100: number }
  engagementFunnel: { view: number; play: number; download: number; booking: number; payment: number }
  clients: { name: string | null; email: string; totalViews: number; avgWatchPct: number | null; lastViewedAt: string | null; converted: boolean }[]
}

interface VideoDetail {
  video: { id: string; title: string | null; thumbnail_url: string | null }
  watchFunnel: EngagementData['watchFunnel']
  engagementFunnel: EngagementData['engagementFunnel']
  device: { label: string; count: number }[]
  referrer: { label: string; count: number }[]
}

/** A simple horizontal funnel bar row (stage label + count + proportional bar). */
function FunnelRow({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0' }}>
      <span style={{ fontSize: 13, width: 110, flexShrink: 0, color: 'var(--ink-soft)' }}>{label}</span>
      <div style={{ flex: 1, height: 22, background: 'var(--border-light)', borderRadius: 6, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 6, minWidth: count > 0 ? 6 : 0, transition: 'width .3s' }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, width: 64, textAlign: 'right' }}>{count.toLocaleString()} <span style={{ color: 'var(--ink-light)', fontWeight: 500 }}>({pct}%)</span></span>
    </div>
  )
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
  const [engagement, setEngagement] = useState<EngagementData | null>(null)
  const [detail, setDetail] = useState<VideoDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [loading, setLoading] = useState(true)

  function openVideoDetail(videoId: string) {
    setDetail(null); setDetailLoading(true)
    fetch(`/api/analytics/engagement?videoId=${videoId}`)
      .then(r => r.ok ? r.json() : null).catch(() => null)
      .then((d) => { setDetail(d); setDetailLoading(false) })
  }

  useEffect(() => {
    fetch('/api/analytics/engagement').then(r => r.ok ? r.json() : null).catch(() => null).then(setEngagement)
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

      {/* Watch-through + engagement funnels (data we already collect) */}
      {engagement && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16, marginBottom: 32 }}>
          <div className="settings-card">
            <h3 style={{ marginBottom: 6 }}>Watch-through</h3>
            <p className="ssub" style={{ marginBottom: 14 }}>How far viewers get into your videos.</p>
            <FunnelRow label="Opened" count={engagement.watchFunnel.view} max={engagement.watchFunnel.view} color="var(--mint)" />
            <FunnelRow label="Watched 25%" count={engagement.watchFunnel.p25} max={engagement.watchFunnel.view} color="var(--mint)" />
            <FunnelRow label="Watched 50%" count={engagement.watchFunnel.p50} max={engagement.watchFunnel.view} color="var(--mint)" />
            <FunnelRow label="Watched 75%" count={engagement.watchFunnel.p75} max={engagement.watchFunnel.view} color="var(--mint)" />
            <FunnelRow label="Finished" count={engagement.watchFunnel.p100} max={engagement.watchFunnel.view} color="#16a34a" />
          </div>
          <div className="settings-card">
            <h3 style={{ marginBottom: 6 }}>Engagement funnel</h3>
            <p className="ssub" style={{ marginBottom: 14 }}>From viewing to taking action.</p>
            <FunnelRow label="Viewed" count={engagement.engagementFunnel.view} max={engagement.engagementFunnel.view} color="var(--mint)" />
            <FunnelRow label="Played" count={engagement.engagementFunnel.play} max={engagement.engagementFunnel.view} color="var(--mint)" />
            <FunnelRow label="Downloaded" count={engagement.engagementFunnel.download} max={engagement.engagementFunnel.view} color="var(--mint)" />
            <FunnelRow label="Booked" count={engagement.engagementFunnel.booking} max={engagement.engagementFunnel.view} color="#16a34a" />
            <FunnelRow label="Paid" count={engagement.engagementFunnel.payment} max={engagement.engagementFunnel.view} color="#16a34a" />
          </div>
        </div>
      )}

      {/* Named-client engagement (who watched, how far) */}
      {engagement && engagement.clients.length > 0 && (
        <div className="settings-card" style={{ marginBottom: 32 }}>
          <h3 style={{ marginBottom: 6 }}>Client engagement</h3>
          <p className="ssub" style={{ marginBottom: 14 }}>Named clients who opened a video you sent them.</p>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {engagement.clients.map((c) => (
              <div key={c.email} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name || c.email}</div>
                  {c.name && <div style={{ fontSize: 12, color: 'var(--ink-light)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                  <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{c.totalViews} view{c.totalViews === 1 ? '' : 's'}</span>
                  {c.avgWatchPct != null && <span style={{ fontSize: 13, fontWeight: 700 }}>{Math.round(c.avgWatchPct)}% watched</span>}
                  {c.converted && <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', background: 'rgba(22,163,74,0.1)', padding: '2px 8px', borderRadius: 6 }}>Converted</span>}
                  {c.lastViewedAt && <span style={{ fontSize: 12, color: 'var(--ink-light)' }}>{new Date(c.lastViewedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top videos */}
      <div className="settings-card" style={{ marginBottom: 32 }}>
        <h3 style={{ marginBottom: 16 }}>Top Videos by Views</h3>
        {data.topVideos.length === 0 ? (
          <p className="ssub">No videos yet.</p>
        ) : (
          <div>
            {data.topVideos.map(v => (
              <button
                key={v.id}
                onClick={() => openVideoDetail(v.id)}
                className="activity-row"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border-light)', background: 'none', border: 'none', borderBottomWidth: 1, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                title="View details"
              >
                <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title || 'Untitled'}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, color: 'var(--ink-light)', fontWeight: 600 }}>
                  {v.view_count ?? 0} views
                  <span aria-hidden style={{ fontSize: 16 }}>&rsaquo;</span>
                </span>
              </button>
            ))}
          </div>
        )}
        <p className="ssub" style={{ marginTop: 10 }}>Click a video for its watch-through, engagement, and audience breakdown.</p>
      </div>

      {/* Per-video detail modal */}
      {(detail || detailLoading) && (
        <div onClick={() => { setDetail(null); setDetailLoading(false) }} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(8,12,16,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} className="settings-card" style={{ maxWidth: 640, width: '100%', maxHeight: '86vh', overflowY: 'auto' }}>
            {detailLoading ? <p className="ssub">Loading…</p> : detail ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
                  <h3 style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detail.video.title || 'Untitled'}</h3>
                  <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--ink-light)', lineHeight: 1 }}>&times;</button>
                </div>
                <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>Watch-through</h4>
                <FunnelRow label="Opened" count={detail.watchFunnel.view} max={detail.watchFunnel.view} color="var(--mint)" />
                <FunnelRow label="Watched 25%" count={detail.watchFunnel.p25} max={detail.watchFunnel.view} color="var(--mint)" />
                <FunnelRow label="Watched 50%" count={detail.watchFunnel.p50} max={detail.watchFunnel.view} color="var(--mint)" />
                <FunnelRow label="Watched 75%" count={detail.watchFunnel.p75} max={detail.watchFunnel.view} color="var(--mint)" />
                <FunnelRow label="Finished" count={detail.watchFunnel.p100} max={detail.watchFunnel.view} color="#16a34a" />
                <h4 style={{ margin: '18px 0 8px', fontSize: 14 }}>Engagement</h4>
                <FunnelRow label="Viewed" count={detail.engagementFunnel.view} max={detail.engagementFunnel.view} color="var(--mint)" />
                <FunnelRow label="Played" count={detail.engagementFunnel.play} max={detail.engagementFunnel.view} color="var(--mint)" />
                <FunnelRow label="Downloaded" count={detail.engagementFunnel.download} max={detail.engagementFunnel.view} color="var(--mint)" />
                <FunnelRow label="Booked" count={detail.engagementFunnel.booking} max={detail.engagementFunnel.view} color="#16a34a" />
                <FunnelRow label="Paid" count={detail.engagementFunnel.payment} max={detail.engagementFunnel.view} color="#16a34a" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 18 }}>
                  <div>
                    <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>Devices</h4>
                    {detail.device.length ? detail.device.map(d => (
                      <div key={d.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}><span style={{ color: 'var(--ink-soft)' }}>{d.label}</span><span style={{ fontWeight: 600 }}>{d.count}</span></div>
                    )) : <p className="ssub">No data yet.</p>}
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>Traffic source</h4>
                    {detail.referrer.length ? detail.referrer.map(r => (
                      <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, padding: '3px 0' }}><span style={{ color: 'var(--ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span><span style={{ fontWeight: 600 }}>{r.count}</span></div>
                    )) : <p className="ssub">No data yet.</p>}
                  </div>
                </div>
              </>
            ) : <p className="ssub">Could not load details.</p>}
          </div>
        </div>
      )}

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
