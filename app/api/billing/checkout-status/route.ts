import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { getStripe } from '../../../_lib/stripe'
import { checkoutFulfilment } from '../../../_lib/billing-manage'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * GET /api/billing/checkout-status?session_id=cs_…
 * The in-app payment pop-up asks this after Stripe says "paid", until the
 * purchase shows on the account (plan, pack credits or add-on). Only the
 * owner of the session may ask. Webhooks stay the source of truth; for credit
 * packs this also applies the grant with the SAME per-session key the webhook
 * and the reconcile cron use (`pack:{sessionId}`), so it's a no-op if the
 * webhook already did it and can never double-grant.
 */
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const sessionId = new URL(request.url).searchParams.get('session_id') || ''
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return NextResponse.json({ error: 'Unknown payment' }, { status: 400 })

  try {
    const result = await checkoutFulfilment(getStripe(), createAdminClient(), user.id, sessionId)
    if (!result) return NextResponse.json({ error: 'Unknown payment' }, { status: 404 })
    return NextResponse.json(result)
  } catch (err) {
    console.error('[billing/checkout-status] failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'We could not check that payment just now.' }, { status: 502 })
  }
}
