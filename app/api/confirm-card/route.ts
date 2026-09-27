import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { stripe, SUBSCRIPTION_PRICES } from '../../_lib/stripe'
import { isSellablePlan } from '../../_lib/pricing'
import { cardConfirmAction, listLiveMainSubscriptions } from '../../_lib/billing'

export const maxDuration = 30

// The trial subscription is created with a long trial and CANCELLED early (we set
// trial_end:'now') the moment the user's free credits run out — that's when the
// first real charge fires. 365 days is just a "far enough out" backstop.
const TRIAL_DAYS = 365

/**
 * POST /api/confirm-card  { setupIntentId?, plan? }
 *
 * Called by /setup-payment after Stripe saved the card. Audit C2: this used to
 * mark the card on file and grant the trial WITHOUT checking a card existed,
 * trusted a customerId from the browser (so a subscription could be put on
 * somebody else's saved card), reset paying customers to 'trial', and lifted
 * past_due/banned blocks. Now:
 *  - the customer comes ONLY from the user's own profile
 *  - Stripe must confirm a succeeded SetupIntent (or a saved card) on THAT
 *    customer before anything is granted
 *  - paying customers keep their plan; past_due/banned stay blocked
 *  - a trial subscription is only created when the customer has no live one
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as { setupIntentId?: string; plan?: string }
  const plan = (body.plan || '').toLowerCase()
  const admin = createAdminClient()

  const { data: profile, error: profErr } = await admin
    .from('profiles')
    .select('stripe_customer_id, stripe_subscription_id, subscription_status')
    .eq('id', user.id)
    .single()
  if (profErr || !profile) {
    console.error('[confirm-card] profile read failed:', profErr?.message)
    return NextResponse.json({ error: 'We could not find your account. Please try again.' }, { status: 500 })
  }

  const action = cardConfirmAction(profile.subscription_status)
  if (action === 'blocked') {
    return NextResponse.json({
      error: profile.subscription_status === 'past_due'
        ? 'Your last payment did not go through. Please update your card from Manage billing in Settings.'
        : 'This account cannot start a trial. Please contact support.',
    }, { status: 409 })
  }

  const customerId = profile.stripe_customer_id
  if (!customerId) {
    return NextResponse.json({ error: 'Please reload the page and enter your card again.' }, { status: 400 })
  }

  // ── Prove, with Stripe, that THIS user's customer really has a saved card.
  let paymentMethodId: string | null = null
  try {
    if (body.setupIntentId) {
      const si = await stripe.setupIntents.retrieve(body.setupIntentId)
      const siCustomer = typeof si.customer === 'string' ? si.customer : si.customer?.id
      if (si.status === 'succeeded' && siCustomer === customerId) {
        paymentMethodId = typeof si.payment_method === 'string' ? si.payment_method : si.payment_method?.id ?? null
      } else {
        console.warn(`[confirm-card] SetupIntent ${body.setupIntentId} rejected for user ${user.id}: status=${si.status} customerMatches=${siCustomer === customerId}`)
      }
    }
    if (!paymentMethodId) {
      // No (valid) SetupIntent id — accept a card already attached to the
      // user's OWN customer (e.g. a retry after a network blip).
      const pms = await stripe.paymentMethods.list({ customer: customerId, type: 'card', limit: 1 })
      paymentMethodId = pms.data[0]?.id ?? null
    }
  } catch (err) {
    console.error('[confirm-card] Stripe card check failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'We could not confirm your card just now. Please try again.' }, { status: 502 })
  }
  if (!paymentMethodId) {
    return NextResponse.json({ error: 'We could not find a saved card. Please enter your card again.' }, { status: 400 })
  }

  // ── Paying customer: note the card, change nothing else.
  if (action === 'keep_paid_plan') {
    const { error } = await admin.from('profiles').update({ card_on_file: true }).eq('id', user.id)
    if (error) console.error('[confirm-card] card_on_file update failed:', error.message)
    return NextResponse.json({ success: true, kept_plan: true })
  }

  // ── Free / trial account: the card on file starts the trial.
  const chosenPlan = isSellablePlan(plan) ? plan : null
  const { error } = await admin.from('profiles').update({
    card_on_file: true,
    free_videos_remaining: 5,
    selected_plan: chosenPlan,
    // Stay on the trial tier (free allotment) until the first real charge succeeds.
    subscription_status: 'trial',
  }).eq('id', user.id)
  if (error) {
    console.error('[confirm-card] profile update failed:', error)
    return NextResponse.json({ error: 'Could not save your selection.' }, { status: 500 })
  }

  // If they picked a paid plan, create a Stripe subscription NOW with a long trial
  // on the saved card. No charge happens until we end the trial (when the free
  // credits run out). Stripe then handles the charge, retries, and dunning.
  if (chosenPlan) {
    try {
      const priceId = SUBSCRIPTION_PRICES[chosenPlan]
      // Never a second subscription: skip if the customer already has any live
      // main-plan subscription (the profile id alone can be stale or missing).
      const live = await listLiveMainSubscriptions(stripe, customerId)
      if (priceId && live.length === 0) {
        // Make the just-saved card the customer's default so the subscription
        // bills it when the trial ends.
        await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: paymentMethodId } })

        const sub = await stripe.subscriptions.create({
          customer: customerId,
          items: [{ price: priceId }],
          trial_period_days: TRIAL_DAYS,
          // If the card later fails at trial end, cancel rather than leave an
          // unpaid sub hanging (the webhook also flips them to past_due).
          trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
          default_payment_method: paymentMethodId,
          metadata: { supabase_user_id: user.id, tier: chosenPlan, trial: 'true' },
        })
        await admin.from('profiles').update({ stripe_subscription_id: sub.id }).eq('id', user.id)
      } else if (live.length > 0) {
        console.log(`[confirm-card] user ${user.id} already has ${live.length} live subscription(s) — no trial subscription created`)
      }
    } catch (err) {
      // A subscription-create failure must NOT block the trial — the card is saved
      // and they have credits; we just log it (they can still subscribe later).
      console.error('[confirm-card] trial subscription create failed:', err instanceof Error ? err.message : err)
    }
  }

  return NextResponse.json({ success: true })
}
