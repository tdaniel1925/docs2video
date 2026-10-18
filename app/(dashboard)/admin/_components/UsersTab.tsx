'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { LogIn } from 'lucide-react'
import { Button, Chip } from '../../../_components/kit'
import { useToast } from '../../../_components/Toast'
import { useConfirm } from './useConfirm'
import UserMoneyActions from './UserMoneyActions'

export interface AdminUserRow {
  id: string
  email: string
  full_name: string | null
  company_name?: string | null
  subscription_status: string | null
  is_admin: boolean
  is_beta: boolean
  card_on_file?: boolean
  created_at: string
  credits: number
}

export function PlanChip({ status }: { status: string | null }) {
  const v = (status || 'free').toLowerCase()
  const tone = v === 'past_due' || v === 'banned' ? 'stop' : ['pro', 'professional', 'business', 'enterprise', 'starter', 'active', 'agency'].includes(v) ? 'ok' : v === 'trial' ? 'info' : 'neutral'
  const label = v === 'past_due' ? 'Payment late' : v === 'banned' ? 'Banned' : v.charAt(0).toUpperCase() + v.slice(1)
  return <Chip tone={tone}>{label}</Chip>
}

/** Users tab: searched and paged on the server, 50 at a time. */
export default function UsersTab() {
  const notify = useToast()
  const [ask, confirmDialog] = useConfirm()
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [data, setData] = useState<{ users: AdminUserRow[]; total: number; size: number } | null>(null)

  const load = useCallback(() => {
    fetch(`/api/admin/users?page=${page}&q=${encodeURIComponent(query)}`)
      .then((r) => r.json()).then((d) => setData(d)).catch(() => notify('Could not load users', 'error'))
  }, [page, query, notify])
  useEffect(() => { load() }, [load])
  useEffect(() => { const t = setTimeout(() => { setPage(0); setQuery(q.trim()) }, 300); return () => clearTimeout(t) }, [q])

  async function loginAs(u: AdminUserRow) {
    const r = await ask({
      title: `Log in as ${u.email}?`,
      body: 'You will see the app exactly as they do, to help them. Anything you press is done as them. Use “Exit impersonation” at the top to come back.',
      confirmLabel: 'Log in as them',
    })
    if (!r.ok) return
    const res = await fetch('/api/admin/impersonate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'start', userId: u.id }) })
    const d = await res.json().catch(() => ({}))
    if (!res.ok || !d.actionLink) { notify(d.error || 'Could not log in as them', 'error'); return }
    window.location.href = d.actionLink
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1
  return (
    <div>
      <div className="admin-toolbar">
        <input className="input" placeholder="Search by email or name…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" />
        {data && <span className="admin-muted">{data.total.toLocaleString('en-US')} accounts</span>}
      </div>
      <div className="admin-list">
        {!data && <div className="admin-row admin-muted">Loading…</div>}
        {data?.users.length === 0 && <div className="admin-row admin-muted">No accounts found.</div>}
        {data?.users.map((u) => (
          <div key={u.id} className="admin-row">
            <div className="admin-row-main">
              <Link href={`/admin/users/${u.id}`} className="admin-row-title">{u.email}</Link>
              <span className="admin-row-sub">{u.full_name || '—'} · joined {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </div>
            <div className="admin-row-meta">
              <PlanChip status={u.subscription_status} />
              <Chip tone="money">{u.credits.toLocaleString('en-US')} credits</Chip>
              {u.is_admin && <Chip tone="strong">Admin</Chip>}
              {u.is_beta && <Chip tone="info">Beta</Chip>}
            </div>
            <UserMoneyActions user={u} onChanged={load} compact show={['plan', 'credits']} />
            {!u.is_admin && <Button size="sm" variant="quiet" onClick={() => loginAs(u)}><LogIn size={14} aria-hidden="true" /> Log in as</Button>}
          </div>
        ))}
      </div>
      {data && data.total > data.size && (
        <div className="admin-pager">
          <Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>← Back</Button>
          <span>Page {page + 1} of {pages}</span>
          <Button size="sm" variant="secondary" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Next →</Button>
        </div>
      )}
      {confirmDialog}
    </div>
  )
}
