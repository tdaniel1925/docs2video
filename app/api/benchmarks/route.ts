import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString()

  // Get user's videos
  const { data: userVideos } = await admin
    .from('videos')
    .select('id, view_count, created_at')
    .eq('user_id', user.id)

  if (!userVideos || userVideos.length === 0) {
    return NextResponse.json({
      watchThroughRate: { user: 0, platform: 61 },
      timeToFirstView: { user: null, platform: 8.1 },
      conversionRate: { user: 0, platform: 22 },
      viewsThisMonth: 0,
      viewsLastMonth: 0,
      clientEngagement: { user: 0, platform: 2.8 },
    })
  }

  const userVideoIds = userVideos.map(v => v.id)

  // User's views this month vs last month
  const { count: viewsThisMonth } = await admin
    .from('video_views')
    .select('id', { count: 'exact', head: true })
    .in('video_id', userVideoIds)
    .gte('created_at', thisMonthStart)

  const { count: viewsLastMonth } = await admin
    .from('video_views')
    .select('id', { count: 'exact', head: true })
    .in('video_id', userVideoIds)
    .gte('created_at', lastMonthStart)
    .lte('created_at', lastMonthEnd)

  // User's conversion rate: quotes paid / quotes sent
  const { data: userQuotes } = await admin
    .from('quotes')
    .select('status')
    .in('video_id', userVideoIds)

  const totalQuotes = userQuotes?.length ?? 0
  const paidQuotes = userQuotes?.filter(q => q.status === 'paid' || q.status === 'accepted').length ?? 0
  const userConversion = totalQuotes > 0 ? Math.round((paidQuotes / totalQuotes) * 100) : 0

  // Platform averages (all users)
  const { data: allQuotes } = await admin
    .from('quotes')
    .select('status')

  const allTotal = allQuotes?.length ?? 1
  const allPaid = allQuotes?.filter(q => q.status === 'paid' || q.status === 'accepted').length ?? 0
  const platformConversion = allTotal > 0 ? Math.round((allPaid / allTotal) * 100) : 22

  // Watch-through rate from analytics (percentage of video watched)
  const { data: userAnalytics } = await admin
    .from('video_analytics')
    .select('metadata')
    .in('video_id', userVideoIds)
    .eq('event_type', 'play')

  let userWatchPct = 0
  if (userAnalytics && userAnalytics.length > 0) {
    const watchPcts = userAnalytics
      .map(a => (a.metadata as any)?.watch_pct)
      .filter((p): p is number => typeof p === 'number')
    if (watchPcts.length > 0) {
      userWatchPct = Math.round(watchPcts.reduce((a, b) => a + b, 0) / watchPcts.length)
    }
  }

  // Platform watch-through average
  const { data: allAnalytics } = await admin
    .from('video_analytics')
    .select('metadata')
    .eq('event_type', 'play')
    .limit(500)

  let platformWatchPct = 61
  if (allAnalytics && allAnalytics.length > 0) {
    const watchPcts = allAnalytics
      .map(a => (a.metadata as any)?.watch_pct)
      .filter((p): p is number => typeof p === 'number')
    if (watchPcts.length > 0) {
      platformWatchPct = Math.round(watchPcts.reduce((a, b) => a + b, 0) / watchPcts.length)
    }
  }

  // Time to first view: avg time between video creation and first view
  const { data: firstViews } = await admin
    .from('video_views')
    .select('video_id, created_at')
    .in('video_id', userVideoIds)
    .order('created_at', { ascending: true })

  let userTimeToView: number | null = null
  if (firstViews && firstViews.length > 0) {
    const videoFirstViews = new Map<string, string>()
    for (const v of firstViews) {
      if (!videoFirstViews.has(v.video_id)) {
        videoFirstViews.set(v.video_id, v.created_at)
      }
    }
    const delays: number[] = []
    for (const video of userVideos) {
      const firstView = videoFirstViews.get(video.id)
      if (firstView) {
        const hours = (new Date(firstView).getTime() - new Date(video.created_at).getTime()) / (1000 * 60 * 60)
        if (hours >= 0) delays.push(hours)
      }
    }
    if (delays.length > 0) {
      userTimeToView = Math.round((delays.reduce((a, b) => a + b, 0) / delays.length) * 10) / 10
    }
  }

  // Client engagement: avg interactions per client
  const { data: interactions } = await admin
    .from('video_analytics')
    .select('event_type')
    .in('video_id', userVideoIds)
    .in('event_type', ['play', 'chat_message', 'download', 'book_meeting'])

  const { data: uniqueViewers } = await admin
    .from('video_views')
    .select('viewer_ip')
    .in('video_id', userVideoIds)

  const uniqueViewerCount = new Set(uniqueViewers?.map(v => v.viewer_ip)).size || 1
  const userEngagement = Math.round(((interactions?.length ?? 0) / uniqueViewerCount) * 10) / 10

  return NextResponse.json({
    watchThroughRate: { user: userWatchPct || 0, platform: platformWatchPct },
    timeToFirstView: { user: userTimeToView, platform: 8.1 },
    conversionRate: { user: userConversion, platform: platformConversion || 22 },
    viewsThisMonth: viewsThisMonth ?? 0,
    viewsLastMonth: viewsLastMonth ?? 0,
    clientEngagement: { user: userEngagement, platform: 2.8 },
  })
}
