import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { startSubscription } from '../../_lib/subscription-checkout'
import { safeReturnOrigin } from '../../_lib/billing'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * POST /api/subscribe  { tier }
 * Settings-page door to the same subscription flow as /api/stripe/checkout.
 * It used to open a brand-new Checkout subscription every time — a user who
 * clicked "Switch to Business" ended up billed for two plans (audit C3). Now
 * it shares startSubscription, which changes an existing plan in place.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { tier } = (await request.json().catch(() => ({}))) as { tier?: string }
  const result = await startSubscription({
    userId: user.id,
    email: user.email,
    planId: tier,
    origin: safeReturnOrigin(request),
  })
  return NextResponse.json(result.body, { status: result.status })
}
