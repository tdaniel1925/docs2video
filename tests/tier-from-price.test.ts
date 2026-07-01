import { describe, it, expect, beforeEach, vi } from 'vitest'

// tierFromPriceId maps a Stripe price id back to a plan tier. It must return
// null (fail-loud) for unknown ids — the historical bug silently downgraded a
// paying customer to 'free' when a STRIPE_PRICE_* env was misconfigured.
// SUBSCRIPTION_PRICES is built from env at module load, so stub env and
// re-import fresh per test.

async function loadWithEnv(env: Record<string, string>) {
  vi.resetModules()
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v)
  return await import('../app/_lib/stripe')
}

describe('tierFromPriceId', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it('resolves each configured tier by its price id', async () => {
    const { tierFromPriceId } = await loadWithEnv({
      STRIPE_PRICE_STARTER: 'price_starter_x',
      STRIPE_PRICE_PRO: 'price_pro_x',
      STRIPE_PRICE_BUSINESS: 'price_biz_x',
      STRIPE_PRICE_ENTERPRISE: 'price_ent_x',
    })
    expect(tierFromPriceId('price_starter_x')).toBe('starter')
    expect(tierFromPriceId('price_pro_x')).toBe('pro')
    expect(tierFromPriceId('price_biz_x')).toBe('business')
    expect(tierFromPriceId('price_ent_x')).toBe('enterprise')
  })

  it('returns null (never a silent tier) for an unknown price id', async () => {
    const { tierFromPriceId } = await loadWithEnv({
      STRIPE_PRICE_PRO: 'price_pro_x',
    })
    expect(tierFromPriceId('price_unknown')).toBeNull()
    // The social add-on price id must NEVER resolve to a plan tier (review B3).
    expect(tierFromPriceId('price_social_addon')).toBeNull()
  })

  it('does not match an unset (empty) env slot against an empty-string id', async () => {
    const { tierFromPriceId } = await loadWithEnv({ STRIPE_PRICE_PRO: 'price_pro_x' })
    expect(tierFromPriceId('')).toBeNull()
  })
})
