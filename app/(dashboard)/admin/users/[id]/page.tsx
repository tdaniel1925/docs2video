'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import type { Profile, Video, Quote, EmailConnection } from '@/app/_lib/types'

export default function AdminUserDetailPage() {
  const params = useParams()
  const userId = params.id as string
  const [state, setState] = useState<'loading' | 'error' | 'ok'>('loading')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [videos, setVideos] = useState<Video[]>([])
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [emailConnections, setEmailConnections] = useState<EmailConnection[]>([])
  const [referrals, setReferrals] = useState<{ id: string; email: string; full_name: string | null }[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch(`/api/admin/user-detail?id=${userId}`)
      .then(r => {
        if (!r.ok) throw new Error('Failed to load')
        return r.json()
      })
      .then(d => {
        setProfile(d.profile)
        setVideos(d.videos ?? [])
        setQuotes(d.quotes ?? [])
        setEmailConnections(d.emailConnections ?? [])
        setReferrals(d.referrals ?? [])
        setState('ok')
      })
      .catch(() => setState('error'))
  }, [userId])

  async function toggleAccess(field: 'is_admin' | 'is_beta', value: boolean) {
    setBusy(true)
    try {
      const r = await fetch('/api/admin/manage-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, field, value }),
      })
      if (r.ok && profile) {
        setProfile({ ...profile, [field]: value })
      }
    } catch {}
    setBusy(false)
  }

  async function userAction(action: string, value?: string | number) {
    setBusy(true)
    try {
      await fetch('/api/admin/user-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action, value }),
      })
      // Reload profile
      const r = await fetch(`/api/admin/user-detail?id=${userId}`)
      if (r.ok) {
        const d = await r.json()
        setProfile(d.profile)
      }
    } catch {}
    setBusy(false)
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const statusTag = (s: string) => {
    const color = s === 'completed' ? 'mint' : s === 'failed' ? 'rose' : 'peach'
    return <span className={`tag ${color}`} style={{ textTransform: 'capitalize' }}>{s}</span>
  }

  if (state === 'loading') return <div style={{ padding: 64, textAlign: 'center', color: 'var(--ink-light)' }}>Loading user...</div>
  if (state === 'error' || !profile) return <div style={{ padding: 64, textAlign: 'center' }}><h2>Error</h2><p>Could not load user details.</p></div>

  return (
    <div>
      <div className="page-head">
        <div>
          <Link href="/admin" style={{ fontSize: 13, color: 'var(--ink-light)', textDecoration: 'none' }}>&larr; Back to Admin</Link>
          <h1 style={{ marginTop: 8 }}>{profile.full_name || profile.email}</h1>
        </div>
      </div>

      {/* Profile Info */}
      <div className="settings-card" style={{ marginBottom: 16 }}>
        <h3>Profile</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginTop: 12 }}>
          <div><strong>Email:</strong> {profile.email}</div>
          <div><strong>Name:</strong> {profile.full_name ?? '—'}</div>
          <div><strong>Company:</strong> {profile.company_name ?? '—'}</div>
          <div><strong>Plan:</strong> <span style={{ textTransform: 'capitalize' }}>{profile.subscription_status || 'free'}</span></div>
          <div><strong>Credits:</strong> {profile.credits_remaining}</div>
          <div><strong>Joined:</strong> {fmt(profile.created_at)}</div>
          <div><strong>Referral Code:</strong> {profile.referral_code ?? '—'}</div>
        </div>
      </div>

      {/* Access Controls */}
      <div className="settings-card" style={{ marginBottom: 16 }}>
        <h3>Access & Actions</h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
          <button
            className={`btn btn-sm ${profile.is_admin ? 'btn-primary' : 'btn-soft'}`}
            disabled={busy}
            onClick={() => toggleAccess('is_admin', !profile.is_admin)}
          >
            {profile.is_admin ? 'Remove Admin' : 'Make Admin'}
          </button>
          <button
            className={`btn btn-sm ${profile.is_beta ? 'btn-primary' : 'btn-soft'}`}
            disabled={busy}
            onClick={() => toggleAccess('is_beta', !profile.is_beta)}
          >
            {profile.is_beta ? 'Remove Beta' : 'Make Beta'}
          </button>
          <select
            disabled={busy}
            defaultValue=""
            onChange={e => { if (e.target.value) userAction('change_plan', e.target.value); e.target.value = '' }}
            style={{ fontSize: 13, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)' }}
          >
            <option value="" disabled>Change Plan...</option>
            <option value="free">Free</option>
            <option value="starter">Starter</option>
            <option value="pro">Pro</option>
            <option value="business">Business</option>
            <option value="enterprise">Enterprise</option>
          </select>
          <button className="btn btn-sm btn-soft" disabled={busy} onClick={() => userAction('add_credits', 10)}>+10 Credits</button>
          <button className="btn btn-sm btn-soft" disabled={busy} onClick={() => userAction('add_credits', 100)}>+100 Credits</button>
        </div>
      </div>

      {/* Videos */}
      <div className="settings-card" style={{ marginBottom: 16 }}>
        <h3>Videos ({videos.length})</h3>
        {videos.length === 0 ? (
          <p style={{ color: 'var(--ink-light)', marginTop: 8 }}>No videos yet</p>
        ) : (
          <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, overflow: 'hidden', marginTop: 12 }}>
            {videos.slice(0, 30).map((v, i) => (
              <div key={v.id} className="activity-row" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: i < Math.min(videos.length, 30) - 1 ? '1px solid var(--border-light)' : 'none', fontSize: 13 }}>
                <div style={{ flex: 1, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title ?? 'Untitled'}</div>
                <div style={{ width: 90 }}>{statusTag(v.status)}</div>
                <div style={{ width: 100, color: 'var(--ink-light)' }}>{fmt(v.created_at)}</div>
                <div style={{ width: 60 }}>
                  {v.status === 'completed' && (
                    <a href={`/watch/${v.id}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--primary)' }}>Watch</a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quotes */}
      {quotes.length > 0 && (
        <div className="settings-card" style={{ marginBottom: 16 }}>
          <h3>Quotes ({quotes.length})</h3>
          <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, overflow: 'hidden', marginTop: 12 }}>
            {quotes.slice(0, 20).map((q, i) => (
              <div key={q.id} className="activity-row" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: i < Math.min(quotes.length, 20) - 1 ? '1px solid var(--border-light)' : 'none', fontSize: 13 }}>
                <div style={{ flex: 1 }}>{q.client_name ?? q.client_email ?? 'Unknown'}</div>
                <div style={{ width: 80 }}>${q.total.toFixed(2)}</div>
                <div style={{ width: 80 }}><span className="tag" style={{ textTransform: 'capitalize' }}>{q.status}</span></div>
                <div style={{ width: 100, color: 'var(--ink-light)' }}>{fmt(q.created_at)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Email Connections */}
      {emailConnections.length > 0 && (
        <div className="settings-card" style={{ marginBottom: 16 }}>
          <h3>Email Connections ({emailConnections.length})</h3>
          <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, overflow: 'hidden', marginTop: 12 }}>
            {emailConnections.map((ec, i) => (
              <div key={ec.id} className="activity-row" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: i < emailConnections.length - 1 ? '1px solid var(--border-light)' : 'none', fontSize: 13 }}>
                <div style={{ flex: 1 }}>{ec.email_address}</div>
                <div style={{ width: 100, textTransform: 'capitalize' }}>{ec.provider}</div>
                <div style={{ width: 60 }}>{ec.is_default ? <span className="tag mint">Default</span> : ''}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Referrals */}
      {referrals.length > 0 && (
        <div className="settings-card" style={{ marginBottom: 16 }}>
          <h3>Referrals ({referrals.length})</h3>
          <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, overflow: 'hidden', marginTop: 12 }}>
            {referrals.map((r, i) => (
              <div key={r.id} className="activity-row" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: i < referrals.length - 1 ? '1px solid var(--border-light)' : 'none', fontSize: 13 }}>
                <div style={{ flex: 1 }}>{r.email}</div>
                <div style={{ width: 120 }}>{r.full_name ?? '—'}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
