import { NextResponse } from 'next/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { missingRequiredEnv } from '../../_lib/env'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * GET /api/health
 * Public health check. Returns 'ok' or 'degraded' from Supabase connectivity
 * AND reports the COUNT of missing required go-live env vars (audit M3) — names
 * only when ?detail=1 and an admin secret matches, to avoid leaking config.
 */
export async function GET(request: Request) {
  const timestamp = new Date().toISOString()
  const url = new URL(request.url)
  const missing = missingRequiredEnv()
  const wantDetail = url.searchParams.get('detail') === '1'
    && (request.headers.get('x-cron-secret') || '') === (process.env.CRON_SECRET || '\0')

  const envStatus = {
    missingRequiredEnvCount: missing.length,
    ...(wantDetail ? { missingRequiredEnv: missing } : {}),
  }

  try {
    const supabase = createAdminClient()
    const { error } = await supabase.from('profiles').select('id').limit(1)

    if (error) {
      return NextResponse.json({ status: 'degraded', timestamp, detail: 'Database unreachable', ...envStatus })
    }

    const status = missing.length > 0 ? 'degraded' : 'ok'
    return NextResponse.json({ status, timestamp, ...envStatus })
  } catch {
    return NextResponse.json({ status: 'degraded', timestamp, detail: 'Database unreachable', ...envStatus })
  }
}
