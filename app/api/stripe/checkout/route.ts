import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { startSubscription } from '../../../_lib/subscription-checkout'
import { safeReturnOrigin } from '../../../_lib/billing'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * POST /api/stripe/checkout
 * Start a subscription, or change the plan of an existing one.
 * Accepts { planId: 'pro' | 'business' | 'enterprise', promo? }. (Starter $29 retired.)
 *
 * An existing subscriber is NEVER given a second subscription (audit C3): an
 * active plan is changed in place, payment trouble goes to the billing portal,
 * and a card-on-file trial is replaced (the webhook cancels it). All of that
 * lives in startSubscription, shared with /api/subscribe.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { planId, promo } = (await request.json().catch(() => ({}))) as { planId?: string; promo?: string }
  const result = await startSubscription({
    userId: user.id,
    email: user.email,
    planId,
    promo,
    origin: safeReturnOrigin(request),
  })
  return NextResponse.json(result.body, { status: result.status })
}
