// =============================================================================
// What the client's share page (/watch/[id]) will show, worked out the SAME
// way that page works it out — so the "Ready to send" preview never promises
// something the client won't see. Pure: no database, no browser.
//
// Each rule below names the share-page rule it copies:
//   * Welcome line   — recipient_name, else the quote's client name (first word)
//   * Note           — videos.agent_note
//   * Book a call    — the per-video booking link, else the agent's booking
//                      link from Settings. There is NO per-video off switch
//                      for this on the share page, so the panel only reports it.
//   * Quote          — the newest quote that is not a 'draft'. Unpaid → quote
//                      card with a Pay button (needs a payment link, else
//                      "Contact … to pay"); paid → "Payment complete".
//   * Original PDF   — videos.allow_source_download
//   * Reminders      — quotes.auto_follow_up, only while the quote is open
//                      ('sent'/'viewed'), with a client email, and only from
//                      the agent's own connected mailbox (the cron skips
//                      everyone else). Days come from follow-up-schedule.ts.
// =============================================================================

import { FOLLOW_UP_STAGES, OPEN_QUOTE_STATUSES } from '../../../../_lib/follow-up-schedule'

export interface QuoteLike {
  id: string
  status: string
  client_name?: string | null
  client_email?: string | null
  auto_follow_up?: boolean | null
  total?: number | null
  line_items?: { description: string; amount: number }[] | null
}

/** Only https links become buttons on the share page. */
export function httpsOnly(v: unknown): string {
  const s = typeof v === 'string' ? v.trim() : ''
  return /^https:\/\/[^\s]+$/i.test(s) ? s : ''
}

export function isOpenQuote(q: QuoteLike | null | undefined): boolean {
  return !!q && (OPEN_QUOTE_STATUSES as readonly string[]).includes(String(q.status))
}

/** "day 3 and day 7" — straight from the schedule the cron really uses. */
export function reminderDaysText(): string {
  const days = FOLLOW_UP_STAGES.map(s => `day ${s.day}`)
  return days.length <= 1 ? days.join('') : `${days.slice(0, -1).join(', ')} and ${days[days.length - 1]}`
}

export type QuoteSwitch =
  | { kind: 'none' }                                      // no quote yet
  | { kind: 'toggle'; on: boolean }                       // draft (off) or open (on)
  | { kind: 'locked'; status: 'paid' | 'accepted' | 'declined' | string }

/** The quote switch. Hiding a quote = status 'draft' (the share page skips drafts). */
export function quoteSwitch(q: QuoteLike | null | undefined): QuoteSwitch {
  if (!q) return { kind: 'none' }
  if (q.status === 'draft') return { kind: 'toggle', on: false }
  if (isOpenQuote(q)) return { kind: 'toggle', on: true }
  return { kind: 'locked', status: q.status }
}

export type ReminderSwitch =
  | { usable: true; on: boolean; blockedOn: string | null }
  | { usable: false; reason: string }

/**
 * The reminder switch. `usable:false` hides the switch behind a reason, so it
 * can never look on while nothing would be sent. `blockedOn` means it may be
 * switched OFF but not ON (e.g. no connected mailbox).
 */
export function reminderSwitch(q: QuoteLike | null | undefined, hasMailbox: boolean | null): ReminderSwitch {
  if (!q) return { usable: false, reason: 'Needs a quote — reminders are about the quote.' }
  if (q.status === 'draft') return { usable: false, reason: 'Show the quote first — reminders only go while it is on their page.' }
  if (!isOpenQuote(q)) return { usable: false, reason: `Off — this deal is marked ${q.status}.` }
  if (!q.client_email) return { usable: false, reason: 'Add the client’s email to the quote (below) to use this.' }
  const on = q.auto_follow_up === true
  const blockedOn = hasMailbox === false
    ? 'Reminders go from your own email only. Connect it in Settings first.'
    : null
  return { usable: true, on, blockedOn }
}

export interface PreviewAgent {
  full_name?: string | null
  company_name?: string | null
  photo_url?: string | null
  calendly_url?: string | null
  payment_link_url?: string | null
}

export interface PreviewInput {
  recipientName: string | null | undefined
  note: string
  allowSourceDownload: boolean
  /** The quote the share page shows (newest non-draft), or null. */
  publicQuote: QuoteLike | null
  agent: PreviewAgent | null
  pipelineBookingUrl?: unknown
  pipelinePaymentLink?: unknown
}

export interface PreviewModel {
  greetingName: string
  agentName: string
  note: string
  bookingUrl: string
  paymentLink: string
  quote: { state: 'unpaid' | 'paid'; total: number; payable: boolean; clientName: string | null } | null
  sourcePdf: boolean
}

export function buildPreview(i: PreviewInput): PreviewModel {
  const clientName = String(i.recipientName || i.publicQuote?.client_name || '').trim()
  const bookingUrl = httpsOnly(i.pipelineBookingUrl) || httpsOnly(i.agent?.calendly_url)
  const paymentLink = httpsOnly(i.pipelinePaymentLink) || httpsOnly(i.agent?.payment_link_url)
  const q = i.publicQuote
  return {
    greetingName: clientName.split(/\s+/)[0] || '',
    agentName: String(i.agent?.full_name || i.agent?.company_name || '').trim(),
    note: i.note.trim(),
    bookingUrl,
    paymentLink,
    quote: q
      ? {
          state: q.status === 'paid' ? 'paid' : 'unpaid',
          total: Number(q.total ?? 0),
          payable: !!paymentLink && Number(q.total ?? 0) > 0,
          clientName: q.client_name ?? null,
        }
      : null,
    sourcePdf: i.allowSourceDownload,
  }
}

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}
