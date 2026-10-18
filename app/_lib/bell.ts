// =============================================================================
// WHAT THE BELL SHOWS — pure, so a test can check it without a browser.
//
// Audit 2026-10-09: the bell listed the same failure two and three times,
// kept notices from 88 days ago, said "Video generation failed" where every
// other screen says "Didn't finish", and the old ones linked nowhere useful.
// Now:
//   - notices older than 30 days stay out of the bell (Activity still has them);
//   - the same notice about the same thing shows ONCE, newest first, with
//     "2 times" when it repeated;
//   - a failed video says "Didn't finish" and always links to its result page,
//     where "Try again" is.
// =============================================================================

export type BellNotification = {
  id: string
  type: string
  title: string
  message: string | null
  link: string | null
  read: boolean
  created_at: string
}

export type BellItem = {
  /** The newest notice's id (the row key). */
  key: string
  /** Every notice folded into this line — mark-read / delete act on all. */
  ids: string[]
  type: string
  title: string
  message: string | null
  link: string | null
  read: boolean
  created_at: string
  /** How many notices were folded together (1 = just this one). */
  count: number
  failed: boolean
}

export const BELL_MAX_AGE_DAYS = 30
/** The words every screen uses for a project that failed. */
export const DIDNT_FINISH = 'Didn’t finish'

const FAILED_TITLE = /(generation|render(ing)?)\s+failed|video failed|could not be completed/i

/** Is this a "your project failed" notice? */
export function isFailedNotice(n: Pick<BellNotification, 'type' | 'title'>): boolean {
  return n.type === 'video_failed' || FAILED_TITLE.test(n.title ?? '')
}

/** The project a notice is about, from its link (/videos/<id>…). */
export function videoIdOf(link: string | null | undefined): string | null {
  const m = /^\/videos\/([0-9a-f-]{36})(?:[/?#]|$)/i.exec(link ?? '')
  return m ? m[1] : null
}

/** One notice in the bell's words. */
export function tidyNotice<T extends BellNotification>(n: T): T & { failed: boolean } {
  if (!isFailedNotice(n)) return { ...n, failed: false }
  const message = (n.message ?? '')
    .replace(/\s*could not be completed\.?/i, ' didn’t finish.')
    .replace(/^Video generation failed\.?$/i, '')
    .trim() || null
  const id = videoIdOf(n.link)
  return {
    ...n,
    title: DIDNT_FINISH,
    message,
    // The result page is where "Try again" is.
    link: id ? `/videos/${id}` : n.link,
    failed: true,
  }
}

/** The bell's lines: recent only, tidied, duplicates folded, newest first. */
export function bellItems(list: BellNotification[], now: number = Date.now()): BellItem[] {
  const cutoff = now - BELL_MAX_AGE_DAYS * 86_400_000
  const recent = list
    .filter((n) => {
      const t = new Date(n.created_at).getTime()
      return Number.isFinite(t) && t >= cutoff
    })
    .map(tidyNotice)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const groups = new Map<string, BellItem>()
  for (const n of recent) {
    // Same kind of notice about the same project (or with the same words when
    // it isn't about one project) = one line.
    const about = videoIdOf(n.link) ?? `${n.title}|${n.message ?? ''}|${n.link ?? ''}`
    const key = `${n.failed ? 'failed' : n.type}|${about}`
    const g = groups.get(key)
    if (g) {
      g.ids.push(n.id)
      g.count += 1
      g.read = g.read && n.read
    } else {
      groups.set(key, {
        key: n.id, ids: [n.id], type: n.type, title: n.title, message: n.message, link: n.link,
        read: n.read, created_at: n.created_at, count: 1, failed: n.failed,
      })
    }
  }
  return [...groups.values()]
}

/** How many lines are unread — what the badge and its spoken name say. */
export function unreadLines(items: BellItem[]): number {
  return items.filter((i) => !i.read).length
}

/** The bell button's spoken name: "Notifications, 5 new". */
export function bellLabel(unread: number, working = false): string {
  const parts = ['Notifications']
  if (unread > 0) parts.push(`${unread} new`)
  if (working) parts.push('something is being made')
  return parts.join(', ')
}
