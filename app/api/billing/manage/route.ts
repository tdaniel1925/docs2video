import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { getStripe } from '../../../_lib/stripe'
import { ensureStripeCustomer } from '../../../_lib/stripe-customer'
import {
  BillingError, loadBillingState, previewPlanChange, applyPlanChange, abandonPlanChange,
  cancelSubscription, resumeSubscription, createCardSetup, finishCardSetup, setDefaultCard,
  removeCard, updateBillingDetails, retryPastDue, EMPTY_BILLING_STATE,
} from '../../../_lib/billing-manage'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * /api/billing/manage — Settings → Billing & credits, in the app (replaces
 * the Stripe billing portal, 2026-10-14).
 *
 * GET  → plan, next charge, add-on, late payment, cards, invoices, details.
 * POST { action, … } → preview_plan | change_plan | abandon_plan_change |
 *      cancel | resume | setup_card | card_added | set_default | remove_card |
 *      update_details | retry_payment
 *
 * The Stripe customer always comes from the signed-in user's own profile;
 * every id the browser sends is checked against it (billing-manage.ts).
 * Plans and credits still change only through the Stripe webhook.
 */

async function signedIn() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

async function customerOf(userId: string): Promise<string | null> {
  const { data } = await createAdminClient().from('profiles').select('stripe_customer_id').eq('id', userId).maybeSingle()
  return (data?.stripe_customer_id as string | null) ?? null
}

function fail(err: unknown, where: string) {
  if (err instanceof BillingError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status })
  // Raw Stripe detail stays in the log; the user gets a plain sentence.
  console.error(`[billing/manage] ${where} failed:`, err instanceof Error ? err.message : err)
  const msg = err instanceof Error ? err.message : ''
  if (/No such customer/i.test(msg)) return NextResponse.json({ error: 'We could not find your billing account. Please reload the page.' }, { status: 409 })
  return NextResponse.json({ error: 'Something went wrong on our side. Please try again in a minute.' }, { status: 500 })
}

export async function GET() {
  const user = await signedIn()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const customerId = await customerOf(user.id)
  if (!customerId) return NextResponse.json(EMPTY_BILLING_STATE)
  try {
    return NextResponse.json(await loadBillingState(getStripe(), customerId))
  } catch (err) {
    return fail(err, 'load')
  }
}

export async function POST(request: Request) {
  const user = await signedIn()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const action = String(body.action || '')
  const stripe = getStripe()

  try {
    // Saving a card is the one action that may need a customer made first.
    if (action === 'setup_card') {
      const customerId = await ensureStripeCustomer(createAdminClient(), stripe, { id: user.id, email: user.email })
      return NextResponse.json({ clientSecret: await createCardSetup(stripe, customerId) })
    }

    const customerId = await customerOf(user.id)
    if (!customerId) return NextResponse.json({ error: 'You haven’t paid for anything yet, so there’s nothing to manage.', code: 'no_customer' }, { status: 409 })
    const which = body.which === 'social' ? 'social' : 'plan'

    switch (action) {
      case 'preview_plan':
        return NextResponse.json(await previewPlanChange(stripe, customerId, String(body.plan || '')))
      case 'change_plan':
        return NextResponse.json(await applyPlanChange(stripe, customerId, user.id, String(body.plan || ''), body.prorationDate))
      case 'abandon_plan_change':
        await abandonPlanChange(stripe, customerId, String(body.invoiceId || ''))
        return NextResponse.json({ ok: true })
      case 'cancel':
        return NextResponse.json(await cancelSubscription(stripe, customerId, which, body.reason, body.comment))
      case 'resume':
        await resumeSubscription(stripe, customerId, which)
        return NextResponse.json({ ok: true })
      case 'card_added':
        return NextResponse.json(await finishCardSetup(stripe, customerId, body.setupIntentId, body.makeDefault === true))
      case 'set_default':
        await setDefaultCard(stripe, customerId, body.cardId)
        return NextResponse.json({ ok: true })
      case 'remove_card':
        await removeCard(stripe, createAdminClient(), user.id, customerId, body.cardId)
        return NextResponse.json({ ok: true })
      case 'update_details':
        await updateBillingDetails(stripe, customerId, body)
        return NextResponse.json({ ok: true })
      case 'retry_payment': {
        // Pay the late bill with a card already on file.
        const cardId = typeof body.cardId === 'string' ? body.cardId : ''
        const { data: pms } = await stripe.customers.listPaymentMethods(customerId, { limit: 20 })
        if (!pms.some((p) => p.id === cardId)) return NextResponse.json({ error: 'Unknown card.' }, { status: 404 })
        return NextResponse.json(await retryPastDue(stripe, customerId, cardId))
      }
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (err) {
    return fail(err, action || 'post')
  }
}
