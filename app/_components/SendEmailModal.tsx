'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../_lib/supabase/client'

interface SendEmailModalProps {
  videoId?: string
  infographicId?: string
  title: string
  clientName?: string
  onClose: () => void
}

export default function SendEmailModal({ videoId, infographicId, title, clientName, onClose }: SendEmailModalProps) {
  const [connections, setConnections] = useState<any[]>([])
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null)
  const [toEmail, setToEmail] = useState('')
  const [toName, setToName] = useState(clientName ?? '')
  const [subject, setSubject] = useState(`Your Presentation — ${title}`)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/email-connections')
      const data = await res.json()
      if (Array.isArray(data)) {
        setConnections(data)
        const def = data.find((c: any) => c.is_default) ?? data[0]
        if (def) setSelectedConnection(def.id)
      }
    }
    load()
  }, [])

  async function handleSend() {
    if (!toEmail || !selectedConnection) return
    setSending(true)
    setError(null)

    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmail,
          toName,
          subject,
          videoId,
          infographicId,
          connectionId: selectedConnection,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send')
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send email')
    }
    setSending(false)
  }

  if (sent) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,26,18,0.5)', backdropFilter: 'blur(8px)' }}>
        <div style={{ width: '100%', maxWidth: 440, background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, padding: 32, textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(199,232,168,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--mint-darker)" strokeWidth="2.5" strokeLinecap="round"><path d="M5 13l4 4L19 7"/></svg>
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 6 }}>Email Sent!</h2>
          <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 24 }}>Your presentation has been sent to {toEmail}</p>
          <button onClick={onClose} className="btn btn-primary">Done</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,26,18,0.5)', backdropFilter: 'blur(8px)' }}>
      <div style={{ width: '100%', maxWidth: 440, background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, padding: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 2 }}>Send to Client</h2>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Email this presentation directly</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--ink-light)', lineHeight: 1 }}>&times;</button>
        </div>

        {connections.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 16 }}>No email accounts connected yet.</p>
            <a href="/settings" className="btn btn-primary">Connect Email in Settings</a>
          </div>
        ) : (
          <div>
            <div className="form-group">
              <label className="input-label">From</label>
              <select value={selectedConnection ?? ''} onChange={(e) => setSelectedConnection(e.target.value)} className="input-select">
                {connections.map((c) => (
                  <option key={c.id} value={c.id}>{c.email_address} ({c.provider})</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="input-label">Client Email</label>
              <input value={toEmail} onChange={(e) => setToEmail(e.target.value)} type="email" required className="input" placeholder="client@example.com" />
            </div>

            <div className="form-group">
              <label className="input-label">Client Name</label>
              <input value={toName} onChange={(e) => setToName(e.target.value)} className="input" placeholder="John Smith" />
            </div>

            <div className="form-group">
              <label className="input-label">Subject</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} className="input" />
            </div>

            {error && (
              <div style={{ borderRadius: 10, background: '#fde8e8', padding: '10px 16px', fontSize: 13, marginBottom: 16, color: '#b91c1c', fontWeight: 600 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button onClick={onClose} className="btn btn-soft" style={{ flex: 1 }}>Cancel</button>
              <button onClick={handleSend} disabled={sending || !toEmail || !selectedConnection} className="btn btn-primary" style={{ flex: 1 }}>
                {sending ? 'Sending...' : 'Send Email'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
