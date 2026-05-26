'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import type { Profile, Video } from '@/app/_lib/types'

type Tab = 'dashboard' | 'users' | 'videos' | 'billing' | 'access' | 'audit' | 'prospects'

interface AuditEntry {
  id: string
  admin_id: string
  action: string
  target_user_id: string | null
  details: Record<string, unknown> | null
  created_at: string
}

export default function AdminPage() {
  const [state, setState] = useState<'loading' | 'denied' | 'error' | 'ok'>('loading')
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('dashboard')
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [videos, setVideos] = useState<Video[]>([])
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [accessSearch, setAccessSearch] = useState('')
  const [videoAnalytics, setVideoAnalytics] = useState<Record<string, { views: number; plays: number }>>({})
  const [dailyActivity, setDailyActivity] = useState<{ date: string; users: number; videos: number }[]>([])
  const [auditDateFilter, setAuditDateFilter] = useState<'7' | '30' | 'all'>('30')
  const [auditSearch, setAuditSearch] = useState('')
  const [prospectUrls, setProspectUrls] = useState('')
  const [prospectDemos, setProspectDemos] = useState<{ id: string; title: string; status: string; created_at: string; video_url: string | null; progress_detail: string | null }[]>([])
  const [prospectBusy, setProspectBusy] = useState(false)
  const [prospectResult, setProspectResult] = useState<{ url: string; videoId?: string; companyName?: string; error?: string }[] | null>(null)

  useEffect(() => {
    fetch('/api/admin/data')
      .then(r => {
        if (r.status === 403) { setState('denied'); return null }
        if (!r.ok) throw new Error('Failed to load')
        return r.json()
      })
      .then(d => {
        if (!d) return
        setProfiles(d.profiles ?? [])
        setVideos(d.videos ?? [])
        setAuditLog(d.auditLog ?? [])
        setVideoAnalytics(d.videoAnalytics ?? {})
        setState('ok')
      })
      .catch(e => { setError(e.message); setState('error') })
    fetch('/api/admin/stats').then(r => r.json()).then(d => {
      if (d.dailyActivity) setDailyActivity(d.dailyActivity)
    }).catch(() => {})
    // Load prospect demos on mount
    fetch('/api/admin/auto-demo').then(r => r.json()).then(d => {
      setProspectDemos(d.demos ?? [])
    }).catch(() => {})
  }, [])

  function reload() {
    fetch('/api/admin/data').then(r => r.json()).then(d => {
      setProfiles(d.profiles ?? [])
      setVideos(d.videos ?? [])
      setAuditLog(d.auditLog ?? [])
      setVideoAnalytics(d.videoAnalytics ?? {})
    }).catch(() => {})
  }

  async function userAction(userId: string, action: string, value?: string | number) {
    setBusy(userId)
    try {
      const r = await fetch('/api/admin/user-action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action, value }),
      })
      if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error || 'Failed'); return }
      reload()
    } catch { alert('Network error') }
    setBusy(null)
  }

  async function retryVideo(videoId: string) {
    setBusy(videoId)
    try {
      const r = await fetch('/api/admin/retry-video', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId }),
      })
      if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error || 'Failed'); return }
      reload()
    } catch { alert('Network error') }
    setBusy(null)
  }

  async function toggleAccess(userId: string, field: 'is_admin' | 'is_beta', value: boolean) {
    setBusy(userId)
    try {
      const r = await fetch('/api/admin/manage-access', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, field, value }),
      })
      if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error || 'Failed'); return }
      reload()
    } catch { alert('Network error') }
    setBusy(null)
  }

  const totalUsers = profiles.length
  const activeSubs = profiles.filter(p => ['active', 'pro', 'professional', 'starter', 'business', 'enterprise'].includes((p.subscription_status ?? '').toLowerCase())).length
  const totalVideos = videos.length
  const completedVideos = videos.filter(v => v.status === 'completed').length
  const failedVideos = videos.filter(v => v.status === 'failed').length
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const thisWeek = videos.filter(v => v.created_at > weekAgo).length

  const planPrices: Record<string, number> = { starter: 29, pro: 79, professional: 79, active: 29, business: 199, enterprise: 499 }
  const mrr = profiles.reduce((sum, p) => sum + (planPrices[(p.subscription_status ?? '').toLowerCase()] ?? 0), 0)

  const q = search.toLowerCase()
  const filteredUsers = useMemo(() =>
    profiles.filter(p => !q || (p.email ?? '').toLowerCase().includes(q) || (p.full_name ?? '').toLowerCase().includes(q)),
    [profiles, q]
  )
  const filteredVideos = useMemo(() =>
    videos.filter(v => {
      if (filter && v.status !== filter) return false
      if (q && !(v.title ?? '').toLowerCase().includes(q)) return false
      return true
    }),
    [videos, q, filter]
  )

  const adminUsers = useMemo(() => profiles.filter(p => p.is_admin), [profiles])
  const betaUsers = useMemo(() => profiles.filter(p => p.is_beta), [profiles])
  const accessQ = accessSearch.toLowerCase()
  const accessSearchResults = useMemo(() =>
    accessQ.length >= 2 ? profiles.filter(p => (p.email ?? '').toLowerCase().includes(accessQ) || (p.full_name ?? '').toLowerCase().includes(accessQ)).slice(0, 10) : [],
    [profiles, accessQ]
  )

  if (state === 'loading') return <div style={{ padding: 64, textAlign: 'center', color: 'var(--ink-light)' }}>Loading admin...</div>
  if (state === 'denied') return <div style={{ padding: 64, textAlign: 'center' }}><h2>Access Denied</h2><p style={{ color: 'var(--ink-light)' }}>You don&apos;t have admin access.</p></div>
  if (state === 'error') return <div style={{ padding: 64, textAlign: 'center' }}><h2>Error</h2><p style={{ color: 'var(--ink-light)' }}>{error}</p></div>

  const tabs: { id: Tab; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'users', label: `Users (${totalUsers})` },
    { id: 'videos', label: `Videos (${totalVideos})` },
    { id: 'billing', label: 'Billing' },
    { id: 'access', label: 'Manage Access' },
    { id: 'audit', label: 'Audit Log' },
    { id: 'prospects', label: 'Prospects' },
  ]

  const userEmail = (userId: string) => profiles.find(p => p.id === userId)?.email ?? '—'
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const fmtTime = (d: string) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  const planTag = (s: string | null) => {
    const v = (s ?? 'free').toLowerCase()
    const color = ['pro', 'professional'].includes(v) ? 'mint' : ['business', 'enterprise'].includes(v) ? 'peach' : ['starter', 'active'].includes(v) ? 'sky' : ''
    return <span className={`tag ${color}`} style={{ textTransform: 'capitalize' }}>{v || 'free'}</span>
  }
  const statusTag = (s: string) => {
    const color = s === 'completed' ? 'mint' : s === 'failed' ? 'rose' : 'peach'
    return <span className={`tag ${color}`} style={{ textTransform: 'capitalize' }}>{s}</span>
  }

  return (
    <div>
      <div className="page-head"><div><h1>Admin</h1></div></div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setSearch(''); setFilter('') }}
            className={`btn btn-sm ${tab === t.id ? 'btn-primary' : 'btn-soft'}`}>{t.label}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
        <Link href="/admin/campaigns" className="btn btn-sm btn-soft" style={{ textDecoration: 'none' }}>Campaigns</Link>
        <Link href="/admin/bulk" className="btn btn-sm btn-soft" style={{ textDecoration: 'none' }}>Bulk Generate</Link>
        <Link href="/admin/help" className="btn btn-sm btn-soft" style={{ textDecoration: 'none' }}>Help Articles</Link>
      </div>

      {tab === 'dashboard' && (
        <div>
          <div className="stats-row">
            <div className="stat-card mint"><div className="stat-label">Total Users</div><div className="stat-value">{totalUsers}</div></div>
            <div className="stat-card"><div className="stat-label">Active Subscribers</div><div className="stat-value">{activeSubs}</div></div>
            <div className="stat-card peach"><div className="stat-label">Est. MRR</div><div className="stat-value">${mrr.toLocaleString()}</div></div>
            <div className="stat-card"><div className="stat-label">This Week</div><div className="stat-value">{thisWeek} videos</div></div>
          </div>
          <div className="stats-row">
            <div className="stat-card"><div className="stat-label">Total Videos</div><div className="stat-value">{totalVideos}</div></div>
            <div className="stat-card mint"><div className="stat-label">Completed</div><div className="stat-value">{completedVideos}</div></div>
            <div className="stat-card" style={failedVideos > 0 ? { background: 'var(--rose)' } : undefined}>
              <div className="stat-label">Failed</div><div className="stat-value">{failedVideos}</div>
            </div>
            <VpsStatus />
          </div>

          <div className="settings-card" style={{ marginTop: 24 }}>
            <h3>Recent Signups</h3>
            <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, overflow: 'hidden', marginTop: 12 }}>
              {profiles.slice(0, 10).map((p, i) => (
                <div key={p.id} className="activity-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: i < 9 ? '1px solid var(--border-light)' : 'none', fontSize: 13 }}>
                  <div style={{ flex: 1, fontWeight: 600 }}>
                    <Link href={`/admin/users/${p.id}`} style={{ color: 'var(--ink)', textDecoration: 'none' }}>{p.email}</Link>
                  </div>
                  <div style={{ width: 120 }}>{p.full_name ?? '—'}</div>
                  <div style={{ width: 80 }}>{planTag(p.subscription_status)}</div>
                  <div style={{ width: 100, color: 'var(--ink-light)', textAlign: 'right' }}>{fmt(p.created_at)}</div>
                </div>
              ))}
              {profiles.length === 0 && <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-light)' }}>No users yet</div>}
            </div>
          </div>

          <div className="settings-card" style={{ marginTop: 16 }}>
            <h3>Recent Videos</h3>
            <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, overflow: 'hidden', marginTop: 12 }}>
              {videos.slice(0, 10).map((v, i) => (
                <div key={v.id} className="activity-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: i < 9 ? '1px solid var(--border-light)' : 'none', fontSize: 13 }}>
                  <div style={{ flex: 1, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title ?? 'Untitled'}</div>
                  <div style={{ width: 160, color: 'var(--ink-light)' }}>{userEmail(v.user_id)}</div>
                  <div style={{ width: 80 }}>{statusTag(v.status)}</div>
                  <div style={{ width: 60 }}>
                    {v.status === 'completed' && (
                      <a href={`/watch/${v.id}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--primary)' }}>Watch</a>
                    )}
                  </div>
                  <div style={{ width: 100, color: 'var(--ink-light)', textAlign: 'right' }}>{fmt(v.created_at)}</div>
                </div>
              ))}
              {videos.length === 0 && <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-light)' }}>No videos yet</div>}
            </div>
          </div>

          {dailyActivity.length > 0 && (
            <div className="settings-card" style={{ marginTop: 16 }}>
              <h3>Usage Trends (Last 30 Days)</h3>
              <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, overflow: 'hidden', marginTop: 12, maxHeight: 400, overflowY: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-soft)', fontSize: 12, fontWeight: 700, color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: '0.05em', position: 'sticky', top: 0 }}>
                  <div style={{ flex: 1 }}>Date</div>
                  <div style={{ width: 100, textAlign: 'center' }}>New Users</div>
                  <div style={{ width: 100, textAlign: 'center' }}>New Videos</div>
                </div>
                {dailyActivity.map((day, i) => (
                  <div key={day.date} className="activity-row" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderBottom: i < dailyActivity.length - 1 ? '1px solid var(--border-light)' : 'none', fontSize: 13 }}>
                    <div style={{ flex: 1, color: 'var(--ink-light)' }}>{day.date}</div>
                    <div style={{ width: 100, textAlign: 'center', fontWeight: day.users > 0 ? 600 : 400, color: day.users > 0 ? 'var(--ink)' : 'var(--ink-light)' }}>{day.users}</div>
                    <div style={{ width: 100, textAlign: 'center', fontWeight: day.videos > 0 ? 600 : 400, color: day.videos > 0 ? 'var(--ink)' : 'var(--ink-light)' }}>{day.videos}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'users' && (
        <div>
          <input className="input" placeholder="Search users by email or name..." value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom: 16, maxWidth: 400 }} />
          <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-soft)', fontSize: 12, fontWeight: 700, color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <div style={{ flex: 1 }}>Email</div>
              <div style={{ width: 120 }}>Name</div>
              <div style={{ width: 80 }}>Plan</div>
              <div style={{ width: 60 }}>Credits</div>
              <div style={{ width: 50 }}>Flags</div>
              <div style={{ width: 200 }}>Actions</div>
            </div>
            {filteredUsers.slice(0, 50).map((p, i) => (
              <div key={p.id} className="activity-row" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: i < Math.min(filteredUsers.length, 50) - 1 ? '1px solid var(--border-light)' : 'none', fontSize: 13 }}>
                <div style={{ flex: 1, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <Link href={`/admin/users/${p.id}`} style={{ color: 'var(--ink)', textDecoration: 'none' }}>{p.email}</Link>
                </div>
                <div style={{ width: 120, color: 'var(--ink-light)' }}>{p.full_name ?? '—'}</div>
                <div style={{ width: 80 }}>{planTag(p.subscription_status)}</div>
                <div style={{ width: 60 }}>{p.credits_remaining ?? 0}</div>
                <div style={{ width: 50, fontSize: 11 }}>
                  {p.is_admin && <span className="tag mint" style={{ fontSize: 10 }}>A</span>}
                  {p.is_beta && <span className="tag sky" style={{ fontSize: 10 }}>B</span>}
                </div>
                <div style={{ width: 200, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <select disabled={busy === p.id} defaultValue=""
                    onChange={e => { if (e.target.value) userAction(p.id, 'change_plan', e.target.value); e.target.value = '' }}
                    style={{ fontSize: 11, padding: '3px 6px', borderRadius: 6, border: '1px solid var(--border)', background: 'white' }}>
                    <option value="" disabled>Plan</option>
                    <option value="free">Free</option>
                    <option value="starter">Starter</option>
                    <option value="pro">Pro</option>
                    <option value="business">Business</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                  <button className="btn btn-sm btn-soft" style={{ fontSize: 11, padding: '3px 8px' }} disabled={busy === p.id}
                    onClick={() => userAction(p.id, 'add_credits', 10)}>+10</button>
                  <button className="btn btn-sm btn-soft" style={{ fontSize: 11, padding: '3px 8px' }} disabled={busy === p.id}
                    onClick={() => userAction(p.id, 'add_credits', 100)}>+100</button>
                </div>
              </div>
            ))}
            {filteredUsers.length === 0 && <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-light)' }}>No users found</div>}
          </div>
        </div>
      )}

      {tab === 'videos' && (
        <div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            {['', 'completed', 'failed', 'processing', 'pending', 'scripting', 'assembling'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-soft'}`}>{f || 'All'}</button>
            ))}
          </div>
          <input className="input" placeholder="Search by title..." value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom: 16, maxWidth: 400 }} />
          <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-soft)', fontSize: 12, fontWeight: 700, color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <div style={{ flex: 1 }}>Title</div>
              <div style={{ width: 160 }}>User</div>
              <div style={{ width: 90 }}>Status</div>
              <div style={{ width: 50, textAlign: 'center' }}>Views</div>
              <div style={{ width: 50, textAlign: 'center' }}>Plays</div>
              <div style={{ width: 100 }}>Date</div>
              <div style={{ width: 100 }}>Actions</div>
            </div>
            {filteredVideos.slice(0, 50).map((v, i) => (
              <div key={v.id} className="activity-row" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: i < Math.min(filteredVideos.length, 50) - 1 ? '1px solid var(--border-light)' : 'none', fontSize: 13 }}>
                <div style={{ flex: 1, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title ?? 'Untitled'}</div>
                <div style={{ width: 160, color: 'var(--ink-light)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail(v.user_id)}</div>
                <div style={{ width: 90 }}>{statusTag(v.status)}</div>
                <div style={{ width: 50, textAlign: 'center', color: 'var(--ink-light)' }}>{videoAnalytics[v.id]?.views ?? 0}</div>
                <div style={{ width: 50, textAlign: 'center', color: 'var(--ink-light)' }}>{videoAnalytics[v.id]?.plays ?? 0}</div>
                <div style={{ width: 100, color: 'var(--ink-light)' }}>{fmt(v.created_at)}</div>
                <div style={{ width: 100, display: 'flex', gap: 4 }}>
                  {v.status === 'completed' && (
                    <a href={`/watch/${v.id}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-soft" style={{ fontSize: 11, padding: '3px 8px', textDecoration: 'none' }}>Watch</a>
                  )}
                  {v.status === 'failed' && (
                    <button className="btn btn-sm btn-soft" style={{ fontSize: 11, padding: '3px 8px' }}
                      disabled={busy === v.id} onClick={() => retryVideo(v.id)}>
                      {busy === v.id ? '...' : 'Retry'}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {filteredVideos.length === 0 && <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-light)' }}>No videos found</div>}
          </div>
        </div>
      )}

      {tab === 'billing' && (
        <div>
          <div className="stats-row">
            <div className="stat-card mint"><div className="stat-label">Estimated MRR</div><div className="stat-value">${mrr.toLocaleString()}</div></div>
            <div className="stat-card"><div className="stat-label">Cards on File</div><div className="stat-value">{profiles.filter(p => p.card_on_file).length}</div></div>
            <div className="stat-card peach"><div className="stat-label">This Week</div><div className="stat-value">{thisWeek} videos</div></div>
          </div>
          <div className="settings-card" style={{ marginTop: 24 }}>
            <h3>Plan Distribution</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginTop: 16 }}>
              {['free', 'starter', 'pro', 'business', 'enterprise'].map(plan => {
                const count = plan === 'free'
                  ? profiles.filter(p => !p.subscription_status || ['free', 'trial', 'cancelled', 'expired'].includes((p.subscription_status ?? '').toLowerCase())).length
                  : profiles.filter(p => {
                      const s = (p.subscription_status ?? '').toLowerCase()
                      if (plan === 'starter') return ['starter', 'active'].includes(s)
                      if (plan === 'pro') return ['pro', 'professional'].includes(s)
                      if (plan === 'enterprise') return ['enterprise', 'enterprise-plus', 'enterprise_plus'].includes(s)
                      return s === plan
                    }).length
                return (
                  <div key={plan} style={{ background: 'var(--bg-soft)', borderRadius: 10, padding: 16, textAlign: 'center' }}>
                    <div style={{ fontSize: 28, fontWeight: 800 }}>{count}</div>
                    <div style={{ fontSize: 13, color: 'var(--ink-soft)', textTransform: 'capitalize' }}>{plan}</div>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="settings-card" style={{ marginTop: 16 }}>
            <h3>Revenue</h3>
            <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 12 }}>View full revenue data in Stripe Dashboard for accurate transaction history, refunds, and detailed analytics.</p>
            <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer" className="btn btn-primary">Open Stripe Dashboard</a>
          </div>
        </div>
      )}

      {tab === 'access' && (
        <div>
          {/* Create User */}
          <div className="settings-card" style={{ marginBottom: 16 }}>
            <h3>Create New User</h3>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 12 }}>Set up an account for a client or team member and assign a plan.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label className="input-label">Email *</label>
                <input id="new-user-email" className="input" placeholder="user@company.com" />
              </div>
              <div>
                <label className="input-label">Full Name</label>
                <input id="new-user-name" className="input" placeholder="Jane Smith" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label className="input-label">Company</label>
                <input id="new-user-company" className="input" placeholder="Acme Inc." />
              </div>
              <div>
                <label className="input-label">Plan</label>
                <select id="new-user-plan" className="input" defaultValue="trial" style={{ appearance: 'auto' }}>
                  <option value="trial">Free Trial</option>
                  <option value="starter">Starter</option>
                  <option value="pro">Pro</option>
                  <option value="business">Business</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div>
                <label className="input-label">Password (optional)</label>
                <input id="new-user-password" className="input" placeholder="Auto-generated if empty" type="text" />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" id="new-user-beta" style={{ accentColor: 'var(--ink)' }} /> Beta user (unlimited)
              </label>
            </div>
            <button
              className="btn btn-primary"
              onClick={async () => {
                const email = (document.getElementById('new-user-email') as HTMLInputElement).value
                const fullName = (document.getElementById('new-user-name') as HTMLInputElement).value
                const companyName = (document.getElementById('new-user-company') as HTMLInputElement).value
                const plan = (document.getElementById('new-user-plan') as HTMLSelectElement).value
                const password = (document.getElementById('new-user-password') as HTMLInputElement).value
                const isBeta = (document.getElementById('new-user-beta') as HTMLInputElement).checked
                if (!email) { alert('Email is required'); return }
                setBusy('creating')
                try {
                  const r = await fetch('/api/admin/create-user', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, fullName, companyName, plan, password: password || undefined, isBeta }),
                  })
                  const d = await r.json()
                  if (!r.ok) throw new Error(d.error)
                  let msg = `User created: ${email}`
                  if (d.tempPassword) msg += `\nTemporary password: ${d.tempPassword}`
                  alert(msg)
                  // Clear fields
                  ;(document.getElementById('new-user-email') as HTMLInputElement).value = ''
                  ;(document.getElementById('new-user-name') as HTMLInputElement).value = ''
                  ;(document.getElementById('new-user-company') as HTMLInputElement).value = ''
                  ;(document.getElementById('new-user-password') as HTMLInputElement).value = ''
                  ;(document.getElementById('new-user-beta') as HTMLInputElement).checked = false
                  // Refresh data
                  const res = await fetch('/api/admin/data')
                  const data = await res.json()
                  setProfiles(data.profiles ?? [])
                } catch (err) {
                  alert(err instanceof Error ? err.message : 'Failed to create user')
                }
                setBusy(null)
              }}
              disabled={busy === 'creating'}
            >
              {busy === 'creating' ? 'Creating...' : 'Create User'}
            </button>
          </div>

          <div className="settings-card" style={{ marginBottom: 16 }}>
            <h3>Search Users to Grant Access</h3>
            <input
              className="input"
              placeholder="Search by email to grant admin or beta access..."
              value={accessSearch}
              onChange={e => setAccessSearch(e.target.value)}
              style={{ marginTop: 12, maxWidth: 400 }}
            />
            {accessSearchResults.length > 0 && (
              <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, overflow: 'hidden', marginTop: 12 }}>
                {accessSearchResults.map((p, i) => (
                  <div key={p.id} className="activity-row" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: i < accessSearchResults.length - 1 ? '1px solid var(--border-light)' : 'none', fontSize: 13 }}>
                    <div style={{ flex: 1, fontWeight: 600 }}>{p.email}</div>
                    <div style={{ width: 100 }}>{p.full_name ?? '—'}</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className={`btn btn-sm ${p.is_admin ? 'btn-primary' : 'btn-soft'}`}
                        disabled={busy === p.id}
                        onClick={() => toggleAccess(p.id, 'is_admin', !p.is_admin)}
                        style={{ fontSize: 11 }}
                      >
                        {p.is_admin ? 'Remove Admin' : 'Make Admin'}
                      </button>
                      <button
                        className={`btn btn-sm ${p.is_beta ? 'btn-primary' : 'btn-soft'}`}
                        disabled={busy === p.id}
                        onClick={() => toggleAccess(p.id, 'is_beta', !p.is_beta)}
                        style={{ fontSize: 11 }}
                      >
                        {p.is_beta ? 'Remove Beta' : 'Make Beta'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="settings-card" style={{ marginBottom: 16 }}>
            <h3>Admin Users ({adminUsers.length})</h3>
            {adminUsers.length === 0 ? (
              <p style={{ color: 'var(--ink-light)', marginTop: 8 }}>No admin users</p>
            ) : (
              <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, overflow: 'hidden', marginTop: 12 }}>
                {adminUsers.map((p, i) => (
                  <div key={p.id} className="activity-row" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: i < adminUsers.length - 1 ? '1px solid var(--border-light)' : 'none', fontSize: 13 }}>
                    <div style={{ flex: 1, fontWeight: 600 }}>{p.email}</div>
                    <div style={{ width: 120 }}>{p.full_name ?? '—'}</div>
                    <button
                      className="btn btn-sm btn-soft"
                      disabled={busy === p.id}
                      onClick={() => toggleAccess(p.id, 'is_admin', false)}
                      style={{ fontSize: 11 }}
                    >
                      Remove Admin
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="settings-card">
            <h3>Beta Users ({betaUsers.length})</h3>
            {betaUsers.length === 0 ? (
              <p style={{ color: 'var(--ink-light)', marginTop: 8 }}>No beta users</p>
            ) : (
              <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, overflow: 'hidden', marginTop: 12 }}>
                {betaUsers.map((p, i) => (
                  <div key={p.id} className="activity-row" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: i < betaUsers.length - 1 ? '1px solid var(--border-light)' : 'none', fontSize: 13 }}>
                    <div style={{ flex: 1, fontWeight: 600 }}>{p.email}</div>
                    <div style={{ width: 120 }}>{p.full_name ?? '—'}</div>
                    <button
                      className="btn btn-sm btn-soft"
                      disabled={busy === p.id}
                      onClick={() => toggleAccess(p.id, 'is_beta', false)}
                      style={{ fontSize: 11 }}
                    >
                      Remove Beta
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'audit' && (() => {
        const now = Date.now()
        const filteredAudit = auditLog.filter(entry => {
          // Date filter
          if (auditDateFilter === '7') {
            if (new Date(entry.created_at).getTime() < now - 7 * 86400000) return false
          } else if (auditDateFilter === '30') {
            if (new Date(entry.created_at).getTime() < now - 30 * 86400000) return false
          }
          // Search filter
          if (auditSearch) {
            const q = auditSearch.toLowerCase()
            const adminEmail = userEmail(entry.admin_id).toLowerCase()
            const targetEmail = entry.target_user_id ? userEmail(entry.target_user_id).toLowerCase() : ''
            const action = entry.action.toLowerCase()
            if (!adminEmail.includes(q) && !targetEmail.includes(q) && !action.includes(q)) return false
          }
          return true
        })

        const exportCsv = () => {
          const header = 'Admin,Action,Target,Details,Time'
          const rows = filteredAudit.map(e =>
            [userEmail(e.admin_id), e.action, e.target_user_id ? userEmail(e.target_user_id) : '', e.details ? JSON.stringify(e.details).replace(/"/g, '""') : '', e.created_at]
              .map(v => `"${v}"`).join(',')
          )
          const csv = [header, ...rows].join('\n')
          const blob = new Blob([csv], { type: 'text/csv' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
          a.click()
          URL.revokeObjectURL(url)
        }

        return (
          <div>
            <div className="settings-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <h3>Admin Audit Log</h3>
                <button className="btn btn-sm btn-soft" onClick={exportCsv} style={{ fontSize: 12 }}>Export CSV</button>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {([['7', 'Last 7 days'], ['30', 'Last 30 days'], ['all', 'All time']] as const).map(([val, label]) => (
                    <button key={val} onClick={() => setAuditDateFilter(val)}
                      className={`btn btn-sm ${auditDateFilter === val ? 'btn-primary' : 'btn-soft'}`} style={{ fontSize: 12 }}>{label}</button>
                  ))}
                </div>
                <input className="input" placeholder="Search by email or action..." value={auditSearch} onChange={e => setAuditSearch(e.target.value)} style={{ maxWidth: 280, fontSize: 13 }} />
              </div>
              {filteredAudit.length === 0 ? (
                <p style={{ color: 'var(--ink-light)', marginTop: 12 }}>No audit log entries match your filters</p>
              ) : (
                <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, overflow: 'hidden', marginTop: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-soft)', fontSize: 12, fontWeight: 700, color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <div style={{ width: 160 }}>Admin</div>
                    <div style={{ width: 120 }}>Action</div>
                    <div style={{ flex: 1 }}>Target / Details</div>
                    <div style={{ width: 140 }}>Time</div>
                  </div>
                  {filteredAudit.map((entry, i) => (
                    <div key={entry.id} className="activity-row" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: i < filteredAudit.length - 1 ? '1px solid var(--border-light)' : 'none', fontSize: 13 }}>
                      <div style={{ width: 160, color: 'var(--ink-light)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail(entry.admin_id)}</div>
                      <div style={{ width: 120 }}><span className="tag">{entry.action}</span></div>
                      <div style={{ flex: 1, color: 'var(--ink-light)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.target_user_id ? userEmail(entry.target_user_id) : ''}
                        {entry.details ? ` ${JSON.stringify(entry.details)}` : ''}
                      </div>
                      <div style={{ width: 140, color: 'var(--ink-light)' }}>{fmtTime(entry.created_at)}</div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-light)' }}>Showing {filteredAudit.length} of {auditLog.length} entries</div>
            </div>
          </div>
        )
      })()}

      {tab === 'prospects' && (
        <div>
          <div className="settings-card" style={{ marginBottom: 16 }}>
            <h3>Generate Demo Videos</h3>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 12 }}>
              Paste company website URLs (one per line) to auto-extract their brand info and create demo video records.
            </p>
            <textarea
              className="input"
              placeholder={"https://example.com\nhttps://another-company.com"}
              value={prospectUrls}
              onChange={e => setProspectUrls(e.target.value)}
              rows={5}
              style={{ width: '100%', fontFamily: 'monospace', fontSize: 13, resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
              <button
                className="btn btn-primary"
                disabled={prospectBusy || !prospectUrls.trim()}
                onClick={async () => {
                  setProspectBusy(true)
                  setProspectResult(null)
                  try {
                    const urls = prospectUrls.split('\n').map(u => u.trim()).filter(Boolean)
                    const r = await fetch('/api/admin/auto-demo', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ urls }),
                    })
                    const d = await r.json()
                    if (!r.ok) throw new Error(d.error || 'Failed')
                    setProspectResult(d.results ?? [])
                    setProspectUrls('')
                    // Refresh demo list
                    fetch('/api/admin/auto-demo').then(r => r.json()).then(d => setProspectDemos(d.demos ?? [])).catch(() => {})
                  } catch (err) {
                    alert(err instanceof Error ? err.message : 'Failed to generate demos')
                  }
                  setProspectBusy(false)
                }}
              >
                {prospectBusy ? 'Processing...' : 'Generate Demo Videos'}
              </button>
              <button
                className="btn btn-sm btn-soft"
                onClick={() => {
                  fetch('/api/admin/auto-demo').then(r => r.json()).then(d => setProspectDemos(d.demos ?? [])).catch(() => {})
                }}
              >
                Refresh List
              </button>
            </div>

            {/* Progress indicator */}
            {prospectBusy && (
              <div style={{ marginTop: 16, padding: 20, background: 'var(--bg-soft, #f8f9fa)', borderRadius: 10, border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div className="spinner" />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Generating demo videos...</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>Scraping websites, extracting brands, creating video records. This may take 30-60 seconds per URL.</div>
                  </div>
                </div>
                <div style={{ height: 4, background: 'var(--border-light)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: 'var(--mint)', borderRadius: 4, animation: 'progressPulse 2s ease-in-out infinite', width: '60%' }} />
                </div>
                <style>{`@keyframes progressPulse { 0%, 100% { width: 20%; opacity: 0.7; } 50% { width: 80%; opacity: 1; } }`}</style>
              </div>
            )}
          </div>

          {prospectResult && (
            <div className="settings-card" style={{ marginBottom: 16 }}>
              <h3>Results</h3>
              <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, overflow: 'hidden', marginTop: 12 }}>
                {prospectResult.map((r, i) => (
                  <div key={i} className="activity-row" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: i < prospectResult.length - 1 ? '1px solid var(--border-light)' : 'none', fontSize: 13 }}>
                    <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 600 }}>{r.companyName ?? r.url}</span>
                      <span style={{ color: 'var(--ink-light)', marginLeft: 8, fontSize: 12 }}>{r.url}</span>
                    </div>
                    <div>
                      {r.error ? (
                        <span className="tag rose" style={{ fontSize: 11 }}>Failed</span>
                      ) : (
                        <span className="tag mint" style={{ fontSize: 11 }}>Created</span>
                      )}
                    </div>
                    {r.error && <div style={{ fontSize: 11, color: '#dc2626', maxWidth: 200 }}>{r.error}</div>}
                    {!r.error && r.videoId && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Link href={`/videos/${r.videoId}`} className="btn btn-sm btn-primary" style={{ fontSize: 11, padding: '3px 10px', textDecoration: 'none' }}>
                          Preview &amp; Generate
                        </Link>
                        <a href={`/watch/${r.videoId}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-soft" style={{ fontSize: 11, padding: '3px 10px', textDecoration: 'none' }}>
                          Share Page
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="settings-card">
            <h3>Demo Videos</h3>
            {prospectDemos.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-light)' }}>
                <p>No demo videos yet. Click &quot;Refresh List&quot; to load or generate some above.</p>
              </div>
            ) : (
              <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, overflow: 'hidden', marginTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-soft)', fontSize: 12, fontWeight: 700, color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <div style={{ flex: 1 }}>Company</div>
                  <div style={{ width: 90 }}>Status</div>
                  <div style={{ width: 100 }}>Date</div>
                  <div style={{ width: 80 }}>Actions</div>
                </div>
                {prospectDemos.map((d, i) => (
                  <div key={d.id} className="activity-row" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: i < prospectDemos.length - 1 ? '1px solid var(--border-light)' : 'none', fontSize: 13 }}>
                    <div style={{ flex: 1, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</div>
                    <div style={{ width: 90 }}>{statusTag(d.status)}</div>
                    <div style={{ width: 100, color: 'var(--ink-light)' }}>{fmt(d.created_at)}</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <Link href={`/videos/${d.id}`} className="btn btn-sm btn-soft" style={{ fontSize: 11, padding: '3px 8px', textDecoration: 'none' }}>
                        {d.status === 'pending' ? 'Generate' : d.status === 'completed' ? 'Edit' : 'View'}
                      </Link>
                      {d.status === 'completed' && (
                        <a href={`/watch/${d.id}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-mint" style={{ fontSize: 11, padding: '3px 8px', textDecoration: 'none' }}>Watch</a>
                      )}
                      {d.status === 'pending' && (
                        <span style={{ fontSize: 11, color: 'var(--ink-light)' }}>{d.progress_detail?.slice(0, 40) ?? 'Awaiting generation'}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function VpsStatus() {
  const [status, setStatus] = useState<'checking' | 'healthy' | 'degraded' | 'offline'>('checking')
  useEffect(() => {
    fetch('/api/admin/stats').then(r => r.json()).then(d => {
      setStatus(d.vpsStatus === 'healthy' ? 'healthy' : d.vpsStatus === 'degraded' ? 'degraded' : 'offline')
    }).catch(() => setStatus('offline'))
  }, [])
  const colors = { checking: 'var(--ink-light)', healthy: '#16a34a', degraded: '#f59e0b', offline: '#dc2626' }
  const labels = { checking: 'Checking...', healthy: 'VPS Online', degraded: 'VPS Degraded', offline: 'VPS Offline' }
  return (
    <div className="stat-card" style={status === 'offline' ? { background: 'var(--rose)' } : undefined}>
      <div className="stat-label">Video Server</div>
      <div className="stat-value" style={{ fontSize: 16, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: colors[status], display: 'inline-block' }} />
        {labels[status]}
      </div>
    </div>
  )
}
