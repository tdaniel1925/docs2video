'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

interface Client {
  id: string
  name: string
  email: string | null
  company: string | null
}

export default function ClientStepPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedId = searchParams.get('clientId') || undefined

  const [mode, setMode] = useState<'choose' | 'existing' | 'new'>('choose')
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // New-client form
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [creating, setCreating] = useState(false)

  const goToContent = useCallback((clientId?: string) => {
    router.push(clientId ? `/create?clientId=${clientId}` : '/create')
  }, [router])

  // Deep-link from the clients list ("Send Video") — skip straight through
  useEffect(() => {
    if (preselectedId) goToContent(preselectedId)
  }, [preselectedId, goToContent])

  const loadClients = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/clients?search=${encodeURIComponent(q)}&sort=last_activity_at&order=desc`)
      const data = await res.json()
      setClients(res.ok ? (data.clients ?? []) : [])
    } catch {
      setClients([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (mode !== 'existing') return
    const t = setTimeout(() => loadClients(search), 250)
    return () => clearTimeout(t)
  }, [mode, search, loadClients])

  async function createClient() {
    if (!newName.trim()) { setError('Please enter a name'); return }
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), email: newEmail.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Could not create client'); setCreating(false); return }
      goToContent(data.client.id)
    } catch {
      setError('Could not create client')
      setCreating(false)
    }
  }

  if (preselectedId) {
    return <div style={styles.wrap}><p style={{ color: 'var(--ink-soft)' }}>Loading…</p></div>
  }

  return (
    <div style={styles.wrap}>
      <h1 style={styles.h1}>Who&rsquo;s this for?</h1>
      <p style={styles.sub}>Pick a client to personalize the video, or skip to make a general one.</p>

      {mode === 'choose' && (
        <div style={styles.cardGrid}>
          <button style={styles.card} onClick={() => setMode('existing')}>
            <div style={styles.cardTitle}>Existing client</div>
            <div style={styles.cardDesc}>Choose someone you&rsquo;ve worked with before</div>
          </button>
          <button style={styles.card} onClick={() => setMode('new')}>
            <div style={styles.cardTitle}>New client</div>
            <div style={styles.cardDesc}>Add a new person as you create</div>
          </button>
          <button style={styles.card} onClick={() => goToContent()}>
            <div style={styles.cardTitle}>Skip</div>
            <div style={styles.cardDesc}>Make a general video, not for anyone specific</div>
          </button>
        </div>
      )}

      {mode === 'existing' && (
        <div>
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search clients by name or email…"
            style={styles.input}
          />
          <div style={styles.list}>
            {loading && <p style={styles.muted}>Searching…</p>}
            {!loading && clients.length === 0 && <p style={styles.muted}>No clients found. Try a different search or add a new one.</p>}
            {clients.map(c => (
              <button key={c.id} style={styles.clientRow} onClick={() => goToContent(c.id)}>
                <span style={{ fontWeight: 600 }}>{c.name}</span>
                <span style={styles.muted}>{c.email || c.company || ''}</span>
              </button>
            ))}
          </div>
          <button style={styles.linkBtn} onClick={() => setMode('choose')}>&larr; Back</button>
        </div>
      )}

      {mode === 'new' && (
        <div style={styles.form}>
          <label style={styles.label}>Name</label>
          <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} placeholder="Client name" style={styles.input} />
          <label style={styles.label}>Email <span style={styles.muted}>(optional)</span></label>
          <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="client@example.com" type="email" style={styles.input} />
          {error && <p style={{ color: '#c03a1f', fontSize: 13, marginTop: 8 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <button style={styles.primaryBtn} onClick={createClient} disabled={creating}>
              {creating ? 'Adding…' : 'Add & continue'}
            </button>
            <button style={styles.linkBtn} onClick={() => { setMode('choose'); setError(null) }}>Back</button>
          </div>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 640, margin: '0 auto', padding: '24px 32px' },
  h1: { fontSize: 24, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 },
  sub: { fontSize: 15, color: 'var(--ink-soft)', marginBottom: 28 },
  cardGrid: { display: 'grid', gap: 12 },
  card: { textAlign: 'left', padding: '18px 20px', borderRadius: 10, border: '1.5px solid var(--border-light)', background: 'white', cursor: 'pointer' },
  cardTitle: { fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 },
  cardDesc: { fontSize: 13, color: 'var(--ink-soft)' },
  input: { width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid var(--border-light)', fontSize: 15, marginBottom: 4 },
  list: { display: 'flex', flexDirection: 'column', gap: 6, margin: '12px 0', maxHeight: 320, overflowY: 'auto' },
  clientRow: { textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 2, padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border-light)', background: 'white', cursor: 'pointer' },
  form: { display: 'flex', flexDirection: 'column' },
  label: { fontSize: 13, fontWeight: 600, color: 'var(--ink)', margin: '10px 0 4px' },
  muted: { fontSize: 13, color: 'var(--ink-light)' },
  primaryBtn: { padding: '12px 24px', borderRadius: 10, background: 'var(--ink)', color: 'white', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' },
  linkBtn: { padding: '12px 8px', background: 'none', border: 'none', color: 'var(--ink-soft)', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
}
