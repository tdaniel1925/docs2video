/**
 * Links users paste into settings (booking link, payment link) are shown as
 * buttons on PUBLIC share pages. Only plain web links are allowed — a
 * `javascript:` or `data:` link there would run code in a client's browser.
 *
 * Returns:
 *   ''      — the field was left empty (clear the saved link)
 *   string  — a cleaned https:// URL
 *   null    — not an acceptable web link
 */
export function cleanWebLink(input: string | null | undefined): string | null {
  const raw = (input ?? '').trim()
  if (!raw) return ''
  // Let people paste "calendly.com/me" without the scheme.
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`
  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    return null
  }
  // https only: the share page shows ONLY https links as buttons, so a saved
  // http:// link used to say "Saved" here and then never appear there.
  if (url.protocol !== 'https:') return null
  if (!url.hostname || !url.hostname.includes('.')) return null
  if (url.username || url.password) return null
  return url.toString()
}
