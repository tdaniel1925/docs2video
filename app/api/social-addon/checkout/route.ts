import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { getStripe } from '../../../_lib/stripe'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * POST /api/social-addon/checkout
 * Starts a Stripe Checkout for the $50/mo AI Social add-on (a separate
 * subscription from the user's main plan). The webhook flips
 * profiles.social_addon_active on completion / off on cancellation.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const priceId = process.env.STRIPE_PRICE_ADDON_SOCIAL
  if (!priceId) return NextResponse.json({ error: 'Social add-on price not configured' }, { status: 500 })

  const { data: profile } = await supabase
    .from('profiles').select('stripe_customer_id, social_addon_active').eq('id', user.id).single()
  if (profile?.social_addon_active) {
    return NextResponse.json({ error: 'The Social add-on is already active.' }, { status: 400 })
  }

  const origin = request.headers.get('origin') ?? 'https://docs2video.com'
  try {
    const stripe = getStripe()
    const params: Record<string, unknown> = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/settings?tab=social&addon=active`,
      cancel_url: `${origin}/settings?tab=social`,
      metadata: { supabase_user_id: user.id, type: 'social_addon' },
      subscription_data: { metadata: { supabase_user_id: user.id, type: 'social_addon' } },
    }
    if (profile?.stripe_customer_id) params.customer = profile.stripe_customer_id
    else params.customer_email = user.email

    const session = await stripe.checkout.sessions.create(
      params as Parameters<typeof stripe.checkout.sessions.create>[0]
    )
    return NextResponse.json({ url: session.url })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Checkout failed' }, { status: 500 })
  }
}
