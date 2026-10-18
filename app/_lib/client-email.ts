// =============================================================================
// Small, shared helpers for emails that go to CLIENTS (and alerts to agents).
//
// Each of these fixes a bug that showed up in more than one route:
//   * Resend v6 does NOT throw when a send fails — it RETURNS { error }. Every
//     route awaited the call and said "sent" regardless. sendWithResend() turns
//     the returned error into a real failure the caller has to handle.
//   * Messages typed by the agent were dropped into HTML raw: newlines vanished
//     (every paragraph ran together) and any "<" broke the layout.
//     messageToHtml() escapes the text and makes real paragraphs.
//   * The share email added its own "Hi John," above a message that already
//     started with "Hi John," — so every client read "Hi John, Hi John,".
//     startsWithGreeting() lets the sender add a greeting only when missing.
// =============================================================================

import { Resend } from 'resend'

/** Escape text so it can sit inside HTML (body or attribute) safely. */
export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Plain text (as typed in a textarea) → HTML paragraphs.
 * A blank line starts a new paragraph; a single line break stays a line break.
 */
export function messageToHtml(text: string, pStyle = 'margin:0 0 16px;font-size:15px;line-height:1.6;color:#444;'): string {
  const normalized = String(text ?? '').replace(/\r\n?/g, '\n').trim()
  if (!normalized) return ''
  return normalized
    .split(/\n\s*\n+/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p style="${pStyle}">${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`)
    .join('\n')
}

/** Does this message already open with a greeting ("Hi Jane,", "Hello", "Dear …")? */
export function startsWithGreeting(text: string): boolean {
  return /^\s*(hi|hello|hey|dear|greetings|good (morning|afternoon|evening))\b/i.test(String(text ?? ''))
}

let _resend: Resend | null = null
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY!)
  return _resend
}

export type SendResult = { ok: true; id: string | null } | { ok: false; error: string }

/**
 * Send through Resend and report the TRUE outcome. Never throws.
 * A missing API key is a failure too — not a quiet "sent".
 */
export async function sendWithResend(payload: {
  from: string
  to: string | string[]
  subject: string
  html: string
  replyTo?: string
  headers?: Record<string, string>
}): Promise<SendResult> {
  if (!process.env.RESEND_API_KEY) return { ok: false, error: 'Email service is not configured' }
  try {
    const res = await getResend().emails.send(payload)
    if (res.error) return { ok: false, error: res.error.message || 'Email service rejected the message' }
    return { ok: true, id: res.data?.id ?? null }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Email send failed' }
  }
}

/** The public site address used in links inside emails (no trailing slash). */
export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://docs2video.com').trim().replace(/\/$/, '')
}

/** Only https links go into a client-facing button (no javascript:, no http). */
export function safeHttpsUrl(url: unknown): string {
  const s = String(url ?? '').trim()
  if (!/^https:\/\//i.test(s)) return ''
  try { new URL(s); return s } catch { return '' }
}
