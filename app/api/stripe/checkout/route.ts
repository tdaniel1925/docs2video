import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { stripe, PLANS, PACKS } from '../../../_lib/stripe'
import type { PlanId } from '../../../_lib/stripe'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { priceId, planId, packId } = (await request.json()) as {
    priceId?: string
    planId?: string
    packId?: string
  }

  const origin = request.headers.get('origin') ?? 'https://docs2video.com'

  try {
    // Credit pack purchase (one-time payment)
    if (packId) {
      const pack = PACKS.find(p => p.id === packId)
      if (!pack) return NextResponse.json({ error: 'Invalid pack' }, { status: 400 })

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: { name: `${pack.name} Credits` },
            unit_amount: pack.price,
          },
          quantity: 1,
        }],
        success_url: `${origin}/settings?tab=subscription&credits_added=${pack.count}`,
        cancel_url: `${origin}/settings?tab=subscription`,
        metadata: {
          supabase_user_id: user.id,
          type: 'credit_pack',
          credit_count: String(pack.count),
        },
        customer_email: user.email,
      })

      return NextResponse.json({ url: session.url })
    }

    // Subscription purchase/upgrade
    const resolvedPriceId = planId
      ? PLANS[planId as PlanId]?.priceId
      : priceId

    if (!resolvedPriceId) {
      return NextResponse.json({ error: 'Missing or invalid plan' }, { status: 400 })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: resolvedPriceId, quantity: 1 }],
      success_url: `${origin}/settings?tab=subscription&upgraded=true`,
      cancel_url: `${origin}/settings?tab=subscription`,
      metadata: {
        supabase_user_id: user.id,
        type: 'subscription',
        plan_id: planId ?? '',
      },
      customer_email: user.email,
    })

    return NextResponse.json({ url: session.url })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
