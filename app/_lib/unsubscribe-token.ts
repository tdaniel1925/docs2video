// =============================================================================
// Signed unsubscribe links.
//
// An unsubscribe link has to work with no login (the person clicking it has
// no account, or isn't signed in). That makes the link itself the only proof
// of who is unsubscribing — so it is signed. Change one character of the id
// or email and the signature no longer matches, so nobody can unsubscribe a
// different person by editing the URL.
//
// Three kinds:
//   'user'   — a Docs2Video account holder (nurture / lifecycle emails)
//   'lead'   — someone who ran a landing-page demo (demo_videos row)
//   'client' — an agent's client, opting out of THAT agent's automatic
//              follow-ups (payload: the agent's user id + the client email)
// =============================================================================

import { createHmac, timingSafeEqual } from 'crypto'

export type UnsubKind = 'user' | 'lead' | 'client'
export interface UnsubPayload { k: UnsubKind; id: string; e?: string }

function secret(): string | null {
  const s = process.env.EMAIL_UNSUBSCRIBE_SECRET || process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  return s.trim() || null
}

function sign(body: string, key: string): string {
  return createHmac('sha256', key).update(body).digest('base64url')
}

/** Make a token, or null when no signing secret is configured (caller must not send). */
export function makeUnsubToken(p: UnsubPayload): string | null {
  const key = secret()
  if (!key) return null
  const body = Buffer.from(JSON.stringify({ k: p.k, id: p.id, ...(p.e ? { e: p.e.toLowerCase().trim() } : {}) })).toString('base64url')
  return `${body}.${sign(body, key)}`
}

/** Check a token. Returns the payload only if the signature is genuine. */
export function readUnsubToken(token: string | null | undefined): UnsubPayload | null {
  const key = secret()
  if (!key || !token) return null
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return null
  const body = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = sign(body, key)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as UnsubPayload
    if (!p || (p.k !== 'user' && p.k !== 'lead' && p.k !== 'client') || typeof p.id !== 'string') return null
    if (p.k === 'client' && !p.e) return null
    return p
  } catch {
    return null
  }
}

/** The full link to put in an email footer (null = can't make one; don't send). */
export function unsubscribeUrl(p: UnsubPayload): string | null {
  const t = makeUnsubToken(p)
  if (!t) return null
  const base = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://docs2video.com').trim().replace(/\/$/, '')
  return `${base}/api/email-prefs?t=${encodeURIComponent(t)}`
}
