import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { requireAdmin } from '../../../_lib/admin'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const admin = createAdminClient()

  const url = new URL(request.url)
  const userId = url.searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const { data: transactions } = await admin
    .from('credit_transactions')
    .select('id, amount, balance_after, action, description, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)

  return NextResponse.json({ transactions: transactions || [] })
}
