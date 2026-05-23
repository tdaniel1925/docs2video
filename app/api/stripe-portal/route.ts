import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { getStripe } from '../../_lib/stripe'

export const runtime = 'nodejs'

/**
 * POST /api/stripe-portal
 * Creates a Stripe Billing Portal session so the user can manage their subscription.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ error: 'No Stripe customer found. Subscribe to a plan first.' }, { status: 400 })
  }

  try {
    const stripe = getStripe()
    const origin = request.headers.get('origin') ?? 'https://docs2video.com'

    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${origin}/settings?tab=subscription`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
