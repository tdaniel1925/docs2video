'use client'

import { useMemo, useState } from 'react'
import { Button, Chip } from '../../../_components/kit'

export interface AuditEntry {
  id: string
  admin_id: string
  action: string
  target_user_id: string | null
  details: Record<string, unknown> | null
  created_at: string
  admin_email: string | null
  target_email: string | null
  is_test: boolean
}

/** Plain names for the actions the admin writes. */
const ACTION_NAMES: Record<string, string> = {
  add_credits: 'Gave credits', reset_credits: 'Wiped credits', change_plan: 'Changed plan (app only)',
  change_plan_stripe: 'Changed plan in Stripe', toggle_ban: 'Ban / unban', ban: 'Banned', unban: 'Unbanned',
  set_is_admin: 'Admin access', set_is_beta: 'Beta access', impersonate: 'Logged in as',
  retry_video: 'Retried a video', review_approve: 'Approved a held video', review_reject: 'Rejected a held video',
  billing_cancel: 'Cancel at period end', billing_cancel_now: 'Cancelled now', billing_pause: 'Paused billing', billing_resume: 'Resumed billing',
  api_key_create: 'Made an API key', api_key_revoke: 'Revoked an API key', api_credits_topup: 'Added API credits',
  affiliate_mark_paid: 'Marked affiliates paid', affiliate_approve_pending: 'Approved commissions', affiliate_set_status: 'Changed an affiliate',
  billing_health_dismiss: 'Dismissed billing warning', billing_health_undismiss: 'Restored billing warning',
}

export default function AuditTab({ entries }: { entries: AuditEntry[] }) {
  const [days, setDays] = useState<'7' | '30' | 'all'>('30')
  const [search, setSearch] = useState('')
  const [showTest, setShowTest] = useState(false)
  const hiddenTest = entries.filter((e) => e.is_test).length

  const rows = useMemo(() => {
    const now = Date.now()
    const q = search.toLowerCase()
    return entries.filter((e) => {
      if (!showTest && e.is_test) return false
      if (days !== 'all' && new Date(e.created_at).getTime() < now - Number(days) * 86400000) return false
      if (q && ![e.admin_email, e.target_email, e.action, ACTION_NAMES[e.action]].some((s) => (s || '').toLowerCase().includes(q))) return false
      return true
    })
  }, [entries, days, search, showTest])

  const exportCsv = () => {
    const header = 'Admin,Action,Target,Details,Time'
    const lines = rows.map((e) => [e.admin_email ?? e.admin_id, e.action, e.target_email ?? e.target_user_id ?? '', e.details ? JSON.stringify(e.details).replace(/"/g, '""') : '', e.created_at].map((v) => `"${v}"`).join(','))
    const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const detailText = (d: Record<string, unknown> | null) => {
    if (!d) return ''
    const { reason, value, ...rest } = d as Record<string, unknown>
    const parts: string[] = []
    if (value != null && value !== '') parts.push(String(value))
    if (reason) parts.push(`“${reason}”`)
    const restKeys = Object.keys(rest)
    if (restKeys.length) parts.push(restKeys.map((k) => `${k}: ${typeof rest[k] === 'object' ? JSON.stringify(rest[k]) : rest[k]}`).join(', '))
    return parts.join(' · ')
  }

  return (
    <div className="settings-card">
      <div className="admin-toolbar" style={{ justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>Audit log</h3>
        <Button size="sm" variant="secondary" onClick={exportCsv}>Export CSV</Button>
      </div>
      <div className="admin-toolbar">
        <div className="admin-choice-row" role="radiogroup" aria-label="When" style={{ margin: 0 }}>
          {([['7', 'Last 7 days'], ['30', 'Last 30 days'], ['all', 'All time']] as const).map(([v, l]) => (
            <button key={v} type="button" role="radio" aria-checked={days === v} className={`admin-choice ${days === v ? 'is-on' : ''}`} onClick={() => setDays(v)}>{l}</button>
          ))}
        </div>
        <input className="input" placeholder="Search by email or action…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search the audit log" />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-small)' }}>
          <input type="checkbox" checked={showTest} onChange={(e) => setShowTest(e.target.checked)} /> Show test accounts{hiddenTest ? ` (${hiddenTest} hidden)` : ''}
        </label>
      </div>
      <div className="admin-list">
        {rows.length === 0 && <div className="admin-row admin-muted">Nothing matches.</div>}
        {rows.map((e) => (
          <div key={e.id} className="admin-row">
            <div className="admin-row-main">
              <span className="admin-row-title">{ACTION_NAMES[e.action] ?? e.action.replace(/[_.]/g, ' ')}{e.target_email ? ` — ${e.target_email}` : ''}</span>
              <span className="admin-row-sub">by {e.admin_email ?? 'unknown'} · {new Date(e.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
              {e.details && <span className="admin-row-sub">{detailText(e.details)}</span>}
            </div>
            {e.is_test && <Chip>Test</Chip>}
          </div>
        ))}
      </div>
      <p className="admin-muted">Showing {rows.length} of the latest {entries.length} entries.</p>
    </div>
  )
}
