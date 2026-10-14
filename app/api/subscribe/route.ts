import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { startSubscription } from '../../_lib/subscription-checkout'
import { safeReturnOrigin } from '../../_lib/billing'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * POST /api/subscribe  { tier, promo? }
 * Second door to the same in-app subscription flow as /api/stripe/checkout.
 * It used to open a brand-new Checkout subscription every time — a user who
 * clicked "Switch to Business" ended up billed for two plans (audit C3). Now
 * it shares startSubscription: { clientSecret } for a new plan paid in the
 * app, or { code: 'change_in_place' } for an existing one.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { tier, promo } = (await request.json().catch(() => ({}))) as { tier?: string; promo?: string }
  const result = await startSubscription({
    userId: user.id,
    email: user.email,
    planId: tier,
    promo,
    origin: safeReturnOrigin(request),
  })
  return NextResponse.json(result.body, { status: result.status })
}
