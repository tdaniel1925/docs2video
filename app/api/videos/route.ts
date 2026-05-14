import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import type { ExtractedPolicyData } from '../../_lib/types'
import type { ExtractedData } from '../../_lib/extract-types'

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
  const { policyData, brandId, voiceId } = body as {
    policyData: ExtractedPolicyData | ExtractedData
    brandId: string | null
    voiceId: string
  }

  // --- Free trial gate ---
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status, referred_by')
    .eq('id', user.id)
    .single()

  const subStatus = (profile?.subscription_status ?? '').toLowerCase()
  const isPaid = ['active', 'professional', 'pro', 'business', 'agency', 'starter'].includes(subStatus)
  const hasReferral = !!profile?.referred_by

  let isTrial = false
  if (!isPaid && !hasReferral) {
    // Count completed + in-progress videos (anything not failed)
    const { count } = await supabase
      .from('videos')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .neq('status', 'failed')

    if ((count ?? 0) >= 2) {
      return NextResponse.json(
        { error: 'Free trial used. You have used your 2 free videos. Please choose a plan to continue.', code: 'TRIAL_EXHAUSTED' },
        { status: 403 }
      )
    }
    isTrial = true
  }

  // Build a title from whichever data format we received
  const title = 'deathBenefit' in policyData
    ? `${(policyData as ExtractedPolicyData).carrier} - ${(policyData as ExtractedPolicyData).policyType} Explainer`
    : `${(policyData as ExtractedData).title} Explainer`

  const { data: video, error } = await supabase
    .from('videos')
    .insert({
      user_id: user.id,
      brand_id: brandId,
      title,
      voice_id: voiceId,
      status: 'pending',
      is_trial: isTrial,
      script: { _pipeline_input: { policyData, brandId, voiceId } },
    })
    .select()
    .single()

  if (error || !video) {
    return NextResponse.json({ error: error?.message ?? 'Failed to create video' }, { status: 500 })
  }

  return NextResponse.json({ id: video.id })
}
