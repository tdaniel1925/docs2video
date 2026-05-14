import { NextResponse } from 'next/server'
import { getStripe, tierFromPriceId } from '../../../_lib/stripe'
import { createAdminClient } from '../../../_lib/supabase/admin'
import type Stripe from 'stripe'

export const runtime = 'nodejs'

/**
 * POST /api/stripe/webhook
 * Legacy webhook endpoint — forwards to the same logic as /api/webhooks/stripe.
 * Keep both endpoints active so existing Stripe dashboard configs still work.
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
    return NextResponse.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 })
  }

  const supabase = createAdminClient()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.supabase_user_id
      if (!userId) break

      if (session.metadata?.type === 'project_payment') {
        if (session.metadata.project_id) {
          await supabase.from('projects').update({
            payment_status: 'paid',
            stripe_session_id: session.id,
          }).eq('id', session.metadata.project_id)
        }
        console.log(`[webhook] Project payment for user ${userId}`)
        break
      }

      if (session.metadata?.type === 'subscription') {
        const tier = session.metadata.tier ?? 'pro'
        await supabase.from('profiles').update({
          subscription_status: tier,
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
        }).eq('id', userId)
        console.log(`[webhook] User ${userId} subscribed to ${tier}`)
      }
      break
    }

    case 'customer.subscription.created':
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
      } else if (['canceled', 'unpaid', 'past_due'].includes(subscription.status)) {
        await supabase.from('profiles').update({
          subscription_status: null,
          stripe_subscription_id: null,
        }).eq('stripe_customer_id', customerId)
      }
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const customerId = subscription.customer as string
      await supabase.from('profiles').update({
        subscription_status: null,
        stripe_subscription_id: null,
      }).eq('stripe_customer_id', customerId)
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      console.error(`[webhook] Payment failed for customer ${invoice.customer}`)
      break
    }
  }

  return NextResponse.json({ received: true })
}
