import { normalizeUrl } from './normalize-url'

/**
 * Links users paste into settings (booking link, payment link) are shown as
 * buttons on PUBLIC share pages. Only plain web links are allowed — a
 * `javascript:` or `data:` link there would run code in a client's browser.
 * The cleaning itself (add https://, lower-case the host, refuse junk) is the
 * shared normalizeUrl() every website box uses.
 *
 * Returns:
 *   ''      — the field was left empty (clear the saved link)
 *   string  — a cleaned https:// URL
 *   null    — not an acceptable web link
 */
export function cleanWebLink(input: string | null | undefined): string | null {
  const raw = (input ?? '').trim()
  if (!raw) return ''
  const url = normalizeUrl(raw)
  // https only: the share page shows ONLY https links as buttons, so a saved
  // http:// link used to say "Saved" here and then never appear there.
  if (!url || !url.startsWith('https://')) return null
  return url
}
