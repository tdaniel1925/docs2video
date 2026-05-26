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

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      customerId,
    })
  } catch (err) {
    console.error('[create-setup-intent] Error:', err)
    const message = err instanceof Error ? err.message : 'Failed to create setup intent'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
