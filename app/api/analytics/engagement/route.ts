import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
export const maxDuration = 30

/**
 * GET /api/analytics/engagement
 * Surfaces engagement data the app ALREADY collects in `video_analytics` +
 * `client_profiles` but the dashboard never showed:
 *   - watchFunnel: views → 25% → 50% → 75% → 100% (from progress/complete events)
 *   - engagementFunnel: view → play → download → booking_click → payment_click
 *   - clients: named viewers (client_profiles) with watch % + last seen
 * Owner-scoped. All read-only aggregation; no new tracking.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = createAdminClient()

  const { data: videos } = await admin.from('videos').select('id').eq('user_id', user.id)
  const videoIds = (videos ?? []).map(v => v.id)

  const empty = {
    watchFunnel: { view: 0, p25: 0, p50: 0, p75: 0, p100: 0 },
    engagementFunnel: { view: 0, play: 0, download: 0, booking: 0, payment: 0 },
    clients: [] as { name: string | null; email: string; totalViews: number; avgWatchPct: number | null; lastViewedAt: string | null; converted: boolean }[],
  }
  if (videoIds.length === 0) return NextResponse.json(empty)

  // Pull every analytics event for this owner's videos (event_type + metadata).
  const { data: events } = await admin
    .from('video_analytics')
    .select('event_type, metadata')
    .in('video_id', videoIds)

  const wf = { view: 0, p25: 0, p50: 0, p75: 0, p100: 0 }
  const ef = { view: 0, play: 0, download: 0, booking: 0, payment: 0 }
  for (const e of events ?? []) {
    const type = e.event_type as string
    const pct = Number((e.metadata as Record<string, unknown> | null)?.percent) || 0
    if (type === 'view') { wf.view++; ef.view++ }
    else if (type === 'play') ef.play++
    else if (type === 'download') ef.download++
    else if (type === 'booking_click' || type === 'book_meeting') ef.booking++
    else if (type === 'payment_click') ef.payment++
    if (type === 'progress' || type === 'complete') {
      if (pct >= 100) wf.p100++
      else if (pct >= 75) wf.p75++
      else if (pct >= 50) wf.p50++
      else if (pct >= 25) wf.p25++
    }
    if (type === 'complete') wf.p100++
  }
  // Milestones are cumulative for a funnel view: reaching 75% implies 50% & 25%.
  wf.p75 += wf.p100
  wf.p50 += wf.p75
  wf.p25 += wf.p50

  // Named clients (aggregated by email in client_profiles on view).
  const { data: clients } = await admin
    .from('client_profiles')
    .select('client_name, client_email, total_views, avg_watch_pct, last_viewed_at, converted')
    .eq('user_id', user.id)
    .order('last_viewed_at', { ascending: false, nullsFirst: false })
    .limit(25)

  return NextResponse.json({
    watchFunnel: wf,
    engagementFunnel: ef,
    clients: (clients ?? []).map(c => ({
      name: c.client_name ?? null,
      email: c.client_email,
      totalViews: c.total_views ?? 0,
      avgWatchPct: c.avg_watch_pct ?? null,
      lastViewedAt: c.last_viewed_at ?? null,
      converted: !!c.converted,
    })),
  })
}
