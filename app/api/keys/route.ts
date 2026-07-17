import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { generateApiKey } from '../../_lib/api-auth'

export const runtime = 'nodejs'

/**
 * Self-serve API keys for the LOGGED-IN user. A key lets the user (or an MCP
 * client using it) call the public v1 API, spending their NORMAL subscription
 * credits (one pool — see app/_lib/api-auth.ts). The raw key is shown ONCE.
 */

/** GET /api/keys — the caller's keys (never the raw secret). */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createAdminClient()
  const { data } = await admin
    .from('api_keys')
    .select('id, key_prefix, name, is_active, last_used_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ keys: data ?? [] })
}

/** POST /api/keys { name? } — issue a new key; returns the RAW key ONCE. */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { name?: string }
  const admin = createAdminClient()

  // Soft cap so a single account can't mint unlimited keys.
  const { count } = await admin.from('api_keys').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_active', true)
  if ((count ?? 0) >= 10) return NextResponse.json({ error: 'Key limit reached (10). Revoke one first.' }, { status: 400 })

  const { raw, hash, prefix } = generateApiKey()
  const { error } = await admin.from('api_keys').insert({
    user_id: user.id,
    key_hash: hash,
    key_prefix: prefix,
    name: (body.name || '').toString().slice(0, 60) || null,
  })
  if (error) {
    console.error('[api/keys] create error', error)
    return NextResponse.json({ error: 'Failed to create key' }, { status: 500 })
  }
  // Shown exactly once — it cannot be recovered later.
  return NextResponse.json({ ok: true, api_key: raw, prefix })
}

/** DELETE /api/keys?id=... — revoke a key the caller owns. */
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const admin = createAdminClient()
  // Owner-scoped: only deactivate a key that belongs to this user.
  const { error } = await admin.from('api_keys').update({ is_active: false }).eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: 'Failed to revoke' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
