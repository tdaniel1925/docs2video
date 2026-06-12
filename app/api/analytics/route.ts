import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
export const maxDuration = 30

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Fetch the user's videos (view counts are derived from video_views below —
  // the videos.view_count column was never incremented, so it always read 0).
  const { data: videos } = await admin
    .from('videos')
    .select('id, title, thumbnail_url')
    .eq('user_id', user.id)

  const videoIds = videos?.map(v => v.id) ?? []

  // Pull all view events; derive total, per-video counts, and the 30-day series
  // from the same source the watch page actually writes to.
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  let totalViews = 0
  let dailyViews: { date: string; count: number }[] = []
  const perVideo: Record<string, number> = {}

  if (videoIds.length > 0) {
    const { data: allViews } = await admin
      .from('video_views')
      .select('video_id')
      .in('video_id', videoIds)
    totalViews = allViews?.length ?? 0
    allViews?.forEach(v => { if (v.video_id) perVideo[v.video_id] = (perVideo[v.video_id] ?? 0) + 1 })

    const { data: recentViews } = await admin
      .from('video_views')
      .select('viewed_at')
      .in('video_id', videoIds)
      .gte('viewed_at', thirtyDaysAgo.toISOString())

    const grouped: Record<string, number> = {}
    recentViews?.forEach(v => {
      const date = v.viewed_at?.split('T')[0]
      if (date) grouped[date] = (grouped[date] ?? 0) + 1
    })
    dailyViews = Object.entries(grouped)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  // Attach derived counts and rank for the "Top Videos" list
  const rankedVideos = (videos ?? [])
    .map(v => ({ ...v, view_count: perVideo[v.id] ?? 0 }))
    .sort((a, b) => b.view_count - a.view_count)

  // Quotes status breakdown
  const { data: quotes } = await admin
    .from('quotes')
    .select('status')
    .eq('user_id', user.id)

  const quoteStats = {
    total: quotes?.length ?? 0,
    viewed: quotes?.filter(q => q.status === 'viewed').length ?? 0,
    accepted: quotes?.filter(q => q.status === 'accepted' || q.status === 'paid').length ?? 0,
  }

  // Sent emails with open tracking — the tracking pixel sets opened_at
  const { data: emails } = await admin
    .from('sent_emails')
    .select('id, opened_at')
    .eq('user_id', user.id)

  const openedCount = emails?.filter(e => e.opened_at).length ?? 0
  const emailStats = {
    total: emails?.length ?? 0,
    opened: openedCount,
    openRate: emails && emails.length > 0
      ? Math.round((openedCount / emails.length) * 100)
      : 0,
  }

  return NextResponse.json({
    totalViews,
    topVideos: rankedVideos.slice(0, 10),
    dailyViews,
    quoteStats,
    emailStats,
  })
}
