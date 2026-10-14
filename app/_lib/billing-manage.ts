import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { SUBSCRIPTION_PRICES, tierFromPriceId } from './stripe'
import { getPlan, getUserTier, isSellablePlan, type PlanTier } from './pricing'
import { isSocialAddonSubscription } from './stripe-invoice'
import {
  isLiveSubscription, liveMainSubscriptions, decidePlanChange, changePlanInPlace,
  planChangeErrorMessage, stripeId,
} from './billing'
import { addTopupCredits } from './credits'

/**
 * IN-APP BILLING MANAGEMENT (2026-10-14) — replaces the Stripe billing portal.
 * Settings → Billing & credits reads and changes everything through these
 * functions (via /api/billing/manage). Every function takes the Stripe client
 * and the customer id that came from the signed-in user's OWN profile — never
 * an id from the browser — and every card / invoice / subscription id the
 * browser sends is checked to belong to that customer first.
 *
 * Money rules kept from before:
 *  - never a second subscription (decidePlanChange, audit C3)
 *  - upgrades charge the prorated difference now, downgrades charge nothing
 *    (changePlanInPlace — the admin path uses the same function)
 *  - plan, credits and add-on still change ONLY through the Stripe webhook
 */

type Sub = Stripe.Subscription

// ─── Plain answers for the browser ─────────────────────────────────────────

export class BillingError extends Error {
  status: number
  code: string
  constructor(message: string, status = 400, code = 'billing_error') {
    super(message)
    this.status = status
    this.code = code
  }
}

const iso = (sec: number | null | undefined) => (sec ? new Date(sec * 1000).toISOString() : null)

function periodEnd(sub: Sub): number | null {
  // Current API ("dahlia"): the period lives on the subscription item.
  const item = sub.items?.data?.[0] as unknown as { current_period_end?: number } | undefined
  return item?.current_period_end ?? (sub as unknown as { current_period_end?: number }).current_period_end ?? null
}

function subTier(sub: Sub): PlanTier | null {
  const price = sub.items?.data?.[0]?.price?.id
  return (price ? tierFromPriceId(price) : null) ?? (isSellablePlan(sub.metadata?.tier) ? (sub.metadata.tier as PlanTier) : null)
}

async function allSubs(stripe: Stripe, customerId: string): Promise<Sub[]> {
  const res = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 })
  return res.data
}

/** The single live main-plan subscription, or a plain refusal. */
function onlyMainSub(subs: Sub[]): Sub | null {
  const live = liveMainSubscriptions(subs)
  if (live.length > 1) throw new BillingError('Your account has more than one plan on file. Please contact support and we’ll sort it out.', 409, 'contact_support')
  return live[0] ?? null
}

// ─── Reading: what the Billing page shows ──────────────────────────────────

export type BillingCard = {
  id: string
  kind: string
  brand: string
  last4: string | null
  expMonth: number | null
  expYear: number | null
  wallet: string | null
  isDefault: boolean
}

export type BillingInvoice = {
  id: string
  number: string | null
  date: string | null
  amountCents: number
  currency: string
  status: string
  pdf: string | null
  description: string
}

export type BillingState = {
  hasCustomer: boolean
  plan: null | {
    subscriptionId: string
    tier: PlanTier | null
    label: string
    status: string
    priceCents: number | null
    periodEnd: string | null
    cancelAtPeriodEnd: boolean
    cancelAt: string | null
    trialEnd: string | null
    pendingChange: boolean
  }
  nextCharge: null | { amountCents: number; date: string | null }
  addon: null | { subscriptionId: string; status: string; priceCents: number | null; periodEnd: string | null; cancelAtPeriodEnd: boolean }
  pastDue: null | { invoiceId: string; amountCents: number }
  cards: BillingCard[]
  invoices: BillingInvoice[]
  details: { name: string | null; email: string | null; address: Stripe.Address | null }
}

export const EMPTY_BILLING_STATE: BillingState = {
  hasCustomer: false, plan: null, nextCharge: null, addon: null, pastDue: null, cards: [], invoices: [],
  details: { name: null, email: null, address: null },
}

function cardOf(pm: Stripe.PaymentMethod, defaultId: string | null): BillingCard {
  const c = pm.card
  const brand = c?.brand
    ? c.brand.replace(/^amex$/, 'American Express').replace(/^\w/, (m) => m.toUpperCase())
    : pm.type === 'link' ? 'Link' : pm.type === 'us_bank_account' ? 'Bank account' : pm.type.replace(/_/g, ' ')
  return {
    id: pm.id,
    kind: pm.type,
    brand,
    last4: c?.last4 ?? (pm as unknown as { us_bank_account?: { last4?: string } }).us_bank_account?.last4 ?? null,
    expMonth: c?.exp_month ?? null,
    expYear: c?.exp_year ?? null,
    wallet: c?.wallet?.type ? c.wallet.type.replace(/_/g, ' ') : null,
    isDefault: pm.id === defaultId,
  }
}

function invoiceLabel(inv: Stripe.Invoice): string {
  const meta = inv.metadata || {}
  if (meta.type === 'credit_pack') return 'Credit pack'
  const line = inv.lines?.data?.[0]?.description
  if (inv.billing_reason === 'subscription_update') return 'Plan change'
  if (line) return line.replace(/^\d+\s*×\s*/, '').replace(/\s*\(at .*\)$/, '')
  return 'Payment'
}

/** The default card: the customer's invoice default, else the main plan's own. */
function defaultCardId(customer: Stripe.Customer, main: Sub | null): string | null {
  return stripeId(customer.invoice_settings?.default_payment_method) ?? (main ? stripeId(main.default_payment_method) : null)
}

export async function loadBillingState(stripe: Stripe, customerId: string | null): Promise<BillingState> {
  if (!customerId) return EMPTY_BILLING_STATE
  const [customerRaw, subs, pms, invs] = await Promise.all([
    stripe.customers.retrieve(customerId),
    allSubs(stripe, customerId),
    stripe.customers.listPaymentMethods(customerId, { limit: 20 }),
    stripe.invoices.list({ customer: customerId, limit: 24 }),
  ])
  if ((customerRaw as { deleted?: boolean }).deleted) return EMPTY_BILLING_STATE
  const customer = customerRaw as Stripe.Customer

  const mainLive = liveMainSubscriptions(subs)
  const main = mainLive[0] ?? null
  const addonSub = subs.find((s) => isSocialAddonSubscription(s) && isLiveSubscription(s)) ?? null
  const defaultId = defaultCardId(customer, main)

  let nextCharge: BillingState['nextCharge'] = null
  if (main && main.status === 'active' && !main.cancel_at_period_end) {
    try {
      const up = await stripe.invoices.createPreview({ customer: customerId, subscription: main.id })
      nextCharge = { amountCents: up.amount_due, date: iso(up.next_payment_attempt ?? up.period_end ?? periodEnd(main)) }
    } catch (e) {
      console.warn('[billing-manage] next-charge preview failed (non-fatal):', e instanceof Error ? e.message : e)
      const price = main.items.data[0]?.price?.unit_amount
      if (price != null) nextCharge = { amountCents: price, date: iso(periodEnd(main)) }
    }
  }

  let pastDue: BillingState['pastDue'] = null
  if (main && (main.status === 'past_due' || main.status === 'unpaid')) {
    const open = invs.data.find((i) => i.status === 'open' && stripeId((i as unknown as { parent?: { subscription_details?: { subscription?: unknown } } }).parent?.subscription_details?.subscription) === main.id)
      ?? invs.data.find((i) => i.status === 'open')
    if (open?.id) pastDue = { invoiceId: open.id, amountCents: open.amount_remaining }
  }

  const tier = main ? subTier(main) : null
  return {
    hasCustomer: true,
    plan: main ? {
      subscriptionId: main.id,
      tier,
      label: tier ? getPlan(tier).label : 'Your plan',
      status: main.status,
      priceCents: main.items.data[0]?.price?.unit_amount ?? null,
      periodEnd: iso(periodEnd(main)),
      cancelAtPeriodEnd: !!main.cancel_at_period_end,
      cancelAt: iso(main.cancel_at),
      trialEnd: iso(main.trial_end),
      pendingChange: !!main.pending_update,
    } : null,
    nextCharge,
    addon: addonSub ? {
      subscriptionId: addonSub.id,
      status: addonSub.status,
      priceCents: addonSub.items.data[0]?.price?.unit_amount ?? null,
      periodEnd: iso(periodEnd(addonSub)),
      cancelAtPeriodEnd: !!addonSub.cancel_at_period_end,
    } : null,
    pastDue,
    cards: pms.data.map((pm) => cardOf(pm, defaultId)),
    invoices: invs.data
      // Drafts aren't bills yet; $0 trial-start invoices are noise.
      .filter((i) => i.status !== 'draft' && !(i.total === 0 && i.status === 'paid'))
      .map((i) => ({
        id: i.id as string,
        number: i.number ?? null,
        date: iso(i.status_transitions?.paid_at ?? i.created),
        amountCents: i.status === 'paid' ? i.amount_paid : i.amount_due,
        currency: i.currency,
        status: i.status ?? 'open',
        // The PDF is a file Stripe serves — opening it is fine (not a payment page).
        pdf: i.invoice_pdf ?? null,
        description: invoiceLabel(i),
      })),
    details: { name: customer.name ?? null, email: customer.email ?? null, address: customer.address ?? null },
  }
}

// ─── Plan changes with a preview ───────────────────────────────────────────

/** A proration moment the customer saw at most this long ago is honoured; an
 *  older (or forged) one is replaced by "now". Without the clamp a browser
 *  could send a date near the END of the period and pay almost nothing for an
 *  upgrade while still receiving the bigger plan's credit difference. */
export const PRORATION_DATE_MAX_AGE_SEC = 30 * 60

export function safeProrationDate(sent: unknown, nowSec = Math.floor(Date.now() / 1000)): number {
  const n = typeof sent === 'number' && Number.isFinite(sent) ? Math.floor(sent) : NaN
  if (!Number.isFinite(n) || n > nowSec || nowSec - n > PRORATION_DATE_MAX_AGE_SEC) return nowSec
  return n
}

export type PlanChangePreview = {
  direction: 'upgrade' | 'downgrade'
  from: { tier: PlanTier | null; label: string; priceCents: number | null }
  to: { tier: PlanTier; label: string; priceCents: number; monthlyCredits: number }
  dueNowCents: number
  nextAmountCents: number
  nextDate: string | null
  prorationDate: number
}

function changeDecision(subs: Sub[], plan: string) {
  if (!isSellablePlan(plan)) throw new BillingError('That plan is not available. Please choose Pro, Business or Enterprise.', 400, 'bad_plan')
  const priceId = SUBSCRIPTION_PRICES[plan]
  if (!priceId) throw new BillingError('Plans are not available right now. Please try again later.', 503, 'not_configured')
  const live = liveMainSubscriptions(subs)
  const decision = decidePlanChange(live, plan, priceId)
  if (decision.kind === 'already_on_plan') throw new BillingError(`You’re already on the ${getPlan(plan).label} plan.`, 409, 'already_on_plan')
  if (decision.kind === 'fix_first') {
    throw decision.reason === 'payment_issue'
      ? new BillingError('Your last payment didn’t go through. Update your card first — then you can change your plan.', 409, 'fix_payment')
      : new BillingError('Your account needs a quick check before the plan can change. Please contact support and we’ll sort it out.', 409, 'contact_support')
  }
  if (decision.kind !== 'update_in_place') throw new BillingError('You don’t have a paid plan to change yet — pick one to start.', 409, 'needs_checkout')
  const sub = live.find((s) => s.id === decision.subscriptionId) as Sub
  if (sub.cancel_at_period_end) throw new BillingError('Your plan is set to end. Press “Keep my plan” first, then change it.', 409, 'resume_first')
  if (sub.pending_update) throw new BillingError('A plan change is still waiting for payment. Finish it or try again in a few minutes.', 409, 'pending')
  return { decision, sub, plan, priceId }
}

export async function previewPlanChange(stripe: Stripe, customerId: string, plan: string, nowSec = Math.floor(Date.now() / 1000)): Promise<PlanChangePreview> {
  const subs = await allSubs(stripe, customerId)
  const { decision, sub, priceId } = changeDecision(subs, plan)
  const target = getPlan(plan as PlanTier)
  const upgrade = decision.direction === 'upgrade'
  const preview = await stripe.invoices.createPreview({
    customer: customerId,
    subscription: sub.id,
    subscription_details: {
      items: [{ id: decision.itemId, price: priceId }],
      proration_behavior: upgrade ? 'always_invoice' : 'none',
      ...(upgrade ? { proration_date: nowSec } : {}),
    },
  })
  const fromTier = decision.currentTier
  return {
    direction: decision.direction,
    from: { tier: fromTier, label: fromTier ? getPlan(fromTier).label : 'Your plan', priceCents: sub.items.data[0]?.price?.unit_amount ?? null },
    to: { tier: plan as PlanTier, label: target.label, priceCents: target.monthlyPrice, monthlyCredits: target.monthlyCredits },
    // always_invoice previews the bill made right now (the difference);
    // a downgrade bills nothing today.
    dueNowCents: upgrade ? Math.max(0, preview.amount_due) : 0,
    nextAmountCents: upgrade ? target.monthlyPrice : Math.max(0, preview.amount_due),
    nextDate: iso(periodEnd(sub)),
    prorationDate: nowSec,
  }
}

export type PlanChangeResult =
  | { status: 'done'; direction: 'upgrade' | 'downgrade' }
  | { status: 'requires_action'; clientSecret: string; invoiceId: string }
  | { status: 'processing' }

/** The PaymentIntent behind an invoice (current API: via invoice payments). */
async function invoiceIntent(stripe: Stripe, invoiceId: string): Promise<Stripe.PaymentIntent | null> {
  const res = await stripe.invoicePayments.list({ invoice: invoiceId, limit: 5, expand: ['data.payment.payment_intent'] } as Stripe.InvoicePaymentListParams)
  for (const p of res.data) {
    const pi = (p as unknown as { payment?: { payment_intent?: unknown } }).payment?.payment_intent
    if (pi && typeof pi === 'object') return pi as Stripe.PaymentIntent
    if (typeof pi === 'string') return stripe.paymentIntents.retrieve(pi)
  }
  return null
}

export async function applyPlanChange(
  stripe: Stripe, customerId: string, userId: string, plan: string, prorationDateSent: unknown,
): Promise<PlanChangeResult> {
  const subs = await allSubs(stripe, customerId)
  const { decision, priceId } = changeDecision(subs, plan)
  let updated: Sub
  try {
    updated = await changePlanInPlace(stripe, decision, plan as never, priceId, userId, {
      customerPresent: true,
      prorationDate: safeProrationDate(prorationDateSent),
    })
  } catch (err) {
    console.error(`[billing-manage] plan change failed for ${userId}:`, err instanceof Error ? err.message : err)
    throw new BillingError(planChangeErrorMessage(err), 402, 'declined')
  }
  if (decision.direction === 'downgrade' || !updated.pending_update) {
    // Applied. The customer.subscription.updated webhook moves the profile to
    // the new tier and adds the credit difference on an upgrade.
    if (decision.direction === 'upgrade') {
      // Paid with no extra step — record the tier on the subscription too
      // (not allowed inside a pending update).
      await stripe.subscriptions.update(updated.id, { metadata: { supabase_user_id: userId, tier: plan } }).catch(() => {})
    }
    return { status: 'done', direction: decision.direction }
  }
  // Upgrade waiting on payment: the bank wants a security check, or the card failed.
  const invoiceId = stripeId(updated.latest_invoice)
  const pi = invoiceId ? await invoiceIntent(stripe, invoiceId) : null
  if (invoiceId && pi?.status === 'requires_action' && pi.client_secret) {
    return { status: 'requires_action', clientSecret: pi.client_secret, invoiceId }
  }
  if (pi?.status === 'processing') return { status: 'processing' }
  // Declined: drop the pending change and its unpaid bill so nothing is
  // retried later behind the customer's back.
  if (invoiceId) await stripe.invoices.voidInvoice(invoiceId).catch((e: unknown) => console.warn('[billing-manage] could not void declined upgrade invoice:', e instanceof Error ? e.message : e))
  throw new BillingError('Your card was declined, so your plan was not changed. Add or choose another card under Payment methods, then try again.', 402, 'declined')
}

/** The customer closed the bank check without finishing: void that one
 *  upgrade bill so the waiting change is dropped. Only an OPEN invoice of
 *  THIS customer whose subscription still has a waiting change qualifies. */
export async function abandonPlanChange(stripe: Stripe, customerId: string, invoiceId: string): Promise<void> {
  if (!/^in_[A-Za-z0-9]+$/.test(invoiceId)) throw new BillingError('Unknown bill.', 400)
  const inv = await stripe.invoices.retrieve(invoiceId)
  if (stripeId(inv.customer) !== customerId) throw new BillingError('Unknown bill.', 404)
  if (inv.status !== 'open' || inv.billing_reason !== 'subscription_update') return
  const subId = stripeId((inv as unknown as { parent?: { subscription_details?: { subscription?: unknown } } }).parent?.subscription_details?.subscription)
  if (!subId) return
  const sub = await stripe.subscriptions.retrieve(subId)
  if (!sub.pending_update) return
  await stripe.invoices.voidInvoice(invoiceId)
}

// ─── Cancel / resume ───────────────────────────────────────────────────────

export const CANCEL_REASONS = ['too_expensive', 'unused', 'missing_features', 'switched_service', 'too_complex', 'low_quality', 'customer_service', 'other'] as const
export type CancelReason = (typeof CANCEL_REASONS)[number]

export type CancelResult = { status: 'ends_at_period_end'; endsAt: string | null } | { status: 'stopped_now' }

export async function cancelSubscription(
  stripe: Stripe, customerId: string, which: 'plan' | 'social', reason: unknown, comment: unknown,
): Promise<CancelResult> {
  const subs = await allSubs(stripe, customerId)
  const sub = which === 'social'
    ? subs.find((s) => isSocialAddonSubscription(s) && isLiveSubscription(s)) ?? null
    : onlyMainSub(subs)
  if (!sub) throw new BillingError(which === 'social' ? 'The AI Social add-on isn’t active.' : 'You don’t have a plan to cancel.', 404, 'nothing_to_cancel')
  const feedback = (CANCEL_REASONS as readonly string[]).includes(String(reason)) ? (reason as CancelReason) : undefined
  const note = typeof comment === 'string' ? comment.trim().slice(0, 500) : ''
  const details = { ...(feedback ? { feedback } : {}), ...(note ? { comment: note } : {}) }

  // A free trial or a late payment stops NOW: a trial has no paid period to
  // run out (turning it off means nothing is charged when the free credits
  // run out); a late plan has nothing paid left to use.
  if (sub.status === 'trialing' || sub.status === 'past_due' || sub.status === 'unpaid' || sub.status === 'incomplete') {
    await stripe.subscriptions.cancel(sub.id, { cancellation_details: details })
    return { status: 'stopped_now' }
  }
  const updated = await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true, cancellation_details: details })
  return { status: 'ends_at_period_end', endsAt: iso(updated.cancel_at ?? periodEnd(updated)) }
}

export async function resumeSubscription(stripe: Stripe, customerId: string, which: 'plan' | 'social'): Promise<void> {
  const subs = await allSubs(stripe, customerId)
  const sub = which === 'social'
    ? subs.find((s) => isSocialAddonSubscription(s) && isLiveSubscription(s)) ?? null
    : onlyMainSub(subs)
  if (!sub || !sub.cancel_at_period_end) throw new BillingError('There’s nothing to resume.', 409, 'nothing_to_resume')
  await stripe.subscriptions.update(sub.id, { cancel_at_period_end: false })
}

// ─── Cards ─────────────────────────────────────────────────────────────────

async function ownCard(stripe: Stripe, customerId: string, pmId: unknown): Promise<Stripe.PaymentMethod> {
  if (typeof pmId !== 'string' || !/^(pm|card|src)_[A-Za-z0-9]+$/.test(pmId)) throw new BillingError('Unknown card.', 400)
  const pm = await stripe.paymentMethods.retrieve(pmId)
  if (stripeId(pm.customer) !== customerId) throw new BillingError('Unknown card.', 404)
  return pm
}

/** A SetupIntent for "Add a card" (Payment Element, Stripe picks the methods). */
export async function createCardSetup(stripe: Stripe, customerId: string): Promise<string> {
  const si = await stripe.setupIntents.create({ customer: customerId, usage: 'off_session' })
  if (!si.client_secret) throw new Error('no client secret')
  return si.client_secret
}

/** Make a card the default for future bills — on the customer AND on every
 *  live subscription that names its own card (a subscription's own card wins
 *  over the customer's default). */
export async function setDefaultCard(stripe: Stripe, customerId: string, pmId: unknown): Promise<void> {
  const pm = await ownCard(stripe, customerId, pmId)
  await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: pm.id } })
  const subs = await allSubs(stripe, customerId)
  for (const s of subs) {
    if (isLiveSubscription(s) && s.default_payment_method && stripeId(s.default_payment_method) !== pm.id) {
      await stripe.subscriptions.update(s.id, { default_payment_method: pm.id })
    }
  }
}

export type RetryResult = { status: 'paid' } | { status: 'requires_action'; clientSecret: string } | { status: 'none' }

/** Late payment: pay the open plan bill now with this card (in the app). */
export async function retryPastDue(stripe: Stripe, customerId: string, pmId: string): Promise<RetryResult> {
  const subs = await allSubs(stripe, customerId)
  const main = liveMainSubscriptions(subs)[0]
  if (!main || (main.status !== 'past_due' && main.status !== 'unpaid')) return { status: 'none' }
  const invId = stripeId(main.latest_invoice)
  if (!invId) return { status: 'none' }
  const inv = await stripe.invoices.retrieve(invId)
  if (inv.status !== 'open') return { status: 'none' }
  try {
    await stripe.invoices.pay(invId, { payment_method: pmId })
    return { status: 'paid' }
  } catch (err) {
    const pi = await invoiceIntent(stripe, invId).catch(() => null)
    if (pi?.status === 'requires_action' && pi.client_secret) return { status: 'requires_action', clientSecret: pi.client_secret }
    console.warn('[billing-manage] past-due retry failed:', err instanceof Error ? err.message : err)
    throw new BillingError('That card was declined too. Please try another card.', 402, 'declined')
  }
}

/**
 * After "Add a card" saved a card in the app: check Stripe really saved it on
 * THIS customer, make it the default when asked (or when it's the only one),
 * and — when a payment is late — pay the open bill with it right away.
 * (Accounts with no card yet go through /api/confirm-card instead: that is the
 * trial step, with the one-card-one-trial check.)
 */
export async function finishCardSetup(
  stripe: Stripe, customerId: string, setupIntentId: unknown, makeDefault: boolean,
): Promise<{ cardId: string; retry: RetryResult }> {
  if (typeof setupIntentId !== 'string' || !/^seti_[A-Za-z0-9]+$/.test(setupIntentId)) throw new BillingError('Please enter the card again.', 400)
  const si = await stripe.setupIntents.retrieve(setupIntentId)
  if (si.status !== 'succeeded' || stripeId(si.customer) !== customerId) throw new BillingError('We could not confirm that card. Please enter it again.', 400, 'not_saved')
  const pmId = stripeId(si.payment_method)
  if (!pmId) throw new BillingError('We could not confirm that card. Please enter it again.', 400, 'not_saved')
  const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer
  if (makeDefault || !stripeId(customer.invoice_settings?.default_payment_method)) {
    await setDefaultCard(stripe, customerId, pmId)
  }
  const retry = await retryPastDue(stripe, customerId, pmId)
  return { cardId: pmId, retry }
}

export async function removeCard(
  stripe: Stripe, admin: SupabaseClient, userId: string, customerId: string, pmId: unknown,
): Promise<void> {
  const pm = await ownCard(stripe, customerId, pmId)
  const [subs, pms, customer, prof] = await Promise.all([
    allSubs(stripe, customerId),
    stripe.customers.listPaymentMethods(customerId, { limit: 20 }),
    stripe.customers.retrieve(customerId) as Promise<Stripe.Customer>,
    admin.from('profiles').select('subscription_status').eq('id', userId).maybeSingle(),
  ])
  const others = pms.data.filter((p) => p.id !== pm.id)
  const live = subs.filter(isLiveSubscription)
  const onTrial = (prof.data?.subscription_status as string | null) === 'trial'
  if (others.length === 0 && (live.length > 0 || onTrial)) {
    throw new BillingError(
      onTrial && live.length === 0
        ? 'Your free trial needs a card on file. Add another card first, then remove this one.'
        : 'This is your only card and your plan uses it. Add another card first — or cancel the plan.',
      409, 'last_card',
    )
  }
  // Removing the default: move bills to another card first.
  const wasDefault = defaultCardId(customer, liveMainSubscriptions(subs)[0] ?? null) === pm.id
    || live.some((s) => stripeId(s.default_payment_method) === pm.id)
  if (wasDefault && others[0]) await setDefaultCard(stripe, customerId, others[0].id)
  await stripe.paymentMethods.detach(pm.id)
  if (others.length === 0) {
    // No card left and nothing billing: the card-required rule applies again.
    await admin.from('profiles').update({ card_on_file: false }).eq('id', userId)
  }
}

// ─── Billing details ───────────────────────────────────────────────────────

export async function updateBillingDetails(stripe: Stripe, customerId: string, input: unknown): Promise<void> {
  const b = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
  const name = str(b.name, 120)
  const email = str(b.email, 200).toLowerCase()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BillingError('That email address doesn’t look right.', 400, 'bad_email')
  const a = (b.address && typeof b.address === 'object' ? b.address : {}) as Record<string, unknown>
  const country = str(a.country, 2).toUpperCase()
  if (country && !/^[A-Z]{2}$/.test(country)) throw new BillingError('Please pick a country.', 400, 'bad_country')
  const address = {
    line1: str(a.line1), line2: str(a.line2), city: str(a.city, 100),
    state: str(a.state, 100), postal_code: str(a.postal_code, 20), country,
  }
  const hasAddress = Object.values(address).some(Boolean)
  await stripe.customers.update(customerId, {
    name: name || '',
    ...(email ? { email } : {}),
    ...(hasAddress ? { address } : {}),
  })
}

// ─── After an in-app checkout ──────────────────────────────────────────────

export type CheckoutFulfilment = {
  status: 'open' | 'complete' | 'expired'
  paymentStatus: string
  kind: 'subscription' | 'credit_pack' | 'social_addon' | 'other'
  fulfilled: boolean
}

export async function checkoutFulfilment(
  stripe: Stripe, admin: SupabaseClient, userId: string, sessionId: string,
): Promise<CheckoutFulfilment | null> {
  const s = await stripe.checkout.sessions.retrieve(sessionId)
  if (s.metadata?.supabase_user_id !== userId) return null
  const kind = (['subscription', 'credit_pack', 'social_addon'] as const).find((k) => k === s.metadata?.type) ?? 'other'
  const status = (s.status ?? 'open') as CheckoutFulfilment['status']
  const paid = s.status === 'complete' && (s.payment_status === 'paid' || s.payment_status === 'no_payment_required')
  let fulfilled = false
  if (paid) {
    if (kind === 'credit_pack') {
      const credits = parseInt(s.metadata?.credits || '0', 10)
      if (Number.isFinite(credits) && credits > 0 && credits <= 100000) {
        // Same key as the webhook and the reconcile cron: whichever runs
        // first grants, the others are no-ops.
        await addTopupCredits(userId, credits, s.metadata?.pack_name || s.metadata?.pack || 'credit_pack', { idempotencyKey: `pack:${s.id}` })
        fulfilled = true
      }
    } else {
      const { data: prof } = await admin
        .from('profiles').select('subscription_status, stripe_subscription_id, social_addon_active').eq('id', userId).maybeSingle()
      if (kind === 'social_addon') fulfilled = !!prof?.social_addon_active
      else if (kind === 'subscription') {
        fulfilled = !!prof && prof.stripe_subscription_id === stripeId(s.subscription)
          && getUserTier(prof.subscription_status as string | null) === (s.metadata?.tier ?? '')
      }
    }
  }
  return { status, paymentStatus: s.payment_status, kind, fulfilled }
}
