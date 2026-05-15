'use client'

import { useState, useEffect, useMemo } from 'react'
import type { Profile, Video, Brand } from '@/app/_lib/types'

type Tab = 'users' | 'videos' | 'brands'
type SortDir = 'asc' | 'desc'

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function statusColor(status: string | null): string {
  if (!status) return 'gray'
  if (['completed', 'active', 'agency', 'pro', 'business', 'enterprise', 'enterprise-plus', 'enterprise_plus', 'professional'].includes(status)) return 'mint'
  if (['failed', 'cancelled', 'expired'].includes(status)) return 'rose'
  if (['trial', 'pending', 'scripting', 'generating_slides', 'generating_audio', 'assembling', 'starter'].includes(status)) return 'peach'
  return 'gray'
}

export default function AdminPage() {
  const [state, setState] = useState<'loading' | 'denied' | 'error' | 'ok'>('loading')
  const [error, setError] = useState('')
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [videos, setVideos] = useState<Video[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [tab, setTab] = useState<Tab>('users')
  const [search, setSearch] = useState('')
  const [sortCol, setSortCol] = useState('')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  useEffect(() => {
    fetch('/api/admin/data')
      .then(r => {
        if (r.status === 403) { setState('denied'); return null }
        if (!r.ok) throw new Error(`API error ${r.status}`)
        return r.json()
      })
      .then(data => {
        if (!data) return
        setProfiles(data.profiles ?? [])
        setVideos(data.videos ?? [])
        setBrands(data.brands ?? [])
        setState('ok')
      })
      .catch(err => { setError(err.message); setState('error') })
  }, [])

  // Build lookup maps
  const emailMap = useMemo(() => new Map(profiles.map(p => [p.id, p.email])), [profiles])
  const videoCountMap = useMemo(() => {
    const m = new Map<string, number>()
    videos.forEach(v => m.set(v.user_id, (m.get(v.user_id) ?? 0) + 1))
    return m
  }, [videos])

  // Sort helper
  function toggleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }

  function sortIndicator(col: string) {
    if (sortCol !== col) return ' ↕'
    return sortDir === 'asc' ? ' ↑' : ' ↓'
  }

  // Generic sort
  function sorted<T>(items: T[], getter: (item: T) => string | number | null): T[] {
    if (!sortCol) return items
    return [...items].sort((a, b) => {
      const va = getter(a) ?? ''
      const vb = getter(b) ?? ''
      const cmp = va < vb ? -1 : va > vb ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
  }

  // ── Gate states ──
  if (state === 'loading') return (
    <div style={{ maxWidth: 1100 }}>
      <div className="page-head"><div><h1>Admin</h1><p>Back office dashboard.</p></div></div>
      <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner lg" /><p style={{ marginTop: 16, color: 'var(--ink-soft)' }}>Checking access...</p></div>
    </div>
  )
  if (state === 'denied') return (
    <div style={{ maxWidth: 800 }}>
      <div className="page-head"><div><h1>Admin</h1><p>Back office dashboard.</p></div></div>
      <div className="settings-card" style={{ textAlign: 'center', padding: 48 }}><p style={{ color: 'var(--ink-soft)' }}>403 — Access denied. Admin only.</p></div>
    </div>
  )
  if (state === 'error') return (
    <div style={{ maxWidth: 800 }}>
      <div className="page-head"><div><h1>Admin</h1><p>Back office dashboard.</p></div></div>
      <div className="settings-card" style={{ textAlign: 'center', padding: 48, color: '#991b1b' }}>Error loading data: {error}</div>
    </div>
  )

  // ── Stats ──
  const completedVideos = videos.filter(v => v.status === 'completed').length
  const q = search.toLowerCase()

  // ── Filtered + sorted data ──
  const filteredUsers = sorted(
    profiles.filter(p => !q || p.email.toLowerCase().includes(q) || (p.full_name ?? '').toLowerCase().includes(q)),
    p => sortCol === 'email' ? p.email : sortCol === 'name' ? (p.full_name ?? '') : sortCol === 'plan' ? (p.subscription_status ?? '') : sortCol === 'credits' ? p.credits_remaining : sortCol === 'videos' ? (videoCountMap.get(p.id) ?? 0) : sortCol === 'created' ? p.created_at : p.created_at
  )

  const filteredVideos = sorted(
    videos.filter(v => !q || (v.title ?? '').toLowerCase().includes(q) || (emailMap.get(v.user_id) ?? '').toLowerCase().includes(q) || v.status.includes(q)),
    v => sortCol === 'title' ? (v.title ?? '') : sortCol === 'user' ? (emailMap.get(v.user_id) ?? '') : sortCol === 'status' ? v.status : sortCol === 'duration' ? (v.duration ?? 0) : sortCol === 'created' ? v.created_at : v.created_at
  )

  const filteredBrands = sorted(
    brands.filter(b => !q || b.name.toLowerCase().includes(q) || (emailMap.get(b.user_id) ?? '').toLowerCase().includes(q)),
    b => sortCol === 'name' ? b.name : sortCol === 'user' ? (emailMap.get(b.user_id) ?? '') : sortCol === 'default' ? (b.is_default ? '1' : '0') : sortCol === 'created' ? b.created_at : b.created_at
  )

  const tabs: { key: Tab; label: string }[] = [
    { key: 'users', label: 'Users' },
    { key: 'videos', label: 'Videos' },
    { key: 'brands', label: 'Brands' },
  ]

  return (
    <div style={{ maxWidth: 1100 }}>
      <div className="page-head"><div><h1>Admin</h1><p>Back office dashboard.</p></div></div>

      {/* Stat cards */}
      <div className="stats-row" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <div className="stat-card" style={{ flex: 1, minWidth: 140, textAlign: 'center', borderRadius: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Total Users</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{profiles.length}</div>
        </div>
        <div className="stat-card" style={{ flex: 1, minWidth: 140, textAlign: 'center', borderRadius: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Total Videos</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{videos.length}</div>
        </div>
        <div className="stat-card" style={{ flex: 1, minWidth: 140, textAlign: 'center', borderRadius: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Total Brands</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{brands.length}</div>
        </div>
        <div className="stat-card" style={{ flex: 1, minWidth: 140, textAlign: 'center', borderRadius: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Completed Videos</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--mint, #166534)' }}>{completedVideos}</div>
        </div>
      </div>

      {/* Tab bar + search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--border, #e2e2e2)', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 0 }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setSortCol(''); setSearch('') }} style={{
              padding: '10px 20px', fontSize: 14, fontWeight: tab === t.key ? 700 : 500,
              color: tab === t.key ? 'var(--ink)' : 'var(--ink-soft)',
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: `2px solid ${tab === t.key ? 'var(--mint, #4ade80)' : 'transparent'}`, marginBottom: -2,
            }}>{t.label}</button>
          ))}
        </div>
        <input
          className="input"
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 220, marginBottom: 4 }}
        />
      </div>

      {/* Tables */}
      <div className="settings-card" style={{ borderRadius: 10, overflowX: 'auto' }}>
        {tab === 'users' && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {[['email', 'Email'], ['name', 'Name'], ['plan', 'Plan'], ['credits', 'Credits'], ['videos', 'Videos'], ['created', 'Joined']].map(([col, label]) => (
                  <th key={col} onClick={() => toggleSort(col)} style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--ink-soft)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left', borderBottom: '1px solid var(--border-light, #eee)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {label}{sortIndicator(col)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(p => (
                <tr key={p.id}>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-light, #eee)', fontSize: 14, fontWeight: 600 }}>{p.email}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-light, #eee)', fontSize: 14 }}>{p.full_name ?? '—'}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-light, #eee)', fontSize: 14 }}><span className={`tag ${statusColor(p.subscription_status)}`} style={{ textTransform: 'capitalize' }}>{p.subscription_status ?? 'none'}</span></td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-light, #eee)', fontSize: 14 }}>{p.credits_remaining}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-light, #eee)', fontSize: 14 }}>{videoCountMap.get(p.id) ?? 0}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-light, #eee)', fontSize: 14, color: 'var(--ink-soft)' }}>{fmtDate(p.created_at)}</td>
                </tr>
              ))}
              {filteredUsers.length === 0 && <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--ink-soft)' }}>No users found.</td></tr>}
            </tbody>
          </table>
        )}

        {tab === 'videos' && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {[['title', 'Title'], ['user', 'User'], ['status', 'Status'], ['duration', 'Duration'], ['created', 'Created']].map(([col, label]) => (
                  <th key={col} onClick={() => toggleSort(col)} style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--ink-soft)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left', borderBottom: '1px solid var(--border-light, #eee)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {label}{sortIndicator(col)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredVideos.map(v => (
                <tr key={v.id}>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-light, #eee)', fontSize: 14, fontWeight: 600 }}>{v.title ?? 'Untitled'}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-light, #eee)', fontSize: 14 }}>{emailMap.get(v.user_id) ?? 'Unknown'}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-light, #eee)', fontSize: 14 }}><span className={`tag ${statusColor(v.status)}`} style={{ textTransform: 'capitalize' }}>{v.status}</span></td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-light, #eee)', fontSize: 14 }}>{v.duration ? `${v.duration}s` : '—'}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-light, #eee)', fontSize: 14, color: 'var(--ink-soft)' }}>{fmtDate(v.created_at)}</td>
                </tr>
              ))}
              {filteredVideos.length === 0 && <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--ink-soft)' }}>No videos found.</td></tr>}
            </tbody>
          </table>
        )}

        {tab === 'brands' && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {[['name', 'Name'], ['user', 'User'], ['default', 'Default'], ['created', 'Created']].map(([col, label]) => (
                  <th key={col} onClick={() => toggleSort(col)} style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--ink-soft)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left', borderBottom: '1px solid var(--border-light, #eee)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {label}{sortIndicator(col)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredBrands.map(b => (
                <tr key={b.id}>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-light, #eee)', fontSize: 14, fontWeight: 600 }}>{b.name}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-light, #eee)', fontSize: 14 }}>{emailMap.get(b.user_id) ?? 'Unknown'}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-light, #eee)', fontSize: 14 }}>{b.is_default ? <span className="tag mint">Yes</span> : '—'}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-light, #eee)', fontSize: 14, color: 'var(--ink-soft)' }}>{fmtDate(b.created_at)}</td>
                </tr>
              ))}
              {filteredBrands.length === 0 && <tr><td colSpan={4} style={{ padding: 32, textAlign: 'center', color: 'var(--ink-soft)' }}>No brands found.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
