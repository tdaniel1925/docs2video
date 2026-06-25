import { describe, it, expect } from 'vitest'
import { shouldEndTrial } from '../app/_lib/credits'

/**
 * Free-trial-then-auto-bill: the trial only ends (→ Stripe charges the saved
 * card) when the user has run their credits to zero AND is genuinely a trialing
 * customer. These guards prevent accidental charges (the worst billing bug).
 */
describe('shouldEndTrial', () => {
  const base = {
    balanceTotal: 0,
    subscriptionStatus: 'trial' as string | null | undefined,
    stripeSubscriptionId: 'sub_123' as string | null | undefined,
    stripeSubStatus: 'trialing' as string | null | undefined,
  }

  it('ENDS the trial when credits are depleted and the sub is trialing', () => {
    expect(shouldEndTrial(base)).toBe(true)
  })

  it('does NOT end while the user still has credits', () => {
    expect(shouldEndTrial({ ...base, balanceTotal: 500 })).toBe(false)
    expect(shouldEndTrial({ ...base, balanceTotal: 1 })).toBe(false)
  })

  it('treats a negative balance as depleted (safety)', () => {
    expect(shouldEndTrial({ ...base, balanceTotal: -10 })).toBe(true)
  })

  it('does NOT charge a user who is not on the trial status', () => {
    expect(shouldEndTrial({ ...base, subscriptionStatus: 'starter' })).toBe(false)
    expect(shouldEndTrial({ ...base, subscriptionStatus: 'pro' })).toBe(false)
    expect(shouldEndTrial({ ...base, subscriptionStatus: 'free' })).toBe(false)
    expect(shouldEndTrial({ ...base, subscriptionStatus: 'past_due' })).toBe(false)
    expect(shouldEndTrial({ ...base, subscriptionStatus: null })).toBe(false)
    expect(shouldEndTrial({ ...base, subscriptionStatus: undefined })).toBe(false)
  })

  it('does NOT act without a subscription id (no card/plan on file)', () => {
    expect(shouldEndTrial({ ...base, stripeSubscriptionId: null })).toBe(false)
    expect(shouldEndTrial({ ...base, stripeSubscriptionId: undefined })).toBe(false)
    expect(shouldEndTrial({ ...base, stripeSubscriptionId: '' })).toBe(false)
  })

  it('is idempotent — does nothing if Stripe already moved the sub off trialing', () => {
    expect(shouldEndTrial({ ...base, stripeSubStatus: 'active' })).toBe(false)
    expect(shouldEndTrial({ ...base, stripeSubStatus: 'canceled' })).toBe(false)
    expect(shouldEndTrial({ ...base, stripeSubStatus: 'past_due' })).toBe(false)
    expect(shouldEndTrial({ ...base, stripeSubStatus: null })).toBe(false)
  })

  it('requires ALL conditions — any single failure blocks the charge', () => {
    // depleted + trialing sub but wrong status → no charge
    expect(shouldEndTrial({ balanceTotal: 0, subscriptionStatus: 'starter', stripeSubscriptionId: 'sub_1', stripeSubStatus: 'trialing' })).toBe(false)
    // everything right except credits remain → no charge
    expect(shouldEndTrial({ balanceTotal: 9999, subscriptionStatus: 'trial', stripeSubscriptionId: 'sub_1', stripeSubStatus: 'trialing' })).toBe(false)
  })
})
