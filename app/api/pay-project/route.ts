import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { getStripe } from '../../_lib/stripe'
import { getUserPrice, getProjectPrice, isProMember, formatPrice } from '../../_lib/pricing'

export const runtime = 'nodejs'

/**
 * Creates a Stripe Checkout session for a single project purchase.
 * User pays per project — no credits involved.
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

  // Check if user is Pro for discount
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status')
    .eq('id', user.id)
    .single()

  const isPro = isProMember(profile?.subscription_status ?? null)
  const price = getUserPrice(projectType, isPro)

  const origin = request.headers.get('origin') ?? 'https://docs2video.com'

  try {
    const stripe = getStripe()
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: projectPrice.label,
            description: projectPrice.description,
          },
          unit_amount: price,
        },
        quantity: 1,
      }],
      success_url: `${origin}/dashboard?project_paid=${projectType}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/create`,
      metadata: {
        supabase_user_id: user.id,
        type: 'project_payment',
        project_type: projectType,
        is_pro: isPro ? 'true' : 'false',
        ...(metadata ?? {}),
      },
      customer_email: user.email,
    })

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

  const isPro = isProMember(profile?.subscription_status ?? null)
  const price = getUserPrice(projectType, isPro)
  const projectInfo = getProjectPrice(projectType)

  return NextResponse.json({
    type: projectType,
    price,
    priceFormatted: formatPrice(price),
    isPro,
    label: projectInfo?.label,
  })
}
