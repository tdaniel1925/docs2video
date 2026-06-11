// Simple in-memory rate limiter (works for single-instance deployments)
// For production with multiple instances, use Redis or Upstash

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
