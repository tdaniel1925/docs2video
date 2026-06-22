'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useToast } from '../../../_components/Toast'
import InlineConfirm from '@/app/_components/InlineConfirm'

type Prospect = {
  id: string
  url: string
  company_name: string | null
  contact_email: string | null
  contact_name: string | null
  status: string
  progress_pct: number | null
  stage_detail: string | null
  error_message: string | null
  video_url: string | null
  thumbnail_url: string | null
  duration: number | null
  email_sent_at: string | null
  video_watched_at: string | null
  signed_up_at: string | null
  created_at: string
  updated_at: string
}

// Coarse status → label + color. In-flight statuses drive live polling.
const IN_FLIGHT = ['scraping', 'scripting', 'generating', 'assembling']
const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  scraping: { label: 'Scanning site', color: '#b45309', bg: '#fef3c7' },
  scripting: { label: 'Writing script', color: '#b45309', bg: '#fef3c7' },
  generating: { label: 'Building slides', color: '#b45309', bg: '#fef3c7' },
  assembling: { label: 'Assembling video', color: '#b45309', bg: '#fef3c7' },
  ready_for_review: { label: 'Ready for review', color: '#047857', bg: '#d1fae5' },
  sent: { label: 'Sent', color: '#1d4ed8', bg: '#dbeafe' },
  failed: { label: 'Failed', color: '#b91c1c', bg: '#fee2e2' },
  rejected: { label: 'Rejected', color: '#6b7280', bg: '#f3f4f6' },
  cancelled: { label: 'Cancelled', color: '#6b7280', bg: '#f3f4f6' },
}

function relTime(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export default function ProspectsPage() {
  const notify = useToast()
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(true)
  const [urlsInput, setUrlsInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [sendModal, setSendModal] = useState<Prospect | null>(null)
  const [sendEmail, setSendEmail] = useState('')
  const [sendName, setSendName] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/prospect-pipeline')
      const data = await res.json()
      if (res.ok) setProspects(data.prospects ?? [])
    } catch { /* keep last */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // Live polling: while anything is mid-generation, refetch every 3s.
  const anyInFlight = prospects.some(p => IN_FLIGHT.includes(p.status))
  useEffect(() => {
    if (anyInFlight) {
      if (!pollRef.current) pollRef.current = setInterval(load, 3000)
    } else if (pollRef.current) {
      clearInterval(pollRef.current); pollRef.current = null
    }
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } }
  }, [anyInFlight, load])

  async function startGeneration() {
    const urls = urlsInput.split(/[\n,]+/).map(u => u.trim()).filter(Boolean)
    if (urls.length === 0) { notify('Enter at least one URL.', 'error'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/prospect-pipeline', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to start')
      notify(`Started ${data.started} demo${data.started === 1 ? '' : 's'}.`, 'success')
      setUrlsInput('')
      await load()
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Failed to start', 'error')
    } finally { setSubmitting(false) }
  }

  async function action(p: Prospect, body: Record<string, unknown>, okMsg: string) {
    setBusyId(p.id)
    try {
      const res = await fetch('/api/admin/prospect-pipeline', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Action failed')
      notify(okMsg, 'success')
      await load()
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Action failed', 'error')
    } finally { setBusyId(null) }
  }

  async function sendDemo() {
    if (!sendModal) return
    if (!sendEmail.trim()) { notify('Enter the prospect email.', 'error'); return }
    setBusyId(sendModal.id)
    try {
      const res = await fetch('/api/admin/prospect-send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prospectId: sendModal.id,
          contactEmail: sendEmail.trim(),
          contactName: sendName.trim() || null,
          subject: `A quick video I made for ${sendModal.company_name || 'your team'}`,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Send failed')
      notify('Demo sent.', 'success')
      setSendModal(null); setSendEmail(''); setSendName('')
      await load()
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Send failed', 'error')
    } finally { setBusyId(null) }
  }

  const counts = {
    inFlight: prospects.filter(p => IN_FLIGHT.includes(p.status)).length,
    ready: prospects.filter(p => p.status === 'ready_for_review').length,
    sent: prospects.filter(p => p.status === 'sent').length,
    failed: prospects.filter(p => p.status === 'failed').length,
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px' }}>
      <div className="page-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Prospect Pipeline</h1>
          <p style={{ color: 'var(--ink-soft)', margin: '4px 0 0', fontSize: 14 }}>
            Auto-generate personalized demo videos from a prospect&rsquo;s website, then review &amp; send.
          </p>
        </div>
        <Link href="/admin" className="btn btn-sm btn-soft" style={{ textDecoration: 'none' }}>← Admin</Link>
      </div>

      {/* Stat chips */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          ['Generating', counts.inFlight, '#b45309'],
          ['Ready', counts.ready, '#047857'],
          ['Sent', counts.sent, '#1d4ed8'],
          ['Failed', counts.failed, '#b91c1c'],
        ].map(([label, n, color]) => (
          <div key={label as string} style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, padding: '10px 16px', minWidth: 92 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: color as string, lineHeight: 1 }}>{n as number}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>{label as string}</div>
          </div>
        ))}
      </div>

      {/* Generate new (batch) */}
      <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, padding: 18, marginBottom: 24 }}>
        <label className="input-label" style={{ display: 'block', marginBottom: 6 }}>Generate demos — paste one or more website URLs (one per line)</label>
        <textarea
          className="input" rows={3} value={urlsInput} onChange={e => setUrlsInput(e.target.value)}
          placeholder={'acme.com\nexample.io\nanothercompany.com'}
          style={{ resize: 'vertical', fontSize: 14, marginBottom: 10 }}
        />
        <button onClick={startGeneration} disabled={submitting} className="btn btn-primary" style={{ opacity: submitting ? 0.6 : 1 }}>
          {submitting ? 'Starting…' : 'Generate demos'}
        </button>
        {anyInFlight && <span style={{ marginLeft: 12, fontSize: 13, color: 'var(--ink-soft)' }}><span className="spinner" style={{ marginRight: 6 }} />Live — updating automatically</span>}
      </div>

      {/* Pipeline table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><span className="spinner lg" /></div>
      ) : prospects.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--ink-light)' }}>No prospects yet. Paste a URL above to generate the first demo.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {prospects.map(p => {
            const meta = STATUS_META[p.status] ?? { label: p.status, color: '#6b7280', bg: '#f3f4f6' }
            const inFlight = IN_FLIGHT.includes(p.status)
            const pct = Math.max(0, Math.min(100, p.progress_pct ?? 0))
            const busy = busyId === p.id
            return (
              <div key={p.id} style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, padding: 16, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                {/* Thumb */}
                <div style={{ width: 120, height: 68, borderRadius: 8, background: '#f1f5f9', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {p.thumbnail_url
                    ? <img src={p.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 11, color: '#94a3b8' }}>{inFlight ? 'Rendering…' : 'No preview'}</span>}
                </div>

                {/* Main */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: 15 }}>{p.company_name || p.url}</strong>
                    <span style={{ fontSize: 11, fontWeight: 700, color: meta.color, background: meta.bg, padding: '2px 8px', borderRadius: 6 }}>{meta.label}</span>
                    <span style={{ fontSize: 12, color: 'var(--ink-light)' }}>· {relTime(p.updated_at)}</span>
                  </div>
                  <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--ink-soft)', textDecoration: 'none' }}>{p.url}</a>

                  {/* Progress bar (in-flight) */}
                  {inFlight && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ height: 6, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: '#0d9488', transition: 'width 0.4s' }} />
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>{p.stage_detail || 'Working…'} · {pct}%</div>
                    </div>
                  )}
                  {p.status === 'failed' && p.error_message && (
                    <div style={{ marginTop: 6, fontSize: 12, color: '#b91c1c' }}>Error: {p.error_message}</div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, alignItems: 'stretch', minWidth: 130 }}>
                  {inFlight && (
                    <button className="btn btn-sm btn-soft" disabled={busy} onClick={() => action(p, { action: 'cancel', prospectId: p.id }, 'Cancelling…')}>Cancel</button>
                  )}
                  {p.status === 'ready_for_review' && (
                    <>
                      {p.video_url && <a className="btn btn-sm btn-soft" href={p.video_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', textAlign: 'center' }}>Preview</a>}
                      <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => { setSendModal(p); setSendEmail(p.contact_email || ''); setSendName(p.contact_name || '') }}>Approve &amp; Send</button>
                      <button className="btn btn-sm btn-soft" disabled={busy} onClick={() => action(p, { regenerateId: p.id, url: p.url }, 'Regenerating…')}>Regenerate</button>
                      <InlineConfirm message="Reject this demo?" confirmLabel="Reject" onConfirm={() => action(p, { action: 'reject', prospectId: p.id }, 'Rejected.')}>
                        <button className="btn btn-sm btn-soft" disabled={busy} style={{ color: '#b91c1c' }}>Reject</button>
                      </InlineConfirm>
                    </>
                  )}
                  {(p.status === 'failed' || p.status === 'cancelled' || p.status === 'rejected') && (
                    <button className="btn btn-sm btn-soft" disabled={busy} onClick={() => action(p, { regenerateId: p.id, url: p.url }, 'Retrying…')}>Retry</button>
                  )}
                  {p.status === 'sent' && p.video_url && (
                    <a className="btn btn-sm btn-soft" href={p.video_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', textAlign: 'center' }}>Preview</a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Send modal */}
      {sendModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,26,18,0.5)', backdropFilter: 'blur(6px)' }}>
          <div style={{ width: '100%', maxWidth: 440, background: 'white', borderRadius: 10, padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Send demo to {sendModal.company_name || 'prospect'}</h2>
              <button onClick={() => setSendModal(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--ink-light)' }}>&times;</button>
            </div>
            <div className="form-group">
              <label className="input-label">Contact name (optional)</label>
              <input className="input" value={sendName} onChange={e => setSendName(e.target.value)} placeholder="e.g. Jane Doe" />
            </div>
            <div className="form-group">
              <label className="input-label">Send to email</label>
              <input className="input" type="email" value={sendEmail} onChange={e => setSendEmail(e.target.value)} placeholder="prospect@company.com" />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} disabled={busyId === sendModal.id} onClick={sendDemo}>
                {busyId === sendModal.id ? 'Sending…' : 'Send demo email'}
              </button>
              <button className="btn btn-soft" onClick={() => setSendModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
