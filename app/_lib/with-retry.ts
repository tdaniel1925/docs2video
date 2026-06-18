/**
 * Retry an async operation with exponential backoff. Used to harden external
 * API calls (Gemini, Claude, Lyria, etc.) that were previously single-shot —
 * a single transient 429/503/network blip would fail the whole job.
 *
 * Only retries on TRANSIENT errors (rate limits, 5xx, timeouts, network). A
 * deterministic error (400/auth/validation) fails immediately — no point retrying.
 */

const TRANSIENT = [429, 500, 502, 503, 504]

function isTransient(err: unknown): boolean {
  const e = err as { status?: number; statusCode?: number; code?: string; message?: string; name?: string }
  const status = e?.status ?? e?.statusCode
  if (typeof status === 'number' && TRANSIENT.includes(status)) return true
  const msg = (e?.message || '').toLowerCase()
  const name = (e?.name || '').toLowerCase()
  return (
    msg.includes('rate limit') || msg.includes('429') || msg.includes('quota') ||
    msg.includes('timeout') || msg.includes('timed out') || msg.includes('etimedout') ||
    msg.includes('econnreset') || msg.includes('socket hang up') || msg.includes('network') ||
    msg.includes('overloaded') || msg.includes('503') || msg.includes('502') || msg.includes('500') ||
    name.includes('timeout') || name.includes('aborterror') ||
    e?.code === 'ECONNRESET' || e?.code === 'ETIMEDOUT'
  )
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; baseDelayMs?: number; label?: string } = {}
): Promise<T> {
  const retries = opts.retries ?? 2 // total attempts = retries + 1
  const base = opts.baseDelayMs ?? 1200
  let lastErr: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      // Don't retry deterministic failures, and don't sleep after the last try.
      if (attempt === retries || !isTransient(err)) break
      const delay = base * Math.pow(2, attempt) + Math.floor(Math.random() * 300)
      const m = err instanceof Error ? err.message : String(err)
      console.warn(`[withRetry${opts.label ? `:${opts.label}` : ''}] attempt ${attempt + 1}/${retries + 1} failed (${m.slice(0, 100)}), retrying in ${delay}ms`)
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw lastErr
}
