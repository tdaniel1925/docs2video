'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import type { Profile, Video } from '@/app/_lib/types'

type Tab = 'dashboard' | 'users' | 'videos' | 'billing' | 'access' | 'audit' | 'prospects' | 'settings'

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
  const [settings, setSettings] = useState<Record<string, string | null>>({})
  const [filter, setFilter] = useState('')
  const [accessSearch, setAccessSearch] = useState('')
  const [videoPage, setVideoPage] = useState(0)
  const [videoAnalytics, setVideoAnalytics] = useState<Record<string, { views: number; plays: number }>>({})
  const [dailyActivity, setDailyActivity] = useState<{ date: string; users: number; videos: number }[]>([])
  const [auditDateFilter, setAuditDateFilter] = useState<'7' | '30' | 'all'>('30')
  const [auditSearch, setAuditSearch] = useState('')
  const [prospectUrls, setProspectUrls] = useState('')
  const [prospects, setProspects] = useState<any[]>([])
  const [generating, setGenerating] = useState(false)
  const [sendModal, setSendModal] = useState<{ prospectId: string; companyName: string; email: string; subject: string } | null>(null)
  const [sendForm, setSendForm] = useState({ email: '', name: '', subject: '', body: '' })
  const [sendBusy, setSendBusy] = useState(false)
  // Campaign system
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [campaignIndustry, setCampaignIndustry] = useState('insurance')
  const [campaignSubIndustry, setCampaignSubIndustry] = useState('')
  const [campaignName, setCampaignName] = useState('')
  const [campaignContacts, setCampaignContacts] = useState<{ email: string; name?: string; company?: string }[]>([])
  const [campaignCsvText, setCampaignCsvText] = useState('')
  const [campaignSubject, setCampaignSubject] = useState('')
  const [campaignBody, setCampaignBody] = useState('')
  const [campaignCtaText, setCampaignCtaText] = useState('Try It Free')
  const [campaignCtaUrl, setCampaignCtaUrl] = useState('')
  const [campaignGenerating, setCampaignGenerating] = useState(false)
  const [campaignSending, setCampaignSending] = useState(false)
  const [campaignStep, setCampaignStep] = useState<'setup' | 'preview' | 'done'>('setup')
  const [campaignBusy, setCampaignBusy] = useState<string | null>(null)

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
    fetch('/api/admin/prospect-pipeline').then(r => r.json()).then(d => {
      setProspects(d.prospects ?? [])
    }).catch(() => {})
    // Load campaigns
    fetch('/api/admin/campaign-send').then(r => r.json()).then(d => {
      setCampaigns(d.campaigns ?? [])
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

  function reloadCampaigns() {
    fetch('/api/admin/campaign-send').then(r => r.json()).then(d => {
      setCampaigns(d.campaigns ?? [])
    }).catch(() => {})
  }

  async function campaignAction(campaignId: string, action: string) {
    setCampaignBusy(campaignId)
    try {
      const r = await fetch('/api/admin/campaign-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, campaignId }),
      })
      if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error || 'Failed'); }
      reloadCampaigns()
    } catch { alert('Network error') }
    setCampaignBusy(null)
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

  async function impersonate(userId: string, email: string) {
    if (!confirm(`Impersonate ${email}? You'll be logged in as them. Use 'Exit impersonation' to return.`)) return
    setBusy(userId)
    try {
      const r = await fetch('/api/admin/impersonate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', userId }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.actionLink) { alert(d.error || 'Could not impersonate'); setBusy(null); return }
      window.location.href = d.actionLink
    } catch { alert('Network error'); setBusy(null) }
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

  // --- App settings / feature flags (DB-backed, toggle without redeploy) ---
  async function loadSettings() {
    try {
      const r = await fetch('/api/admin/settings')
      if (r.ok) setSettings(await r.json())
    } catch { /* non-fatal */ }
  }
  async function saveSetting(key: string, value: boolean | string) {
    setBusy(key)
    setSettings(s => ({ ...s, [key]: String(value) })) // optimistic
    try {
      const r = await fetch('/api/admin/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      })
      if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error || 'Failed'); loadSettings() }
    } catch { alert('Network error'); loadSettings() }
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
    { id: 'settings', label: 'Settings' },
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
          <button key={t.id} onClick={() => { setTab(t.id); setSearch(''); setFilter(''); if (t.id === 'settings') loadSettings() }}
            className={`btn btn-sm ${tab === t.id ? 'btn-primary' : 'btn-soft'}`}>{t.label}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
        <Link href="/admin/costs" className="btn btn-sm btn-soft" style={{ textDecoration: 'none' }}>API Costs</Link>
        <Link href="/admin/revenue" className="btn btn-sm btn-soft" style={{ textDecoration: 'none' }}>Revenue</Link>
        <Link href="/admin/campaigns" className="btn btn-sm btn-soft" style={{ textDecoration: 'none' }}>Campaigns</Link>
        <Link href="/admin/bulk" className="btn btn-sm btn-soft" style={{ textDecoration: 'none' }}>Bulk Generate</Link>
        <Link href="/admin/api-keys" className="btn btn-sm btn-soft" style={{ textDecoration: 'none' }}>API Keys</Link>
        <Link href="/admin/affiliates" className="btn btn-sm btn-soft" style={{ textDecoration: 'none' }}>Affiliates</Link>
        <Link href="/admin/help" className="btn btn-sm btn-soft" style={{ textDecoration: 'none' }}>Help Articles</Link>
        <Link href="/admin/system" className="btn btn-sm btn-soft" style={{ textDecoration: 'none' }}>System Status</Link>
        <Link href="/admin/logs" className="btn btn-sm btn-soft" style={{ textDecoration: 'none' }}>Logs</Link>
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
              {videos.slice(videoPage * 10, videoPage * 10 + 10).map((v, i, arr) => (
                <div key={v.id} className="activity-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: i < arr.length - 1 ? '1px solid var(--border-light)' : 'none', fontSize: 13 }}>
                  <div style={{ flex: 1, minWidth: 0, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title ?? 'Untitled'}</div>
                  <div style={{ width: 180, flexShrink: 0, color: 'var(--ink-light)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={userEmail(v.user_id)}>{userEmail(v.user_id)}</div>
                  <div style={{ width: 90, flexShrink: 0 }}>{statusTag(v.status)}</div>
                  <div style={{ width: 50, flexShrink: 0 }}>
                    {v.status === 'completed' && (
                      <a href={`/watch/${v.id}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--primary)' }}>Watch</a>
                    )}
                  </div>
                  <div style={{ width: 100, flexShrink: 0, color: 'var(--ink-light)', textAlign: 'right' }}>{fmt(v.created_at)}</div>
                </div>
              ))}
              {videos.length === 0 && <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-light)' }}>No videos yet</div>}
            </div>
            {videos.length > 10 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, fontSize: 13 }}>
                <button className="btn btn-sm btn-soft" disabled={videoPage === 0} onClick={() => setVideoPage(p => Math.max(0, p - 1))}>← Prev</button>
                <span style={{ color: 'var(--ink-light)' }}>
                  Page {videoPage + 1} of {Math.ceil(videos.length / 10)} · {videos.length} videos
                </span>
                <button className="btn btn-sm btn-soft" disabled={(videoPage + 1) * 10 >= videos.length} onClick={() => setVideoPage(p => p + 1)}>Next →</button>
              </div>
            )}
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
              <div style={{ width: 260 }}>Actions</div>
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
                <div style={{ width: 260, flexShrink: 0, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
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
                  {!p.is_admin && (
                    <button className="btn btn-sm btn-soft" style={{ fontSize: 11, padding: '3px 8px' }} disabled={busy === p.id}
                      onClick={() => impersonate(p.id, p.email)} title="Log in as this user to troubleshoot">Login as</button>
                  )}
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
          {/* Section 1: Generate New Demos */}
          <div className="settings-card" style={{ marginBottom: 16 }}>
            <h3>Generate New Demos</h3>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 12 }}>
              Paste prospect website URLs (one per line). Each URL will be scraped, branded, scripted, and turned into a 45-60 second sales video automatically.
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
                disabled={generating || !prospectUrls.trim()}
                onClick={async () => {
                  setGenerating(true)
                  try {
                    const urls = prospectUrls.split('\n').map(u => u.trim()).filter(Boolean)
                    for (const url of urls.slice(0, 10)) {
                      try {
                        await fetch('/api/admin/prospect-pipeline', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ url }),
                        })
                      } catch {}
                    }
                    setProspectUrls('')
                    // Refresh list
                    const r = await fetch('/api/admin/prospect-pipeline')
                    const d = await r.json()
                    setProspects(d.prospects ?? [])
                  } catch (err) {
                    alert(err instanceof Error ? err.message : 'Failed to generate demos')
                  }
                  setGenerating(false)
                }}
              >
                {generating ? 'Generating...' : 'Generate Demos'}
              </button>
              <button
                className="btn btn-sm btn-soft"
                onClick={async () => {
                  const r = await fetch('/api/admin/prospect-pipeline')
                  const d = await r.json()
                  setProspects(d.prospects ?? [])
                }}
              >
                Refresh
              </button>
            </div>

            {generating && (
              <div style={{ marginTop: 16, padding: 20, background: 'var(--bg-soft, #f8f9fa)', borderRadius: 10, border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div className="spinner" />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Pipeline running...</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>Scraping, scripting, generating slides, assembling video. This takes 2-5 minutes per URL.</div>
                  </div>
                </div>
                <div style={{ height: 4, background: 'var(--border-light)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: 'var(--mint)', borderRadius: 4, animation: 'progressPulse 2s ease-in-out infinite', width: '60%' }} />
                </div>
                <style>{`@keyframes progressPulse { 0%, 100% { width: 20%; opacity: 0.7; } 50% { width: 80%; opacity: 1; } }`}</style>
              </div>
            )}
          </div>

          {/* Section 2: Review Queue */}
          {prospects.filter(p => p.status === 'ready_for_review').length > 0 && (
            <div className="settings-card" style={{ marginBottom: 16 }}>
              <h3>Review Queue</h3>
              <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, overflow: 'hidden', marginTop: 12 }}>
                {prospects.filter(p => p.status === 'ready_for_review').map((p, i, arr) => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: i < arr.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                    {p.thumbnail_url && (
                      <img src={p.thumbnail_url} alt="" style={{ width: 120, height: 68, objectFit: 'cover', borderRadius: 6 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{p.company_name ?? 'Unknown'}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: 2 }}>{p.url}</div>
                      {p.duration && <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>{p.duration}s</div>}
                    </div>
                    {p.video_url && (
                      <a href={p.video_url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-soft" style={{ fontSize: 11, textDecoration: 'none' }}>Play</a>
                    )}
                    <button
                      className="btn btn-sm btn-primary"
                      style={{ fontSize: 11 }}
                      onClick={() => {
                        setSendModal({ prospectId: p.id, companyName: p.company_name ?? '', email: p.contact_email ?? '', subject: `${p.company_name ?? 'Your company'} + Docs2Video — personalized demo` })
                        setSendForm({ email: p.contact_email ?? '', name: p.contact_name ?? '', subject: `${p.company_name ?? 'Your company'} + Docs2Video — personalized demo`, body: '' })
                      }}
                    >
                      Approve &amp; Send
                    </button>
                    <button
                      className="btn btn-sm btn-soft"
                      style={{ fontSize: 11 }}
                      onClick={async () => {
                        await fetch('/api/admin/prospect-pipeline', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: p.url }) })
                        const r = await fetch('/api/admin/prospect-pipeline')
                        const d = await r.json()
                        setProspects(d.prospects ?? [])
                      }}
                    >
                      Regenerate
                    </button>
                    <button
                      className="btn btn-sm"
                      style={{ fontSize: 11, color: '#dc2626', border: '1px solid #fecaca' }}
                      onClick={async () => {
                        // Mark as rejected (simple inline update)
                        await fetch('/api/admin/prospect-pipeline', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: '__reject__', prospectId: p.id }) }).catch(() => {})
                        setProspects(prev => prev.map(x => x.id === p.id ? { ...x, status: 'rejected' } : x))
                      }}
                    >
                      Reject
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Send Modal */}
          {sendModal && (
            <div className="settings-card" style={{ marginBottom: 16, border: '2px solid var(--mint)' }}>
              <h3>Send to {sendModal.companyName}</h3>
              <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-light)' }}>Contact Email *</label>
                  <input className="input" value={sendForm.email} onChange={e => setSendForm(f => ({ ...f, email: e.target.value }))} placeholder="contact@company.com" style={{ width: '100%', marginTop: 4 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-light)' }}>Contact Name</label>
                  <input className="input" value={sendForm.name} onChange={e => setSendForm(f => ({ ...f, name: e.target.value }))} placeholder="John Smith" style={{ width: '100%', marginTop: 4 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-light)' }}>Subject *</label>
                  <input className="input" value={sendForm.subject} onChange={e => setSendForm(f => ({ ...f, subject: e.target.value }))} style={{ width: '100%', marginTop: 4 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-light)' }}>Custom Message (optional)</label>
                  <textarea className="input" value={sendForm.body} onChange={e => setSendForm(f => ({ ...f, body: e.target.value }))} rows={3} placeholder="Leave blank for auto-generated message" style={{ width: '100%', marginTop: 4, resize: 'vertical' }} />
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button
                    className="btn btn-primary"
                    disabled={sendBusy || !sendForm.email || !sendForm.subject}
                    onClick={async () => {
                      setSendBusy(true)
                      try {
                        const r = await fetch('/api/admin/prospect-send', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            prospectId: sendModal.prospectId,
                            contactEmail: sendForm.email,
                            contactName: sendForm.name || undefined,
                            subject: sendForm.subject,
                            body: sendForm.body || undefined,
                          }),
                        })
                        const d = await r.json()
                        if (!r.ok) throw new Error(d.error || 'Failed to send')
                        setSendModal(null)
                        // Refresh
                        const rr = await fetch('/api/admin/prospect-pipeline')
                        const dd = await rr.json()
                        setProspects(dd.prospects ?? [])
                      } catch (err) {
                        alert(err instanceof Error ? err.message : 'Send failed')
                      }
                      setSendBusy(false)
                    }}
                  >
                    {sendBusy ? 'Sending...' : 'Send Email'}
                  </button>
                  <button className="btn btn-soft" onClick={() => setSendModal(null)}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          {/* Section 3: Sent */}
          {prospects.filter(p => ['sent', 'watched', 'converted'].includes(p.status)).length > 0 && (
            <div className="settings-card" style={{ marginBottom: 16 }}>
              <h3>Sent</h3>
              <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, overflow: 'hidden', marginTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-soft)', fontSize: 12, fontWeight: 700, color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <div style={{ flex: 1 }}>Company</div>
                  <div style={{ width: 160 }}>Contact</div>
                  <div style={{ width: 100 }}>Sent</div>
                  <div style={{ width: 100 }}>Status</div>
                </div>
                {prospects.filter(p => ['sent', 'watched', 'converted'].includes(p.status)).map((p, i, arr) => (
                  <div key={p.id} className="activity-row" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: i < arr.length - 1 ? '1px solid var(--border-light)' : 'none', fontSize: 13 }}>
                    <div style={{ flex: 1, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.company_name ?? 'Unknown'}</div>
                    <div style={{ width: 160, fontSize: 12, color: 'var(--ink-light)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.contact_email ?? '—'}</div>
                    <div style={{ width: 100, fontSize: 12, color: 'var(--ink-light)' }}>{p.email_sent_at ? fmt(p.email_sent_at) : '—'}</div>
                    <div style={{ width: 100 }}>
                      {p.status === 'sent' && <span className="tag peach" style={{ fontSize: 11 }}>Sent</span>}
                      {p.status === 'watched' && <span className="tag mint" style={{ fontSize: 11 }}>Watched</span>}
                      {p.status === 'converted' && <span className="tag" style={{ fontSize: 11, background: '#fef3c7', color: '#92400e' }}>Converted</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 4: Failed/Rejected */}
          {prospects.filter(p => ['failed', 'rejected'].includes(p.status)).length > 0 && (
            <div className="settings-card" style={{ marginBottom: 16 }}>
              <h3>Failed / Rejected</h3>
              <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, overflow: 'hidden', marginTop: 12 }}>
                {prospects.filter(p => ['failed', 'rejected'].includes(p.status)).map((p, i, arr) => (
                  <div key={p.id} className="activity-row" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: i < arr.length - 1 ? '1px solid var(--border-light)' : 'none', fontSize: 13 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600 }}>{p.company_name ?? p.url}</div>
                      {p.error_message && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 2 }}>{p.error_message}</div>}
                      {p.review_notes && <div style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 2 }}>{p.review_notes}</div>}
                    </div>
                    <span className={`tag ${p.status === 'failed' ? 'rose' : ''}`} style={{ fontSize: 11, textTransform: 'capitalize' }}>{p.status}</span>
                    <button
                      className="btn btn-sm btn-soft"
                      style={{ fontSize: 11 }}
                      onClick={async () => {
                        await fetch('/api/admin/prospect-pipeline', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: p.url }) })
                        const r = await fetch('/api/admin/prospect-pipeline')
                        const d = await r.json()
                        setProspects(d.prospects ?? [])
                      }}
                    >
                      Retry
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* In-progress */}
          {prospects.filter(p => ['queued', 'scraping', 'scripting', 'generating', 'assembling'].includes(p.status)).length > 0 && (
            <div className="settings-card" style={{ marginBottom: 16 }}>
              <h3>In Progress</h3>
              <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, overflow: 'hidden', marginTop: 12 }}>
                {prospects.filter(p => ['queued', 'scraping', 'scripting', 'generating', 'assembling'].includes(p.status)).map((p, i, arr) => (
                  <div key={p.id} className="activity-row" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: i < arr.length - 1 ? '1px solid var(--border-light)' : 'none', fontSize: 13 }}>
                    <div className="spinner" style={{ width: 14, height: 14 }} />
                    <div style={{ flex: 1, fontWeight: 600 }}>{p.company_name ?? p.url}</div>
                    <span className="tag peach" style={{ fontSize: 11, textTransform: 'capitalize' }}>{p.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Industry Campaign System */}
          <div className="settings-card" style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h3 style={{ marginBottom: 2 }}>Industry Email Campaigns</h3>
                <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0 }}>
                  Create targeted campaigns by industry. Upload CSV or paste contacts, AI generates copy, preview and send.
                </p>
              </div>
              <button className="btn btn-sm btn-soft" onClick={reloadCampaigns}>Refresh</button>
            </div>

            {campaignStep === 'setup' && (
              <div>
                {/* Campaign Name */}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-light)', display: 'block', marginBottom: 4 }}>Campaign Name</label>
                  <input className="input" value={campaignName} onChange={e => setCampaignName(e.target.value)} placeholder="e.g. Life Insurance Agents — May 2026" style={{ width: '100%', fontSize: 13 }} />
                </div>

                {/* Industry Selection */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-light)', display: 'block', marginBottom: 4 }}>Industry *</label>
                    <select className="input" value={campaignIndustry} onChange={e => setCampaignIndustry(e.target.value)} style={{ width: '100%' }}>
                      <option value="insurance">Insurance</option>
                      <option value="financial">Financial Services</option>
                      <option value="real_estate">Real Estate</option>
                      <option value="mortgage">Mortgage & Lending</option>
                      <option value="healthcare">Healthcare</option>
                      <option value="legal">Legal</option>
                      <option value="consulting">Consulting</option>
                      <option value="education">Education</option>
                      <option value="accounting">Accounting</option>
                      <option value="technology">Technology</option>
                      <option value="hr">HR & Recruiting</option>
                      <option value="sales">Sales</option>
                      <option value="general">General / Other</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-light)', display: 'block', marginBottom: 4 }}>Sub-vertical (optional)</label>
                    <input className="input" value={campaignSubIndustry} onChange={e => setCampaignSubIndustry(e.target.value)} placeholder="e.g. Life Insurance, P&C, Health" style={{ width: '100%' }} />
                  </div>
                </div>

                {/* Add Contacts — Manual + CSV */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-light)', display: 'block', marginBottom: 8 }}>Contacts</label>

                  {/* Manual add form */}
                  <div style={{ background: 'var(--bg-soft)', border: '1px solid var(--border-light)', borderRadius: 10, padding: 16, marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Add Individual Contact</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
                      <div>
                        <label style={{ fontSize: 11, color: 'var(--ink-light)', display: 'block', marginBottom: 2 }}>Email *</label>
                        <input id="manual-email" className="input" placeholder="email@company.com" style={{ width: '100%', fontSize: 12 }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: 'var(--ink-light)', display: 'block', marginBottom: 2 }}>Name</label>
                        <input id="manual-name" className="input" placeholder="John Smith" style={{ width: '100%', fontSize: 12 }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: 'var(--ink-light)', display: 'block', marginBottom: 2 }}>Company</label>
                        <input id="manual-company" className="input" placeholder="Acme Inc" style={{ width: '100%', fontSize: 12 }} />
                      </div>
                      <button className="btn btn-sm btn-primary" style={{ fontSize: 11, whiteSpace: 'nowrap' }} onClick={() => {
                        const emailEl = document.getElementById('manual-email') as HTMLInputElement
                        const nameEl = document.getElementById('manual-name') as HTMLInputElement
                        const companyEl = document.getElementById('manual-company') as HTMLInputElement
                        const email = emailEl?.value.trim()
                        if (!email || !email.includes('@')) { alert('Enter a valid email'); return }
                        const line = `${email}, ${nameEl?.value.trim() || ''}, ${companyEl?.value.trim() || ''}`
                        setCampaignCsvText(prev => prev ? `${prev}\n${line}` : line)
                        if (emailEl) emailEl.value = ''
                        if (nameEl) nameEl.value = ''
                        if (companyEl) companyEl.value = ''
                        emailEl?.focus()
                      }}>
                        + Add
                      </button>
                    </div>
                  </div>

                  {/* CSV upload or paste */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>Bulk Import</div>
                    <label className="btn btn-sm btn-soft" style={{ fontSize: 11, cursor: 'pointer', margin: 0 }}>
                      Upload CSV
                      <input type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={e => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        const reader = new FileReader()
                        reader.onload = (ev) => {
                          const text = ev.target?.result as string
                          if (text) setCampaignCsvText(prev => prev ? `${prev}\n${text}` : text)
                        }
                        reader.readAsText(file)
                        e.target.value = ''
                      }} />
                    </label>
                    {campaignCsvText.trim() && (
                      <button className="btn btn-sm" style={{ fontSize: 11, color: '#dc2626', border: '1px solid #fecaca' }} onClick={() => setCampaignCsvText('')}>
                        Clear All
                      </button>
                    )}
                  </div>
                  <textarea
                    className="input"
                    placeholder={"Paste CSV or type contacts (email, name, company — one per line):\njohn@acme.com, John Smith, Acme Insurance\njane@bigcorp.com, Jane Doe, BigCorp Financial\nor just emails:\nbob@example.com"}
                    value={campaignCsvText}
                    onChange={e => setCampaignCsvText(e.target.value)}
                    rows={6}
                    style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
                  />
                  {campaignCsvText.trim() && (
                    <div style={{ marginTop: 6, fontSize: 12, color: 'var(--ink-light)' }}>
                      {campaignCsvText.split('\n').filter(l => l.trim() && l.includes('@')).length} valid contacts
                    </div>
                  )}
                </div>

                {/* CTA URL override */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-light)', display: 'block', marginBottom: 4 }}>Landing Page URL (leave blank for industry page)</label>
                  <input className="input" value={campaignCtaUrl} onChange={e => setCampaignCtaUrl(e.target.value)} placeholder={`https://docs2video.com/industries/${campaignIndustry}`} style={{ width: '100%', fontSize: 13 }} />
                </div>

                <button
                  className="btn btn-primary"
                  disabled={campaignGenerating || !campaignCsvText.trim()}
                  onClick={async () => {
                    const lines = campaignCsvText.split('\n').map(l => l.trim()).filter(Boolean)
                    const startIdx = lines[0]?.toLowerCase().includes('email') ? 1 : 0
                    const parsed = lines.slice(startIdx).map(line => {
                      const parts = line.split(',').map(p => p.trim())
                      return { email: parts[0], name: parts[1] || '', company: parts[2] || '' }
                    }).filter(c => c.email && c.email.includes('@'))
                    if (!parsed.length) { alert('No valid contacts found.'); return }
                    setCampaignContacts(parsed)
                    setCampaignGenerating(true)
                    try {
                      const r = await fetch('/api/admin/campaign-send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'generate', industry: campaignIndustry, subIndustry: campaignSubIndustry || undefined }),
                      })
                      const d = await r.json()
                      if (!r.ok) { alert(d.error || 'Failed to generate copy'); return }
                      setCampaignSubject(d.subject)
                      setCampaignBody(d.body)
                      setCampaignCtaText(d.ctaText || 'Try It Free')
                      setCampaignStep('preview')
                    } catch (err) { alert(err instanceof Error ? err.message : 'Network error') }
                    setCampaignGenerating(false)
                  }}
                >
                  {campaignGenerating ? 'Generating email copy...' : `Generate Campaign for ${campaignCsvText.split('\n').filter(l => l.trim() && l.includes('@')).length} contacts`}
                </button>
              </div>
            )}

            {campaignStep === 'preview' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <span className="tag mint" style={{ fontSize: 11 }}>{campaignIndustry}</span>
                  {campaignSubIndustry && <span className="tag" style={{ fontSize: 11 }}>{campaignSubIndustry}</span>}
                  <span style={{ fontSize: 12, color: 'var(--ink-light)' }}>{campaignContacts.length} contacts</span>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-light)', display: 'block', marginBottom: 4 }}>Subject Line</label>
                  <input className="input" value={campaignSubject} onChange={e => setCampaignSubject(e.target.value)} style={{ width: '100%', fontSize: 13 }} />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-light)', display: 'block', marginBottom: 4 }}>Email Body (use &#123;&#123;name&#125;&#125; and &#123;&#123;company&#125;&#125;)</label>
                  <textarea className="input" value={campaignBody} onChange={e => setCampaignBody(e.target.value)} rows={8} style={{ width: '100%', fontSize: 13, resize: 'vertical' }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-light)', display: 'block', marginBottom: 4 }}>CTA Button Text</label>
                    <input className="input" value={campaignCtaText} onChange={e => setCampaignCtaText(e.target.value)} style={{ width: '100%', fontSize: 13 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-light)', display: 'block', marginBottom: 4 }}>Landing Page</label>
                    <input className="input" value={campaignCtaUrl || `https://docs2video.com/industries/${campaignIndustry}`} onChange={e => setCampaignCtaUrl(e.target.value)} style={{ width: '100%', fontSize: 13 }} />
                  </div>
                </div>

                {/* Preview */}
                <div style={{ background: '#F4F1EC', border: '1px solid var(--border-light)', borderRadius: 10, padding: 20, marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Preview (first contact)</div>
                  <div style={{ background: 'white', borderRadius: 8, padding: 20, border: '1px solid #e5e2dc' }}>
                    <div style={{ fontSize: 12, color: 'var(--ink-light)', marginBottom: 4 }}>
                      <strong>To:</strong> {campaignContacts[0]?.email} &nbsp; <strong>Subject:</strong> {campaignSubject.replace(/\{\{name\}\}/g, campaignContacts[0]?.name || 'there').replace(/\{\{company\}\}/g, campaignContacts[0]?.company || 'your company')}
                    </div>
                    <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-line', color: '#333', marginTop: 12 }}>
                      {campaignBody.replace(/\{\{name\}\}/g, campaignContacts[0]?.name || 'there').replace(/\{\{company\}\}/g, campaignContacts[0]?.company || 'your company')}
                    </div>
                    <div style={{ textAlign: 'center', marginTop: 16 }}>
                      <span style={{ display: 'inline-block', background: '#1a1a1a', color: 'white', padding: '10px 24px', borderRadius: 8, fontSize: 14, fontWeight: 700 }}>{campaignCtaText} →</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-soft" onClick={() => setCampaignStep('setup')}>Back</button>
                  <button className="btn btn-soft" disabled={campaignGenerating} onClick={async () => {
                    setCampaignGenerating(true)
                    try {
                      const r = await fetch('/api/admin/campaign-send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'generate', industry: campaignIndustry, subIndustry: campaignSubIndustry || undefined }) })
                      const d = await r.json()
                      if (r.ok) { setCampaignSubject(d.subject); setCampaignBody(d.body); setCampaignCtaText(d.ctaText || 'Try It Free') }
                    } catch {}
                    setCampaignGenerating(false)
                  }}>
                    {campaignGenerating ? 'Regenerating...' : 'Regenerate Copy'}
                  </button>
                  <button
                    className="btn btn-primary"
                    disabled={campaignSending}
                    onClick={async () => {
                      if (!confirm(`Create campaign and start sending to ${campaignContacts.length} contacts?`)) return
                      setCampaignSending(true)
                      try {
                        // Create the campaign in DB
                        const r = await fetch('/api/admin/campaign-send', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            action: 'create',
                            name: campaignName || `${campaignIndustry} Campaign`,
                            industry: campaignIndustry,
                            subIndustry: campaignSubIndustry || undefined,
                            subject: campaignSubject,
                            emailBody: campaignBody,
                            ctaText: campaignCtaText,
                            ctaUrl: campaignCtaUrl || `https://docs2video.com/industries/${campaignIndustry}`,
                            contacts: campaignContacts,
                          }),
                        })
                        const d = await r.json()
                        if (!r.ok) { alert(d.error || 'Failed to create campaign'); setCampaignSending(false); return }

                        // Start sending immediately
                        await fetch('/api/admin/campaign-send', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ action: 'send', campaignId: d.campaignId }),
                        })

                        reloadCampaigns()
                        setCampaignStep('done')
                      } catch (err) { alert(err instanceof Error ? err.message : 'Network error') }
                      setCampaignSending(false)
                    }}
                  >
                    {campaignSending ? 'Creating & Sending...' : `Send to ${campaignContacts.length} contacts`}
                  </button>
                </div>
              </div>
            )}

            {campaignStep === 'done' && (
              <div style={{ padding: 20, background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, textAlign: 'center' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(199,232,168,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--mint-darker)" strokeWidth="2.5" strokeLinecap="round"><path d="M5 13l4 4L19 7"/></svg>
                </div>
                <h4 style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>Campaign Created & Sending!</h4>
                <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 16 }}>Track progress below. You can pause or cancel at any time.</p>
                <button className="btn btn-soft" onClick={() => {
                  setCampaignStep('setup')
                  setCampaignCsvText('')
                  setCampaignContacts([])
                  setCampaignSubject('')
                  setCampaignBody('')
                  setCampaignName('')
                }}>
                  New Campaign
                </button>
              </div>
            )}
          </div>

          {/* Campaign History & Controls */}
          {campaigns.length > 0 && (
            <div className="settings-card" style={{ marginTop: 16 }}>
              <h3>Campaign History</h3>
              <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, overflow: 'hidden', marginTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-soft)', fontSize: 12, fontWeight: 700, color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <div style={{ flex: 1 }}>Campaign</div>
                  <div style={{ width: 100 }}>Industry</div>
                  <div style={{ width: 80, textAlign: 'center' }}>Sent</div>
                  <div style={{ width: 80, textAlign: 'center' }}>Pending</div>
                  <div style={{ width: 80, textAlign: 'center' }}>Failed</div>
                  <div style={{ width: 90 }}>Status</div>
                  <div style={{ width: 180 }}>Actions</div>
                </div>
                {campaigns.map((c: any, i: number) => {
                  const statusColors: Record<string, string> = { draft: '', sending: 'peach', paused: '', completed: 'mint', cancelled: 'rose' }
                  const pct = c.total_contacts > 0 ? Math.round(((c.stats?.sent ?? 0) / c.total_contacts) * 100) : 0
                  return (
                    <div key={c.id} className="activity-row" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: i < campaigns.length - 1 ? '1px solid var(--border-light)' : 'none', fontSize: 13 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 2 }}>
                          {fmt(c.created_at)} — {c.total_contacts} contacts
                        </div>
                        {c.status === 'sending' && (
                          <div style={{ marginTop: 4, height: 3, background: 'var(--border-light)', borderRadius: 3, overflow: 'hidden', width: '100%', maxWidth: 200 }}>
                            <div style={{ height: '100%', background: 'var(--mint)', borderRadius: 3, width: `${pct}%`, transition: 'width 0.3s' }} />
                          </div>
                        )}
                      </div>
                      <div style={{ width: 100 }}>
                        <span className="tag" style={{ fontSize: 10, textTransform: 'capitalize' }}>{(c.industry || '').replace('_', ' ')}</span>
                      </div>
                      <div style={{ width: 80, textAlign: 'center', fontWeight: 600, color: '#16a34a' }}>{c.stats?.sent ?? c.sent_count ?? 0}</div>
                      <div style={{ width: 80, textAlign: 'center', color: 'var(--ink-light)' }}>{c.stats?.pending ?? 0}</div>
                      <div style={{ width: 80, textAlign: 'center', color: (c.stats?.failed ?? 0) > 0 ? '#dc2626' : 'var(--ink-light)' }}>{c.stats?.failed ?? c.failed_count ?? 0}</div>
                      <div style={{ width: 90 }}>
                        <span className={`tag ${statusColors[c.status] || ''}`} style={{ fontSize: 10, textTransform: 'capitalize' }}>{c.status}</span>
                      </div>
                      <div style={{ width: 180, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {(c.status === 'draft' || c.status === 'paused') && (
                          <button className="btn btn-sm btn-primary" style={{ fontSize: 10 }} disabled={campaignBusy === c.id}
                            onClick={() => campaignAction(c.id, c.status === 'draft' ? 'send' : 'resume')}>
                            {campaignBusy === c.id ? '...' : c.status === 'draft' ? 'Start' : 'Resume'}
                          </button>
                        )}
                        {c.status === 'sending' && (
                          <button className="btn btn-sm btn-soft" style={{ fontSize: 10 }} disabled={campaignBusy === c.id}
                            onClick={() => campaignAction(c.id, 'pause')}>
                            {campaignBusy === c.id ? '...' : 'Pause'}
                          </button>
                        )}
                        {['draft', 'sending', 'paused'].includes(c.status) && (
                          <button className="btn btn-sm" style={{ fontSize: 10, color: '#dc2626', border: '1px solid #fecaca' }} disabled={campaignBusy === c.id}
                            onClick={() => { if (confirm('Cancel this campaign? Unsent contacts will be skipped.')) campaignAction(c.id, 'cancel') }}>
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'settings' && (
        <div className="card" style={{ padding: 20, maxWidth: 720 }}>
          <div className="section-title" style={{ marginBottom: 6 }}>Video Engine</div>
          <p style={{ fontSize: 13, color: 'var(--ink-light)', marginBottom: 18 }}>
            Controls how new videos are rendered. Takes effect immediately — no redeploy.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 16px', border: '1px solid var(--border)', borderRadius: 10 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>V3 cinematic / infographic engine</div>
              <div style={{ fontSize: 13, color: 'var(--ink-light)', marginTop: 2 }}>
                When ON, new videos render with the V3 Remotion engine (theme auto-selected by content + brand). When OFF, the current pipeline is used.
              </div>
            </div>
            <button
              className={`btn btn-sm ${settings.video_engine_v3 === 'true' ? 'btn-primary' : 'btn-soft'}`}
              disabled={busy === 'video_engine_v3'}
              onClick={() => saveSetting('video_engine_v3', settings.video_engine_v3 !== 'true')}
              style={{ minWidth: 64 }}
            >
              {busy === 'video_engine_v3' ? '…' : settings.video_engine_v3 === 'true' ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Render target: where V3 videos render */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 16px', border: '1px solid var(--border)', borderRadius: 10, marginTop: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>V3 render target</div>
              <div style={{ fontSize: 13, color: 'var(--ink-light)', marginTop: 2 }}>
                Where V3 videos render. <b>Auto</b> = Lambda if configured, else VPS. <b>Lambda</b> = fast cloud (needs AWS). <b>VPS</b> = the server (slower, no AWS limits).
              </div>
            </div>
            <select
              value={settings.video_render_target || 'auto'}
              disabled={busy === 'video_render_target'}
              onChange={(e) => saveSetting('video_render_target', e.target.value)}
              className="input"
              style={{ width: 130 }}
            >
              <option value="auto">Auto</option>
              <option value="lambda">Lambda</option>
              <option value="vps">VPS</option>
            </select>
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
