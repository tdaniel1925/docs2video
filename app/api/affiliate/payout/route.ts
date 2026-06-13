import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { setPayoutInfo } from '../../../_lib/affiliate'

export const runtime = 'nodejs'

/**
 * POST /api/affiliate/payout  { payoutEmail, payoutMethod? }
 * Saves where/how the affiliate wants to be paid (manual payouts).
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { payoutEmail, payoutMethod } = (await request.json().catch(() => ({}))) as {
    payoutEmail?: string
    payoutMethod?: string
  }
  const email = (payoutEmail || '').trim()
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'A valid payout email is required.' }, { status: 400 })
  }

  const ok = await setPayoutInfo(user.id, email, payoutMethod?.trim() || undefined)
  if (!ok) return NextResponse.json({ error: 'Failed to save payout info' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
