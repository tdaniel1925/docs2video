'use client'

import { useState } from 'react'

interface SmtpSetupModalProps {
  onClose: () => void
  onConnected: () => void
}

export default function SmtpSetupModal({ onClose, onConnected }: SmtpSetupModalProps) {
  const [emailAddress, setEmailAddress] = useState('')
  const [smtpHost, setSmtpHost] = useState('')
  const [smtpPort, setSmtpPort] = useState(587)
  const [smtpUser, setSmtpUser] = useState('')
  const [smtpPass, setSmtpPass] = useState('')
  const [imapHost, setImapHost] = useState('')
  const [imapPort, setImapPort] = useState(993)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/email-connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'smtp',
          emailAddress,
          smtpHost,
          smtpPort,
          smtpUser: smtpUser || emailAddress,
          smtpPass,
          imapHost: imapHost || undefined,
          imapPort: imapHost ? imapPort : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Connection failed')
      onConnected()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed')
    }
    setLoading(false)
  }

  // Quick presets
  function applyPreset(preset: string) {
    switch (preset) {
      case 'outlook':
        setSmtpHost('smtp.office365.com')
        setSmtpPort(587)
        setImapHost('outlook.office365.com')
        setImapPort(993)
        break
      case 'gmail':
        setSmtpHost('smtp.gmail.com')
        setSmtpPort(587)
        setImapHost('imap.gmail.com')
        setImapPort(993)
        break
      case 'yahoo':
        setSmtpHost('smtp.mail.yahoo.com')
        setSmtpPort(587)
        setImapHost('imap.mail.yahoo.com')
        setImapPort(993)
        break
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-8">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
        <h2 className="text-xl font-bold mb-1">Connect Email (SMTP/IMAP)</h2>
        <p className="text-sm text-slate-400 mb-4">Configure your email server settings</p>

        {/* Presets */}
        <div className="flex gap-2 mb-4">
          <span className="text-xs text-slate-500 py-1">Quick setup:</span>
          <button onClick={() => applyPreset('outlook')} className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300 hover:bg-white/10">Outlook/365</button>
          <button onClick={() => applyPreset('gmail')} className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300 hover:bg-white/10">Gmail</button>
          <button onClick={() => applyPreset('yahoo')} className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300 hover:bg-white/10">Yahoo</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Email Address</label>
            <input value={emailAddress} onChange={(e) => setEmailAddress(e.target.value)} type="email" required
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none text-sm"
              placeholder="you@company.com" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-1">SMTP Host</label>
              <input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} required
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none text-sm"
                placeholder="smtp.office365.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Port</label>
              <input value={smtpPort} onChange={(e) => setSmtpPort(Number(e.target.value))} type="number" required
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Username</label>
            <input value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none text-sm"
              placeholder="Same as email (leave blank)" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Password / App Password</label>
            <input value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} type="password" required
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none text-sm"
              placeholder="Your email password or app password" />
          </div>

          <details className="group">
            <summary className="cursor-pointer text-sm text-slate-400 hover:text-white">IMAP Settings (optional — for reading replies)</summary>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-1">IMAP Host</label>
                <input value={imapHost} onChange={(e) => setImapHost(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none text-sm"
                  placeholder="outlook.office365.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Port</label>
                <input value={imapPort} onChange={(e) => setImapPort(Number(e.target.value))} type="number"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none text-sm" />
              </div>
            </div>
          </details>

          {error && <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400">{error}</div>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-white/10 px-4 py-3 text-sm text-slate-300 hover:bg-white/5">Cancel</button>
            <button type="submit" disabled={loading || !emailAddress || !smtpHost || !smtpPass}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Testing & Saving...' : 'Test & Connect'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
