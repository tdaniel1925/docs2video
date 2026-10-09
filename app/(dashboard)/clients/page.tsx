'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { CLIENT_STATUSES, statusTone, statusWords } from './client-status'

interface Client {
  id: string
  name: string
  email: string | null
  company: string | null
  phone: string | null
  industry: string | null
  tags: string[]
  status: string
  total_videos_sent: number
  total_views: number
  total_revenue: number
  last_activity_at: string | null
  created_at: string
  recent_activity_count: number
}

const STATUS_OPTIONS = ['all', ...CLIENT_STATUSES] as const

/** A client's status as a soft chip in plain words (client-status.ts). */
function StatusChip({ status }: { status: string }) {
  return <span className="cl-status" data-tone={statusTone(status)}>{statusWords(status)}</span>
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showAddForm, setShowAddForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')
  const [importCsv, setImportCsv] = useState('')
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // New client form
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newCompany, setNewCompany] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newIndustry, setNewIndustry] = useState('')

  const loadClients = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const res = await fetch(`/api/clients?${params}`)
      if (res.ok) {
        const data = await res.json()
        setClients(data.clients ?? [])
      }
    } catch {
      // ignore
    }
    setLoading(false)
  }, [search, statusFilter])

  useEffect(() => {
    setLoading(true)
    const debounce = setTimeout(loadClients, 300)
    return () => clearTimeout(debounce)
  }, [loadClients])

  async function handleAddClient(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    setFormSuccess('')
    setSubmitting(true)

    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          email: newEmail || undefined,
          company: newCompany || undefined,
          phone: newPhone || undefined,
          industry: newIndustry || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFormError(data.error || 'Failed to create client')
      } else {
        setFormSuccess(`${newName} added successfully`)
        setNewName('')
        setNewEmail('')
        setNewCompany('')
        setNewPhone('')
        setNewIndustry('')
        setShowAddForm(false)
        loadClients()
      }
    } catch {
      setFormError('Network error')
    }
    setSubmitting(false)
  }

  async function handleImport() {
    setFormError('')
    setImportResult(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/clients/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: importCsv }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFormError(data.error || 'Import failed')
      } else {
        setImportResult(data)
        if (data.imported > 0) loadClients()
      }
    } catch {
      setFormError('Network error')
    }
    setSubmitting(false)
  }

  async function handleExport() {
    try {
      const res = await fetch('/api/clients/export')
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `clients-${new Date().toISOString().split('T')[0]}.csv`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch {
      // ignore
    }
  }

  const activeCount = clients.filter(c => c.status === 'active' || c.status === 'engaged').length
  const engagedThisWeek = clients.filter(c => c.recent_activity_count > 0).length

  return (
    <div style={{ maxWidth: 1100 }}>
      <div className="page-head">
        <div>
          <h1>Clients</h1>
          <p>The people you make videos for — and who has watched.</p>
        </div>
        {/* "Add a client" first: it's the thing people come here to do. */}
        <div className="cl-actions">
          <button className="btn btn-primary btn-sm" onClick={() => { setShowAddForm(!showAddForm); setShowImport(false) }}>Add a client</button>
          <button className="btn btn-soft btn-sm" onClick={() => { setShowImport(!showImport); setShowAddForm(false) }}>Import a CSV file</button>
          <button className="btn btn-soft btn-sm" onClick={handleExport}>Export CSV</button>
        </div>
      </div>

      {/* Three counts. The "Total revenue $0" tile is gone: nothing records a
          client's payments here, so it only ever said $0 (audit 2026-10-09). */}
      <div className="cl-stats">
        <div className="stat-card">
          <div className="stat-value">{clients.length}</div>
          <div className="stat-label">Clients</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{activeCount}</div>
          <div className="stat-label">In touch</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{engagedThisWeek}</div>
          <div className="stat-label">Active this week</div>
        </div>
      </div>

      {/* Success/Error messages */}
      {formSuccess && (
        <div style={{ padding: '10px 16px', background: 'var(--success-bg)', borderRadius: 8, marginBottom: 16, fontSize: 'var(--fs-ui)', color: 'var(--success)' }}>
          {formSuccess}
        </div>
      )}
      {formError && (
        <div style={{ padding: '10px 16px', background: 'var(--error-bg)', borderRadius: 8, marginBottom: 16, fontSize: 'var(--fs-ui)', color: 'var(--error-text)' }}>
          {formError}
        </div>
      )}

      {/* Add Client Form */}
      {showAddForm && (
        <div className="settings-card" style={{ marginBottom: 20 }}>
          <h3>Add a client</h3>
          <form onSubmit={handleAddClient}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <div className="form-group">
                <label className="input-label">Name *</label>
                <input className="input" value={newName} onChange={e => setNewName(e.target.value)} required placeholder="Client name" />
              </div>
              <div className="form-group">
                <label className="input-label">Email</label>
                <input className="input" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="client@example.com" />
              </div>
              <div className="form-group">
                <label className="input-label">Company</label>
                <input className="input" value={newCompany} onChange={e => setNewCompany(e.target.value)} placeholder="Company name" />
              </div>
              <div className="form-group">
                <label className="input-label">Phone</label>
                <input className="input" value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="(555) 123-4567" />
              </div>
              <div className="form-group">
                <label className="input-label">Industry</label>
                <input className="input" value={newIndustry} onChange={e => setNewIndustry(e.target.value)} placeholder="e.g. Insurance, Real Estate" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 12 }}>
              <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
                {submitting ? 'Saving...' : 'Save client'}
              </button>
              <button type="button" className="btn btn-soft btn-sm" onClick={() => setShowAddForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Import a CSV file */}
      {showImport && (
        <div className="settings-card" style={{ marginBottom: 20 }}>
          <h3>Import Clients from CSV</h3>
          <p className="ssub" style={{ marginBottom: 12 }}>Paste CSV with columns: email, name, company, phone. First row should be headers.</p>
          <textarea
            className="input"
            rows={6}
            value={importCsv}
            onChange={e => setImportCsv(e.target.value)}
            placeholder={"email,name,company,phone\njohn@example.com,John Doe,Acme Corp,(555) 123-4567"}
            style={{ fontFamily: 'monospace', fontSize: 'var(--fs-small)' }}
          />
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 12 }}>
            <button className="btn btn-primary btn-sm" onClick={handleImport} disabled={submitting || !importCsv.trim()}>
              {submitting ? 'Importing...' : 'Import'}
            </button>
            <button className="btn btn-soft btn-sm" onClick={() => { setShowImport(false); setImportResult(null) }}>Cancel</button>
          </div>
          {importResult && (
            <div style={{ marginTop: 12, fontSize: 'var(--fs-small)' }}>
              <p style={{ color: 'var(--success)' }}>Imported: {importResult.imported}</p>
              {importResult.skipped > 0 && <p style={{ color: 'var(--warning-text)' }}>Skipped (duplicates): {importResult.skipped}</p>}
              {importResult.errors.length > 0 && (
                <div style={{ color: 'var(--error-text)', marginTop: 4 }}>
                  {importResult.errors.map((e, i) => <p key={i}>{e}</p>)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Search + Filter */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="input"
          placeholder="Search clients..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 320 }}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)', minWidth: 0 }}>
          {STATUS_OPTIONS.map(s => (
            <button
              key={s}
              className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-soft'}`}
              onClick={() => setStatusFilter(s)}
              aria-pressed={statusFilter === s}
            >
              {s === 'all' ? 'All' : statusWords(s)}
            </button>
          ))}
        </div>
      </div>

      {/* Client table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div className="spinner lg" />
          <p style={{ marginTop: 16, color: 'var(--ink-light)', fontSize: 'var(--fs-ui)' }}>Loading clients...</p>
        </div>
      ) : clients.length === 0 ? (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px dashed var(--border)',
          borderRadius: 10,
          padding: 48,
          textAlign: 'center',
        }}>
          <p style={{ fontSize: 'var(--fs-body)', color: 'var(--ink-soft)', marginBottom: 8 }}>
            {search || statusFilter !== 'all' ? 'No clients match your filters.' : 'No clients yet.'}
          </p>
          {!search && statusFilter === 'all' && (
            <p style={{ fontSize: 'var(--fs-small)', color: 'var(--ink-light)' }}>
              Add your first client using the button above, or import a CSV list.
            </p>
          )}
        </div>
      ) : (
        <>
        {/* Phones: one card per client (the table scrolled sideways). */}
        <ul className="cl-cards" aria-label="Your clients">
          {clients.map(client => (
            <li key={client.id} className="cl-card">
              <div className="cl-card-head">
                <div style={{ minWidth: 0 }}>
                  <Link href={`/clients/${client.id}`} className="cl-card-name">{client.name}</Link>
                  {client.company && <div className="cl-card-sub">{client.company}</div>}
                </div>
                <StatusChip status={client.status} />
              </div>
              <div className="cl-card-meta">
                {client.email ?? 'No email'} · {client.total_videos_sent} {client.total_videos_sent === 1 ? 'video' : 'videos'} sent · {client.last_activity_at ? formatRelativeTime(client.last_activity_at) : 'No activity yet'}
              </div>
              <div className="cl-card-actions">
                <Link href={`/clients/${client.id}`} className="btn btn-soft btn-sm">View</Link>
                <Link href={`/create/client${client.id ? `?clientId=${client.id}` : ''}`} className="btn btn-soft btn-sm">Send a video</Link>
                {client.email && <a href={`mailto:${client.email}`} className="btn btn-soft btn-sm">Email</a>}
              </div>
            </li>
          ))}
        </ul>
        <div className="cl-table" style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          borderRadius: 10,
          overflow: 'hidden',
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Name', 'Email', 'Status', 'Videos Sent', 'Last Activity', 'Actions'].map(h => (
                    <th key={h} style={{
                      padding: '10px 14px',
                      fontWeight: 700,
                      color: 'var(--ink-soft)',
                      fontSize: 'var(--fs-caption)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      textAlign: 'left',
                      borderBottom: '1px solid var(--border-light)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clients.map(client => {
                  return (
                    <tr key={client.id} className="activity-row">
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-light)' }}>
                        <div style={{ fontWeight: 600, fontSize: 'var(--fs-ui)' }}>{client.name}</div>
                        {client.company && (
                          <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-light)', marginTop: 2 }}>{client.company}</div>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-light)', fontSize: 'var(--fs-ui)' }}>
                        {client.email ?? '--'}
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-light)' }}>
                        <StatusChip status={client.status} />
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-light)', fontSize: 'var(--fs-ui)', fontWeight: 700 }}>
                        {client.total_videos_sent}
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-light)', fontSize: 'var(--fs-small)', color: 'var(--ink-soft)' }}>
                        {client.last_activity_at
                          ? formatRelativeTime(client.last_activity_at)
                          : 'Never'}
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-light)' }}>
                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                          <Link href={`/clients/${client.id}`} className="btn btn-soft btn-sm" style={{ fontSize: 'var(--fs-caption)', textDecoration: 'none' }}>
                            View
                          </Link>
                          <Link href={`/create/client${client.id ? `?clientId=${client.id}` : ''}`} className="btn btn-soft btn-sm" style={{ fontSize: 'var(--fs-caption)', textDecoration: 'none' }}>
                            Send a video
                          </Link>
                          {client.email && (
                            <a href={`mailto:${client.email}`} className="btn btn-soft btn-sm" style={{ fontSize: 'var(--fs-caption)', textDecoration: 'none' }}>
                              Email
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}
    </div>
  )
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
