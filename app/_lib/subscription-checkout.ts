import { cookies } from 'next/headers'
import type Stripe from 'stripe'
import { getStripe, SUBSCRIPTION_PRICES } from './stripe'
import { createAdminClient } from './supabase/admin'
import { getAffiliateByCode } from './affiliate'
import { isSellablePlan, getPlan } from './pricing'
import { listLiveMainSubscriptions, decidePlanChange, autoPromoId } from './billing'
import { ensureStripeCustomer, inlineSessionBase } from './stripe-customer'

/**
 * The ONE way a signed-in user starts a subscription. Both /api/stripe/checkout
 * (pricing page, upgrade window, onboarding, Settings → Billing) and
 * /api/subscribe call this, so the "never a second subscription" rule (audit
 * C3) can't be skipped by picking the other door.
 *
 * INLINE (2026-10-14): nobody is sent to a Stripe page any more. The answer is
 * either
 *  - { clientSecret, sessionId } — an in-app Checkout Session (ui_mode
 *    'elements'); the browser shows Stripe's Payment Element in our own
 *    pop-up and pays there. Fulfilment is still the webhook
 *    (checkout.session.completed, gated on payment_status), unchanged.
 *  - { code: 'change_in_place' } (409) — they already pay for a plan: the
 *    browser shows the in-app "change plan" preview (/api/billing/manage),
 *    which changes the SAME subscription with a proration preview first.
 *  - { code: 'fix_payment' | 'contact_support' } (409) — a late payment or
 *    duplicate plans: nothing is sold until that's fixed.
 */
export async function startSubscription(opts: {
  userId: string
  email: string | null | undefined
  planId: string | null | undefined
  promo?: string | null
  origin: string
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const { userId, email, planId, origin } = opts

  // Starter is retired — only plans on the sellable list can be bought.
  if (!isSellablePlan(planId)) {
    return { status: 400, body: { error: 'That plan is not available. Please choose Pro, Business or Enterprise.' } }
  }
  const priceId = SUBSCRIPTION_PRICES[planId]
  if (!priceId) {
    console.error(`[subscription] STRIPE_PRICE_${planId.toUpperCase()} is not set`)
    return { status: 500, body: { error: 'Plans are not available right now. Please try again later.' } }
  }

  const admin = createAdminClient()
  const stripe = getStripe()
  let replacesTrial: string | null = null

  try {
    const customerId = await ensureStripeCustomer(admin, stripe, { id: userId, email })

    // ── Already subscribed? Change the plan instead of adding a subscription.
    const subs: Stripe.Subscription[] = await listLiveMainSubscriptions(stripe, customerId)
    const decision = decidePlanChange(subs, planId, priceId)
    switch (decision.kind) {
      case 'already_on_plan':
        return { status: 409, body: { error: `You're already on the ${getPlan(planId).label} plan.`, code: 'already_on_plan' } }
      case 'update_in_place':
        // The in-app plan-change step shows what they pay today first.
        return { status: 409, body: { code: 'change_in_place', plan: planId, direction: decision.direction } }
      case 'fix_first':
        console.warn(`[subscription] user ${userId} asked for ${planId} but must fix billing first (${decision.reason})`)
        return decision.reason === 'payment_issue'
          ? { status: 409, body: { code: 'fix_payment', error: 'Your last payment didn’t go through. Update your card first — then you can change your plan.' } }
          : { status: 409, body: { code: 'contact_support', error: 'Your account needs a quick check before the plan can change. Please contact support and we’ll sort it out.' } }
      case 'checkout_replacing_trial':
        replacesTrial = decision.trialSubscriptionId
        break
      case 'checkout':
        break
    }

    // ── New subscription, paid inside the app.
    const metadata: Record<string, string> = {
      supabase_user_id: userId,
      type: 'subscription',
      tier: planId,
      // The webhook cancels this trial the moment the paid subscription starts,
      // so it can never bill the card again later (audit C3).
      ...(replacesTrial ? { replaces_subscription: replacesTrial } : {}),
    }
    const sessionParams: Record<string, unknown> = {
      ...inlineSessionBase(origin),
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata,
      subscription_data: { metadata: { supabase_user_id: userId, tier: planId } },
    }

    // Affiliate attribution: if the buyer arrived via a referral link, the
    // d2v_ref cookie holds the code. Auto-apply that affiliate's Stripe promo
    // code (gives the buyer discount + attributes the sale). Stripe forbids
    // combining `discounts` with `allow_promotion_codes`, so we pick one.
    let appliedDiscount = false
    try {
      const refCode = (await cookies()).get('d2v_ref')?.value
      if (refCode) {
        const affiliate = await getAffiliateByCode(refCode)
        // Skip self-referral and inactive affiliates.
        if (affiliate && affiliate.status === 'active' && affiliate.user_id !== userId && affiliate.stripe_promo_code_id) {
          sessionParams.discounts = [{ promotion_code: affiliate.stripe_promo_code_id }]
          appliedDiscount = true
        }
      }
    } catch (e) {
      console.warn('[subscription] referral cookie handling failed (non-fatal):', e)
    }
    if (!appliedDiscount) {
      // A marketing promo from the upgrade email (?promo=CODE) auto-applies if
      // it's on the allowlist; otherwise the buyer may type a code in the
      // pop-up (the Payment Element form applies it with applyPromotionCode).
      const promoId = autoPromoId(opts.promo)
      if (promoId) sessionParams.discounts = [{ promotion_code: promoId }]
      else sessionParams.allow_promotion_codes = true
    }

    const create = () => stripe.checkout.sessions.create(sessionParams as unknown as Stripe.Checkout.SessionCreateParams)
    let session: Stripe.Checkout.Session
    try {
      session = await create()
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (/promotion.?code|coupon/i.test(msg) && sessionParams.discounts) {
        // A bad/expired promo must not block the purchase — let them in
        // without it (they can still type a code in the pop-up).
        console.warn(`[subscription] promo could not be applied for user ${userId} — retrying without it: ${msg}`)
        delete sessionParams.discounts
        sessionParams.allow_promotion_codes = true
        session = await create()
      } else {
        throw err
      }
    }

    if (!session.client_secret) throw new Error('Stripe returned no client secret')
    return {
      status: 200,
      body: { clientSecret: session.client_secret, sessionId: session.id, promoCodes: sessionParams.allow_promotion_codes === true },
    }
  } catch (err) {
    // The raw Stripe error goes to the log, never to the user.
    console.error(`[subscription] could not start ${planId} for user ${userId}:`, err instanceof Error ? err.message : err)
    return { status: 500, body: { error: 'We could not open the payment form just now. Please try again in a minute.' } }
  }
}
