import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { Resend } from 'resend'

export const runtime = 'nodejs'
export const maxDuration = 300

function getResend() {
  return new Resend(process.env.RESEND_API_KEY!)
}

function weeklyReportHtml(userName: string, totalViews: number, videoRows: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:white;border-radius:10px;overflow:hidden;margin-top:20px;margin-bottom:20px;">
  <tr><td style="background:#1B3A5C;padding:24px 32px;">
    <h1 style="margin:0;font-size:20px;font-weight:800;color:white;">Docs2Video</h1>
    <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.7);">Your Weekly Report</p>
  </td></tr>
  <tr><td style="padding:32px;">
    <p style="font-size:15px;color:#444;line-height:1.6;">Hi ${userName},</p>
    <p style="font-size:15px;color:#444;line-height:1.6;">Here's how your videos performed this week:</p>

    <div style="background:#f0fafa;border-radius:10px;padding:20px;text-align:center;margin:20px 0;">
      <div style="font-size:36px;font-weight:800;color:#1B3A5C;">${totalViews}</div>
      <div style="font-size:13px;color:#666;margin-top:4px;">total views this week</div>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:8px;overflow:hidden;margin:20px 0;">
      <tr style="background:#f8f8f8;">
        <td style="padding:10px 14px;font-size:12px;font-weight:700;color:#888;text-transform:uppercase;">Video</td>
        <td style="padding:10px 14px;font-size:12px;font-weight:700;color:#888;text-transform:uppercase;text-align:right;width:80px;">Views</td>
      </tr>
      ${videoRows}
    </table>

    <div style="text-align:center;margin:28px 0;">
      <a href="https://docs2video.com/create" style="display:inline-block;background:#3BB5C8;color:white;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">
        Create Another Video
      </a>
    </div>
  </td></tr>
  <tr><td style="background:#fafafa;padding:16px 32px;text-align:center;">
    <p style="margin:0;font-size:11px;color:#aaa;">
      Docs2Video &mdash; Turn any document into a professional video.<br/>
      <a href="https://docs2video.com/privacy" style="color:#aaa;">Privacy Policy</a> &bull;
      <a href="https://docs2video.com" style="color:#aaa;">docs2video.com</a>
    </p>
  </td></tr>
</table>
</body>
</html>`
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const resend = getResend()
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  let sentCount = 0
  const errors: string[] = []

  try {
    // Get all analytics from the last 7 days
    const { data: recentAnalytics, error: analyticsErr } = await admin
      .from('video_analytics')
      .select('video_id, event_type, created_at')
      .gte('created_at', weekAgo)
      .in('event_type', ['view', 'play'])

    if (analyticsErr) {
      console.error('[cron/weekly-report] Failed to load analytics:', analyticsErr)
      return NextResponse.json({ error: 'Failed to load analytics' }, { status: 500 })
    }

    if (!recentAnalytics || recentAnalytics.length === 0) {
      return NextResponse.json({ message: 'No views this week, no reports to send', sent: 0 })
    }

    // Build per-video view counts
    const viewsByVideo: Record<string, number> = {}
    for (const a of recentAnalytics) {
      viewsByVideo[a.video_id] = (viewsByVideo[a.video_id] ?? 0) + 1
    }

    const videoIds = Object.keys(viewsByVideo)

    // Fetch video details
    const { data: videos } = await admin
      .from('videos')
      .select('id, user_id, title, status')
      .in('id', videoIds)
      .eq('status', 'completed')

    if (!videos || videos.length === 0) {
      return NextResponse.json({ message: 'No completed videos with views', sent: 0 })
    }

    // Group views by user
    const userVideoViews: Record<string, { videoId: string; title: string; views: number }[]> = {}
    for (const v of videos) {
      const views = viewsByVideo[v.id] ?? 0
      if (views === 0) continue
      if (!userVideoViews[v.user_id]) userVideoViews[v.user_id] = []
      userVideoViews[v.user_id].push({
        videoId: v.id,
        title: v.title ?? 'Untitled',
        views,
      })
    }

    // Get user profiles for users with views
    const userIds = Object.keys(userVideoViews)
    if (userIds.length === 0) {
      return NextResponse.json({ message: 'No users with views this week', sent: 0 })
    }

    const { data: profiles } = await admin
      .from('profiles')
      .select('id, email, full_name, is_admin')
      .in('id', userIds)

    if (!profiles) {
      return NextResponse.json({ message: 'No profiles found', sent: 0 })
    }

    // Send report to each user with views
    for (const profile of profiles) {
      if (profile.is_admin) continue // Skip admins
      if (!profile.email) continue

      const videoViews = userVideoViews[profile.id]
      if (!videoViews || videoViews.length === 0) continue

      // Sort by views descending
      videoViews.sort((a, b) => b.views - a.views)

      const totalViews = videoViews.reduce((sum, v) => sum + v.views, 0)
      const firstName = profile.full_name?.split(' ')[0] ?? 'there'

      // Build video rows HTML
      const videoRows = videoViews.map((v, i) => {
        const bg = i % 2 === 0 ? 'white' : '#fafafa'
        const isMostWatched = i === 0 && videoViews.length > 1
        return `<tr style="background:${bg};">
          <td style="padding:10px 14px;font-size:14px;color:#333;">${v.title}${isMostWatched ? ' <span style="font-size:11px;color:#3BB5C8;font-weight:700;">MOST WATCHED</span>' : ''}</td>
          <td style="padding:10px 14px;font-size:14px;color:#333;text-align:right;font-weight:700;">${v.views}</td>
        </tr>`
      }).join('')

      try {
        const html = weeklyReportHtml(firstName, totalViews, videoRows)
        await resend.emails.send({
          from: 'Docs2Video <reports@docs2video.com>',
          to: profile.email,
          subject: `Weekly Report: ${totalViews} view${totalViews !== 1 ? 's' : ''} on your videos`,
          html,
        })
        sentCount++
        console.log(`[cron/weekly-report] Sent to ${profile.email} (${totalViews} views)`)
      } catch (sendErr) {
        const msg = sendErr instanceof Error ? sendErr.message : 'Unknown'
        errors.push(`${profile.email}: ${msg}`)
        console.error(`[cron/weekly-report] Failed to send to ${profile.email}:`, sendErr)
      }
    }
  } catch (err) {
    console.error('[cron/weekly-report] Fatal error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  return NextResponse.json({
    message: 'Weekly report cron complete',
    sent: sentCount,
    errors: errors.length > 0 ? errors : undefined,
  })
}
