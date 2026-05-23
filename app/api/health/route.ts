import { NextResponse } from 'next/server'
import { createAdminClient } from '../../_lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * GET /api/health
 * Public health check endpoint. Returns 'ok' or 'degraded' based on Supabase connectivity.
 */
export async function GET() {
  const timestamp = new Date().toISOString()

  try {
    const supabase = createAdminClient()
    const { error } = await supabase.from('profiles').select('id').limit(1)

    if (error) {
      return NextResponse.json({ status: 'degraded', timestamp, detail: 'Database unreachable' })
    }

    return NextResponse.json({ status: 'ok', timestamp })
  } catch {
    return NextResponse.json({ status: 'degraded', timestamp, detail: 'Database unreachable' })
  }
}
