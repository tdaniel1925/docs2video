import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { stripe } from '../../../_lib/stripe'

export const runtime = 'nodejs'

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

    if (error || !quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    if (quote.status === 'paid') {
      return NextResponse.json({ error: 'Quote already paid' }, { status: 400 })
    }

    if (quote.status === 'draft') {
      return NextResponse.json({ error: 'Quote has not been sent yet' }, { status: 400 })
    }

    if (!quote.video_id) {
      return NextResponse.json({ error: 'Quote is not linked to a video' }, { status: 400 })
    }

    const profile = quote.profiles as { stripe_user_id: string | null; full_name: string | null; company_name: string | null } | null
    const agentStripeAccountId = profile?.stripe_user_id

    if (!agentStripeAccountId) {
      return NextResponse.json({ error: 'Agent has not connected a Stripe account' }, { status: 400 })
    }

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

    // Update quote status to viewed
    if (quote.status === 'sent') {
      await supabase.from('quotes').update({ status: 'viewed' }).eq('id', quoteId)
    }

    return NextResponse.json({ url: session.url })
  } catch (err: unknown) {
    console.error('[quotes/pay] Error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
