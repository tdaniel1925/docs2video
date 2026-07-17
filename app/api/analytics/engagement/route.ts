import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
export const maxDuration = 30

/**
 * GET /api/analytics/engagement           → owner-wide funnels + named clients
 * GET /api/analytics/engagement?videoId=X → per-video funnels + device/geo/referrer
 *
 * Surfaces data the app ALREADY collects in `video_analytics` + `client_profiles`
 * (watch-% milestones, event types, user_agent, referrer) but the dashboard never
 * showed. Read-only aggregation; no new tracking. Owner-scoped (a videoId that
 * isn't the caller's is rejected).
 */

type Ev = { event_type: string; metadata: Record<string, unknown> | null; user_agent?: string | null; referrer?: string | null }

/** Watch-through + engagement funnels from a set of events. Milestones are made
 *  cumulative (reaching 75% implies 50% & 25%) for a proper funnel. */
function funnels(events: Ev[]) {
  const wf = { view: 0, p25: 0, p50: 0, p75: 0, p100: 0 }
  const ef = { view: 0, play: 0, download: 0, booking: 0, payment: 0 }
  for (const e of events) {
    const type = e.event_type
    const pct = Number(e.metadata?.percent) || 0
    if (type === 'view') { wf.view++; ef.view++ }
    else if (type === 'play') ef.play++
    else if (type === 'download') ef.download++
    else if (type === 'booking_click' || type === 'book_meeting') ef.booking++
    else if (type === 'payment_click') ef.payment++
    if (type === 'progress') {
      if (pct >= 75) wf.p75++
      else if (pct >= 50) wf.p50++
      else if (pct >= 25) wf.p25++
    }
    if (type === 'complete') wf.p100++
  }
  wf.p75 += wf.p100; wf.p50 += wf.p75; wf.p25 += wf.p50
  return { watchFunnel: wf, engagementFunnel: ef }
}

/** Device / OS / referrer breakdown from user_agent + referrer on VIEW events. */
function breakdown(events: Ev[]) {
  const device: Record<string, number> = {}
  const referrer: Record<string, number> = {}
  for (const e of events) {
    if (e.event_type !== 'view') continue
    const ua = (e.user_agent || '').toLowerCase()
    const d = ua.includes('ipad') || ua.includes('tablet') ? 'Tablet'
      : (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) ? 'Mobile'
      : 'Desktop'
    device[d] = (device[d] || 0) + 1
    let ref = 'Direct'
    if (e.referrer) { try { ref = new URL(e.referrer).hostname.replace(/^www\./, '') } catch { ref = String(e.referrer).slice(0, 40) } }
    referrer[ref] = (referrer[ref] || 0) + 1
  }
  const top = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, count]) => ({ label, count }))
  return { device: top(device), referrer: top(referrer) }
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = createAdminClient()

  const videoId = new URL(request.url).searchParams.get('videoId')

  // ── Per-video drill-down ──
  if (videoId) {
    const { data: v } = await admin.from('videos').select('id, title, thumbnail_url').eq('id', videoId).eq('user_id', user.id).maybeSingle()
    if (!v) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const { data: events } = await admin
      .from('video_analytics')
      .select('event_type, metadata, user_agent, referrer')
      .eq('video_id', videoId)
    const evs = (events ?? []) as Ev[]
    return NextResponse.json({
      video: { id: v.id, title: v.title, thumbnail_url: v.thumbnail_url },
      ...funnels(evs),
      ...breakdown(evs),
    })
  }

  // ── Owner-wide ──
  const { data: videos } = await admin.from('videos').select('id').eq('user_id', user.id)
  const videoIds = (videos ?? []).map(v => v.id)
  if (videoIds.length === 0) {
    return NextResponse.json({
      watchFunnel: { view: 0, p25: 0, p50: 0, p75: 0, p100: 0 },
      engagementFunnel: { view: 0, play: 0, download: 0, booking: 0, payment: 0 },
      clients: [],
    })
  }

  const { data: events } = await admin
    .from('video_analytics')
    .select('event_type, metadata')
    .in('video_id', videoIds)

  const { data: clients } = await admin
    .from('client_profiles')
    .select('client_name, client_email, total_views, avg_watch_pct, last_viewed_at, converted')
    .eq('user_id', user.id)
    .order('last_viewed_at', { ascending: false, nullsFirst: false })
    .limit(25)

  return NextResponse.json({
    ...funnels((events ?? []) as Ev[]),
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
