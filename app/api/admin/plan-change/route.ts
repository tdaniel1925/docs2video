import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { requireAdmin } from '../../../_lib/admin'
import { logAdminAction } from '../../../_lib/audit'
import { getStripe, SUBSCRIPTION_PRICES, tierFromPriceId } from '../../../_lib/stripe'
import { decidePlanChange, changePlanInPlace, listLiveMainSubscriptions } from '../../../_lib/billing'
import { isSellablePlan, PLANS } from '../../../_lib/pricing'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * Admin plan change, the honest way.
 *
 * Changing a plan in the admin only changed the APP's flag — Stripe kept
 * billing the old amount (or nothing). Now:
 *   GET  ?userId=&plan=  → READ ONLY: what Stripe bills today and whether the
 *        plan can be changed IN STRIPE from here (the same rules the
 *        customer's own "Switch plan" uses: one active subscription → change
 *        it in place; a trial, a late payment, several subscriptions or none →
 *        it can't, use the Stripe customer page).
 *   POST { userId, plan } → change the price IN STRIPE (upgrade bills the
 *        difference now; downgrade starts at renewal). The Stripe webhook then
 *        updates the app plan and credits, exactly as for a customer change.
 */

function stripeCustomerUrl(customerId: string | null) {
  return customerId ? `https://dashboard.stripe.com/customers/${customerId}` : null
}

async function preview(userId: string, plan: string) {
  const db = createAdminClient()
  const { data: profile } = await db.from('profiles').select('id, email, subscription_status, stripe_customer_id').eq('id', userId).maybeSingle()
  if (!profile) return { error: 'User not found', status: 404 as const }
  const customerId = (profile.stripe_customer_id as string | null) ?? null
  const base = { email: profile.email, appPlan: profile.subscription_status || 'free', stripeUrl: stripeCustomerUrl(customerId) }
  if (!customerId) {
    return { ...base, canChangeInStripe: false, stripeBills: 'Nothing — this account has never paid through Stripe.', why: 'No Stripe customer. Changing it here gives the plan for free (a comp).' }
  }
  const stripe = getStripe()
  const subs = await listLiveMainSubscriptions(stripe, customerId)
  const bills = subs.length === 0 ? 'Nothing — no live subscription.' : subs.map((s) => {
    const item = s.items.data[0]
    const tier = item?.price?.id ? tierFromPriceId(item.price.id) : null
    const amt = item?.price?.unit_amount ? `$${(item.price.unit_amount / 100).toFixed(0)}/mo` : ''
    return `${tier ? tier[0].toUpperCase() + tier.slice(1) : 'Another plan'} ${amt} (${s.status})`.trim()
  }).join(', ')
  if (plan === 'free' || !isSellablePlan(plan)) {
    return { ...base, canChangeInStripe: false, stripeBills: bills, why: plan === 'free' ? 'To stop billing, cancel in Billing & Sales or in Stripe.' : 'This plan can’t be sold in Stripe.' }
  }
  const priceId = SUBSCRIPTION_PRICES[plan]
  const decision = decidePlanChange(subs as any, plan, priceId)
  const why: Record<string, string> = {
    checkout: 'No live subscription — the customer has to pay at checkout themselves.',
    checkout_replacing_trial: 'They are on a free trial — the customer has to choose the plan themselves.',
    already_on_plan: 'Stripe already bills this plan.',
    portal: 'A late payment or more than one subscription — fix it on the Stripe customer page.',
    update_in_place: '',
  }
  const price = PLANS.find((p) => p.tier === plan)?.monthlyPrice
  return {
    ...base,
    stripeBills: bills,
    canChangeInStripe: decision.kind === 'update_in_place',
    direction: decision.kind === 'update_in_place' ? decision.direction : null,
    newPrice: price != null ? `$${(price / 100).toFixed(0)}/mo` : null,
    why: why[decision.kind] ?? '',
  }
}

export async function GET(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  const url = new URL(request.url)
  const userId = url.searchParams.get('userId') || ''
  const plan = (url.searchParams.get('plan') || '').toLowerCase()
  if (!userId || !plan) return NextResponse.json({ error: 'userId and plan are required' }, { status: 400 })
  try {
    const p = await preview(userId, plan)
    if ('error' in p) return NextResponse.json({ error: p.error }, { status: p.status })
    return NextResponse.json(p)
  } catch (e) {
    return NextResponse.json({ error: `Stripe could not be read: ${e instanceof Error ? e.message : e}` }, { status: 502 })
  }
}

export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  const { userId, plan } = (await request.json().catch(() => ({}))) as { userId?: string; plan?: string }
  const tier = (plan || '').toLowerCase()
  if (!userId || !isSellablePlan(tier)) return NextResponse.json({ error: 'userId and a sellable plan are required' }, { status: 400 })

  try {
    const { data: profile } = await createAdminClient().from('profiles').select('stripe_customer_id').eq('id', userId).maybeSingle()
    const customerId = profile?.stripe_customer_id as string | undefined
    if (!customerId) return NextResponse.json({ error: 'No Stripe customer for this account.' }, { status: 409 })
    const stripe = getStripe()
    const subs = await listLiveMainSubscriptions(stripe, customerId)
    const priceId = SUBSCRIPTION_PRICES[tier]
    const decision = decidePlanChange(subs as any, tier, priceId)
    if (decision.kind !== 'update_in_place') {
      return NextResponse.json({ error: 'This one can’t be changed from here — use the Stripe customer page.' }, { status: 409 })
    }
    const result = await changePlanInPlace(stripe, decision, tier, priceId, userId)
    await logAdminAction(admin.id, 'change_plan_stripe', userId, { plan: tier, subscriptionId: result.id, direction: decision.direction })
    return NextResponse.json({ success: true, status: result.status })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Stripe change failed' }, { status: 500 })
  }
}
