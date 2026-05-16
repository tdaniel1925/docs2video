import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import crypto from 'crypto'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('referral_code').eq('id', user.id).single()

  const admin = createAdminClient()
  const { data: referrals } = await admin
    .from('referrals')
    .select('id, referred_user_id, status, commission_amount, created_at')
    .eq('affiliate_id', user.id)
    .order('created_at', { ascending: false })

  const stats = {
    total: referrals?.length ?? 0,
    converted: referrals?.filter(r => r.status === 'converted' || r.status === 'rewarded').length ?? 0,
    pending: referrals?.filter(r => r.status === 'pending').length ?? 0,
    rewarded: referrals?.filter(r => r.status === 'rewarded').reduce((sum, r) => sum + (r.commission_amount ?? 0), 0) ?? 0,
  }

  return NextResponse.json({
    referral_code: profile?.referral_code ?? null,
    referrals: referrals ?? [],
    stats,
  })
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('referral_code').eq('id', user.id).single()

  if (profile?.referral_code) {
    return NextResponse.json({ referral_code: profile.referral_code })
  }

  const code = crypto.randomBytes(4).toString('hex')
  await supabase.from('profiles').update({ referral_code: code }).eq('id', user.id)

  return NextResponse.json({ referral_code: code })
}
