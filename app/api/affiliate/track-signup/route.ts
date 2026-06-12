import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { getAffiliateByCode } from '../../../_lib/affiliate'

export const runtime = 'nodejs'

/**
 * POST /api/affiliate/track-signup  { code }
 * Idempotently links the signed-in user to an affiliate as a "signed_up"
 * referral (funnel stat). Safe to call repeatedly. Payment-time attribution
 * via the Stripe promo code remains the source of truth for commissions.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { code } = (await request.json().catch(() => ({}))) as { code?: string }
  if (!code) return NextResponse.json({ ok: false, reason: 'no code' })

  const affiliate = await getAffiliateByCode(code)
  if (!affiliate || affiliate.status !== 'active') return NextResponse.json({ ok: false, reason: 'invalid code' })
  // Self-referral guard.
  if (affiliate.user_id === user.id) return NextResponse.json({ ok: false, reason: 'self' })

  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('referrals')
    .select('id')
    .eq('affiliate_id', affiliate.id)
    .eq('referred_user_id', user.id)
    .single()
  if (existing) return NextResponse.json({ ok: true, already: true })

  await admin.from('referrals').insert({
    affiliate_id: affiliate.id,
    referred_user_id: user.id,
    status: 'signed_up',
    signup_at: new Date().toISOString(),
  })
  return NextResponse.json({ ok: true })
}
