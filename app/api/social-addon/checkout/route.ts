import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { getStripe } from '../../../_lib/stripe'
import { safeReturnOrigin } from '../../../_lib/billing'
import { ensureStripeCustomer, inlineSessionBase } from '../../../_lib/stripe-customer'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * POST /api/social-addon/checkout
 * Opens an IN-APP payment (2026-10-14) for the $50/mo AI Social add-on — a
 * separate subscription from the user's main plan. Returns the client secret
 * of a Checkout Session in ui_mode 'elements'; the pop-up pays with Stripe's
 * Payment Element without leaving the app. The webhook still flips
 * profiles.social_addon_active on payment / off on cancellation.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const priceId = (process.env.STRIPE_PRICE_ADDON_SOCIAL || '').trim()
  if (!priceId) return NextResponse.json({ error: 'Social add-on price not configured' }, { status: 500 })

  const { data: profile } = await supabase
    .from('profiles').select('social_addon_active').eq('id', user.id).single()
  if (profile?.social_addon_active) {
    return NextResponse.json({ error: 'The Social add-on is already active.' }, { status: 400 })
  }

  const origin = safeReturnOrigin(request)
  try {
    const stripe = getStripe()
    const customerId = await ensureStripeCustomer(createAdminClient(), stripe, { id: user.id, email: user.email })
    const session = await stripe.checkout.sessions.create({
      ...inlineSessionBase(origin),
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { supabase_user_id: user.id, type: 'social_addon' },
      subscription_data: { metadata: { supabase_user_id: user.id, type: 'social_addon' } },
    } as Stripe.Checkout.SessionCreateParams)
    if (!session.client_secret) throw new Error('Stripe returned no client secret')
    return NextResponse.json({ clientSecret: session.client_secret, sessionId: session.id })
  } catch (err) {
    // Raw Stripe detail stays in the log; the user gets a plain sentence.
    console.error('[social-addon/checkout] could not start checkout:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'We could not open the payment form just now. Please try again in a minute.' }, { status: 500 })
  }
}
