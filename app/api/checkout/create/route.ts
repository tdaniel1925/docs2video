import { NextRequest, NextResponse } from 'next/server'
import { getStripe, SUBSCRIPTION_PRICES } from '../../../_lib/stripe'
import { createAdminClient } from '../../../_lib/supabase/admin'

export const runtime = 'nodejs'

// =============================================================================
// Apex "return-to-Apex" checkout — server-to-server (Path B).
//
// Apex hosts the buy experience (name/email + card via Stripe Embedded Checkout
// on reachtheapex.net). It calls THIS endpoint to create a Stripe Customer + an
// embedded Checkout Session on DOCS2VIDEO's Stripe (Path B — D2V stays merchant
// of record) and returns the session client_secret so Apex mounts the embedded
// checkout. Only "pro" is sold via Apex for now.
//
// IMPORTANT: no Docs2Video account is created here. Provisioning happens in the
// Stripe checkout.session.completed webhook, AFTER payment, so abandoned
// checkouts leave nothing behind. All info the webhook needs travels in metadata
// (apex_email / apex_name / referral_source).
//
// Auth: bearer token shared with Apex (D2V_CHECKOUT_SECRET). Mirrors Jordyn's
// /api/checkout/create. See Apex PARTNER-SALES-INTEGRATION-SPEC.md.
// =============================================================================

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status })
}

// Apex sells the Pro tier for now. (plan 'retail'/'rep' from Apex maps to the
// Pro price; D2V's rep pricing is the same subscription — the comp difference is
// handled by BV on the Apex side, not a separate Stripe price.)
const APEX_TIER = 'pro' as const

export async function POST(req: NextRequest) {
  // 1) Authorize the server-to-server call from Apex.
  const secret = process.env.D2V_CHECKOUT_SECRET
  const auth = req.headers.get('authorization') ?? ''
  if (!secret || auth !== `Bearer ${secret}`) {
    return bad('Unauthorized', 401)
  }

  let body: {
    email?: string
    name?: string
    plan?: string
    referral_code?: string | null
    success_url?: string
    cancel_url?: string
  }
  try {
    body = await req.json()
  } catch {
    return bad('Invalid JSON body')
  }

  const email = String(body.email ?? '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return bad('A valid email is required.')
  }

  const priceId = SUBSCRIPTION_PRICES[APEX_TIER]
  if (!priceId) return bad('Subscription price is not configured.', 503)

  const referralSource = body.referral_code
    ? String(body.referral_code).trim().toLowerCase()
    : null

  const admin = createAdminClient()
  const stripe = getStripe()

  try {
    // 2) Do NOT create a D2V account here (would leave a ghost account for
    //    non-payers). Only look up whether this email already has one, so the
    //    webhook can update vs. create.
    const { data: existing } = await admin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()
    const existingUserId: string | undefined = existing?.id ?? undefined

    // 3) Stripe Customer on D2V's account (Path B — D2V = merchant). Cheap and
    //    account-less pre-payment.
    const customer = await stripe.customers.create({
      email,
      name: body.name ?? undefined,
      metadata: { source: 'apex', ...(existingUserId ? { supabase_user_id: existingUserId } : {}) },
    })

    // 4) Embedded Checkout Session. All info the webhook needs to provision the
    //    account (on payment) travels in metadata.
    const metadata: Record<string, string> = {
      type: 'subscription',
      tier: APEX_TIER,
      source: 'apex',
      apex_email: email,
      ...(body.name ? { apex_name: body.name } : {}),
      ...(existingUserId ? { supabase_user_id: existingUserId } : {}),
      ...(referralSource ? { referral_source: referralSource } : {}),
    }
    const returnUrl =
      body.success_url ||
      `${process.env.NEXT_PUBLIC_APP_URL || 'https://docs2video.com'}/dashboard?subscribed=${APEX_TIER}`

    const sessionParams: Record<string, unknown> = {
      mode: 'subscription',
      customer: customer.id,
      line_items: [{ price: priceId, quantity: 1 }],
      ...(existingUserId ? { client_reference_id: existingUserId } : {}),
      metadata,
      subscription_data: { metadata },
      ui_mode: 'embedded_page', // newer API renamed "embedded" → "embedded_page"
      return_url: returnUrl,
    }

    const session = await stripe.checkout.sessions.create(
      sessionParams as unknown as Parameters<typeof stripe.checkout.sessions.create>[0]
    )
    const clientSecret = (session as unknown as { client_secret?: string }).client_secret ?? null
    if (!clientSecret) {
      return bad('Could not initialize payment.', 502)
    }

    // 5) Hand Apex the client_secret + publishable key so it can mount Stripe's
    //    Embedded Checkout on reachtheapex.net.
    return NextResponse.json({
      client_secret: clientSecret,
      publishable_key: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? null,
      mode: 'embedded_checkout',
      customer_id: customer.id,
    })
  } catch (err) {
    console.error('[checkout/create] failed:', err)
    const message = err instanceof Error ? err.message : 'Checkout failed'
    return bad(message, 500)
  }
}
