/**
 * Pure logic for the Home screen: turns rows the database already has into the
 * words the agent reads ("Sent 3 days ago", "Watched", the action cards).
 *
 * No database calls here — load.ts fetches, this file decides. That keeps
 * every label testable and makes it easy to see that nothing is invented:
 * each status comes from a row in videos, sent_emails, quotes or
 * video_analytics.
 */
import { displayProgress } from '../../../_lib/video-progress'
import { KIND_NAMES, kindOfOutput } from '../../../_lib/names'
import { STEPS } from '../../create/_components/workspace/steps'

export type VideoRow = {
  id: string
  title: string | null
  status: string | null
  output_type: string | null
  draft_data: Record<string, unknown> | null
  created_at: string
  updated_at: string | null
  client_id: string | null
  progress_pct: number | null
}

/** One email sent from the app about a video (sent_emails). */
export type SendRow = {
  video_id: string | null
  to_email: string
  opened_at: string | null
  created_at: string
}

/** One thing a viewer did on the share page (video_analytics). The owner's
 *  own visits are never recorded (track-view skips them). */
export type EventRow = {
  video_id: string
  event_type: string
  created_at: string
}

export type QuoteRow = {
  video_id: string | null
  client_email: string | null
  client_name: string | null
  created_at: string
}

export type ClientRow = { id: string; name: string | null; phone: string | null }

export const BOOKING_EVENTS = ['booking_click', 'book_meeting']
export const TRACKED_EVENTS = ['view', 'complete', ...BOOKING_EVENTS]

const DAY = 86_400_000

// ── Labels ───────────────────────────────────────────────────────────────────

/** What a videos row is called. Video / Presentation / Slide deck come from
 *  names.ts so Home and the Library can't call the same thing two names. */
export function madeLabel(outputType: string | null | undefined): string {
  switch (outputType) {
    case 'pptx': return 'PowerPoint slides'
    case 'pdf': return 'PDF slides'
    default: return KIND_NAMES[kindOfOutput(outputType)].one
  }
}

/** "today", "yesterday", "3 days ago". */
export function daysAgo(iso: string, now: number): string {
  const d = Math.floor((now - new Date(iso).getTime()) / DAY)
  if (d <= 0) return 'today'
  if (d === 1) return 'yesterday'
  return `${d} days ago`
}

/** Same wording, but for "Sent ___" / "___, to the end": "Today", "Yesterday". */
function whenCap(iso: string, now: number): string {
  const s = daysAgo(iso, now)
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ── Drafts: where to pick up, and which of the 3 steps that is ──────────────

/**
 * Where a draft resumes. The saved step number is what the wizard writes into
 * draft_data.step; this is the same mapping the old "Continue where you left
 * off" list used, except an early draft now reopens ITSELF (?id=) instead of
 * a blank /create.
 */
export function resumeUrl(videoId: string, step: unknown): string {
  switch (Number(step)) {
    // 2 and 3 were saved by the old brand/voice pages, which came after the
    // brief; in the 3-step flow the story is the next thing to do.
    case 2:
    case 3:
    case 4:
    case 5: return `/create/script?id=${videoId}`
    default: return `/create?id=${videoId}`
  }
}

/** Which of the three steps (focus header, steps.ts) that page belongs to. */
export function wizardStep(url: string): number {
  const path = url.split('?')[0]
  if (path === '/create/brief' || path === '/create/script') return 2
  if (path === '/create/brand' || path === '/create/voice' || path === '/create/theme') return 3
  return 1
}

// ── Project status ("Where it's at") ────────────────────────────────────────

export type Tone = 'draft' | 'making' | 'failed' | 'ready' | 'sent' | 'watched' | 'booked'

export type ProjectStatus = { label: string; tone: Tone }

export function projectStatus(
  v: Pick<VideoRow, 'id' | 'status' | 'draft_data' | 'progress_pct'>,
  sends: SendRow[],
  events: EventRow[],
  now: number,
): ProjectStatus {
  if (v.status === 'draft') {
    const step = wizardStep(resumeUrl(v.id, v.draft_data?.step))
    return { label: `Draft · step ${step} of ${STEPS.length}`, tone: 'draft' }
  }
  if (v.status === 'pending' || v.status === 'processing') {
    return { label: `Making… ${displayProgress(v.progress_pct)}%`, tone: 'making' }
  }
  if (v.status === 'failed') return { label: 'Didn’t finish', tone: 'failed' }

  const mine = events.filter(e => e.video_id === v.id)
  if (mine.some(e => BOOKING_EVENTS.includes(e.event_type))) {
    return { label: 'Clicked to book a call', tone: 'booked' }
  }
  if (mine.some(e => e.event_type === 'view')) {
    return { label: mine.some(e => e.event_type === 'complete') ? 'Watched to the end' : 'Watched', tone: 'watched' }
  }
  const lastSend = latest(sends.filter(s => s.video_id === v.id))
  if (lastSend) return { label: `Sent ${daysAgo(lastSend.created_at, now)}`, tone: 'sent' }
  return { label: 'Ready', tone: 'ready' }
}

function latest<T extends { created_at: string }>(rows: T[]): T | undefined {
  let best: T | undefined
  for (const r of rows) if (!best || r.created_at > best.created_at) best = r
  return best
}

// ── Who it's for ─────────────────────────────────────────────────────────────

export type Names = {
  quotes: QuoteRow[]
  clients: Map<string, ClientRow>
}

/** The best real name we have for the person a video went to. Falls back to
 *  the email address, then null. Never makes one up. */
export function recipientName(
  v: Pick<VideoRow, 'id' | 'client_id' | 'draft_data'>,
  email: string | null,
  names: Names,
): string | null {
  const lower = email?.toLowerCase() ?? null
  const q = names.quotes
    .filter(q => q.video_id === v.id && q.client_name && (!lower || q.client_email?.toLowerCase() === lower))
  const fromQuote = latest(q)?.client_name
  if (fromQuote) return fromQuote
  const client = v.client_id ? names.clients.get(v.client_id) : undefined
  if (client?.name) return client.name
  const typed = v.draft_data?.recipientName
  if (typeof typed === 'string' && typed.trim()) return typed.trim()
  return email
}

// ── Action cards ─────────────────────────────────────────────────────────────

export type ActionCard = {
  key: string
  kind: 'watched' | 'booked' | 'not_opened'
  eyebrow: string
  /** Who — shown in bold. */
  who: string
  /** The rest of the headline after the name. */
  what: string
  detail: string
  primary: { label: string; href: string }
  secondary?: { label: string; href: string }
  /** Used to count "N clients need you today". */
  personKey: string
  at: string
}

const WATCHED_WINDOW_DAYS = 7
const NOT_OPENED_MIN_DAYS = 2
const NOT_OPENED_MAX_DAYS = 21

export function buildActionCards(opts: {
  videos: Map<string, VideoRow>
  sends: SendRow[]
  events: EventRow[]
  names: Names
  now: number
  max?: number
}): ActionCard[] {
  const { videos, sends, events, names, now } = opts
  const cards: ActionCard[] = []
  const title = (v: VideoRow) => v.title?.trim() || 'your video'

  // Group events by video.
  const byVideo = new Map<string, EventRow[]>()
  for (const e of events) {
    if (!videos.has(e.video_id)) continue
    const list = byVideo.get(e.video_id) ?? []
    list.push(e)
    byVideo.set(e.video_id, list)
  }

  for (const [videoId, evs] of byVideo) {
    const v = videos.get(videoId)!
    const lastSend = latest(sends.filter(s => s.video_id === videoId))
    const who = recipientName(v, lastSend?.to_email ?? null, names)
    const client = v.client_id ? names.clients.get(v.client_id) : undefined
    const booking = latest(evs.filter(e => BOOKING_EVENTS.includes(e.event_type)))
    const view = latest(evs.filter(e => e.event_type === 'view'))

    if (booking && now - new Date(booking.created_at).getTime() <= WATCHED_WINDOW_DAYS * DAY) {
      cards.push({
        key: `booked-${videoId}`,
        kind: 'booked',
        eyebrow: 'CLICKED TO BOOK',
        who: who ?? 'Someone',
        what: ` clicked “Book a call” on ${title(v)}`,
        detail: `${whenCap(booking.created_at, now)}. Check your calendar — if nothing came in, reach out.`,
        primary: { label: 'Open the project', href: `/videos/${videoId}` },
        secondary: client?.phone ? { label: 'Call them', href: `tel:${client.phone}` } : undefined,
        personKey: (who ?? videoId).toLowerCase(),
        at: booking.created_at,
      })
      continue
    }

    if (!booking && view && now - new Date(view.created_at).getTime() <= WATCHED_WINDOW_DAYS * DAY) {
      const toEnd = evs.some(e => e.event_type === 'complete')
      cards.push({
        key: `watched-${videoId}`,
        kind: 'watched',
        eyebrow: 'WATCHED IT',
        who: who ?? 'Someone',
        what: ` watched ${title(v)}`,
        detail: `${whenCap(view.created_at, now)}${toEnd ? ', to the end' : ''}. A good time to follow up.`,
        primary: { label: 'Send the follow-up', href: `/videos/${videoId}` },
        secondary: client?.phone
          ? { label: 'Call them', href: `tel:${client.phone}` }
          : v.client_id ? { label: 'Open client', href: `/clients/${v.client_id}` } : undefined,
        personKey: (who ?? videoId).toLowerCase(),
        at: view.created_at,
      })
    }
  }

  // Sent, not opened: the newest email per (video, address) that is 2–21 days
  // old, whose tracking pixel never fired, and after which nobody opened the
  // share page either.
  const newestSend = new Map<string, SendRow>()
  for (const s of sends) {
    if (!s.video_id || !videos.has(s.video_id)) continue
    const k = `${s.video_id}|${s.to_email.toLowerCase()}`
    const cur = newestSend.get(k)
    if (!cur || s.created_at > cur.created_at) newestSend.set(k, s)
  }
  for (const s of newestSend.values()) {
    const age = now - new Date(s.created_at).getTime()
    if (age < NOT_OPENED_MIN_DAYS * DAY || age > NOT_OPENED_MAX_DAYS * DAY) continue
    if (s.opened_at) continue
    const viewedAfter = (byVideo.get(s.video_id!) ?? []).some(e => e.event_type === 'view' && e.created_at >= s.created_at)
    if (viewedAfter) continue
    const v = videos.get(s.video_id!)!
    if (v.status !== 'completed') continue
    const who = recipientName(v, s.to_email, names) ?? s.to_email
    cards.push({
      key: `unopened-${s.video_id}-${s.to_email}`,
      kind: 'not_opened',
      eyebrow: 'NOT OPENED',
      who,
      what: ` hasn’t opened ${title(v)}`,
      detail: `Sent ${daysAgo(s.created_at, now)}. A nudge usually helps.`,
      primary: { label: 'Send a reminder', href: `/videos/${s.video_id}` },
      personKey: s.to_email.toLowerCase(),
      at: s.created_at,
    })
  }

  // Bookings first, then who watched, then who hasn't opened — newest first
  // inside each group.
  const rank = { booked: 0, watched: 1, not_opened: 2 } as const
  cards.sort((a, b) => rank[a.kind] - rank[b.kind] || b.at.localeCompare(a.at))
  return cards.slice(0, opts.max ?? 4)
}

/** Distinct people across the cards — "2 clients need you today". */
export function peopleCount(cards: ActionCard[]): number {
  return new Set(cards.map(c => c.personKey)).size
}

/** "Good morning" / "Good afternoon" / "Good evening" for a local hour. */
export function greetingFor(hour: number): string {
  if (hour < 5) return 'Good evening'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}
