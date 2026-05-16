'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import type { Profile, Video } from '@/app/_lib/types'

type Tab = 'dashboard' | 'users' | 'videos' | 'billing' | 'access' | 'audit'

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
        setState('ok')
      })
      .catch(e => { setError(e.message); setState('error') })
  }, [])

  function reload() {
    fetch('/api/admin/data').then(r => r.json()).then(d => {
      setProfiles(d.profiles ?? [])
      setVideos(d.videos ?? [])
      setAuditLog(d.auditLog ?? [])
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
  const activeSubs = profiles.filter(p => ['active', 'pro', 'professional', 'agency', 'starter', 'business'].includes((p.subscription_status ?? '').toLowerCase())).length
  const totalVideos = videos.length
  const completedVideos = videos.filter(v => v.status === 'completed').length
  const failedVideos = videos.filter(v => v.status === 'failed').length
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const thisWeek = videos.filter(v => v.created_at > weekAgo).length

  const planPrices: Record<string, number> = { starter: 19, pro: 49, professional: 49, active: 49, business: 99, agency: 149 }
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
  ]

  const userEmail = (userId: string) => profiles.find(p => p.id === userId)?.email ?? '—'
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const fmtTime = (d: string) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  const planTag = (s: string | null) => {
    const v = (s ?? 'free').toLowerCase()
    const color = ['pro', 'professional', 'active'].includes(v) ? 'mint' : ['agency', 'business'].includes(v) ? 'peach' : v === 'starter' ? 'sky' : ''
    return <span className={`tag ${color}`} style={{ textTransform: 'capitalize' }}>{v || 'free'}</span>
  }
  const statusTag = (s: string) => {
    const color = s === 'completed' ? 'mint' : s === 'failed' ? 'rose' : 'peach'
    return <span className={`tag ${color}`} style={{ textTransform: 'capitalize' }}>{s}</span>
  }

  return (
    <div>
      <div className="page-head"><div><h1>Admin</h1></div></div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setSearch(''); setFilter('') }}
            className={`btn btn-sm ${tab === t.id ? 'btn-primary' : 'btn-soft'}`}>{t.label}</button>
        ))}
      </div>

      {tab === 'dashboard' && (
        <div>
          <div className="stats-row">
            <div className="stat-card mint"><div className="stat-label">Total Users</div><div className="stat-value">{totalUsers}</div></div>
            <div className="stat-card"><div className="stat-label">Active Subscribers</div><div className="stat-value">{activeSubs}</div></div>
            <div className="stat-card peach"><div className="stat-label">Est. MRR</div><div className="stat-value">${mrr.toLocaleString()}</div></div>
          </div>
          <div className="stats-row">
            <div className="stat-card"><div className="stat-label">Total Videos</div><div className="stat-value">{totalVideos}</div></div>
            <div className="stat-card mint"><div className="stat-label">Completed</div><div className="stat-value">{completedVideos}</div></div>
            <div className="stat-card" style={failedVideos > 0 ? { background: 'var(--rose)' } : undefined}>
              <div className="stat-label">Failed</div><div className="stat-value">{failedVideos}</div></div>
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
                    <option value="agency">Agency</option>
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
              <div style={{ width: 100 }}>Date</div>
              <div style={{ width: 100 }}>Actions</div>
            </div>
            {filteredVideos.slice(0, 50).map((v, i) => (
              <div key={v.id} className="activity-row" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: i < Math.min(filteredVideos.length, 50) - 1 ? '1px solid var(--border-light)' : 'none', fontSize: 13 }}>
                <div style={{ flex: 1, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title ?? 'Untitled'}</div>
                <div style={{ width: 160, color: 'var(--ink-light)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail(v.user_id)}</div>
                <div style={{ width: 90 }}>{statusTag(v.status)}</div>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 16 }}>
              {['free', 'starter', 'pro', 'agency'].map(plan => {
                const count = plan === 'free'
                  ? profiles.filter(p => !p.subscription_status || ['free', 'trial', 'cancelled', 'expired'].includes((p.subscription_status ?? '').toLowerCase())).length
                  : profiles.filter(p => {
                      const s = (p.subscription_status ?? '').toLowerCase()
                      if (plan === 'pro') return ['pro', 'professional', 'active'].includes(s)
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

      {tab === 'audit' && (
        <div>
          <div className="settings-card">
            <h3>Recent Admin Actions</h3>
            {auditLog.length === 0 ? (
              <p style={{ color: 'var(--ink-light)', marginTop: 8 }}>No audit log entries yet</p>
            ) : (
              <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, overflow: 'hidden', marginTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-soft)', fontSize: 12, fontWeight: 700, color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <div style={{ width: 160 }}>Admin</div>
                  <div style={{ width: 120 }}>Action</div>
                  <div style={{ flex: 1 }}>Target / Details</div>
                  <div style={{ width: 140 }}>Time</div>
                </div>
                {auditLog.map((entry, i) => (
                  <div key={entry.id} className="activity-row" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: i < auditLog.length - 1 ? '1px solid var(--border-light)' : 'none', fontSize: 13 }}>
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
          </div>
        </div>
      )}
    </div>
  )
}
