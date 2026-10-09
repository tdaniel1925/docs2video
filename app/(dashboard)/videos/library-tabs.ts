// =============================================================================
// THE LIBRARY'S TABS (videos only, 2026-10-09).
//
// Docs2Video makes videos, presentations and commercials (videos-only.ts).
// Slide decks and custom graphics made before that still open, download,
// share and delete — they are filed under ONE tab, "Older items", which only
// shows when the account has any. The old addresses (?type=deck,
// ?type=flyer) still land on just those, so bookmarks keep working.
// Pure, so a test can check it without a browser.
// =============================================================================

import { KIND_NAMES, type LibraryKind } from '../../_lib/names'

export type LibraryTab = {
  /** The ?type= value in the address ('' = All). */
  key: string
  label: string
  /** Which items it shows. */
  shows: (kind: LibraryKind | null) => boolean
}

export const OLDER_LABEL = 'Older items'

/** Things Docs2Video doesn't make any more: slide decks, graphics, and the
 *  rows of tools retired earlier (logos, cards…). */
export function isOlderKind(kind: LibraryKind | null): boolean {
  return kind !== 'video' && kind !== 'presentation'
}

// "All" = everything Docs2Video makes today (videos + presentations). Older
// slide decks and graphics live ONLY under "Older items" — before, they
// flooded All with hundreds of retired graphics (audit 2026-10-09).
const ALL: LibraryTab = { key: '', label: 'All', shows: (k) => !isOlderKind(k) }
const VIDEOS: LibraryTab = { key: 'video', label: KIND_NAMES.video.many, shows: (k) => k === 'video' }
const PRESENTATIONS: LibraryTab = { key: 'presentation', label: KIND_NAMES.presentation.many, shows: (k) => k === 'presentation' }
const OLDER: LibraryTab = { key: 'older', label: OLDER_LABEL, shows: isOlderKind }
// Not in the row of tabs — only reached by an old address.
const HIDDEN: LibraryTab[] = [
  { key: 'deck', label: KIND_NAMES.deck.many, shows: (k) => k === 'deck' },
  { key: 'flyer', label: KIND_NAMES.graphic.many, shows: (k) => k === 'graphic' },
]

/** The row of tabs. "Older items" only when there is something in it. */
export function libraryTabs(hasOlder: boolean): LibraryTab[] {
  return hasOlder ? [ALL, VIDEOS, PRESENTATIONS, OLDER] : [ALL, VIDEOS, PRESENTATIONS]
}

/** The tab an address asks for (shown or hidden), or null for All / unknown. */
export function tabFor(type: string | null | undefined): LibraryTab | null {
  if (!type) return null
  return [VIDEOS, PRESENTATIONS, OLDER, ...HIDDEN].find((t) => t.key === type) ?? null
}

// ── ONE definition of "your work", shared by the Library and Home ──────────
// Home's "See all N" and the Library's All count read the SAME rule, so the
// two numbers always agree (audit 2026-10-09: Home and Library disagreed).

/** videos.output_type values that are old slide exports (Older items). */
export const OLDER_OUTPUT_TYPES = ['deck', 'pptx', 'pdf'] as const

export type PagedTabKey = '' | 'video' | 'presentation'

/**
 * PostgREST filter for a videos query, per tab ('' = All). Rows with no
 * output_type are videos (kindOfOutput's default). Kept in step with
 * kindOfOutput in names.ts — tests/ux-fixes-2026-10-09.test.ts checks it.
 */
export function videosFilterFor(tabKey: PagedTabKey): { or?: string; eq?: [string, string] } {
  const older = OLDER_OUTPUT_TYPES.join(',')
  if (tabKey === 'presentation') return { eq: ['output_type', 'interactive'] }
  if (tabKey === 'video') return { or: `output_type.is.null,output_type.not.in.(${older},interactive)` }
  return { or: `output_type.is.null,output_type.not.in.(${older})` }
}

/** Tabs whose rows all come from the videos table, so they page on the server. */
export function isServerPagedTab(key: string | null | undefined): key is PagedTabKey {
  return key === '' || key === 'video' || key === 'presentation'
}

/** Words typed into the search box, made safe for a PostgREST ilike filter. */
export function searchPattern(q: string | null | undefined): string | null {
  const clean = String(q ?? '').replace(/[%_*,()\\"]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
  return clean ? `*${clean}*` : null
}
