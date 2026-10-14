'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Mail, MessageSquare } from 'lucide-react'
import { Note, Tabs } from '../../../../_components/kit'
import { buildClientText, normalizePhone, formatPhone, canSendPicture, smsParts } from '../../../../_lib/texting'

/** Is texting set up for this account (tables there), and what the Text tab
 *  needs to start. null while loading; { available: false } hides the tabs. */
export function useTextStatus(videoId: string): TextStatus | null {
  const [info, setInfo] = useState<TextStatus | null>(null)
  useEffect(() => {
    let cancelled = false
    fetch(`/api/texting/status?videoId=${encodeURIComponent(videoId)}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d) setInfo(d as TextStatus) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [videoId])
  return info
}

/** The Email | Text switch at the top of the send panel. */
export function SendTabs({ channel, onChange }: { channel: 'email' | 'text'; onChange: (k: 'email' | 'text') => void }) {
  return (
    <Tabs
      label="Send by"
      className="rts-tabs"
      current={channel}
      onSelect={onChange}
      tabs={[
        { key: 'email', label: <span className="rts-icon-link"><Mail size={16} />Email</span> },
        { key: 'text', label: <span className="rts-icon-link"><MessageSquare size={16} />Text</span> },
      ]}
    />
  )
}

export type TextStatus = {
  available: boolean
  clientTexts?: boolean
  detail?: string
  cost?: number
  agentName?: string
  clientPhone?: string | null
  phone?: string | null
  consent?: boolean
  optedOut?: boolean
}

/**
 * The Text tab of "Ready to send": the client's mobile number, a picture of
 * the text exactly as it will arrive (with the video's picture when the phone
 * can get one), the one-time "agreed to texts" box, and Send. The message is
 * built by the same function the server uses (texting.ts), so the preview is
 * the real text. Sending costs credits (shown on the button); a text that
 * doesn't go out gives them back.
 */
export default function SendByText({
  videoId, initial, clientName, clientId, note, thing, insurance, posterUrl, beforeSend, onSent,
}: {
  videoId: string
  initial: TextStatus
  clientName: string
  clientId: string | null
  note: string
  thing: 'video' | 'presentation'
  insurance: boolean
  posterUrl: string | null
  /** Saves the note first (it shows on their page); false = don't send. */
  beforeSend: () => Promise<boolean>
  onSent?: () => void
}) {
  const [info, setInfo] = useState<TextStatus>(initial)
  const [phoneText, setPhoneText] = useState(initial.clientPhone ? formatPhone(initial.clientPhone) : '')
  const [agreed, setAgreed] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState<{ to: string; picture: boolean } | null>(null)
  const phone = normalizePhone(phoneText)

  // Re-check consent / STOP for the number typed (once it is a full number).
  const seq = useRef(0)
  useEffect(() => {
    if (!phone) return
    const mine = ++seq.current
    const t = setTimeout(() => {
      fetch(`/api/texting/status?videoId=${encodeURIComponent(videoId)}&phone=${encodeURIComponent(phone)}`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d && mine === seq.current) setInfo((prev) => ({ ...prev, ...d })) })
        .catch(() => {})
    }, 400)
    return () => clearTimeout(t)
  }, [phone, videoId])

  const [origin, setOrigin] = useState('https://docs2video.com')
  useEffect(() => { setOrigin(window.location.origin) }, [])
  const message = useMemo(() => buildClientText({
    clientName, agentName: info.agentName, link: `${origin}/watch/${videoId}`, note, thing, insurance,
  }), [clientName, info.agentName, origin, videoId, note, thing, insurance])
  const picture = !!posterUrl && (!phone || canSendPicture(phone))
  const knownConsent = !!(phone && info.phone === phone && info.consent)
  const optedOut = !!(phone && info.phone === phone && info.optedOut)
  const cost = info.cost ?? 0
  const blocked = !info.clientTexts
  const who = clientName.trim().split(/\s+/)[0] || 'your client'

  async function send() {
    if (sending) return
    setError(''); setSent(null)
    if (!phone) { setError('Enter their mobile number first — 10 digits, like 512 555 0100.'); return }
    if (!knownConsent && !agreed) { setError('Tick “This client agreed to get texts from me” first.'); return }
    setSending(true)
    try {
      if (!(await beforeSend())) { setError('Your note did not save, so nothing was sent. Try again.'); return }
      const r = await fetch('/api/texting/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, phone, clientName: clientName || undefined, clientId: clientId || undefined, note, consent: knownConsent || agreed }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d?.success) { setError(d?.error || 'The text did NOT send. Try again, or send by email.'); return }
      setSent({ to: d.to, picture: !!d.withPicture })
      setInfo((prev) => ({ ...prev, phone, consent: true }))
      onSent?.()
    } catch {
      setError('The text did NOT send — network problem. Try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="rts-text" aria-label="Send by text">
      {blocked && (
        <Note tone="warn" title="Texting clients isn’t switched on yet.">
          Phone carriers need our texting number registered first. Until then, send it by email or copy the link. Alerts to you still work.
        </Note>
      )}

      <label className="input-label" htmlFor="rts-phone">Client mobile number</label>
      <input
        id="rts-phone"
        className="input"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="e.g. (512) 555-0100"
        value={phoneText}
        onChange={(e) => { setPhoneText(e.target.value); setError(''); setSent(null) }}
        onBlur={() => { if (phone) setPhoneText(formatPhone(phone)) }}
      />
      <div className="rts-row-hint">
        {phoneText && !phone ? 'That isn’t a full number yet. US numbers need 10 digits; other countries start with +.' : 'US numbers can be typed any way. Other countries: start with +.'}
      </div>

      <div className="rts-eyebrow" style={{ marginTop: 14 }}>What they get</div>
      <div className="rts-phone" aria-label="Text message preview">
        <div className="rts-phone-from">{info.agentName ? `From ${info.agentName}` : 'Text message'}</div>
        {picture && posterUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="rts-bubble-pic" src={posterUrl} alt="" />
        )}
        <div className="rts-bubble">{message}</div>
        <div className="rts-phone-meta">
          {picture ? 'With the video’s picture' : 'Their phone shows a link preview'} · {smsParts(message)} {smsParts(message) === 1 ? 'part' : 'parts'}
        </div>
      </div>

      {optedOut ? (
        <Note tone="stop" className="rts-gap">This number replied STOP. They can’t be texted unless they text START back. Send it by email instead.</Note>
      ) : knownConsent ? (
        <div className="rts-row-hint rts-gap">✓ They already agreed to get texts from you.</div>
      ) : (
        <label className="rts-consent rts-gap">
          <input type="checkbox" checked={agreed} onChange={(e) => { setAgreed(e.target.checked); setError('') }} />
          <span>
            <strong>This client agreed to get texts from me.</strong>
            <span className="rts-row-hint" style={{ display: 'block' }}>Asked once per number and saved. They can reply STOP at any time.</span>
          </span>
        </label>
      )}

      {error && <div role="alert" className="rts-error" style={{ marginTop: 14 }}>{error}</div>}
      {sent && (
        <div role="status" className="rts-sent">
          ✓ Texted to <strong>{formatPhone(sent.to)}</strong>{sent.picture ? ' with the video’s picture' : ''}. Their replies show under Who watched.
        </div>
      )}
      <button
        type="button"
        className="btn btn-primary btn-full"
        style={{ marginTop: 14 }}
        onClick={send}
        disabled={sending || blocked || optedOut}
      >
        <span className="rts-icon-link">
          <MessageSquare size={16} />
          {sending ? 'Sending…' : `${sent ? 'Text again' : 'Text'} ${who}`}{cost ? ` · ${cost.toLocaleString()} credits` : ''}
        </span>
      </button>
      <div className="rts-row-hint rts-from">
        Sent from the Docs2Video texting number, signed with your name. We give the credits back if it doesn’t go through.
        {' '}<Link href="/help/texting">How texting works</Link>
      </div>
    </div>
  )
}
