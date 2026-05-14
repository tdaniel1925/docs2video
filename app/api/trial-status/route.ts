import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status, referred_by')
    .eq('id', user.id)
    .single()

  const subStatus = (profile?.subscription_status ?? '').toLowerCase()
  const isPaid = ['active', 'professional', 'pro', 'business', 'agency', 'starter'].includes(subStatus)
  const hasReferral = !!profile?.referred_by

  if (isPaid) {
    return NextResponse.json({ isTrial: false, isPaid: true, hasReferral, videosUsed: 0, videosRemaining: 0 })
  }

  if (hasReferral) {
    return NextResponse.json({ isTrial: false, isPaid: false, hasReferral: true, videosUsed: 0, videosRemaining: 0 })
  }

  // Count non-failed videos
  const { count } = await supabase
    .from('videos')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .neq('status', 'failed')

  const videosUsed = count ?? 0
  const videosRemaining = Math.max(0, 2 - videosUsed)

  return NextResponse.json({
    isTrial: true,
    isPaid: false,
    hasReferral: false,
    videosUsed,
    videosRemaining,
    trialExhausted: videosUsed >= 2,
  })
}
