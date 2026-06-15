import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { stripe } from '../../../_lib/stripe'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(request: Request) {
  try {
    const { quoteId } = (await request.json()) as { quoteId: string }
    if (!quoteId) {
      return NextResponse.json({ error: 'Missing quoteId' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Load the quote with agent profile
    const { data: quote, error } = await supabase
      .from('quotes')
      .select('*, profiles:user_id(stripe_user_id, full_name, company_name)')
      .eq('id', quoteId)
      .single()

    const profile = quote?.profiles as { stripe_user_id: string | null; full_name: string | null; company_name: string | null } | null
    // Single generic error for ALL non-payable states (missing, paid, draft, no
    // video, agent has no Stripe) so an attacker can't enumerate quote ids or
    // learn their status / whether the agent has Stripe connected.
    const notPayable =
      error || !quote ||
      quote.status === 'paid' ||
      quote.status === 'draft' ||
      !quote.video_id ||
      !profile?.stripe_user_id
    if (notPayable) {
      return NextResponse.json({ error: 'This quote is not available for payment.' }, { status: 400 })
    }
    const agentStripeAccountId = profile!.stripe_user_id as string

    const origin = request.headers.get('origin') ?? ''

    // Build line items for Stripe Checkout
    const lineItems = (quote.line_items as { description: string; amount: number }[]).map((item) => ({
      price_data: {
        currency: quote.currency ?? 'usd',
        product_data: { name: item.description },
        unit_amount: item.amount,
      },
      quantity: 1,
    }))

    // Add tax as a line item if present
    if (quote.tax > 0) {
      lineItems.push({
        price_data: {
          currency: quote.currency ?? 'usd',
          product_data: { name: 'Tax' },
          unit_amount: quote.tax,
        },
        quantity: 1,
      })
    }

    const sessionParams: Record<string, unknown> = {
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: lineItems,
      success_url: `${origin}/watch/${quote.video_id ?? ''}?paid=true`,
      cancel_url: `${origin}/watch/${quote.video_id ?? ''}?cancelled=true`,
      metadata: { quote_id: quoteId },
    }

    if (quote.client_email) {
      sessionParams.customer_email = quote.client_email
    }

    // Create checkout session on the AGENT's Stripe account
    const session = await stripe.checkout.sessions.create(
      sessionParams as Parameters<typeof stripe.checkout.sessions.create>[0],
      { stripeAccount: agentStripeAccountId },
    )

    // (View-tracking intentionally NOT done here — an unauthenticated POST to
    // the pay endpoint must not be able to flip a quote's status. View state is
    // tracked on the watch page's own view event.)

    return NextResponse.json({ url: session.url })
  } catch (err: unknown) {
    console.error('[quotes/pay] Error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
