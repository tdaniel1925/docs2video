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
  const [subject, setSubject] = useState(`Your Policy Explained — ${title}`)
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-8 shadow-2xl text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round"><path d="M5 13l4 4L19 7"/></svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Email Sent!</h2>
          <p className="text-sm text-slate-400 mb-6">Your presentation has been sent to {toEmail}</p>
          <button onClick={onClose} className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700">Done</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
        <h2 className="text-xl font-bold mb-1">Send to Client</h2>
        <p className="text-sm text-slate-400 mb-6">Email this presentation directly to your client</p>

        {connections.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-slate-400 mb-4">No email accounts connected yet.</p>
            <a href="/settings" className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 inline-block">
              Connect Email in Settings
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {/* From */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">From</label>
              <select value={selectedConnection ?? ''} onChange={(e) => setSelectedConnection(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-blue-500 focus:outline-none">
                {connections.map((c) => (
                  <option key={c.id} value={c.id}>{c.email_address} ({c.provider})</option>
                ))}
              </select>
            </div>

            {/* To */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Client Email</label>
              <input value={toEmail} onChange={(e) => setToEmail(e.target.value)} type="email" required
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                placeholder="client@example.com" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Client Name</label>
              <input value={toName} onChange={(e) => setToName(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                placeholder="John Smith" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Subject</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-blue-500 focus:outline-none" />
            </div>

            {error && <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400">{error}</div>}

            <div className="flex gap-3 pt-2">
              <button onClick={onClose} className="flex-1 rounded-lg border border-white/10 px-4 py-3 text-sm text-slate-300 hover:bg-white/5">Cancel</button>
              <button onClick={handleSend} disabled={sending || !toEmail || !selectedConnection}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {sending ? 'Sending...' : 'Send Email'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
