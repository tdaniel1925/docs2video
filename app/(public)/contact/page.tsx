'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PageHead } from '../../_components/marketing/PageHead'

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setError('Please fill in all required fields.')
      return
    }
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Failed to send')
      setSent(true)
    } catch {
      setError('Failed to send message. Please email us directly at support@docs2video.com')
    }
    setSending(false)
  }

  return (
    <>
      <PageHead
        kicker="Contact"
        title="Get in"
        blue="touch"
        sub="Have a question, need a demo, or want to talk about plans for a whole office? Send us a message."
      />

      <div className="hp-grid-2" style={{ alignItems: 'start' }}>
        {sent ? (
          <div className="hp-card" role="status" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 28 }}>
            <span className="hp-num-big" aria-hidden="true">✓</span>
            <h2 className="hp-h3">Message <span className="hp-blue">sent</span></h2>
            <p className="hp-soft">We&apos;ll get back to you as soon as we can.</p>
            <Link href="/" className="hp-btn hp-btn-line" style={{ alignSelf: 'flex-start' }}>Back to home</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="hp-card" style={{ padding: 28 }}>
            <div className="form-group">
              <label className="input-label" htmlFor="c-name">Name *</label>
              <input id="c-name" type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Your name" />
            </div>
            <div className="form-group">
              <label className="input-label" htmlFor="c-email">Email *</label>
              <input id="c-email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="you@company.com" />
            </div>
            <div className="form-group">
              <label className="input-label" htmlFor="c-subject">Subject</label>
              <select id="c-subject" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}>
                <option value="">Select a topic</option>
                <option value="demo">Request a demo</option>
                <option value="pricing">Pricing question</option>
                <option value="enterprise">Enterprise inquiry</option>
                <option value="support">Technical support</option>
                <option value="partnership">Partnership opportunity</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label className="input-label" htmlFor="c-message">Message *</label>
              <textarea id="c-message" value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} placeholder="Tell us how we can help..." rows={5} style={{ resize: 'vertical' }} />
            </div>

            {error && <div className="form-error form-group" role="alert">{error}</div>}

            <button type="submit" disabled={sending} className="btn btn-primary btn-lg btn-full">
              {sending ? 'Sending...' : 'Send message'}
            </button>
          </form>
        )}

        <div className="hp-card" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 28 }}>
          <span className="hp-kicker">Or write to us</span>
          <a href="mailto:support@docs2video.com" style={{ fontSize: 18, fontWeight: 700 }}>support@docs2video.com</a>
          <p className="hp-soft">Questions about your account, billing or a video — or plans for a whole office.</p>
          <Link href="/pricing" className="hp-btn hp-btn-line" style={{ alignSelf: 'flex-start' }}>See pricing</Link>
        </div>
      </div>
    </>
  )
}
