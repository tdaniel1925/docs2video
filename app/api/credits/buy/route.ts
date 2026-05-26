import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { getStripe } from '../../../_lib/stripe'
export const maxDuration = 30

const CREDIT_PACKS: Record<string, { credits: number; priceEnv: string }> = {
  starter: { credits: 2500, priceEnv: 'STRIPE_PRICE_CREDIT_PACK_2500' },
  power: { credits: 7500, priceEnv: 'STRIPE_PRICE_CREDIT_PACK_7500' },
  studio: { credits: 18000, priceEnv: 'STRIPE_PRICE_CREDIT_PACK_18000' },
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { pack } = await request.json() as { pack: string }
  const packInfo = CREDIT_PACKS[pack]
  if (!packInfo) return NextResponse.json({ error: 'Invalid pack' }, { status: 400 })

  const priceId = process.env[packInfo.priceEnv]
  if (!priceId) return NextResponse.json({ error: 'Credit packs not configured yet' }, { status: 500 })

  try {
    const stripe = getStripe()

    // Get or create Stripe customer
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    let customerId = profile?.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email!,
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id
      await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id)
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://docs2video.com'}/settings?credits=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://docs2video.com'}/pricing`,
      metadata: {
        type: 'credit_pack',
        pack,
        credits: String(packInfo.credits),
        user_id: user.id,
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[credits/buy] Error:', err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Failed to create checkout',
    }, { status: 500 })
  }
}
