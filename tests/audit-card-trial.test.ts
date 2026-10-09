import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeDb, type FakeDb } from './fixtures/fake-supabase'

/*
 * AUDIT 2026-10-09 #5 — one card, many free trials.
 *
 * The same card could be saved on account after account, each getting a free
 * trial. confirm-card now records the card's Stripe fingerprint and refuses a
 * card another account already used for a trial. The REAL route runs with
 * Stripe and the database mocked (no Stripe call is made).
 */

const h = vi.hoisted(() => ({
  db: null as unknown as FakeDb,
  user: { id: 'u2', email: 'second@x.com' },
  fingerprint: 'fp_same_card' as string | null,
  subsCreate: vi.fn(),
}))

vi.mock('../app/_lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: h.user } }) } }),
}))
vi.mock('../app/_lib/supabase/admin', async () => {
  const { fakeClient } = await import('./fixtures/fake-supabase')
  return { createAdminClient: () => fakeClient(h.db) }
})
vi.mock('../app/_lib/stripe', () => ({
  SUBSCRIPTION_PRICES: { starter: 'price_s', pro: 'price_p', business: 'price_b', enterprise: 'price_e' },
  tierFromPriceId: () => null,
  stripe: {
    setupIntents: { retrieve: async () => ({ status: 'succeeded', customer: 'cus_2', payment_method: 'pm_2' }) },
    paymentMethods: {
      list: async () => ({ data: [{ id: 'pm_2' }] }),
      retrieve: async () => ({ id: 'pm_2', card: { fingerprint: h.fingerprint } }),
    },
    customers: { update: async () => ({}) },
    subscriptions: { create: h.subsCreate, list: async () => ({ data: [] }) },
  },
}))
vi.mock('../app/_lib/ops-alert', () => ({ alertOps: vi.fn(async () => true) }))

import { POST } from '../app/api/confirm-card/route'

const confirm = () => POST(new Request('http://x/api/confirm-card', { method: 'POST', body: JSON.stringify({ setupIntentId: 'seti_2', plan: 'pro' }) }))

beforeEach(() => {
  h.user = { id: 'u2', email: 'second@x.com' }
  h.fingerprint = 'fp_same_card'
  h.subsCreate.mockReset().mockResolvedValue({ id: 'sub_2' })
  h.db = makeDb({
    profiles: [{ id: 'u2', stripe_customer_id: 'cus_2', stripe_subscription_id: null, subscription_status: 'free', card_on_file: false }],
    trial_card_fingerprints: [{ fingerprint: 'fp_same_card', user_id: 'u1' }],
  })
})

describe('POST /api/confirm-card — one card, one free trial (real route)', () => {
  it('a card another account already used for a trial is refused; no trial, no subscription', async () => {
    const res = await confirm()
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe('card_already_used')
    expect(body.error).toMatch(/already been used for a free trial on another account/)
    expect(h.db.tables.profiles[0]).toMatchObject({ subscription_status: 'free', card_on_file: false })
    expect(h.subsCreate).not.toHaveBeenCalled()
  })

  it('a new card starts the trial and is recorded for this account', async () => {
    h.fingerprint = 'fp_new_card'
    const res = await confirm()
    expect(res.status).toBe(200)
    expect(h.db.tables.profiles[0]).toMatchObject({ subscription_status: 'trial', card_on_file: true })
    expect(h.db.tables.trial_card_fingerprints).toContainEqual(expect.objectContaining({ fingerprint: 'fp_new_card', user_id: 'u2' }))
  })

  it('the same account confirming its own card again is fine (a retry)', async () => {
    h.db.tables.trial_card_fingerprints = [{ fingerprint: 'fp_same_card', user_id: 'u2' }]
    expect((await confirm()).status).toBe(200)
  })

  it('if the check can’t run (table missing), no trial starts — fails closed', async () => {
    h.fingerprint = 'fp_new_card'
    h.db.failOn.trial_card_fingerprints = { error: { message: 'relation "trial_card_fingerprints" does not exist', code: '42P01' } }
    expect((await confirm()).status).toBe(503)
    expect(h.db.tables.profiles[0]).toMatchObject({ subscription_status: 'free' })
  })
})
