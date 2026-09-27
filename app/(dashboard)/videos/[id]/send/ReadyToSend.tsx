'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import type { Video } from '../../../../_lib/types'
import SharePreview from './SharePreview'
import SendSwitch from './SendSwitch'
import {
  buildPreview, formatCents, quoteSwitch, reminderSwitch, reminderDaysText,
  httpsOnly, type PreviewAgent, type QuoteLike,
} from './share-options'
import { READY_TO_SEND_CSS } from './ready-to-send-css'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const NOTE_MAX = 400 // same limit the wizard and the save route use

type SaveKey = 'quote' | 'pdf' | 'remind'
type PublicFacts = {
  agent: PreviewAgent | null
  quote: QuoteLike | null
  bookingUrl: string
  paymentLink: string
}

/**
 * STEP 4 — "Ready to send."
 *
 * The top of a finished video's page: a picture of exactly what the client
 * will see, and on the right who it goes to, a short note, the on/off pieces,
 * and the Send button. Every switch here changes a real saved setting that
 * the share page reads (see share-options.ts for which one); a switch only
 * moves once the save really worked.
 *
 * Deliberately NOT here (no real setting behind them on the share page):
 *   * an on/off for "Book a call" — the share page shows your Settings
 *     booking link on every page, so this panel just says whether it's on;
 *   * "Include the slide deck" — a share page has no slide-deck attachment.
 */
export default function ReadyToSend({
  video, setVideo, quote, setQuote, canQuote, onAddQuote,
}: {
  video: Video
  setVideo: (updater: (prev: Video | null) => Video | null) => void
  quote: QuoteLike | null
  setQuote: (q: QuoteLike | null) => void
  /** Quotes are a paid-plan feature; the quote section below only shows then. */
  canQuote: boolean
  onAddQuote: () => void
}) {
  const v = video as Video & { client_id?: string | null }
  const outputType = String(v.output_type ?? '')
  const isDeck = outputType === 'interactive' || outputType === 'deck'
  const thing = isDeck ? 'presentation' : 'video'

  const [shareUrl, setShareUrl] = useState(`/watch/${video.id}`)
  useEffect(() => { setShareUrl(`${window.location.origin}/watch/${video.id}`) }, [video.id])

  // ── What the share page really gets (agent links, the quote it shows) ──
  const [facts, setFacts] = useState<PublicFacts | null>(null)
  const [factsError, setFactsError] = useState(false)
  const loadFacts = useCallback(async () => {
    try {
      const r = await fetch(`/api/public/watch/${video.id}`, { cache: 'no-store' })
      if (!r.ok) throw new Error(String(r.status))
      const d = await r.json()
      const pi = d?.video?.script?._pipeline_input ?? {}
      setFacts({
        agent: d?.agent ?? null,
        quote: d?.quote ?? null,
        bookingUrl: httpsOnly(pi.bookingUrl),
        paymentLink: httpsOnly(pi.paymentLink),
      })
      setFactsError(false)
    } catch {
      setFactsError(true)
    }
  }, [video.id])
  useEffect(() => { loadFacts() }, [loadFacts])

  // ── Is there a connected mailbox? Automatic reminders only go from one. ──
  const [hasMailbox, setHasMailbox] = useState<boolean | null>(null)
  useEffect(() => {
    fetch('/api/email-connections')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (Array.isArray(d)) setHasMailbox(d.some((c: { is_default?: boolean }) => c.is_default)) })
      .catch(() => {})
  }, [])

  // ── Who it goes to: the client picked in step 1, else the quote's client ──
  const [client, setClient] = useState<{ name: string; email: string; fromStep1: boolean } | null>(null)
  const clientId = v.client_id || (v.draft_data as { clientId?: string } | null)?.clientId || null
  useEffect(() => {
    let cancelled = false
    const fallbackName = (v.recipient_name || quote?.client_name || '').trim()
    const fallbackEmail = (quote?.client_email || '').trim()
    if (!clientId) { setClient({ name: fallbackName, email: fallbackEmail, fromStep1: false }); return }
    fetch(`/api/clients/${encodeURIComponent(clientId)}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (cancelled) return
        const c = d?.client
        setClient(c
          ? { name: String(c.name || fallbackName), email: String(c.email || fallbackEmail), fromStep1: true }
          : { name: fallbackName, email: fallbackEmail, fromStep1: false })
      })
      .catch(() => { if (!cancelled) setClient({ name: fallbackName, email: fallbackEmail, fromStep1: false }) })
    return () => { cancelled = true }
  }, [clientId, v.recipient_name, quote?.client_name, quote?.client_email])
  const [typedEmail, setTypedEmail] = useState('')
  const sendTo = (client?.email || typedEmail).trim().toLowerCase()
  const clientLabel = client?.name || v.recipient_name || 'your client'

  // ── The note: shows on their page (and in the email). Saves as you type. ──
  const savedNote = v.agent_note ?? ''
  const [note, setNote] = useState(savedNote)
  const [noteState, setNoteState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [noteError, setNoteError] = useState('')
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const noteSeq = useRef(0)
  const savedNoteRef = useRef(savedNote)
  savedNoteRef.current = savedNote

  const saveNote = useCallback(async (text: string): Promise<boolean> => {
    if (noteTimer.current) { clearTimeout(noteTimer.current); noteTimer.current = null }
    const clean = text.trim().slice(0, NOTE_MAX)
    if (clean === (savedNoteRef.current ?? '').trim()) { setNoteState(s => (s === 'error' ? 'idle' : s)); return true }
    const seq = ++noteSeq.current
    setNoteState('saving'); setNoteError('')
    try {
      const r = await fetch(`/api/videos/${video.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_note: clean }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.success) throw new Error(d.error || 'The note was NOT saved.')
      savedNoteRef.current = d.agent_note ?? ''
      setVideo(prev => (prev ? ({ ...prev, agent_note: d.agent_note ?? null } as Video) : prev))
      if (seq === noteSeq.current) setNoteState('saved')
      return true
    } catch (e) {
      if (seq === noteSeq.current) {
        setNoteState('error')
        setNoteError(`${e instanceof Error ? e.message : 'The note was NOT saved.'} Your client still sees the old note.`)
      }
      return false
    }
  }, [video.id, setVideo])

  function onNoteChange(text: string) {
    const next = text.slice(0, NOTE_MAX)
    setNote(next)
    setNoteState('idle')
    if (noteTimer.current) clearTimeout(noteTimer.current)
    noteTimer.current = setTimeout(() => { saveNote(next) }, 900)
  }
  useEffect(() => () => { if (noteTimer.current) clearTimeout(noteTimer.current) }, [])

  // ── Switches ──
  const [saving, setSaving] = useState<SaveKey | null>(null)
  const [errors, setErrors] = useState<Partial<Record<SaveKey, string>>>({})
  const setErr = (k: SaveKey, msg: string | null) => setErrors(prev => ({ ...prev, [k]: msg || undefined }))

  async function toggleSourcePdf() {
    if (saving) return
    const next = !(v.allow_source_download === true)
    setSaving('pdf'); setErr('pdf', null)
    try {
      const r = await fetch(`/api/videos/${video.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allow_source_download: next }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.success) { setErr('pdf', d.error || 'That change was NOT saved — try again.'); return }
      setVideo(prev => (prev ? ({ ...prev, allow_source_download: d.allow_source_download === true } as Video) : prev))
    } catch {
      setErr('pdf', 'That change was NOT saved — check your connection and try again.')
    } finally {
      setSaving(null)
    }
  }

  async function putQuote(key: SaveKey, patch: Record<string, unknown>) {
    if (!quote || saving) return
    setSaving(key); setErr(key, null)
    try {
      const r = await fetch('/api/quotes', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId: quote.id, ...patch }),
      })
      const d = await r.json().catch(() => ({}))
      if (d.quote) setQuote(d.quote)
      if (!r.ok) { setErr(key, d.error || 'That change was NOT saved — try again.'); return }
      loadFacts() // the share page's own view of the quote
    } catch {
      setErr(key, 'That change was NOT saved — check your connection and try again.')
    } finally {
      setSaving(null)
    }
  }

  // ── Send ──
  const [sending, setSending] = useState(false)
  const [sentTo, setSentTo] = useState('')
  const [sendError, setSendError] = useState('')
  async function send() {
    if (sending) return
    if (!EMAIL_RE.test(sendTo)) { setSendError('Enter your client’s email address first.'); return }
    setSending(true); setSendError(''); setSentTo('')
    try {
      // The note goes on their page too — make sure the saved one matches.
      if (!(await saveNote(note))) {
        setSendError('Your note did not save, so nothing was sent. Try again.')
        return
      }
      const r = await fetch('/api/send-video-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: video.id,
          clientName: client?.name || v.recipient_name || undefined,
          clientEmail: sendTo,
          message: note.trim() || `I've put together a short ${thing} for you. It only takes a few minutes — press the button below to see it.`,
        }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || d?.error || !d?.success) {
        setSendError(`The email did NOT send${d?.error ? ` — ${d.error}` : ''}. You can try again, or copy the link and send it yourself.`)
        return
      }
      setSentTo(sendTo)
    } catch {
      setSendError('The email did NOT send — network problem. Try again, or copy the link and send it yourself.')
    } finally {
      setSending(false)
    }
  }

  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopyState('copied')
      setTimeout(() => setCopyState('idle'), 2500)
    } catch {
      setCopyState('failed')
    }
  }

  // ── The preview: saved settings + the note as you type it ──
  const model = useMemo(() => buildPreview({
    recipientName: v.recipient_name,
    note,
    allowSourceDownload: v.allow_source_download === true,
    publicQuote: facts?.quote ?? null,
    agent: facts?.agent ?? null,
    pipelineBookingUrl: facts?.bookingUrl,
    pipelinePaymentLink: facts?.paymentLink,
  }), [v.recipient_name, note, v.allow_source_download, facts])

  const qs = quoteSwitch(quote)
  const rs = reminderSwitch(quote, hasMailbox)
  const hasSourcePdf = !!v.source_pdf_path
  const version = new Date(video.updated_at ?? video.created_at).getTime()
  const bookingFromThisVideo = !!facts?.bookingUrl

  return (
    <section className="rts" aria-label="Ready to send">
      <style>{READY_TO_SEND_CSS}</style>

      <h2 className="rts-title">Ready to <em>send.</em></h2>
      <p className="rts-sub">
        This is exactly what {client?.name || v.recipient_name || 'your client'} will see. Turn pieces on or off on the right.
      </p>

      <div className="rts-layout">
        <SharePreview
          model={model}
          shareUrl={shareUrl}
          title={video.title}
          isDeck={isDeck}
          videoId={video.id}
          videoUrl={video.video_url}
          posterUrl={video.thumbnail_url}
          version={version}
          notice={factsError ? 'Couldn’t load your share page’s booking and payment details just now, so those buttons may be missing from this picture.' : null}
        />

        <aside className="rts-panel">
          {/* WHO */}
          <div className="rts-eyebrow">Send to</div>
          {client === null ? (
            <div className="rts-row-hint">Loading…</div>
          ) : client.email ? (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, color: 'var(--ink)' }}>{client.name || client.email}</div>
              <div className="rts-row-hint" style={{ marginTop: 2 }}>
                {client.email}{client.fromStep1 ? ' · from step 1' : ''}
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: 16 }}>
              {client.name && <div style={{ fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>{client.name}</div>}
              <label className="input-label" htmlFor="rts-email">Client email</label>
              <input
                id="rts-email"
                className="input"
                type="email"
                placeholder="e.g. sarah@example.com"
                value={typedEmail}
                onChange={e => { setTypedEmail(e.target.value); setSendError('') }}
              />
              <div className="rts-row-hint">No email is saved for this client yet.</div>
            </div>
          )}

          {/* NOTE */}
          <label className="input-label" htmlFor="rts-note">A short note</label>
          <textarea
            id="rts-note"
            className="input"
            rows={3}
            maxLength={NOTE_MAX}
            placeholder="e.g. Here’s your coverage, in 3 minutes."
            value={note}
            onChange={e => onNoteChange(e.target.value)}
            onBlur={() => { saveNote(note) }}
            style={{ resize: 'vertical', lineHeight: 1.5 }}
          />
          <div className="rts-row-hint" aria-live="polite" style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <span>
              {noteState === 'saving' ? 'Saving…'
                : noteState === 'saved' ? 'Saved — it’s on their page.'
                : noteState === 'error' ? ''
                : 'Shows on their page and in the email.'}
            </span>
            <span>{note.length}/{NOTE_MAX}</span>
          </div>
          {noteState === 'error' && <div role="alert" className="rts-error">{noteError}</div>}

          {/* SWITCHES */}
          <div className="rts-rows">
            <div className="rts-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="rts-row-label">Book a call button</div>
                  <div className="rts-row-hint">
                    {facts === null && !factsError ? 'Checking…'
                      : model.bookingUrl
                        ? (bookingFromThisVideo ? 'On — uses the booking link you gave for this one.' : <>On — uses your booking link from <Link href="/settings">Settings</Link>. It shows on all your share pages.</>)
                        : <>Off — add a booking link in <Link href="/settings">Settings</Link> to show it.</>}
                  </div>
                </div>
                <span className={`rts-state${model.bookingUrl ? ' on' : ''}`}>{model.bookingUrl ? 'On' : 'Off'}</span>
              </div>
            </div>

            {(canQuote || qs.kind !== 'none') && (
              qs.kind === 'none' ? (
                <div className="rts-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="rts-row-label">Quote with a pay button</div>
                      <div className="rts-row-hint">No quote yet.</div>
                    </div>
                    <button type="button" className="btn btn-soft btn-sm" onClick={onAddQuote}>Add a quote</button>
                  </div>
                </div>
              ) : qs.kind === 'toggle' ? (
                <SendSwitch
                  label="Quote with a pay button"
                  on={qs.on}
                  saving={saving === 'quote'}
                  disabled={!!saving && saving !== 'quote'}
                  error={errors.quote}
                  onToggle={() => putQuote('quote', { status: qs.on ? 'draft' : 'sent' })}
                  hint={qs.on
                    ? `Shows ${formatCents(Number(quote?.total ?? 0))}${model.paymentLink ? ' with a Pay button.' : ' — no payment link in Settings, so it asks them to contact you to pay.'}`
                    : 'Hidden from their page.'}
                />
              ) : (
                <div className="rts-row">
                  <div className="rts-row-label">Quote with a pay button</div>
                  <div className="rts-row-hint">
                    {qs.status === 'paid' ? 'Shows as paid on their page.' : `This deal is marked ${qs.status}.`} Change it in the Quote section below.
                  </div>
                </div>
              )
            )}

            {hasSourcePdf && (
              <SendSwitch
                label="Let them download the original PDF"
                on={v.allow_source_download === true}
                saving={saving === 'pdf'}
                disabled={!!saving && saving !== 'pdf'}
                error={errors.pdf}
                onToggle={toggleSourcePdf}
                hint={v.source_pdf_name ? v.source_pdf_name : 'The PDF you uploaded.'}
              />
            )}

            {(canQuote || quote) && (
              rs.usable ? (
                <SendSwitch
                  label={`Remind them about the quote on ${reminderDaysText()}`}
                  on={rs.on}
                  saving={saving === 'remind'}
                  disabled={(!!saving && saving !== 'remind') || (!rs.on && !!rs.blockedOn)}
                  error={errors.remind}
                  onToggle={() => putQuote('remind', { autoFollowUp: !rs.on })}
                  hint={rs.blockedOn && !rs.on
                    ? <>Reminders go from your own email only. Connect it in <Link href="/settings">Settings</Link> first.</>
                    : 'Counted from the day you made the quote. Sent from your email with an unsubscribe link. Stops once you mark the deal paid, accepted or declined.'}
                />
              ) : (
                <div className="rts-row">
                  <div className="rts-row-label">Remind them about the quote on {reminderDaysText()}</div>
                  <div className="rts-row-hint">{rs.reason}</div>
                </div>
              )
            )}
          </div>

          {/* SEND */}
          {sendError && <div role="alert" className="rts-error" style={{ marginTop: 14 }}>{sendError}</div>}
          {sentTo && (
            <div role="status" className="rts-sent">
              ✓ Sent to <strong>{sentTo}</strong>.
            </div>
          )}
          <button
            type="button"
            className="btn btn-primary btn-full"
            style={{ marginTop: 14 }}
            onClick={send}
            disabled={sending || client === null}
          >
            {sending ? 'Sending…' : sentTo ? `Send again to ${clientLabel}` : `Send to ${clientLabel}`}
          </button>
          <div style={{ textAlign: 'center', marginTop: 10 }}>
            <button type="button" className="rts-link" onClick={copyLink}>
              {copyState === 'copied' ? '✓ Link copied' : 'or copy the link'}
            </button>
            {copyState === 'failed' && (
              <div className="rts-row-hint" style={{ wordBreak: 'break-all' }}>
                Couldn’t copy — here it is: {shareUrl}
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  )
}
