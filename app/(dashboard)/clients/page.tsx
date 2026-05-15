'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Client {
  name: string
  email: string
  videosSent: number
  videoIds: string[]
  lastWatched: string | null
  status: 'new' | 'watched' | 'engaged'
  totalViews: number
  totalPlays: number
  totalChats: number
}

function statusBadge(status: string) {
  const styles: Record<string, { bg: string; color: string }> = {
    engaged: { bg: 'var(--mint, #d4f5e9)', color: '#166534' },
    watched: { bg: '#fef3c7', color: '#92400e' },
    new: { bg: '#f3f4f6', color: '#374151' },
  }
  const s = styles[status] ?? styles.new
  return {
    display: 'inline-block' as const,
    padding: '2px 10px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    background: s.bg,
    color: s.color,
    textTransform: 'capitalize' as const,
  }
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedClient, setExpandedClient] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/clients')
        if (res.ok) {
          const data = await res.json()
          setClients(data.clients ?? [])
        }
      } catch {
        // ignore
      }
      setLoading(false)
    }
    load()
  }, [])

  const filtered = search
    ? clients.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.email.toLowerCase().includes(search.toLowerCase())
      )
    : clients

  return (
    <div style={{ maxWidth: 1100 }}>
      <div className="page-head">
        <div>
          <h1>Clients</h1>
          <p>Track engagement across all clients who have received your videos.</p>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <div style={{
          flex: 1, minWidth: 140, background: 'white', border: '1px solid var(--border-light)',
          borderRadius: 10, padding: '16px 20px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)' }}>{clients.length}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 4 }}>Total Clients</div>
        </div>
        <div style={{
          flex: 1, minWidth: 140, background: 'white', border: '1px solid var(--border-light)',
          borderRadius: 10, padding: '16px 20px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)' }}>{clients.filter(c => c.status === 'engaged').length}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 4 }}>Engaged</div>
        </div>
        <div style={{
          flex: 1, minWidth: 140, background: 'white', border: '1px solid var(--border-light)',
          borderRadius: 10, padding: '16px 20px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)' }}>{clients.filter(c => c.status === 'watched').length}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 4 }}>Watched</div>
        </div>
        <div style={{
          flex: 1, minWidth: 140, background: 'white', border: '1px solid var(--border-light)',
          borderRadius: 10, padding: '16px 20px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)' }}>{clients.filter(c => c.status === 'new').length}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 4 }}>New</div>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          className="input"
          placeholder="Search clients by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 400 }}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div className="spinner lg" />
          <p style={{ marginTop: 16, color: 'var(--ink-light)', fontSize: 14 }}>Loading clients...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          background: 'white',
          border: '1px dashed var(--border)',
          borderRadius: 10,
          padding: '48px',
          textAlign: 'center',
        }}>
          <p style={{ fontSize: 15, color: 'var(--ink-soft)', marginBottom: 8 }}>
            {search ? 'No clients match your search.' : 'No clients yet.'}
          </p>
          {!search && (
            <p style={{ fontSize: 13, color: 'var(--ink-light)' }}>
              Share videos with clients using the Share button on any video to start tracking engagement.
            </p>
          )}
        </div>
      ) : (
        <div style={{
          background: 'white',
          border: '1px solid var(--border-light)',
          borderRadius: 10,
          overflow: 'hidden',
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Name', 'Email', 'Videos Sent', 'Last Watched', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{
                      padding: '10px 14px',
                      fontWeight: 700,
                      color: 'var(--ink-soft)',
                      fontSize: 12,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      textAlign: 'left',
                      borderBottom: '1px solid var(--border-light)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((client) => (
                  <>
                    <tr
                      key={client.email}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setExpandedClient(expandedClient === client.email ? null : client.email)}
                    >
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-light)', fontWeight: 600, fontSize: 14 }}>
                        {client.name || '--'}
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-light)', fontSize: 14 }}>
                        {client.email}
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-light)', fontSize: 14, fontWeight: 700 }}>
                        {client.videosSent}
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-light)', fontSize: 13, color: 'var(--ink-soft)' }}>
                        {client.lastWatched
                          ? new Date(client.lastWatched).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : 'Never'}
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-light)' }}>
                        <span style={statusBadge(client.status)}>{client.status}</span>
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-light)' }}>
                        <a
                          href={`mailto:${client.email}?subject=Following up on your video`}
                          onClick={e => e.stopPropagation()}
                          className="btn btn-soft btn-sm"
                          style={{ fontSize: 12, textDecoration: 'none' }}
                        >
                          Send Follow-up
                        </a>
                      </td>
                    </tr>
                    {expandedClient === client.email && (
                      <tr key={`${client.email}-detail`}>
                        <td colSpan={6} style={{
                          padding: '16px 24px',
                          background: 'var(--bg, #f7f7f7)',
                          borderBottom: '1px solid var(--border-light)',
                        }}>
                          <div style={{ display: 'flex', gap: 24, marginBottom: 12 }}>
                            <div style={{ fontSize: 13 }}>
                              <strong>Views:</strong> {client.totalViews}
                            </div>
                            <div style={{ fontSize: 13 }}>
                              <strong>Plays:</strong> {client.totalPlays}
                            </div>
                            <div style={{ fontSize: 13 }}>
                              <strong>Chat Messages:</strong> {client.totalChats}
                            </div>
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Videos:</div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {client.videoIds.map(id => (
                              <Link
                                key={id}
                                href={`/videos/${id}`}
                                onClick={e => e.stopPropagation()}
                                className="btn btn-soft btn-sm"
                                style={{ fontSize: 12, textDecoration: 'none' }}
                              >
                                View Video
                              </Link>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
