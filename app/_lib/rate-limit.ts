// Simple in-memory rate limiter (works for single-instance deployments)
// For production with multiple instances, use checkRateLimit below.

import { createAdminClient } from './supabase/admin'

/**
 * Shared, cross-instance rate limiting (review S6). The in-memory limiter
 * below lives in module scope — on Vercel's serverless model every
 * instance/cold-start gets a fresh map, so caps like "10 demos/day global"
 * were illusory on UNAUTHENTICATED spend endpoints (try-demo, capture-lead):
 * an attacker rotating instances could burn AI/render spend freely.
 *
 * Backed by the atomic `rate_limit_hit` Postgres function
 * (supabase/migrations/20260701_rate_limits.sql). FAILS OPEN when the function
 * is missing or the DB errors — availability beats strictness on these
 * endpoints, and prod migrations are applied by hand, so the code must not
 * hard-depend on it. Logged so the gap is visible until the SQL is run.
 */
export async function checkRateLimit(
  key: string,
  max: number,
  windowSecs: number,
): Promise<{ allowed: boolean }> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('rate_limit_hit', {
      p_key: key,
      p_max: max,
      p_window_secs: windowSecs,
    })
    if (error) {
      console.warn(`[rate-limit] rate_limit_hit unavailable (${error.message}) — failing OPEN for ${key}`)
      return { allowed: true }
    }
    return { allowed: data === true }
  } catch (e) {
    console.warn(`[rate-limit] error — failing OPEN for ${key}:`, e instanceof Error ? e.message : e)
    return { allowed: true }
  }
}

const requests = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const record = requests.get(key)

  if (!record || now > record.resetAt) {
    requests.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1 }
  }

  if (record.count >= limit) {
    return { allowed: false, remaining: 0 }
  }

  record.count++
  return { allowed: true, remaining: limit - record.count }
}

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, record] of requests.entries()) {
    if (now > record.resetAt) requests.delete(key)
  }
}, 60000)

// Helper to get rate limit key from request
export function getRateLimitKey(userId: string, action: string): string {
  return `${userId}:${action}`
}

// Pre-configured limits
export const LIMITS = {
  generation: { limit: 10, windowMs: 60 * 60 * 1000 },    // 10 generations per hour
  extraction: { limit: 20, windowMs: 60 * 60 * 1000 },    // 20 extractions per hour
  upload: { limit: 50, windowMs: 60 * 60 * 1000 },        // 50 uploads per hour
  api: { limit: 100, windowMs: 60 * 1000 },               // 100 requests per minute
  chat: { limit: 30, windowMs: 60 * 1000 },               // 30 chat messages per minute
  email: { limit: 30, windowMs: 60 * 60 * 1000 },         // 30 emails per hour
}
