import { createHmac, randomBytes, timingSafeEqual } from 'crypto'

/**
 * Signed, single-use, expiring `state` for the Gmail / Outlook connect flow.
 *
 * The old flow put the bare user id in `state` and the callback trusted it, so
 * anyone could finish an OAuth flow with THEIR mailbox and `state=<victim id>`
 * and the victim's client emails would go out through the attacker's account.
 *
 * Now:
 *  - state = base64url(JSON payload) + "." + HMAC-SHA256 signature
 *  - the payload carries the user id, provider, a random nonce and an expiry
 *  - the nonce is also set as an httpOnly cookie on the browser that started
 *    the flow; the callback requires the cookie to match and clears it, so a
 *    state value works once, in that browser only
 *  - the callback ALSO requires the signed-in session to be the same user.
 *
 * Signing secret: OAUTH_STATE_SECRET if set, else derived from the Supabase
 * service-role key (server-only, always present in production).
 */

export const OAUTH_NONCE_COOKIE = 'd2v_oauth_nonce'
export const OAUTH_STATE_TTL_SECONDS = 10 * 60

export type OAuthProvider = 'google' | 'microsoft'

export interface OAuthStatePayload {
  u: string          // user id
  p: OAuthProvider   // provider
  n: string          // nonce (matches the cookie)
  e: number          // expiry, unix seconds
}

function secret(): string {
  const s = (process.env.OAUTH_STATE_SECRET || '').trim()
  if (s) return s
  const fallback = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  if (!fallback) throw new Error('No OAUTH_STATE_SECRET or SUPABASE_SERVICE_ROLE_KEY to sign OAuth state')
  // Derive, so the service key itself is never used directly as an HMAC key
  // for something that leaves the server.
  return createHmac('sha256', fallback).update('d2v-oauth-state-v1').digest('hex')
}

function sign(data: string, key = secret()): string {
  return createHmac('sha256', key).update(data).digest('base64url')
}

export function createOAuthState(userId: string, provider: OAuthProvider, now = Date.now()): { state: string; nonce: string } {
  const nonce = randomBytes(16).toString('base64url')
  const payload: OAuthStatePayload = { u: userId, p: provider, n: nonce, e: Math.floor(now / 1000) + OAUTH_STATE_TTL_SECONDS }
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  return { state: `${body}.${sign(body)}`, nonce }
}

export type StateCheck =
  | { ok: true; payload: OAuthStatePayload }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' | 'wrong_provider' | 'nonce_mismatch' | 'wrong_user' }

/**
 * Verify everything about a returned state. `cookieNonce` is the value of the
 * OAUTH_NONCE_COOKIE cookie; `sessionUserId` is the signed-in user (or null).
 */
export function verifyOAuthState(
  state: string | null | undefined,
  opts: { provider: OAuthProvider; cookieNonce: string | null | undefined; sessionUserId: string | null | undefined; now?: number },
): StateCheck {
  if (!state || typeof state !== 'string') return { ok: false, reason: 'malformed' }
  const dot = state.indexOf('.')
  if (dot <= 0 || dot === state.length - 1) return { ok: false, reason: 'malformed' }
  const body = state.slice(0, dot)
  const sig = state.slice(dot + 1)

  const expected = Buffer.from(sign(body))
  const got = Buffer.from(sig)
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return { ok: false, reason: 'bad_signature' }

  let payload: OAuthStatePayload
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    return { ok: false, reason: 'malformed' }
  }
  if (!payload || typeof payload.u !== 'string' || typeof payload.n !== 'string' || typeof payload.e !== 'number') {
    return { ok: false, reason: 'malformed' }
  }
  const nowSec = Math.floor((opts.now ?? Date.now()) / 1000)
  if (payload.e < nowSec) return { ok: false, reason: 'expired' }
  if (payload.p !== opts.provider) return { ok: false, reason: 'wrong_provider' }

  const cookie = opts.cookieNonce || ''
  const a = Buffer.from(cookie)
  const b = Buffer.from(payload.n)
  if (!cookie || a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: 'nonce_mismatch' }

  if (!opts.sessionUserId || opts.sessionUserId !== payload.u) return { ok: false, reason: 'wrong_user' }

  return { ok: true, payload }
}

/** Cookie options for the nonce: httpOnly, only sent to the callback routes. */
export function nonceCookieOptions(maxAge = OAUTH_STATE_TTL_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const, // the provider's redirect back is a top-level GET
    path: '/api/auth',
    maxAge,
  }
}
