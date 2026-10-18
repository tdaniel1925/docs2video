import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import type Stripe from 'stripe'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { getStripe } from '../../../_lib/stripe'
import { getAffiliateByCode } from '../../../_lib/affiliate'
import { isCardless } from '../../../_lib/cardless-prep'
import { safeReturnOrigin } from '../../../_lib/billing'
import { ensureStripeCustomer, inlineSessionBase } from '../../../_lib/stripe-customer'
export const maxDuration = 30

const CREDIT_PACKS: Record<string, { credits: number; priceEnv: string }> = {
  starter: { credits: 2500, priceEnv: 'STRIPE_PRICE_CREDIT_PACK_2500' },
  power: { credits: 7500, priceEnv: 'STRIPE_PRICE_CREDIT_PACK_7500' },
  studio: { credits: 18000, priceEnv: 'STRIPE_PRICE_CREDIT_PACK_18000' },
}

/**
 * POST /api/credits/buy  { pack }
 * Opens an IN-APP payment for a credit pack (2026-10-14): returns the client
 * secret of a Checkout Session in ui_mode 'elements', which the top-up pop-up
 * pays with Stripe's Payment Element — the buyer never leaves the app.
 * Credits are still granted ONLY by the webhook / reconcile cron / the
 * pop-up's status check, all with the same per-session key `pack:{sessionId}`,
 * so they can never be granted twice.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  // LIGHT START: an account with no card can look around (and preview), but
  // the card-required rule (credits.ts) would stop it spending a pack it
  // bought — so it adds a card first, which starts the free trial.
  if (await isCardless(user.id)) {
    return NextResponse.json({ error: 'Add a card first — it starts your free trial. Then you can top up any time.', code: 'card_required' }, { status: 402 })
  }

  const { pack } = (await request.json().catch(() => ({}))) as { pack?: string }
  const packInfo = pack ? CREDIT_PACKS[pack] : undefined
  if (!pack || !packInfo) return NextResponse.json({ error: 'Invalid pack' }, { status: 400 })

  // Trim stray whitespace/newlines that can sneak into env values (a trailing
  // "\n" in the price id breaks the Stripe line item).
  const priceId = (process.env[packInfo.priceEnv] || '').trim()
  if (!priceId) return NextResponse.json({ error: 'Credit packs not configured yet' }, { status: 500 })

  // Only our own hosts (plus localhost in development) — see safeReturnOrigin.
  const origin = safeReturnOrigin(request)

  try {
    const stripe = getStripe()
    const customerId = await ensureStripeCustomer(createAdminClient(), stripe, { id: user.id, email: user.email })

    const metadata = {
      type: 'credit_pack',
      pack,
      credits: String(packInfo.credits),
      // Webhook reads supabase_user_id — without it, credits are never granted
      supabase_user_id: user.id,
      user_id: user.id,
    }
    const sessionParams: Record<string, unknown> = {
      ...inlineSessionBase(origin),
      customer: customerId,
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      metadata,
      // A receipt (invoice + PDF) for the pack, so it shows in Settings →
      // Billing → Invoices and receipts like every plan payment does.
      invoice_creation: { enabled: true, invoice_data: { metadata: { type: 'credit_pack', pack } } },
    }

    // Affiliate attribution: auto-apply the referrer's Stripe promo code if the
    // buyer arrived via a referral link (d2v_ref cookie). Mirrors the
    // subscription checkout.
    //
    // NO manual promo-code box on credit packs (audit, Low): subscription
    // codes like WELCOME50 ("50% off your first month") also worked on packs,
    // so anyone could buy credits at half price. Packs are already discounted
    // by size; marketing codes are for plans.
    try {
      const refCode = (await cookies()).get('d2v_ref')?.value
      if (refCode) {
        const affiliate = await getAffiliateByCode(refCode)
        if (affiliate && affiliate.status === 'active' && affiliate.user_id !== user.id && affiliate.stripe_promo_code_id) {
          sessionParams.discounts = [{ promotion_code: affiliate.stripe_promo_code_id }]
        }
      }
    } catch (e) {
      console.warn('[credits/buy] referral cookie handling failed (non-fatal):', e)
    }

    const session = await stripe.checkout.sessions.create(sessionParams as unknown as Stripe.Checkout.SessionCreateParams)
    if (!session.client_secret) {
      console.error('[credits/buy] Stripe returned no client secret')
      return NextResponse.json({ error: 'The payment form could not be opened. Please try again.' }, { status: 502 })
    }
    return NextResponse.json({ clientSecret: session.client_secret, sessionId: session.id })
  } catch (err) {
    // Raw Stripe detail stays in the log; the user gets a plain sentence.
    console.error('[credits/buy] Error:', err)
    return NextResponse.json({
      error: 'We could not open the payment form just now. Please try again in a minute.',
    }, { status: 500 })
  }
}
