import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { stripe } from '../../_lib/stripe'
import { ensureStripeCustomer } from '../../_lib/stripe-customer'
export const maxDuration = 30

/**
 * POST /api/create-setup-intent — the trial card step (/setup-payment and the
 * "Add a card" pop-up for an account with no card yet). Saves a card in the
 * app with Stripe's Payment Element; nothing is charged. No
 * fixed list of payment methods: Stripe offers what the dashboard allows (cards,
 * Apple Pay, Google Pay …); /api/confirm-card then insists on a real card,
 * because the one-card-one-trial check needs the card's fingerprint.
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe is not configured' }, { status: 500 })
  }

  try {
    const customerId = await ensureStripeCustomer(createAdminClient(), stripe, { id: user.id, email: user.email })
    const setupIntent = await stripe.setupIntents.create({ customer: customerId, usage: 'off_session' })

    // No customer id in the reply: /api/confirm-card reads the customer from
    // the user's own profile and must never trust one from the browser.
    return NextResponse.json({ clientSecret: setupIntent.client_secret })
  } catch (err) {
    // Raw Stripe detail stays in the log; the user gets a plain sentence.
    console.error('[create-setup-intent] Error:', err)
    return NextResponse.json({ error: 'We could not open the secure card form just now. Please refresh and try again.' }, { status: 500 })
  }
}
