// =============================================================================
// "HOW FAR DID THEY GET?" — per share, from data the share page already sends.
//
// The share page records events in video_analytics: 'view' when the page
// opens, 'play' on play, 'progress' at 25 / 50 / 75 % (metadata.percent) and
// 'complete' at the end, plus clicks on Book / Pay / Download. That is the
// finest the data goes — quarters — so the result page shows four sections,
// not a finer bar it can't back up.
//
// WHO is who:
//   * An emailed link carries ?s=<sent_emails id>; the share page copies it
//     into every event's metadata.share. Those events belong to that email.
//   * Anything else (a copied link, a forward without the tag, older events)
//     is grouped by the viewer's device: viewer_ip + user_agent. The IP is
//     used only to tell viewers apart and is never sent to the browser.
//
// No new table or column: metadata is JSON already. Pure, so it is tested.
// =============================================================================

export interface ViewEvent {
  event_type: string
  created_at: string
  metadata: Record<string, unknown> | null
  viewer_ip?: string | null
  user_agent?: string | null
}

export interface ShareRow {
  id: string
  to_email: string
  to_name?: string | null
  created_at: string
  opened_at?: string | null
}

export const QUARTERS = [25, 50, 75, 100] as const

export interface ViewerSummary {
  /** A label for the person: their email when it came from one, else the
   *  device ("iPhone · Safari"). */
  device: string
  firstSeen: string
  lastSeen: string
  visits: number
  played: boolean
  /** Deepest quarter reached: 0, 25, 50, 75 or 100. */
  furthest: number
  /** Which quarters were reached — each is a section of the bar. */
  reached: boolean[]
  clicked: { booking: boolean; payment: boolean; download: boolean }
}

export interface ShareSummary {
  id: string
  to: string
  name: string | null
  sentAt: string
  emailOpenedAt: string | null
  viewer: ViewerSummary | null
}

export interface ViewingSummary {
  shares: ShareSummary[]
  /** Viewers who did not come from a tagged email. */
  others: ViewerSummary[]
  totals: { views: number; plays: number }
  /** What the bar can show: the share page only reports quarters. */
  steps: typeof QUARTERS
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isShareTag(v: unknown): v is string {
  return typeof v === 'string' && UUID.test(v)
}

export function deviceLabel(ua: string | null | undefined): string {
  const s = (ua || '').toLowerCase()
  const device = s.includes('ipad') ? 'iPad'
    : s.includes('iphone') ? 'iPhone'
    : s.includes('android') ? (s.includes('mobile') ? 'Android phone' : 'Android tablet')
    : s.includes('macintosh') || s.includes('mac os') ? 'Mac'
    : s.includes('windows') ? 'Windows computer'
    : s.includes('linux') ? 'Linux computer'
    : 'Unknown device'
  const browser = s.includes('edg/') ? 'Edge'
    : s.includes('chrome') ? 'Chrome'
    : s.includes('firefox') ? 'Firefox'
    : s.includes('safari') ? 'Safari'
    : ''
  return browser ? `${device} · ${browser}` : device
}

function percentOf(e: ViewEvent): number {
  if (e.event_type === 'complete') return 100
  if (e.event_type !== 'progress') return 0
  const p = Number(e.metadata?.percent)
  return Number.isFinite(p) ? p : 0
}

function summarize(events: ViewEvent[]): ViewerSummary {
  const sorted = [...events].sort((a, b) => a.created_at.localeCompare(b.created_at))
  let furthest = 0
  const clicked = { booking: false, payment: false, download: false }
  let played = false
  let visits = 0
  for (const e of sorted) {
    furthest = Math.max(furthest, percentOf(e))
    if (e.event_type === 'view') visits++
    if (e.event_type === 'play' || e.event_type === 'progress' || e.event_type === 'complete') played = true
    if (e.event_type === 'booking_click' || e.event_type === 'book_meeting') clicked.booking = true
    if (e.event_type === 'payment_click') clicked.payment = true
    if (e.event_type === 'download') clicked.download = true
  }
  // Snap to the quarter actually reported (a stray 30 counts as 25).
  const reachedQuarter = [...QUARTERS].reverse().find((q) => furthest >= q) ?? 0
  return {
    device: deviceLabel(sorted[0]?.user_agent),
    firstSeen: sorted[0]?.created_at ?? '',
    lastSeen: sorted[sorted.length - 1]?.created_at ?? '',
    visits: Math.max(visits, 1),
    played,
    furthest: reachedQuarter,
    reached: QUARTERS.map((q) => reachedQuarter >= q),
    clicked,
  }
}

export function summarizeViewing(events: ViewEvent[], shares: ShareRow[]): ViewingSummary {
  const shareIds = new Set(shares.map((s) => s.id))
  const byShare = new Map<string, ViewEvent[]>()
  const byDevice = new Map<string, ViewEvent[]>()
  let views = 0
  let plays = 0
  for (const e of events) {
    if (e.event_type === 'view') views++
    if (e.event_type === 'play') plays++
    const tag = e.metadata?.share
    if (isShareTag(tag) && shareIds.has(tag)) {
      const list = byShare.get(tag) ?? []
      list.push(e)
      byShare.set(tag, list)
      continue
    }
    const key = `${e.viewer_ip ?? '?'}|${e.user_agent ?? '?'}`
    const list = byDevice.get(key) ?? []
    list.push(e)
    byDevice.set(key, list)
  }
  const others = [...byDevice.values()]
    // A row with only clicks and no view is still someone on the page.
    .map(summarize)
    .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen))
  return {
    shares: shares
      .slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((s) => ({
        id: s.id,
        to: s.to_email,
        name: s.to_name ?? null,
        sentAt: s.created_at,
        emailOpenedAt: s.opened_at ?? null,
        viewer: byShare.has(s.id) ? summarize(byShare.get(s.id)!) : null,
      })),
    others,
    totals: { views, plays },
    steps: QUARTERS,
  }
}
