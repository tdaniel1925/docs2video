import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// The prices in video minutes (plan-pricing.ts) never lose money, and NOTHING
// changes until the owner turns them on (NEXT_PUBLIC_D2V_MINUTES_PRICING=on):
// the plans, packs, video price and Stripe prices are exactly as before.
// Each block loads the modules fresh, because the plan lists are fixed when a
// module loads (as Next fixes NEXT_PUBLIC_ values at build).

const OLD_PRO = 'price_old_pro_79'
const NEW_PRO = 'price_new_pro_129'
const OLD_BIZ = 'price_old_business_199'
const NEW_BIZ = 'price_new_business_299'

async function load(on: boolean) {
  vi.resetModules()
  vi.stubEnv('NEXT_PUBLIC_D2V_MINUTES_PRICING', on ? 'on' : '')
  vi.stubEnv('EXPLAINER_ENGINE', 'on')
  for (const [k, v] of Object.entries({ RENDER_BUCKET: 'b', RENDER_SUBNETS: 's1,s2', RENDER_SECURITY_GROUP: 'sg', RENDER_AWS_ACCESS_KEY_ID: 'k', RENDER_AWS_SECRET_ACCESS_KEY: 's' })) vi.stubEnv(k, v)
  vi.stubEnv('STRIPE_PRICE_PRO', OLD_PRO)
  vi.stubEnv('STRIPE_PRICE_PRO_129', NEW_PRO)
  vi.stubEnv('STRIPE_PRICE_BUSINESS', OLD_BIZ)
  vi.stubEnv('STRIPE_PRICE_BUSINESS_299', NEW_BIZ)
  return {
    pp: await import('../app/_lib/plan-pricing'),
    pricing: await import('../app/_lib/pricing'),
    credits: await import('../app/_lib/credits'),
    packs: await import('../app/_lib/credit-packs'),
    ex: await import('../app/_lib/explainer-price'),
    stripe: await import('../app/_lib/stripe'),
    quote: await import('../app/_lib/price-quote'),
    len: await import('../app/_lib/length-limits'),
  }
}

beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}) })
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })

describe('switch OFF (the default): exactly as before', () => {
  it('plans, free start, packs, video price and Stripe prices are unchanged', async () => {
    const m = await load(false)
    expect(m.pp.minutesPricingOn()).toBe(false)
    expect(m.pricing.getPlan('pro').monthlyPrice).toBe(7900)
    expect(m.pricing.getPlan('business').monthlyPrice).toBe(19900)
    expect(m.pricing.getPlan('free').label).toBe('Pay As You Go')
    expect([...m.pricing.SELLABLE_PLAN_TIERS]).toEqual(['pro', 'business', 'enterprise'])
    expect(m.credits.TIER_CREDITS.free).toBe(2000)
    expect(m.credits.TIER_CREDITS.pro).toBe(25000)
    expect(m.packs.CREDIT_PACKS.map((p) => p.credits)).toEqual([2500, 7500, 18000])
    expect(m.ex.explainerCredits(7, 350)).toBe(1400 + 7 * 320 + 350 * 3)
    expect(m.stripe.SUBSCRIPTION_PRICES.pro).toBe(OLD_PRO)
    expect(m.stripe.SUBSCRIPTION_PRICES.business).toBe(OLD_BIZ)
    expect(m.stripe.tierFromPriceId(OLD_PRO)).toBe('pro')
    expect(m.stripe.tierFromPriceId(NEW_PRO)).toBeNull() // not sold yet, so not a known plan
    expect(m.pp.amountLabel(5400)).toBe('5,400 credits')
    expect(m.pricing.planCardLines(m.pricing.getPlan('pro')).headline).toBe('25,000 credits / mo')
  })
})

describe('switch ON: video minutes', () => {
  it('counts narration at 150 words a minute, rounded up, at least 2; scenes at 4 a minute', async () => {
    const { pp } = await load(true)
    expect(pp.billedMinutes(1, 0)).toBe(2)
    expect(pp.billedMinutes(7, 180)).toBe(pp.MIN_BILLED_MINUTES)
    expect(pp.billedMinutes(7, 301)).toBe(3)
    expect(pp.billedMinutes(30, 3500)).toBe(24)
    expect(pp.billedMinutes(14, 30)).toBe(4)
    expect(pp.billedMinutes(30, 0)).toBe(8)
  })

  it('turns minutes into credits and back, and shows minutes', async () => {
    const { pp } = await load(true)
    expect(pp.minutesToCredits(20)).toBe(25000)
    expect(pp.creditsToMinutes(25000)).toBe(20)
    expect(pp.creditsToMinutes(15600)).toBe(12.4)
    expect(pp.formatMinutes(1)).toBe('1 minute')
    expect(pp.amountLabel(15600)).toBe('12.4 minutes')
    expect(pp.amountParts(2500)).toEqual({ value: '2', unit: 'minutes' })
  })

  it('an explainer is charged its minutes; the quote line says minutes', async () => {
    const { ex, quote, pp } = await load(true)
    expect(ex.explainerCredits(7, 350)).toBe(3 * pp.CREDITS_PER_MINUTE)
    const inputs = quote.videoPriceInputs({ output_type: 'video', draft_data: { scenes: [{ narration: 'one two three' }], detailLevel: 'standard' } })
    expect(quote.videoCreditCost(inputs, 'someone')).toBe(2 * pp.CREDITS_PER_MINUTE)
  })

  it('the grandfathered customer still pays half, in minutes too', async () => {
    const { quote, pp, credits } = await load(true)
    const [grandfathered] = [...credits.GRANDFATHERED_USER_IDS]
    expect(grandfathered).toBeTruthy()
    const inputs = quote.videoPriceInputs({ output_type: 'video', draft_data: { scenes: [{ narration: 'one two three' }], detailLevel: 'standard' } })
    expect(quote.videoCreditCost(inputs, grandfathered)).toBe(Math.round((2 * pp.CREDITS_PER_MINUTE) / 2))
  })

  it('Pro is $129 for 20 minutes; Free is the first video up to 2 minutes; Business stays off', async () => {
    const m = await load(true)
    expect(m.pp.PLAN_PRO.priceCents).toBe(12900)
    expect(m.pp.PLAN_PRO.minutes).toBe(20)
    expect(m.pp.PLAN_FREE.minutes).toBe(2)
    expect(m.credits.TIER_CREDITS.pro).toBe(m.pp.PLAN_PRO.credits)
    expect(m.credits.TIER_CREDITS.free).toBe(m.pp.PLAN_FREE.credits)
    expect(m.pricing.getPlan('pro').monthlyPrice).toBe(12900)
    expect([...m.pricing.SELLABLE_PLAN_TIERS]).toEqual(['pro'])
    expect(m.pp.EXTRA_MINUTE_CENTS).toBe(500)
    expect(m.pricing.planCardLines(m.pricing.getPlan('pro')).headline).toBe('20 minutes / mo')
  })

  it('Business is sold only when its own switch is on too', async () => {
    vi.stubEnv('NEXT_PUBLIC_D2V_BUSINESS_PLAN', 'on')
    const m = await load(true)
    expect([...m.pricing.SELLABLE_PLAN_TIERS]).toEqual(['pro', 'business'])
    expect(m.pricing.getPlan('business').monthlyPrice).toBe(29900)
  })

  it('every top-up pack sells minutes at $5 each', async () => {
    const { packs, pp } = await load(true)
    for (const p of packs.CREDIT_PACKS) expect((p.priceCents / p.credits) * pp.CREDITS_PER_MINUTE).toBe(pp.EXTRA_MINUTE_CENTS)
  })

  it('promises standalone decks only once they exist', async () => {
    const { pp } = await load(true)
    expect(/slide decks a month/.test(pp.planFeatures(pp.PLAN_PRO).join(' '))).toBe(pp.DECKS_LIVE)
  })

  it('new subscribers get the new prices; old $79 Pro and $199 Business subscribers keep resolving', async () => {
    const { stripe } = await load(true)
    expect(stripe.SUBSCRIPTION_PRICES.pro).toBe(NEW_PRO)
    expect(stripe.SUBSCRIPTION_PRICES.business).toBe(NEW_BIZ)
    expect(stripe.tierFromPriceId(NEW_PRO)).toBe('pro')
    expect(stripe.tierFromPriceId(OLD_PRO)).toBe('pro') // the existing customer's renewals
    expect(stripe.tierFromPriceId(OLD_BIZ)).toBe('business')
  })

  it('with the new Pro price not set, Pro cannot be bought rather than sold at $79', async () => {
    vi.stubEnv('STRIPE_PRICE_PRO_129', '')
    vi.resetModules()
    const { SUBSCRIPTION_PRICES } = await import('../app/_lib/stripe')
    expect(SUBSCRIPTION_PRICES.pro).toBeFalsy()
  })
})

describe('switch ON: never losing money', () => {
  it('a counted minute can cost at most $1.40 + $1.68 a minute', async () => {
    const { pp } = await load(true)
    for (let m = pp.MIN_BILLED_MINUTES; m <= 30; m++) expect(pp.worstCaseCostCents(m)).toBeCloseTo(140 + 168 * m, 6)
  })

  it('keeps at least half of the price for EVERY story size, on Pro, Business and extras', async () => {
    const { pp, ex, packs, len } = await load(true)
    const rates = {
      pro: pp.PLAN_PRO.priceCents / pp.PLAN_PRO.credits,
      business: pp.PLAN_BUSINESS.priceCents / pp.PLAN_BUSINESS.credits,
      extras: Math.min(...packs.CREDIT_PACKS.map((p) => p.priceCents / p.credits)),
    }
    const maxScenes = Math.max(...Object.values(len.LENGTH_LIMITS).map((l) => l.maxScenes))
    const maxWords = Math.max(...Object.values(len.LENGTH_LIMITS).map((l) => l.maxWords))
    let worst = 1
    for (let scenes = 1; scenes <= maxScenes; scenes++) {
      for (let words = 0; words <= maxWords; words += 10) {
        const credits = ex.explainerCredits(scenes, words)
        const cost = pp.explainerCostCents(scenes, words)
        for (const rate of Object.values(rates)) {
          const margin = 1 - cost / (credits * rate)
          worst = Math.min(worst, margin)
          expect(margin).toBeGreaterThanOrEqual(0.5)
        }
      }
    }
    expect(worst).toBeLessThan(0.6) // the check really reaches the worst case
  })

  it('a whole month of worst-case videos still keeps half', async () => {
    const { pp } = await load(true)
    const proCost = (pp.PLAN_PRO.minutes / pp.MIN_BILLED_MINUTES) * pp.worstCaseCostCents(pp.MIN_BILLED_MINUTES)
    expect(1 - proCost / pp.PLAN_PRO.priceCents).toBeGreaterThanOrEqual(0.6)
    const bizCost = (pp.PLAN_BUSINESS.minutes / pp.MIN_BILLED_MINUTES) * pp.worstCaseCostCents(pp.MIN_BILLED_MINUTES)
    expect(1 - bizCost / pp.PLAN_BUSINESS.priceCents).toBeGreaterThanOrEqual(0.5)
    expect(1 - pp.worstCaseCostCents(pp.MIN_BILLED_MINUTES) / (pp.MIN_BILLED_MINUTES * pp.EXTRA_MINUTE_CENTS)).toBeGreaterThanOrEqual(0.5)
  })
})
