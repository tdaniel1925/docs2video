import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { getStripe, SUBSCRIPTION_PRICES } from '../../../_lib/stripe'
import type { PlanTier } from '../../../_lib/pricing'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * POST /api/stripe/checkout
 * Creates a Stripe Checkout session for a subscription.
 * Accepts { planId: 'starter' | 'pro' | 'business' | 'enterprise' }.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { planId } = (await request.json()) as { planId?: string }

  if (!planId || !['starter', 'pro', 'business', 'enterprise'].includes(planId)) {
    return NextResponse.json({ error: 'Invalid plan.' }, { status: 400 })
  }

  const priceId = SUBSCRIPTION_PRICES[planId as Exclude<PlanTier, 'free'>]
  if (!priceId) {
    return NextResponse.json({ error: 'Price not configured' }, { status: 500 })
  }

  // Look up existing customer
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  const origin = request.headers.get('origin') ?? 'https://docs2video.com'

  try {
    const stripe = getStripe()

    const sessionParams: Record<string, unknown> = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/dashboard?subscribed=${planId}`,
      cancel_url: `${origin}/settings?tab=subscription`,
      metadata: {
        supabase_user_id: user.id,
        type: 'subscription',
        tier: planId,
      },
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          tier: planId,
        },
      },
      // Let referred buyers enter an affiliate promo code at checkout.
      allow_promotion_codes: true,
    }

    if (profile?.stripe_customer_id) {
      sessionParams.customer = profile.stripe_customer_id
    } else {
      sessionParams.customer_email = user.email
    }

    let session
    try {
      session = await stripe.checkout.sessions.create(
        sessionParams as Parameters<typeof stripe.checkout.sessions.create>[0]
      )
    } catch (err) {
      // Self-heal stale customer IDs (e.g. test-mode leftovers): clear the
      // dead reference and retry with email so the purchase still succeeds
      if (err instanceof Error && err.message.includes('No such customer') && sessionParams.customer) {
        console.warn(`[checkout] Stale stripe_customer_id for user ${user.id} — clearing and retrying`)
        const { createAdminClient } = await import('../../../_lib/supabase/admin')
        await createAdminClient().from('profiles').update({ stripe_customer_id: null }).eq('id', user.id)
        delete sessionParams.customer
        sessionParams.customer_email = user.email
        session = await stripe.checkout.sessions.create(
          sessionParams as Parameters<typeof stripe.checkout.sessions.create>[0]
        )
      } else {
        throw err
      }
    }

    return NextResponse.json({ url: session.url })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
