// =============================================================================
// WEBSITE ADDRESSES — nobody has to type "https://" (owner request 2026-10-09).
//
// People type "botmakers.ai", "www.acme.com" or paste "  Acme.com/about ".
// The browser's type="url" box refused those, and some routes did too. Every
// customer website box and every route that receives one runs the text
// through normalizeUrl():
//   * trim the ends
//   * no scheme → add https://   (an http:// or https:// typed is kept)
//   * lower-case the host        (the path is left as typed)
//   * refuse anything that isn't a plain web address: spaces inside, other
//     schemes (javascript:, mailto:…), user:password@, no dot in the host
// A bare host comes back without a trailing slash ("https://botmakers.ai").
//
// Pure — no imports — so client screens, routes and tests share it.
// =============================================================================

/** A clean http(s) address, or null when the text isn't a web address. */
export function normalizeUrl(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const raw = input.trim()
  if (!raw || /\s/.test(raw)) return null
  // Only http/https count as "already has a scheme". Anything else that looks
  // like scheme: (javascript:, mailto:, data:) is refused below.
  const hasWebScheme = /^https?:\/\//i.test(raw)
  if (!hasWebScheme && /^[a-z][a-z0-9+.-]*:(?!\d)/i.test(raw)) return null
  let url: URL
  try {
    url = new URL(hasWebScheme ? raw : `https://${raw.replace(/^\/+/, '')}`)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  if (url.username || url.password) return null
  const host = url.hostname.toLowerCase()
  // A real address has a dot and only host characters ("acme" or "a..b" is not one).
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+\.?$/.test(host) && !/^\[[0-9a-f:]+\]$/.test(host)) return null
  url.hostname = host
  const out = url.toString()
  // "https://acme.com/" → "https://acme.com" when nothing follows the host.
  return url.pathname === '/' && !url.search && !url.hash && !raw.endsWith('/') ? out.slice(0, -1) : out
}

/** For a text box: the cleaned address to show after the person leaves it,
 *  or what they typed when it can't be cleaned (so nothing they typed vanishes). */
export function tidyUrlInput(input: string): string {
  return normalizeUrl(input) ?? input
}
