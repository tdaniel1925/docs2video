import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '../../../_lib/supabase/server'
import { getStripe } from '../../../_lib/stripe'
import { getAffiliateByCode } from '../../../_lib/affiliate'
export const maxDuration = 30

const CREDIT_PACKS: Record<string, { credits: number; priceEnv: string }> = {
  starter: { credits: 2500, priceEnv: 'STRIPE_PRICE_CREDIT_PACK_2500' },
  power: { credits: 7500, priceEnv: 'STRIPE_PRICE_CREDIT_PACK_7500' },
  studio: { credits: 18000, priceEnv: 'STRIPE_PRICE_CREDIT_PACK_18000' },
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { pack } = await request.json() as { pack: string }
  const packInfo = CREDIT_PACKS[pack]
  if (!packInfo) return NextResponse.json({ error: 'Invalid pack' }, { status: 400 })

  // Trim stray whitespace/newlines that can sneak into env values (a trailing
  // "\n" in the price id breaks the Stripe line item; in the site URL it makes
  // success_url an invalid URL → "Not a valid URL" on redirect).
  const priceId = (process.env[packInfo.priceEnv] || '').trim()
  if (!priceId) return NextResponse.json({ error: 'Credit packs not configured yet' }, { status: 500 })

  // COME BACK TO THE SITE YOU LEFT FROM. This used NEXT_PUBLIC_SITE_URL, which
  // is docs2video.com — so a Text2Art customer who bought credits was dropped
  // on a different company's website immediately after paying. The subscription
  // and billing-portal routes already keyed off the request origin; this one
  // did not, and there is now more than one front door.
  //
  // Only our own hosts are honoured. `origin` is attacker-controllable, and an
  // open redirect on a payment success page is a phishing gift.
  const ALLOWED = ['https://docs2video.com', 'https://www.docs2video.com', 'https://text2art.app', 'https://www.text2art.app']
  const origin = (request.headers.get('origin') || '').trim().replace(/\/+$/, '')
  const siteUrl = ALLOWED.includes(origin)
    ? origin
    : (process.env.NEXT_PUBLIC_SITE_URL || 'https://docs2video.com').trim().replace(/\/+$/, '')

  try {
    const stripe = getStripe()

    // Get or create Stripe customer
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    let customerId = profile?.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email!,
        metadata: { supabase_user_id: user.id },
      })
      // Only claim the slot if still empty; a parallel request may have won.
      const { data: claimed } = await supabase
        .from('profiles')
        .update({ stripe_customer_id: customer.id })
        .eq('id', user.id)
        .is('stripe_customer_id', null)
        .select('stripe_customer_id')
      if (claimed && claimed.length > 0) {
        customerId = customer.id
      } else {
        const { data: refreshed } = await supabase
          .from('profiles')
          .select('stripe_customer_id')
          .eq('id', user.id)
          .single()
        customerId = refreshed?.stripe_customer_id || customer.id
      }
    }

    const sessionParams = {
      customer: customerId,
      mode: 'payment' as const,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/settings?credits=success`,
      cancel_url: `${siteUrl}/pricing`,
      metadata: {
        type: 'credit_pack',
        pack,
        credits: String(packInfo.credits),
        // Webhook reads supabase_user_id — without it, credits are never granted
        supabase_user_id: user.id,
        user_id: user.id,
      },
    }

    // Affiliate attribution: auto-apply the referrer's Stripe promo code if the
    // buyer arrived via a referral link (d2v_ref cookie). Mirrors the
    // subscription checkout. Stripe forbids discounts + allow_promotion_codes
    // together, so pick one.
    let appliedReferral = false
    try {
      const refCode = (await cookies()).get('d2v_ref')?.value
      if (refCode) {
        const affiliate = await getAffiliateByCode(refCode)
        if (affiliate && affiliate.status === 'active' && affiliate.user_id !== user.id && affiliate.stripe_promo_code_id) {
          (sessionParams as any).discounts = [{ promotion_code: affiliate.stripe_promo_code_id }]
          appliedReferral = true
        }
      }
    } catch (e) {
      console.warn('[credits/buy] referral cookie handling failed (non-fatal):', e)
    }
    if (!appliedReferral) (sessionParams as any).allow_promotion_codes = true

    let session
    try {
      session = await stripe.checkout.sessions.create(sessionParams)
    } catch (err) {
      // Self-heal stale customer IDs: replace the dead reference and retry
      if (err instanceof Error && err.message.includes('No such customer')) {
        console.warn(`[credits/buy] Stale stripe_customer_id for user ${user.id} — recreating`)
        const customer = await stripe.customers.create({
          email: user.email!,
          metadata: { supabase_user_id: user.id },
        })
        await supabase.from('profiles').update({ stripe_customer_id: customer.id }).eq('id', user.id)
        session = await stripe.checkout.sessions.create({ ...sessionParams, customer: customer.id })
      } else {
        throw err
      }
    }

    if (!session.url || !/^https?:\/\//.test(session.url)) {
      console.error('[credits/buy] Stripe returned no valid checkout url')
      return NextResponse.json({ error: 'Checkout could not be started. Please try again.' }, { status: 502 })
    }
    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[credits/buy] Error:', err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Failed to create checkout',
    }, { status: 500 })
  }
}
