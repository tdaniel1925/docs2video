import { NextResponse } from 'next/server'
import { getStripe } from '../../../_lib/stripe'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { logError } from '../../../_lib/error-logger'
import type Stripe from 'stripe'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * POST /api/webhooks/stripe-connect
 * Receives events from agents' CONNECTED Stripe accounts (Stripe Connect).
 * Quote checkouts run on the connected account (api/quotes/pay sets
 * stripeAccount), so the platform webhook never sees them — this endpoint does.
 *
 * Stripe dashboard setup: add a SECOND webhook endpoint pointed here, with
 * "Listen to events on Connected accounts" enabled, subscribed to
 * checkout.session.completed. Put its signing secret in
 * STRIPE_CONNECT_WEBHOOK_SECRET.
 *
 * On a paid quote: mark it paid (idempotent) + atomically increment the
 * client's total_revenue.
 */
export async function POST(request: Request) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')
  const secret = (process.env.STRIPE_CONNECT_WEBHOOK_SECRET || '').trim()
  if (!sig || !secret) {
    return NextResponse.json({ error: 'Not configured' }, { status: 400 })
  }

  const stripe = getStripe()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'bad signature'
    logError('stripe-connect-webhook', err, { detail: 'Signature verification failed' })
    return NextResponse.json({ error: `Webhook signature failed: ${message}` }, { status: 400 })
  }

  const supabase = createAdminClient()

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const quoteId = session.metadata?.quote_id
      if (!quoteId) return NextResponse.json({ received: true })

      // Load the quote; only act if it isn't already paid (idempotent — Stripe
      // may redeliver, and the platform must never double-count revenue).
      const { data: quote } = await supabase
        .from('quotes')
        .select('id, user_id, client_id, client_email, total, status')
        .eq('id', quoteId)
        .single()
      if (!quote || quote.status === 'paid') return NextResponse.json({ received: true })

      const { error: payErr } = await supabase
        .from('quotes')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', quoteId)
        .neq('status', 'paid') // guard against a concurrent redelivery
      if (payErr) {
        // 500 so Stripe retries; idempotency is the status='paid' guard above.
        return NextResponse.json({ error: payErr.message }, { status: 500 })
      }

      // Atomically credit the client's revenue.
      const amount = Number(quote.total) || 0
      if (amount > 0) {
        const { error: revErr } = await supabase.rpc('increment_client_revenue', {
          p_client_id: quote.client_id ?? null,
          p_user_id: quote.user_id ?? null,
          p_client_email: quote.client_email ?? null,
          p_amount_cents: amount,
        })
        if (revErr) console.error('[stripe-connect] revenue increment failed:', revErr.message)
      }
      console.log(`[stripe-connect] quote ${quoteId} marked paid (+${amount}¢)`)
    }
    return NextResponse.json({ received: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'handler error'
    console.error('[stripe-connect] handler error:', message)
    logError('stripe-connect-webhook-handler', err, { eventType: event.type, eventId: event.id })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
