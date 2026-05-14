import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status, referred_by, card_on_file, free_videos_remaining')
    .eq('id', user.id)
    .single()

  const subStatus = (profile?.subscription_status ?? '').toLowerCase()
  const isPaid = ['active', 'professional', 'pro', 'business', 'agency', 'starter'].includes(subStatus)
  const hasReferral = !!profile?.referred_by
  const cardOnFile = profile?.card_on_file ?? false
  const freeVideosRemaining = profile?.free_videos_remaining ?? 5

  if (isPaid) {
    return NextResponse.json({ isTrial: false, isPaid: true, hasReferral, cardOnFile, freeVideosRemaining: 0, videosUsed: 0, videosRemaining: 0 })
  }

  if (hasReferral) {
    return NextResponse.json({ isTrial: false, isPaid: false, hasReferral: true, cardOnFile, freeVideosRemaining, videosUsed: 0, videosRemaining: 0 })
  }

  const videosUsed = 5 - freeVideosRemaining

  return NextResponse.json({
    isTrial: freeVideosRemaining > 0,
    isPaid: false,
    hasReferral: false,
    cardOnFile,
    freeVideosRemaining,
    videosUsed,
    videosRemaining: freeVideosRemaining,
    trialExhausted: freeVideosRemaining <= 0 && !cardOnFile,
  })
}
