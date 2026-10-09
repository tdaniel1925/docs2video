import { NextResponse } from 'next/server'
import { requireAdmin } from '../../../_lib/admin'
import { loadNeedsYou } from '../../../_lib/admin/needs-you'

export const runtime = 'nodejs'
export const maxDuration = 30

/** GET /api/admin/needs-you — the "What needs you" list (read only). */
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  try {
    return NextResponse.json(await loadNeedsYou())
  } catch (err) {
    console.error('[admin/needs-you] Error:', err)
    return NextResponse.json({ error: 'Could not build the list just now.' }, { status: 500 })
  }
}
