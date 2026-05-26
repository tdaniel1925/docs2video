import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { getStripe, VIDEO_PRICE_IDS } from '../../_lib/stripe'
import { getUserPrice, getProjectPrice, getUserTier, isProMember, isUnlimited, formatPrice } from '../../_lib/pricing'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * Resolve the correct Stripe Price ID for a project type + user tier.
 */
function resolveStripePriceId(projectType: string, tier: string): string | null {
  // Paid members get $5 rate, free tier gets $10 rate
  if (tier !== 'free') return VIDEO_PRICE_IDS.member
  return VIDEO_PRICE_IDS.free
}

/**
 * Creates a Stripe Checkout session for a single project purchase.
 * Business/Agency users get projects included in their plan (except courses for Business).
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { projectType, metadata } = await request.json() as {
    projectType: string
    metadata?: Record<string, string>
  }

  const projectPrice = getProjectPrice(projectType)
  if (!projectPrice) {
    return NextResponse.json({ error: 'Invalid project type' }, { status: 400 })
  }

  // Look up user tier
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status, stripe_customer_id')
    .eq('id', user.id)
    .single()

  const subStatus = profile?.subscription_status ?? null
  const tier = getUserTier(subStatus)
  const isPro = isProMember(subStatus)
  const price = getUserPrice(projectType, subStatus)

  // Business/Agency: non-course projects are included in the plan
  if (price === 0) {
    return NextResponse.json({
      url: null,
      price: 'Free',
      isPro: true,
      savings: null,
      included: true,
    })
  }

  const origin = request.headers.get('origin') ?? 'https://docs2video.com'
  const stripePriceId = resolveStripePriceId(projectType, tier)

  try {
    const stripe = getStripe()

    const sessionParams: Record<string, unknown> = {
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{ price: stripePriceId!, quantity: 1 }],
      success_url: `${origin}/dashboard?project_paid=${projectType}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/create`,
      metadata: {
        supabase_user_id: user.id,
        type: 'project_payment',
        project_type: projectType,
        tier,
        ...(metadata ?? {}),
      },
    }

    // Reuse existing Stripe customer if available
    if (profile?.stripe_customer_id) {
      sessionParams.customer = profile.stripe_customer_id
    } else {
      sessionParams.customer_email = user.email
    }

    const session = await stripe.checkout.sessions.create(
      sessionParams as Parameters<typeof stripe.checkout.sessions.create>[0]
    )

    return NextResponse.json({
      url: session.url,
      price: formatPrice(price),
      isPro,
      savings: isPro ? formatPrice(projectPrice.basePrice - price) : null,
    })
  } catch (err) {
    console.error('[pay-project] Error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Payment failed' }, { status: 500 })
  }
}

/**
 * GET: returns pricing for a project type for the current user
 */
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const url = new URL(request.url)
  const projectType = url.searchParams.get('type')

  if (!projectType) {
    // Return all prices
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_status')
      .eq('id', user.id)
      .single()

    const isPro = isProMember(profile?.subscription_status ?? null)

    const prices = (await import('../../_lib/pricing')).PROJECT_PRICES.map(p => ({
      type: p.type,
      label: p.label,
      description: p.description,
      price: isPro ? p.proPrice : p.basePrice,
      priceFormatted: formatPrice(isPro ? p.proPrice : p.basePrice),
      basePrice: p.basePrice,
      basePriceFormatted: formatPrice(p.basePrice),
      isPro,
      savings: isPro ? formatPrice(p.basePrice - p.proPrice) : null,
    }))

    return NextResponse.json({ prices, isPro })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status')
    .eq('id', user.id)
    .single()

  const subStatus = profile?.subscription_status ?? null
  const isPro = isProMember(subStatus)
  const price = getUserPrice(projectType, subStatus)
  const projectInfo = getProjectPrice(projectType)

  return NextResponse.json({
    type: projectType,
    price,
    priceFormatted: formatPrice(price),
    isPro,
    label: projectInfo?.label,
  })
}
