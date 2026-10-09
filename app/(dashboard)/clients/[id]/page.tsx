'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { statusTone, statusWords } from '../client-status'

interface Client {
  id: string
  name: string
  email: string | null
  company: string | null
  phone: string | null
  industry: string | null
  tags: string[]
  notes: string | null
  status: string
  source: string
  total_videos_sent: number
  total_views: number
  total_revenue: number
  first_contact_at: string | null
  last_activity_at: string | null
  created_at: string
}

interface Activity {
  id: string
  type: string
  title: string
  description: string | null
  metadata: Record<string, unknown>
  created_at: string
}

interface Video {
  id: string
  title: string
  thumbnail_url: string | null
  status: string
  created_at: string
  views: number
  plays: number
}

interface SentEmail {
  id: string
  subject: string
  to_email: string
  video_id: string | null
  opened_at: string | null
  created_at: string
}

interface Quote {
  id: string
  client_name: string | null
  total: number
  status: string
  created_at: string
}

const ACTIVITY_ICONS: Record<string, string> = {
  email_sent: '\u2709',
  video_viewed: '\u25B6',
  video_played: '\u25B6',
  chat_message: '\uD83D\uDCAC',
  meeting_booked: '\uD83D\uDCC5',
  payment_received: '\uD83D\uDCB0',
  follow_up: '\uD83D\uDD04',
  note_added: '\uD83D\uDCDD',
  client_created: '\u2795',
  quote_sent: '\uD83D\uDCCB',
}

const STATUS_OPTIONS = ['lead', 'active', 'engaged', 'converted', 'inactive']
const TABS = ['activity', 'videos', 'emails', 'payments'] as const
type Tab = typeof TABS[number]

export default function ClientDetailPage() {
  const params = useParams()
  const router = useRouter()
  const clientId = params.id as string

  const [client, setClient] = useState<Client | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [videos, setVideos] = useState<Video[]>([])
  const [emails, setEmails] = useState<SentEmail[]>([])
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('activity')
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // Edit form state
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editCompany, setEditCompany] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editIndustry, setEditIndustry] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editTags, setEditTags] = useState('')

  // Add note
  const [noteTitle, setNoteTitle] = useState('')
  const [noteDesc, setNoteDesc] = useState('')
  const [addingNote, setAddingNote] = useState(false)

  // New tag
  const [newTag, setNewTag] = useState('')

  const loadClient = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients/${clientId}`)
      if (!res.ok) {
        setMsg({ type: 'err', text: 'Client not found' })
        setLoading(false)
        return
      }
      const data = await res.json()
      setClient(data.client)
      setActivities(data.activities ?? [])
    } catch {
      setMsg({ type: 'err', text: 'Failed to load client' })
    }
    setLoading(false)
  }, [clientId])

  useEffect(() => { loadClient() }, [loadClient])

  // Load tab data
  useEffect(() => {
    if (!client) return
    if (tab === 'activity') {
      fetch(`/api/clients/${clientId}/activities`)
        .then(r => r.json())
        .then(d => setActivities(d.activities ?? []))
        .catch(() => {})
    } else if (tab === 'videos') {
      fetch(`/api/clients/${clientId}/videos`)
        .then(r => r.json())
        .then(d => setVideos(d.videos ?? []))
        .catch(() => {})
    } else if (tab === 'emails' && client.email) {
      // Load from sent_emails
      fetch(`/api/sent-emails?email=${encodeURIComponent(client.email)}`)
        .then(r => r.ok ? r.json() : { emails: [] })
        .then(d => setEmails(d.emails ?? []))
        .catch(() => setEmails([]))
    } else if (tab === 'payments' && client.email) {
      fetch(`/api/quotes?clientEmail=${encodeURIComponent(client.email)}`)
        .then(r => r.ok ? r.json() : { quotes: [] })
        .then(d => setQuotes(d.quotes ?? []))
        .catch(() => setQuotes([]))
    }
  }, [tab, client, clientId])

  function startEdit() {
    if (!client) return
    setEditName(client.name)
    setEditEmail(client.email ?? '')
    setEditCompany(client.company ?? '')
    setEditPhone(client.phone ?? '')
    setEditIndustry(client.industry ?? '')
    setEditStatus(client.status)
    setEditNotes(client.notes ?? '')
    setEditTags((client.tags ?? []).join(', '))
    setEditing(true)
  }

  async function saveEdit() {
    setMsg(null)
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          email: editEmail || null,
          company: editCompany || null,
          phone: editPhone || null,
          industry: editIndustry || null,
          status: editStatus,
          notes: editNotes || null,
          tags: editTags.split(',').map(t => t.trim()).filter(Boolean),
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setClient(data.client)
        setEditing(false)
        setMsg({ type: 'ok', text: 'Client updated' })
      } else {
        const data = await res.json()
        setMsg({ type: 'err', text: data.error || 'Update failed' })
      }
    } catch {
      setMsg({ type: 'err', text: 'Network error' })
    }
  }

  async function handleDelete() {
    try {
      const res = await fetch(`/api/clients/${clientId}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/clients')
      } else {
        setMsg({ type: 'err', text: 'Failed to delete client' })
      }
    } catch {
      setMsg({ type: 'err', text: 'Network error' })
    }
  }

  async function addNote() {
    if (!noteTitle.trim()) return
    setAddingNote(true)
    try {
      const res = await fetch(`/api/clients/${clientId}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: noteTitle, description: noteDesc || undefined }),
      })
      if (res.ok) {
        const data = await res.json()
        setActivities(prev => [data.activity, ...prev])
        setNoteTitle('')
        setNoteDesc('')
      }
    } catch { /* ignore */ }
    setAddingNote(false)
  }

  function addTag() {
    if (!newTag.trim() || !client) return
    const updated = [...(client.tags ?? []), newTag.trim()]
    fetch(`/api/clients/${clientId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: updated }),
    }).then(r => r.json()).then(d => {
      if (d.client) setClient(d.client)
    }).catch(() => {})
    setNewTag('')
  }

  function removeTag(tag: string) {
    if (!client) return
    const updated = (client.tags ?? []).filter(t => t !== tag)
    fetch(`/api/clients/${clientId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: updated }),
    }).then(r => r.json()).then(d => {
      if (d.client) setClient(d.client)
    }).catch(() => {})
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <div className="spinner lg" />
        <p style={{ marginTop: 16, color: 'var(--ink-light)', fontSize: 'var(--fs-ui)' }}>Loading client...</p>
      </div>
    )
  }

  if (!client) {
    return (
      <div style={{ maxWidth: 800, textAlign: 'center', padding: 60 }}>
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--ink-soft)' }}>Client not found.</p>
        <Link href="/clients" className="btn btn-soft btn-sm" style={{ marginTop: 16, textDecoration: 'none' }}>Back to Clients</Link>
      </div>
    )
  }


  return (
    <div style={{ maxWidth: 900 }}>
      {/* Back link */}
      <Link href="/clients" style={{ fontSize: 'var(--fs-small)', color: 'var(--ink-light)', textDecoration: 'none', marginBottom: 16, display: 'inline-block' }}>
        &larr; Back to Clients
      </Link>

      {/* Messages */}
      {msg && (
        <div style={{
          padding: '10px 16px',
          background: msg.type === 'ok' ? 'var(--success-bg)' : 'var(--error-bg)',
          borderRadius: 8,
          marginBottom: 16,
          fontSize: 'var(--fs-ui)',
          color: msg.type === 'ok' ? 'var(--success)' : 'var(--error-text)',
        }}>
          {msg.text}
        </div>
      )}

      {/* Header */}
      {!editing ? (
        <div className="settings-card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 'var(--fs-h3)' }}>{client.name}</h2>
              {client.company && <p style={{ margin: '4px 0 0', fontSize: 'var(--fs-ui)', color: 'var(--ink-soft)' }}>{client.company}</p>}
              <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 8, flexWrap: 'wrap', fontSize: 'var(--fs-small)', color: 'var(--ink-soft)' }}>
                {client.email && <span>{client.email}</span>}
                {client.phone && <span>{client.phone}</span>}
                {client.industry && <span>{client.industry}</span>}
              </div>
              <div style={{ marginTop: 8 }}>
                {/* Same plain words + soft colours as the Clients list. */}
                <span className="cl-status" data-tone={statusTone(client.status)}>{statusWords(client.status)}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button className="btn btn-soft btn-sm" onClick={startEdit}>Edit</button>
              {!confirmDelete ? (
                <button className="btn btn-sm" style={{ background: 'var(--error-bg)', color: 'var(--error-text)', border: '1px solid var(--error-border)' }} onClick={() => setConfirmDelete(true)}>Delete</button>
              ) : (
                <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                  <button className="btn btn-sm" style={{ background: 'var(--error)', color: 'var(--on-ink)', border: 'none' }} onClick={handleDelete}>Yes, delete</button>
                  <button className="btn btn-soft btn-sm" onClick={() => setConfirmDelete(false)}>Cancel</button>
                </div>
              )}
            </div>
          </div>

          {/* Tags */}
          <div style={{ marginTop: 12, display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
            {(client.tags ?? []).map(tag => (
              <span key={tag} className="tag mint" style={{ cursor: 'pointer' }} onClick={() => removeTag(tag)}>
                {tag} &times;
              </span>
            ))}
            <div style={{ display: 'inline-flex', gap: 'var(--space-1)' }}>
              <input
                className="input"
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                placeholder="Add tag..."
                style={{ width: 120, padding: '4px 8px', fontSize: 'var(--fs-caption)' }}
              />
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: 'var(--space-5)', marginTop: 16, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 'var(--fs-small)' }}><strong>{client.total_videos_sent}</strong> videos sent</div>
            <div style={{ fontSize: 'var(--fs-small)' }}><strong>{client.total_views}</strong> total views</div>
            <div style={{ fontSize: 'var(--fs-small)' }}><strong>${((client.total_revenue ?? 0) / 100).toLocaleString()}</strong> revenue</div>
          </div>
        </div>
      ) : (
        /* Edit form */
        <div className="settings-card" style={{ marginBottom: 20 }}>
          <h3>Edit client</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div className="form-group">
              <label className="input-label">Name *</label>
              <input className="input" value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="input-label">Email</label>
              <input className="input" type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="input-label">Company</label>
              <input className="input" value={editCompany} onChange={e => setEditCompany(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="input-label">Phone</label>
              <input className="input" value={editPhone} onChange={e => setEditPhone(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="input-label">Industry</label>
              <input className="input" value={editIndustry} onChange={e => setEditIndustry(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="input-label">Status</label>
              <select className="input" value={editStatus} onChange={e => setEditStatus(e.target.value)}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{statusWords(s)}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="input-label">Tags (comma-separated)</label>
              <input className="input" value={editTags} onChange={e => setEditTags(e.target.value)} placeholder="tag1, tag2" />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="input-label">Notes</label>
              <textarea className="input" rows={3} value={editNotes} onChange={e => setEditNotes(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 12 }}>
            <button className="btn btn-primary btn-sm" onClick={saveEdit}>Save changes</button>
            <button className="btn btn-soft btn-sm" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 'var(--space-1)', marginBottom: 20, borderBottom: '1px solid var(--border-light)', paddingBottom: 0 }}>
        {TABS.map(t => (
          <button
            key={t}
            className={`btn btn-sm ${tab === t ? 'btn-primary' : 'btn-soft'}`}
            onClick={() => setTab(t)}
            style={{ textTransform: 'capitalize', borderRadius: '8px 8px 0 0' }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab: Activity */}
      {tab === 'activity' && (
        <div>
          {/* Add Note form */}
          <div className="settings-card" style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 'var(--fs-ui)' }}>Add note</h3>
            <div className="form-group">
              <input
                className="input"
                value={noteTitle}
                onChange={e => setNoteTitle(e.target.value)}
                placeholder="Note title"
              />
            </div>
            <div className="form-group">
              <textarea
                className="input"
                rows={2}
                value={noteDesc}
                onChange={e => setNoteDesc(e.target.value)}
                placeholder="Details (optional)"
              />
            </div>
            <button className="btn btn-primary btn-sm" onClick={addNote} disabled={addingNote || !noteTitle.trim()}>
              {addingNote ? 'Saving...' : 'Save Note'}
            </button>
          </div>

          {/* Timeline */}
          {activities.length === 0 ? (
            <p style={{ fontSize: 'var(--fs-ui)', color: 'var(--ink-light)', textAlign: 'center', padding: 32 }}>No activity yet.</p>
          ) : (
            <div>
              {activities.map(a => (
                <div key={a.id} className="activity-row" style={{
                  display: 'flex',
                  gap: 'var(--space-3)',
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--border-light)',
                  alignItems: 'flex-start',
                }}>
                  <div style={{ fontSize: 'var(--fs-lead)', lineHeight: 1, marginTop: 2 }}>
                    {ACTIVITY_ICONS[a.type] ?? '\u25CF'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 'var(--fs-ui)' }}>{a.title}</div>
                    {a.description && <div style={{ fontSize: 'var(--fs-small)', color: 'var(--ink-soft)', marginTop: 2 }}>{a.description}</div>}
                  </div>
                  <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-light)', whiteSpace: 'nowrap' }}>
                    {formatRelativeTime(a.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Videos */}
      {tab === 'videos' && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <Link href={`/create/client?clientId=${clientId}`} className="btn btn-primary btn-sm" style={{ textDecoration: 'none' }}>
              Make a video for this client
            </Link>
          </div>
          {videos.length === 0 ? (
            <p style={{ fontSize: 'var(--fs-ui)', color: 'var(--ink-light)', textAlign: 'center', padding: 32 }}>No videos shared with this client yet.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260, 1fr))', gap: 'var(--space-4)' }}>
              {videos.map(v => (
                <Link key={v.id} href={`/videos/${v.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="settings-card" style={{ padding: 0, overflow: 'hidden' }}>
                    {v.thumbnail_url ? (
                      <img src={v.thumbnail_url} alt={v.title} style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }} />
                    ) : (
                      <div style={{ width: '100%', height: 140, background: 'var(--bg-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-light)', fontSize: 'var(--fs-small)' }}>
                        No thumbnail
                      </div>
                    )}
                    <div style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, fontSize: 'var(--fs-ui)' }}>{v.title || 'Untitled'}</div>
                      <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 6, fontSize: 'var(--fs-caption)', color: 'var(--ink-soft)' }}>
                        <span>{v.views} views</span>
                        <span>{v.plays} plays</span>
                        <span>{new Date(v.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Emails */}
      {tab === 'emails' && (
        <div>
          {client.email && (
            <div style={{ marginBottom: 16 }}>
              <a href={`mailto:${client.email}`} className="btn btn-primary btn-sm" style={{ textDecoration: 'none' }}>
                Send Email
              </a>
            </div>
          )}
          {emails.length === 0 ? (
            <p style={{ fontSize: 'var(--fs-ui)', color: 'var(--ink-light)', textAlign: 'center', padding: 32 }}>No emails sent to this client yet.</p>
          ) : (
            <div>
              {emails.map(e => (
                <div key={e.id} className="activity-row" style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--border-light)',
                  alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 'var(--fs-ui)' }}>{e.subject || 'No subject'}</div>
                    <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-soft)', marginTop: 2 }}>
                      {new Date(e.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                  <span className="tag" style={{
                    background: e.opened_at ? 'var(--accent-soft)' : 'var(--surface)',
                    color: e.opened_at ? 'var(--accent-ink)' : 'var(--ink-soft)',
                    borderColor: e.opened_at ? 'var(--accent)' : 'var(--surface)',
                  }}>
                    {e.opened_at ? 'Opened' : 'Sent'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Payments */}
      {tab === 'payments' && (
        <div>
          {quotes.length === 0 ? (
            <p style={{ fontSize: 'var(--fs-ui)', color: 'var(--ink-light)', textAlign: 'center', padding: 32 }}>No quotes or payments for this client.</p>
          ) : (
            <>
              <div style={{ marginBottom: 16, fontSize: 'var(--fs-body)', fontWeight: 700 }}>
                Total revenue: ${quotes.filter(q => q.status === 'paid').reduce((s, q) => s + q.total, 0).toLocaleString()}
              </div>
              {quotes.map(q => (
                <div key={q.id} className="activity-row" style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--border-light)',
                  alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 'var(--fs-ui)' }}>${(q.total / 100).toFixed(2)}</div>
                    <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-soft)', marginTop: 2 }}>
                      {new Date(q.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                  <span className="tag" style={{
                    background: q.status === 'paid' ? 'var(--success-bg)' : q.status === 'accepted' ? 'color-mix(in srgb, var(--link) 12%, var(--bg-card))' : 'var(--surface)',
                    color: q.status === 'paid' ? 'var(--success)' : q.status === 'accepted' ? 'var(--link)' : 'var(--ink-soft)',
                    borderColor: q.status === 'paid' ? 'var(--accent)' : q.status === 'accepted' ? 'color-mix(in srgb, var(--link) 12%, var(--bg-card))' : 'var(--surface)',
                    textTransform: 'capitalize',
                  }}>
                    {q.status}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
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
