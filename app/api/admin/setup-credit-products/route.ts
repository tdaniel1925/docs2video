import { NextResponse } from 'next/server'
import { requireAdmin } from '../../../_lib/admin'
import { getStripe } from '../../../_lib/stripe'
import { CREDIT_PACKS } from '../../../_lib/credit-packs'
export const maxDuration = 30

export async function POST() {
  // Admin only
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const stripe = getStripe()
  const results: Record<string, string> = {}

  try {
    // 1. Create Credit Pack products + prices — names, credits and prices from
    // the one pack list, so Stripe can't call the $10 pack "Starter" again
    // (renamed "Small" in Stripe on 2026-10-07; the retired plan was Starter).
    const packs = CREDIT_PACKS.map(p => ({ name: `${p.name} Credit Pack`, credits: p.credits, price: p.priceCents }))

    for (const pack of packs) {
      const product = await stripe.products.create({
        name: pack.name,
        description: `${pack.credits.toLocaleString()} credits for Docs2Video. Credits never expire.`,
        metadata: { type: 'credit_pack', credits: String(pack.credits) },
      })

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: pack.price,
        currency: 'usd',
      })

      results[`pack_${pack.credits}`] = `product: ${product.id}, price: ${price.id}`
    }

    // NOTE: Metered overage billing skipped — Stripe API v2025+ requires
    // Billing Meters which need manual setup in Stripe Dashboard.
    // For now, overages are handled via credit pack purchases.

    // Log all IDs for env var setup
    console.log('=== STRIPE CREDIT PRODUCTS CREATED ===')
    console.log(JSON.stringify(results, null, 2))
    console.log('')
    console.log('Add these to your .env / Vercel:')
    for (const [key, val] of Object.entries(results)) {
      const priceId = val.split('price: ')[1]
      console.log(`STRIPE_PRICE_CREDIT_${key.toUpperCase()}=${priceId}`)
    }

    return NextResponse.json({
      success: true,
      products: results,
      message: 'Credit products created in Stripe. Add the price IDs to your environment variables.',
    })
  } catch (err) {
    console.error('[setup-credit-products] Error:', err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Failed to create Stripe products',
    }, { status: 500 })
  }
}
