import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Total views for user's videos
  const { data: videos } = await admin
    .from('videos')
    .select('id, title, view_count, thumbnail_url')
    .eq('user_id', user.id)
    .order('view_count', { ascending: false })

  const totalViews = videos?.reduce((sum, v) => sum + (v.view_count ?? 0), 0) ?? 0

  // Views over last 30 days from video_views
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const videoIds = videos?.map(v => v.id) ?? []

  let dailyViews: { date: string; count: number }[] = []
  if (videoIds.length > 0) {
    const { data: views } = await admin
      .from('video_views')
      .select('viewed_at')
      .in('video_id', videoIds)
      .gte('viewed_at', thirtyDaysAgo.toISOString())

    // Group by date
    const grouped: Record<string, number> = {}
    views?.forEach(v => {
      const date = v.viewed_at?.split('T')[0]
      if (date) grouped[date] = (grouped[date] ?? 0) + 1
    })
    dailyViews = Object.entries(grouped)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }

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

  // Sent emails with open tracking
  const { data: emails } = await admin
    .from('sent_emails')
    .select('id, opened')
    .eq('user_id', user.id)

  const emailStats = {
    total: emails?.length ?? 0,
    opened: emails?.filter(e => e.opened).length ?? 0,
    openRate: emails && emails.length > 0
      ? Math.round((emails.filter(e => e.opened).length / emails.length) * 100)
      : 0,
  }

  return NextResponse.json({
    totalViews,
    topVideos: (videos ?? []).slice(0, 10),
    dailyViews,
    quoteStats,
    emailStats,
  })
}
