import { NextResponse } from 'next/server'
import { getStripe, tierFromPriceId } from '../../../_lib/stripe'
import { createAdminClient } from '../../../_lib/supabase/admin'
import type Stripe from 'stripe'
import { logError } from '../../../_lib/error-logger'

export const runtime = 'nodejs'

/**
 * POST /api/webhooks/stripe
 * Handles all Stripe webhook events for subscriptions and one-time payments.
 */
export async function POST(request: Request) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  const stripe = getStripe()
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[webhook] Signature verification failed:', message)
    logError('stripe-webhook', err, { detail: 'Signature verification failed' })
    return NextResponse.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 })
  }

  const supabase = createAdminClient()

  switch (event.type) {
    /* ─── One-time project payment completed ─── */
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.supabase_user_id
      if (!userId) break

      // Store the stripe_customer_id on the profile if not yet saved
      if (session.customer) {
        await supabase.from('profiles').update({
          stripe_customer_id: session.customer as string,
        }).eq('id', userId).is('stripe_customer_id', null)
      }

      if (session.metadata?.type === 'project_payment') {
        // Mark the project as paid — the caller should create the project
        // after seeing project_paid in the URL params. Log it for reference.
        console.log(`[webhook] Project payment completed for user ${userId}, type: ${session.metadata.project_type}`)

        // If there's a project_id in metadata, mark it paid in the DB
        if (session.metadata.project_id) {
          await supabase.from('projects').update({
            payment_status: 'paid',
            stripe_session_id: session.id,
          }).eq('id', session.metadata.project_id)
        }
        break
      }

      if (session.metadata?.type === 'subscription') {
        // Subscription checkout completed — update profile
        const tier = session.metadata.tier ?? 'pro'
        const subscriptionId = session.subscription as string

        await supabase.from('profiles').update({
          subscription_status: tier,
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: subscriptionId,
        }).eq('id', userId)

        console.log(`[webhook] User ${userId} subscribed to ${tier}`)
      }
      break
    }

    /* ─── New subscription created ─── */
    case 'customer.subscription.created': {
      const subscription = event.data.object as Stripe.Subscription
      const userId = subscription.metadata?.supabase_user_id
      const customerId = subscription.customer as string
      const priceId = subscription.items.data[0]?.price?.id
      const tier = priceId ? tierFromPriceId(priceId) : (subscription.metadata?.tier ?? 'pro')

      const updateData: Record<string, unknown> = {
        subscription_status: tier,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
      }

      if (userId) {
        await supabase.from('profiles').update(updateData).eq('id', userId)
      } else {
        await supabase.from('profiles').update(updateData).eq('stripe_customer_id', customerId)
      }

      console.log(`[webhook] Subscription created: ${tier} for customer ${customerId}`)
      break
    }

    /* ─── Subscription updated (upgrade/downgrade/status change) ─── */
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const customerId = subscription.customer as string
      const priceId = subscription.items.data[0]?.price?.id

      if (subscription.status === 'active') {
        const tier = priceId ? tierFromPriceId(priceId) : 'pro'
        await supabase.from('profiles').update({
          subscription_status: tier,
          stripe_subscription_id: subscription.id,
        }).eq('stripe_customer_id', customerId)
        console.log(`[webhook] Subscription updated to ${tier} for customer ${customerId}`)
      } else if (['canceled', 'unpaid', 'past_due'].includes(subscription.status)) {
        await supabase.from('profiles').update({
          subscription_status: null,
          stripe_subscription_id: null,
        }).eq('stripe_customer_id', customerId)
        console.log(`[webhook] Subscription status ${subscription.status} for customer ${customerId}`)
      }
      break
    }

    /* ─── Subscription cancelled/deleted ─── */
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const customerId = subscription.customer as string

      await supabase.from('profiles').update({
        subscription_status: null,
        stripe_subscription_id: null,
      }).eq('stripe_customer_id', customerId)

      console.log(`[webhook] Subscription deleted for customer ${customerId}`)
      break
    }

    /* ─── Recurring payment succeeded ─── */
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice
      const customerId = invoice.customer as string
      // Only log for subscription renewals (not the initial payment)
      if (invoice.billing_reason === 'subscription_cycle') {
        console.log(`[webhook] Recurring payment succeeded for customer ${customerId}, amount: ${invoice.amount_paid}`)
      }
      break
    }

    /* ─── Payment failed ─── */
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const customerId = invoice.customer as string
      console.error(`[webhook] Payment failed for customer ${customerId}, invoice ${invoice.id}`)
      // Don't immediately revoke access — Stripe retries. Mark as past_due.
      // The subscription.updated event will handle the status change.
      break
    }

    default:
      console.log(`[webhook] Unhandled event type: ${event.type}`)
  }

  return NextResponse.json({ received: true })
}
