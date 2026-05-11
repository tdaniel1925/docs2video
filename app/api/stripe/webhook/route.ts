import { NextResponse } from 'next/server'
import { stripe, PLANS } from '../../../_lib/stripe'
import { createAdminClient } from '../../../_lib/supabase/admin'
import type Stripe from 'stripe'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

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

      // Credit pack purchase
      if (session.metadata?.type === 'credit_pack') {
        const creditCount = parseInt(session.metadata.credit_count ?? '0', 10)
        if (creditCount > 0) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('credits_remaining')
            .eq('id', userId)
            .single()
          const current = profile?.credits_remaining ?? 0
          await supabase.from('profiles').update({
            credits_remaining: current + creditCount,
          }).eq('id', userId)
          console.log(`[webhook] Added ${creditCount} credits to user ${userId}`)
        }
        break
      }

      // Subscription purchase — determine plan from price ID
      const subscriptionId = session.subscription as string
      let planName = 'active'
      if (subscriptionId) {
        try {
          const sub = await stripe.subscriptions.retrieve(subscriptionId)
          const priceId = sub.items.data[0]?.price?.id
          if (priceId) {
            const matchedPlan = Object.entries(PLANS).find(([, p]) => p.priceId === priceId)
            if (matchedPlan) planName = matchedPlan[1].name.toLowerCase()
          }
        } catch { /* use default */ }
      }

      // Also look at metadata for plan
      if (session.metadata?.plan_id && session.metadata.plan_id in PLANS) {
        planName = PLANS[session.metadata.plan_id as keyof typeof PLANS].name.toLowerCase()
      }

      // Set credits for the plan
      const planEntry = Object.values(PLANS).find(p => p.name.toLowerCase() === planName)
      const planCredits = planEntry?.credits ?? 0

      await supabase.from('profiles').update({
        subscription_status: planName,
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: subscriptionId,
        credits_remaining: planCredits,
      }).eq('id', userId)

      console.log(`[webhook] User ${userId} subscribed to ${planName} with ${planCredits} credits`)
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const customerId = subscription.customer as string

      if (subscription.status === 'active') {
        // Determine plan from price
        const priceId = subscription.items.data[0]?.price?.id
        let planName = 'active'
        if (priceId) {
          const matchedPlan = Object.entries(PLANS).find(([, p]) => p.priceId === priceId)
          if (matchedPlan) planName = matchedPlan[1].name.toLowerCase()
        }
        const planEntry = Object.values(PLANS).find(p => p.name.toLowerCase() === planName)
        await supabase.from('profiles').update({
          subscription_status: planName,
          credits_remaining: planEntry?.credits ?? 0,
        }).eq('stripe_customer_id', customerId)
      } else {
        await supabase.from('profiles').update({
          subscription_status: 'cancelled',
        }).eq('stripe_customer_id', customerId)
      }
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const customerId = subscription.customer as string
      await supabase.from('profiles').update({
        subscription_status: 'free',
        credits_remaining: PLANS.free.credits,
      }).eq('stripe_customer_id', customerId)
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const customerId = invoice.customer as string
      await supabase.from('profiles').update({
        subscription_status: 'expired',
      }).eq('stripe_customer_id', customerId)
      break
    }
  }

  return NextResponse.json({ received: true })
}
