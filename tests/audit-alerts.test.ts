import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeDb, type FakeDb } from './fixtures/fake-supabase'

/*
 * AUDIT 2026-10-09 #9 — silent failures now reach Trent (one inbox).
 *  - alertOps emails the owner inbox (owner-inbox.ts) and is throttled;
 *  - the Stripe webhook's failure alert NAMES the customer (real route);
 *  - the stuck-video cron emails when a refund fails (real route);
 *  - a failed public-API job gets its API credits back ONCE and fires its
 *    webhook (finalizeApiJob, run on a pretend database);
 *  - a cron that stops running is spotted by the heartbeat check.
 */

const h = vi.hoisted(() => ({
  db: null as unknown as FakeDb,
  sent: [] as { to: string; subject: string; html: string }[],
  topups: [] as { userId: string; amount: number; key?: string; videoId?: string }[],
  webhooks: [] as string[],
  refundThrows: false,
  event: null as any,
}))

vi.mock('resend', () => ({
  Resend: class { emails = { send: async (m: any) => { h.sent.push(m); return { error: null } } } },
}))
vi.mock('../app/_lib/supabase/admin', async () => {
  const { fakeClient } = await import('./fixtures/fake-supabase')
  return { createAdminClient: () => fakeClient(h.db) }
})
vi.mock('../app/_lib/credits', async (orig) => ({
  ...(await orig<typeof import('../app/_lib/credits')>()),
  addTopupCredits: async (userId: string, amount: number, _s: string, o?: { idempotencyKey?: string; videoId?: string }) => {
    if (h.topups.some((t) => t.key && t.key === o?.idempotencyKey)) return false
    h.topups.push({ userId, amount, key: o?.idempotencyKey, videoId: o?.videoId }); return true
  },
}))
vi.mock('../app/_lib/api-webhook', () => ({ fireApiWebhook: async (id: string) => { h.webhooks.push(id) } }))
vi.mock('../app/_lib/video-billing', async (orig) => ({
  ...(await orig<typeof import('../app/_lib/video-billing')>()),
  refundVerifiedCharge: async () => { if (h.refundThrows) throw new Error('add_topup_atomic timed out'); return 0 },
}))
vi.mock('../app/_lib/cron-auth', () => ({ verifyCronAuth: () => true }))
vi.mock('../app/_lib/video-ready', () => ({ sweepReadyVideos: async () => 0, announceVideoReady: async () => 'skipped' }))
vi.mock('../app/_lib/notify', () => ({ sendNotification: async () => {} }))
vi.mock('../app/_lib/stripe', () => ({
  getStripe: () => ({ webhooks: { constructEvent: () => h.event } }),
  tierFromPriceId: () => null,
  stripe: {},
  SUBSCRIPTION_PRICES: {},
}))
vi.mock('../app/_lib/admin/payment-alerts', () => ({ recordPaymentFailure: async () => {} }))

import { alertOps, resetOpsAlertThrottle, stripeEventCustomer } from '../app/_lib/ops-alert'
import { ownerAlertEmail } from '../app/_lib/owner-inbox'
import { finalizeApiJob } from '../app/_lib/api-job-finalize'
import { staleCrons } from '../app/_lib/cron-heartbeat'
import { GET as fixStuck } from '../app/api/cron/fix-stuck-videos/route'
import { POST as stripeWebhook } from '../app/api/webhooks/stripe/route'

beforeEach(() => {
  process.env.RESEND_API_KEY = 'test'
  h.sent = []
  h.topups = []
  h.webhooks = []
  h.refundThrows = false
  resetOpsAlertThrottle()
  h.db = makeDb({ videos: [], profiles: [], app_settings: [], error_logs: [], processed_stripe_events: [], api_usage_log: [], credit_transactions: [], credit_balances: [] })
})

describe('alertOps — one inbox, not a flood', () => {
  it('emails the owner inbox and records it', async () => {
    expect(await alertOps({ source: 'generate-video', stage: 'refund', message: 'Refund failed', videoId: 'abcdef123456' })).toBe(true)
    expect(h.sent).toHaveLength(1)
    expect(h.sent[0].to).toBe(ownerAlertEmail())
    expect(h.sent[0].subject).toMatch(/generate-video \/ refund \(abcdef12\)/)
    expect(h.db.tables.error_logs).toHaveLength(1)
  })
  it('the same alert twice within 10 minutes is emailed once', async () => {
    await alertOps({ source: 's', message: 'same' })
    await alertOps({ source: 's', message: 'same' })
    expect(h.sent).toHaveLength(1)
  })
})

describe('Stripe webhook — a failed payment event names the customer (real route)', () => {
  it('the alert says who: email, Stripe customer and user', () => {
    expect(stripeEventCustomer({ data: { object: { customer: 'cus_9', customer_email: 'pat@shop.com', metadata: { supabase_user_id: 'u9' } } } }))
      .toBe('email pat@shop.com, customer cus_9, user u9')
    expect(stripeEventCustomer({ data: { object: {} } })).toBe('unknown customer')
  })

  it('a handler error emails Trent with the customer named, and Stripe is asked to retry', async () => {
    h.event = { id: 'evt_1', type: 'customer.subscription.deleted', data: { object: { id: 'sub_1', customer: 'cus_9', metadata: {}, items: { data: [] } } } }
    h.db.failOn.profiles = { op: 'select', error: { message: 'connection reset' } }
    const res = await stripeWebhook(new Request('http://x/api/webhooks/stripe', { method: 'POST', body: '{}', headers: { 'stripe-signature': 't=1,v1=x' } }))
    expect(res.status).toBe(500)
    const mail = h.sent.find((m) => /stripe-webhook/.test(m.subject))
    expect(mail?.html).toMatch(/customer cus_9/)
  })
})

describe('stuck-video cron — a failed refund is no longer silent (real route)', () => {
  it('emails Trent when a failed video’s refund throws', async () => {
    h.refundThrows = true
    h.db.tables.videos.push({ id: 'v1', user_id: 'u1', status: 'failed', deducted_cost: 900, created_at: new Date(Date.now() - 3600_000).toISOString() })
    const res = await fixStuck(new Request('http://x/api/cron/fix-stuck-videos', { headers: { authorization: 'Bearer x' } }))
    expect(res.status).toBe(200)
    const mail = h.sent.find((m) => /fix-stuck-videos/.test(m.subject))
    expect(mail?.html).toMatch(/Refund for a failed video could not be made/)
    // and it stamped its heartbeat
    expect(h.db.tables.app_settings).toContainEqual(expect.objectContaining({ key: 'cron_heartbeat:fix-stuck-videos' }))
  })
})

describe('failed public-API job: API credits back once + webhook (finalizeApiJob)', () => {
  const job = () => ({ id: 'j1', user_id: 'u1', status: 'failed', created_at: new Date().toISOString(), draft_data: { source: 'api', apiCost: 1200, apiWebhookUrl: 'https://hook.example' } })

  it('refunds the job’s charge with the job’s own key and fires the webhook', async () => {
    h.db.tables.videos.push(job())
    const admin = (await import('../app/_lib/supabase/admin')).createAdminClient() as any
    expect(await finalizeApiJob(admin, job())).toBe('refunded')
    expect(h.topups).toEqual([{ userId: 'u1', amount: 1200, key: 'api-refund:job:j1', videoId: 'j1' }])
    expect(h.webhooks).toEqual(['j1'])
  })

  it('a second pass (cron after the route) does nothing more', async () => {
    h.db.tables.videos.push(job())
    const admin = (await import('../app/_lib/supabase/admin')).createAdminClient() as any
    await finalizeApiJob(admin, job())
    const again = await finalizeApiJob(admin, { ...job(), draft_data: h.db.tables.videos[0].draft_data })
    expect(again).toBe('already_done')
    expect(h.topups).toHaveLength(1)
    expect(h.webhooks).toHaveLength(1)
  })

  it('a job the v1 route already refunded (logged "failed") is not refunded again', async () => {
    h.db.tables.videos.push(job())
    h.db.tables.api_usage_log.push({ video_id: 'j1', status: 'failed' })
    const admin = (await import('../app/_lib/supabase/admin')).createAdminClient() as any
    expect(await finalizeApiJob(admin, job())).toBe('notified')
    expect(h.topups).toEqual([])
    expect(h.webhooks).toEqual(['j1'])
  })

  it('a completed job just fires its webhook', async () => {
    const done = { ...job(), status: 'completed' }
    h.db.tables.videos.push(done)
    const admin = (await import('../app/_lib/supabase/admin')).createAdminClient() as any
    expect(await finalizeApiJob(admin, done)).toBe('notified')
    expect(h.topups).toEqual([])
  })
})

describe('cron heartbeat — a cron that stopped is spotted', () => {
  const now = new Date('2026-10-12T12:00:00Z')
  const hoursAgo = (n: number) => new Date(now.getTime() - n * 3600_000).toISOString()
  it('all recent → nothing to report', () => {
    const stamps = { 'fix-stuck-videos': hoursAgo(0.05), 'reconcile-credit-packs': hoursAgo(1), 'system-health': hoursAgo(5), 'follow-ups': hoursAgo(20), nurture: hoursAgo(20), 'referral-prompt': hoursAgo(20), 'cleanup-drafts': hoursAgo(20), 'daily-digest': hoursAgo(20), 'weekly-report': hoursAgo(100) }
    expect(staleCrons(stamps, now)).toEqual([])
  })
  it('a daily cron silent for 30 hours, or the 2-minute cron silent for 2 hours, is reported', () => {
    const names = staleCrons({ 'fix-stuck-videos': hoursAgo(2), 'daily-digest': hoursAgo(30) }, now, new Date(hoursAgo(1)))
    expect(names.map((s) => s.name).sort()).toEqual(['daily-digest', 'fix-stuck-videos'])
  })
  it('a cron that never stamped counts only once stamping has run longer than its gap', () => {
    expect(staleCrons({}, now, new Date(hoursAgo(0.5))).map((s) => s.name)).toEqual([])
    expect(staleCrons({}, now, new Date(hoursAgo(27))).map((s) => s.name)).toContain('daily-digest')
  })
})
