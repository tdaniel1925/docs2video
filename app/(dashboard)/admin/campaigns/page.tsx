'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/app/_lib/supabase/client'
import { isAdmin } from '@/app/_lib/admin'
import InlineConfirm from '@/app/_components/InlineConfirm'

type Campaign = {
  id: string
  name: string
  discount_code: string
  discount_pct: number
  discount_months: number
  status: string
  created_at: string
  contacts_count: number
  sent_count: number
  watched_count: number
  signed_up_count: number
}

type Contact = {
  id: string
  campaign_id: string
  name: string
  email: string
  company: string | null
  industry: string | null
  phone: string | null
  video_id: string | null
  video_status: string
  email_sent_at: string | null
  video_watched_at: string | null
  signed_up_at: string | null
  nurture_stage: number
  unsubscribed: boolean
  created_at: string
}

type View = 'list' | 'detail'

// ── Styles ──────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: 'var(--surface, #fff)',
  border: '1px solid var(--border, #e2e2e2)',
  borderRadius: 10,
  padding: 24,
  marginBottom: 16,
}

const statCardStyle: React.CSSProperties = {
  ...cardStyle,
  textAlign: 'center' as const,
  flex: 1,
  minWidth: 120,
}

const statLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--ink-soft, #888)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  marginBottom: 6,
}

const statValue: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 800,
  color: 'var(--ink, #111)',
}

const thStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontWeight: 700,
  color: 'var(--ink-soft, #888)',
  fontSize: 12,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  textAlign: 'left' as const,
  borderBottom: '1px solid var(--border-light, #eee)',
}

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderBottom: '1px solid var(--border-light, #eee)',
  fontSize: 14,
}

const btnPrimary: React.CSSProperties = {
  padding: '8px 20px',
  borderRadius: 8,
  border: 'none',
  background: 'var(--mint, #4ade80)',
  color: '#111',
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer',
}

const btnSecondary: React.CSSProperties = {
  padding: '6px 14px',
  borderRadius: 6,
  border: '1px solid var(--border, #e2e2e2)',
  background: 'transparent',
  color: 'var(--ink, #111)',
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer',
}

const btnDanger: React.CSSProperties = {
  ...btnSecondary,
  color: '#c0392b',
  borderColor: '#fca5a5',
}

const inputStyle: React.CSSProperties = {
  padding: '8px 12px',
  border: '1px solid var(--border, #e2e2e2)',
  borderRadius: 6,
  fontSize: 14,
  width: '100%',
  boxSizing: 'border-box' as const,
}

function statusTag(status: string): React.CSSProperties {
  const colors: Record<string, { bg: string; fg: string }> = {
    draft: { bg: '#f3f4f6', fg: '#374151' },
    active: { bg: 'var(--mint, #d4f5e9)', fg: '#166534' },
    paused: { bg: '#fef3c7', fg: '#92400e' },
    completed: { bg: 'var(--mint, #d4f5e9)', fg: '#166534' },
    pending: { bg: '#f3f4f6', fg: '#374151' },
    generating: { bg: '#fef3c7', fg: '#92400e' },
    review: { bg: '#dbeafe', fg: '#1e40af' },
    approved: { bg: 'var(--mint, #d4f5e9)', fg: '#166534' },
    skipped: { bg: '#f3f4f6', fg: '#6b7280' },
    sent: { bg: '#dbeafe', fg: '#1e40af' },
  }
  const c = colors[status] || colors.pending
  return {
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    background: c.bg,
    color: c.fg,
    textTransform: 'capitalize' as const,
  }
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Component ───────────────────────────────────────────────────────────────

export default function CampaignsPage() {
  const [authState, setAuthState] = useState<'loading' | 'denied' | 'ok'>('loading')
  const [view, setView] = useState<View>('list')
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<(Campaign & { contacts?: Contact[] }) | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // New campaign form
  const [showNewForm, setShowNewForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCode, setNewCode] = useState('')
  const [newPct, setNewPct] = useState('25')
  const [newMonths, setNewMonths] = useState('3')

  // Add contacts form
  const [showAddContacts, setShowAddContacts] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [singleName, setSingleName] = useState('')
  const [singleEmail, setSingleEmail] = useState('')
  const [singleCompany, setSingleCompany] = useState('')
  const [singleIndustry, setSingleIndustry] = useState('')
  const [addMode, setAddMode] = useState<'bulk' | 'single'>('bulk')

  // ── Auth ────────────────────────────────────────────────────────────

  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !isAdmin(user.email)) {
        setAuthState('denied')
        return
      }
      setAuthState('ok')
      loadCampaigns()
    }
    checkAuth()
  }, [])

  // ── Data loading ─────────────────────────────────────────────────────

  const loadCampaigns = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/campaigns')
      if (res.ok) {
        const data = await res.json()
        setCampaigns(data)
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  const loadCampaignDetail = useCallback(async (id: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/campaigns/${id}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedCampaign(data)
        setContacts(data.contacts ?? [])
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  // ── Actions ─────────────────────────────────────────────────────────

  async function handleCreateCampaign(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim() || !newCode.trim()) return
    setActionLoading('create')
    try {
      const res = await fetch('/api/admin/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          discount_code: newCode.trim(),
          discount_pct: parseInt(newPct) || 25,
          discount_months: parseInt(newMonths) || 3,
        }),
      })
      if (res.ok) {
        setShowNewForm(false)
        setNewName('')
        setNewCode('')
        setNewPct('25')
        setNewMonths('3')
        loadCampaigns()
      }
    } catch { /* ignore */ }
    setActionLoading(null)
  }

  async function handleDeleteCampaign(id: string) {
    setActionLoading('delete')
    try {
      await fetch(`/api/admin/campaigns/${id}`, { method: 'DELETE' })
      loadCampaigns()
      if (selectedCampaign?.id === id) {
        setView('list')
        setSelectedCampaign(null)
      }
    } catch { /* ignore */ }
    setActionLoading(null)
  }

  async function handleAddContacts(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedCampaign) return
    setActionLoading('addContacts')
    try {
      const body = addMode === 'bulk'
        ? { contacts: bulkText }
        : { name: singleName, email: singleEmail, company: singleCompany, industry: singleIndustry }

      const res = await fetch(`/api/admin/campaigns/${selectedCampaign.id}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setBulkText('')
        setSingleName('')
        setSingleEmail('')
        setSingleCompany('')
        setSingleIndustry('')
        setShowAddContacts(false)
        loadCampaignDetail(selectedCampaign.id)
      }
    } catch { /* ignore */ }
    setActionLoading(null)
  }

  async function handleGenerateVideos() {
    if (!selectedCampaign) return
    setActionLoading('generate')
    try {
      const res = await fetch(`/api/admin/campaigns/${selectedCampaign.id}/generate`, { method: 'POST' })
      if (res.ok) {
        loadCampaignDetail(selectedCampaign.id)
      }
    } catch { /* ignore */ }
    setActionLoading(null)
  }

  async function handleApproveAction(contactId: string, action: 'approve' | 'skip' | 'regenerate') {
    if (!selectedCampaign) return
    setActionLoading(`${action}-${contactId}`)
    try {
      await fetch(`/api/admin/campaigns/${selectedCampaign.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId, action }),
      })
      loadCampaignDetail(selectedCampaign.id)
    } catch { /* ignore */ }
    setActionLoading(null)
  }

  async function handleSendApproved() {
    if (!selectedCampaign) return
    setActionLoading('send')
    try {
      const res = await fetch(`/api/admin/campaigns/${selectedCampaign.id}/send`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        alert(`Sent ${data.sent} emails successfully.`)
        loadCampaignDetail(selectedCampaign.id)
      }
    } catch { /* ignore */ }
    setActionLoading(null)
  }

  async function handleRunNurture() {
    setActionLoading('nurture')
    try {
      const res = await fetch('/api/admin/campaigns/nurture', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        alert(`Processed ${data.processed} nurture emails.`)
      }
    } catch { /* ignore */ }
    setActionLoading(null)
  }

  // ── Auth gates ────────────────────────────────────────────────────

  if (authState === 'loading') {
    return (
      <div style={{ maxWidth: 1100 }}>
        <div className="page-head"><div><h1>Campaigns</h1><p>Marketing campaign management.</p></div></div>
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div className="spinner lg" />
          <p style={{ marginTop: 16, color: 'var(--ink-light)', fontSize: 14 }}>Checking access...</p>
        </div>
      </div>
    )
  }

  if (authState === 'denied') {
    return (
      <div style={{ maxWidth: 800 }}>
        <div className="page-head"><div><h1>Campaigns</h1><p>Marketing campaign management.</p></div></div>
        <div className="settings-card" style={{ textAlign: 'center', padding: 48 }}>
          <p style={{ color: 'var(--ink-soft)', fontSize: 15 }}>403 -- Access denied. Admin only.</p>
        </div>
      </div>
    )
  }

  // ── Campaign Detail View ──────────────────────────────────────────

  if (view === 'detail' && selectedCampaign) {
    const pendingContacts = contacts.filter(c => c.video_status === 'pending')
    const reviewContacts = contacts.filter(c => c.video_status === 'review')
    const approvedContacts = contacts.filter(c => c.video_status === 'approved')
    const sentContacts = contacts.filter(c => c.video_status === 'sent')

    return (
      <div style={{ maxWidth: 1100 }}>
        <div className="page-head">
          <div>
            <button onClick={() => { setView('list'); setSelectedCampaign(null) }} style={{ ...btnSecondary, marginBottom: 12 }}>
              &larr; Back to Campaigns
            </button>
            <h1>{selectedCampaign.name}</h1>
            <p>
              Code: <strong>{selectedCampaign.discount_code}</strong> |{' '}
              {selectedCampaign.discount_pct}% off for {selectedCampaign.discount_months} months |{' '}
              <span style={statusTag(selectedCampaign.status)}>{selectedCampaign.status}</span>
            </p>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
          <div style={statCardStyle}><div style={statLabel}>Contacts</div><div style={statValue}>{contacts.length}</div></div>
          <div style={statCardStyle}><div style={statLabel}>Pending</div><div style={statValue}>{pendingContacts.length}</div></div>
          <div style={statCardStyle}><div style={statLabel}>In Review</div><div style={statValue}>{reviewContacts.length}</div></div>
          <div style={statCardStyle}><div style={statLabel}>Approved</div><div style={statValue}>{approvedContacts.length}</div></div>
          <div style={statCardStyle}><div style={statLabel}>Sent</div><div style={statValue}>{sentContacts.length}</div></div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
          <button style={btnPrimary} onClick={() => setShowAddContacts(!showAddContacts)}>
            {showAddContacts ? 'Cancel' : 'Add Contacts'}
          </button>
          {pendingContacts.length > 0 && (
            <InlineConfirm message={`Generate ${pendingContacts.length} videos?`} confirmLabel="Generate" onConfirm={handleGenerateVideos}>
              <button style={btnPrimary}>{`Generate Videos (${pendingContacts.length})`}</button>
            </InlineConfirm>
          )}
          {approvedContacts.length > 0 && (
            <InlineConfirm message={`Send to ${approvedContacts.length} contacts?`} confirmLabel="Send" onConfirm={handleSendApproved}>
              <button style={{ ...btnPrimary, background: '#3b82f6', color: '#fff' }}>{`Send Approved (${approvedContacts.length})`}</button>
            </InlineConfirm>
          )}
          <button style={btnSecondary} onClick={handleRunNurture} disabled={actionLoading === 'nurture'}>
            {actionLoading === 'nurture' ? 'Running...' : 'Run Nurture'}
          </button>
        </div>

        {/* Add Contacts Form */}
        {showAddContacts && (
          <div style={cardStyle}>
            <h3 style={{ margin: '0 0 12px' }}>Add Contacts</h3>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <button style={{ ...btnSecondary, ...(addMode === 'bulk' ? { background: 'var(--mint, #d4f5e9)' } : {}) }} onClick={() => setAddMode('bulk')}>Bulk Import</button>
              <button style={{ ...btnSecondary, ...(addMode === 'single' ? { background: 'var(--mint, #d4f5e9)' } : {}) }} onClick={() => setAddMode('single')}>Single</button>
            </div>
            <form onSubmit={handleAddContacts}>
              {addMode === 'bulk' ? (
                <>
                  <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '0 0 8px' }}>One per line: name, email, company, industry</p>
                  <textarea
                    value={bulkText}
                    onChange={e => setBulkText(e.target.value)}
                    placeholder={"John Doe, john@acme.com, Acme Corp, Technology\nJane Smith, jane@bigco.com, BigCo, Finance"}
                    style={{ ...inputStyle, height: 120, resize: 'vertical', fontFamily: 'monospace', fontSize: 13 }}
                    required
                  />
                </>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <input style={inputStyle} placeholder="Name *" value={singleName} onChange={e => setSingleName(e.target.value)} required />
                  <input style={inputStyle} placeholder="Email *" type="email" value={singleEmail} onChange={e => setSingleEmail(e.target.value)} required />
                  <input style={inputStyle} placeholder="Company" value={singleCompany} onChange={e => setSingleCompany(e.target.value)} />
                  <input style={inputStyle} placeholder="Industry" value={singleIndustry} onChange={e => setSingleIndustry(e.target.value)} />
                </div>
              )}
              <button type="submit" style={{ ...btnPrimary, marginTop: 12 }} disabled={actionLoading === 'addContacts'}>
                {actionLoading === 'addContacts' ? 'Adding...' : 'Add'}
              </button>
            </form>
          </div>
        )}

        {/* Review & Approve Section */}
        {reviewContacts.length > 0 && (
          <div style={{ ...cardStyle, borderLeft: '4px solid #3b82f6' }}>
            <h3 style={{ margin: '0 0 16px' }}>Review & Approve ({reviewContacts.length})</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Company</th>
                  <th style={thStyle}>Video</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reviewContacts.map(c => (
                  <tr key={c.id}>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{c.name}</td>
                    <td style={tdStyle}>{c.company ?? '--'}</td>
                    <td style={tdStyle}>
                      {c.video_id && (
                        <a href={`/watch/${c.video_id}`} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', fontSize: 13 }}>
                          Preview
                        </a>
                      )}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          style={{ ...btnPrimary, padding: '4px 12px', fontSize: 12 }}
                          onClick={() => handleApproveAction(c.id, 'approve')}
                          disabled={!!actionLoading}
                        >Approve</button>
                        <button
                          style={{ ...btnSecondary, padding: '4px 12px', fontSize: 12 }}
                          onClick={() => handleApproveAction(c.id, 'regenerate')}
                          disabled={!!actionLoading}
                        >Regenerate</button>
                        <button
                          style={{ ...btnDanger, padding: '4px 12px', fontSize: 12 }}
                          onClick={() => handleApproveAction(c.id, 'skip')}
                          disabled={!!actionLoading}
                        >Skip</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* All Contacts Table */}
        <div style={cardStyle}>
          <h3 style={{ margin: '0 0 16px' }}>All Contacts ({contacts.length})</h3>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner lg" /></div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Name</th>
                    <th style={thStyle}>Email</th>
                    <th style={thStyle}>Company</th>
                    <th style={thStyle}>Industry</th>
                    <th style={thStyle}>Video Status</th>
                    <th style={thStyle}>Watched</th>
                    <th style={thStyle}>Signed Up</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map(c => (
                    <tr key={c.id}>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{c.name}</td>
                      <td style={tdStyle}>{c.email}</td>
                      <td style={tdStyle}>{c.company ?? '--'}</td>
                      <td style={tdStyle}>{c.industry ?? '--'}</td>
                      <td style={tdStyle}>
                        <span style={statusTag(c.video_status)}>{c.video_status}</span>
                      </td>
                      <td style={tdStyle}>{c.video_watched_at ? fmtDate(c.video_watched_at) : '--'}</td>
                      <td style={tdStyle}>{c.signed_up_at ? fmtDate(c.signed_up_at) : '--'}</td>
                    </tr>
                  ))}
                  {contacts.length === 0 && (
                    <tr><td colSpan={7} style={{ ...tdStyle, textAlign: 'center', color: 'var(--ink-light)' }}>No contacts yet. Add some above.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Campaign List View ────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 1100 }}>
      <div className="page-head">
        <div>
          <h1>Campaigns</h1>
          <p>Marketing campaign management -- personalized video outreach.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button style={btnPrimary} onClick={() => setShowNewForm(!showNewForm)}>
          {showNewForm ? 'Cancel' : 'New Campaign'}
        </button>
        <a href="/admin" style={{ ...btnSecondary, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
          &larr; Admin Dashboard
        </a>
      </div>

      {/* New Campaign Form */}
      {showNewForm && (
        <div style={cardStyle}>
          <h3 style={{ margin: '0 0 16px' }}>Create Campaign</h3>
          <form onSubmit={handleCreateCampaign} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--ink-soft)' }}>Campaign Name</label>
              <input style={inputStyle} value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Q1 Healthcare Outreach" required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--ink-soft)' }}>Discount Code</label>
              <input style={inputStyle} value={newCode} onChange={e => setNewCode(e.target.value)} placeholder="e.g. HEALTH25" required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--ink-soft)' }}>Discount %</label>
              <input style={inputStyle} type="number" value={newPct} onChange={e => setNewPct(e.target.value)} min="1" max="100" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--ink-soft)' }}>Discount Months</label>
              <input style={inputStyle} type="number" value={newMonths} onChange={e => setNewMonths(e.target.value)} min="1" max="24" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <button type="submit" style={btnPrimary} disabled={actionLoading === 'create'}>
                {actionLoading === 'create' ? 'Creating...' : 'Create Campaign'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Campaigns Table */}
      <div style={cardStyle}>
        <h3 style={{ margin: '0 0 16px' }}>All Campaigns ({campaigns.length})</h3>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner lg" /></div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Code</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Contacts</th>
                  <th style={thStyle}>Sent</th>
                  <th style={thStyle}>Watched</th>
                  <th style={thStyle}>Signed Up</th>
                  <th style={thStyle}>Created</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map(c => (
                  <tr key={c.id}>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>
                      <button
                        onClick={() => { setSelectedCampaign(c); setView('detail'); loadCampaignDetail(c.id) }}
                        style={{ background: 'none', border: 'none', color: '#3b82f6', fontWeight: 700, cursor: 'pointer', fontSize: 14, padding: 0, textDecoration: 'underline' }}
                      >{c.name}</button>
                    </td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontWeight: 600 }}>{c.discount_code}</td>
                    <td style={tdStyle}><span style={statusTag(c.status)}>{c.status}</span></td>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{c.contacts_count}</td>
                    <td style={tdStyle}>{c.sent_count}</td>
                    <td style={tdStyle}>{c.watched_count}</td>
                    <td style={tdStyle}>{c.signed_up_count}</td>
                    <td style={{ ...tdStyle, color: 'var(--ink-soft)' }}>{fmtDate(c.created_at)}</td>
                    <td style={tdStyle}>
                      <InlineConfirm message="Delete campaign?" confirmLabel="Delete" onConfirm={() => handleDeleteCampaign(c.id)}>
                        <button style={btnDanger}>Delete</button>
                      </InlineConfirm>
                    </td>
                  </tr>
                ))}
                {campaigns.length === 0 && (
                  <tr><td colSpan={9} style={{ ...tdStyle, textAlign: 'center', color: 'var(--ink-light)' }}>No campaigns yet. Create one above.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
