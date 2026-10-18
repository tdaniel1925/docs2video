/**
 * The site's own public address, for links in emails and redirects.
 * Always from configuration — never from a request header like Origin or Host,
 * which the caller controls.
 */
export function siteUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL || 'https://docs2video.com').trim()
  return raw.replace(/\/+$/, '')
}
