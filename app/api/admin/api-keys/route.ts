import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { requireAdmin } from '../../../_lib/admin'
import { generateApiKey, addApiCredits } from '../../../_lib/api-auth'
import { logAdminAction } from '../../../_lib/audit'
import { isPartnerKey } from '../../../_lib/admin/partner-key'

export const runtime = 'nodejs'
export const maxDuration = 30

/** GET /api/admin/api-keys — list all keys (with owner email + API balance). */
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  const admin = createAdminClient()

  const { data: keys } = await admin
    .from('api_keys')
    .select('id, user_id, key_prefix, name, is_active, last_used_at, created_at')
    .order('created_at', { ascending: false })

  const userIds = [...new Set((keys ?? []).map(k => k.user_id))]
  const [{ data: profiles }, { data: balances }] = await Promise.all([
    admin.from('profiles').select('id, email').in('id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000']),
    admin.from('api_credit_balances').select('user_id, balance').in('user_id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000']),
  ])
  const emailById = new Map((profiles ?? []).map(p => [p.id, p.email]))
  const balById = new Map((balances ?? []).map(b => [b.user_id, b.balance]))

  return NextResponse.json({
    keys: (keys ?? []).map(k => ({
      ...k,
      email: emailById.get(k.user_id) ?? null,
      api_balance: balById.get(k.user_id) ?? 0,
      is_partner: isPartnerKey(k),
    })),
  })
}

/**
 * POST /api/admin/api-keys
 * { action: 'create', email, name? } → issues a key, returns the RAW key ONCE.
 * { action: 'revoke', keyId }
 * { action: 'topup', email, amount } → adds credits to the API pool.
 */
export async function POST(request: Request) {
  const me = await requireAdmin()
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  const admin = createAdminClient()
  const body = await request.json() as { action: string; email?: string; name?: string; keyId?: string; amount?: number }

  if (body.action === 'create') {
    if (!body.email) return NextResponse.json({ error: 'email required' }, { status: 400 })
    const { data: profile } = await admin.from('profiles').select('id').eq('email', body.email.toLowerCase()).single()
    if (!profile) return NextResponse.json({ error: 'No account with that email' }, { status: 404 })

    const { raw, hash, prefix } = generateApiKey()
    const { error } = await admin.from('api_keys').insert({
      user_id: profile.id,
      key_hash: hash,
      key_prefix: prefix,
      name: body.name || null,
    })
    if (error) {
      console.error('[admin/api-keys] create error', error)
      return NextResponse.json({ error: 'Failed to create key' }, { status: 500 })
    }
    // Ensure an API credit balance row exists for the owner.
    await admin.from('api_credit_balances').upsert(
      { user_id: profile.id, balance: 0, updated_at: new Date().toISOString() },
      { onConflict: 'user_id', ignoreDuplicates: true },
    )
    await logAdminAction(me.id, 'api_key_create', profile.id, { prefix, name: body.name || null })
    // The raw key is shown exactly once — it cannot be recovered later.
    return NextResponse.json({ ok: true, api_key: raw, prefix })
  }

  if (body.action === 'revoke') {
    if (!body.keyId) return NextResponse.json({ error: 'keyId required' }, { status: 400 })
    const { data: key } = await admin.from('api_keys').select('user_id, key_prefix, name').eq('id', body.keyId).maybeSingle()
    await admin.from('api_keys').update({ is_active: false }).eq('id', body.keyId)
    await logAdminAction(me.id, 'api_key_revoke', key?.user_id ?? undefined, { keyId: body.keyId, prefix: key?.key_prefix ?? null, name: key?.name ?? null, partner: key ? isPartnerKey(key) : false })
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'topup') {
    if (!body.email || !body.amount) return NextResponse.json({ error: 'email and amount required' }, { status: 400 })
    const { data: profile } = await admin.from('profiles').select('id').eq('email', body.email.toLowerCase()).single()
    if (!profile) return NextResponse.json({ error: 'No account with that email' }, { status: 404 })
    await addApiCredits(profile.id, Math.floor(body.amount))
    await logAdminAction(me.id, 'api_credits_topup', profile.id, { amount: Math.floor(body.amount) })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
