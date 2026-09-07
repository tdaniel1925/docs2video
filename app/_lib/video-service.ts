/**
 * Single source of truth for the video-service URL (audit L4). The URL and a
 * hardcoded plaintext-HTTP IP fallback used to be repeated literally in 7+
 * routes; if VIDEO_ASSEMBLY_URL was unset, document content silently flowed to
 * a hardcoded box.
 *
 * THE FALLBACK IS NOW GONE, and that is deliberate. It pointed at the Hetzner
 * VPS, which no longer exists — so the "safety net" would now send documents
 * to a dead address and fail slowly, or worse, to whoever holds that IP next.
 * A missing setting is a configuration bug: it should stop the request with a
 * clear message, not quietly pick a destination nobody chose.
 *
 * The service now runs on ECS Fargate behind a load balancer; set
 * VIDEO_ASSEMBLY_URL to its address.
 */
export function videoServiceUrl(): string {
  const url = (process.env.VIDEO_ASSEMBLY_URL || '').trim()
  if (!url) {
    throw new Error('VIDEO_ASSEMBLY_URL is not set — the video service address is missing. Set it to the load balancer address in the environment.')
  }
  return url.replace(/\/+$/, '')
}

/** Convenience: build a full endpoint URL (e.g. videoServiceEndpoint('/render-v3')). */
export function videoServiceEndpoint(path: string): string {
  return `${videoServiceUrl()}${path.startsWith('/') ? path : `/${path}`}`
}
