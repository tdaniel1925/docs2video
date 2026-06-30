import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { isAdmin , isAdminRequest } from '../../../_lib/admin'
export const maxDuration = 30

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await isAdminRequest(user))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  try {
    const [profileRes, videosRes, quotesRes, emailsRes, referralsRes, balanceRes] = await Promise.all([
      admin.from('profiles').select('*').eq('id', id).single(),
      admin.from('videos').select('*').eq('user_id', id).order('created_at', { ascending: false }),
      admin.from('quotes').select('*').eq('user_id', id).order('created_at', { ascending: false }),
      admin.from('email_connections').select('*').eq('user_id', id).order('created_at', { ascending: false }),
      admin.from('profiles').select('id, email, full_name').eq('referred_by', id),
      admin.from('credit_balances').select('balance, topup_balance').eq('user_id', id).maybeSingle(),
    ])

    if (!profileRes.data) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Show the REAL spendable balance (credit_balances = monthly + topup), not the
    // dead legacy profiles.credits_remaining column — same overlay /api/admin/data
    // already does for the user list. Without this the detail page showed a stale
    // value (e.g. 10) while the wallet had thousands.
    const realCredits = (balanceRes.data?.balance ?? 0) + (balanceRes.data?.topup_balance ?? 0)

    return NextResponse.json({
      profile: { ...profileRes.data, credits_remaining: realCredits },
      videos: videosRes.data ?? [],
      quotes: quotesRes.data ?? [],
      emailConnections: emailsRes.data ?? [],
      referrals: referralsRes.data ?? [],
    })
  } catch (err) {
    console.error('[admin/user-detail] Error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
