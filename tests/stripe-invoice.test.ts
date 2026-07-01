import { describe, it, expect } from 'vitest'
import {
  subscriptionIdFromInvoice,
  priceIdFromInvoice,
  isSocialAddonSubscription,
} from '../app/_lib/stripe-invoice'

// These predicates gate the webhook's money decisions (review B3/B12): the
// social-add-on guard keeps a $50 add-on from upgrading/blocking the MAIN plan,
// and the invoice price-id accessor keeps dunning recovery from granting
// free-tier credits to a paying customer.

describe('subscriptionIdFromInvoice', () => {
  it('reads the legacy top-level subscription string', () => {
    expect(subscriptionIdFromInvoice({ subscription: 'sub_123' })).toBe('sub_123')
  })
  it('reads an expanded subscription object', () => {
    expect(subscriptionIdFromInvoice({ subscription: { id: 'sub_obj' } })).toBe('sub_obj')
  })
  it('reads the newer parent.subscription_details shape', () => {
    expect(
      subscriptionIdFromInvoice({ parent: { subscription_details: { subscription: 'sub_new' } } }),
    ).toBe('sub_new')
  })
  it('prefers the legacy field when both exist', () => {
    expect(
      subscriptionIdFromInvoice({
        subscription: 'sub_old',
        parent: { subscription_details: { subscription: 'sub_new' } },
      }),
    ).toBe('sub_old')
  })
  it('returns null for one-time (non-subscription) invoices', () => {
    expect(subscriptionIdFromInvoice({})).toBeNull()
    expect(subscriptionIdFromInvoice(null)).toBeNull()
    expect(subscriptionIdFromInvoice(undefined)).toBeNull()
  })
})

describe('priceIdFromInvoice', () => {
  it('reads the legacy line.price.id', () => {
    expect(
      priceIdFromInvoice({ lines: { data: [{ price: { id: 'price_abc' } }] } }),
    ).toBe('price_abc')
  })
  it('reads the newer line.pricing.price_details.price', () => {
    expect(
      priceIdFromInvoice({ lines: { data: [{ pricing: { price_details: { price: 'price_new' } } }] } }),
    ).toBe('price_new')
  })
  it('skips lines without a price and returns the first real one', () => {
    expect(
      priceIdFromInvoice({ lines: { data: [{}, { price: { id: 'price_second' } }] } }),
    ).toBe('price_second')
  })
  it('returns null when no line carries a price', () => {
    expect(priceIdFromInvoice({ lines: { data: [{}] } })).toBeNull()
    expect(priceIdFromInvoice({})).toBeNull()
    expect(priceIdFromInvoice(null)).toBeNull()
  })
})

describe('isSocialAddonSubscription', () => {
  it('matches the add-on metadata set by the checkout route', () => {
    expect(isSocialAddonSubscription({ metadata: { type: 'social_addon' } })).toBe(true)
  })
  it('does NOT match main-plan subscriptions', () => {
    expect(isSocialAddonSubscription({ metadata: { type: 'subscription', tier: 'pro' } })).toBe(false)
    expect(isSocialAddonSubscription({ metadata: {} })).toBe(false)
    expect(isSocialAddonSubscription({ metadata: null })).toBe(false)
    expect(isSocialAddonSubscription({})).toBe(false)
    expect(isSocialAddonSubscription(null)).toBe(false)
    expect(isSocialAddonSubscription(undefined)).toBe(false)
  })
})
