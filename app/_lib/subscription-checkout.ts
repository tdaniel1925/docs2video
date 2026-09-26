import { cookies } from 'next/headers'
import type Stripe from 'stripe'
import { getStripe, SUBSCRIPTION_PRICES } from './stripe'
import { createAdminClient } from './supabase/admin'
import { getAffiliateByCode } from './affiliate'
import { isSellablePlan, getPlan } from './pricing'
import {
  listLiveMainSubscriptions, decidePlanChange, changePlanInPlace,
  autoPromoId, planChangeErrorMessage,
} from './billing'

/**
 * The ONE way a signed-in user starts or changes a subscription. Both
 * /api/stripe/checkout (pricing page, upgrade modal, onboarding) and
 * /api/subscribe (settings page) call this, so the "never a second
 * subscription" rule (audit C3) can't be skipped by picking the other door.
 *
 * Returns a JSON body + status. A body with `url` is always safe for the
 * browser to navigate to: Stripe Checkout, the Stripe billing portal, or our
 * own settings page after an in-place plan change.
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
  const { data: profile } = await admin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single()

  const stripe = getStripe()
  let customerId: string | null = profile?.stripe_customer_id ?? null
  let replacesTrial: string | null = null

  try {
    // ── Already subscribed? Change the plan instead of adding a subscription.
    if (customerId) {
      let subs: Stripe.Subscription[] = []
      try {
        subs = await listLiveMainSubscriptions(stripe, customerId)
      } catch (err) {
        // Self-heal stale customer ids (e.g. test-mode leftovers): forget the
        // dead reference so Checkout creates a fresh customer.
        if (err instanceof Error && err.message.includes('No such customer')) {
          console.warn(`[subscription] Stale stripe_customer_id for user ${userId} — clearing`)
          await admin.from('profiles').update({ stripe_customer_id: null }).eq('id', userId)
          customerId = null
        } else {
          throw err
        }
      }

      if (customerId) {
        const decision = decidePlanChange(subs, planId, priceId)
        switch (decision.kind) {
          case 'already_on_plan':
            return { status: 409, body: { error: `You're already on the ${getPlan(planId).label} plan.` } }

          case 'portal': {
            console.warn(`[subscription] user ${userId} sent to billing portal instead of a new subscription (${decision.reason})`)
            const portal = await stripe.billingPortal.sessions.create({
              customer: customerId,
              return_url: `${origin}/settings?tab=subscription`,
            })
            return { status: 200, body: { url: portal.url, portal: true, reason: decision.reason } }
          }

          case 'update_in_place': {
            try {
              await changePlanInPlace(stripe, decision, planId, priceId, userId)
            } catch (err) {
              console.error(`[subscription] in-place plan change failed for user ${userId}:`, err instanceof Error ? err.message : err)
              return { status: 402, body: { error: planChangeErrorMessage(err) } }
            }
            // The customer.subscription.updated webhook moves the profile to
            // the new tier and adds the credit difference on an upgrade.
            console.log(`[subscription] user ${userId} ${decision.direction}d ${decision.currentTier ?? '?'} → ${planId} in place (${decision.subscriptionId})`)
            return {
              status: 200,
              body: { url: `${origin}/settings?tab=subscription&plan_changed=${planId}`, switched: true, direction: decision.direction },
            }
          }

          case 'checkout_replacing_trial':
            replacesTrial = decision.trialSubscriptionId
            break

          case 'checkout':
            break
        }
      }
    }

    // ── New subscription through Stripe Checkout.
    const metadata: Record<string, string> = {
      supabase_user_id: userId,
      type: 'subscription',
      tier: planId,
      // The webhook cancels this trial the moment the paid subscription starts,
      // so it can never bill the card again later (audit C3).
      ...(replacesTrial ? { replaces_subscription: replacesTrial } : {}),
    }
    const sessionParams: Record<string, unknown> = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/dashboard?subscribed=${planId}`,
      cancel_url: `${origin}/settings?tab=subscription`,
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
      // it's on the allowlist; otherwise the buyer may type a code at Stripe.
      const promoId = autoPromoId(opts.promo)
      if (promoId) sessionParams.discounts = [{ promotion_code: promoId }]
      else sessionParams.allow_promotion_codes = true
    }

    if (customerId) sessionParams.customer = customerId
    else if (email) sessionParams.customer_email = email

    const create = () => stripe.checkout.sessions.create(sessionParams as unknown as Stripe.Checkout.SessionCreateParams)
    let session: Stripe.Checkout.Session
    try {
      session = await create()
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('No such customer') && sessionParams.customer) {
        console.warn(`[subscription] Stale stripe_customer_id for user ${userId} — clearing and retrying`)
        await admin.from('profiles').update({ stripe_customer_id: null }).eq('id', userId)
        delete sessionParams.customer
        if (email) sessionParams.customer_email = email
        session = await create()
      } else if (/promotion.?code|coupon/i.test(msg) && sessionParams.discounts) {
        // A bad/expired promo must not block the purchase — let them in
        // without it (they can still type a code at Stripe).
        console.warn(`[subscription] promo could not be applied for user ${userId} — retrying without it: ${msg}`)
        delete sessionParams.discounts
        sessionParams.allow_promotion_codes = true
        session = await create()
      } else {
        throw err
      }
    }

    if (!session.url) throw new Error('Stripe returned no checkout url')
    return { status: 200, body: { url: session.url } }
  } catch (err) {
    // The raw Stripe error goes to the log, never to the user.
    console.error(`[subscription] could not start ${planId} for user ${userId}:`, err instanceof Error ? err.message : err)
    return { status: 500, body: { error: 'We could not start checkout just now. Please try again in a minute.' } }
  }
}
