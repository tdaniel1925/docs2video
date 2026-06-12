import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { getAffiliateStats } from '../../../_lib/affiliate'

export const runtime = 'nodejs'

/** GET /api/affiliate/stats — the signed-in user's affiliate funnel + earnings. */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const stats = await getAffiliateStats(user.id)
  if (!stats) return NextResponse.json({ enrolled: false })
  return NextResponse.json({ enrolled: true, ...stats })
}
