import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import path from 'path'
import { makeDb, type FakeDb } from './fixtures/fake-supabase'

/*
 * IN-APP PAYMENTS AND BILLING (2026-10-14).
 * Owner: "all payments inline, not having to go to the Stripe page, and that
 * includes billing management also." Every money path runs its REAL code here
 * with Stripe and the database faked — no Stripe call is made:
 *   subscribe · upgrade with proration (incl. the bank's security check) ·
 *   downgrade · cancel / resume · add / default / remove card · late-payment
 *   fix · credit pack · AI Social add-on · trial card · promo code · webhook
 *   fulfilment (paid gate, delayed payments, duplicate events).
 */

const h = vi.hoisted(() => ({
  db: null as unknown as FakeDb,
  user: { id: 'u1', email: 'buyer@x.com' } as { id: string; email: string } | null,
  stripe: null as any,
  cardless: false,
  cookie: undefined as string | undefined,
  topup: vi.fn(),
  grant: vi.fn(),
  tierChange: vi.fn(),
}))

vi.mock('next/headers', () => ({ cookies: async () => ({ get: (k: string) => (k === 'd2v_ref' && h.cookie ? { value: h.cookie } : undefined) }) }))
vi.mock('../app/_lib/supabase/server', async () => {
  const { fakeClient } = await import('./fixtures/fake-supabase')
  return { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: h.user } }) }, from: (t: string) => fakeClient(h.db).from(t) }) }
})
vi.mock('../app/_lib/supabase/admin', async () => {
  const { fakeClient } = await import('./fixtures/fake-supabase')
  return { createAdminClient: () => fakeClient(h.db) }
})
vi.mock('../app/_lib/stripe', () => {
  const prices: Record<string, string> = { starter: 'price_s', pro: 'price_pro', business: 'price_bus', enterprise: 'price_ent' }
  return {
    SUBSCRIPTION_PRICES: prices,
    tierFromPriceId: (id: string) => (Object.entries(prices).find(([, v]) => v === id)?.[0] ?? null),
    getStripe: () => h.stripe,
    get stripe() { return h.stripe },
  }
})
vi.mock('../app/_lib/affiliate', () => ({
  getAffiliateByCode: async (c: string) => (c === 'REF1' ? { status: 'active', user_id: 'someone-else', stripe_promo_code_id: 'promo_aff' } : null),
  recordCommission: vi.fn(async () => ({ recorded: false, reason: 'none' })),
  clawbackByInvoice: vi.fn(async () => []),
}))
vi.mock('../app/_lib/cardless-prep', () => ({ isCardless: async () => h.cardless }))
vi.mock('../app/_lib/credits', () => ({
  addTopupCredits: (...a: unknown[]) => h.topup(...a),
  grantMonthlyCredits: (...a: unknown[]) => h.grant(...a),
  applyTierChange: (...a: unknown[]) => h.tierChange(...a),
  revokeCredits: vi.fn(async () => true),
  proportionalCredits: () => 0,
  TIER_CREDITS: { free: 2000, starter: 5000, pro: 25000, business: 75000, enterprise: 200000 },
}))
vi.mock('../app/_lib/ops-alert', () => ({ alertOps: vi.fn(async () => true), stripeEventCustomer: () => 'someone' }))
vi.mock('../app/_lib/error-logger', () => ({ logError: vi.fn() }))
vi.mock('../app/_lib/admin/payment-alerts', () => ({ recordPaymentFailure: vi.fn(async () => {}) }))
vi.mock('../app/_lib/apex', () => ({ sendApexSaleEvent: vi.fn(async () => {}), sendApexWelcomeEmail: vi.fn() }))

// ── A fake Stripe with just the calls these paths make ──
function fakeStripe() {
  const st: any = {
    customers: {
      retrieve: vi.fn(async (id: string) => ({ id, invoice_settings: { default_payment_method: 'pm_a' }, name: 'A', email: 'a@x.com', address: null })),
      create: vi.fn(async () => ({ id: 'cus_new' })),
      update: vi.fn(async () => ({})),
      listPaymentMethods: vi.fn(async () => ({ data: [{ id: 'pm_a', type: 'card', customer: 'cus_1', card: { brand: 'visa', last4: '4242', exp_month: 1, exp_year: 2030 } }] })),
    },
    subscriptions: {
      list: vi.fn(async () => ({ data: [] })),
      update: vi.fn(async (id: string) => ({ id, pending_update: null, latest_invoice: 'in_up', cancel_at: 1900000000, items: { data: [{ current_period_end: 1900000000 }] } })),
      cancel: vi.fn(async () => ({})),
      retrieve: vi.fn(async (id: string) => ({ id, pending_update: { expires_at: 1 }, metadata: {} })),
      create: vi.fn(),
    },
    checkout: { sessions: { create: vi.fn(async () => ({ id: 'cs_1', client_secret: 'cs_1_secret' })), retrieve: vi.fn(), list: vi.fn(async () => ({ data: [] })) } },
    invoices: {
      createPreview: vi.fn(async () => ({ amount_due: 4000, period_end: 1900000000, next_payment_attempt: 1900000000 })),
      voidInvoice: vi.fn(async () => ({})),
      retrieve: vi.fn(async (id: string) => ({ id, customer: 'cus_1', status: 'open', billing_reason: 'subscription_update', parent: { subscription_details: { subscription: 'sub_1' } } })),
      list: vi.fn(async () => ({ data: [] })),
      pay: vi.fn(async () => ({ status: 'paid' })),
    },
    invoicePayments: { list: vi.fn(async () => ({ data: [] })) },
    paymentIntents: { retrieve: vi.fn() },
    paymentMethods: {
      retrieve: vi.fn(async (id: string) => ({ id, type: 'card', customer: 'cus_1', card: { fingerprint: 'fp_1' } })),
      detach: vi.fn(async () => ({})),
    },
    setupIntents: {
      create: vi.fn(async () => ({ client_secret: 'seti_1_secret' })),
      retrieve: vi.fn(async () => ({ status: 'succeeded', customer: 'cus_1', payment_method: 'pm_new' })),
    },
    webhooks: { constructEvent: (body: string) => JSON.parse(body) },
    refunds: { list: vi.fn(async () => ({ data: [] })) },
    charges: { retrieve: vi.fn() },
  }
  return st
}

const sub = (id: string, status: string, price: string, extra: Record<string, unknown> = {}) => ({
  id, status, metadata: {}, cancel_at_period_end: false, pending_update: null, default_payment_method: null,
  items: { data: [{ id: `si_${id}`, price: { id: price, unit_amount: price === 'price_pro' ? 7900 : price === 'price_bus' ? 19900 : 49900 }, current_period_end: 1900000000 }] },
  ...extra,
})

beforeEach(() => {
  h.stripe = fakeStripe()
  h.user = { id: 'u1', email: 'buyer@x.com' }
  h.cardless = false
  h.cookie = undefined
  h.topup.mockReset().mockResolvedValue(true)
  h.grant.mockReset().mockResolvedValue(undefined)
  h.tierChange.mockReset().mockResolvedValue(undefined)
  h.db = makeDb({
    profiles: [{ id: 'u1', email: 'buyer@x.com', stripe_customer_id: 'cus_1', stripe_subscription_id: null, subscription_status: 'free', card_on_file: true, social_addon_active: false }],
    processed_stripe_events: [],
    trial_card_fingerprints: [],
  })
  vi.unstubAllEnvs()
})

const json = (r: Response) => r.json() as Promise<any>
const post = (url: string, body?: unknown) => new Request(`http://localhost${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json', origin: 'https://docs2video.com' }, body: body ? JSON.stringify(body) : undefined })
const lastSession = () => h.stripe.checkout.sessions.create.mock.calls.at(-1)?.[0]

// ═══ 1. SUBSCRIBE — in the app, never a Stripe page ═══════════════════════
describe('subscribe (in-app checkout session)', () => {
  it('a new plan is an in-app session: elements mode, no Stripe page, no fixed payment methods, our own return page', async () => {
    const { POST } = await import('../app/api/stripe/checkout/route')
    const res = await POST(post('/api/stripe/checkout', { planId: 'pro' }))
    const body = await json(res)
    expect(res.status).toBe(200)
    expect(body).toEqual({ clientSecret: 'cs_1_secret', sessionId: 'cs_1', promoCodes: true })
    const p = lastSession()
    expect(p.ui_mode).toBe('elements')
    expect(p).not.toHaveProperty('success_url')
    expect(p).not.toHaveProperty('cancel_url')
    expect(p).not.toHaveProperty('payment_method_types')
    expect(p.return_url).toBe('https://docs2video.com/settings?tab=billing&checkout={CHECKOUT_SESSION_ID}')
    expect(p.customer).toBe('cus_1')
    expect(p.mode).toBe('subscription')
    expect(p.metadata).toMatchObject({ supabase_user_id: 'u1', type: 'subscription', tier: 'pro' })
    expect(p.allow_promotion_codes).toBe(true)
  })

  it('WELCOME50 from the upgrade email is applied in the session (no typed code needed)', async () => {
    vi.stubEnv('STRIPE_PROMO_WELCOME50', 'promo_w50')
    const { POST } = await import('../app/api/stripe/checkout/route')
    const body = await json(await POST(post('/api/stripe/checkout', { planId: 'pro', promo: 'welcome50' })))
    expect(body.promoCodes).toBe(false)
    expect(lastSession().discounts).toEqual([{ promotion_code: 'promo_w50' }])
    expect(lastSession()).not.toHaveProperty('allow_promotion_codes')
  })

  it('a referral cookie applies the affiliate code (attribution kept)', async () => {
    h.cookie = 'REF1'
    const { POST } = await import('../app/api/stripe/checkout/route')
    await POST(post('/api/stripe/checkout', { planId: 'business' }))
    expect(lastSession().discounts).toEqual([{ promotion_code: 'promo_aff' }])
  })

  it('someone already paying gets the in-app plan change — NEVER a second subscription (C3)', async () => {
    h.stripe.subscriptions.list.mockResolvedValue({ data: [sub('sub_1', 'active', 'price_pro')] })
    const { POST } = await import('../app/api/subscribe/route')
    const res = await POST(post('/api/subscribe', { tier: 'business' }))
    expect(res.status).toBe(409)
    expect(await json(res)).toMatchObject({ code: 'change_in_place', plan: 'business', direction: 'upgrade' })
    expect(h.stripe.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it('a late payment must be fixed first; nothing is sold', async () => {
    h.stripe.subscriptions.list.mockResolvedValue({ data: [sub('sub_1', 'past_due', 'price_pro')] })
    const { POST } = await import('../app/api/stripe/checkout/route')
    const res = await POST(post('/api/stripe/checkout', { planId: 'business' }))
    expect(await json(res)).toMatchObject({ code: 'fix_payment' })
    expect(h.stripe.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it('a card-on-file trial is replaced, flagged so the webhook cancels it', async () => {
    h.stripe.subscriptions.list.mockResolvedValue({ data: [sub('sub_trial', 'trialing', 'price_pro')] })
    const { POST } = await import('../app/api/stripe/checkout/route')
    await POST(post('/api/stripe/checkout', { planId: 'pro' }))
    expect(lastSession().metadata.replaces_subscription).toBe('sub_trial')
  })

  it('no Stripe customer yet → one is made BEFORE the form opens and saved on the profile', async () => {
    h.db.tables.profiles[0].stripe_customer_id = null
    const { POST } = await import('../app/api/stripe/checkout/route')
    await POST(post('/api/stripe/checkout', { planId: 'pro' }))
    expect(h.stripe.customers.create).toHaveBeenCalledWith(expect.objectContaining({ metadata: { supabase_user_id: 'u1' } }))
    expect(h.db.tables.profiles[0].stripe_customer_id).toBe('cus_new')
    expect(lastSession().customer).toBe('cus_new')
  })

  it('a stale customer id (deleted / test-mode) is replaced, not fatal', async () => {
    h.stripe.customers.retrieve.mockRejectedValueOnce(new Error('No such customer: cus_1'))
    const { POST } = await import('../app/api/stripe/checkout/route')
    const res = await POST(post('/api/stripe/checkout', { planId: 'pro' }))
    expect(res.status).toBe(200)
    expect(h.db.tables.profiles[0].stripe_customer_id).toBe('cus_new')
  })
})

// ═══ 2. CREDIT PACKS + ADD-ON ═════════════════════════════════════════════
describe('credit pack and AI Social add-on (in-app)', () => {
  it('a pack is an in-app payment with a receipt; no typed promo codes on packs', async () => {
    vi.stubEnv('STRIPE_PRICE_CREDIT_PACK_7500', 'price_pack_power')
    const { POST } = await import('../app/api/credits/buy/route')
    const body = await json(await POST(post('/api/credits/buy', { pack: 'power' })))
    expect(body).toEqual({ clientSecret: 'cs_1_secret', sessionId: 'cs_1' })
    const p = lastSession()
    expect(p).toMatchObject({ ui_mode: 'elements', mode: 'payment', customer: 'cus_1' })
    expect(p.metadata).toMatchObject({ type: 'credit_pack', pack: 'power', credits: '7500', supabase_user_id: 'u1' })
    expect(p.invoice_creation).toMatchObject({ enabled: true })
    expect(p).not.toHaveProperty('allow_promotion_codes')
    expect(p).not.toHaveProperty('success_url')
    expect(p).not.toHaveProperty('payment_method_types')
  })

  it('an account with no card is told to add one first — before Stripe is called', async () => {
    h.cardless = true
    vi.stubEnv('STRIPE_PRICE_CREDIT_PACK_2500', 'price_pack_small')
    const { POST } = await import('../app/api/credits/buy/route')
    const res = await POST(post('/api/credits/buy', { pack: 'starter' }))
    expect(res.status).toBe(402)
    expect((await json(res)).code).toBe('card_required')
    expect(h.stripe.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it('the add-on is an in-app subscription tagged social_addon', async () => {
    vi.stubEnv('STRIPE_PRICE_ADDON_SOCIAL', 'price_social')
    const { POST } = await import('../app/api/social-addon/checkout/route')
    const body = await json(await POST(post('/api/social-addon/checkout')))
    expect(body.clientSecret).toBe('cs_1_secret')
    expect(lastSession()).toMatchObject({ ui_mode: 'elements', mode: 'subscription', metadata: { type: 'social_addon', supabase_user_id: 'u1' } })
  })
})

// ═══ 3. AFTER PAYING: the pop-up's status check ════════════════════════════
describe('checkout status (pop-up waits for the purchase to land)', () => {
  it('a PAID pack is granted with the same per-session key as the webhook and cron — twice is still one grant', async () => {
    h.stripe.checkout.sessions.retrieve.mockResolvedValue({ id: 'cs_9', status: 'complete', payment_status: 'paid', metadata: { type: 'credit_pack', pack: 'power', credits: '7500', supabase_user_id: 'u1' } })
    const { checkoutFulfilment } = await import('../app/_lib/billing-manage')
    const { createAdminClient } = await import('../app/_lib/supabase/admin')
    const r = await checkoutFulfilment(h.stripe, createAdminClient(), 'u1', 'cs_9')
    await checkoutFulfilment(h.stripe, createAdminClient(), 'u1', 'cs_9')
    expect(r).toMatchObject({ fulfilled: true, kind: 'credit_pack' })
    expect(h.topup).toHaveBeenCalledTimes(2)
    for (const call of h.topup.mock.calls) expect(call[3]).toEqual({ idempotencyKey: 'pack:cs_9' })
  })

  it('unpaid → nothing granted; someone else’s session → not found', async () => {
    const { checkoutFulfilment } = await import('../app/_lib/billing-manage')
    const { createAdminClient } = await import('../app/_lib/supabase/admin')
    h.stripe.checkout.sessions.retrieve.mockResolvedValue({ id: 'cs_9', status: 'complete', payment_status: 'unpaid', metadata: { type: 'credit_pack', credits: '7500', supabase_user_id: 'u1' } })
    expect(await checkoutFulfilment(h.stripe, createAdminClient(), 'u1', 'cs_9')).toMatchObject({ fulfilled: false })
    expect(h.topup).not.toHaveBeenCalled()
    h.stripe.checkout.sessions.retrieve.mockResolvedValue({ id: 'cs_9', status: 'complete', payment_status: 'paid', metadata: { type: 'credit_pack', credits: '7500', supabase_user_id: 'OTHER' } })
    expect(await checkoutFulfilment(h.stripe, createAdminClient(), 'u1', 'cs_9')).toBeNull()
    expect(h.topup).not.toHaveBeenCalled()
  })

  it('a plan counts as done only once the webhook put THAT subscription and tier on the profile', async () => {
    const { checkoutFulfilment } = await import('../app/_lib/billing-manage')
    const { createAdminClient } = await import('../app/_lib/supabase/admin')
    h.stripe.checkout.sessions.retrieve.mockResolvedValue({ id: 'cs_p', status: 'complete', payment_status: 'paid', subscription: 'sub_new', metadata: { type: 'subscription', tier: 'pro', supabase_user_id: 'u1' } })
    expect((await checkoutFulfilment(h.stripe, createAdminClient(), 'u1', 'cs_p'))!.fulfilled).toBe(false)
    Object.assign(h.db.tables.profiles[0], { subscription_status: 'pro', stripe_subscription_id: 'sub_new' })
    expect((await checkoutFulfilment(h.stripe, createAdminClient(), 'u1', 'cs_p'))!.fulfilled).toBe(true)
    expect(h.grant).not.toHaveBeenCalled() // plans are granted by the webhook only
  })
})

// ═══ 4. CHANGE PLAN with a preview ════════════════════════════════════════
describe('change plan in the app (proration preview → confirm)', () => {
  beforeEach(() => { h.stripe.subscriptions.list.mockResolvedValue({ data: [sub('sub_1', 'active', 'price_pro')] }) })

  it('upgrade preview = Stripe’s proration bill for right now', async () => {
    const { previewPlanChange } = await import('../app/_lib/billing-manage')
    const p = await previewPlanChange(h.stripe, 'cus_1', 'business', 1_800_000_000)
    expect(h.stripe.invoices.createPreview).toHaveBeenCalledWith({
      customer: 'cus_1', subscription: 'sub_1',
      subscription_details: { items: [{ id: 'si_sub_1', price: 'price_bus' }], proration_behavior: 'always_invoice', proration_date: 1_800_000_000 },
    })
    expect(p).toMatchObject({ direction: 'upgrade', dueNowCents: 4000, nextAmountCents: 19900, prorationDate: 1_800_000_000, to: { label: 'Business' } })
  })

  it('downgrade preview: nothing today, the cheaper price from the next renewal', async () => {
    h.stripe.subscriptions.list.mockResolvedValue({ data: [sub('sub_1', 'active', 'price_ent')] })
    h.stripe.invoices.createPreview.mockResolvedValue({ amount_due: 7900 })
    const { previewPlanChange } = await import('../app/_lib/billing-manage')
    const p = await previewPlanChange(h.stripe, 'cus_1', 'pro')
    expect(h.stripe.invoices.createPreview.mock.calls[0][0].subscription_details.proration_behavior).toBe('none')
    expect(p).toMatchObject({ direction: 'downgrade', dueNowCents: 0, nextAmountCents: 7900 })
  })

  it('upgrade with the customer present waits for payment (pending_if_incomplete) — no metadata in the pending update', async () => {
    const { applyPlanChange } = await import('../app/_lib/billing-manage')
    const now = Math.floor(Date.now() / 1000)
    const r = await applyPlanChange(h.stripe, 'cus_1', 'u1', 'business', now - 60)
    expect(r).toEqual({ status: 'done', direction: 'upgrade' })
    const [id, params] = h.stripe.subscriptions.update.mock.calls[0]
    expect(id).toBe('sub_1')
    expect(params).toEqual({ items: [{ id: 'si_sub_1', price: 'price_bus' }], proration_behavior: 'always_invoice', proration_date: now - 60, payment_behavior: 'pending_if_incomplete' })
    expect(h.stripe.subscriptions.create).not.toHaveBeenCalled()
    expect(h.stripe.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it('a stale or forged proration moment is replaced by "now" (no cheap upgrades)', async () => {
    const { safeProrationDate, PRORATION_DATE_MAX_AGE_SEC } = await import('../app/_lib/billing-manage')
    const now = 1_800_000_000
    expect(safeProrationDate(now - 10, now)).toBe(now - 10)
    expect(safeProrationDate(now - PRORATION_DATE_MAX_AGE_SEC - 1, now)).toBe(now)
    expect(safeProrationDate(now + 3600, now)).toBe(now)
    expect(safeProrationDate('1799999999', now)).toBe(now)
    expect(safeProrationDate(undefined, now)).toBe(now)
  })

  it('the bank wants a security check → the pop-up gets the payment’s client secret', async () => {
    h.stripe.subscriptions.update.mockResolvedValueOnce({ id: 'sub_1', pending_update: { expires_at: 1 }, latest_invoice: 'in_up' })
    h.stripe.invoicePayments.list.mockResolvedValue({ data: [{ payment: { payment_intent: { id: 'pi_1', status: 'requires_action', client_secret: 'pi_1_secret' } } }] })
    const { applyPlanChange } = await import('../app/_lib/billing-manage')
    expect(await applyPlanChange(h.stripe, 'cus_1', 'u1', 'business', undefined)).toEqual({ status: 'requires_action', clientSecret: 'pi_1_secret', invoiceId: 'in_up' })
    expect(h.stripe.invoices.voidInvoice).not.toHaveBeenCalled()
  })

  it('declined → the waiting change and its bill are dropped, plain message, plan unchanged', async () => {
    h.stripe.subscriptions.update.mockResolvedValueOnce({ id: 'sub_1', pending_update: { expires_at: 1 }, latest_invoice: 'in_up' })
    h.stripe.invoicePayments.list.mockResolvedValue({ data: [{ payment: { payment_intent: { id: 'pi_1', status: 'requires_payment_method' } } }] })
    const { applyPlanChange } = await import('../app/_lib/billing-manage')
    await expect(applyPlanChange(h.stripe, 'cus_1', 'u1', 'business', undefined)).rejects.toMatchObject({ status: 402, code: 'declined' })
    expect(h.stripe.invoices.voidInvoice).toHaveBeenCalledWith('in_up')
  })

  it('downgrade: no charge, no proration, applied at once', async () => {
    h.stripe.subscriptions.list.mockResolvedValue({ data: [sub('sub_1', 'active', 'price_ent')] })
    const { applyPlanChange } = await import('../app/_lib/billing-manage')
    expect(await applyPlanChange(h.stripe, 'cus_1', 'u1', 'pro', undefined)).toEqual({ status: 'done', direction: 'downgrade' })
    expect(h.stripe.subscriptions.update.mock.calls[0][1]).toMatchObject({ proration_behavior: 'none', payment_behavior: 'error_if_incomplete' })
  })

  it('refused while a cancellation is scheduled (resume first), and for a late payment', async () => {
    const { applyPlanChange } = await import('../app/_lib/billing-manage')
    h.stripe.subscriptions.list.mockResolvedValue({ data: [sub('sub_1', 'active', 'price_pro', { cancel_at_period_end: true })] })
    await expect(applyPlanChange(h.stripe, 'cus_1', 'u1', 'business', undefined)).rejects.toMatchObject({ code: 'resume_first' })
    h.stripe.subscriptions.list.mockResolvedValue({ data: [sub('sub_1', 'past_due', 'price_pro')] })
    await expect(applyPlanChange(h.stripe, 'cus_1', 'u1', 'business', undefined)).rejects.toMatchObject({ code: 'fix_payment' })
    expect(h.stripe.subscriptions.update).not.toHaveBeenCalled()
  })

  it('the admin path keeps its rule: nobody present → error_if_incomplete, with the tier metadata', async () => {
    const billing = await import('../app/_lib/billing')
    await billing.changePlanInPlace(h.stripe, { kind: 'update_in_place', subscriptionId: 'sub_1', itemId: 'si_1', currentTier: 'pro', direction: 'upgrade' }, 'business', 'price_bus', 'u1')
    expect(h.stripe.subscriptions.update.mock.calls[0][1]).toEqual({
      items: [{ id: 'si_1', price: 'price_bus' }], proration_behavior: 'always_invoice',
      payment_behavior: 'error_if_incomplete', cancel_at_period_end: false, metadata: { supabase_user_id: 'u1', tier: 'business' },
    })
  })

  it('abandoning the bank check voids only THIS customer’s waiting upgrade bill', async () => {
    const { abandonPlanChange } = await import('../app/_lib/billing-manage')
    await abandonPlanChange(h.stripe, 'cus_1', 'in_up')
    expect(h.stripe.invoices.voidInvoice).toHaveBeenCalledWith('in_up')
    h.stripe.invoices.voidInvoice.mockClear()
    h.stripe.invoices.retrieve.mockResolvedValueOnce({ id: 'in_x', customer: 'cus_OTHER', status: 'open', billing_reason: 'subscription_update' })
    await expect(abandonPlanChange(h.stripe, 'cus_1', 'in_x')).rejects.toMatchObject({ status: 404 })
    expect(h.stripe.invoices.voidInvoice).not.toHaveBeenCalled()
  })
})

// ═══ 5. CANCEL / RESUME ════════════════════════════════════════════════════
describe('cancel and resume in the app', () => {
  it('a paid plan ends at the period end, with the reason recorded', async () => {
    h.stripe.subscriptions.list.mockResolvedValue({ data: [sub('sub_1', 'active', 'price_pro')] })
    const { cancelSubscription } = await import('../app/_lib/billing-manage')
    const r = await cancelSubscription(h.stripe, 'cus_1', 'plan', 'too_expensive', ' cheaper elsewhere ')
    expect(h.stripe.subscriptions.update).toHaveBeenCalledWith('sub_1', { cancel_at_period_end: true, cancellation_details: { feedback: 'too_expensive', comment: 'cheaper elsewhere' } })
    expect(h.stripe.subscriptions.cancel).not.toHaveBeenCalled()
    expect(r.status).toBe('ends_at_period_end')
  })

  it('a free trial is turned off now (nothing charged when the credits run out); junk reasons are dropped', async () => {
    h.stripe.subscriptions.list.mockResolvedValue({ data: [sub('sub_t', 'trialing', 'price_pro')] })
    const { cancelSubscription } = await import('../app/_lib/billing-manage')
    expect(await cancelSubscription(h.stripe, 'cus_1', 'plan', 'DROP TABLE', '')).toEqual({ status: 'stopped_now' })
    expect(h.stripe.subscriptions.cancel).toHaveBeenCalledWith('sub_t', { cancellation_details: {} })
  })

  it('the add-on cancels on its own, never the main plan', async () => {
    h.stripe.subscriptions.list.mockResolvedValue({ data: [sub('sub_1', 'active', 'price_pro'), sub('sub_soc', 'active', 'price_social', { metadata: { type: 'social_addon' } })] })
    const { cancelSubscription } = await import('../app/_lib/billing-manage')
    await cancelSubscription(h.stripe, 'cus_1', 'social', undefined, undefined)
    expect(h.stripe.subscriptions.update).toHaveBeenCalledTimes(1)
    expect(h.stripe.subscriptions.update.mock.calls[0][0]).toBe('sub_soc')
  })

  it('resume clears the scheduled end; nothing to resume is a plain refusal', async () => {
    const { resumeSubscription } = await import('../app/_lib/billing-manage')
    h.stripe.subscriptions.list.mockResolvedValue({ data: [sub('sub_1', 'active', 'price_pro', { cancel_at_period_end: true })] })
    await resumeSubscription(h.stripe, 'cus_1', 'plan')
    expect(h.stripe.subscriptions.update).toHaveBeenCalledWith('sub_1', { cancel_at_period_end: false })
    h.stripe.subscriptions.list.mockResolvedValue({ data: [sub('sub_1', 'active', 'price_pro')] })
    await expect(resumeSubscription(h.stripe, 'cus_1', 'plan')).rejects.toMatchObject({ code: 'nothing_to_resume' })
  })
})

// ═══ 6. CARDS ═════════════════════════════════════════════════════════════
describe('cards in the app', () => {
  it('make default: only a card of THIS customer; subscriptions with their own card follow', async () => {
    h.stripe.subscriptions.list.mockResolvedValue({ data: [sub('sub_t', 'trialing', 'price_pro', { default_payment_method: 'pm_old' })] })
    const { setDefaultCard } = await import('../app/_lib/billing-manage')
    await setDefaultCard(h.stripe, 'cus_1', 'pm_b')
    expect(h.stripe.customers.update).toHaveBeenCalledWith('cus_1', { invoice_settings: { default_payment_method: 'pm_b' } })
    expect(h.stripe.subscriptions.update).toHaveBeenCalledWith('sub_t', { default_payment_method: 'pm_b' })
    h.stripe.paymentMethods.retrieve.mockResolvedValueOnce({ id: 'pm_x', customer: 'cus_OTHER' })
    await expect(setDefaultCard(h.stripe, 'cus_1', 'pm_x')).rejects.toMatchObject({ status: 404 })
  })

  it('the last card can’t be removed while a plan or the trial needs it', async () => {
    h.stripe.subscriptions.list.mockResolvedValue({ data: [sub('sub_1', 'active', 'price_pro')] })
    const { removeCard } = await import('../app/_lib/billing-manage')
    const { createAdminClient } = await import('../app/_lib/supabase/admin')
    await expect(removeCard(h.stripe, createAdminClient(), 'u1', 'cus_1', 'pm_a')).rejects.toMatchObject({ code: 'last_card' })
    h.stripe.subscriptions.list.mockResolvedValue({ data: [] })
    h.db.tables.profiles[0].subscription_status = 'trial'
    await expect(removeCard(h.stripe, createAdminClient(), 'u1', 'cus_1', 'pm_a')).rejects.toMatchObject({ code: 'last_card' })
    expect(h.stripe.paymentMethods.detach).not.toHaveBeenCalled()
  })

  it('removing the default card moves bills to another card first', async () => {
    h.stripe.subscriptions.list.mockResolvedValue({ data: [sub('sub_1', 'active', 'price_pro')] })
    h.stripe.customers.listPaymentMethods.mockResolvedValue({ data: [{ id: 'pm_a', type: 'card', customer: 'cus_1' }, { id: 'pm_b', type: 'card', customer: 'cus_1' }] })
    const { removeCard } = await import('../app/_lib/billing-manage')
    const { createAdminClient } = await import('../app/_lib/supabase/admin')
    await removeCard(h.stripe, createAdminClient(), 'u1', 'cus_1', 'pm_a')
    const order = [h.stripe.customers.update.mock.invocationCallOrder[0], h.stripe.paymentMethods.detach.mock.invocationCallOrder[0]]
    expect(h.stripe.customers.update).toHaveBeenCalledWith('cus_1', { invoice_settings: { default_payment_method: 'pm_b' } })
    expect(order[0]).toBeLessThan(order[1])
  })

  it('a saved card is only accepted from a SetupIntent of this customer', async () => {
    h.stripe.setupIntents.retrieve.mockResolvedValueOnce({ status: 'succeeded', customer: 'cus_OTHER', payment_method: 'pm_z' })
    const { finishCardSetup } = await import('../app/_lib/billing-manage')
    await expect(finishCardSetup(h.stripe, 'cus_1', 'seti_1', true)).rejects.toMatchObject({ code: 'not_saved' })
    expect(h.stripe.customers.update).not.toHaveBeenCalled()
  })

  it('late payment: the new card pays the open bill at once; a bank check comes back to the pop-up', async () => {
    h.stripe.subscriptions.list.mockResolvedValue({ data: [sub('sub_1', 'past_due', 'price_pro', { latest_invoice: 'in_late' })] })
    const { finishCardSetup } = await import('../app/_lib/billing-manage')
    expect((await finishCardSetup(h.stripe, 'cus_1', 'seti_1', true)).retry).toEqual({ status: 'paid' })
    expect(h.stripe.invoices.pay).toHaveBeenCalledWith('in_late', { payment_method: 'pm_new' })
    h.stripe.invoices.pay.mockRejectedValueOnce(Object.assign(new Error('requires action'), { code: 'invoice_payment_intent_requires_action' }))
    h.stripe.invoicePayments.list.mockResolvedValue({ data: [{ payment: { payment_intent: { status: 'requires_action', client_secret: 'pi_late_secret' } } }] })
    expect((await finishCardSetup(h.stripe, 'cus_1', 'seti_1', true)).retry).toEqual({ status: 'requires_action', clientSecret: 'pi_late_secret' })
  })

  it('the manage route never trusts a card id from the browser for paying a late bill', async () => {
    const { POST } = await import('../app/api/billing/manage/route')
    const res = await POST(post('/api/billing/manage', { action: 'retry_payment', cardId: 'pm_someone_elses' }))
    expect(res.status).toBe(404)
    expect(h.stripe.invoices.pay).not.toHaveBeenCalled()
  })

  it('signed out → 401; no customer → plain refusal, Stripe untouched', async () => {
    const { GET, POST } = await import('../app/api/billing/manage/route')
    h.user = null
    expect((await GET()).status).toBe(401)
    h.user = { id: 'u1', email: 'buyer@x.com' }
    h.db.tables.profiles[0].stripe_customer_id = null
    expect((await json(await GET()))).toMatchObject({ hasCustomer: false })
    const res = await POST(post('/api/billing/manage', { action: 'cancel' }))
    expect(res.status).toBe(409)
    expect(h.stripe.subscriptions.list).not.toHaveBeenCalled()
  })
})

// ═══ 7. TRIAL CARD STEP ═══════════════════════════════════════════════════
describe('trial card step (Payment Element)', () => {
  it('the SetupIntent lets Stripe pick the methods (no payment_method_types)', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_x')
    const { POST } = await import('../app/api/create-setup-intent/route')
    const body = await json(await POST())
    expect(body).toEqual({ clientSecret: 'seti_1_secret' })
    expect(h.stripe.setupIntents.create).toHaveBeenCalledWith({ customer: 'cus_1', usage: 'off_session' })
  })

  it('a non-card method can’t start a free trial (one card, one trial needs the fingerprint)', async () => {
    h.db.tables.profiles[0] = { ...h.db.tables.profiles[0], card_on_file: false, subscription_status: 'free' }
    h.stripe.paymentMethods.retrieve.mockResolvedValue({ id: 'pm_new', type: 'link', customer: 'cus_1' })
    const { POST } = await import('../app/api/confirm-card/route')
    const res = await POST(post('/api/confirm-card', { setupIntentId: 'seti_1' }))
    expect(res.status).toBe(400)
    expect((await json(res)).code).toBe('card_only')
    expect(h.db.tables.profiles[0].card_on_file).toBe(false)
  })
})

// ═══ 8. WEBHOOK — fulfilment stays safe ═══════════════════════════════════
describe('webhook fulfilment for in-app checkouts', () => {
  const event = (id: string, type: string, object: Record<string, unknown>) =>
    new Request('http://localhost/api/webhooks/stripe', { method: 'POST', headers: { 'stripe-signature': 't=1,v1=x' }, body: JSON.stringify({ id, type, data: { object } }) })
  const pack = (payment_status: string) => ({ id: 'cs_pack', customer: 'cus_1', payment_status, metadata: { type: 'credit_pack', pack: 'power', credits: '7500', supabase_user_id: 'u1' } })

  it('a pack completed but NOT yet paid grants nothing; the later async success grants once, keyed per session', async () => {
    const { POST } = await import('../app/api/webhooks/stripe/route')
    expect((await POST(event('evt_1', 'checkout.session.completed', pack('unpaid')))).status).toBe(200)
    expect(h.topup).not.toHaveBeenCalled()
    expect((await POST(event('evt_2', 'checkout.session.async_payment_succeeded', pack('paid')))).status).toBe(200)
    expect(h.topup).toHaveBeenCalledTimes(1)
    expect(h.topup.mock.calls[0]).toEqual(['u1', 7500, 'power', { idempotencyKey: 'pack:cs_pack' }])
  })

  it('the same event delivered twice is processed once', async () => {
    const { POST } = await import('../app/api/webhooks/stripe/route')
    await POST(event('evt_dup', 'checkout.session.completed', pack('paid')))
    const again = await POST(event('evt_dup', 'checkout.session.completed', pack('paid')))
    expect(await json(again)).toMatchObject({ duplicate: true })
    expect(h.topup).toHaveBeenCalledTimes(1)
  })

  it('an unpaid add-on checkout does not switch the add-on on', async () => {
    const { POST } = await import('../app/api/webhooks/stripe/route')
    await POST(event('evt_s', 'checkout.session.completed', { id: 'cs_s', customer: 'cus_1', payment_status: 'unpaid', metadata: { type: 'social_addon', supabase_user_id: 'u1' } }))
    expect(h.db.tables.profiles[0].social_addon_active).toBe(false)
    await POST(event('evt_s2', 'checkout.session.async_payment_succeeded', { id: 'cs_s', customer: 'cus_1', payment_status: 'paid', metadata: { type: 'social_addon', supabase_user_id: 'u1' } }))
    expect(h.db.tables.profiles[0].social_addon_active).toBe(true)
  })

  it('a paid in-app subscription checkout starts the plan with a fresh credit cycle', async () => {
    h.stripe.checkout.sessions.retrieve.mockResolvedValue({ discounts: [], total_details: {} })
    const { POST } = await import('../app/api/webhooks/stripe/route')
    await POST(event('evt_p', 'checkout.session.completed', { id: 'cs_p', customer: 'cus_1', subscription: 'sub_new', payment_status: 'paid', metadata: { type: 'subscription', tier: 'pro', supabase_user_id: 'u1' } }))
    expect(h.db.tables.profiles[0]).toMatchObject({ subscription_status: 'pro', stripe_subscription_id: 'sub_new', card_on_file: true })
    expect(h.grant).toHaveBeenCalledWith('u1', 'pro', { forceNewCycle: true })
  })
})

// ═══ 9. NO STRIPE PAGE ANYWHERE ═══════════════════════════════════════════
describe('no redirect to a Stripe-hosted page is left (checked in the source)', () => {
  const ROOT = path.resolve(__dirname, '..')
  const files: string[] = []
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = path.join(d, n)
      if (statSync(p).isDirectory()) { if (n !== 'node_modules') walk(p) } else if (/\.(ts|tsx)$/.test(n)) files.push(p)
    }
  }
  walk(path.join(ROOT, 'app'))
  const rel = (p: string) => path.relative(ROOT, p).replace(/\\/g, '/')
  const src = (p: string) => readFileSync(p, 'utf8')

  it('no billing-portal session, no success_url checkout, no fixed payment methods (Apex’s own embedded checkout is the one exception)', () => {
    const offenders: string[] = []
    for (const f of files) {
      const s = src(f)
      if (/billingPortal\.sessions\.create/.test(s)) offenders.push(`${rel(f)}: billing portal`)
      if (/success_url\s*:/.test(s) && rel(f) !== 'app/api/checkout/create/route.ts') offenders.push(`${rel(f)}: success_url`)
      if (/payment_method_types\s*:/.test(s)) offenders.push(`${rel(f)}: payment_method_types`)
      if (/hosted_invoice_url/.test(s)) offenders.push(`${rel(f)}: hosted invoice link`)
    }
    expect(offenders).toEqual([])
  })

  it('the checker can fail: it spots a planted portal call and a hosted checkout', () => {
    const planted = "await stripe.billingPortal.sessions.create({ customer }); const p = { success_url: 'x', payment_method_types: ['card'] }"
    expect(/billingPortal\.sessions\.create/.test(planted)).toBe(true)
    expect(/success_url\s*:/.test(planted)).toBe(true)
    expect(/payment_method_types\s*:/.test(planted)).toBe(true)
  })

  it('no page follows a Stripe address from a payment route', () => {
    const offenders = files.filter((f) => /window\.location\.href\s*=\s*(data|d|json)\.url/.test(src(f))).map(rel)
    expect(offenders).toEqual([])
  })

  it('the dead pay-per-project checkout is gone; the portal route only points to in-app Billing', () => {
    expect(existsSync(path.join(ROOT, 'app/api/pay-project/route.ts'))).toBe(false)
    expect(src(path.join(ROOT, 'app/api/stripe/portal/route.ts'))).not.toMatch(/stripe\./)
  })

  it('payment pop-ups are non-modal so the bank’s security check can be clicked', () => {
    for (const f of ['app/_components/billing/InlineCheckout.tsx', 'app/_components/billing/CardDialog.tsx']) {
      expect(src(path.join(ROOT, f))).toMatch(/modal=\{false\}/)
    }
  })
})
