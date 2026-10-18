'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useToast } from '../../_components/Toast'
import { Note } from '../../_components/kit'
import type { MoneySummary } from '../../_lib/admin/money'
import NeedsYouCard from './_components/NeedsYouCard'
import UsersTab, { PlanChip, type AdminUserRow } from './_components/UsersTab'
import VideosTab from './_components/VideosTab'
import AccessTab from './_components/AccessTab'
import AuditTab, { type AuditEntry } from './_components/AuditTab'
import ProspectsTab from './_components/ProspectsTab'

type Tab = 'dashboard' | 'users' | 'videos' | 'billing' | 'access' | 'audit' | 'prospects' | 'settings'
const VALID_TABS: Tab[] = ['dashboard', 'users', 'videos', 'billing', 'access', 'audit', 'prospects', 'settings']

interface Counts { users: number; videos: number; completed: number; failed: number; failed24h: number; waitingReview: number; thisWeek: number; cardsOnFile: number }
interface Stats {
  money: MoneySummary | null
  conversion: { eligible: number; paying: number; ratePct: number } | null
  moneyError: string | null
  vpsStatus: string
  dailyActivity: { date: string; users: number; videos: number }[]
}

const dollars = (c: number) => `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

function AdminPageInner() {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab') as Tab | null
  const tab: Tab = tabParam && VALID_TABS.includes(tabParam) ? tabParam : 'dashboard'
  const [state, setState] = useState<'loading' | 'denied' | 'error' | 'ok'>('loading')
  const [error, setError] = useState('')
  const [counts, setCounts] = useState<Counts | null>(null)
  const [recent, setRecent] = useState<AdminUserRow[]>([])
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    fetch('/api/admin/data')
      .then(r => {
        if (r.status === 403) { setState('denied'); return null }
        if (!r.ok) throw new Error('Failed to load')
        return r.json()
      })
      .then(d => {
        if (!d) return
        setCounts(d.counts)
        setRecent(d.recentSignups ?? [])
        setAudit(d.auditLog ?? [])
        setState('ok')
      })
      .catch(e => { setError(e.message); setState('error') })
    fetch('/api/admin/stats').then(r => r.json()).then(setStats).catch(() => {})
  }, [])

  if (state === 'loading') return <div style={{ padding: 64, textAlign: 'center', color: 'var(--ink-light)' }}>Loading admin...</div>
  if (state === 'denied') return <div style={{ padding: 64, textAlign: 'center' }}><h2>Access Denied</h2><p style={{ color: 'var(--ink-light)' }}>You don&apos;t have admin access.</p></div>
  if (state === 'error') return <div style={{ padding: 64, textAlign: 'center' }}><h2>Error</h2><p style={{ color: 'var(--ink-light)' }}>{error}</p></div>

  const m = stats?.money?.docs2video
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div>
      <div className="page-head"><div><h1>Admin</h1></div></div>

      {tab === 'dashboard' && counts && (
        <div>
          <NeedsYouCard />
          <div className="stats-row">
            <div className="stat-card mint"><div className="stat-label">Total Users</div><div className="stat-value">{counts.users.toLocaleString('en-US')}</div></div>
            <div className="stat-card">
              <div className="stat-label">Paying</div><div className="stat-value">{m ? m.paying : '—'}</div>
              {m && <div className="admin-stat-hint">{m.trialing} on trial · {m.pastDue} payment late</div>}
            </div>
            <div className="stat-card peach">
              <div className="stat-label">MRR (paying only)</div><div className="stat-value">{m ? dollars(m.mrrCents) : '—'}</div>
              {stats?.moneyError && <div className="admin-stat-hint">{stats.moneyError}</div>}
            </div>
            <div className="stat-card"><div className="stat-label">This Week</div><div className="stat-value">{counts.thisWeek} videos</div></div>
          </div>
          <div className="stats-row">
            <div className="stat-card"><div className="stat-label">Total Videos</div><div className="stat-value">{counts.videos.toLocaleString('en-US')}</div></div>
            <div className="stat-card mint"><div className="stat-label">Finished</div><div className="stat-value">{counts.completed.toLocaleString('en-US')}</div></div>
            <Link href="/admin?tab=videos&filter=failed&since=24h" className="stat-card" style={counts.failed24h > 0 ? { background: 'var(--rose)', textDecoration: 'none' } : { textDecoration: 'none' }}>
              <div className="stat-label">Didn’t finish</div><div className="stat-value">{counts.failed24h}</div>
              <div className="admin-stat-hint">last 24 hours · {counts.failed.toLocaleString('en-US')} ever</div>
            </Link>
            <VpsStatus status={stats?.vpsStatus} />
          </div>

          <div className="settings-card" style={{ marginTop: 24 }}>
            <h3>Recent sign-ups</h3>
            <div className="admin-list" style={{ marginTop: 12 }}>
              {recent.map(p => (
                <div key={p.id} className="admin-row">
                  <div className="admin-row-main">
                    <Link href={`/admin/users/${p.id}`} className="admin-row-title">{p.email}</Link>
                    <span className="admin-row-sub">{p.full_name ?? '—'} · {fmt(p.created_at)}</span>
                  </div>
                  <PlanChip status={p.subscription_status} />
                </div>
              ))}
              {recent.length === 0 && <div className="admin-row admin-muted">No users yet</div>}
            </div>
            <p className="admin-muted"><Link href="/admin?tab=users" className="admin-link">All users →</Link> · <Link href="/admin?tab=videos" className="admin-link">All videos →</Link></p>
          </div>

          {stats && stats.dailyActivity.length > 0 && (
            <div className="settings-card" style={{ marginTop: 16 }}>
              <h3>Usage (last 30 days)</h3>
              <div className="admin-list" style={{ marginTop: 12, maxHeight: 400, overflowY: 'auto' }}>
                {stats.dailyActivity.map(day => (
                  <div key={day.date} className="admin-row">
                    <div className="admin-row-main"><span className="admin-row-sub">{day.date}</span></div>
                    <span className="admin-row-meta">{day.users} new users · {day.videos} new videos</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'users' && <UsersTab />}
      {tab === 'videos' && <VideosTab />}

      {tab === 'billing' && (
        <div>
          {stats?.moneyError && <Note tone="warn">{stats.moneyError}</Note>}
          <div className="stats-row">
            <div className="stat-card mint"><div className="stat-label">MRR (paying only)</div><div className="stat-value">{m ? dollars(m.mrrCents) : '—'}</div></div>
            <div className="stat-card"><div className="stat-label">Paying</div><div className="stat-value">{m?.paying ?? '—'}</div>{m && m.cancelling > 0 && <div className="admin-stat-hint">{m.cancelling} cancelling at period end</div>}</div>
            <div className="stat-card"><div className="stat-label">On free trial</div><div className="stat-value">{m?.trialing ?? '—'}</div>{m && m.trialingCents > 0 && <div className="admin-stat-hint">{dollars(m.trialingCents)}/mo if they all pay</div>}</div>
            <div className="stat-card" style={m && m.pastDue > 0 ? { background: 'var(--rose)' } : undefined}><div className="stat-label">Payment late</div><div className="stat-value">{m?.pastDue ?? '—'}</div>{m && m.pastDueCents > 0 && <div className="admin-stat-hint">{dollars(m.pastDueCents)}/mo not collected</div>}</div>
          </div>
          <div className="stats-row">
            <div className="stat-card"><div className="stat-label">Paused</div><div className="stat-value">{m?.paused ?? '—'}</div></div>
            <div className="stat-card"><div className="stat-label">Conversion</div><div className="stat-value">{stats?.conversion ? `${stats.conversion.ratePct}%` : '—'}</div>{stats?.conversion && <div className="admin-stat-hint">{stats.conversion.paying} of {stats.conversion.eligible} real sign-ups pay (no test, banned or admin accounts)</div>}</div>
            <div className="stat-card"><div className="stat-label">Cards on file</div><div className="stat-value">{counts?.cardsOnFile ?? '—'}</div></div>
          </div>
          <div className="settings-card" style={{ marginTop: 24 }}>
            <h3>Docs2Video plans</h3>
            <div className="admin-plan-grid">
              {(m?.byPlan ?? []).map((p) => (
                <div key={p.name} className="admin-plan-cell"><b>{p.paying}</b><span>{p.name} · {dollars(p.mrrCents)}/mo{p.trialing ? ` · ${p.trialing} on trial` : ''}{p.pastDue ? ` · ${p.pastDue} late` : ''}</span></div>
              ))}
              {m && m.byPlan.length === 0 && <p className="admin-muted">No Docs2Video subscriptions.</p>}
            </div>
          </div>
          {stats?.money && stats.money.other.count > 0 && (
            <div className="settings-card" style={{ marginTop: 16 }}>
              <h3>Other products on the same Stripe account</h3>
              <p className="admin-muted">Not Docs2Video money — not counted in MRR above.</p>
              <div className="admin-plan-grid">
                {stats.money.other.byName.map((o) => (
                  <div key={o.name} className="admin-plan-cell"><b>{o.count}</b><span>{o.name}</span></div>
                ))}
              </div>
            </div>
          )}
          <div className="settings-card" style={{ marginTop: 16 }}>
            <h3>Every subscription</h3>
            <p className="admin-muted">Cancel, pause or resume one in Billing &amp; Sales. Payments and refunds: Revenue.</p>
            <p><Link href="/admin/billing" className="admin-link">Billing &amp; Sales →</Link> · <Link href="/admin/revenue" className="admin-link">Revenue →</Link> · <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer" className="admin-link">Stripe →</a></p>
          </div>
        </div>
      )}

      {tab === 'access' && <AccessTab />}
      {tab === 'audit' && <AuditTab entries={audit} />}
      {tab === 'prospects' && <ProspectsTab />}
      {tab === 'settings' && <SettingsTab />}
    </div>
  )
}

function SettingsTab() {
  const notify = useToast()
  const [settings, setSettings] = useState<Record<string, string | null>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const load = () => { fetch('/api/admin/settings').then(r => (r.ok ? r.json() : {})).then(setSettings).catch(() => {}) }
  useEffect(() => { load() }, [])
  async function save(key: string, value: boolean | string) {
    setBusy(key)
    setSettings(s => ({ ...s, [key]: String(value) })) // optimistic
    try {
      const r = await fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, value }) })
      if (!r.ok) { const d = await r.json().catch(() => ({})); notify(d.error || 'Failed', 'error'); load() }
    } catch { notify('Network error', 'error'); load() }
    setBusy(null)
  }
  return (
    <div className="card" style={{ padding: 20, maxWidth: 720 }}>
      <div className="section-title" style={{ marginBottom: 6 }}>Video Engine</div>
      <p style={{ fontSize: 'var(--fs-small)', color: 'var(--ink-light)', marginBottom: 18 }}>
        Controls how new videos are rendered. Takes effect immediately — no redeploy.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 16px', border: '1px solid var(--border)', borderRadius: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 260px' }}>
          <div style={{ fontWeight: 700 }}>V3 cinematic / infographic engine</div>
          <div style={{ fontSize: 'var(--fs-small)', color: 'var(--ink-light)', marginTop: 2 }}>
            When ON, new videos render with the V3 Remotion engine (theme auto-selected by content + brand). When OFF, the current pipeline is used.
          </div>
        </div>
        <button className={`btn btn-sm ${settings.video_engine_v3 === 'true' ? 'btn-primary' : 'btn-soft'}`} disabled={busy === 'video_engine_v3'}
          onClick={() => save('video_engine_v3', settings.video_engine_v3 !== 'true')} style={{ minWidth: 64 }}>
          {busy === 'video_engine_v3' ? '…' : settings.video_engine_v3 === 'true' ? 'ON' : 'OFF'}
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 16px', border: '1px solid var(--border)', borderRadius: 10, marginTop: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 260px' }}>
          <div style={{ fontWeight: 700 }}>V3 visual style</div>
          <div style={{ fontSize: 'var(--fs-small)', color: 'var(--ink-light)', marginTop: 2 }}>
            <b>Cinematic</b> = film backgrounds + kinetic text. <b>Editorial</b> = premium magazine layout (EPOCH), brand-colored, typographic.
          </div>
        </div>
        <select value={settings.video_style || 'cinematic'} disabled={busy === 'video_style'} onChange={(e) => save('video_style', e.target.value)} className="input" style={{ width: 180 }}>
          <option value="cinematic">Cinematic</option>
          <option value="editorial">Editorial (clean magazine)</option>
          <option value="explainer">Explainer (friendly modern)</option>
        </select>
      </div>
    </div>
  )
}

export default function AdminPage() {
  return (
    <Suspense fallback={<div style={{ padding: 64, textAlign: 'center', color: 'var(--ink-light)' }}>Loading admin...</div>}>
      <AdminPageInner />
    </Suspense>
  )
}

function VpsStatus({ status: raw }: { status?: string }) {
  const status = !raw ? 'checking' : raw === 'healthy' ? 'healthy' : raw === 'degraded' ? 'degraded' : 'offline'
  const colors = { checking: 'var(--ink-light)', healthy: 'var(--success)', degraded: 'var(--warning)', offline: 'var(--error)' }
  const labels = { checking: 'Checking...', healthy: 'Renderer online', degraded: 'Renderer degraded', offline: 'Renderer offline' }
  return (
    <div className="stat-card" style={status === 'offline' ? { background: 'var(--rose)' } : undefined}>
      <div className="stat-label">Video Server</div>
      <div className="stat-value" style={{ fontSize: 'var(--fs-body)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: colors[status], display: 'inline-block' }} />
        {labels[status]}
      </div>
    </div>
  )
}
