import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { getBalance, ensureCreditBalance } from '../../../_lib/credits'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * GET /api/credits/balance
 * Returns the authenticated user's credit balance.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    let balance = await getBalance(user.id)

    // If no credit row exists, create one based on subscription tier
    if (balance.total === 0 && balance.cycleGranted === 0) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_status')
        .eq('id', user.id)
        .single()
      await ensureCreditBalance(user.id, profile?.subscription_status || 'free')
      balance = await getBalance(user.id)
    }

    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    return NextResponse.json({
      balance: balance.total,
      monthly: balance.monthly,
      topup: balance.topup,
      isAdmin: profile?.is_admin || false,
      // The client needs this to compute the user's ACTUAL cost (grandfathered
      // users pay old rates) so the displayed "this will use N credits" matches
      // what generate-video actually charges.
      userId: user.id,
    })
  } catch (err) {
    console.error('[credits/balance] Failed to get balance:', err)
    return NextResponse.json({ error: 'Failed to fetch balance' }, { status: 500 })
  }
}
