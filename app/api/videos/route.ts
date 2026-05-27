import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import type { ExtractedPolicyData } from '../../_lib/types'
import type { ExtractedData } from '../../_lib/extract-types'
export const maxDuration = 30

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data, error } = await supabase
    .from('videos')
    .select('*, brand:brands(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json()
  const { policyData, brandId, voiceId, assets, clientId } = body as {
    policyData: ExtractedPolicyData | ExtractedData
    brandId: string | null
    voiceId: string
    assets?: { url: string; tag: string }[]
    clientId?: string
  }

  // --- Free trial / pay-per-video gate ---
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status, referred_by, card_on_file, free_videos_remaining, stripe_customer_id, is_admin, is_beta')
    .eq('id', user.id)
    .single()

  const subStatus = (profile?.subscription_status ?? '').toLowerCase()
  const isPaid = ['active', 'professional', 'pro', 'business', 'enterprise', 'starter'].includes(subStatus)
  const hasReferral = !!profile?.referred_by
  const cardOnFile = profile?.card_on_file ?? false
  const freeVideosRemaining = profile?.free_videos_remaining ?? 0

  let isTrial = false
  if (!isPaid && !hasReferral) {
    if (freeVideosRemaining > 0) {
      // Free video — will be decremented after creation in generate-video
      isTrial = false // card on file = no watermark
    } else if (cardOnFile && profile?.stripe_customer_id) {
      // Auto-charge $10 per video
      const { stripe } = await import('../../_lib/stripe')

      // Get the customer's default payment method
      const customer = await stripe.customers.retrieve(profile.stripe_customer_id) as import('stripe').Stripe.Customer
      const defaultPm = customer.invoice_settings?.default_payment_method
        ?? (await stripe.paymentMethods.list({ customer: profile.stripe_customer_id, type: 'card', limit: 1 })).data[0]?.id

      if (!defaultPm) {
        return NextResponse.json(
          { error: 'No payment method on file. Please update your card.', code: 'NO_PAYMENT_METHOD' },
          { status: 402 }
        )
      }

      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: 1000, // $10.00
          currency: 'usd',
          customer: profile.stripe_customer_id,
          payment_method: typeof defaultPm === 'string' ? defaultPm : defaultPm.id,
          off_session: true,
          confirm: true,
          description: 'Docs2Video — Per-video charge',
          metadata: { user_id: user.id },
        })

        if (paymentIntent.status !== 'succeeded') {
          return NextResponse.json(
            { error: 'Payment failed. Please update your card.', code: 'PAYMENT_FAILED' },
            { status: 402 }
          )
        }
      } catch {
        return NextResponse.json(
          { error: 'Payment failed. Please update your card.', code: 'PAYMENT_FAILED' },
          { status: 402 }
        )
      }
    } else {
      // No card, no free videos
      return NextResponse.json(
        { error: 'Free videos used. Please add a payment method to continue.', code: 'TRIAL_EXHAUSTED' },
        { status: 403 }
      )
    }
  }

  // Check concurrent generation limit based on plan
  const { count: inProgressCount } = await supabase
    .from('videos')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .in('status', ['pending', 'scripting', 'generating_audio', 'generating_slides', 'assembling'])

  // Concurrent limits by plan
  const isAdmin = (profile as any)?.is_admin === true
  const isBeta = (profile as any)?.is_beta === true
  let maxConcurrent = 1 // Free / pay-per-project
  if (isAdmin || isBeta) maxConcurrent = 99
  else if (subStatus === 'enterprise') maxConcurrent = 5
  else if (subStatus === 'business') maxConcurrent = 3
  else if (['pro', 'professional'].includes(subStatus)) maxConcurrent = 2
  else if (['starter', 'active'].includes(subStatus)) maxConcurrent = 2

  if (inProgressCount && inProgressCount >= maxConcurrent) {
    const slots = maxConcurrent === 1 ? 'video' : `${maxConcurrent} videos`
    return NextResponse.json({
      error: `You can generate up to ${slots} at a time. ${inProgressCount} currently in progress.${maxConcurrent < 3 ? ' Upgrade your plan for more concurrent slots.' : ''}`,
      code: 'CONCURRENT_LIMIT',
    }, { status: 409 })
  }

  // Build a title from whichever data format we received
  const isInsurance = typeof (policyData as any).deathBenefit === 'number'
    && (policyData as any).deathBenefit > 0
    && !!(policyData as any).policyType
  const title = isInsurance
    ? `${(policyData as ExtractedPolicyData).carrier} - ${(policyData as ExtractedPolicyData).policyType} Explainer`
    : `${(policyData as ExtractedData).title || (policyData as any).companyName || 'Video'} Explainer`

  const insertData: Record<string, unknown> = {
    user_id: user.id,
    brand_id: brandId,
    title,
    voice_id: voiceId,
    status: 'pending',
    is_trial: isTrial,
    script: { _pipeline_input: { policyData, brandId, voiceId, assets } },
  }
  if (clientId) insertData.client_id = clientId

  const { data: video, error } = await supabase
    .from('videos')
    .insert(insertData)
    .select()
    .single()

  if (error || !video) {
    return NextResponse.json({ error: error?.message ?? 'Failed to create video' }, { status: 500 })
  }

  return NextResponse.json({ id: video.id })
}
