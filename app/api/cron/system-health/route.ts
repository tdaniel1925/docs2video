import { NextResponse } from 'next/server'
import { verifyCronAuth } from '../../../_lib/cron-auth'
import { runSystemChecks } from '../../../_lib/system-checks'

export const runtime = 'nodejs'
export const maxDuration = 150

const ALERT_ENDPOINT = '/api/internal/error-report'

/**
 * GET /api/cron/system-health  (every 6h — see vercel.json)
 * Runs the full system spot-test suite, persists the result, and emails ops if
 * anything is failing. This is the automated assurance that all systems are go.
 */
export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await runSystemChecks('cron')

  if (!result.overall_ok) {
    const failed = result.results.filter(r => !r.ok)
    const summary = failed.map(r => `• ${r.name}: ${r.error}`).join('\n')
    // Reuse the internal error-report endpoint so the failure both emails ops
    // AND lands in the admin Logs view (deduped).
    try {
      const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://docs2video.com'
      await fetch(`${base}${ALERT_ENDPOINT}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-secret': process.env.VIDEO_ASSEMBLY_SECRET || '' },
        body: JSON.stringify({
          source: 'app',
          stage: 'system-health-cron',
          message: `System health check FAILED: ${failed.map(r => r.name).join(', ')}`,
          detail: summary,
        }),
        signal: AbortSignal.timeout(10000),
      })
    } catch (e) {
      console.error('[system-health] failed to send alert:', e instanceof Error ? e.message : e)
    }
  }

  return NextResponse.json({ overall_ok: result.overall_ok, checks: result.results.length, failed: result.results.filter(r => !r.ok).length })
}
