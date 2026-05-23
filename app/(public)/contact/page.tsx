'use client'

import { useState } from 'react'
import Link from 'next/link'

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
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '3rem 1.5rem' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>

        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <img src="/logo.png" alt="Docs2Video" style={{ height: 56, marginBottom: 24 }} />
          </Link>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--ink)', marginBottom: 8 }}>Get in touch</h1>
          <p style={{ fontSize: 16, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
            Have a question, need a demo, or want to discuss enterprise pricing? We&apos;d love to hear from you.
          </p>
        </div>

        {sent ? (
          <div style={{
            padding: '40px 32px', borderRadius: 10, background: 'var(--surface)',
            border: '1px solid var(--border)', textAlign: 'center',
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>&#10003;</div>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Message sent</h2>
            <p style={{ fontSize: 15, color: 'var(--ink-soft)', marginBottom: 24 }}>
              We&apos;ll get back to you within 24 hours.
            </p>
            <Link href="/" style={{
              display: 'inline-block', padding: '12px 28px', borderRadius: 8,
              background: 'var(--ink)', color: 'white', fontSize: 14, fontWeight: 700, textDecoration: 'none',
            }}>
              Back to home
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{
            padding: '32px', borderRadius: 10, background: 'var(--surface)',
            border: '1px solid var(--border)',
          }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', display: 'block', marginBottom: 6 }}>Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Your name"
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border)',
                  fontSize: 15, fontFamily: 'inherit', outline: 'none',
                }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', display: 'block', marginBottom: 6 }}>Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="you@company.com"
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border)',
                  fontSize: 15, fontFamily: 'inherit', outline: 'none',
                }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', display: 'block', marginBottom: 6 }}>Subject</label>
              <select
                value={form.subject}
                onChange={e => setForm({ ...form, subject: e.target.value })}
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border)',
                  fontSize: 15, fontFamily: 'inherit', outline: 'none', background: 'white',
                }}
              >
                <option value="">Select a topic</option>
                <option value="demo">Request a demo</option>
                <option value="pricing">Pricing question</option>
                <option value="enterprise">Enterprise inquiry</option>
                <option value="support">Technical support</option>
                <option value="partnership">Partnership opportunity</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', display: 'block', marginBottom: 6 }}>Message *</label>
              <textarea
                value={form.message}
                onChange={e => setForm({ ...form, message: e.target.value })}
                placeholder="Tell us how we can help..."
                rows={5}
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border)',
                  fontSize: 15, fontFamily: 'inherit', outline: 'none', resize: 'vertical',
                }}
              />
            </div>

            {error && (
              <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', fontSize: 13, marginBottom: 16 }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={sending}
              style={{
                width: '100%', padding: '14px', borderRadius: 8, border: 'none',
                background: 'var(--ink)', color: 'white', fontSize: 16, fontWeight: 700,
                cursor: sending ? 'wait' : 'pointer', fontFamily: 'inherit',
                opacity: sending ? 0.7 : 1,
              }}
            >
              {sending ? 'Sending...' : 'Send message'}
            </button>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: 32, fontSize: 14, color: 'var(--ink-light)' }}>
          Or email us directly at <a href="mailto:support@docs2video.com" style={{ color: 'var(--mint)' }}>support@docs2video.com</a>
        </div>
      </div>
    </div>
  )
}
