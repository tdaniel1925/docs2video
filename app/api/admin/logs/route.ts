import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { requireAdmin } from '../../../_lib/admin'
import { fetchRecentVercelErrors, vercelLogsConfigured } from '../../../_lib/vercel-logs'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * GET   /api/admin/logs?resolved=false   → error_logs (grouped/deduped) + optional live Vercel logs
 * PATCH /api/admin/logs  { id, resolved } → mark an error resolved/unresolved
 * Admin-only.
 */
export async function GET(request: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const url = new URL(request.url)
  const showResolved = url.searchParams.get('resolved') === 'true'

  const admin = createAdminClient()
  let q = admin
    .from('error_logs')
    .select('*')
    .order('last_seen', { ascending: false })
    .limit(200)
  if (!showResolved) q = q.eq('resolved', false)
  const { data: errors } = await q

  const vercel = vercelLogsConfigured() ? await fetchRecentVercelErrors(80) : []

  return NextResponse.json({
    errors: errors ?? [],
    vercel,
    vercelConfigured: vercelLogsConfigured(),
  })
}

export async function PATCH(request: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  let body: { id?: string; resolved?: boolean }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('error_logs')
    .update({ resolved: body.resolved ?? true })
    .eq('id', body.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
