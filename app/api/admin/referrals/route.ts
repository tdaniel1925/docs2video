import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'

const ADMIN_EMAIL = 'trenttdaniel@gmail.com'

async function checkAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return null
  return user
}

export async function GET() {
  const user = await checkAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const admin = createAdminClient()

  // Get all profiles with referral data
  const { data: profiles, error } = await admin
    .from('profiles')
    .select('id, email, full_name, referral_code, referred_by, subscription_status, created_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Referrers: profiles that have a referral_code set
  const referrers = (profiles ?? []).filter((p: Record<string, unknown>) => p.referral_code)

  // Referred users: profiles that have a referred_by value
  const referredUsers = (profiles ?? []).filter((p: Record<string, unknown>) => p.referred_by)

  // Build referral stats: group referred users by their referred_by code
  const codeStats: Record<string, { count: number; latestSignup: string }> = {}
  for (const p of referredUsers) {
    const code = p.referred_by as string
    if (!codeStats[code]) {
      codeStats[code] = { count: 0, latestSignup: p.created_at as string }
    }
    codeStats[code].count++
    if (new Date(p.created_at as string) > new Date(codeStats[code].latestSignup)) {
      codeStats[code].latestSignup = p.created_at as string
    }
  }

  // Build summary table: for each referrer, attach their stats
  const referrerSummary = referrers.map((r: Record<string, unknown>) => ({
    email: r.email,
    referral_code: r.referral_code,
    subscription_status: r.subscription_status,
    total_signups: codeStats[r.referral_code as string]?.count ?? 0,
    latest_signup: codeStats[r.referral_code as string]?.latestSignup ?? null,
  }))

  return NextResponse.json({
    referrers: referrerSummary,
    referredUsers: referredUsers.map((p: Record<string, unknown>) => ({
      email: p.email,
      full_name: p.full_name,
      referred_by: p.referred_by,
      created_at: p.created_at,
    })),
  })
}

export async function POST(request: Request) {
  const user = await checkAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const body = await request.json()
  const { email, referral_code } = body as { email?: string; referral_code?: string }

  if (!email || !referral_code) {
    return NextResponse.json({ error: 'Email and referral_code are required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Find the user by email
  const { data: profiles, error: findError } = await admin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .limit(1)

  if (findError) return NextResponse.json({ error: findError.message }, { status: 500 })
  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Update the user's referral_code
  const { error: updateError } = await admin
    .from('profiles')
    .update({ referral_code })
    .eq('id', profiles[0].id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
