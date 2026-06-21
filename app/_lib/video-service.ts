/**
 * Single source of truth for the video-assembly VPS URL (audit L4). Previously
 * the URL + a hardcoded plaintext-HTTP IP fallback were repeated literally in
 * 7+ routes; if VIDEO_ASSEMBLY_URL was unset, document content silently flowed
 * to a hardcoded box. Centralize here and log loudly when the env is missing so
 * a misconfigured deploy is obvious instead of silently wrong.
 */
const FALLBACK = 'http://5.161.215.156:4000'

let _warned = false

export function videoServiceUrl(): string {
  const url = (process.env.VIDEO_ASSEMBLY_URL || '').trim()
  if (url) return url.replace(/\/+$/, '')
  if (!_warned) {
    console.error('[video-service] VIDEO_ASSEMBLY_URL is not set — using the hardcoded fallback. Set it in production.')
    _warned = true
  }
  return FALLBACK
}

/** Convenience: build a full endpoint URL (e.g. videoServiceEndpoint('/render-v3')). */
export function videoServiceEndpoint(path: string): string {
  return `${videoServiceUrl()}${path.startsWith('/') ? path : `/${path}`}`
}
