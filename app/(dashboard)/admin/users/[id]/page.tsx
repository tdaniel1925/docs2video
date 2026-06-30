'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import type { Profile, Video, Quote, EmailConnection } from '@/app/_lib/types'

interface CreditTransaction {
  id: string
  amount: number
  balance_after: number
  action: string
  description: string | null
  created_at: string
}

interface StripeStatus {
  hasCustomer: boolean
  subscription: string | null
  plan: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  lastPaymentAt: string | null
  mismatch: boolean
}

export default function AdminUserDetailPage() {
  const params = useParams()
  const userId = params.id as string
  const [state, setState] = useState<'loading' | 'error' | 'ok'>('loading')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [videos, setVideos] = useState<Video[]>([])
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [emailConnections, setEmailConnections] = useState<EmailConnection[]>([])
  const [referrals, setReferrals] = useState<{ id: string; email: string; full_name: string | null }[]>([])
  const [creditHistory, setCreditHistory] = useState<CreditTransaction[]>([])
  const [stripe, setStripe] = useState<StripeStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [activeTab, setActiveTab] = useState<'videos' | 'credits' | 'quotes' | 'email' | 'referrals'>('videos')

  useEffect(() => {
    Promise.all([
      fetch(`/api/admin/user-detail?id=${userId}`).then(r => r.ok ? r.json() : Promise.reject()),
      fetch(`/api/admin/credit-history?userId=${userId}`).then(r => r.ok ? r.json() : { transactions: [] }).catch(() => ({ transactions: [] })),
    ]).then(([d, ch]) => {
      setProfile(d.profile)
      setVideos(d.videos ?? [])
      setQuotes(d.quotes ?? [])
      setEmailConnections(d.emailConnections ?? [])
      setReferrals(d.referrals ?? [])
      setStripe(d.stripe ?? null)
      setCreditHistory(ch.transactions ?? [])
      setState('ok')
    }).catch(() => setState('error'))
  }, [userId])

  async function toggleAccess(field: 'is_admin' | 'is_beta', value: boolean) {
    setBusy(true)
    try {
      const r = await fetch('/api/admin/manage-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, field, value }),
      })
      if (r.ok && profile) setProfile({ ...profile, [field]: value })
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
      const r = await fetch(`/api/admin/user-detail?id=${userId}`)
      if (r.ok) { const d = await r.json(); setProfile(d.profile); setStripe(d.stripe ?? null) }
    } catch {}
    setBusy(false)
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const timeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  if (state === 'loading') return <div style={{ padding: 64, textAlign: 'center', color: 'var(--ink-light)' }}>Loading user...</div>
  if (state === 'error' || !profile) return <div style={{ padding: 64, textAlign: 'center' }}><h2>Error</h2><p>Could not load user details.</p></div>

  const completedVideos = videos.filter(v => v.status === 'completed')
  const failedVideos = videos.filter(v => v.status === 'failed')
  const lastVideo = videos[0]

  const tabs = [
    { id: 'videos' as const, label: `Videos (${videos.length})` },
    { id: 'credits' as const, label: `Credits (${creditHistory.length})` },
    { id: 'quotes' as const, label: `Quotes (${quotes.length})` },
    { id: 'email' as const, label: `Email (${emailConnections.length})` },
    { id: 'referrals' as const, label: `Referrals (${referrals.length})` },
  ]

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px 48px' }}>
      <Link href="/admin" style={{ fontSize: 13, color: 'var(--ink-light)', textDecoration: 'none' }}>&larr; Back to Admin</Link>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginTop: 8, marginBottom: 20 }}>{profile.full_name || profile.email}</h1>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
        <div style={s.statCard}>
          <div style={s.statLabel}>Plan</div>
          <div style={{ ...s.statValue, textTransform: 'capitalize' }}>{profile.subscription_status || 'Free'}</div>
        </div>
        <div style={s.statCard}>
          <div style={s.statLabel}>Credits</div>
          <div style={s.statValue}>{profile.credits_remaining}</div>
        </div>
        <div style={s.statCard}>
          <div style={s.statLabel}>Videos</div>
          <div style={s.statValue}>{completedVideos.length}</div>
          {failedVideos.length > 0 && <div style={{ fontSize: 11, color: '#DC2626' }}>{failedVideos.length} failed</div>}
        </div>
        <div style={s.statCard}>
          <div style={s.statLabel}>Joined</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{fmt(profile.created_at)}</div>
        </div>
        <div style={s.statCard}>
          <div style={s.statLabel}>Last Activity</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{lastVideo ? timeAgo(lastVideo.created_at) : 'Never'}</div>
        </div>
      </div>

      {/* Profile + Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div style={s.card}>
          <h3 style={s.cardTitle}>Profile</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
            <div><span style={s.label}>Email:</span> {profile.email}</div>
            <div><span style={s.label}>Company:</span> {profile.company_name ?? '—'}</div>
            <div><span style={s.label}>Referral:</span> {profile.referral_code ?? '—'}</div>
            <div><span style={s.label}>Stripe ID:</span> {(profile as any).stripe_customer_id?.slice(0, 15) ?? '—'}</div>
          </div>
        </div>
        <div style={s.card}>
          <h3 style={s.cardTitle}>Quick Actions</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className={`btn btn-sm ${profile.is_admin ? 'btn-primary' : 'btn-soft'}`} disabled={busy} onClick={() => toggleAccess('is_admin', !profile.is_admin)}>
              {profile.is_admin ? 'Remove Admin' : 'Make Admin'}
            </button>
            <button className={`btn btn-sm ${profile.is_beta ? 'btn-primary' : 'btn-soft'}`} disabled={busy} onClick={() => toggleAccess('is_beta', !profile.is_beta)}>
              {profile.is_beta ? 'Remove Beta' : 'Make Beta'}
            </button>
            <select disabled={busy} defaultValue="" onChange={e => { if (e.target.value) userAction('change_plan', e.target.value); e.target.value = '' }}
              style={{ fontSize: 12, padding: '5px 8px', borderRadius: 8, border: '1px solid var(--border)' }}>
              <option value="" disabled>Change Plan...</option>
              <option value="free">Free</option>
              <option value="pro">Pro</option><option value="business">Business</option>
              <option value="enterprise">Enterprise</option>
            </select>
            <button className="btn btn-sm btn-soft" disabled={busy} onClick={() => userAction('add_credits', 10)}>+10</button>
            <button className="btn btn-sm btn-soft" disabled={busy} onClick={() => userAction('add_credits', 100)}>+100</button>
            <button className="btn btn-sm btn-soft" disabled={busy} onClick={() => userAction('add_credits', 500)}>+500</button>
          </div>
        </div>
      </div>

      {/* Live Stripe status — the real billing truth, so the admin can spot when
          the subscription_status flag doesn't match a real paying Stripe sub. */}
      {stripe && (
        <div style={{ ...s.card, marginBottom: 20, ...(stripe.mismatch ? { border: '2px solid #DC2626', background: '#fef2f2' } : {}) }}>
          <h3 style={{ ...s.cardTitle, display: 'flex', alignItems: 'center', gap: 8, marginBottom: stripe.mismatch ? 8 : 12 }}>
            Stripe Billing
            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: '#635bff', color: 'white' }}>LIVE</span>
          </h3>
          {stripe.mismatch && (
            <div style={{ fontSize: 13, fontWeight: 700, color: '#DC2626', marginBottom: 12 }}>
              ⚠ MISMATCH — the plan flag (<span style={{ textTransform: 'capitalize' }}>{profile.subscription_status || 'free'}</span>) does not match Stripe
              {stripe.subscription ? ` (Stripe sub: ${stripe.subscription})` : ' (no active Stripe subscription)'}. Fix the plan or refund accordingly.
            </div>
          )}
          {!stripe.hasCustomer ? (
            <p style={{ fontSize: 13, color: 'var(--ink-light)' }}>No Stripe customer record — this user has never started checkout.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, fontSize: 13 }}>
              <div>
                <div style={s.label}>Subscription</div>
                <div style={{ fontWeight: 700, textTransform: 'capitalize', color: stripe.subscription ? (stripe.subscription === 'active' || stripe.subscription === 'trialing' ? '#059669' : '#D97706') : 'var(--ink-light)' }}>
                  {stripe.subscription || 'None'}
                </div>
              </div>
              <div>
                <div style={s.label}>Stripe Plan</div>
                <div style={{ fontWeight: 700, textTransform: 'capitalize' }}>{stripe.plan || '—'}</div>
              </div>
              <div>
                <div style={s.label}>Renews / Ends</div>
                <div style={{ fontWeight: 700 }}>{stripe.currentPeriodEnd ? fmt(stripe.currentPeriodEnd) : '—'}{stripe.cancelAtPeriodEnd ? ' (cancels)' : ''}</div>
              </div>
              <div>
                <div style={s.label}>Last Payment</div>
                <div style={{ fontWeight: 700 }}>{stripe.lastPaymentAt ? fmt(stripe.lastPaymentAt) : 'Never'}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border-light)' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding: '10px 16px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
            background: 'none', color: activeTab === t.id ? 'var(--ink)' : 'var(--ink-light)',
            borderBottom: activeTab === t.id ? '2px solid var(--mint, #C7E8A8)' : '2px solid transparent',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Videos Tab */}
      {activeTab === 'videos' && (
        <div>
          {videos.length === 0 ? (
            <p style={{ color: 'var(--ink-light)', padding: 20 }}>No videos yet</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {videos.slice(0, 50).map(v => (
                <div key={v.id} style={s.videoCard}>
                  {v.thumbnail_url ? (
                    <img src={v.thumbnail_url} alt="" style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: '8px 8px 0 0' }} />
                  ) : (
                    <div style={{ width: '100%', height: 140, background: 'var(--bg-soft)', borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-light)', fontSize: 12 }}>
                      No thumbnail
                    </div>
                  )}
                  <div style={{ padding: '10px 12px' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {v.title || 'Untitled'}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: 'var(--ink-light)' }}>{fmt(v.created_at)}</span>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                        background: v.status === 'completed' ? '#ecfdf5' : v.status === 'failed' ? '#fef2f2' : '#fffbeb',
                        color: v.status === 'completed' ? '#059669' : v.status === 'failed' ? '#DC2626' : '#D97706',
                      }}>{v.status}</span>
                    </div>
                    {v.status === 'completed' && (
                      <a href={`/watch/${v.id}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#2563EB', textDecoration: 'none', display: 'block', marginTop: 6 }}>
                        View &rarr;
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Credits Tab */}
      {activeTab === 'credits' && (
        <div style={s.card}>
          {creditHistory.length === 0 ? (
            <p style={{ color: 'var(--ink-light)' }}>No credit transactions</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={s.th}>Date</th>
                  <th style={s.th}>Action</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>Amount</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {creditHistory.slice(0, 50).map(tx => (
                  <tr key={tx.id}>
                    <td style={s.td}>{fmt(tx.created_at)}</td>
                    <td style={s.td}>{tx.action.replace(/_/g, ' ')}</td>
                    <td style={{ ...s.td, textAlign: 'right', fontWeight: 700, color: tx.amount > 0 ? '#059669' : tx.amount < 0 ? '#DC2626' : 'var(--ink-light)' }}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount}
                    </td>
                    <td style={{ ...s.td, textAlign: 'right' }}>{tx.balance_after}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Quotes Tab */}
      {activeTab === 'quotes' && (
        <div style={s.card}>
          {quotes.length === 0 ? <p style={{ color: 'var(--ink-light)' }}>No quotes</p> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr><th style={s.th}>Client</th><th style={s.th}>Total</th><th style={s.th}>Status</th><th style={s.th}>Date</th></tr></thead>
              <tbody>
                {quotes.map(q => (
                  <tr key={q.id}>
                    <td style={s.td}>{q.client_name ?? q.client_email ?? '—'}</td>
                    <td style={s.td}>${q.total.toFixed(2)}</td>
                    <td style={s.td}><span style={{ textTransform: 'capitalize' }}>{q.status}</span></td>
                    <td style={s.td}>{fmt(q.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Email Tab */}
      {activeTab === 'email' && (
        <div style={s.card}>
          {emailConnections.length === 0 ? <p style={{ color: 'var(--ink-light)' }}>No email connections</p> : (
            emailConnections.map(ec => (
              <div key={ec.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
                <span>{ec.email_address}</span>
                <span style={{ textTransform: 'capitalize', color: 'var(--ink-light)' }}>{ec.provider}{ec.is_default ? ' (default)' : ''}</span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Referrals Tab */}
      {activeTab === 'referrals' && (
        <div style={s.card}>
          {referrals.length === 0 ? <p style={{ color: 'var(--ink-light)' }}>No referrals</p> : (
            referrals.map(r => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
                <span>{r.email}</span>
                <span style={{ color: 'var(--ink-light)' }}>{r.full_name ?? '—'}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  statCard: { padding: '14px 16px', borderRadius: 10, background: 'white', border: '1px solid var(--border-light, #e5e7eb)', textAlign: 'center' },
  statLabel: { fontSize: 11, fontWeight: 600, color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 },
  statValue: { fontSize: 22, fontWeight: 800, color: 'var(--ink)' },
  card: { padding: 20, borderRadius: 10, background: 'white', border: '1px solid var(--border-light, #e5e7eb)' },
  cardTitle: { fontSize: 15, fontWeight: 700, marginBottom: 12, color: 'var(--ink)' },
  label: { fontWeight: 600, color: 'var(--ink-light)' },
  videoCard: { borderRadius: 10, background: 'white', border: '1px solid var(--border-light, #e5e7eb)', overflow: 'hidden' },
  th: { textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--border-light)', fontWeight: 600, color: 'var(--ink-light)', fontSize: 11, textTransform: 'uppercase' },
  td: { padding: '8px 12px', borderBottom: '1px solid var(--border-light, #f3f4f6)', color: 'var(--ink)' },
}
