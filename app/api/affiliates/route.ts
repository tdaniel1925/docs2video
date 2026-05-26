import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'

export const runtime = 'nodejs'
export const maxDuration = 30

// GET: get current user's affiliate info
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createAdminClient()

  const { data: affiliate } = await admin
    .from('affiliates')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!affiliate) {
    return NextResponse.json({ affiliate: null })
  }

  // Get recent referrals
  const { data: referrals } = await admin
    .from('referrals')
    .select('*')
    .eq('affiliate_id', affiliate.id)
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({ affiliate, referrals: referrals ?? [] })
}

// POST: join affiliate program
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createAdminClient()

  // Check if already an affiliate
  const { data: existing } = await admin
    .from('affiliates')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'Already enrolled' }, { status: 400 })
  }

  const body = await request.json().catch(() => ({}))
  const payoutEmail = (body as any).payoutEmail || user.email

  // Generate unique referral code
  const { data: profile } = await admin
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const namePart = (profile?.full_name ?? 'user')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 10)
  const randomPart = Math.random().toString(36).slice(2, 6)
  const referralCode = `${namePart}${randomPart}`

  const { data: affiliate, error } = await admin
    .from('affiliates')
    .insert({
      user_id: user.id,
      referral_code: referralCode,
      payout_email: payoutEmail,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ affiliate })
}
