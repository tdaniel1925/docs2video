'use client'

import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'

/**
 * "FOR" — who the project is for. Optional, asked once on step 1.
 *
 * Your most recent clients are chips: press one to pick it, press it again
 * to make the project general. "+ New" adds a client right here; "Find" looks
 * through the rest. The answer rides on the draft (clientId + recipientName)
 * and is reused for the cover greeting, the send email and the share page.
 */
export type PickedClient = { clientId: string | null; name: string }

type Client = { id: string; name: string; email: string | null }

const RECENT = 2

export default function ClientPicker({ value, onPick, disabled }: {
  /** null = nothing chosen. clientId null = general (no client). */
  value: PickedClient | null
  onPick: (c: PickedClient | null) => void
  disabled?: boolean
}) {
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [finding, setFinding] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      fetch(`/api/clients?search=${encodeURIComponent(search)}&sort=last_activity_at&order=desc`)
        .then((r) => (r.ok ? r.json() : { clients: [] }))
        .then((d) => setClients((d.clients ?? []).slice(0, finding ? 8 : RECENT)))
        .catch(() => setClients([]))
    }, 200)
    return () => clearTimeout(t)
  }, [search, finding])

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
      setClients((list) => [{ id: data.client.id, name: data.client.name, email: data.client.email ?? null }, ...list.filter((c) => c.id !== data.client.id)])
      onPick({ clientId: data.client.id, name: data.client.name })
      setAdding(false); setNewName(''); setNewEmail('')
    } catch { setError('Could not add that client') }
    finally { setBusy(false) }
  }

  const pickedId = value?.clientId ?? null
  // The picked client stays on show even when it isn't one of the recent ones.
  const shown = pickedId && !clients.some((c) => c.id === pickedId)
    ? [{ id: pickedId, name: value?.name || 'Your client', email: null }, ...clients]
    : clients

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div className="cf-chips" role="group" aria-label="Your clients">
        {shown.map((c) => {
          const on = c.id === pickedId
          return (
            <button
              key={c.id}
              type="button"
              className="cf-chip"
              aria-pressed={on}
              disabled={disabled}
              onClick={() => onPick(on ? { clientId: null, name: '' } : { clientId: c.id, name: c.name })}
            >
              {c.name}
            </button>
          )
        })}
        <button type="button" className="cf-chip cf-chip--link" aria-expanded={adding} disabled={disabled} onClick={() => { setAdding((a) => !a); setFinding(false) }}>+ New</button>
        <button type="button" className="cf-chip cf-chip--link" aria-expanded={finding} disabled={disabled} onClick={() => { setFinding((f) => !f); setAdding(false); setSearch('') }}>
          <Search size={16} />Find
        </button>
      </div>
      {finding && (
        <input
          type="search" className="cf-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search your clients"
          aria-label="Search your clients" autoFocus
        />
      )}
      {adding && (
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="cf-input" style={{ flex: '1 1 160px' }} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name" aria-label="New client name" />
          <input className="cf-input" style={{ flex: '1 1 200px' }} value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Email (optional)" aria-label="New client email" type="email" />
          <button type="button" className="kit-btn kit-btn--secondary" onClick={() => void create()} disabled={busy}>
            {busy ? 'Adding…' : 'Add'}
          </button>
        </div>
      )}
      {error && <div role="alert" style={{ fontSize: 'var(--fs-small)', color: 'var(--error-text)' }}>{error}</div>}
    </div>
  )
}
