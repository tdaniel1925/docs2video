/**
 * Where to send someone after sign-in, card entry, email confirmation…
 * `next` usually comes from the URL, so it must never leave this site: a
 * crafted link (?next=//evil.com, ?next=/\evil.com, ?next=https://evil.com)
 * would otherwise bounce a just-authenticated user to an attacker's page.
 * Only a plain in-app path is allowed.
 */
export function safeNextPath(raw: string | null | undefined, fallback = '/dashboard'): string {
  if (!raw || typeof raw !== 'string') return fallback
  const v = raw.trim()
  if (!v.startsWith('/')) return fallback
  if (v.startsWith('//') || v.startsWith('/\\')) return fallback
  // Browsers treat backslashes and control characters in odd ways — refuse them.
  if (/[\\\u0000-\u001f]/.test(v)) return fallback
  return v
}
