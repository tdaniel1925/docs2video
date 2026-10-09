import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeDb, type FakeDb } from './fixtures/fake-supabase'

/*
 * AUDIT 2026-10-09 #7 — the charge's ledger line was written unchecked.
 *
 * Every refund is capped by the ledger (credit_transactions). A charge whose
 * ledger line failed to save took the credits and could NEVER be refunded.
 * deductCredits now checks the write: on failure it puts the credits back,
 * refuses the charge, and emails Trent. Run for real on a pretend database.
 */

const h = vi.hoisted(() => ({ db: null as unknown as FakeDb, alert: vi.fn(async () => true) }))
vi.mock('../app/_lib/supabase/admin', async () => {
  const { fakeClient } = await import('./fixtures/fake-supabase')
  return { createAdminClient: () => fakeClient(h.db) }
})
vi.mock('../app/_lib/ops-alert', () => ({ alertOps: h.alert }))

import { deductCredits } from '../app/_lib/credits'

beforeEach(() => {
  h.alert.mockClear()
  h.db = makeDb({
    profiles: [{ id: 'u1', is_admin: false, is_beta: false, subscription_status: 'pro', card_on_file: true }],
    credit_balances: [{ user_id: 'u1', balance: 1000, topup_balance: 500, cycle_credits_used: 0 }],
    credit_transactions: [],
  })
})

describe('deductCredits — ledger write checked (real code, pretend database)', () => {
  it('normal charge: credits taken AND a ledger line written', async () => {
    expect(await deductCredits('u1', 1200, 'video_generation', 'v1')).toBe(true)
    expect(h.db.tables.credit_balances[0]).toMatchObject({ balance: 0, topup_balance: 300, cycle_credits_used: 1200 })
    expect(h.db.tables.credit_transactions).toEqual([expect.objectContaining({ amount: -1200, action: 'video_generation', video_id: 'v1' })])
  })

  it('ledger write fails → charge refused, the credits put back exactly, Trent told', async () => {
    h.db.failOn.credit_transactions = { op: 'insert', error: { message: 'connection reset' } }
    expect(await deductCredits('u1', 1200, 'video_generation', 'v1')).toBe(false)
    expect(h.db.tables.credit_balances[0]).toMatchObject({ balance: 1000, topup_balance: 500, cycle_credits_used: 0 })
    expect(h.alert).toHaveBeenCalledWith(expect.objectContaining({ stage: 'ledger-write', userId: 'u1' }))
  })
})
