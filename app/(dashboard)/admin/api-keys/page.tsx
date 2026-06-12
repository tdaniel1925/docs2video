'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface ApiKeyRow {
  id: string
  user_id: string
  key_prefix: string
  name: string | null
  is_active: boolean
  last_used_at: string | null
  created_at: string
  email: string | null
  api_balance: number
}

export default function AdminApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([])
  const [state, setState] = useState<'loading' | 'denied' | 'ok'>('loading')
  const [busy, setBusy] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [createEmail, setCreateEmail] = useState('')
  const [createName, setCreateName] = useState('')
  const [topupEmail, setTopupEmail] = useState('')
  const [topupAmount, setTopupAmount] = useState('')
  const [msg, setMsg] = useState('')

  async function load() {
    const res = await fetch('/api/admin/api-keys')
    if (res.status === 403) { setState('denied'); return }
    const data = await res.json()
    setKeys(data.keys || [])
    setState('ok')
  }
  useEffect(() => { load() }, [])

  async function act(payload: Record<string, unknown>) {
    setBusy(true); setMsg('')
    try {
      const res = await fetch('/api/admin/api-keys', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { setMsg(data.error || 'Failed'); return null }
      return data
    } finally {
      setBusy(false)
    }
  }

  const fmt = (d: string | null) => d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'

  if (state === 'loading') return <div style={{ padding: 64, textAlign: 'center', color: 'var(--ink-light)' }}>Loading…</div>
  if (state === 'denied') return <div style={{ padding: 64, textAlign: 'center' }}><h2>Access Denied</h2></div>

  return (
    <div>
      <div className="page-head">
        <div><h1>API Keys</h1><p style={{ color: 'var(--ink-light)' }}>Issue keys and top up the metered API credit pool. Keys are shown once.</p></div>
        <Link href="/admin" className="btn btn-sm btn-soft" style={{ textDecoration: 'none' }}>← Admin</Link>
      </div>

      {msg && <div className="card" style={{ padding: 12, marginBottom: 16, color: 'var(--rose, #b00)' }}>{msg}</div>}

      {newKey && (
        <div className="card" style={{ padding: 16, marginBottom: 16, border: '2px solid var(--mint, #C7E8A8)' }}>
          <strong>New API key — copy it now, it will not be shown again:</strong>
          <pre style={{ marginTop: 8, padding: 12, background: 'var(--cream, #F4F1EC)', borderRadius: 8, overflowX: 'auto', userSelect: 'all' }}>{newKey}</pre>
          <button className="btn btn-sm btn-soft" onClick={() => setNewKey(null)}>Dismiss</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <div className="card" style={{ padding: 16, flex: '1 1 320px' }}>
          <h3 style={{ marginTop: 0 }}>Create key</h3>
          <input className="input" placeholder="Account email" value={createEmail} onChange={e => setCreateEmail(e.target.value)} style={{ marginBottom: 8, width: '100%' }} />
          <input className="input" placeholder="Label (optional)" value={createName} onChange={e => setCreateName(e.target.value)} style={{ marginBottom: 8, width: '100%' }} />
          <button className="btn btn-sm btn-primary" disabled={busy || !createEmail}
            onClick={async () => {
              const r = await act({ action: 'create', email: createEmail.trim(), name: createName.trim() || undefined })
              if (r?.api_key) { setNewKey(r.api_key); setCreateEmail(''); setCreateName(''); load() }
            }}>Generate</button>
        </div>

        <div className="card" style={{ padding: 16, flex: '1 1 320px' }}>
          <h3 style={{ marginTop: 0 }}>Top up API credits</h3>
          <input className="input" placeholder="Account email" value={topupEmail} onChange={e => setTopupEmail(e.target.value)} style={{ marginBottom: 8, width: '100%' }} />
          <input className="input" type="number" placeholder="Credits to add" value={topupAmount} onChange={e => setTopupAmount(e.target.value)} style={{ marginBottom: 8, width: '100%' }} />
          <button className="btn btn-sm btn-primary" disabled={busy || !topupEmail || !topupAmount}
            onClick={async () => {
              const r = await act({ action: 'topup', email: topupEmail.trim(), amount: Number(topupAmount) })
              if (r?.ok) { setTopupEmail(''); setTopupAmount(''); setMsg('Credits added.'); load() }
            }}>Add credits</button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--line, #e5e0d8)' }}>
              <th style={{ padding: 10 }}>Owner</th>
              <th style={{ padding: 10 }}>Prefix</th>
              <th style={{ padding: 10 }}>Label</th>
              <th style={{ padding: 10 }}>API balance</th>
              <th style={{ padding: 10 }}>Last used</th>
              <th style={{ padding: 10 }}>Status</th>
              <th style={{ padding: 10 }}></th>
            </tr>
          </thead>
          <tbody>
            {keys.length === 0 && <tr><td colSpan={7} style={{ padding: 16, color: 'var(--ink-light)' }}>No keys yet.</td></tr>}
            {keys.map(k => (
              <tr key={k.id} style={{ borderBottom: '1px solid var(--line, #efe9e0)', opacity: k.is_active ? 1 : 0.5 }}>
                <td style={{ padding: 10 }}>{k.email || k.user_id.slice(0, 8)}</td>
                <td style={{ padding: 10, fontFamily: 'monospace' }}>{k.key_prefix}…</td>
                <td style={{ padding: 10 }}>{k.name || '—'}</td>
                <td style={{ padding: 10 }}>{k.api_balance}</td>
                <td style={{ padding: 10 }}>{fmt(k.last_used_at)}</td>
                <td style={{ padding: 10 }}>
                  <span className={`tag ${k.is_active ? 'mint' : 'rose'}`}>{k.is_active ? 'active' : 'revoked'}</span>
                </td>
                <td style={{ padding: 10 }}>
                  {k.is_active && (
                    <button className="btn btn-sm btn-soft" disabled={busy}
                      onClick={async () => { const r = await act({ action: 'revoke', keyId: k.id }); if (r?.ok) load() }}>Revoke</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
