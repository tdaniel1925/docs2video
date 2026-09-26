import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { stripe } from '../../_lib/stripe'
export const maxDuration = 30

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe is not configured' }, { status: 500 })
  }

  const admin = createAdminClient()

  try {
    // Get existing profile to check for existing Stripe customer
    const { data: profile } = await admin
      .from('profiles')
      .select('stripe_customer_id, email, full_name')
      .eq('id', user.id)
      .single()

    let customerId = profile?.stripe_customer_id

    // Create Stripe customer if none exists
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile?.email ?? user.email ?? undefined,
        name: profile?.full_name ?? undefined,
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id

      // Save customer ID to profile immediately
      await admin.from('profiles').update({
        stripe_customer_id: customerId,
      }).eq('id', user.id)
    }

    // Create SetupIntent (collects card without charging)
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
    })

    // No customer id in the reply: /api/confirm-card reads the customer from
    // the user's own profile and must never trust one from the browser.
    return NextResponse.json({ clientSecret: setupIntent.client_secret })
  } catch (err) {
    // Raw Stripe detail stays in the log; the user gets a plain sentence.
    console.error('[create-setup-intent] Error:', err)
    return NextResponse.json({ error: 'We could not open the secure card form just now. Please refresh and try again.' }, { status: 500 })
  }
}
