import crypto from 'crypto'

// =============================================================================
// TWILIO, OVER PLAIN fetch (no SDK) — send a text, check a webhook signature,
// and read (never change) whether the sending number may text clients.
//
// Patterns reused from Jordyn (lib/twilio.ts, lib/a2p-coverage.ts).
//
// The environment values are TRIMMED: in Vercel production all three Twilio
// values were saved with a line break at the end (found 2026-10-10), which
// breaks the account address and the login.
// =============================================================================

const API = 'https://api.twilio.com/2010-04-01'
const MSG = 'https://messaging.twilio.com/v1'

/** Strip spaces and a stray literal "\n" or real line break from an env value. */
export function cleanEnv(v: string | undefined | null): string {
  return String(v ?? '').replace(/\\n/g, '').replace(/^["']|["']$/g, '').trim()
}

export function twilioEnv() {
  return {
    sid: cleanEnv(process.env.TWILIO_ACCOUNT_SID),
    token: cleanEnv(process.env.TWILIO_AUTH_TOKEN),
    from: cleanEnv(process.env.TWILIO_PHONE_NUMBER),
  }
}

export function twilioConfigured(): boolean {
  const e = twilioEnv()
  return !!(e.sid && e.token && e.from)
}

function authHeader(sid: string, token: string) {
  return `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`
}

export type TwilioSendResult =
  | { ok: true; sid: string; status: string }
  | { ok: false; code: string; message: string; accountProblem: boolean }

/**
 * Send one text (with a picture when `mediaUrl` is given — US/Canada only).
 * Never throws: a failure comes back with Twilio's error code and message.
 */
export async function twilioSend(o: { to: string; body: string; mediaUrl?: string | null; statusCallback?: string | null }): Promise<TwilioSendResult> {
  const { sid, token, from } = twilioEnv()
  if (!sid || !token || !from) return { ok: false, code: 'not_configured', message: 'Texting is not set up on this server (Twilio keys missing).', accountProblem: true }
  const form = new URLSearchParams({ To: o.to, From: from, Body: o.body.slice(0, 1500) })
  if (o.mediaUrl) form.append('MediaUrl', o.mediaUrl)
  if (o.statusCallback) form.append('StatusCallback', o.statusCallback)
  try {
    const res = await fetch(`${API}/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: authHeader(sid, token), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
      signal: AbortSignal.timeout(15_000),
    })
    const j = (await res.json().catch(() => ({}))) as { sid?: string; status?: string; code?: number | string; message?: string }
    if (!res.ok || !j.sid) {
      const code = String(j.code ?? res.status)
      return { ok: false, code, message: String(j.message ?? `Twilio answered ${res.status}`), accountProblem: res.status === 401 || code === '20003' }
    }
    return { ok: true, sid: j.sid, status: String(j.status ?? 'queued') }
  } catch (e) {
    return { ok: false, code: 'network', message: e instanceof Error ? e.message : 'Could not reach Twilio', accountProblem: false }
  }
}

/**
 * Is this request really from Twilio? HMAC-SHA1 of the exact public URL plus
 * the form fields sorted by name, keyed with the auth token, base64.
 * https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */
export function validateTwilioSignature(url: string, params: Record<string, string>, signature: string | null | undefined, token = twilioEnv().token): boolean {
  if (!token || !signature) return false
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join('')
  const expected = crypto.createHmac('sha1', token).update(Buffer.from(data, 'utf8')).digest('base64')
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

// ── Can we text? (read-only checks) ─────────────────────────────────────────

export type TextingState = 'ok' | 'pending' | 'not_registered' | 'account_inactive' | 'not_configured' | 'unknown'

export interface TextingHealth {
  /** Texts to the AGENT (verify codes, alerts) can be tried. */
  agentTexts: boolean
  /** Texts to CLIENTS are allowed (the number is registered for business texting). */
  clientTexts: boolean
  state: TextingState
  /** One plain sentence for the screen. */
  detail: string
  numberType: 'tollfree' | 'local' | null
  checkedAt: string
}

const TOLL_FREE = /^\+18(00|33|44|55|66|77|88)\d{7}$/

let cache: { at: number; ttl: number; value: TextingHealth } | null = null

/** For tests. */
export function resetTextingHealthCache() { cache = null }

/**
 * Read Twilio (never change anything) to find out whether texting works:
 *   1. is the account active?
 *   2. is the sending number on it?
 *   3. toll-free number → is its toll-free verification approved?
 *      local number → is it in a Messaging Service whose A2P 10DLC campaign
 *      is VERIFIED?
 * Cached 10 minutes (2 when the answer is "couldn't tell").
 */
export async function checkTextingHealth(force = false): Promise<TextingHealth> {
  if (!force && cache && Date.now() - cache.at < cache.ttl) return cache.value
  const value = await readHealth()
  cache = { at: Date.now(), ttl: value.state === 'unknown' ? 2 * 60_000 : 10 * 60_000, value }
  return value
}

async function readHealth(): Promise<TextingHealth> {
  const at = new Date().toISOString()
  const { sid, token, from } = twilioEnv()
  const out = (state: TextingState, detail: string, numberType: TextingHealth['numberType'] = null): TextingHealth => ({
    state, detail, numberType, checkedAt: at,
    agentTexts: state === 'ok' || state === 'pending' || state === 'not_registered' || state === 'unknown',
    clientTexts: state === 'ok',
  })
  if (!sid || !token || !from) return out('not_configured', 'Texting is not set up (the Twilio keys are missing).')
  const get = async (url: string) => {
    const r = await fetch(url, { headers: { Authorization: authHeader(sid, token) }, signal: AbortSignal.timeout(8000) })
    return { status: r.status, j: (await r.json().catch(() => ({}))) as Record<string, unknown> }
  }
  try {
    const acct = await get(`${API}/Accounts/${sid}.json`)
    if (acct.status === 401 || acct.status === 403) {
      const msg = String(acct.j.message ?? '')
      return out('account_inactive', /not active/i.test(msg)
        ? 'The Twilio account is not active (Twilio says it is suspended or closed), so no texts can be sent.'
        : 'Twilio refused our keys, so no texts can be sent.')
    }
    if (acct.status !== 200) return out('unknown', `Couldn’t check Twilio just now (error ${acct.status}).`)
    if (String(acct.j.status) !== 'active') return out('account_inactive', `The Twilio account is ${String(acct.j.status)}, so no texts can be sent.`)

    const nums = await get(`${API}/Accounts/${sid}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(from)}`)
    const num = ((nums.j.incoming_phone_numbers as { sid: string; phone_number: string }[] | undefined) ?? [])[0]
    if (!num) return out('unknown', 'The sending number isn’t on this Twilio account.')

    if (TOLL_FREE.test(from)) {
      const v = await get(`${MSG}/Tollfree/Verifications?TollfreePhoneNumberSid=${num.sid}`)
      const st = String(((v.j.verifications as { status?: string }[] | undefined) ?? [])[0]?.status ?? '').toUpperCase()
      if (st === 'TWILIO_APPROVED') return out('ok', 'The toll-free number is verified for business texts.', 'tollfree')
      if (st === 'PENDING_REVIEW' || st === 'IN_REVIEW') return out('pending', 'The toll-free number’s verification is waiting for approval.', 'tollfree')
      return out('not_registered', 'The toll-free number isn’t verified for business texts yet.', 'tollfree')
    }

    const svcs = await get(`${MSG}/Services?PageSize=50`)
    for (const s of (svcs.j.services as { sid: string }[] | undefined) ?? []) {
      const pn = await get(`${MSG}/Services/${s.sid}/PhoneNumbers?PageSize=400`)
      const has = ((pn.j.phone_numbers as { phone_number: string }[] | undefined) ?? []).some((p) => p.phone_number === from)
      if (!has) continue
      const a2p = await get(`${MSG}/Services/${s.sid}/Compliance/Usa2p`)
      const statuses = ((a2p.j.compliance as { campaign_status?: string }[] | undefined) ?? []).map((c) => String(c.campaign_status ?? '').toUpperCase())
      if (statuses.includes('VERIFIED')) return out('ok', 'The number is registered for business texts (A2P 10DLC approved).', 'local')
      if (statuses.some((x) => x === 'IN_PROGRESS' || x === 'PENDING')) return out('pending', 'The number’s A2P 10DLC registration is waiting for approval.', 'local')
      return out('not_registered', 'The number is in a Messaging Service, but it has no approved A2P 10DLC campaign.', 'local')
    }
    return out('not_registered', 'The number isn’t registered for business texts (no A2P 10DLC campaign).', 'local')
  } catch {
    return out('unknown', 'Couldn’t reach Twilio to check just now.')
  }
}
