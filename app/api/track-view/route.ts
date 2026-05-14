import { NextResponse } from 'next/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { sendVideoViewedEmail, sendVideoViewedSms } from '../../_lib/notifications'

export const runtime = 'nodejs'

const VALID_EVENTS = ['view', 'play', 'chat_message', 'download', 'book_meeting'] as const

export async function POST(request: Request) {
  try {
    const { videoId, event, metadata } = (await request.json()) as {
      videoId: string
      event?: string
      metadata?: Record<string, unknown>
    }
    if (!videoId) {
      return NextResponse.json({ error: 'Missing videoId' }, { status: 400 })
    }

    const eventType = event && VALID_EVENTS.includes(event as any) ? event : 'view'

    const supabase = createAdminClient()

    // Get viewer info from headers
    const viewerIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const viewerDevice = request.headers.get('user-agent') ?? 'unknown'
    const referrer = request.headers.get('referer') ?? null

    // Insert into video_analytics table
    await supabase.from('video_analytics').insert({
      video_id: videoId,
      event_type: eventType,
      viewer_ip: viewerIp,
      user_agent: viewerDevice,
      referrer,
      metadata: metadata ?? null,
    })

    // Also insert into legacy video_views table for backward compatibility (view events only)
    if (eventType === 'view') {
      await supabase.from('video_views').insert({
        video_id: videoId,
        viewer_ip: viewerIp,
        viewer_device: viewerDevice,
      })
    }

    // Send notification email + SMS to video owner (view events only)
    if (eventType === 'view') {
      try {
        const { data: video } = await supabase
          .from('videos')
          .select('title, user_id')
          .eq('id', videoId)
          .single()

        if (video) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('email, full_name, phone')
            .eq('id', video.user_id)
            .single()

          const videoTitle = video.title ?? 'Untitled'

          // Send email via connected provider if available, otherwise fall back to Resend
          if (profile?.email) {
            const { data: connection } = await supabase
              .from('email_connections')
              .select('*')
              .eq('user_id', video.user_id)
              .eq('is_default', true)
              .single()

            if (connection) {
              const { sendViaSMTP, sendViaGoogle, sendViaMicrosoft } = await import('../../_lib/email')
              const subject = `Someone viewed your video: ${videoTitle}`
              const html = `
                <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:24px;">
                  <h2 style="color:#0F1A12;margin:0 0 12px;">New Video View</h2>
                  <p style="color:#4B574F;font-size:14px;line-height:1.6;">
                    Someone just opened your video <strong>"${videoTitle}"</strong>.
                  </p>
                  <p style="color:#8A968D;font-size:12px;margin-top:16px;">
                    Viewer IP: ${viewerIp}<br/>
                    Device: ${viewerDevice.slice(0, 100)}
                  </p>
                  <p style="color:#8A968D;font-size:11px;margin-top:20px;">Powered by Docs2Video</p>
                </div>
              `

              if (connection.provider === 'smtp') {
                await sendViaSMTP(connection, profile.email, subject, html)
              } else if (connection.provider === 'google') {
                await sendViaGoogle(connection, profile.email, subject, html)
              } else if (connection.provider === 'microsoft') {
                await sendViaMicrosoft(connection, profile.email, subject, html)
              }
            } else {
              // Fallback: send via Resend
              await sendVideoViewedEmail(profile.email, videoTitle, viewerIp)
            }
          }

          // Send SMS to creator if they have a phone number
          if (profile?.phone) {
            await sendVideoViewedSms(profile.phone, videoTitle)
          }
        }
      } catch (notifyErr) {
        // Don't fail the view tracking if notification fails
        console.error('[track-view] Notification error:', notifyErr)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    console.error('[track-view] Error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
