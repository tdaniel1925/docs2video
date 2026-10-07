// =============================================================================
// STOREFRONTS — one codebase, two front doors.
//
// docs2video.com and text2art.app are the SAME app: same login, same wallet of
// credits, same Stripe, same admin. What changes is only what the visitor is
// shown — the name over the door, the landing page, and which tools appear in
// the nav.
//
// EVERY host-dependent decision lives in this file. If you find yourself
// writing `if (host === 'text2art.app')` anywhere else, add a field to Brand
// instead — that is the whole point of this module. Scattered host checks are
// how a second storefront quietly breaks the first one.
//
// This file must stay safe for client components AND server components, so it
// never pulls in next/headers. Its only import is ./names (the shared words for
// the nav), which pulls in nothing server-side either. The server-side "which
// brand is this request?" helper lives in ./brand-server.ts.
// =============================================================================

import { NAMES } from './names'

export type BrandId = 'docs2video' | 'text2art'

export type BrandNavItem = { href: string; label: string }

export type Brand = {
  id: BrandId
  /** Shown to people. */
  name: string
  /** Canonical host, used for absolute URLs and metadata. */
  domain: string
  /** One line under the name. */
  tagline: string
  /** <meta name="description"> for the public pages. */
  description: string
  /** Browser tab title for the public pages. */
  title: string
  /**
   * An image in public/, or null to set the name as type. Text2Art has no logo
   * artwork yet and a placeholder logo looks worse than a good wordmark, so it
   * renders as text until real artwork exists.
   */
  logoSrc: string | null
  /** The browser-tab icon. One shared favicon meant Text2Art wore Docs2Video's. */
  iconSrc: string
  /** Default 1200×630 link-preview image in public/ (pages can override). */
  ogImage: string
  /** Where a signed-in visitor belongs. */
  home: string
  /** Dashboard navigation, in order. The 'kit' bar shows it after `create`. */
  nav: BrandNavItem[]
  /**
   * The one big "make something" button in the app header, or null when the
   * brand doesn't need one. Text2Art has a single tool and the tool IS the
   * page, so "Designs" and "+ New" would be the same link twice.
   */
  create: BrandNavItem | null
  /**
   * Video, presentation, commercial and client-share features. These are
   * Docs2Video's product; Text2Art must not advertise them. The pages still
   * exist and still work — they are simply not linked from a Text2Art nav.
   */
  showVideoFeatures: boolean
  /**
   * Which top bar this storefront wears.
   *  - 'kit': the 2026-10 overhaul bar — four words, gold credit chip, a
   *    "How to use" button that explains the screen you're on.
   *  - 'classic': the bar as it was before the overhaul, kept frozen. Text2Art
   *    has its own nav and its screens aren't in the How-to-use guide, so it
   *    must not change when Docs2Video's bar does.
   */
  topBar: 'kit' | 'classic'
}

export const DOCS2VIDEO: Brand = {
  id: 'docs2video',
  name: 'Docs2Video',
  domain: 'docs2video.com',
  tagline: 'Turn a long document into a short narrated video',
  title: 'Docs2Video — Turn Long Documents Into Short Narrated Videos',
  description:
    'Upload a PDF, paste text, or describe an idea. Get a branded narrated video on a shareable client page where your client can book a call.',
  logoSrc: '/logo-big.png',
  iconSrc: '/favicon.png',
  ogImage: '/og-docs2video.png',
  home: '/dashboard',
  // FOUR WORDS: + New, Library, Clients, Brands (the sibling apps' calm bar).
  // "Dashboard" is gone — the logo goes Home. Brands moved here from the
  // account menu: every help article sends people there, and a menu item
  // behind your initial is hard to find.
  // Custom Graphics is NOT in this nav. It is reachable from step 1 and from
  // the Library, and a video product should not lead with a design tool.
  nav: [
    { href: '/videos', label: NAMES.library },
    { href: '/clients', label: NAMES.clients },
    { href: '/brands', label: NAMES.brands },
  ],
  create: { href: '/create', label: NAMES.newButton },
  showVideoFeatures: true,
  topBar: 'kit',
}

export const TEXT2ART: Brand = {
  id: 'text2art',
  name: 'Text2Art',
  domain: 'text2art.app',
  tagline: 'Describe it. Get the finished design.',
  title: 'Text2Art — Describe It, Get the Finished Design',
  description:
    'Type what your flyer, ad, social post, banner or business card needs to say. Get a finished design back, sized for print or social — artwork and lettering both — in about a minute.',
  logoSrc: '/text2art-logo.png',
  iconSrc: '/text2art-favicon.png',
  ogImage: '/og-text2art.png',
  home: '/design',
  // Brands were unreachable on Text2Art: the scraper, the multi-brand store and
  // the whole editor already existed, and nothing in this storefront linked to
  // any of it. A customer could not save their colours even once.
  // "Designs" now opens the 4-step wizard at /design (pick a look → words →
  // sizes → generate & spot-edit); the old one-page /flyer still works directly.
  nav: [
    { href: '/design', label: 'Designs' },
    // "My Library" matches the heading on Text2Art's own library page.
    { href: '/library', label: 'My Library' },
    { href: '/brands', label: NAMES.brands },
  ],
  create: null,
  showVideoFeatures: false,
  topBar: 'classic',
}

export const BRANDS: Record<BrandId, Brand> = {
  docs2video: DOCS2VIDEO,
  text2art: TEXT2ART,
}

export const DEFAULT_BRAND = DOCS2VIDEO

/**
 * Which storefront is this host?
 *
 * Anything that is not recognisably Text2Art falls back to Docs2Video, so a
 * preview deployment, a bare Vercel URL, localhost, or a missing Host header
 * all behave exactly as they do today. That default is deliberate: Docs2Video
 * is the live product and must never change behaviour because of this file.
 *
 * NEXT_PUBLIC_BRAND is a local-development escape hatch (`NEXT_PUBLIC_BRAND=
 * text2art npm run dev`) so the second storefront can be worked on without
 * editing the hosts file. It is not set in production.
 */
export function brandFromHost(host?: string | null): Brand {
  const forced = process.env.NEXT_PUBLIC_BRAND
  if (forced && forced in BRANDS) return BRANDS[forced as BrandId]

  if (!host) return DEFAULT_BRAND
  // Strip the port and any www. — "text2art.app:3000" and "www.text2art.app"
  // are the same storefront.
  const h = host.toLowerCase().split(',')[0].trim().split(':')[0].replace(/^www\./, '')
  if (h === TEXT2ART.domain || h.endsWith('.' + TEXT2ART.domain)) return TEXT2ART
  return DEFAULT_BRAND
}

/** True when this host is the Text2Art storefront. Convenience for readability. */
export const isText2Art = (b: Brand) => b.id === 'text2art'
