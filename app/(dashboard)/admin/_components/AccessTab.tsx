'use client'

import { useCallback, useEffect, useState } from 'react'
import { useToast } from '../../../_components/Toast'
import { useConfirm } from './useConfirm'
import UserMoneyActions from './UserMoneyActions'
import type { AdminUserRow } from './UsersTab'

/** Manage Access: create an account, grant / remove admin and beta (each asks first). */
export default function AccessTab() {
  const notify = useToast()
  const [ask, confirmDialog] = useConfirm()
  const [admins, setAdmins] = useState<AdminUserRow[]>([])
  const [betas, setBetas] = useState<AdminUserRow[]>([])
  const [q, setQ] = useState('')
  const [results, setResults] = useState<AdminUserRow[]>([])
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ email: '', fullName: '', companyName: '', plan: 'trial', password: '', isBeta: false })

  const loadLists = useCallback(() => {
    fetch('/api/admin/users?only=admins&size=100').then((r) => r.json()).then((d) => setAdmins(d.users ?? [])).catch(() => {})
    fetch('/api/admin/users?only=betas&size=100').then((r) => r.json()).then((d) => setBetas(d.users ?? [])).catch(() => {})
  }, [])
  useEffect(() => { loadLists() }, [loadLists])
  const search = useCallback(() => {
    if (q.trim().length < 2) { setResults([]); return }
    fetch(`/api/admin/users?size=10&q=${encodeURIComponent(q.trim())}`).then((r) => r.json()).then((d) => setResults(d.users ?? [])).catch(() => {})
  }, [q])
  useEffect(() => { const t = setTimeout(search, 300); return () => clearTimeout(t) }, [search])
  const refresh = () => { loadLists(); search() }

  async function create() {
    if (!form.email) { notify('Email is required', 'error'); return }
    const paid = form.plan !== 'trial'
    const r = await ask({
      title: `Create an account for ${form.email}?`,
      body: paid
        ? `They get the ${form.plan} plan and its credits for FREE — no Stripe subscription is made.`
        : 'They start on the free trial.',
      warning: form.isBeta ? 'Beta accounts make videos for free.' : undefined,
      confirmLabel: 'Create account',
    })
    if (!r.ok) return
    setBusy(true)
    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, password: form.password || undefined }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      notify(`Account created: ${form.email}${d.tempPassword ? `\nTemporary password: ${d.tempPassword}` : ''}`, 'success')
      setForm({ email: '', fullName: '', companyName: '', plan: 'trial', password: '', isBeta: false })
      loadLists()
    } catch (e) { notify(e instanceof Error ? e.message : 'Failed to create user', 'error') }
    setBusy(false)
  }

  const list = (rows: AdminUserRow[], empty: string, show: ('admin' | 'beta')[]) => (
    <div className="admin-list" style={{ marginTop: 12 }}>
      {rows.length === 0 && <div className="admin-row admin-muted">{empty}</div>}
      {rows.map((p) => (
        <div key={p.id} className="admin-row">
          <div className="admin-row-main"><span className="admin-row-title">{p.email}</span><span className="admin-row-sub">{p.full_name ?? '—'}</span></div>
          <UserMoneyActions user={p} onChanged={refresh} show={show} />
        </div>
      ))}
    </div>
  )

  return (
    <div>
      <div className="settings-card" style={{ marginBottom: 16 }}>
        <h3>Create a new account</h3>
        <p className="admin-muted">For a client or team member. A paid plan here is free for them — it does not start a Stripe subscription.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, margin: '12px 0' }}>
          <label className="admin-field"><span className="admin-field-label">Email *</span><input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="user@company.com" /></label>
          <label className="admin-field"><span className="admin-field-label">Full name</span><input className="input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Jane Smith" /></label>
          <label className="admin-field"><span className="admin-field-label">Company</span><input className="input" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} placeholder="Acme Inc." /></label>
          <label className="admin-field"><span className="admin-field-label">Plan</span>
            <select className="input" value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}>
              <option value="trial">Free trial</option><option value="pro">Pro (free)</option><option value="business">Business (free)</option><option value="enterprise">Enterprise (free)</option>
            </select>
          </label>
          <label className="admin-field"><span className="admin-field-label">Password (optional)</span><input className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Made for you if empty" /></label>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-ui)', marginBottom: 12 }}>
          <input type="checkbox" checked={form.isBeta} onChange={(e) => setForm({ ...form, isBeta: e.target.checked })} /> Beta account (makes videos for free)
        </label>
        <button className="btn btn-primary" disabled={busy} onClick={create}>{busy ? 'Creating…' : 'Create account'}</button>
      </div>

      <div className="settings-card" style={{ marginBottom: 16 }}>
        <h3>Find someone to give access</h3>
        <input className="input" placeholder="Search by email or name…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginTop: 12, maxWidth: 400 }} aria-label="Search accounts" />
        {results.length > 0 && list(results, '', ['admin', 'beta'])}
      </div>

      <div className="settings-card" style={{ marginBottom: 16 }}>
        <h3>Admins ({admins.length})</h3>
        {list(admins, 'No admins', ['admin'])}
      </div>
      <div className="settings-card">
        <h3>Beta accounts ({betas.length})</h3>
        {list(betas, 'No beta accounts', ['beta'])}
      </div>
      {confirmDialog}
    </div>
  )
}
