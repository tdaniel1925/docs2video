import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

/**
 * Subscription money rules from the 2026-09-26 audit (C2, C3, H1, Medium/Low).
 * The Stripe calls themselves can't run here, so the decisions are pure
 * functions tested directly, and the wiring is checked by reading the source.
 */

// SUBSCRIPTION_PRICES is read from env when app/_lib/stripe loads, so set
// fake price ids BEFORE importing anything that pulls it in.
process.env.STRIPE_PRICE_STARTER = 'price_starter'
process.env.STRIPE_PRICE_PRO = 'price_pro'
process.env.STRIPE_PRICE_BUSINESS = 'price_business'
process.env.STRIPE_PRICE_ENTERPRISE = 'price_enterprise'

let billing: typeof import('../app/_lib/billing')
let pricing: typeof import('../app/_lib/pricing')
beforeAll(async () => {
  billing = await import('../app/_lib/billing')
  pricing = await import('../app/_lib/pricing')
})
afterEach(() => { vi.unstubAllEnvs() })

const sub = (id: string, status: string, price: string, extra: Record<string, unknown> = {}) => ({
  id, status, metadata: {}, items: { data: [{ id: `si_${id}`, price: { id: price } }] }, ...extra,
})

describe('decidePlanChange — never a second subscription (C3)', () => {
  it('no live subscription → normal checkout', () => {
    expect(billing.decidePlanChange([], 'pro', 'price_pro')).toEqual({ kind: 'checkout' })
    // canceled / expired ones don't count
    expect(billing.decidePlanChange([sub('a', 'canceled', 'price_pro'), sub('b', 'incomplete_expired', 'price_pro')], 'pro', 'price_pro'))
      .toEqual({ kind: 'checkout' })
  })

  it('an ACTIVE plan is changed in place, with the right direction', () => {
    const up = billing.decidePlanChange([sub('a', 'active', 'price_pro')], 'business', 'price_business')
    expect(up).toMatchObject({ kind: 'update_in_place', subscriptionId: 'a', itemId: 'si_a', currentTier: 'pro', direction: 'upgrade' })
    const down = billing.decidePlanChange([sub('a', 'active', 'price_enterprise')], 'pro', 'price_pro')
    expect(down).toMatchObject({ kind: 'update_in_place', direction: 'downgrade' })
    // a grandfathered Starter moving to Pro is an upgrade
    expect(billing.decidePlanChange([sub('a', 'active', 'price_starter')], 'pro', 'price_pro')).toMatchObject({ direction: 'upgrade' })
  })

  it('same plan → already on it (no new charge)', () => {
    expect(billing.decidePlanChange([sub('a', 'active', 'price_pro')], 'pro', 'price_pro')).toEqual({ kind: 'already_on_plan' })
  })

  it('a card-on-file trial may go through checkout, flagged so the webhook cancels it', () => {
    expect(billing.decidePlanChange([sub('t', 'trialing', 'price_pro')], 'pro', 'price_pro'))
      .toEqual({ kind: 'checkout_replacing_trial', trialSubscriptionId: 't' })
  })

  it('payment trouble or several live plans → billing portal, never a new subscription', () => {
    for (const s of ['past_due', 'unpaid', 'incomplete']) {
      expect(billing.decidePlanChange([sub('a', s, 'price_pro')], 'business', 'price_business'))
        .toEqual({ kind: 'portal', reason: 'payment_issue' })
    }
    expect(billing.decidePlanChange([sub('a', 'active', 'price_pro'), sub('b', 'active', 'price_business')], 'enterprise', 'price_enterprise'))
      .toEqual({ kind: 'portal', reason: 'multiple' })
  })

  it('ignores the AI Social add-on subscription entirely', () => {
    const addon = sub('x', 'active', 'price_addon', { metadata: { type: 'social_addon' } })
    expect(billing.decidePlanChange([addon], 'pro', 'price_pro')).toEqual({ kind: 'checkout' })
    expect(billing.decidePlanChange([addon, sub('a', 'active', 'price_pro')], 'business', 'price_business'))
      .toMatchObject({ kind: 'update_in_place', subscriptionId: 'a' })
  })
})

describe('subscriptionOnFile — only the plan on file may change the user (C3)', () => {
  it('matches, differs, or has nothing on file', () => {
    expect(billing.subscriptionOnFile('sub_1', 'sub_1')).toBe('match')
    expect(billing.subscriptionOnFile('sub_1', 'sub_2')).toBe('other')
    expect(billing.subscriptionOnFile(null, 'sub_2')).toBe('none_on_file')
    expect(billing.subscriptionOnFile('', 'sub_2')).toBe('none_on_file')
  })
})

describe('cardConfirmAction — saving a card (C2)', () => {
  it('never lifts past_due or banned', () => {
    expect(billing.cardConfirmAction('past_due')).toBe('blocked')
    expect(billing.cardConfirmAction('banned')).toBe('blocked')
  })
  it('never resets a paying customer to trial', () => {
    for (const s of ['pro', 'business', 'enterprise', 'starter', 'agency']) {
      expect(billing.cardConfirmAction(s)).toBe('keep_paid_plan')
    }
  })
  it('starts the trial for free / trial / new accounts', () => {
    for (const s of [null, undefined, 'free', 'trial']) {
      expect(billing.cardConfirmAction(s)).toBe('start_trial')
    }
  })
})

describe('sellable plans (onboarding, /setup-payment and checkout agree)', () => {
  it('Starter is retired; Pro/Business/Enterprise are sold', () => {
    expect(pricing.isSellablePlan('starter')).toBe(false)
    expect(pricing.isSellablePlan('agency')).toBe(false)
    expect(pricing.isSellablePlan('free')).toBe(false)
    for (const t of ['pro', 'business', 'enterprise']) expect(pricing.isSellablePlan(t)).toBe(true)
  })
})

describe('WELCOME50 promo id comes from env, safely', () => {
  it('uses STRIPE_PROMO_WELCOME50 when set', () => {
    vi.stubEnv('STRIPE_PROMO_WELCOME50', 'promo_test_123')
    expect(billing.autoPromoId('welcome50')).toBe('promo_test_123')
  })
  it('falls back to the known live id only on a live key', () => {
    vi.stubEnv('STRIPE_PROMO_WELCOME50', '')
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_live_x')
    expect(billing.autoPromoId('WELCOME50')).toMatch(/^promo_/)
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_x')
    expect(billing.autoPromoId('WELCOME50')).toBeUndefined()
  })
  it('ignores codes that are not allowlisted', () => {
    expect(billing.autoPromoId('FREEMONEY')).toBeUndefined()
    expect(billing.autoPromoId(null)).toBeUndefined()
  })
})

// ── Wiring checks (read the source) ──
const ROOT = path.resolve(__dirname, '..')
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8')

describe('wiring', () => {
  it('both subscription doors share the no-second-subscription flow (C3)', () => {
    for (const r of ['app/api/stripe/checkout/route.ts', 'app/api/subscribe/route.ts']) {
      const src = read(r)
      expect(src).toMatch(/startSubscription\(/)
      expect(src).not.toMatch(/checkout\.sessions\.create/)
    }
  })

  it('the webhook never returns an error from inside the handler without releasing the claim (H1)', () => {
    const src = read('app/api/webhooks/stripe/route.ts')
    const handler = src.slice(src.indexOf('try {\n    switch (event.type)'), src.lastIndexOf('} catch (err) {'))
    expect(handler.length).toBeGreaterThan(1000)
    expect(handler).not.toMatch(/status:\s*500/)
    // ...and the one catch does release it
    expect(src.slice(src.lastIndexOf('} catch (err) {'))).toMatch(/processed_stripe_events'\)\.delete\(\)/)
  })

  it('the webhook ignores deletions of subscriptions that are not on file (C3)', () => {
    const src = read('app/api/webhooks/stripe/route.ts')
    const del = src.slice(src.indexOf("case 'customer.subscription.deleted'"), src.indexOf("case 'invoice.payment_succeeded'"))
    expect(del).toMatch(/subscriptionOnFile\(/)
    expect(del).toMatch(/onFile === 'other'/)
  })

  it('refunds resolve the invoice through the current Stripe API shape (H8)', () => {
    const src = read('app/api/webhooks/stripe/route.ts')
    expect(src).toMatch(/invoiceIdForPayment\(/)
    expect(read('app/_lib/billing.ts')).toMatch(/invoicePayments\.list/)
  })

  it('confirm-card never trusts a customer id from the browser (C2)', () => {
    const src = read('app/api/confirm-card/route.ts')
    expect(src).not.toMatch(/body\.customerId/)
    expect(src).toMatch(/setupIntents\.retrieve/)
  })

  it('account delete cancels Stripe subscriptions before deleting (H12)', () => {
    const src = read('app/api/account/delete/route.ts')
    const cancelAt = src.indexOf('subscriptions.cancel')
    const deleteAt = src.indexOf("from('profiles').delete()")
    expect(cancelAt).toBeGreaterThan(-1)
    expect(deleteAt).toBeGreaterThan(cancelAt)
  })

  it('no page offers a plan checkout would reject', () => {
    expect(read('app/(onboarding)/setup/page.tsx')).not.toMatch(/\['starter',\s*'pro',\s*'agency'\]/)
    expect(read('app/(auth)/setup-payment/page.tsx')).not.toMatch(/id: 'starter'/)
  })

  it('credit packs no longer accept typed promo codes', () => {
    expect(read('app/api/credits/buy/route.ts')).not.toMatch(/allow_promotion_codes\s*=\s*true/)
  })

  it('the live promo id is no longer hardcoded in the checkout route', () => {
    expect(read('app/api/stripe/checkout/route.ts')).not.toMatch(/promo_1/)
  })
})
