/**
 * Create the three credit-pack products + prices in Stripe and print the
 * env var lines to paste into Vercel. Idempotent-ish: skips creating a pack
 * if a product with the same credit-pack metadata already exists.
 *
 * Uses whatever mode STRIPE_SECRET_KEY points to (test vs live) — run it once
 * per mode. Per project rule: create Stripe products via API, never the dashboard.
 *
 * Run: npx tsx scripts/setup-credit-packs.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import Stripe from 'stripe'

const key = process.env.STRIPE_SECRET_KEY
if (!key) {
  console.error('STRIPE_SECRET_KEY is not set in .env.local')
  process.exit(1)
}
const stripe = new Stripe(key)
const mode = key.startsWith('sk_live') ? 'LIVE' : 'TEST'

// pack key here MUST match the keys in app/api/credits/buy/route.ts CREDIT_PACKS
// and the env var names buy/route.ts reads (STRIPE_PRICE_CREDIT_PACK_<credits>).
const PACKS = [
  { key: 'starter', name: 'Starter Credit Pack', credits: 2500, priceCents: 1000, env: 'STRIPE_PRICE_CREDIT_PACK_2500' },
  { key: 'power',   name: 'Power Credit Pack',   credits: 7500, priceCents: 2500, env: 'STRIPE_PRICE_CREDIT_PACK_7500' },
  { key: 'studio',  name: 'Studio Credit Pack',  credits: 18000, priceCents: 5000, env: 'STRIPE_PRICE_CREDIT_PACK_18000' },
]

async function findExisting(credits: number): Promise<{ productId: string; priceId: string } | null> {
  // Look for a product we previously created (metadata.type = credit_pack).
  const products = await stripe.products.search({
    query: `metadata['type']:'credit_pack' AND metadata['credits']:'${credits}'`,
    limit: 1,
  }).catch(() => null)
  const product = products?.data?.[0]
  if (!product) return null
  // Find an active price on it.
  const prices = await stripe.prices.list({ product: product.id, active: true, limit: 1 })
  const price = prices.data[0]
  if (!price) return null
  return { productId: product.id, priceId: price.id }
}

async function main() {
  console.log(`Creating credit packs in Stripe [${mode} mode]...\n`)
  const envLines: string[] = []

  for (const pack of PACKS) {
    const existing = await findExisting(pack.credits)
    if (existing) {
      console.log(`• ${pack.name}: already exists (price ${existing.priceId}) — reusing`)
      envLines.push(`${pack.env}=${existing.priceId}`)
      continue
    }

    const product = await stripe.products.create({
      name: pack.name,
      description: `${pack.credits.toLocaleString()} credits for Docs2Video. Credits never expire.`,
      metadata: { type: 'credit_pack', credits: String(pack.credits), pack_key: pack.key },
    })
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: pack.priceCents,
      currency: 'usd',
      metadata: { type: 'credit_pack', credits: String(pack.credits) },
    })
    console.log(`✓ ${pack.name}: $${(pack.priceCents / 100).toFixed(0)} for ${pack.credits.toLocaleString()} credits → ${price.id}`)
    envLines.push(`${pack.env}=${price.id}`)
  }

  console.log(`\n=== Add these to Vercel (${mode} env) ===\n`)
  console.log(envLines.join('\n'))
  console.log('')
}

main().catch((e) => { console.error(e); process.exit(1) })
