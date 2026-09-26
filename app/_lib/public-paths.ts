/**
 * Which pages and API routes a LOGGED-OUT visitor may reach.
 *
 * proxy.ts sends every other request from a visitor with no session to the
 * login page (or, for /api/*, answers 401). Kept here — free of Next and
 * Supabase imports — so the allow-list can be unit tested on its own.
 *
 * Matching is by path SEGMENT: '/for' allows '/for' and '/for/insurance' but
 * NOT '/format'. The old check used a bare startsWith, so '/demo' quietly let
 * '/demo-slide' (a signed-in tool) through as well.
 *
 * Sources audited when this list was built: app/sitemap.ts, the marketing
 * nav + footer, the (public) route group, and every link the app puts into
 * an email (unsubscribe, campaign landing pages, share links, referral links).
 */

// Pages anyone may open.
export const PUBLIC_PAGE_PREFIXES = [
  '/',               // homepage (exact match only — see isPublicPath)
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password', // the page itself checks for a recovery session
  '/auth',           // /auth/callback + /auth/confirm (email links)
  '/pricing',        // logged-out visitors are shown the public pricing page
  '/plans',          // the public pricing page itself
  '/blog',
  '/contact',
  '/privacy',
  '/terms',
  '/cookies',
  '/for',            // industry landing pages
  '/industries',     // old campaign-email links — redirected to /for/*
  '/m',              // campaign landing pages (/m/{contactId})
  '/unsubscribe',    // email unsubscribe links (CAN-SPAM)
  '/watch',          // client share pages
  '/try',
  '/demo',
  '/share-demo',
  '/demo-prezi',
  '/restylez',       // Restylez marketing landing
  '/r',              // affiliate referral links (/r/{code})
  '/maintenance',
] as const

// API routes that serve logged-out visitors (forms and tracking on public
// pages). Each route does its own validation / rate limiting.
export const PUBLIC_API_PREFIXES = [
  '/api/health',        // uptime checks
  '/api/auth',          // OAuth callbacks verify their own signed state
  '/api/public',
  '/api/watch',
  '/api/track-view',
  '/api/quotes/pay',
  '/api/try-demo',
  '/api/demo-video',    // homepage "see a demo" form
  '/api/contact',       // contact form
  '/api/capture-lead',  // share-page lead form
  '/api/affiliate/r',   // affiliate referral click
] as const

function matchesSegment(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + '/')
}

/** True when a visitor with no session may load this path. */
export function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true
  const list: readonly string[] = pathname.startsWith('/api/') ? PUBLIC_API_PREFIXES : PUBLIC_PAGE_PREFIXES
  return list.some(p => p !== '/' && matchesSegment(pathname, p))
}

/**
 * Old campaign emails linked to /industries/{slug}, which never existed — the
 * industry pages live at /for/{slug}. Returns the path to redirect to, or null.
 */
export function legacyRedirect(pathname: string): string | null {
  if (pathname === '/industries' || pathname === '/industries/') return '/'
  if (pathname.startsWith('/industries/')) {
    const slug = pathname.slice('/industries/'.length).replace(/\/+$/, '')
    return slug ? `/for/${slug}` : '/'
  }
  return null
}
