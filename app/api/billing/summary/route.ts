import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { getStripe } from '../../../_lib/stripe'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * GET /api/billing/summary — READ ONLY. What the three cards at the top of
 * Settings → Billing & credits show: the balance split (monthly / packs),
 * how much of this period's credits were used, when the period started, and
 * (for a paid plan) when Stripe renews it. Changes nothing anywhere.
 *
 * The renew date is asked of Stripe (the subscription's current period end —
 * on the item in newer API versions). If Stripe can't be asked, renewsAt is
 * null and the card just leaves the date out.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createAdminClient()
  const [{ data: bal }, { data: profile }] = await Promise.all([
    admin.from('credit_balances')
      .select('balance, topup_balance, cycle_credits_used, cycle_credits_granted, cycle_start')
      .eq('user_id', user.id)
      .maybeSingle(),
    admin.from('profiles')
      .select('subscription_status, stripe_subscription_id')
      .eq('id', user.id)
      .single(),
  ])

  let renewsAt: string | null = null
  let cancelsAtPeriodEnd = false
  const subId = (profile as { stripe_subscription_id?: string | null } | null)?.stripe_subscription_id
  if (subId && process.env.STRIPE_SECRET_KEY) {
    try {
      const sub = await getStripe().subscriptions.retrieve(subId)
      if (['active', 'trialing', 'past_due'].includes(sub.status)) {
        const item = sub.items?.data?.[0] as unknown as { current_period_end?: number } | undefined
        const end = item?.current_period_end ?? (sub as unknown as { current_period_end?: number }).current_period_end ?? 0
        if (end) renewsAt = new Date(end * 1000).toISOString()
        cancelsAtPeriodEnd = !!sub.cancel_at_period_end
      }
    } catch (e) {
      console.warn('[billing/summary] could not read the subscription:', e instanceof Error ? e.message : e)
    }
  }

  return NextResponse.json({
    monthly: bal?.balance ?? 0,
    topup: bal?.topup_balance ?? 0,
    total: (bal?.balance ?? 0) + (bal?.topup_balance ?? 0),
    cycleUsed: bal?.cycle_credits_used ?? 0,
    cycleGranted: bal?.cycle_credits_granted ?? 0,
    cycleStart: bal?.cycle_start ?? null,
    renewsAt,
    cancelsAtPeriodEnd,
  })
}
