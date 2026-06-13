'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface AffRow {
  id: string
  user_id: string
  referral_code: string
  promo_code: string | null
  commission_rate: number
  status: string
  created_at: string
  email: string | null
  payout_email?: string | null
  payout_method?: string | null
  pending_cents: number
  approved_cents: number
  paid_cents: number
}

export default function AdminAffiliatesPage() {
  const [rows, setRows] = useState<AffRow[]>([])
  const [state, setState] = useState<'loading' | 'denied' | 'ok'>('loading')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function load() {
    const res = await fetch('/api/admin/affiliates')
    if (res.status === 403) { setState('denied'); return }
    const data = await res.json()
    setRows(data.affiliates || [])
    setState('ok')
  }
  useEffect(() => { load() }, [])

  async function act(payload: Record<string, unknown>) {
    setBusy(true); setMsg('')
    try {
      const res = await fetch('/api/admin/affiliates', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setMsg(data.error || 'Failed'); return null }
      return data
    } finally { setBusy(false) }
  }

  async function exportCsv() {
    const res = await fetch('/api/admin/affiliates', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'export-csv' }),
    })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'affiliate-payouts.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const money = (c: number) => `$${(c / 100).toFixed(2)}`
  if (state === 'loading') return <div style={{ padding: 64, textAlign: 'center', color: 'var(--ink-light)' }}>Loading…</div>
  if (state === 'denied') return <div style={{ padding: 64, textAlign: 'center' }}><h2>Access Denied</h2></div>

  return (
    <div>
      <div className="page-head">
        <div><h1>Affiliates</h1><p style={{ color: 'var(--ink-light)' }}>Recurring 20% commission · manual payouts. Approve after the 30-day hold, export CSV, pay, then mark paid.</p></div>
        <Link href="/admin" className="btn btn-sm btn-soft" style={{ textDecoration: 'none' }}>← Admin</Link>
      </div>

      {msg && <div className="card" style={{ padding: 12, marginBottom: 16 }}>{msg}</div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button className="btn btn-sm btn-soft" disabled={busy}
          onClick={async () => { const r = await act({ action: 'approve-pending' }); if (r) { setMsg(`Approved ${r.approved} commissions past the 30-day hold.`); load() } }}>
          Approve pending (30d+)
        </button>
        <button className="btn btn-sm btn-soft" onClick={exportCsv}>Export payout CSV</button>
        <button className="btn btn-sm btn-primary" disabled={busy}
          onClick={async () => { if (!confirm('Mark all approved commissions as PAID? Do this only after you have sent the money.')) return; const r = await act({ action: 'mark-paid' }); if (r) { setMsg(`Marked ${r.paid} commissions paid (${r.batch}).`); load() } }}>
          Mark approved as paid
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--line, #e5e0d8)' }}>
              <th style={{ padding: 10 }}>Affiliate</th>
              <th style={{ padding: 10 }}>Code</th>
              <th style={{ padding: 10 }}>Payout</th>
              <th style={{ padding: 10 }}>Rate</th>
              <th style={{ padding: 10 }}>Pending</th>
              <th style={{ padding: 10 }}>Approved</th>
              <th style={{ padding: 10 }}>Paid</th>
              <th style={{ padding: 10 }}>Status</th>
              <th style={{ padding: 10 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={9} style={{ padding: 16, color: 'var(--ink-light)' }}>No affiliates yet.</td></tr>}
            {rows.map(a => (
              <tr key={a.id} style={{ borderBottom: '1px solid var(--line, #efe9e0)' }}>
                <td style={{ padding: 10 }}>{a.email || a.user_id.slice(0, 8)}</td>
                <td style={{ padding: 10, fontFamily: 'monospace' }}>{a.promo_code || a.referral_code}</td>
                <td style={{ padding: 10 }}>
                  {a.payout_email
                    ? <span title={a.payout_method || ''}>{a.payout_email}{a.payout_method ? ` (${a.payout_method})` : ''}</span>
                    : <span className="tag rose">missing</span>}
                </td>
                <td style={{ padding: 10 }}>{a.commission_rate}%</td>
                <td style={{ padding: 10 }}>{money(a.pending_cents)}</td>
                <td style={{ padding: 10 }}>{money(a.approved_cents)}</td>
                <td style={{ padding: 10 }}>{money(a.paid_cents)}</td>
                <td style={{ padding: 10 }}><span className={`tag ${a.status === 'active' ? 'mint' : 'rose'}`}>{a.status}</span></td>
                <td style={{ padding: 10 }}>
                  {a.status === 'active'
                    ? <button className="btn btn-sm btn-soft" disabled={busy} onClick={async () => { const r = await act({ action: 'set-status', affiliateId: a.id, status: 'paused' }); if (r) load() }}>Pause</button>
                    : <button className="btn btn-sm btn-soft" disabled={busy} onClick={async () => { const r = await act({ action: 'set-status', affiliateId: a.id, status: 'active' }); if (r) load() }}>Activate</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
