// =============================================================================
// ANNUAL REVIEWS — the date rules, with no database in them.
//
// A client's policy anniversary is a calendar date (no time). "Review due in
// 30 days" is worked out in the AGENT'S time zone, so it changes at their
// midnight, not the server's (Vercel runs in UTC).
//
// Leap years: a policy issued on 29 February has its anniversary on
// 28 February in years without a 29th (the usual insurance practice — the
// anniversary never slides into the next month).
//
// Pure + tested (tests/annual-reviews.test.ts).
// =============================================================================

/** How many days ahead a review shows as due. */
export const REVIEW_LEAD_DAYS = 30
/** The second reminder. */
export const REVIEW_LAST_CALL_DAYS = 7
export const DEFAULT_TZ = 'America/New_York'

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

/** A real IANA zone, or the default. */
export function safeTz(tz: unknown): string {
  if (typeof tz !== 'string' || !tz) return DEFAULT_TZ
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return tz } catch { return DEFAULT_TZ }
}

/** Today's date (YYYY-MM-DD) on the wall calendar in `tz`. */
export function todayIn(tz: unknown, now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: safeTz(tz), year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

/** "2024-02-29" → { y, m, d }, or null when it isn't a real date. */
export function parseDate(s: unknown): { y: number; m: number; d: number } | null {
  const mt = ISO.exec(String(s ?? '').slice(0, 10))
  if (!mt) return null
  const y = +mt[1], m = +mt[2], d = +mt[3]
  if (m < 1 || m > 12 || d < 1) return null
  const dim = [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]
  if (d > dim) return null
  return { y, m, d }
}

const pad = (n: number) => String(n).padStart(2, '0')
const fmt = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`

/** The anniversary of month/day in year `y` (29 Feb → 28 Feb in a common year). */
export function anniversaryIn(y: number, m: number, d: number): string {
  if (m === 2 && d === 29 && !isLeapYear(y)) return fmt(y, 2, 28)
  return fmt(y, m, d)
}

/** The next anniversary on or after `today` (both YYYY-MM-DD). */
export function nextAnniversary(anniv: string, today: string): string | null {
  const a = parseDate(anniv), t = parseDate(today)
  if (!a || !t) return null
  const thisYear = anniversaryIn(t.y, a.m, a.d)
  return thisYear >= today ? thisYear : anniversaryIn(t.y + 1, a.m, a.d)
}

/** Whole days from `from` to `to` (calendar dates; no clock, no DST). */
export function daysBetween(from: string, to: string): number {
  const a = parseDate(from), b = parseDate(to)
  if (!a || !b) return NaN
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000)
}

export function addDays(date: string, n: number): string {
  const a = parseDate(date)
  if (!a) return date
  const t = new Date(Date.UTC(a.y, a.m - 1, a.d) + n * 86_400_000)
  return fmt(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate())
}

export type ReviewDue = { cycleDate: string; daysLeft: number; due: boolean }

/** Where a client is in their review year, in the agent's time zone. */
export function reviewDue(anniv: string | null | undefined, tz: unknown, now: Date = new Date()): ReviewDue | null {
  if (!anniv) return null
  const today = todayIn(tz, now)
  const next = nextAnniversary(anniv, today)
  if (!next) return null
  const daysLeft = daysBetween(today, next)
  return { cycleDate: next, daysLeft, due: daysLeft <= REVIEW_LEAD_DAYS }
}

/** "Review due today" / "Review due tomorrow" / "Review due in 30 days". */
export function dueWords(daysLeft: number): string {
  if (daysLeft <= 0) return 'Review due today'
  if (daysLeft === 1) return 'Review due tomorrow'
  return `Review due in ${daysLeft} days`
}

/** "14 March" — a date for people (no year when it's this year's). */
export function dateWords(iso: string, opts: { year?: boolean } = {}): string {
  const p = parseDate(iso)
  if (!p) return iso
  const d = new Date(Date.UTC(p.y, p.m - 1, p.d))
  return d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', ...(opts.year ? { year: 'numeric' } : {}) })
}

// ── The daily job, as a plan (so "run it twice" is testable) ────────────────

export type ClientDates = {
  id: string
  user_id: string
  name: string
  anniversary_date: string | null
  anniversary_confirmed: boolean | null
  anniversary_tz: string | null
}

export type ReviewRow = {
  id: string
  user_id: string
  client_id: string
  cycle_date: string
  status: string
  video_id: string | null
  send_on: string | null
  send_tz: string | null
  sent_at: string | null
  reminded_30_at: string | null
  reminded_7_at: string | null
}

export type ReviewPlan = {
  /** Reviews to create (one per client per anniversary). */
  create: { user_id: string; client_id: string; cycle_date: string }[]
  /** Reminders to send now: which review, which one (30 or 7 days). */
  remind: { reviewId: string; userId: string; clientId: string; which: '30' | '7'; daysLeft: number; cycleDate: string }[]
  /** Scheduled sends whose day has come. */
  send: { reviewId: string; userId: string }[]
}

const CLOSED = ['sent', 'skipped', 'sending']

/**
 * What the daily job should do now. Applying the plan and running it again
 * gives an empty plan: reviews are keyed by (client, anniversary), reminders
 * are stamped, sends move out of 'scheduled'.
 */
export function planReviewRun(clients: ClientDates[], reviews: ReviewRow[], now: Date = new Date()): ReviewPlan {
  const plan: ReviewPlan = { create: [], remind: [], send: [] }
  const byKey = new Map(reviews.map((r) => [`${r.client_id}|${r.cycle_date}`, r]))
  for (const c of clients) {
    if (!c.anniversary_date || !c.anniversary_confirmed) continue
    const due = reviewDue(c.anniversary_date, c.anniversary_tz, now)
    if (!due || !due.due) continue
    const existing = byKey.get(`${c.id}|${due.cycleDate}`)
    if (!existing) {
      plan.create.push({ user_id: c.user_id, client_id: c.id, cycle_date: due.cycleDate })
      // A brand-new review is also its first reminder.
    }
    if (existing && CLOSED.includes(existing.status)) continue
    const stamped30 = !!existing?.reminded_30_at
    const stamped7 = !!existing?.reminded_7_at
    if (due.daysLeft <= REVIEW_LAST_CALL_DAYS && !stamped7 && !(existing?.video_id && existing.status === 'scheduled')) {
      plan.remind.push({ reviewId: existing?.id ?? '', userId: c.user_id, clientId: c.id, which: '7', daysLeft: due.daysLeft, cycleDate: due.cycleDate })
    } else if (due.daysLeft > REVIEW_LAST_CALL_DAYS && !stamped30) {
      plan.remind.push({ reviewId: existing?.id ?? '', userId: c.user_id, clientId: c.id, which: '30', daysLeft: due.daysLeft, cycleDate: due.cycleDate })
    }
  }
  for (const r of reviews) {
    if (r.status !== 'scheduled' || !r.send_on || r.sent_at) continue
    if (r.send_on <= todayIn(r.send_tz, now)) plan.send.push({ reviewId: r.id, userId: r.user_id })
  }
  return plan
}

// ── Reading the issue date out of a document ────────────────────────────────

const DATE_KEYS = ['issueDate', 'policyIssueDate', 'effectiveDate', 'policyEffectiveDate', 'policyDate', 'issue_date', 'effective_date', 'anniversaryDate', 'policyAnniversary']
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']

/** Any one written date → YYYY-MM-DD (US order for 3/14/2021), or null. */
export function parseLooseDate(s: string): string | null {
  const t = s.trim()
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t)
  if (m) return parseDate(fmt(+m[1], +m[2], +m[3])) ? fmt(+m[1], +m[2], +m[3]) : null
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\b/.exec(t)
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3]
    const iso = fmt(y, +m[1], +m[2])
    return parseDate(iso) ? iso : null
  }
  m = /^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/.exec(t)
  if (m) {
    const mi = MONTHS.findIndex((n) => n.startsWith(m![1].toLowerCase().slice(0, 3)))
    if (mi < 0) return null
    const iso = fmt(+m[3], mi + 1, +m[2])
    return parseDate(iso) ? iso : null
  }
  return null
}

/**
 * The policy's issue (or effective) date, when the document says it. Looks at
 * named fields first, then "Issue date: …" / "Effective date …" in the text.
 * A suggestion only — the agent confirms it.
 */
export function inferIssueDate(extracted: unknown): string | null {
  const d = (extracted && typeof extracted === 'object' ? extracted : {}) as Record<string, unknown>
  for (const k of DATE_KEYS) {
    const v = d[k]
    if (typeof v === 'string') { const iso = parseLooseDate(v); if (iso) return iso }
  }
  const hay: string[] = []
  const push = (v: unknown) => { if (typeof v === 'string') hay.push(v) }
  if (Array.isArray(d.keyMetrics)) for (const m of d.keyMetrics as { label?: unknown; value?: unknown }[]) push(`${m?.label ?? ''}: ${m?.value ?? ''}`)
  if (Array.isArray(d.sections)) for (const s of d.sections as { content?: unknown }[]) push(s?.content)
  if (Array.isArray(d.bulletPoints)) for (const b of d.bulletPoints) push(b)
  if (Array.isArray(d.additionalNotes)) for (const b of d.additionalNotes) push(b)
  const re = /(?:policy\s+)?(?:issue|issued|effective|policy)\s+date\s*[:\-–]?\s*([A-Za-z]{3,9}\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}-\d{1,2}-\d{1,2})/i
  for (const h of hay) {
    const m = re.exec(h)
    if (m) { const iso = parseLooseDate(m[1]); if (iso) return iso }
  }
  return null
}

// ── Words for the review's status ───────────────────────────────────────────

export const REVIEW_STATUS_WORDS: Record<string, string> = {
  due: 'Not prepared yet',
  prepared: 'Prepared',
  scheduled: 'Scheduled to send',
  sending: 'Sending…',
  sent: 'Sent',
  skipped: 'Skipped this year',
  send_failed: 'Didn’t send',
}
