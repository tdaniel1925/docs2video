// =============================================================================
// TEXTING — the plain rules, shared by the screens and the server.
//
// Two features use these:
//   * HOT-CLIENT ALERTS — we text/email the AGENT when a client is ready
//     ("Maria watched it to the end, twice. Call now?").
//   * SEND BY TEXT — the agent texts a CLIENT the share link.
//
// Pure: no database, no Twilio, no Node-only imports — so the send panel can
// build the exact same message preview the server sends, and tests can run
// every rule directly. The server parts live in texting-core.ts.
// =============================================================================

// The price of one client text is CREDIT_COSTS['client-text'] (credits.ts).
// Alerts and verify codes to the agent are free.

/** At most this many client texts per account per day (abuse + cost cap). */
export const CLIENT_TEXT_DAILY_CAP = 50
/** At most this many alert TEXTS to the agent per day; past it, alerts still
 *  go by email (when email is on), so a viral link can't run up a bill. */
export const ALERT_TEXT_DAILY_CAP = 20
/** A verify code lasts 10 minutes and allows 5 guesses. */
export const CODE_MINUTES = 10
export const CODE_MAX_TRIES = 5

/** Quiet hours in the agent's own time: no alert texts 9pm–8am. */
export const QUIET_START_HOUR = 21
export const QUIET_END_HOUR = 8
/** When we don't know the agent's time zone. US Central (the company's own). */
export const DEFAULT_TIME_ZONE = 'America/Chicago'

// ── Phone numbers ────────────────────────────────────────────────────────────

/**
 * A phone number in E.164 ("+15125550100"), or null when it can't be one.
 * US is the default: 10 digits → +1, 11 digits starting with 1 → +1.
 * A leading + keeps the country the person typed. US numbers must have a real
 * area code and exchange (they can't start with 0 or 1).
 */
export function normalizePhone(input: string | null | undefined): string | null {
  const raw = String(input ?? '').trim()
  if (!raw) return null
  // Letters mean it isn't a phone number (ext. and the like are not supported).
  if (/[a-z]/i.test(raw)) return null
  const hadPlus = raw.startsWith('+') || raw.startsWith('00')
  let digits = raw.replace(/\D/g, '')
  if (raw.startsWith('00')) digits = digits.slice(2)
  if (!digits) return null
  let e164: string
  if (hadPlus) e164 = `+${digits}`
  else if (digits.length === 10) e164 = `+1${digits}`
  else if (digits.length === 11 && digits.startsWith('1')) e164 = `+${digits}`
  else return null
  if (!/^\+[1-9]\d{7,14}$/.test(e164)) return null
  if (e164.startsWith('+1')) {
    const nanp = e164.slice(2)
    if (nanp.length !== 10) return null
    if (/^[01]/.test(nanp) || /^\d{3}[01]/.test(nanp)) return null
  }
  return e164
}

/** "+15125550100" → "(512) 555-0100"; other countries stay as they are. */
export function formatPhone(e164: string | null | undefined): string {
  const s = String(e164 ?? '')
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(s)
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : s
}

/** Twilio sends picture messages (MMS) only to US and Canadian numbers. */
export function canSendPicture(e164: string): boolean {
  return e164.startsWith('+1')
}

// ── The client text ──────────────────────────────────────────────────────────

/** A note goes in the text only when it is short — a long one stays on the
 *  share page, where the client reads it anyway. */
export const NOTE_IN_TEXT_MAX = 140

export const STOP_LINE = 'Reply STOP to opt out.'

export function firstName(name: string | null | undefined): string {
  return String(name ?? '').trim().split(/\s+/)[0] ?? ''
}

/**
 * The one text a client gets. The agent's name is always in it (the client
 * must know who is texting), then the link, then the note if it is short,
 * then how to stop.
 */
export function buildClientText(o: {
  clientName?: string | null
  agentName?: string | null
  link: string
  note?: string | null
  thing?: 'video' | 'presentation'
  insurance?: boolean
}): string {
  const hi = firstName(o.clientName) ? `Hi ${firstName(o.clientName)}, ` : 'Hi, '
  const who = String(o.agentName ?? '').trim().slice(0, 60) || 'your agent'
  const thing = o.thing ?? 'video'
  const lines = [`${hi}it's ${who}. I made a short ${thing} for you: ${o.link}`]
  const note = String(o.note ?? '').trim().replace(/\s+/g, ' ')
  if (note && note.length <= NOTE_IN_TEXT_MAX) lines.push(note)
  if (o.insurance) lines.push('For education only, not advice. Details on the page.')
  lines.push(STOP_LINE)
  return lines.join('\n')
}

/** How many text "parts" a message is billed as (160 plain characters a part,
 *  153 when split; 70/67 when it has emoji or other special characters). */
export function smsParts(text: string): number {
  // eslint-disable-next-line no-control-regex
  const gsm = /^[\x0A\x0D\x20-\x7E£¥èéùìòÇØøÅå_ÆæßÉ¡ÄÖÑÜ§¿äöñüà€]*$/.test(text)
  const single = gsm ? 160 : 70
  const multi = gsm ? 153 : 67
  const len = [...text].length
  return len <= single ? 1 : Math.ceil(len / multi)
}

// ── Inbound keywords (carrier standard) ─────────────────────────────────────

export type OptKeyword = 'STOP' | 'START' | 'HELP'

const STOP_WORDS = new Set(['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT', 'OPTOUT', 'OPT OUT', 'REVOKE'])
const START_WORDS = new Set(['START', 'YES', 'UNSTOP', 'SUBSCRIBE', 'OPTIN', 'OPT IN'])
const HELP_WORDS = new Set(['HELP', 'INFO'])

/** Which keyword a whole reply IS ("stop by tomorrow" is not an opt-out).
 *  Twilio's own OptOutType wins when it sends one. */
export function optKeywordOf(body: unknown, optOutType?: string | null): OptKeyword | null {
  const t = String(optOutType ?? '').trim().toUpperCase()
  if (t === 'STOP' || t === 'START' || t === 'HELP') return t
  const w = String(body ?? '').trim().toUpperCase().replace(/[.!?\s]+$/g, '').replace(/\s+/g, ' ')
  if (!w || w.length > 20) return null
  if (STOP_WORDS.has(w)) return 'STOP'
  if (START_WORDS.has(w)) return 'START'
  if (HELP_WORDS.has(w)) return 'HELP'
  return null
}

// ── Hot-client alerts ───────────────────────────────────────────────────────

export type HotTrigger = 'finished' | 'twice' | 'pdf' | 'booking'
export const HOT_TRIGGERS: HotTrigger[] = ['finished', 'twice', 'pdf', 'booking']
export type AlertChannel = 'off' | 'text' | 'email' | 'both'
export const ALERT_CHANNELS: AlertChannel[] = ['off', 'text', 'email', 'both']

/** What each trigger is called on the settings screen. */
export const TRIGGER_LABELS: Record<HotTrigger, { label: string; hint: string }> = {
  finished: { label: 'Watched to the end', hint: 'They got through the whole thing (80% or more).' },
  twice: { label: 'Came back a second time', hint: 'They opened it again on another visit.' },
  pdf: { label: 'Opened the PDF', hint: 'They downloaded the original PDF from their page.' },
  booking: { label: 'Pressed Book a call', hint: 'They clicked your booking button.' },
}

export function normalizeChannel(v: unknown): AlertChannel {
  return ALERT_CHANNELS.includes(v as AlertChannel) ? (v as AlertChannel) : 'off'
}

export interface AlertSettings {
  channel: AlertChannel
  triggers: Record<HotTrigger, boolean>
  phone: string | null
  phoneVerified: boolean
  timeZone: string | null
}

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  channel: 'off',
  triggers: { finished: true, twice: true, pdf: true, booking: true },
  phone: null,
  phoneVerified: false,
  timeZone: null,
}

/**
 * Which hot moment (if any) a share-page event is.
 *   'complete'                 → finished (the share page sends it at the end;
 *                                 its progress steps stop at 75%, so the end
 *                                 is the first point we KNOW 80%+ was watched)
 *   'view' with an earlier view → twice (viewsByThisViewer counts this one)
 *   'download' of the source PDF → pdf
 *   'booking_click' / 'book_meeting' → booking
 */
export function triggerForEvent(eventType: string, metadata: Record<string, unknown> | null | undefined, viewsByThisViewer = 0): HotTrigger | null {
  switch (eventType) {
    case 'complete': return 'finished'
    case 'progress': return Number(metadata?.percent) >= 80 ? 'finished' : null
    case 'view': return viewsByThisViewer >= 2 ? 'twice' : null
    case 'download': return !metadata?.type || metadata.type === 'source_pdf' ? 'pdf' : null
    case 'booking_click':
    case 'book_meeting': return 'booking'
    default: return null
  }
}

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || !tz || tz.length > 64) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

function zoneParts(at: Date, tz: string): { y: string; m: string; d: string; hour: number; minute: number } {
  const zone = isValidTimeZone(tz) ? tz : DEFAULT_TIME_ZONE
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(at)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  return { y: get('year'), m: get('month'), d: get('day'), hour: Number(get('hour')) % 24, minute: Number(get('minute')) }
}

/** The agent's calendar day ("2026-10-10") — the "per day" in the rate limit. */
export function alertDay(at: Date, tz: string | null | undefined): string {
  const p = zoneParts(at, tz || DEFAULT_TIME_ZONE)
  return `${p.y}-${p.m}-${p.d}`
}

/**
 * When an alert may go out. Inside quiet hours (9pm–8am, agent's time) it
 * waits until 8am; otherwise now.
 */
export function alertSendAt(at: Date, tz: string | null | undefined): { quiet: boolean; sendAt: Date } {
  const { hour, minute } = zoneParts(at, tz || DEFAULT_TIME_ZONE)
  if (hour >= QUIET_END_HOUR && hour < QUIET_START_HOUR) return { quiet: false, sendAt: at }
  const hoursUntil = hour >= QUIET_START_HOUR ? 24 - hour + QUIET_END_HOUR : QUIET_END_HOUR - hour
  const ms = (hoursUntil * 60 - minute) * 60_000 - at.getSeconds() * 1000 - at.getMilliseconds()
  return { quiet: true, sendAt: new Date(at.getTime() + ms) }
}

function shortTitle(t: string | null | undefined): string {
  const s = String(t ?? '').trim() || 'your video'
  return s.length > 40 ? `${s.slice(0, 39)}…` : s
}

/**
 * The alert the agent reads. Short, so it fits one or two text parts.
 * `visits` and `furthest` (0/25/50/75/100) add the useful extra.
 */
export function alertMessage(o: {
  trigger: HotTrigger
  clientName?: string | null
  title?: string | null
  visits?: number
  furthest?: number
  clientPhone?: string | null
  link: string
}): string {
  const who = String(o.clientName ?? '').trim() || 'A client'
  const t = `"${shortTitle(o.title)}"`
  const times = (o.visits ?? 0) >= 3 ? `, ${o.visits} times` : (o.visits ?? 0) === 2 ? ', twice' : ''
  let line: string
  switch (o.trigger) {
    case 'finished': line = `${who} watched ${t} to the end${times}. Call now?`; break
    case 'twice': line = `${who} came back to ${t}${times || ', twice'}${(o.furthest ?? 0) >= 25 ? ` and watched ${o.furthest}%` : ''}. Call now?`; break
    case 'pdf': line = `${who} opened the PDF with ${t}. Call now?`; break
    case 'booking': line = `${who} pressed Book a call on ${t}. Watch for the booking.`; break
  }
  const out = [line]
  if (o.clientPhone) out.push(`Call: ${o.clientPhone}`)
  out.push(`Open: ${o.link}`)
  return out.join('\n')
}
