import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { maxConcurrentForTier } from '../../_lib/subscription'
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

  // --- Plan / concurrency profile ---
  // BILLING MODEL = CREDITS ONLY. The single paywall is the credit wallet,
  // enforced in /api/generate-video (checkCredits/deductCredits). The legacy
  // "$10 per-video Stripe charge + free_videos_remaining" gate was removed
  // here because it ran IN ADDITION to the credit deduction (audit B3 dual
  // billing) and free_videos_remaining was never decremented (audit B4). Do
  // NOT re-introduce a charge here; add credits via subscriptions/top-ups.
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status, is_admin, is_beta')
    .eq('id', user.id)
    .single()

  const subStatus = (profile?.subscription_status ?? '').toLowerCase()
  const isTrial = false // no watermark concept under the credit model

  // Check concurrent generation limit based on plan
  const { count: inProgressCount } = await supabase
    .from('videos')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .in('status', ['pending', 'scripting', 'generating_audio', 'generating_slides', 'assembling'])

  // Concurrent limits by plan — shared helper so every tier (incl. agency /
  // enterprise-plus) is treated consistently with the live generate-video path.
  const maxConcurrent = maxConcurrentForTier(subStatus, {
    isAdmin: (profile as any)?.is_admin === true,
    isBeta: (profile as any)?.is_beta === true,
  })

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
