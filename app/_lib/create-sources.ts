// =============================================================================
// START WITH THE SOURCE ALREADY CHOSEN.
//
// Home's start cards ("From a document", "From a website"…) open step 1 as
// /create?source=upload|url|paste|ai, and step 1 pre-selects that answer to
// "Where should the content come from?". One table for both ends, so a card
// can't link to a source step 1 doesn't know.
// =============================================================================

/** The address word → step 1's own name for the content source. */
export const CREATE_SOURCES = {
  upload: 'upload',
  url: 'url',
  paste: 'text',
  ai: 'idea',
} as const

export type CreateSource = keyof typeof CREATE_SOURCES
export type ContentMethod = (typeof CREATE_SOURCES)[CreateSource]

/** Step 1's starting choice for ?source=…, or null (nothing picked yet). */
export function methodFromSource(source: string | null | undefined): ContentMethod | null {
  return source && Object.prototype.hasOwnProperty.call(CREATE_SOURCES, source)
    ? CREATE_SOURCES[source as CreateSource]
    : null
}

/** The link that opens step 1 with this source chosen. */
export function createHref(source: CreateSource): string {
  return `/create?source=${source}`
}
