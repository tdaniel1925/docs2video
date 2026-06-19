import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { isAdminRequest } from '../../../_lib/admin'
import { getSetting, setSetting, type AppSettingKey } from '../../../_lib/app-settings'

export const runtime = 'nodejs'

// Settings exposed to the admin back office. Whitelisted so the route can't be
// used to write arbitrary keys.
const EDITABLE: AppSettingKey[] = ['video_engine_v3', 'video_render_target']

/** GET /api/admin/settings → { video_engine_v3: 'true'|'false', ... } */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!(await isAdminRequest(user))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const entries = await Promise.all(EDITABLE.map(async (k) => [k, await getSetting(k)] as const))
  return NextResponse.json(Object.fromEntries(entries))
}

/** POST /api/admin/settings  { key, value } → persist one whitelisted setting. */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!(await isAdminRequest(user)) || !user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { key?: string; value?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const key = body.key as AppSettingKey
  if (!EDITABLE.includes(key)) return NextResponse.json({ error: 'Unknown setting' }, { status: 400 })

  // Normalize booleans to 'true'/'false' strings.
  const value = typeof body.value === 'boolean' ? String(body.value) : String(body.value ?? '')
  await setSetting(key, value, user.id)
  return NextResponse.json({ ok: true, key, value })
}
