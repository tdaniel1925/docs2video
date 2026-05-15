'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/app/_lib/supabase/client'
import type { Profile, Video, Brand } from '@/app/_lib/types'
import { isAdmin } from '@/app/_lib/admin'

type Tab = 'overview' | 'users' | 'videos' | 'commerce' | 'usage' | 'music' | 'referrals' | 'promo'

type MusicTrack = {
  id: string
  name: string
  mood: string
  file_url: string
  duration_seconds: number | null
  created_at: string
}

const MOOD_OPTIONS = ['corporate', 'warm', 'upbeat', 'calm', 'cinematic', 'minimal', 'energetic', 'inspirational'] as const

// ── Styles ──────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: 'var(--surface, #fff)',
  border: '1px solid var(--border, #e2e2e2)',
  borderRadius: 10,
  padding: 24,
  marginBottom: 16,
}

const statCardStyle: React.CSSProperties = {
  ...cardStyle,
  textAlign: 'center' as const,
  flex: 1,
  minWidth: 140,
}

const statLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--ink-soft, #888)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  marginBottom: 6,
}

const statValue: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 800,
  color: 'var(--ink, #111)',
}

const statFoot: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--ink-soft, #888)',
  marginTop: 4,
}

const thStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontWeight: 700,
  color: 'var(--ink-soft, #888)',
  fontSize: 12,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  textAlign: 'left' as const,
  borderBottom: '1px solid var(--border-light, #eee)',
}

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderBottom: '1px solid var(--border-light, #eee)',
  fontSize: 14,
}

const tabBarStyle: React.CSSProperties = {
  display: 'flex',
  gap: 0,
  borderBottom: '2px solid var(--border, #e2e2e2)',
  marginBottom: 24,
}

const filterBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: '6px 14px',
  fontSize: 13,
  fontWeight: active ? 700 : 500,
  border: '1px solid var(--border, #e2e2e2)',
  borderRadius: 6,
  background: active ? 'var(--mint, #d4f5e9)' : 'transparent',
  color: active ? 'var(--ink, #111)' : 'var(--ink-soft, #888)',
  cursor: 'pointer',
})

function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: '10px 20px',
    fontSize: 14,
    fontWeight: active ? 700 : 500,
    color: active ? 'var(--ink, #111)' : 'var(--ink-soft, #888)',
    borderBottom: active ? '2px solid var(--mint, #4ade80)' : '2px solid transparent',
    marginBottom: -2,
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    borderBottomWidth: 2,
    borderBottomStyle: 'solid',
    borderBottomColor: active ? 'var(--mint, #4ade80)' : 'transparent',
  }
}

function tag(color: 'mint' | 'peach' | 'rose' | 'gray'): React.CSSProperties {
  const colors: Record<string, { bg: string; fg: string }> = {
    mint: { bg: 'var(--mint, #d4f5e9)', fg: '#166534' },
    peach: { bg: '#fef3c7', fg: '#92400e' },
    rose: { bg: '#fee2e2', fg: '#991b1b' },
    gray: { bg: '#f3f4f6', fg: '#374151' },
  }
  const c = colors[color]
  return {
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    background: c.bg,
    color: c.fg,
    textTransform: 'capitalize' as const,
  }
}

function statusTag(status: string | null) {
  if (!status) return tag('gray')
  if (['completed', 'active', 'agency', 'pro', 'business', 'enterprise', 'enterprise-plus', 'enterprise_plus', 'professional'].includes(status)) return tag('mint')
  if (['failed', 'cancelled', 'expired'].includes(status)) return tag('rose')
  if (['trial', 'processing', 'pending', 'scripting', 'generating_slides', 'generating_audio', 'assembling', 'starter'].includes(status)) return tag('peach')
  return tag('gray')
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// ── Component ───────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [authState, setAuthState] = useState<'loading' | 'denied' | 'ok'>('loading')
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  const [profiles, setProfiles] = useState<Profile[]>([])
  const [videos, setVideos] = useState<(Video & { user_email?: string })[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedUser, setExpandedUser] = useState<string | null>(null)
  const [videoFilter, setVideoFilter] = useState<string>('all')

  // Music tab state
  const [musicTracks, setMusicTracks] = useState<MusicTrack[]>([])
  const [musicName, setMusicName] = useState('')
  const [musicMood, setMusicMood] = useState<string>(MOOD_OPTIONS[0])
  const [musicFile, setMusicFile] = useState<File | null>(null)
  const [musicUploading, setMusicUploading] = useState(false)
  const [musicError, setMusicError] = useState<string | null>(null)
  const musicFileRef = useRef<HTMLInputElement | null>(null)

  // Referrals tab state
  type ReferrerRow = { email: string; referral_code: string; subscription_status: string; total_signups: number; latest_signup: string | null }
  type ReferredRow = { email: string; full_name: string | null; referred_by: string; created_at: string }
  const [referrers, setReferrers] = useState<ReferrerRow[]>([])
  const [referredUsers, setReferredUsers] = useState<ReferredRow[]>([])
  const [refEmail, setRefEmail] = useState('')
  const [refCode, setRefCode] = useState('')
  const [refSaving, setRefSaving] = useState(false)
  const [refError, setRefError] = useState<string | null>(null)
  const [refSuccess, setRefSuccess] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
    const supabase = createClient()

    // Check auth
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !isAdmin(user.email)) {
      setAuthState('denied')
      setLoading(false)
      return
    }
    setAuthState('ok')

    // Load all data via admin API (bypasses RLS)
    const dataRes = await fetch('/api/admin/data')
    if (!dataRes.ok) {
      console.error('[admin] Data API failed:', dataRes.status)
      setAuthState('denied')
      setLoading(false)
      return
    }
    const adminData = await dataRes.json()

    const loadedProfiles = (adminData.profiles ?? []) as Profile[]
    const loadedVideos = (adminData.videos ?? []) as Video[]
    const loadedBrands = (adminData.brands ?? []) as Brand[]

    setProfiles(loadedProfiles)
    setBrands(loadedBrands)

    // Join user email onto videos
    const profileMap = new Map(loadedProfiles.map(p => [p.id, p.email]))
    setVideos(loadedVideos.map(v => ({ ...v, user_email: profileMap.get(v.user_id) ?? 'Unknown' })))

    // Load music tracks and referral data in parallel
    const [musicRes, referralRes] = await Promise.all([
      fetch('/api/admin/music').catch(() => null),
      fetch('/api/admin/referrals').catch(() => null),
    ])

    if (musicRes?.ok) {
      const tracks = await musicRes.json()
      setMusicTracks(tracks)
    }

    if (referralRes?.ok) {
      const refData = await referralRes.json()
      setReferrers(refData.referrers ?? [])
      setReferredUsers(refData.referredUsers ?? [])
    }

    setLoading(false)
    } catch (err) {
      console.error('[admin] Load failed:', err)
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ── Music handlers ──────────────────────────────────────────────────────

  async function handleMusicUpload() {
    if (!musicFile || !musicName.trim()) {
      setMusicError('Please provide a file and name')
      return
    }
    setMusicUploading(true)
    setMusicError(null)
    try {
      const fd = new FormData()
      fd.append('file', musicFile)
      fd.append('name', musicName.trim())
      fd.append('mood', musicMood)
      const res = await fetch('/api/admin/music', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setMusicTracks(prev => [...prev, data])
      setMusicName('')
      setMusicMood(MOOD_OPTIONS[0])
      setMusicFile(null)
      if (musicFileRef.current) musicFileRef.current.value = ''
    } catch (err) {
      setMusicError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setMusicUploading(false)
    }
  }

  async function handleMusicDelete(id: string) {
    if (!confirm('Delete this track?')) return
    try {
      const res = await fetch('/api/admin/music', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        setMusicTracks(prev => prev.filter(t => t.id !== id))
      }
    } catch { /* ignore */ }
  }

  // ── Auth gates ──────────────────────────────────────────────────────────

  if (authState === 'loading') {
    return (
      <div style={{ maxWidth: 1100 }}>
        <div className="page-head"><div><h1>Admin</h1><p>Back office dashboard.</p></div></div>
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div className="spinner lg" />
          <p style={{ marginTop: 16, color: 'var(--ink-light)', fontSize: 14 }}>Checking access...</p>
        </div>
      </div>
    )
  }

  if (authState === 'denied') {
    return (
      <div style={{ maxWidth: 800 }}>
        <div className="page-head"><div><h1>Admin</h1><p>Back office dashboard.</p></div></div>
        <div className="settings-card" style={{ textAlign: 'center', padding: 48 }}>
          <p style={{ color: 'var(--ink-soft)', fontSize: 15 }}>403 — Access denied. Admin only.</p>
        </div>
      </div>
    )
  }

  // ── Derived data ────────────────────────────────────────────────────────

  const totalUsers = profiles.length
  const totalVideos = videos.length
  const completedVideos = videos.filter(v => v.status === 'completed').length
  const failedVideos = videos.filter(v => v.status === 'failed').length
  const activeSubs = profiles.filter(p => p.subscription_status === 'active').length
  const trialUsers = profiles.filter(p => p.subscription_status === 'trial').length

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekStart = new Date(todayStart); weekStart.setDate(weekStart.getDate() - 7)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const videosToday = videos.filter(v => new Date(v.created_at) >= todayStart).length
  const videosWeek = videos.filter(v => new Date(v.created_at) >= weekStart).length
  const videosMonth = videos.filter(v => new Date(v.created_at) >= monthStart).length

  const recentGenerations = videos.slice(0, 20)

  // Usage: top users by video count
  const userVideoCounts = new Map<string, number>()
  videos.forEach(v => {
    const email = v.user_email ?? 'Unknown'
    userVideoCounts.set(email, (userVideoCounts.get(email) ?? 0) + 1)
  })
  const topUsers = Array.from(userVideoCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)

  // Video status breakdown
  const statusCounts: Record<string, number> = {}
  videos.forEach(v => { statusCounts[v.status] = (statusCounts[v.status] ?? 0) + 1 })

  // User video count map for Users tab
  const userVideoCountMap = new Map<string, number>()
  videos.forEach(v => { userVideoCountMap.set(v.user_id, (userVideoCountMap.get(v.user_id) ?? 0) + 1) })

  // Filtered videos
  const filteredVideos = videoFilter === 'all' ? videos : videos.filter(v => v.status === videoFilter)

  // ── Tab: Overview ─────────────────────────────────────────────────────

  function renderOverview() {
    return (
      <>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
          <div style={{ ...statCardStyle, borderLeft: '4px solid var(--mint, #4ade80)' }}>
            <div style={statLabel}>Total Users</div>
            <div style={statValue}>{totalUsers}</div>
          </div>
          <div style={statCardStyle}>
            <div style={statLabel}>Total Videos</div>
            <div style={statValue}>{totalVideos}</div>
          </div>
          <div style={statCardStyle}>
            <div style={statLabel}>Flyers (est.)</div>
            <div style={statValue}>—</div>
            <div style={statFoot}>Tracking coming soon</div>
          </div>
          <div style={statCardStyle}>
            <div style={statLabel}>Active Subs</div>
            <div style={statValue}>{activeSubs}</div>
          </div>
          <div style={{ ...statCardStyle, borderLeft: '4px solid #fbbf24' }}>
            <div style={statLabel}>Revenue (Month)</div>
            <div style={{ ...statValue, fontSize: 24 }}>$0</div>
            <div style={statFoot}>Connect Stripe</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
          <div style={statCardStyle}>
            <div style={statLabel}>Credits Today</div>
            <div style={statValue}>{videosToday}</div>
          </div>
          <div style={statCardStyle}>
            <div style={statLabel}>Credits This Week</div>
            <div style={statValue}>{videosWeek}</div>
          </div>
          <div style={statCardStyle}>
            <div style={statLabel}>Credits This Month</div>
            <div style={statValue}>{videosMonth}</div>
          </div>
        </div>

        <div style={cardStyle}>
          <h3 style={{ margin: '0 0 4px' }}>Recent Generations</h3>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '0 0 16px' }}>Last 20 videos created.</p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>User</th>
                  <th style={thStyle}>Title</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Created</th>
                </tr>
              </thead>
              <tbody>
                {recentGenerations.map((v, i) => (
                  <tr key={i}>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{v.user_email}</td>
                    <td style={tdStyle}>{v.title ?? 'Untitled'}</td>
                    <td style={tdStyle}><span style={statusTag(v.status)}>{v.status}</span></td>
                    <td style={{ ...tdStyle, color: 'var(--ink-soft)' }}>{fmtDateTime(v.created_at)}</td>
                  </tr>
                ))}
                {recentGenerations.length === 0 && (
                  <tr><td colSpan={4} style={{ ...tdStyle, textAlign: 'center', color: 'var(--ink-light)' }}>No videos yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </>
    )
  }

  // ── Tab: Users ────────────────────────────────────────────────────────

  function renderUsers() {
    return (
      <>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
          <div style={{ ...statCardStyle, borderLeft: '4px solid var(--mint, #4ade80)' }}>
            <div style={statLabel}>Total Users</div>
            <div style={statValue}>{totalUsers}</div>
          </div>
          <div style={statCardStyle}>
            <div style={statLabel}>Active</div>
            <div style={statValue}>{activeSubs}</div>
          </div>
          <div style={statCardStyle}>
            <div style={statLabel}>Trial</div>
            <div style={statValue}>{trialUsers}</div>
          </div>
        </div>

        <div style={cardStyle}>
          <h3 style={{ margin: '0 0 16px' }}>All Users ({totalUsers})</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Company</th>
                  <th style={thStyle}>Plan</th>
                  <th style={thStyle}>Credits</th>
                  <th style={thStyle}>Videos</th>
                  <th style={thStyle}>Joined</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <>
                    <tr
                      key={p.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setExpandedUser(expandedUser === p.id ? null : p.id)}
                    >
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{p.email}</td>
                      <td style={tdStyle}>{p.full_name ?? '—'}</td>
                      <td style={tdStyle}>{p.company_name ?? '—'}</td>
                      <td style={tdStyle}><span style={statusTag(p.subscription_status)}>{p.subscription_status}</span></td>
                      <td style={tdStyle}>{p.credits_remaining}</td>
                      <td style={tdStyle}>{userVideoCountMap.get(p.id) ?? 0}</td>
                      <td style={{ ...tdStyle, color: 'var(--ink-soft)' }}>{fmtDate(p.created_at)}</td>
                    </tr>
                    {expandedUser === p.id && (
                      <tr key={`${p.id}-detail`}>
                        <td colSpan={7} style={{ padding: '12px 24px', background: 'var(--surface-raised, #fafafa)', borderBottom: '1px solid var(--border-light, #eee)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, fontSize: 13 }}>
                            <div><strong>Phone:</strong> {p.phone ?? '—'}</div>
                            <div><strong>Role:</strong> {p.role ?? '—'}</div>
                            <div><strong>Onboarding:</strong> {p.onboarding_completed ? 'Complete' : 'Incomplete'}</div>
                            <div><strong>Default Style:</strong> {p.default_style}</div>
                            <div><strong>Stripe Customer:</strong> {p.stripe_customer_id ?? '—'}</div>
                            <div><strong>Stripe Sub:</strong> {p.stripe_subscription_id ?? '—'}</div>
                            <div><strong>Calendly:</strong> {p.calendly_url ?? '—'}</div>
                            <div><strong>Updated:</strong> {fmtDate(p.updated_at)}</div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
                {profiles.length === 0 && (
                  <tr><td colSpan={7} style={{ ...tdStyle, textAlign: 'center', color: 'var(--ink-light)' }}>No users.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </>
    )
  }

  // ── Tab: Videos ───────────────────────────────────────────────────────

  function renderVideos() {
    return (
      <>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
          <div style={statCardStyle}>
            <div style={statLabel}>Total</div>
            <div style={statValue}>{totalVideos}</div>
          </div>
          <div style={{ ...statCardStyle, borderLeft: '4px solid var(--mint, #4ade80)' }}>
            <div style={statLabel}>Completed</div>
            <div style={statValue}>{completedVideos}</div>
          </div>
          <div style={{ ...statCardStyle, borderLeft: '4px solid #f87171' }}>
            <div style={statLabel}>Failed</div>
            <div style={statValue}>{failedVideos}</div>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>All Videos ({filteredVideos.length})</h3>
            <div style={{ display: 'flex', gap: 6 }}>
              {['all', 'completed', 'processing', 'failed'].map(f => (
                <button key={f} style={filterBtnStyle(videoFilter === f)} onClick={() => setVideoFilter(f)}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Title</th>
                  <th style={thStyle}>User</th>
                  <th style={thStyle}>Style</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Duration</th>
                  <th style={thStyle}>Created</th>
                </tr>
              </thead>
              <tbody>
                {filteredVideos.map((v, i) => (
                  <tr key={i}>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{v.title ?? 'Untitled'}</td>
                    <td style={tdStyle}>{v.user_email}</td>
                    <td style={tdStyle}>{v.voice_id ?? '—'}</td>
                    <td style={tdStyle}><span style={statusTag(v.status)}>{v.status}</span></td>
                    <td style={tdStyle}>{v.duration ? `${v.duration}s` : '—'}</td>
                    <td style={{ ...tdStyle, color: 'var(--ink-soft)' }}>{fmtDateTime(v.created_at)}</td>
                  </tr>
                ))}
                {filteredVideos.length === 0 && (
                  <tr><td colSpan={6} style={{ ...tdStyle, textAlign: 'center', color: 'var(--ink-light)' }}>No videos match filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </>
    )
  }

  // ── Tab: Commerce ─────────────────────────────────────────────────────

  function renderCommerce() {
    const subUsers = profiles.filter(p => p.stripe_customer_id || p.subscription_status === 'active')
    return (
      <>
        <div style={{ ...cardStyle, background: '#fffbeb', borderColor: '#fbbf24', marginBottom: 20 }}>
          <p style={{ margin: 0, fontSize: 14, color: '#92400e' }}>
            <strong>Note:</strong> Connect Stripe to enable live commerce data. Revenue figures are placeholders.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
          <div style={statCardStyle}>
            <div style={statLabel}>Total Revenue</div>
            <div style={statValue}>$0</div>
            <div style={statFoot}>Connect Stripe</div>
          </div>
          <div style={statCardStyle}>
            <div style={statLabel}>This Month</div>
            <div style={statValue}>$0</div>
            <div style={statFoot}>Connect Stripe</div>
          </div>
          <div style={statCardStyle}>
            <div style={statLabel}>Active Subs</div>
            <div style={statValue}>{activeSubs}</div>
          </div>
          <div style={statCardStyle}>
            <div style={statLabel}>Churn Rate</div>
            <div style={statValue}>—</div>
            <div style={statFoot}>Connect Stripe</div>
          </div>
        </div>

        <div style={cardStyle}>
          <h3 style={{ margin: '0 0 4px' }}>Credit Pack Sales</h3>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '0 0 16px' }}>Will populate from Stripe webhooks.</p>
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--ink-light)', fontSize: 14 }}>
            No credit pack sales data yet. Connect Stripe webhooks to track purchases.
          </div>
        </div>

        <div style={cardStyle}>
          <h3 style={{ margin: '0 0 16px' }}>Subscriptions ({subUsers.length})</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>User</th>
                  <th style={thStyle}>Plan</th>
                  <th style={thStyle}>Stripe Customer</th>
                  <th style={thStyle}>Joined</th>
                </tr>
              </thead>
              <tbody>
                {subUsers.map((p, i) => (
                  <tr key={i}>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{p.email}</td>
                    <td style={tdStyle}><span style={statusTag(p.subscription_status)}>{p.subscription_status}</span></td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12 }}>{p.stripe_customer_id ?? '—'}</td>
                    <td style={{ ...tdStyle, color: 'var(--ink-soft)' }}>{fmtDate(p.created_at)}</td>
                  </tr>
                ))}
                {subUsers.length === 0 && (
                  <tr><td colSpan={4} style={{ ...tdStyle, textAlign: 'center', color: 'var(--ink-light)' }}>No subscription users.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={cardStyle}>
          <h3 style={{ margin: '0 0 4px' }}>Refunds</h3>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0 }}>Refunds are managed via the Stripe Dashboard.</p>
        </div>
      </>
    )
  }

  // ── Tab: Usage ────────────────────────────────────────────────────────

  function renderUsage() {
    return (
      <>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
          <div style={statCardStyle}>
            <div style={statLabel}>Total Generations</div>
            <div style={statValue}>{totalVideos}</div>
          </div>
          <div style={statCardStyle}>
            <div style={statLabel}>Today</div>
            <div style={statValue}>{videosToday}</div>
          </div>
          <div style={statCardStyle}>
            <div style={statLabel}>This Week</div>
            <div style={statValue}>{videosWeek}</div>
          </div>
          <div style={statCardStyle}>
            <div style={statLabel}>This Month</div>
            <div style={statValue}>{videosMonth}</div>
          </div>
        </div>

        <div style={cardStyle}>
          <h3 style={{ margin: '0 0 16px' }}>Top Users by Generation Count</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>#</th>
                  <th style={thStyle}>User</th>
                  <th style={thStyle}>Videos</th>
                </tr>
              </thead>
              <tbody>
                {topUsers.map(([email, count], i) => (
                  <tr key={i}>
                    <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--ink-soft)' }}>{i + 1}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{email}</td>
                    <td style={tdStyle}>{count}</td>
                  </tr>
                ))}
                {topUsers.length === 0 && (
                  <tr><td colSpan={3} style={{ ...tdStyle, textAlign: 'center', color: 'var(--ink-light)' }}>No data.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={cardStyle}>
          <h3 style={{ margin: '0 0 16px' }}>Generation Status Breakdown</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Count</th>
                  <th style={thStyle}>%</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(statusCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([status, count], i) => (
                    <tr key={i}>
                      <td style={tdStyle}><span style={statusTag(status)}>{status}</span></td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{count}</td>
                      <td style={{ ...tdStyle, color: 'var(--ink-soft)' }}>{totalVideos ? ((count / totalVideos) * 100).toFixed(1) : 0}%</td>
                    </tr>
                  ))}
                {Object.keys(statusCounts).length === 0 && (
                  <tr><td colSpan={3} style={{ ...tdStyle, textAlign: 'center', color: 'var(--ink-light)' }}>No data.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={cardStyle}>
          <h3 style={{ margin: '0 0 16px' }}>Generation Types</h3>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '0 0 12px' }}>
            Breakdown by content type. Currently tracking videos only — flyer, ad, and brand deck tracking coming soon.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Count</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>Video</td>
                  <td style={tdStyle}>{totalVideos}</td>
                </tr>
                <tr>
                  <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--ink-soft)' }}>Flyer</td>
                  <td style={{ ...tdStyle, color: 'var(--ink-soft)' }}>—</td>
                </tr>
                <tr>
                  <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--ink-soft)' }}>Ad</td>
                  <td style={{ ...tdStyle, color: 'var(--ink-soft)' }}>—</td>
                </tr>
                <tr>
                  <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--ink-soft)' }}>Brand Deck</td>
                  <td style={{ ...tdStyle, color: 'var(--ink-soft)' }}>—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </>
    )
  }

  // ── Referral handlers ──────────────────────────────────────────────────

  async function handleAssignReferralCode(e: React.FormEvent) {
    e.preventDefault()
    if (!refEmail.trim() || !refCode.trim()) return
    setRefSaving(true)
    setRefError(null)
    setRefSuccess(null)
    try {
      const res = await fetch('/api/admin/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: refEmail.trim(), referral_code: refCode.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to assign code')
      setRefSuccess(`Referral code "${refCode.trim()}" assigned to ${refEmail.trim()}`)
      setRefEmail('')
      setRefCode('')
      // Reload referral data
      const refreshRes = await fetch('/api/admin/referrals')
      if (refreshRes.ok) {
        const refData = await refreshRes.json()
        setReferrers(refData.referrers ?? [])
        setReferredUsers(refData.referredUsers ?? [])
      }
    } catch (err) {
      setRefError(err instanceof Error ? err.message : 'Failed to assign code')
    } finally {
      setRefSaving(false)
    }
  }

  // ── Tab: Referrals ───────────────────────────────────────────────────

  function renderReferrals() {
    return (
      <>
        {/* Assign referral code form */}
        <div style={cardStyle}>
          <h3 style={{ margin: '0 0 12px' }}>Assign Referral Code</h3>
          <form onSubmit={handleAssignReferralCode} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--ink-soft, #888)' }}>User Email</label>
              <input
                type="email"
                value={refEmail}
                onChange={e => setRefEmail(e.target.value)}
                placeholder="user@example.com"
                required
                style={{ padding: '8px 12px', border: '1px solid var(--border, #e2e2e2)', borderRadius: 6, fontSize: 14, width: 260 }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--ink-soft, #888)' }}>Referral Code</label>
              <input
                type="text"
                value={refCode}
                onChange={e => setRefCode(e.target.value)}
                placeholder="e.g. vfs"
                required
                style={{ padding: '8px 12px', border: '1px solid var(--border, #e2e2e2)', borderRadius: 6, fontSize: 14, width: 160 }}
              />
            </div>
            <button
              type="submit"
              disabled={refSaving}
              style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: 'var(--mint, #4ade80)', color: '#111', fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: refSaving ? 0.6 : 1 }}
            >
              {refSaving ? 'Saving...' : 'Assign Code'}
            </button>
          </form>
          {refError && <p style={{ color: '#c0392b', fontSize: 13, marginTop: 8, marginBottom: 0 }}>{refError}</p>}
          {refSuccess && <p style={{ color: '#166534', fontSize: 13, marginTop: 8, marginBottom: 0 }}>{refSuccess}</p>}
        </div>

        {/* Referral codes table */}
        <div style={cardStyle}>
          <h3 style={{ margin: '0 0 4px' }}>Referral Codes ({referrers.length})</h3>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '0 0 16px' }}>Users who have a referral code assigned.</p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Code</th>
                  <th style={thStyle}>Owner (Email)</th>
                  <th style={thStyle}>Plan</th>
                  <th style={thStyle}>Total Signups</th>
                  <th style={thStyle}>Latest Signup</th>
                </tr>
              </thead>
              <tbody>
                {referrers.map((r, i) => (
                  <tr key={i}>
                    <td style={{ ...tdStyle, fontWeight: 700, fontFamily: 'monospace' }}>{r.referral_code}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{r.email}</td>
                    <td style={tdStyle}><span style={statusTag(r.subscription_status)}>{r.subscription_status}</span></td>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{r.total_signups}</td>
                    <td style={{ ...tdStyle, color: 'var(--ink-soft)' }}>{r.latest_signup ? fmtDate(r.latest_signup) : '—'}</td>
                  </tr>
                ))}
                {referrers.length === 0 && (
                  <tr><td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: 'var(--ink-light)' }}>No referral codes assigned yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Referred users table */}
        <div style={cardStyle}>
          <h3 style={{ margin: '0 0 4px' }}>Referred Users ({referredUsers.length})</h3>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '0 0 16px' }}>Users who signed up via a referral link.</p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Referred By Code</th>
                  <th style={thStyle}>Signup Date</th>
                </tr>
              </thead>
              <tbody>
                {referredUsers.map((u, i) => (
                  <tr key={i}>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{u.email}</td>
                    <td style={tdStyle}>{u.full_name ?? '—'}</td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontWeight: 600 }}>{u.referred_by}</td>
                    <td style={{ ...tdStyle, color: 'var(--ink-soft)' }}>{fmtDate(u.created_at)}</td>
                  </tr>
                ))}
                {referredUsers.length === 0 && (
                  <tr><td colSpan={4} style={{ ...tdStyle, textAlign: 'center', color: 'var(--ink-light)' }}>No referred users yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </>
    )
  }

  // ── Promo Users ────────────────────────────────────────────────────────
  const [promoEmail, setPromoEmail] = useState('')
  const [promoName, setPromoName] = useState('')
  const [promoMsg, setPromoMsg] = useState('')
  const [promoLoading, setPromoLoading] = useState(false)

  async function handleAddPromoUser(e: React.FormEvent) {
    e.preventDefault()
    if (!promoEmail.trim()) return
    setPromoLoading(true)
    setPromoMsg('')
    try {
      const res = await fetch('/api/admin/promo-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: promoEmail.trim(), name: promoName.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setPromoMsg(`${promoEmail} set to unlimited (agency). ${data.created ? 'Account created — welcome email sent.' : 'Existing account upgraded.'}`)
      setPromoEmail('')
      setPromoName('')
      // Refresh profiles
      const supabase = createClient()
      const { data: p } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
      if (p) setProfiles(p as Profile[])
    } catch (err) {
      setPromoMsg(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
    setPromoLoading(false)
  }

  function renderPromo() {
    const promoUsers = profiles.filter(p => p.subscription_status === 'agency' || p.subscription_status === 'pro' || p.subscription_status === 'business')
    return (
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Promo Users — Unlimited Access</h2>
        <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 20 }}>Add users who get unlimited access (agency tier). Enter their email — if they don&apos;t have an account, one will be created and a welcome email sent with login credentials.</p>

        <form onSubmit={handleAddPromoUser} style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
          <input
            type="email"
            placeholder="Email address"
            value={promoEmail}
            onChange={e => setPromoEmail(e.target.value)}
            required
            className="input"
            style={{ flex: 2, minWidth: 200 }}
          />
          <input
            type="text"
            placeholder="Full name (optional)"
            value={promoName}
            onChange={e => setPromoName(e.target.value)}
            className="input"
            style={{ flex: 1, minWidth: 150 }}
          />
          <button type="submit" disabled={promoLoading} className="btn btn-primary">
            {promoLoading ? 'Adding...' : 'Add Promo User'}
          </button>
        </form>
        {promoMsg && (
          <div style={{ padding: '10px 16px', borderRadius: 8, marginBottom: 20, fontSize: 13, background: promoMsg.startsWith('Error') ? '#fef2f2' : '#f0fdf4', color: promoMsg.startsWith('Error') ? '#991b1b' : '#166534', border: `1px solid ${promoMsg.startsWith('Error') ? '#fecaca' : '#bbf7d0'}` }}>
            {promoMsg}
          </div>
        )}

        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Current Premium Users</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '8px 12px' }}>Email</th>
                <th style={{ textAlign: 'left', padding: '8px 12px' }}>Name</th>
                <th style={{ textAlign: 'left', padding: '8px 12px' }}>Plan</th>
                <th style={{ textAlign: 'left', padding: '8px 12px' }}>Joined</th>
                <th style={{ textAlign: 'left', padding: '8px 12px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {promoUsers.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '8px 12px' }}>{p.email}</td>
                  <td style={{ padding: '8px 12px' }}>{p.full_name ?? '—'}</td>
                  <td style={{ padding: '8px 12px' }}><span style={statusTag(p.subscription_status)}>{p.subscription_status}</span></td>
                  <td style={{ padding: '8px 12px', color: 'var(--ink-soft)' }}>{new Date(p.created_at).toLocaleDateString()}</td>
                  <td style={{ padding: '8px 12px' }}>
                    <button className="btn btn-soft btn-sm" onClick={async () => {
                      if (!confirm(`Remove premium access for ${p.email}?`)) return
                      await fetch('/api/admin/promo-user', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: p.email }) })
                      const supabase = createClient()
                      const { data: updated } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
                      if (updated) setProfiles(updated as Profile[])
                    }}>Remove</button>
                  </td>
                </tr>
              ))}
              {promoUsers.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: 'var(--ink-light)' }}>No premium users yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'users', label: 'Users' },
    { key: 'videos', label: 'Videos' },
    { key: 'commerce', label: 'Commerce' },
    { key: 'usage', label: 'Usage' },
    { key: 'referrals', label: 'Referrals' },
    { key: 'promo', label: 'Promo Users' },
  ]

  return (
    <div style={{ maxWidth: 1100 }}>
      <div className="page-head">
        <div>
          <h1>Admin</h1>
          <p>Back office dashboard — usage tracking and commerce management.</p>
        </div>
      </div>

      {/* Quick Links */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <a
          href="/admin/campaigns"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 18px',
            borderRadius: 8,
            border: '1px solid var(--border, #e2e2e2)',
            background: 'var(--surface, #fff)',
            color: 'var(--ink, #111)',
            fontWeight: 700,
            fontSize: 13,
            textDecoration: 'none',
            cursor: 'pointer',
          }}
        >
          Campaigns
        </a>
        <a
          href="/admin/bulk"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 18px',
            borderRadius: 8,
            border: '1px solid var(--border, #e2e2e2)',
            background: 'var(--surface, #fff)',
            color: 'var(--ink, #111)',
            fontWeight: 700,
            fontSize: 13,
            textDecoration: 'none',
            cursor: 'pointer',
          }}
        >
          Bulk Generate
        </a>
      </div>

      {/* Tab bar */}
      <div style={tabBarStyle}>
        {tabs.map(t => (
          <button key={t.key} style={tabStyle(activeTab === t.key)} onClick={() => setActiveTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div className="spinner lg" />
          <p style={{ marginTop: 16, color: 'var(--ink-light)', fontSize: 14 }}>Loading data...</p>
        </div>
      ) : (
        <>
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'users' && renderUsers()}
          {activeTab === 'videos' && renderVideos()}
          {activeTab === 'commerce' && renderCommerce()}
          {activeTab === 'usage' && renderUsage()}
          {activeTab === 'referrals' && renderReferrals()}
          {activeTab === 'promo' && renderPromo()}
        </>
      )}
    </div>
  )
}
