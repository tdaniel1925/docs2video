import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { isAdmin } from '../../../_lib/admin'
import { getStripe } from '../../../_lib/stripe'

export async function POST() {
  // Admin only
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const stripe = getStripe()
  const results: Record<string, string> = {}

  try {
    // 1. Create Credit Pack products + prices
    const packs = [
      { name: 'Starter Credit Pack', credits: 2500, price: 1000 },  // $10
      { name: 'Power Credit Pack', credits: 7500, price: 2500 },    // $25
      { name: 'Studio Credit Pack', credits: 18000, price: 5000 },  // $50
    ]

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

    // 2. Create metered overage price (usage-based billing)
    // This gets added to subscriptions as a metered component
    const overageProduct = await stripe.products.create({
      name: 'Credit Overage',
      description: 'Additional credits beyond monthly plan allocation',
      metadata: { type: 'credit_overage' },
    })

    const overagePrice = await stripe.prices.create({
      product: overageProduct.id,
      unit_amount: 1,
      currency: 'usd',
      recurring: { interval: 'month', usage_type: 'metered' },
    } as Parameters<typeof stripe.prices.create>[0])

    results['overage'] = `product: ${overageProduct.id}, price: ${overagePrice.id}`

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
