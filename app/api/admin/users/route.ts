import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { requireAdmin } from '../../../_lib/admin'
import { ADMIN_USER_COLUMNS } from '../../../_lib/admin/columns'

export const maxDuration = 30

/**
 * GET /api/admin/users?page=0&q=&only=admins|betas — one page of accounts.
 * Only the columns the admin list shows (never Stripe Connect tokens or social
 * keys), the real credit balance, and the total count worked out by the
 * database (not by sending every row to the browser).
 */
export async function GET(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  const url = new URL(request.url)
  const page = Math.max(0, Number(url.searchParams.get('page')) || 0)
  const size = Math.min(100, Math.max(5, Number(url.searchParams.get('size')) || 50))
  const q = (url.searchParams.get('q') || '').trim().replace(/[%,()]/g, '')
  const only = url.searchParams.get('only')

  const db = createAdminClient()
  let query = db.from('profiles').select(ADMIN_USER_COLUMNS, { count: 'exact' })
    .order('created_at', { ascending: false }).range(page * size, page * size + size - 1)
  if (q) query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`)
  if (only === 'admins') query = query.eq('is_admin', true)
  if (only === 'betas') query = query.eq('is_beta', true)
  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ids = (data ?? []).map((p) => p.id)
  const { data: wallets } = ids.length
    ? await db.from('credit_balances').select('user_id, balance, topup_balance').in('user_id', ids)
    : { data: [] as { user_id: string; balance: number; topup_balance: number }[] }
  const bal = new Map((wallets ?? []).map((w) => [w.user_id, (w.balance ?? 0) + (w.topup_balance ?? 0)]))

  return NextResponse.json({
    users: (data ?? []).map((p) => ({ ...p, credits: bal.get(p.id) ?? 0 })),
    total: count ?? 0,
    page,
    size,
  })
}
