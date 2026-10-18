// =============================================================================
// DOCS2VIDEO MAKES VIDEOS (owner decision 2026-10-09).
//
// Docs2Video makes narrated videos, interactive presentations and commercials.
// It no longer makes NEW slide decks (the silent PDF/PowerPoint "Slide deck"
// output, the deck builder) or custom graphics (flyers, posters, social
// posts — the /design wizard and the flyer makers).
//
// What did NOT change:
//   * Things already made stay in the Library: they open, download, share and
//     delete as before (the Library files them under "Older items").
//   * A video's own downloads (MP4, and its slides as PDF / PowerPoint) and a
//     presentation's PDF / PowerPoint stay — they are part of that video, not
//     a Slide deck project.
//   * Text2Art (text2art.app, same codebase) still makes graphics and decks.
//     Every rule here is for the Docs2Video storefront only.
//   * The public API / MCP tools (API-key callers, no storefront) are left
//     alone, and the server's own calls (x-internal-service) pass.
//
// Pure: no Next or database imports, so proxy.ts, the make routes, the pages
// and the guard tests all read the same lists.
// =============================================================================

import type { BrandId } from './brand'

/** What a Docs2Video project can be made as now. */
export const D2V_OUTPUTS = ['video', 'interactive'] as const
export type D2VOutput = (typeof D2V_OUTPUTS)[number]

/** Old project outputs that can't be made any more (still open if they exist). */
export const RETIRED_OUTPUTS = ['deck', 'pptx', 'pdf'] as const

export function isRetiredOutput(output: unknown): boolean {
  return typeof output === 'string' && (RETIRED_OUTPUTS as readonly string[]).includes(output)
}

/** Keep only what Docs2Video still makes (the Make screen's choices). */
export function d2vOutputs<T extends string>(offered: readonly T[]): T[] {
  return offered.filter((o) => (D2V_OUTPUTS as readonly string[]).includes(o))
}

/** The plain words a refused request gets back. */
export const RETIRED_MESSAGE =
  'Docs2Video makes videos, presentations and commercials. Slide decks and custom graphics can’t be made here any more — the ones you already made are still in your Library.'

/**
 * Old addresses of the removed makers, and where each one goes now on
 * Docs2Video. Matched by path segment ('/design' covers '/design/results' but
 * not '/designs').
 */
export const RETIRED_PAGES: { prefix: string; to: string }[] = [
  { prefix: '/design', to: '/dashboard' },        // custom graphics wizard (Text2Art's home)
  { prefix: '/flyer', to: '/dashboard' },         // one-page flyer maker
  { prefix: '/flyers', to: '/dashboard' },        // flyer gallery
  { prefix: '/deck-builder', to: '/dashboard' },  // PowerPoint/PDF deck builder
  { prefix: '/demo-slide', to: '/dashboard' },    // slide test tool
  { prefix: '/template-demo', to: '/dashboard' }, // slide template test tool
  // Text2Art's own library page; on Docs2Video the old graphics are in the
  // Library's "Older items".
  { prefix: '/library', to: '/videos?type=older' },
  // Help for the removed makers (Text2Art keeps them).
  { prefix: '/help/flyers', to: '/help' },
  { prefix: '/help/restyle-deck', to: '/help' },
]

function underPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + '/')
}

/** Where an old maker address sends a Docs2Video visitor, or null. */
export function retiredPageRedirect(pathname: string, brand: BrandId): string | null {
  if (brand !== 'docs2video') return null
  return RETIRED_PAGES.find((p) => underPrefix(pathname, p.prefix))?.to ?? null
}

/**
 * The routes that START a new deck or graphic. On Docs2Video a browser call
 * to one of them is refused (410) with RETIRED_MESSAGE. Reading old files
 * (flyer-file, flyer-history, flyer-library — GET only) is not on the list.
 * The make routes that serve both videos and decks (generate-presentation,
 * generate-video) refuse the deck outputs themselves.
 */
export const RETIRED_MAKER_APIS = [
  '/api/flyer-art',
  '/api/flyer-chat',
  '/api/flyer-deck',
  '/api/flyer-deck-export',
  '/api/flyer-edit',
  '/api/design-prefill',
  '/api/deck-parse',
  '/api/deck-builder',
  '/api/generate-deck',
  '/api/convert-slides',
  '/api/generate-pptx',
  '/api/generate-pdf',
  '/api/demo-slide-gpt',
  '/api/template-demo',
] as const

/** True when this request would start a removed maker on Docs2Video. */
export function isRetiredMakerCall(pathname: string, method: string, brand: BrandId): boolean {
  if (brand !== 'docs2video') return false
  if (method.toUpperCase() === 'GET' || method.toUpperCase() === 'HEAD') return false
  return RETIRED_MAKER_APIS.some((p) => underPrefix(pathname, p))
}
