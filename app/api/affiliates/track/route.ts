import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../_lib/supabase/admin'

export const runtime = 'nodejs'
export const maxDuration = 30

// POST: track a referral click or signup
export async function POST(request: Request) {
  const { ref, event, userId } = await request.json() as {
    ref: string
    event: 'click' | 'signup' | 'conversion'
    userId?: string
  }

  if (!ref) return NextResponse.json({ error: 'Missing ref' }, { status: 400 })

  const admin = createAdminClient()

  // Look up affiliate by referral code
  const { data: affiliate } = await admin
    .from('affiliates')
    .select('id, user_id')
    .eq('referral_code', ref)
    .eq('status', 'active')
    .single()

  if (!affiliate) {
    return NextResponse.json({ error: 'Invalid referral code' }, { status: 404 })
  }

  // Don't let affiliates refer themselves
  if (userId && userId === affiliate.user_id) {
    return NextResponse.json({ error: 'Self-referral not allowed' }, { status: 400 })
  }

  if (event === 'click') {
    await admin.from('referrals').insert({
      affiliate_id: affiliate.id,
      status: 'clicked',
    })
    // Increment total referrals
    const { data: aff } = await admin.from('affiliates').select('total_referrals').eq('id', affiliate.id).single()
    await admin.from('affiliates').update({
      total_referrals: ((aff?.total_referrals as number) ?? 0) + 1,
    }).eq('id', affiliate.id)
  }

  if (event === 'signup' && userId) {
    // Update the most recent click to a signup
    const { data: recentClick } = await admin
      .from('referrals')
      .select('id')
      .eq('affiliate_id', affiliate.id)
      .eq('status', 'clicked')
      .is('referred_user_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (recentClick) {
      await admin.from('referrals').update({
        referred_user_id: userId,
        status: 'signed_up',
        signup_at: new Date().toISOString(),
      }).eq('id', recentClick.id)
    } else {
      // Create new referral record
      await admin.from('referrals').insert({
        affiliate_id: affiliate.id,
        referred_user_id: userId,
        status: 'signed_up',
        signup_at: new Date().toISOString(),
      })
    }

    // Award 5 free credits to the affiliate for the signup
    const { data: affProfile } = await admin
      .from('profiles')
      .select('credits_remaining')
      .eq('id', affiliate.user_id)
      .single()

    if (affProfile) {
      await admin.from('profiles').update({
        credits_remaining: (affProfile.credits_remaining ?? 0) + 5,
      }).eq('id', affiliate.user_id)

      await admin.from('affiliates').update({
        credits_earned: ((affiliate as any).credits_earned ?? 0) + 5,
      }).eq('id', affiliate.id)
    }
  }

  if (event === 'conversion' && userId) {
    // Mark referral as converted, calculate commission
    await admin.from('referrals').update({
      status: 'converted',
      conversion_at: new Date().toISOString(),
    })
      .eq('affiliate_id', affiliate.id)
      .eq('referred_user_id', userId)

    await admin.from('affiliates').update({
      total_conversions: ((affiliate as any).total_conversions ?? 0) + 1,
    }).eq('id', affiliate.id)
  }

  return NextResponse.json({ success: true })
}
