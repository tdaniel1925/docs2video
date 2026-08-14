import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { stripe, SUBSCRIPTION_PRICES } from '../../_lib/stripe'
import type { PlanTier } from '../../_lib/pricing'

export const maxDuration = 30

// The trial subscription is created with a long trial and CANCELLED early (we set
// trial_end:'now') the moment the user's free credits hit zero — that's when the
// first real charge fires. 365 days is just a "far enough out" backstop.
const TRIAL_DAYS = 365
const PAID_TIERS: PlanTier[] = ['starter', 'pro', 'business', 'enterprise']

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as { customerId?: string; plan?: string }
  const plan = (body.plan || '').toLowerCase() as PlanTier
  const admin = createAdminClient()

  // Mark card on file + remember the plan the user chose to convert to.
  const { error } = await admin.from('profiles').update({
    card_on_file: true,
    free_videos_remaining: 5,
    selected_plan: PAID_TIERS.includes(plan) ? plan : null,
    // Stay on the trial tier (free allotment) until the first real charge succeeds.
    subscription_status: 'trial',
  }).eq('id', user.id)
  if (error) { console.error('[confirm-card] profile update failed:', error); return NextResponse.json({ error: 'Could not save your selection.' }, { status: 500 }) }

  // If they picked a paid plan, create a Stripe subscription NOW with a long trial
  // on the saved card. No charge happens until we end the trial (on credit
  // depletion). Stripe then handles the charge, retries, and dunning natively.
  if (PAID_TIERS.includes(plan)) {
    try {
      const { data: profile } = await admin
        .from('profiles')
        .select('stripe_customer_id, stripe_subscription_id')
        .eq('id', user.id)
        .single()
      const customerId = body.customerId || profile?.stripe_customer_id
      const priceId = SUBSCRIPTION_PRICES[plan as Exclude<PlanTier, 'free'>]

      if (customerId && priceId && !profile?.stripe_subscription_id) {
        // Make the just-saved card the customer's default so the subscription
        // bills it when the trial ends.
        const pms = await stripe.paymentMethods.list({ customer: customerId, type: 'card', limit: 1 })
        const defaultPm = pms.data[0]?.id
        if (defaultPm) {
          await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: defaultPm } })
        }

        const sub = await stripe.subscriptions.create({
          customer: customerId,
          items: [{ price: priceId }],
          trial_period_days: TRIAL_DAYS,
          // If the card later fails at trial end, cancel rather than leave an
          // unpaid sub hanging (the webhook also flips them to past_due).
          trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
          ...(defaultPm ? { default_payment_method: defaultPm } : {}),
          metadata: { supabase_user_id: user.id, tier: plan, trial: 'true' },
        })
        await admin.from('profiles').update({ stripe_subscription_id: sub.id }).eq('id', user.id)
      }
    } catch (err) {
      // A subscription-create failure must NOT block the trial — the card is saved
      // and they have credits; we just log it (they can still subscribe later).
      console.error('[confirm-card] trial subscription create failed:', err instanceof Error ? err.message : err)
    }
  }

  return NextResponse.json({ success: true })
}
