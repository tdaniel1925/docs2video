'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { sizedPicture } from '../../../../_lib/picture-size'
import Link from 'next/link'
import { Link2, Mail, Send, UserRoundPlus } from 'lucide-react'
import type { Video } from '../../../../_lib/types'
import SharePreview from './SharePreview'
import SendByText, { SendTabs, useTextStatus } from './SendByText'
import SendSwitch from './SendSwitch'
import {
  buildPreview, formatCents, quoteSwitch, reminderSwitch, reminderDaysText,
  httpsOnly, type PreviewAgent, type QuoteLike,
} from './share-options'
import { whatsLeft, FOCUS_IDS, SETTINGS_INTEGRATIONS } from './whats-left'
import { isInsuranceVideo, linkToCopy, defaultMessage, emailHtml, emailText } from './share-email'
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
 * "Ready to send" — THE one place a finished project is sent from.
 *
 * A picture of exactly what the client will see, and beside it: what's still
 * missing ("What's left"), who it goes to, a short note, the on/off pieces,
 * and Send. Every switch changes a real saved setting the share page reads
 * (share-options.ts says which); a switch only moves once the save worked.
 *
 * The older send window (a second Send button among the page's buttons) is
 * retired. What it could do that
 * this panel could not is here now:
 *   * a name for a client the app doesn't know yet;
 *   * sending to someone else than the client on file;
 *   * "Copy the email" (rich text + plain) for sending from your own inbox —
 *     copying sends nothing, and it says so;
 *   * the insurance disclosure with a copied link on policy videos;
 *   * the "sent / opened" trail — now in "Who watched" below, with how far
 *     each person got.
 *
 * Deliberately NOT here (no real setting behind them on the share page):
 *   * an on/off for "Book a call" — the share page shows your Settings
 *     booking link on every page, so this panel just says whether it's on;
 *   * "Include the slide deck" — a share page has no slide-deck attachment.
 */
export default function ReadyToSend({
  video, setVideo, quote, setQuote, canQuote, onAddQuote, onSent, previewVideoRef,
}: {
  video: Video
  setVideo: (updater: (prev: Video | null) => Video | null) => void
  quote: QuoteLike | null
  setQuote: (q: QuoteLike | null) => void
  /** Quotes are a paid-plan feature; the quote section below only shows then. */
  canQuote: boolean
  onAddQuote: () => void
  /** After a send went out (so "Who watched" can show it). */
  onSent?: () => void
  /** The preview's player, so the change bar can jump it to a scene. */
  previewVideoRef?: RefObject<HTMLVideoElement | null>
}) {
  const v = video as Video & { client_id?: string | null }
  const outputType = String(v.output_type ?? '')
  const isDeck = outputType === 'interactive' || outputType === 'deck'
  const thing = isDeck ? 'presentation' : 'video'
  const insurance = isInsuranceVideo(video.script)

  // The Library's Send button opens /videos/<id>#send. This panel appears only
  // once the project has loaded, after the browser has already looked for
  // #send, so it scrolls itself into view when it arrives.
  const sectionRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (window.location.hash === '#send') sectionRef.current?.scrollIntoView({ block: 'start' })
  }, [])

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

  // ── Is there a connected mailbox? Sends go from it; reminders only from it. ──
  const [mailbox, setMailbox] = useState<{ has: boolean; address: string } | null>(null)
  useEffect(() => {
    fetch('/api/email-connections')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!Array.isArray(d)) return
        const def = d.find((c: { is_default?: boolean }) => c.is_default) as { email_address?: string } | undefined
        setMailbox({ has: !!def, address: String(def?.email_address ?? '') })
      })
      .catch(() => {})
  }, [])
  const hasMailbox = mailbox ? mailbox.has : null

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

  // ── Email | Text. The Text tab shows only once texting is set up on the
  // server (its tables exist); otherwise this panel is email-only as before.
  const [channel, setChannel] = useState<'email' | 'text'>('email')
  const textInfo = useTextStatus(video.id)

  // "Send to someone else" replaces the client on file for this send only.
  const [someoneElse, setSomeoneElse] = useState(false)
  const [typedEmail, setTypedEmail] = useState('')
  const [typedName, setTypedName] = useState('')
  const askForAddress = someoneElse || !client?.email
  const sendTo = (askForAddress ? typedEmail : client!.email).trim().toLowerCase()
  const sendName = askForAddress
    ? (typedName.trim() || (someoneElse ? '' : (client?.name || v.recipient_name || '')))
    : (client?.name || v.recipient_name || '')
  const clientLabel = sendName || (someoneElse ? 'them' : 'your client')

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
          clientName: sendName || undefined,
          clientEmail: sendTo,
          message: note.trim() || defaultMessage(thing, sendName, insurance),
        }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || d?.error || !d?.success) {
        setSendError(`The email did NOT send${d?.error ? ` — ${d.error}` : ''}. You can try again, or copy the link and send it yourself.`)
        return
      }
      setSentTo(sendTo)
      onSent?.()
    } catch {
      setSendError('The email did NOT send — network problem. Try again, or copy the link and send it yourself.')
    } finally {
      setSending(false)
    }
  }

  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(linkToCopy(shareUrl, insurance))
      setCopyState('copied')
      setTimeout(() => setCopyState('idle'), 2500)
    } catch {
      setCopyState('failed')
    }
  }

  // "Copy the email" for sending from your own inbox: rich + plain text so it
  // pastes styled into Gmail/Outlook. Copying sends nothing.
  const [emailCopied, setEmailCopied] = useState<'idle' | 'copied' | 'failed'>('idle')
  async function copyEmail() {
    const body = note.trim() || defaultMessage(thing, sendName, insurance)
    const html = emailHtml(body, shareUrl, thing, insurance)
    const text = emailText(body, shareUrl, thing, insurance)
    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' }),
        })])
      } else {
        await navigator.clipboard.writeText(text)
      }
      setEmailCopied('copied')
      setTimeout(() => setEmailCopied('idle'), 3000)
    } catch {
      setEmailCopied('failed')
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

  const left = whatsLeft({
    sendTo: client === null ? 'loading' : sendTo,
    note,
    facts: facts ? {
      bookingUrl: model.bookingUrl,
      paymentLink: model.paymentLink,
      agent: facts.agent,
      unpaidQuoteShown: model.quote?.state === 'unpaid' && Number(model.quote.total) > 0,
    } : null,
  })

  const qs = quoteSwitch(quote)
  const rs = reminderSwitch(quote, hasMailbox)
  const hasSourcePdf = !!v.source_pdf_path
  const version = new Date(video.updated_at ?? video.created_at).getTime()
  const bookingFromThisVideo = !!facts?.bookingUrl

  // ── EDIT ON THEIR PAGE (layout D, 2026-11-15): the pieces of their page, each where it shows ──
  const leftKeys = new Set(left.map((i) => i.key))
  const ghost = (label: string, sub: string, action: { href: string } | { onClick: () => void }, disabled?: boolean) => (
    'href' in action
      ? <Link href={action.href} className="rts-ghost">+ {label}<small>{sub}</small></Link>
      : <button type="button" className="rts-ghost" onClick={action.onClick} disabled={disabled}>+ {label}<small>{sub}</small></button>
  )
  const pieces = (
    <>
      {/* Book a call: the booking link in Settings (or this video's own) — always on when there is one */}
      {facts === null && !factsError ? <div className="rts-row-hint">Checking…</div>
        : model.bookingUrl ? (
          <div className="rts-piece">
            <div className="rts-fake-btn primary">Book a call</div>
            <div className="rts-piece-cap">{bookingFromThisVideo ? 'Your booking link for this one.' : <>From your booking link in <Link href={SETTINGS_INTEGRATIONS}>Settings</Link>.</>}</div>
          </div>
        ) : ghost('Add a Book a call button', 'Needs your booking link in Settings', { href: SETTINGS_INTEGRATIONS })}
      {model.paymentLink && <div className="rts-fake-btn dark">Make a payment</div>}

      {/* The quote */}
      {(canQuote || qs.kind !== 'none') && (
        qs.kind === 'none' ? ghost('Add a quote with a pay button', 'No quote yet', { onClick: onAddQuote })
        : qs.kind === 'toggle' ? (
          qs.on && model.quote ? (
            <div className="rts-piece">
              <div className="rts-quote">
                <div className="rts-quote-label">Quote{model.quote.clientName ? ` for ${model.quote.clientName}` : ''}</div>
                <div className="rts-quote-total">{formatCents(model.quote.total)}</div>
                <div className="rts-fake-btn dark small">
                  {model.quote.total === 0 ? 'Complimentary' : model.quote.payable ? `Pay ${formatCents(model.quote.total)}` : `Contact ${model.agentName || 'you'} to pay`}
                </div>
              </div>
              <button type="button" className="rts-piece-x" disabled={!!saving} onClick={() => putQuote('quote', { status: 'draft' })}>{saving === 'quote' ? 'Saving…' : 'Hide from their page'}</button>
              {leftKeys.has('payment') && <div className="rts-piece-cap">No Pay button: <Link href={SETTINGS_INTEGRATIONS}>add a payment link</Link>.</div>}
            </div>
          ) : ghost('Show your quote with a pay button', `${formatCents(Number(quote?.total ?? 0))}, hidden now`, { onClick: () => putQuote('quote', { status: 'sent' }) }, !!saving)
        ) : (
          <div className="rts-piece">
            {model.quote && <div className="rts-quote"><div className="rts-quote-label">{model.quote.state === 'paid' ? 'Payment complete' : 'Quote'}</div><div className="rts-quote-total">{formatCents(model.quote.total)}</div></div>}
            <div className="rts-piece-cap">{qs.status === 'paid' ? 'Shows as paid on their page.' : `This deal is marked ${qs.status}.`} Change it under Quote / Invoice below.</div>
          </div>
        )
      )}
      {errors.quote && <div role="alert" className="rts-error">{errors.quote}</div>}

      {/* The original PDF */}
      {hasSourcePdf && (v.allow_source_download === true ? (
        <div className="rts-piece">
          <div className="rts-fake-btn outline">Download the original PDF</div>
          <button type="button" className="rts-piece-x" disabled={!!saving} onClick={toggleSourcePdf}>{saving === 'pdf' ? 'Saving…' : 'Remove'}</button>
        </div>
      ) : ghost('Let them download the original PDF', v.source_pdf_name || 'The PDF you uploaded', { onClick: toggleSourcePdf }, !!saving))}
      {errors.pdf && <div role="alert" className="rts-error">{errors.pdf}</div>}
    </>
  )
  const noteBox = (
    <div className="rts-note rts-note--edit">
      {model.agentName && <label htmlFor={FOCUS_IDS.note} style={{ display: 'block', fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>A note from {model.agentName}</label>}
      <textarea
        id={FOCUS_IDS.note}
        aria-label="A short note"
        className="rts-note-input"
        rows={2}
        maxLength={NOTE_MAX}
        placeholder="Write a short note to them, e.g. Here’s your coverage, in 3 minutes."
        value={note}
        onChange={e => onNoteChange(e.target.value)}
        onBlur={() => { saveNote(note) }}
      />
      <div className="rts-row-hint" aria-live="polite" style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
        <span>
          {noteState === 'saving' ? 'Saving…'
            : noteState === 'saved' ? 'Saved — it’s on their page.'
            : noteState === 'error' ? ''
            : 'Shows on their page and in the email.'}
        </span>
        <span>{note.length}/{NOTE_MAX}</span>
      </div>
      {noteState === 'error' && <div role="alert" className="rts-error">{noteError}</div>}
    </div>
  )
  const underGreeting = (leftKeys.has('photo') || leftKeys.has('name')) ? (
    <Link href="/settings" className="rts-ghost rts-ghost--line">
      + {leftKeys.has('photo') && leftKeys.has('name') ? 'Add your name and photo' : leftKeys.has('photo') ? 'Add your photo' : 'Add your name'}
      <small>They show beside the video, so they know who it’s from</small>
    </Link>
  ) : null

  return (
    <section className="rts" id="send" ref={sectionRef} aria-label="Ready to send">
      <style>{READY_TO_SEND_CSS}</style>
      <h2 className="rts-title">Ready to <em>send.</em></h2>
      <p className="rts-sub">
        This is {client?.name || v.recipient_name || 'your client'}’s page, exactly as they’ll see it. Type your note right on it; the dashed blocks add a piece.
      </p>
      <div className="rts-d">
        <SharePreview
          model={model}
          shareUrl={shareUrl}
          title={video.title}
          isDeck={isDeck}
          videoId={video.id}
          videoUrl={video.video_url}
          // The poster stands in until Play (the player loads nothing before
          // that — preload="none", audit 2026-10-09): the thumbnail, else the
          // first slide picture.
          posterUrl={sizedPicture(video.thumbnail_url || video.slide_urls?.[0] || null, 960)}
          musicUrl={video.music_url}
          version={version}
          videoRef={previewVideoRef}
          notice={factsError ? 'Couldn’t load your share page’s booking and payment details just now, so those buttons may be missing from this picture.' : null}
          edit={{ note: noteBox, underGreeting, pieces }}
        />

        {/* Quote reminders are not on their page: they sit with sending */}
        {(canQuote || quote) && (
          <div className="rts-rows rts-d-extra">
            {rs.usable ? (
              <SendSwitch
                label={`Remind them about the quote on ${reminderDaysText()}`}
                on={rs.on}
                saving={saving === 'remind'}
                disabled={(!!saving && saving !== 'remind') || (!rs.on && !!rs.blockedOn)}
                error={errors.remind}
                onToggle={() => putQuote('remind', { autoFollowUp: !rs.on })}
                hint={rs.blockedOn && !rs.on
                  ? <>Reminders go from your own email only. Connect it in <Link href={SETTINGS_INTEGRATIONS}>Settings</Link> first.</>
                  : 'Counted from the day you made the quote. Sent from your email with an unsubscribe link. Stops once you mark the deal paid, accepted or declined.'}
              />
            ) : (
              <div className="rts-row">
                <div className="rts-row-label">Remind them about the quote on {reminderDaysText()}</div>
                <div className="rts-row-hint">{rs.reason}</div>
              </div>
            )}
          </div>
        )}

        {/* THE SEND BAR — stays at the bottom of the screen while you look over their page */}
        <div className="rts-bar" aria-label="Send it">
          {textInfo?.available && <SendTabs channel={channel} onChange={(k) => { setChannel(k); setSendError(''); setSentTo('') }} />}
          {channel === 'text' && textInfo ? (
            <SendByText videoId={video.id} initial={textInfo} clientName={client?.name || v.recipient_name || ''} clientId={clientId}
              note={note} thing={thing} insurance={insurance} posterUrl={sizedPicture(video.thumbnail_url || video.slide_urls?.[0] || null, 480)}
              beforeSend={() => saveNote(note)} onSent={onSent} />
          ) : (
            <div className="rts-bar-row">
              <div className="rts-bar-who">
                <div className="rts-eyebrow" style={{ marginBottom: 2 }}>Send to</div>
                {client === null ? (
                  <div className="rts-row-hint">Loading…</div>
                ) : !askForAddress ? (
                  <div>
                    <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{client.name || client.email}</span>
                    <span className="rts-row-hint"> · {client.email}{client.fromStep1 ? ' · from step 1' : ''}</span>
                    <button type="button" className="rts-link rts-link--small rts-icon-link" onClick={() => { setSomeoneElse(true); setSendError(''); setSentTo('') }}>
                      <UserRoundPlus size={16} />Send to someone else
                    </button>
                  </div>
                ) : (
                  <div className="rts-bar-fields">
                    {!someoneElse && client.name && <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{client.name}</span>}
                    <input
                      id={FOCUS_IDS.email}
                      aria-label="Client email"
                      className="input"
                      type="email"
                      placeholder="Their email, e.g. sarah@example.com"
                      value={typedEmail}
                      onChange={e => { setTypedEmail(e.target.value); setSendError('') }}
                    />
                    {(someoneElse || !client.name) && (
                      <input
                        id="rts-name"
                        aria-label="Their name (optional)"
                        className="input"
                        placeholder="Their name (optional)"
                        value={typedName}
                        onChange={e => setTypedName(e.target.value)}
                      />
                    )}
                    {someoneElse ? (
                      <button type="button" className="rts-link rts-link--small" onClick={() => { setSomeoneElse(false); setTypedEmail(''); setTypedName(''); setSendError('') }}>
                        Back to {client.name || client.email}
                      </button>
                    ) : <span className="rts-row-hint">No email is saved for this client yet.</span>}
                  </div>
                )}
              </div>
              <div className="rts-bar-go">
                <button type="button" className="btn btn-primary" onClick={send} disabled={sending || client === null}>
                  <span className="rts-icon-link"><Send size={16} />{sending ? 'Sending…' : sentTo ? `Send again to ${clientLabel}` : `Send to ${clientLabel}`}</span>
                </button>
                <div className="rts-alt">
                  <button type="button" className="rts-link rts-icon-link" onClick={copyLink}>
                    <Link2 size={16} />{copyState === 'copied' ? '✓ Link copied' : 'or copy the link'}
                  </button>
                  <span aria-hidden="true" className="rts-dot-sep">·</span>
                  <button type="button" className="rts-link rts-icon-link" onClick={copyEmail}>
                    <Mail size={16} />{emailCopied === 'copied' ? '✓ Email copied — paste it into your email app' : 'Copy the email'}
                  </button>
                </div>
              </div>
            </div>
          )}
          {channel === 'email' && sendError && <div role="alert" className="rts-error">{sendError}</div>}
          {channel === 'email' && sentTo && <div role="status" className="rts-sent">✓ Sent to <strong>{sentTo}</strong>.</div>}
          <div className="rts-row-hint rts-from">
            {channel === 'text' || mailbox === null ? ''
              : mailbox.has
                ? <>Sends from your own email{mailbox.address ? ` (${mailbox.address})` : ''}. We tell you when they open it and when they watch.</>
                : <>Sends from Docs2Video’s address, and replies come to you. <Link href={SETTINGS_INTEGRATIONS}>Connect your email</Link> to send from it.</>}
            {' '}{insurance ? 'Copied links include the policy disclosure. ' : ''}Copying sends nothing — you send it yourself.
          </div>
          {copyState === 'failed' && <div className="rts-row-hint" style={{ wordBreak: 'break-all' }}>Couldn’t copy — here it is: {shareUrl}</div>}
          {emailCopied === 'failed' && <div className="rts-row-hint">Couldn’t copy the email. Copy the link instead and paste it into your message.</div>}
        </div>
      </div>
    </section>
  )
}
