// =============================================================================
// THE LIBRARY'S WORDS AND RULES — kept apart from the drawing so a test can
// check them without a browser.
//
// Round A (2026-10): the Library was a bare table — on a phone you saw only
// titles, with no way to tell a finished video from a failed one. It is now
// picture cards (VidWiz's library): a picture, the title, one coloured status
// line in plain words, the date, and a Send button on ready ones.
// =============================================================================

import { displayProgress } from '../../_lib/video-progress'
import { resumeUrl } from '../dashboard/_home/derive'
import type { LibraryKind } from '../../_lib/names'

export type LibraryItem = {
  id: string
  videoId: string | null   // real videos.id for deletion / open
  type: string
  /** Which tab it belongs on (null = only under All); picks the placeholder. */
  kind: LibraryKind | null
  /** What it is, in names.ts words ("Presentation", "Graphic"). */
  label: string
  title: string | null
  recipient: string | null
  fileUrl: string | null
  /** A still to show on the card — thumbnail, else the first slide picture.
   *  Null means "show the tidy placeholder", never a broken image. */
  picture: string | null
  /** Length in seconds, when the video has one. */
  duration: number | null
  status: string | null
  progressPct: number | null
  /** draft_data.step for an unfinished draft — where Open picks it up (same as Home). */
  draftStep?: unknown
  creditsUsed: number | null
  createdAt: string
}

export type StatusTone = 'ready' | 'making' | 'failed' | 'draft'

/** "1:30" from seconds. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/**
 * The coloured line under a card's title, in plain words:
 *   "Ready to send · 1:30"  "Making… 65%"  "Didn't finish"  "Draft"
 * Things made outside the video maker (graphics, built decks) have no status
 * in the database — if they're in the Library, they're done.
 */
export function statusLine(item: Pick<LibraryItem, 'type' | 'status' | 'progressPct' | 'duration'>): { words: string; tone: StatusTone } {
  if (item.type !== 'video') return { words: 'Ready', tone: 'ready' }
  switch (item.status) {
    case 'completed':
      return { words: item.duration && item.duration > 0 ? `Ready to send · ${clock(item.duration)}` : 'Ready to send', tone: 'ready' }
    case 'failed':
      return { words: 'Didn’t finish', tone: 'failed' }
    case 'draft':
      return { words: 'Draft — not made yet', tone: 'draft' }
    default:
      return { words: item.progressPct != null ? `Making… ${displayProgress(item.progressPct)}%` : 'Making…', tone: 'making' }
  }
}

/** Ready videos get a Send button; it lands on the result page's send panel. */
export function sendHref(item: Pick<LibraryItem, 'type' | 'status' | 'videoId' | 'id'>): string | null {
  return item.type === 'video' && item.status === 'completed' ? `/videos/${item.videoId ?? item.id}#send` : null
}

/** Where pressing the card goes. A draft picks up where it was left, like Home. */
export function openHref(item: Pick<LibraryItem, 'type' | 'status' | 'videoId' | 'id' | 'draftStep' | 'fileUrl'>): string {
  if (item.type === 'video' && item.status === 'draft' && item.videoId) return resumeUrl(item.videoId, item.draftStep)
  if (item.type === 'video') return `/videos/${item.videoId ?? item.id}`
  return item.fileUrl ?? '#'
}

/** Only videos-table rows can be deleted from here (the API deletes those). */
export function canDelete(item: Pick<LibraryItem, 'videoId'>): boolean {
  return !!item.videoId
}

/**
 * "Oct 3" this year, "Oct 3, 2025" before.
 *
 * `timeZone` pins the answer: the server (UTC) and the person's browser can
 * be on different days, and a date that differed between the two broke the
 * page waking up (React error #418, audit 2026-10-09). The first draw uses
 * 'UTC' on both sides; LocalDate then switches to the person's own day.
 */
export function shortDate(iso: string, now = new Date(), timeZone?: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const yearOf = (x: Date) => Number(x.toLocaleDateString('en-US', { year: 'numeric', ...(timeZone ? { timeZone } : {}) }))
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
    ...(timeZone ? { timeZone } : {}),
    ...(yearOf(d) !== yearOf(now) ? { year: 'numeric' } : {}),
  })
}

export const SORTS = [
  { id: 'newest', label: 'Newest first' },
  { id: 'oldest', label: 'Oldest first' },
  { id: 'name', label: 'Name A–Z' },
] as const
export type SortId = (typeof SORTS)[number]['id']

/** Search (title or who it's for) then sort. Everything is already on the
 *  page, so this costs no extra database work. */
export function searchAndSort(items: LibraryItem[], query: string, sort: SortId): LibraryItem[] {
  const q = query.trim().toLowerCase()
  const found = q
    ? items.filter((i) => (i.title ?? '').toLowerCase().includes(q) || (i.recipient ?? '').toLowerCase().includes(q) || i.label.toLowerCase().includes(q))
    : items.slice()
  const time = (i: LibraryItem) => new Date(i.createdAt).getTime()
  if (sort === 'oldest') return found.sort((a, b) => time(a) - time(b))
  if (sort === 'name') return found.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? '', 'en', { sensitivity: 'base' }))
  return found.sort((a, b) => time(b) - time(a))
}

/** Pictures we can show from a creations row: its thumbnail, or the file
 *  itself when the file IS a picture (Custom Graphics). */
export function isPicture(url: string | null | undefined): boolean {
  return !!url && /\.(png|jpe?g|webp|gif|avif)(\?|#|$)/i.test(url)
}

/** The grid's page sizes fill whole rows of 4, 3 or 2 cards. */
export const PAGE_SIZES = [24, 48, 96] as const

/** Grid or list, remembered per browser (VidWiz's toggle). */
export const VIEW_KEY = 'd2v.libraryView'
