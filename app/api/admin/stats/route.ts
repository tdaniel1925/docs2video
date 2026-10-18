import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { requireAdmin } from '../../../_lib/admin'
import { videoServiceUrl } from '../../../_lib/video-service'
import { loadMoneySnapshot } from '../../../_lib/admin/money-server'
import { centsToDollars } from '../../../_lib/admin/money'

export const maxDuration = 30

/**
 * GET /api/admin/stats — the admin home's money numbers (from the ONE shared
 * money calculation, same as Billing and Revenue), the 30-day activity table
 * and the render-service health. Read only.
 */
export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  try {
    const admin = createAdminClient()
    const now = new Date()
    const d30 = new Date(now.getTime() - 30 * 86400000).toISOString()

    const [moneyRes, dailyUsersRes, dailyVideosRes, vpsStatus] = await Promise.all([
      loadMoneySnapshot().then((s) => ({ ok: true as const, s })).catch((e) => ({ ok: false as const, e })),
      admin.from('profiles').select('created_at').gte('created_at', d30),
      admin.from('videos').select('created_at').neq('status', 'draft').gte('created_at', d30),
      fetch(`${videoServiceUrl()}/health`, { signal: AbortSignal.timeout(5000) })
        .then((r) => (r.ok ? 'healthy' : 'degraded')).catch(() => 'offline'),
    ])

    const dailyMap: Record<string, { users: number; videos: number }> = {}
    for (let i = 29; i >= 0; i--) dailyMap[new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10)] = { users: 0, videos: 0 }
    for (const u of dailyUsersRes.data ?? []) { const k = u.created_at.slice(0, 10); if (dailyMap[k]) dailyMap[k].users++ }
    for (const v of dailyVideosRes.data ?? []) { const k = v.created_at.slice(0, 10); if (dailyMap[k]) dailyMap[k].videos++ }
    const dailyActivity = Object.entries(dailyMap).map(([date, c]) => ({ date, ...c })).reverse()

    if (!moneyRes.ok) console.error('[admin/stats] Stripe error:', moneyRes.e)
    const money = moneyRes.ok ? moneyRes.s : null
    return NextResponse.json({
      money: money ? money.summary : null,
      conversion: money ? money.conversion : null,
      mrr: money ? centsToDollars(money.summary.docs2video.mrrCents) : null,
      moneyError: money ? null : 'Stripe could not be read just now.',
      vpsStatus,
      dailyActivity,
    })
  } catch (err) {
    console.error('[admin/stats] Error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'An unexpected error occurred' }, { status: 500 })
  }
}
