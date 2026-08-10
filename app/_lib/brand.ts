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
// This file imports NOTHING on purpose: it is read by client components AND by
// server components, so it must not pull in next/headers. The server-side
// "which brand is this request?" helper lives in ./brand-server.ts.
// =============================================================================

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
  /** Where a signed-in visitor belongs. */
  home: string
  /** Dashboard navigation, in order. */
  nav: BrandNavItem[]
  /**
   * The one big "make something" button in the app header, or null when the
   * brand doesn't need one. Text2Art has a single tool and the tool IS the
   * page, so "Designs" and "+ Create" would be the same link twice.
   */
  create: BrandNavItem | null
  /**
   * Video, presentation, commercial and client-share features. These are
   * Docs2Video's product; Text2Art must not advertise them. The pages still
   * exist and still work — they are simply not linked from a Text2Art nav.
   */
  showVideoFeatures: boolean
}

export const DOCS2VIDEO: Brand = {
  id: 'docs2video',
  name: 'Docs2Video',
  domain: 'docs2video.com',
  tagline: 'Turn any document into a professional explainer video',
  title: 'Docs2Video — Turn Any Document Into a Professional Explainer Video',
  description:
    'Upload a PDF, paste text, or describe an idea. Get a branded narrated video with a shareable client page — in minutes, not hours.',
  logoSrc: '/logo.png',
  home: '/dashboard',
  nav: [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/videos', label: 'Library' },
    { href: '/clients', label: 'Clients' },
  ],
  create: { href: '/create/start', label: '+ Create' },
  showVideoFeatures: true,
}

export const TEXT2ART: Brand = {
  id: 'text2art',
  name: 'Text2Art',
  domain: 'text2art.app',
  tagline: 'Describe it. Get the finished design.',
  title: 'Text2Art — Describe It, Get the Finished Design',
  description:
    'Type what your flyer, ad, social post, banner or business card needs to say. Get a print-ready design back — artwork and lettering both — in about a minute.',
  logoSrc: null,
  home: '/flyer',
  nav: [{ href: '/flyer', label: 'Designs' }],
  create: null,
  showVideoFeatures: false,
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
