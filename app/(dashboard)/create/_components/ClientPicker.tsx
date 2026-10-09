'use client'

import { useEffect, useState } from 'react'

/**
 * WHO IS IT FOR? — asked ONCE, on the first screen.
 *
 * This replaces the separate /create/client page. The answer rides on the
 * draft (clientId + recipientName) and is reused for the cover greeting, the
 * send email and the share page, so the later steps never ask again.
 */
export type PickedClient = { clientId: string | null; name: string }

type Client = { id: string; name: string; email: string | null }

export default function ClientPicker({ value, onPick }: {
  /** null = not chosen yet. clientId null = "no client — general". */
  value: PickedClient | null
  onPick: (c: PickedClient | null) => void
}) {
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (value) return
    const t = setTimeout(() => {
      fetch(`/api/clients?search=${encodeURIComponent(search)}&sort=last_activity_at&order=desc`)
        .then((r) => (r.ok ? r.json() : { clients: [] }))
        .then((d) => setClients((d.clients ?? []).slice(0, 6)))
        .catch(() => setClients([]))
    }, 200)
    return () => clearTimeout(t)
  }, [search, value])

  async function create() {
    if (!newName.trim()) { setError('Add their name'); return }
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/clients', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), email: newEmail.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Could not add that client'); return }
      onPick({ clientId: data.client.id, name: data.client.name })
      setAdding(false); setNewName(''); setNewEmail('')
    } catch { setError('Could not add that client') }
    finally { setBusy(false) }
  }

  const chip = (on: boolean): React.CSSProperties => ({
    padding: '10px 14px', borderRadius: 9, fontSize: 'var(--fs-ui)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
    border: on ? '2px solid var(--ink)' : '1px solid var(--border)',
    background: on ? 'var(--accent-soft)' : 'var(--bg)', color: 'var(--ink)',
  })

  if (value) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-soft)', fontSize: 'var(--fs-body)' }}>
        <span><strong>{value.clientId ? value.name : 'No client — general'}</strong></span>
        <button type="button" onClick={() => onPick(null)} style={{ background: 'none', border: 'none', fontSize: 'var(--fs-small)', color: 'var(--link)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Change</button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        {clients.map((c) => (
          <button key={c.id} type="button" style={chip(false)} onClick={() => onPick({ clientId: c.id, name: c.name })}>{c.name}</button>
        ))}
        <button type="button" style={chip(adding)} onClick={() => setAdding((a) => !a)}>+ New client</button>
        <button type="button" style={chip(false)} onClick={() => onPick({ clientId: null, name: '' })}>No client — general</button>
      </div>
      <input
        type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search your clients"
        aria-label="Search your clients"
        style={{ width: '100%', padding: '10px 14px', borderRadius: 9, border: '1px solid var(--border)', fontSize: 'var(--fs-ui)', fontFamily: 'inherit', background: 'var(--bg)' }}
      />
      {adding && (
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name" aria-label="New client name"
            style={{ flex: '1 1 180px', padding: '10px 14px', borderRadius: 9, border: '1px solid var(--border)', fontSize: 'var(--fs-ui)', fontFamily: 'inherit' }} />
          <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Email (optional)" aria-label="New client email" type="email"
            style={{ flex: '1 1 200px', padding: '10px 14px', borderRadius: 9, border: '1px solid var(--border)', fontSize: 'var(--fs-ui)', fontFamily: 'inherit' }} />
          <button type="button" onClick={() => void create()} disabled={busy}
            style={{ padding: '10px 16px', borderRadius: 9, border: 'none', background: 'var(--ink)', color: 'var(--on-ink)', fontWeight: 700, fontSize: 'var(--fs-ui)', cursor: 'pointer', fontFamily: 'inherit' }}>
            {busy ? 'Adding…' : 'Add'}
          </button>
        </div>
      )}
      {error && <div role="alert" style={{ fontSize: 'var(--fs-small)', color: 'var(--error)' }}>{error}</div>}
    </div>
  )
}
