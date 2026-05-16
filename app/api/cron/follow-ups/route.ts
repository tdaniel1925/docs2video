import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../_lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * Cron endpoint: sends follow-up emails for viewed quotes that haven't been paid.
 * - 3 days after view with no follow-up: gentle reminder
 * - 7 days after view with no follow-up: "still interested?" email
 *
 * Called daily at 9 AM UTC via Vercel Cron.
 */
export async function GET(request: Request) {
  // Verify cron secret if configured
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date()
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  let sentCount = 0
  const errors: string[] = []

  try {
    // Find views where:
    // - The video has a quote with status 'sent' (not paid)
    // - The view is older than 3 days
    const { data: views } = await supabase
      .from('video_views')
      .select('id, video_id, created_at, viewer_ip')
      .lt('created_at', threeDaysAgo)

    if (!views || views.length === 0) {
      return NextResponse.json({ message: 'No eligible views found', sent: 0 })
    }

    // Get unique video IDs
    const videoIds = [...new Set(views.map(v => v.video_id))]

    // Get quotes for these videos that are in 'sent' status (not paid)
    const { data: quotes } = await supabase
      .from('quotes')
      .select('id, video_id, client_name, client_email, total')
      .in('video_id', videoIds)
      .eq('status', 'sent')

    if (!quotes || quotes.length === 0) {
      return NextResponse.json({ message: 'No unpaid quotes found for viewed videos', sent: 0 })
    }

    const quotedVideoIds = new Set(quotes.map(q => q.video_id))

    // Get already-sent follow-ups to avoid duplicates
    const { data: existingFollowUps } = await supabase
      .from('sent_emails')
      .select('video_id, email_type')
      .in('video_id', videoIds)
      .in('email_type', ['follow_up_3day', 'follow_up_7day'])

    const sentFollowUps = new Set(
      (existingFollowUps ?? []).map(f => `${f.video_id}:${f.email_type}`)
    )

    // Process each view
    for (const view of views) {
      if (!quotedVideoIds.has(view.video_id)) continue

      const viewAge = now.getTime() - new Date(view.created_at).getTime()
      const daysSinceView = viewAge / (24 * 60 * 60 * 1000)

      const quote = quotes.find(q => q.video_id === view.video_id)
      if (!quote) continue

      // Get video info
      const { data: video } = await supabase
        .from('videos')
        .select('title, user_id')
        .eq('id', view.video_id)
        .single()

      if (!video) continue

      // Get owner profile and email connection
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', video.user_id)
        .single()

      if (!profile?.email) continue

      const { data: connection } = await supabase
        .from('email_connections')
        .select('*')
        .eq('user_id', video.user_id)
        .eq('is_default', true)
        .single()

      if (!connection) continue

      const clientName = quote.client_name ?? 'there'
      const clientEmail = quote.client_email
      if (!clientEmail) continue

      const videoTitle = video.title ?? 'your presentation'
      const agentName = profile.full_name ?? 'Your advisor'

      // Determine which follow-up to send
      let emailType: string | null = null
      let subject = ''
      let html = ''

      if (daysSinceView >= 7 && !sentFollowUps.has(`${view.video_id}:follow_up_7day`)) {
        emailType = 'follow_up_7day'
        subject = `Still interested? Re: ${videoTitle}`
        html = `
          <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:24px;">
            <p style="color:#333;font-size:15px;line-height:1.6;">Hi ${clientName},</p>
            <p style="color:#555;font-size:14px;line-height:1.6;">
              I wanted to follow up one more time regarding the presentation I shared with you: <strong>"${videoTitle}"</strong>.
            </p>
            <p style="color:#555;font-size:14px;line-height:1.6;">
              If you have any questions or would like to discuss the details, I'm happy to help. Otherwise, no worries at all.
            </p>
            <p style="color:#555;font-size:14px;line-height:1.6;">
              Best regards,<br/>${agentName}
            </p>
          </div>
        `
      } else if (daysSinceView >= 3 && !sentFollowUps.has(`${view.video_id}:follow_up_3day`)) {
        emailType = 'follow_up_3day'
        subject = `Quick follow-up: ${videoTitle}`
        html = `
          <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:24px;">
            <p style="color:#333;font-size:15px;line-height:1.6;">Hi ${clientName},</p>
            <p style="color:#555;font-size:14px;line-height:1.6;">
              I noticed you viewed the presentation I shared: <strong>"${videoTitle}"</strong>. I wanted to check in and see if you had any questions.
            </p>
            <p style="color:#555;font-size:14px;line-height:1.6;">
              I'm available to walk through any details or answer any concerns you might have. Feel free to reply to this email.
            </p>
            <p style="color:#555;font-size:14px;line-height:1.6;">
              Best,<br/>${agentName}
            </p>
          </div>
        `
      }

      if (!emailType) continue

      try {
        const { sendViaSMTP, sendViaGoogle, sendViaMicrosoft } = await import('../../../_lib/email')

        if (connection.provider === 'smtp') {
          await sendViaSMTP(connection, clientEmail, subject, html)
        } else if (connection.provider === 'google') {
          await sendViaGoogle(connection, clientEmail, subject, html)
        } else if (connection.provider === 'microsoft') {
          await sendViaMicrosoft(connection, clientEmail, subject, html)
        }

        // Log the sent email
        await supabase.from('sent_emails').insert({
          user_id: video.user_id,
          video_id: view.video_id,
          email_type: emailType,
          recipient: clientEmail,
          subject,
          sent_at: new Date().toISOString(),
        })

        sentCount++
      } catch (sendErr) {
        const msg = sendErr instanceof Error ? sendErr.message : 'Unknown send error'
        errors.push(`${view.video_id}: ${msg}`)
        console.error(`[cron/follow-ups] Send error for video ${view.video_id}:`, sendErr)
      }
    }
  } catch (err) {
    console.error('[cron/follow-ups] Fatal error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  return NextResponse.json({
    message: `Follow-up cron complete`,
    sent: sentCount,
    errors: errors.length > 0 ? errors : undefined,
  })
}
