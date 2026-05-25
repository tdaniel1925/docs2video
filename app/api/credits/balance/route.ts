import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { getBalance } from '../../../_lib/credits'

export const runtime = 'nodejs'

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
    const balance = await getBalance(user.id)
    return NextResponse.json({
      balance: balance.total,
      monthly: balance.monthly,
      topup: balance.topup,
    })
  } catch (err) {
    console.error('[credits/balance] Failed to get balance:', err)
    return NextResponse.json({ error: 'Failed to fetch balance' }, { status: 500 })
  }
}
