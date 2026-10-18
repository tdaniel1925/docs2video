import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { startSubscription } from '../../../_lib/subscription-checkout'
import { safeReturnOrigin } from '../../../_lib/billing'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * POST /api/stripe/checkout  { planId: 'pro' | 'business' | 'enterprise', promo? }
 * Opens an IN-APP payment for a new subscription (2026-10-14): the answer is
 * { clientSecret } for Stripe's Payment Element in our own pop-up — nobody is
 * sent to a Stripe page. (Starter $29 retired.)
 *
 * An existing subscriber is NEVER given a second subscription (audit C3): an
 * active plan answers { code: 'change_in_place' } and the pop-up shows the
 * in-app plan change with a proration preview; a late payment answers
 * { code: 'fix_payment' }; a card-on-file trial is replaced (the webhook
 * cancels it). All of that lives in startSubscription, shared with
 * /api/subscribe.
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
