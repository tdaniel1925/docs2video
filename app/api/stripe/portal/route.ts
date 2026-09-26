import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { getStripe } from '../../../_lib/stripe'
import { safeReturnOrigin } from '../../../_lib/billing'

export const runtime = 'nodejs'
export const maxDuration = 30

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
    return NextResponse.json({ error: 'No active subscription found' }, { status: 400 })
  }

  try {
    const stripe = getStripe()
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${safeReturnOrigin(request)}/settings?tab=subscription`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err: unknown) {
    // Raw Stripe detail stays in the log; the user gets a plain sentence.
    console.error('[stripe/portal] could not open billing portal:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'We could not open billing just now. Please try again in a minute.' }, { status: 500 })
  }
}
