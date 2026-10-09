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

const ALL: LibraryTab = { key: '', label: 'All', shows: () => true }
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
