import type Stripe from 'stripe'
import { tierFromPriceId } from './stripe'
import { isSocialAddonSubscription } from './stripe-invoice'
import { PLANS, getUserTier, type PlanTier, type SellablePlanTier } from './pricing'

/**
 * Subscription money rules shared by every route that starts or changes a
 * plan and by the Stripe webhook (audit C3, 2026-09-26).
 *
 * The bug this exists for: "Switch plan" opened a SECOND Stripe subscription
 * instead of changing the first. The old one kept charging and was no longer
 * tracked, and cancelling it later dropped the paying user to free. Trial
 * users who upgraded also kept their 365-day trial subscription, which would
 * charge the card again a year later.
 *
 * The rules:
 *  - An ACTIVE subscription is changed in place (new price, same subscription).
 *  - A TRIALING subscription (our card-on-file trial) may go through Checkout;
 *    the webhook cancels the trial the moment the new paid subscription starts.
 *  - past_due / unpaid / incomplete, or more than one live subscription → the
 *    billing portal, where the user can fix their card or cancel. Never a new
 *    subscription on top.
 */

/** Stripe statuses that can still bill (or already billed) the customer. */
export const LIVE_SUBSCRIPTION_STATUSES = ['active', 'trialing', 'past_due', 'unpaid', 'incomplete'] as const

type SubLike = {
  id: string
  status: string
  metadata?: Record<string, string> | null
  items?: { data?: Array<{ id: string; price?: { id: string } | null }> }
}

export function isLiveSubscription(sub: { status: string }): boolean {
  return (LIVE_SUBSCRIPTION_STATUSES as readonly string[]).includes(sub.status)
}

/** Main-plan subscriptions only — the $50 AI Social add-on is separate. */
export function liveMainSubscriptions<T extends SubLike>(subs: T[]): T[] {
  return subs.filter(s => isLiveSubscription(s) && !isSocialAddonSubscription(s))
}

/** Every live main-plan subscription on a Stripe customer. */
export async function listLiveMainSubscriptions(stripe: Stripe, customerId: string): Promise<Stripe.Subscription[]> {
  const res = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 })
  return liveMainSubscriptions(res.data as unknown as (Stripe.Subscription & SubLike)[])
}

/** Higher number = bigger plan. Unknown tiers rank lowest. */
export function tierRank(tier: PlanTier | string | null | undefined): number {
  const i = PLANS.findIndex(p => p.tier === tier)
  return i < 0 ? -1 : i
}

export type PlanChangeDecision =
  /** No live subscription: a normal Stripe Checkout for a new one. */
  | { kind: 'checkout' }
  /** Only a card-on-file TRIAL: Checkout is fine — the webhook cancels the
   *  trial as soon as the new paid subscription starts. */
  | { kind: 'checkout_replacing_trial'; trialSubscriptionId: string }
  /** One active subscription: change its price in place. */
  | { kind: 'update_in_place'; subscriptionId: string; itemId: string; currentTier: PlanTier | null; direction: 'upgrade' | 'downgrade' }
  | { kind: 'already_on_plan' }
  /** Payment trouble, several live subscriptions, or a shape we don't
   *  recognise — send them to the Stripe billing portal. */
  | { kind: 'portal'; reason: 'payment_issue' | 'multiple' | 'unrecognized' }

/**
 * Pure decision for "the user asked for plan X". `subs` = the customer's live
 * main-plan subscriptions. `targetTier` must already be a sellable tier.
 */
export function decidePlanChange(subs: SubLike[], targetTier: SellablePlanTier, targetPriceId: string): PlanChangeDecision {
  const live = liveMainSubscriptions(subs)
  if (live.length === 0) return { kind: 'checkout' }
  if (live.length > 1) return { kind: 'portal', reason: 'multiple' }

  const sub = live[0]
  if (sub.status === 'trialing') return { kind: 'checkout_replacing_trial', trialSubscriptionId: sub.id }
  if (sub.status !== 'active') return { kind: 'portal', reason: 'payment_issue' }

  const items = sub.items?.data ?? []
  if (items.length !== 1 || !items[0]?.id) return { kind: 'portal', reason: 'unrecognized' }
  const currentPrice = items[0].price?.id ?? null
  if (currentPrice && currentPrice === targetPriceId) return { kind: 'already_on_plan' }

  const currentTier = currentPrice ? tierFromPriceId(currentPrice) : null
  const direction = tierRank(targetTier) > tierRank(currentTier) ? 'upgrade' : 'downgrade'
  return { kind: 'update_in_place', subscriptionId: sub.id, itemId: items[0].id, currentTier, direction }
}

/**
 * Change an active subscription's plan without creating a new subscription.
 *  - Upgrade: bill the prorated difference NOW; if the card declines the
 *    change is refused (error_if_incomplete), so nobody gets the bigger plan's
 *    credits without paying for them. The webhook adds the credit difference.
 *  - Downgrade: no proration — the cheaper price starts at the next renewal
 *    and the user keeps this cycle's credits (they already paid for them).
 */
export async function changePlanInPlace(
  stripe: Stripe,
  decision: Extract<PlanChangeDecision, { kind: 'update_in_place' }>,
  targetTier: SellablePlanTier,
  targetPriceId: string,
  userId: string,
): Promise<Stripe.Subscription> {
  return stripe.subscriptions.update(decision.subscriptionId, {
    items: [{ id: decision.itemId, price: targetPriceId }],
    proration_behavior: decision.direction === 'upgrade' ? 'always_invoice' : 'none',
    payment_behavior: 'error_if_incomplete',
    cancel_at_period_end: false,
    metadata: { supabase_user_id: userId, tier: targetTier },
  })
}

/**
 * Cancel every live main-plan subscription on these customers except the one
 * that was just paid for. Called by the webhook when a Checkout subscription
 * completes, so a leftover card-on-file trial (or any duplicate) can never
 * bill the card later. Returns the ids it cancelled. Each failure is logged
 * and skipped — the new, paid subscription must not be undone by this.
 */
export async function cancelSupersededSubscriptions(
  stripe: Stripe,
  customerIds: Array<string | null | undefined>,
  keepSubscriptionId: string,
): Promise<string[]> {
  const cancelled: string[] = []
  for (const customerId of [...new Set(customerIds.filter((c): c is string => !!c))]) {
    let subs: Stripe.Subscription[] = []
    try {
      subs = await listLiveMainSubscriptions(stripe, customerId)
    } catch (e) {
      console.error(`[billing] could not list subscriptions for ${customerId}:`, e instanceof Error ? e.message : e)
      continue
    }
    for (const sub of subs) {
      if (sub.id === keepSubscriptionId) continue
      try {
        await stripe.subscriptions.cancel(sub.id)
        cancelled.push(sub.id)
        const level = sub.status === 'trialing' ? 'log' : 'warn'
        console[level](`[billing] cancelled superseded ${sub.status} subscription ${sub.id} (customer ${customerId}) — replaced by ${keepSubscriptionId}${sub.status === 'trialing' ? '' : ' — CHECK whether this customer was double-billed and needs a refund'}`)
      } catch (e) {
        console.error(`[billing] FAILED to cancel superseded subscription ${sub.id} — it may still bill the customer:`, e instanceof Error ? e.message : e)
      }
    }
  }
  return cancelled
}

/**
 * Does a subscription event belong to the subscription we have on file?
 *  - 'match': it's the one on file
 *  - 'other': we have a DIFFERENT one on file — this event is for an old,
 *    replaced or duplicate subscription and must not change the user's plan
 *  - 'none_on_file': we have nothing on file (older accounts) — callers decide
 */
export function subscriptionOnFile(
  onFileId: string | null | undefined,
  eventSubscriptionId: string,
): 'match' | 'other' | 'none_on_file' {
  if (!onFileId) return 'none_on_file'
  return onFileId === eventSubscriptionId ? 'match' : 'other'
}

/**
 * The WELCOME50 marketing promo's Stripe promotion-code id. Read from the
 * STRIPE_PROMO_WELCOME50 env var. The old hardcoded id is a LIVE-mode id, so
 * it is only used as a fallback when we are on a live key — in test mode an
 * unknown id would break every checkout that carries ?promo=WELCOME50.
 */
export function welcome50PromoId(): string | undefined {
  const fromEnv = (process.env.STRIPE_PROMO_WELCOME50 || '').trim()
  if (fromEnv) return fromEnv
  if ((process.env.STRIPE_SECRET_KEY || '').startsWith('sk_live_')) return 'promo_1TmecCFnyKCNDapH0cD2Au8F'
  return undefined
}

/** Allowlisted marketing promo codes that may be auto-applied from ?promo=. */
export function autoPromoId(code: string | null | undefined): string | undefined {
  if (!code) return undefined
  const AUTO: Record<string, () => string | undefined> = {
    WELCOME50: welcome50PromoId, // 50% off first month
  }
  return AUTO[code.toUpperCase()]?.()
}

/** Friendly message for a Stripe card/charge failure during an in-place change. */
export function planChangeErrorMessage(err: unknown): string {
  const e = err as { type?: string; code?: string } | null
  if (e?.type === 'StripeCardError' || e?.code === 'card_declined') {
    return 'Your card was declined, so your plan was not changed. Please update your card in Billing and try again.'
  }
  return 'We could not change your plan just now. Please try again, or use Manage billing.'
}

const idOf = (v: unknown): string | null =>
  typeof v === 'string' ? v : (v && typeof v === 'object' && typeof (v as { id?: unknown }).id === 'string' ? (v as { id: string }).id : null)

/**
 * Which invoice a charge paid, on any Stripe API version (audit H8).
 * Older API versions put `invoice` right on the Charge; current versions
 * (the SDK is on 2026-04 "dahlia") dropped it — the link now lives in
 * invoice payments, looked up by the charge's payment intent. The webhook read
 * only the old field, so refunds and chargebacks never found their invoice and
 * never clawed back commission.
 */
export async function invoiceIdForPayment(
  stripe: Stripe,
  input: { legacyInvoice?: unknown; paymentIntentId?: string | null },
): Promise<string | null> {
  const legacy = idOf(input.legacyInvoice)
  if (legacy) return legacy
  if (!input.paymentIntentId) return null
  const res = await stripe.invoicePayments.list({
    payment: { type: 'payment_intent', payment_intent: input.paymentIntentId },
    limit: 1,
  })
  return idOf(res.data[0]?.invoice)
}

export { idOf as stripeId }

/**
 * What saving a card may do for this account (audit C2). Pure so it's tested.
 *  - 'blocked': past_due or banned — saving a card must NOT lift the block
 *    (a failed payment is fixed in the billing portal, not by a new card here)
 *  - 'keep_paid_plan': already paying — just note the card; never reset a
 *    Pro/Business/Enterprise customer back to 'trial'
 *  - 'start_trial': free/trial/new account — card on file starts the trial
 */
export function cardConfirmAction(subscriptionStatus: string | null | undefined): 'blocked' | 'keep_paid_plan' | 'start_trial' {
  if (subscriptionStatus === 'past_due' || subscriptionStatus === 'banned') return 'blocked'
  if (getUserTier(subscriptionStatus ?? null) !== 'free') return 'keep_paid_plan'
  return 'start_trial'
}

/**
 * Where to send the buyer back to after Stripe. Only our own hosts are
 * honored — the Origin header is attacker-controllable, and an open redirect
 * on a payment page is a phishing gift. Mirrors the credit-pack route.
 */
export function safeReturnOrigin(request: Request): string {
  const ALLOWED = ['https://docs2video.com', 'https://www.docs2video.com', 'https://text2art.app', 'https://www.text2art.app']
  const origin = (request.headers.get('origin') || '').trim().replace(/\/+$/, '')
  if (ALLOWED.includes(origin)) return origin
  if (process.env.NODE_ENV !== 'production' && /^http:\/\/localhost(:\d+)?$/.test(origin)) return origin
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://docs2video.com').trim().replace(/\/+$/, '')
}
