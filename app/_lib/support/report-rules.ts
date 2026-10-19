/*
 * "SOMETHING NOT WORKING?" — the rules (owner, 2026-10-19: "fix now"; the
 * design is the approved help-tab mockup). Pure on purpose: the route, the
 * panel and the tests all read the same rules.
 *
 * What a person sends: what happened (required) and, if they like, the steps.
 * What the panel adds on its own: the page, the browser, the app's recent
 * errors and failed calls, the draft/video they were on, and — only if the
 * box stays ticked — a small screenshot. Everything that leaves the browser
 * is redacted here first (emails, phone numbers, keys, query strings), so a
 * log line can never carry a client's details to us or to GitHub.
 */

export const LIMITS = {
  descriptionMin: 12,
  descriptionMax: 4000,
  stepsMax: 4000,
  urlMax: 600,
  browserMax: 300,
  logItems: 20,
  logItemMax: 400,
  /** The screenshot, as a JPEG data URL. ~300 KB keeps the request small. */
  screenshotMaxChars: 420_000,
  /** Reports per person: a burst, and a day. */
  perHour: 5,
  perDay: 15,
} as const

/** Where a report is. The panel shows these as steps; the owner sees them in admin. */
export type ReportStatus =
  | 'received'     // stored, not looked at yet
  | 'triaged'      // Claude read it and found the cause class
  | 'fixing'       // a coding agent is writing a fix (GitHub run started)
  | 'checked'      // a fix passed every test and waits for the owner's merge
  | 'fixed'        // the fix is live
  | 'answered'     // a how-to question: the help assistant answers it
  | 'needs_human'  // the robot can't do it: a person will look

export type ReportKind = 'bug' | 'how_to' | 'account' | 'feature' | 'unclear'

export const REPORT_STATUSES: ReportStatus[] = ['received', 'triaged', 'fixing', 'checked', 'fixed', 'answered', 'needs_human']

export type ReportInput = {
  description: string
  steps?: string | null
  pageUrl?: string | null
  browser?: string | null
  consoleErrors?: string[] | null
  failedCalls?: string[] | null
  videoId?: string | null
  screenshot?: string | null
}

export type CleanReport = {
  description: string
  steps: string | null
  pageUrl: string | null
  browser: string | null
  consoleErrors: string[]
  failedCalls: string[]
  videoId: string | null
  screenshot: string | null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Take out what must never leave the browser or reach GitHub. */
export function redact(text: string): string {
  return String(text)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [token]')
    .replace(/\b(?:sk|pk|rk|whsec|sb|eyJ)[A-Za-z0-9_.-]{16,}/g, '[key]')
    // A phone number (US shape, or +country digits) — not a date or an error code.
    .replace(/(?:\+1[\s.-]?)?\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]\d{4}\b/g, '[phone]')
    .replace(/\+\d{8,15}\b/g, '[phone]')
    .replace(/\b[A-Za-z0-9_-]{40,}\b/g, '[token]')
}

/** A page address with only the path and the draft id kept — never a query
 *  string that could carry an email, a token or a search. */
export function cleanUrl(raw: string | null | undefined): string | null {
  if (!raw) return null
  try {
    const u = new URL(String(raw), 'https://docs2video.com')
    const id = u.searchParams.get('id')
    const keep = id && UUID_RE.test(id) ? `?id=${id}` : ''
    return `${u.pathname}${keep}`.slice(0, LIMITS.urlMax)
  } catch {
    return null
  }
}

const clip = (s: unknown, max: number) => String(s ?? '').trim().slice(0, max)

/** Does the report say anything? (Jordyn's report-substance rule: a report
 *  with no actual complaint must never start an agent run.) */
export function hasSubstance(text: string): boolean {
  const t = String(text || '').trim()
  if (t.length < LIMITS.descriptionMin) return false
  const words = t.split(/\s+/).filter((w) => /[a-z]{2,}/i.test(w))
  if (words.length < 3) return false
  return !/^(help|test|testing|hi|hello|asdf+|x+)[.!?]*$/i.test(t)
}

export function validateReport(input: unknown): { ok: true; value: CleanReport } | { ok: false; error: string } {
  if (!input || typeof input !== 'object') return { ok: false, error: 'Tell us what went wrong.' }
  const r = input as Record<string, unknown>
  const description = clip(r.description, LIMITS.descriptionMax + 1)
  if (description.length > LIMITS.descriptionMax) return { ok: false, error: `Please keep it under ${LIMITS.descriptionMax} characters.` }
  if (!hasSubstance(description)) return { ok: false, error: 'Tell us in a sentence what happened, so we can find it.' }
  const steps = clip(r.steps, LIMITS.stepsMax + 1)
  if (steps.length > LIMITS.stepsMax) return { ok: false, error: `Please keep the steps under ${LIMITS.stepsMax} characters.` }

  const list = (v: unknown) => (Array.isArray(v) ? v : [])
    .slice(-LIMITS.logItems)
    .map((x) => redact(clip(x, LIMITS.logItemMax)))
    .filter(Boolean)

  const videoId = typeof r.videoId === 'string' && UUID_RE.test(r.videoId) ? r.videoId : null

  let screenshot: string | null = null
  if (typeof r.screenshot === 'string' && r.screenshot) {
    if (!/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(r.screenshot)) return { ok: false, error: 'The screenshot could not be read. Untick it and send again.' }
    if (r.screenshot.length > LIMITS.screenshotMaxChars) return { ok: false, error: 'The screenshot is too large. Untick it and send again.' }
    screenshot = r.screenshot
  }

  return {
    ok: true,
    value: {
      description: redact(description),
      steps: steps ? redact(steps) : null,
      pageUrl: cleanUrl(typeof r.pageUrl === 'string' ? r.pageUrl : null),
      browser: r.browser ? clip(r.browser, LIMITS.browserMax) : null,
      consoleErrors: list(r.consoleErrors),
      failedCalls: list(r.failedCalls),
      videoId,
      screenshot,
    },
  }
}

/** A short reference people can quote ("Report #K43V4"). No 0/O, 1/I/L. */
const REF_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
export function makeRef(random: () => number = Math.random): string {
  let s = ''
  for (let i = 0; i < 5; i++) s += REF_ALPHABET[Math.floor(random() * REF_ALPHABET.length)]
  return s
}

export const isRef = (s: unknown): s is string => typeof s === 'string' && /^[2-9A-HJKMNP-Z]{5}$/.test(s.trim().toUpperCase())

export type StatusStep = { title: string; detail: string; state: 'done' | 'now' | 'later' }

/** The steps the panel shows, in the person's words. */
export function statusSteps(status: ReportStatus, note?: string | null): StatusStep[] {
  if (status === 'answered') {
    return [
      { title: 'Got it', detail: 'Your report reached us.', state: 'done' },
      { title: 'This is a how-to question', detail: note || 'Nothing is broken. The help assistant can walk you through it.', state: 'now' },
    ]
  }
  if (status === 'needs_human') {
    return [
      { title: 'Got it', detail: 'Your report reached us.', state: 'done' },
      { title: 'A person is looking', detail: note || 'This one needs a person. We will email you when it is sorted.', state: 'now' },
    ]
  }
  const ORDER: { s: ReportStatus; title: string; detail: string }[] = [
    { s: 'received', title: 'Got it', detail: 'Your report reached us.' },
    { s: 'triaged', title: 'Found the cause', detail: note || 'We know where the problem is.' },
    { s: 'fixing', title: 'Fixing it', detail: 'A fix is being written, and every test is run against it.' },
    { s: 'checked', title: 'Checked', detail: 'Every test passed. It goes live once it is approved.' },
    { s: 'fixed', title: 'Fixed and live', detail: 'Try it again. We emailed you too.' },
  ]
  const at = ORDER.findIndex((o) => o.s === status)
  return ORDER.map((o, i) => ({
    title: o.title,
    detail: i <= at ? o.detail : '—',
    state: i < at || (i === at && status === 'fixed') ? 'done' : i === at ? 'now' : 'later',
  }))
}

/** The headline over the steps. */
export function statusHeadline(status: ReportStatus): string {
  if (status === 'fixed') return 'Fixed.'
  if (status === 'answered') return 'Here’s how.'
  if (status === 'needs_human') return 'A person is on it.'
  return 'We’re on it.'
}
