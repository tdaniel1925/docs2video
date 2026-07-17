import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { authenticateApiKey } from '../../../_lib/api-auth'

export const runtime = 'nodejs'

/**
 * GET /api/v1/brands
 * List the caller's brand/presenter profiles so an API/MCP client can offer real
 * choices ("which brand?") before creating a video. Read-only, owner-scoped, no
 * charge. Auth: Authorization: Bearer <api_key>.
 * Returns { brands: [{ id, name, profile_type, is_default }] }.
 */
export async function GET(request: Request) {
  const caller = await authenticateApiKey(request)
  if (!caller) return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('brands')
    .select('id, name, profile_type, person_role, is_default')
    .eq('user_id', caller.userId)
    .order('is_default', { ascending: false })
    .order('name', { ascending: true })
  if (error) return NextResponse.json({ error: 'Could not list brands' }, { status: 500 })

  return NextResponse.json({
    brands: (data ?? []).map((b) => ({
      id: b.id,
      name: b.name,
      profile_type: b.profile_type ?? 'company',
      role: b.person_role ?? null,
      is_default: !!b.is_default,
    })),
  })
}
