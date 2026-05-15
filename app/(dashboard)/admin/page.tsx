'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import type { Profile, Video } from '@/app/_lib/types'

type Tab = 'dashboard' | 'users' | 'videos' | 'content' | 'billing'
type SortDir = 'asc' | 'desc'
type VideoFilter = 'all' | 'completed' | 'failed' | 'processing'

const PLANS = ['free', 'starter', 'pro', 'agency'] as const
const ACTIVE_STATUSES = ['active', 'pro', 'agency', 'starter', 'professional', 'business', 'enterprise', 'enterprise-plus', 'enterprise_plus']
const PROCESSING_STATUSES = ['pending', 'scripting', 'generating_slides', 'generating_audio', 'assembling']

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function statusColor(s: string | null): string {
  if (!s) return 'gray'
  if (['completed', 'active', 'agency', 'pro', 'business', 'enterprise', 'enterprise-plus', 'enterprise_plus', 'professional'].includes(s)) return 'mint'
  if (['failed', 'cancelled', 'expired', 'banned'].includes(s)) return 'rose'
  if (PROCESSING_STATUSES.includes(s) || s === 'starter' || s === 'trial') return 'peach'
  return 'gray'
}

/* ── Shared table styles ── */
const TH: React.CSSProperties = { padding: '10px 12px', fontWeight: 700, color: 'var(--ink-soft)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left', borderBottom: '1px solid var(--border-light, #eee)', cursor: 'pointer', whiteSpace: 'nowrap' }
const TD: React.CSSProperties = { padding: '10px 12px', borderBottom: '1px solid var(--border-light, #eee)', fontSize: 14 }
const CARD: React.CSSProperties = { borderRadius: 10 }
const STAT: React.CSSProperties = { flex: 1, minWidth: 160, textAlign: 'center', borderRadius: 10, padding: '20px 12px' }
const STAT_LABEL: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }
const STAT_NUM: React.CSSProperties = { fontSize: 28, fontWeight: 800 }

interface MusicTrack { id: string; name: string; mood: string; file_url: string; duration_seconds: number }
interface Referrer { email: string; referral_code: string; subscription_status: string | null; total_signups: number }

export default function AdminPage() {
  const [state, setState] = useState<'loading' | 'denied' | 'error' | 'ok'>('loading')
  const [error, setError] = useState('')
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [videos, setVideos] = useState<Video[]>([])
  const [tab, setTab] = useState<Tab>('dashboard')
  const [search, setSearch] = useState('')
  const [sortCol, setSortCol] = useState('')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [videoFilter, setVideoFilter] = useState<VideoFilter>('all')
  const [busy, setBusy] = useState<string | null>(null)
  // Content tab state
  const [tracks, setTracks] = useState<MusicTrack[]>([])
  const [referrers, setReferrers] = useState<Referrer[]>([])
  const [newTrack, setNewTrack] = useState({ name: '', mood: 'corporate', file: null as File | null })
  const [refForm, setRefForm] = useState({ email: '', code: '' })
  const [promoEmail, setPromoEmail] = useState('')

  const reload = useCallback(() => {
    fetch('/api/admin/data')
      .then(r => { if (r.status === 403) { setState('denied'); return null } if (!r.ok) throw new Error(`API ${r.status}`); return r.json() })
      .then(d => { if (!d) return; setProfiles(d.profiles ?? []); setVideos(d.videos ?? []); setState('ok') })
      .catch(e => { setError(e.message); setState('error') })
  }, [])

  useEffect(() => { reload() }, [reload])

  // Lazy-load content tab data
  useEffect(() => {
    if (tab !== 'content' || state !== 'ok') return
    fetch('/api/admin/music').then(r => r.json()).then(d => Array.isArray(d) && setTracks(d)).catch(() => {})
    fetch('/api/admin/referrals').then(r => r.json()).then(d => setReferrers(d.referrers ?? [])).catch(() => {})
  }, [tab, state])

  const emailMap = useMemo(() => new Map(profiles.map(p => [p.id, p.email])), [profiles])
  const videoCountMap = useMemo(() => {
    const m = new Map<string, number>()
    videos.forEach(v => m.set(v.user_id, (m.get(v.user_id) ?? 0) + 1))
    return m
  }, [videos])

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }
  function sortInd(col: string) { return sortCol !== col ? ' ↕' : sortDir === 'asc' ? ' ↑' : ' ↓' }
  function sorted<T>(items: T[], getter: (i: T) => string | number | null): T[] {
    if (!sortCol) return items
    return [...items].sort((a, b) => { const va = getter(a) ?? '', vb = getter(b) ?? ''; const c = va < vb ? -1 : va > vb ? 1 : 0; return sortDir === 'asc' ? c : -c })
  }

  async function userAction(userId: string, action: string, value?: string | number) {
    setBusy(userId + action)
    try {
      const r = await fetch('/api/admin/user-action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, userId, value }) })
      if (!r.ok) { const d = await r.json(); alert(d.error || 'Failed'); return }
      reload()
    } catch { alert('Network error') } finally { setBusy(null) }
  }

  async function retryVideo(videoId: string) {
    setBusy(videoId)
    try {
      const r = await fetch('/api/admin/retry-video', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoId }) })
      if (!r.ok) { const d = await r.json(); alert(d.error || 'Failed'); return }
      reload()
    } catch { alert('Network error') } finally { setBusy(null) }
  }

  async function deleteVideo(videoId: string) {
    if (!confirm('Delete this video permanently?')) return
    setBusy(videoId)
    try {
      // Use admin data endpoint pattern — direct delete via supabase not exposed, so we use user-action style
      const r = await fetch('/api/admin/user-action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete_video', userId: videoId, value: videoId }) })
      if (!r.ok) { /* fallback: just reload */ }
      reload()
    } catch { alert('Network error') } finally { setBusy(null) }
  }

  // ── Gate states ──
  if (state === 'loading') return (
    <div style={{ maxWidth: 1100 }}>
      <div className="page-head"><div><h1>Admin</h1><p>Back office dashboard</p></div></div>
      <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner lg" /><p style={{ marginTop: 16, color: 'var(--ink-soft)' }}>Loading...</p></div>
    </div>
  )
  if (state === 'denied') return (
    <div style={{ maxWidth: 800 }}>
      <div className="page-head"><div><h1>Admin</h1><p>Back office dashboard</p></div></div>
      <div className="settings-card" style={{ textAlign: 'center', padding: 48 }}><p style={{ color: 'var(--ink-soft)' }}>403 -- Access denied. Admin only.</p></div>
    </div>
  )
  if (state === 'error') return (
    <div style={{ maxWidth: 800 }}>
      <div className="page-head"><div><h1>Admin</h1><p>Back office dashboard</p></div></div>
      <div className="settings-card" style={{ textAlign: 'center', padding: 48, color: '#991b1b' }}>Error: {error}</div>
    </div>
  )

  // ── Computed stats ──
  const q = search.toLowerCase()
  const activeUsers = profiles.filter(p => ACTIVE_STATUSES.includes(p.subscription_status ?? '')).length
  const completedVids = videos.filter(v => v.status === 'completed').length
  const failedVids = videos.filter(v => v.status === 'failed').length
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
  const vidsThisWeek = videos.filter(v => v.created_at >= weekAgo).length

  // Plan distribution for billing tab
  const planCounts = useMemo(() => {
    const c: Record<string, number> = { free: 0, starter: 0, pro: 0, agency: 0, other: 0 }
    profiles.forEach(p => {
      const s = p.subscription_status ?? 'free'
      if (s === 'starter') c.starter++
      else if (s === 'pro' || s === 'professional') c.pro++
      else if (s === 'agency' || s === 'business' || s === 'enterprise' || s === 'enterprise-plus' || s === 'enterprise_plus') c.agency++
      else if (!s || s === 'trial' || s === 'cancelled' || s === 'expired') c.free++
      else c.other++
    })
    return c
  }, [profiles])
  const cardOnFile = profiles.filter(p => p.card_on_file).length
  const mrr = (planCounts.starter * 19) + (planCounts.pro * 49) + (planCounts.agency * 149)

  // Filtered data
  const filteredUsers = sorted(
    profiles.filter(p => !q || p.email.toLowerCase().includes(q) || (p.full_name ?? '').toLowerCase().includes(q)),
    p => sortCol === 'email' ? p.email : sortCol === 'name' ? (p.full_name ?? '') : sortCol === 'plan' ? (p.subscription_status ?? '') : sortCol === 'credits' ? p.credits_remaining : sortCol === 'videos' ? (videoCountMap.get(p.id) ?? 0) : p.created_at
  )

  const filteredVideos = sorted(
    videos.filter(v => {
      if (videoFilter === 'completed' && v.status !== 'completed') return false
      if (videoFilter === 'failed' && v.status !== 'failed') return false
      if (videoFilter === 'processing' && !PROCESSING_STATUSES.includes(v.status)) return false
      if (q && !(v.title ?? '').toLowerCase().includes(q) && !(emailMap.get(v.user_id) ?? '').toLowerCase().includes(q)) return false
      return true
    }),
    v => sortCol === 'title' ? (v.title ?? '') : sortCol === 'user' ? (emailMap.get(v.user_id) ?? '') : sortCol === 'status' ? v.status : sortCol === 'duration' ? (v.duration ?? 0) : v.created_at
  )

  const tabs: { key: Tab; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'users', label: 'Users' },
    { key: 'videos', label: 'Videos' },
    { key: 'content', label: 'Content' },
    { key: 'billing', label: 'Billing' },
  ]

  return (
    <div style={{ maxWidth: 1100 }}>
      <div className="page-head"><div><h1>Admin</h1><p>Back office dashboard</p></div></div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.key} className={`btn btn-sm ${tab === t.key ? 'btn-primary' : 'btn-soft'}`}
            onClick={() => { setTab(t.key); setSortCol(''); setSearch(''); setVideoFilter('all') }}>{t.label}</button>
        ))}
      </div>

      {/* ════════ DASHBOARD ════════ */}
      {tab === 'dashboard' && <>
        <div className="stats-row" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <div className="stat-card mint" style={STAT}><div style={STAT_LABEL}>Total Users</div><div style={STAT_NUM}>{profiles.length}</div></div>
          <div className="stat-card mint" style={STAT}><div style={STAT_LABEL}>Active Subscribers</div><div style={STAT_NUM}>{activeUsers}</div></div>
          <div className="stat-card" style={STAT}><div style={STAT_LABEL}>Total Videos</div><div style={STAT_NUM}>{videos.length}</div></div>
        </div>
        <div className="stats-row" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
          <div className="stat-card mint" style={STAT}><div style={STAT_LABEL}>Completed</div><div style={STAT_NUM}>{completedVids}</div></div>
          <div className="stat-card peach" style={STAT}><div style={STAT_LABEL}>Failed</div><div style={STAT_NUM}>{failedVids}</div></div>
          <div className="stat-card" style={STAT}><div style={STAT_LABEL}>This Week</div><div style={STAT_NUM}>{vidsThisWeek}</div></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="settings-card" style={CARD}>
            <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700 }}>Recent Signups</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Email', 'Plan', 'Joined'].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
              <tbody>
                {profiles.slice(0, 10).map(p => (
                  <tr key={p.id} className="activity-row">
                    <td style={{ ...TD, fontWeight: 600 }}>{p.email}</td>
                    <td style={TD}><span className={`tag ${statusColor(p.subscription_status)}`}>{p.subscription_status ?? 'none'}</span></td>
                    <td style={{ ...TD, color: 'var(--ink-soft)' }}>{fmtDate(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="settings-card" style={CARD}>
            <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700 }}>Recent Videos</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Title', 'Status', 'Created'].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
              <tbody>
                {videos.slice(0, 10).map(v => (
                  <tr key={v.id} className="activity-row">
                    <td style={{ ...TD, fontWeight: 600 }}>{v.title ?? 'Untitled'}</td>
                    <td style={TD}><span className={`tag ${statusColor(v.status)}`}>{v.status}</span></td>
                    <td style={{ ...TD, color: 'var(--ink-soft)' }}>{fmtDate(v.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>}

      {/* ════════ USERS ════════ */}
      {tab === 'users' && <>
        <input className="input" placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 300, marginBottom: 16 }} />
        <div className="settings-card" style={{ ...CARD, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              {[['email','Email'],['name','Name'],['plan','Plan'],['credits','Credits'],['videos','Videos'],['created','Joined']].map(([c,l]) => (
                <th key={c} style={TH} onClick={() => toggleSort(c)}>{l}{sortInd(c)}</th>
              ))}
              <th style={{ ...TH, cursor: 'default' }}>Actions</th>
            </tr></thead>
            <tbody>
              {filteredUsers.map(p => (
                <tr key={p.id} className="activity-row">
                  <td style={{ ...TD, fontWeight: 600 }}>{p.email}</td>
                  <td style={TD}>{p.full_name ?? '--'}</td>
                  <td style={TD}><span className={`tag ${statusColor(p.subscription_status)}`} style={{ textTransform: 'capitalize' }}>{p.subscription_status ?? 'none'}</span></td>
                  <td style={TD}>{p.credits_remaining}</td>
                  <td style={TD}>{videoCountMap.get(p.id) ?? 0}</td>
                  <td style={{ ...TD, color: 'var(--ink-soft)' }}>{fmtDate(p.created_at)}</td>
                  <td style={{ ...TD, whiteSpace: 'nowrap' }}>
                    <select className="input" style={{ width: 90, display: 'inline', fontSize: 12, padding: '4px 6px', marginRight: 4 }}
                      value={p.subscription_status ?? 'free'}
                      onChange={e => userAction(p.id, 'change_plan', e.target.value === 'free' ? '' : e.target.value)}
                      disabled={busy === p.id + 'change_plan'}>
                      {PLANS.map(pl => <option key={pl} value={pl}>{pl}</option>)}
                    </select>
                    <button className="btn btn-sm btn-soft" style={{ fontSize: 11, marginRight: 2 }} disabled={!!busy}
                      onClick={() => userAction(p.id, 'add_credits', 10)}>+10</button>
                    <button className="btn btn-sm btn-soft" style={{ fontSize: 11, marginRight: 2 }} disabled={!!busy}
                      onClick={() => userAction(p.id, 'add_credits', 100)}>+100</button>
                    <button className="btn btn-sm btn-soft" style={{ fontSize: 11 }} disabled={!!busy}
                      onClick={() => userAction(p.id, 'reset_credits')}>0</button>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--ink-soft)' }}>No users found.</td></tr>}
            </tbody>
          </table>
        </div>
      </>}

      {/* ════════ VIDEOS ════════ */}
      {tab === 'videos' && <>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          {(['all','completed','failed','processing'] as VideoFilter[]).map(f => (
            <button key={f} className={`btn btn-sm ${videoFilter === f ? 'btn-primary' : 'btn-soft'}`}
              onClick={() => setVideoFilter(f)} style={{ textTransform: 'capitalize' }}>{f}</button>
          ))}
          <input className="input" placeholder="Search videos..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 260, marginLeft: 'auto' }} />
        </div>
        <div className="settings-card" style={{ ...CARD, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              {[['title','Title'],['user','User'],['status','Status'],['duration','Duration'],['created','Created']].map(([c,l]) => (
                <th key={c} style={TH} onClick={() => toggleSort(c)}>{l}{sortInd(c)}</th>
              ))}
              <th style={{ ...TH, cursor: 'default' }}>Actions</th>
            </tr></thead>
            <tbody>
              {filteredVideos.map(v => (
                <tr key={v.id} className="activity-row">
                  <td style={{ ...TD, fontWeight: 600, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title ?? 'Untitled'}</td>
                  <td style={TD}>{emailMap.get(v.user_id) ?? 'Unknown'}</td>
                  <td style={TD}><span className={`tag ${statusColor(v.status)}`}>{v.status}</span></td>
                  <td style={TD}>{v.duration ? `${v.duration}s` : '--'}</td>
                  <td style={{ ...TD, color: 'var(--ink-soft)' }}>{fmtDate(v.created_at)}</td>
                  <td style={{ ...TD, whiteSpace: 'nowrap' }}>
                    {v.status === 'failed' && (
                      <button className="btn btn-sm btn-soft" style={{ fontSize: 11, marginRight: 4 }} disabled={busy === v.id}
                        onClick={() => retryVideo(v.id)}>Retry</button>
                    )}
                    <button className="btn btn-sm btn-soft" style={{ fontSize: 11, color: '#991b1b' }} disabled={busy === v.id}
                      onClick={() => deleteVideo(v.id)}>Delete</button>
                  </td>
                </tr>
              ))}
              {filteredVideos.length === 0 && <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--ink-soft)' }}>No videos found.</td></tr>}
            </tbody>
          </table>
        </div>
      </>}

      {/* ════════ CONTENT ════════ */}
      {tab === 'content' && <>
        {/* Links */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
          <Link href="/admin/bulk" className="btn btn-soft" style={{ padding: '12px 24px' }}>Bulk Generate</Link>
          <Link href="/admin/campaigns" className="btn btn-soft" style={{ padding: '12px 24px' }}>Campaigns</Link>
        </div>

        {/* Music */}
        <div className="settings-card" style={{ ...CARD, marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700 }}>Music Tracks</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
            <thead><tr>{['Name', 'Mood', 'Duration', ''].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {tracks.map(t => (
                <tr key={t.id} className="activity-row">
                  <td style={{ ...TD, fontWeight: 600 }}>{t.name}</td>
                  <td style={TD}><span className="tag">{t.mood}</span></td>
                  <td style={TD}>{t.duration_seconds}s</td>
                  <td style={TD}>
                    <button className="btn btn-sm btn-soft" style={{ fontSize: 11, color: '#991b1b' }} onClick={async () => {
                      if (!confirm('Delete this track?')) return
                      await fetch('/api/admin/music', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: t.id }) })
                      setTracks(prev => prev.filter(x => x.id !== t.id))
                    }}>Delete</button>
                  </td>
                </tr>
              ))}
              {tracks.length === 0 && <tr><td colSpan={4} style={{ padding: 20, textAlign: 'center', color: 'var(--ink-soft)' }}>No tracks.</td></tr>}
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input className="input" placeholder="Track name" value={newTrack.name} onChange={e => setNewTrack(p => ({ ...p, name: e.target.value }))} style={{ width: 160 }} />
            <select className="input" value={newTrack.mood} onChange={e => setNewTrack(p => ({ ...p, mood: e.target.value }))} style={{ width: 130 }}>
              {['corporate','warm','upbeat','calm','cinematic','minimal','energetic','inspirational'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <input type="file" accept=".mp3" onChange={e => setNewTrack(p => ({ ...p, file: e.target.files?.[0] ?? null }))} style={{ fontSize: 13 }} />
            <button className="btn btn-sm btn-primary" disabled={!newTrack.name || !newTrack.file} onClick={async () => {
              const fd = new FormData()
              fd.append('name', newTrack.name); fd.append('mood', newTrack.mood); fd.append('file', newTrack.file!)
              const r = await fetch('/api/admin/music', { method: 'POST', body: fd })
              if (r.ok) { const t = await r.json(); setTracks(prev => [...prev, t]); setNewTrack({ name: '', mood: 'corporate', file: null }) }
              else alert('Upload failed')
            }}>Upload</button>
          </div>
        </div>

        {/* Referrals */}
        <div className="settings-card" style={{ ...CARD, marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700 }}>Referral Codes</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
            <thead><tr>{['Email', 'Code', 'Signups', 'Plan'].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {referrers.map(r => (
                <tr key={r.email} className="activity-row">
                  <td style={{ ...TD, fontWeight: 600 }}>{r.email}</td>
                  <td style={TD}><code style={{ background: 'var(--bg-soft)', padding: '2px 6px', borderRadius: 4, fontSize: 13 }}>{r.referral_code}</code></td>
                  <td style={TD}>{r.total_signups}</td>
                  <td style={TD}><span className={`tag ${statusColor(r.subscription_status)}`}>{r.subscription_status ?? 'none'}</span></td>
                </tr>
              ))}
              {referrers.length === 0 && <tr><td colSpan={4} style={{ padding: 20, textAlign: 'center', color: 'var(--ink-soft)' }}>No referrers.</td></tr>}
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input className="input" placeholder="User email" value={refForm.email} onChange={e => setRefForm(p => ({ ...p, email: e.target.value }))} style={{ width: 200 }} />
            <input className="input" placeholder="Referral code" value={refForm.code} onChange={e => setRefForm(p => ({ ...p, code: e.target.value }))} style={{ width: 160 }} />
            <button className="btn btn-sm btn-primary" disabled={!refForm.email || !refForm.code} onClick={async () => {
              const r = await fetch('/api/admin/referrals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: refForm.email, referral_code: refForm.code }) })
              if (r.ok) { setRefForm({ email: '', code: '' }); fetch('/api/admin/referrals').then(r => r.json()).then(d => setReferrers(d.referrers ?? [])) }
              else { const d = await r.json(); alert(d.error || 'Failed') }
            }}>Add Code</button>
          </div>
        </div>

        {/* Promo users */}
        <div className="settings-card" style={CARD}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700 }}>Promo Access</h3>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 12 }}>Grant or revoke unlimited agency access for a user.</p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input className="input" placeholder="Email address" value={promoEmail} onChange={e => setPromoEmail(e.target.value)} style={{ width: 260 }} />
            <button className="btn btn-sm btn-primary" disabled={!promoEmail} onClick={async () => {
              const r = await fetch('/api/admin/promo-user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: promoEmail }) })
              if (r.ok) { alert('Promo access granted'); setPromoEmail(''); reload() }
              else { const d = await r.json(); alert(d.error || 'Failed') }
            }}>Grant Access</button>
            <button className="btn btn-sm btn-soft" style={{ color: '#991b1b' }} disabled={!promoEmail} onClick={async () => {
              const r = await fetch('/api/admin/promo-user', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: promoEmail }) })
              if (r.ok) { alert('Promo access revoked'); setPromoEmail(''); reload() }
              else { const d = await r.json(); alert(d.error || 'Failed') }
            }}>Revoke</button>
          </div>
        </div>
      </>}

      {/* ════════ BILLING ════════ */}
      {tab === 'billing' && <>
        <div className="stats-row" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
          <div className="stat-card" style={STAT}><div style={STAT_LABEL}>Free</div><div style={STAT_NUM}>{planCounts.free}</div></div>
          <div className="stat-card peach" style={STAT}><div style={STAT_LABEL}>Starter ($19)</div><div style={STAT_NUM}>{planCounts.starter}</div></div>
          <div className="stat-card mint" style={STAT}><div style={STAT_LABEL}>Pro ($49)</div><div style={STAT_NUM}>{planCounts.pro}</div></div>
          <div className="stat-card mint" style={STAT}><div style={STAT_LABEL}>Agency ($149)</div><div style={STAT_NUM}>{planCounts.agency}</div></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="settings-card" style={CARD}>
            <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700 }}>Estimated MRR</h3>
            <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--mint, #166534)' }}>${mrr.toLocaleString()}</div>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 8 }}>
              ({planCounts.starter} x $19) + ({planCounts.pro} x $49) + ({planCounts.agency} x $149)
            </p>
          </div>
          <div className="settings-card" style={CARD}>
            <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700 }}>Per-Video Billing</h3>
            <div style={{ fontSize: 36, fontWeight: 800 }}>{cardOnFile}</div>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 8 }}>users with card on file</p>
          </div>
        </div>

        <div className="settings-card" style={{ ...CARD, marginTop: 16, padding: '16px 20px' }}>
          <p style={{ fontSize: 14, color: 'var(--ink-soft)' }}>
            Full billing management at{' '}
            <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--mint, #166534)', fontWeight: 600 }}>
              dashboard.stripe.com
            </a>
          </p>
        </div>
      </>}
    </div>
  )
}
