import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { requireAdmin } from '../../../_lib/admin'
import { runSystemChecks } from '../../../_lib/system-checks'

export const runtime = 'nodejs'
export const maxDuration = 150 // render_path selftest can take a while

/**
 * GET  /api/admin/system-status        → latest system_checks row + recent history
 * POST /api/admin/system-status        → run checks on demand ("Run spot test now")
 * Admin-only.
 */
export async function GET(request: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const admin = createAdminClient()
  const { data: latest } = await admin
    .from('system_checks')
    .select('*')
    .order('run_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: history } = await admin
    .from('system_checks')
    .select('id, run_at, overall_ok, duration_ms, trigger')
    .order('run_at', { ascending: false })
    .limit(30)

  return NextResponse.json({ latest: latest ?? null, history: history ?? [] })
}

export async function POST(request: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const result = await runSystemChecks('manual')
  return NextResponse.json(result)
}
