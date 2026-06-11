import { timingSafeEqual } from 'crypto'

/**
 * Verifies the Authorization header on cron endpoints against CRON_SECRET.
 * Fails closed when CRON_SECRET is unset; uses a constant-time comparison.
 */
export function verifyCronAuth(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const expected = Buffer.from(`Bearer ${secret}`)
  const actual = Buffer.from(request.headers.get('authorization') || '')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
