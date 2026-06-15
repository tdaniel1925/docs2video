import { NextResponse } from 'next/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { sendVideoViewedEmail, sendVideoViewedSms } from '../../_lib/notifications'

export const runtime = 'nodejs'
export const maxDuration = 30

const VALID_EVENTS = ['view', 'play', 'progress', 'complete', 'chat_message', 'download', 'book_meeting', 'booking_click', 'payment_click', 'social_share'] as const

// Lightweight per-(ip+video+event) rate limit so a bot can't flood analytics
// or amplify owner notifications. Resets per instance — a backstop, not a quota.
const trackRate = new Map<string, { count: number; resetAt: number }>()
function tooMany(key: string): boolean {
  const now = Date.now()
  const e = trackRate.get(key)
  if (!e || now > e.resetAt) { trackRate.set(key, { count: 1, resetAt: now + 60_000 }); return false }
  if (e.count >= 30) return true
  e.count++
  return false
}

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

    if (tooMany(`${viewerIp}:${videoId}:${eventType}`)) {
      return NextResponse.json({ ok: true, throttled: true })
    }

    // Verify the video actually exists before writing analytics / firing owner
    // notifications — stops flooding garbage ids to spam the owner (cost + noise).
    const { data: exists } = await supabase.from('videos').select('id').eq('id', videoId).single()
    if (!exists) {
      return NextResponse.json({ ok: true }) // silently no-op; don't reveal existence
    }

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

    // Upsert client_profiles for intelligence tracking (view events only)
    if (eventType === 'view') {
      try {
        const { data: video } = await supabase
          .from('videos')
          .select('user_id')
          .eq('id', videoId)
          .single()

        if (video) {
          // Determine device type from user agent
          const ua = viewerDevice.toLowerCase()
          const device = ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')
            ? 'mobile'
            : ua.includes('tablet') || ua.includes('ipad')
            ? 'tablet'
            : 'desktop'

          // Determine preferred time based on hour
          const hour = new Date().getUTCHours()
          const timeOfDay = hour < 6 ? 'night' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'

          // Try to find client email from quotes for this video
          const { data: quote } = await supabase
            .from('quotes')
            .select('client_email, client_name')
            .eq('video_id', videoId)
            .single()

          if (quote?.client_email) {
            // Check if profile exists
            const { data: existing } = await supabase
              .from('client_profiles')
              .select('id, total_views')
              .eq('user_id', video.user_id)
              .eq('client_email', quote.client_email)
              .single()

            if (existing) {
              await supabase
                .from('client_profiles')
                .update({
                  total_views: (existing.total_views ?? 0) + 1,
                  last_viewed_at: new Date().toISOString(),
                  preferred_device: device,
                  preferred_time: timeOfDay,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id)
            } else {
              await supabase
                .from('client_profiles')
                .insert({
                  user_id: video.user_id,
                  client_email: quote.client_email,
                  client_name: quote.client_name,
                  total_views: 1,
                  total_videos_sent: 1,
                  last_viewed_at: new Date().toISOString(),
                  preferred_device: device,
                  preferred_time: timeOfDay,
                })
            }
          }
        }
      } catch (profileErr) {
        console.error('[track-view] Client profile upsert error:', profileErr)
      }
    }

    // Log activity to client record if viewer matches a client
    if (eventType === 'view' || eventType === 'play') {
      try {
        const { data: video } = await supabase
          .from('videos')
          .select('user_id, client_id, title')
          .eq('id', videoId)
          .single()

        if (video) {
          // Check if video has a client_id directly, or find via sent_emails
          let clientId = video.client_id
          if (!clientId) {
            const { data: sentEmail } = await supabase
              .from('sent_emails')
              .select('to_email')
              .eq('video_id', videoId)
              .limit(1)
              .single()

            if (sentEmail?.to_email) {
              const { data: client } = await supabase
                .from('clients')
                .select('id')
                .eq('user_id', video.user_id)
                .eq('email', sentEmail.to_email.toLowerCase())
                .single()
              clientId = client?.id
            }
          }

          if (clientId) {
            const actType = eventType === 'play' ? 'video_played' : 'video_viewed'
            await supabase.from('client_activities').insert({
              client_id: clientId,
              user_id: video.user_id,
              type: actType,
              title: `Video ${eventType === 'play' ? 'played' : 'viewed'}: ${video.title ?? 'Untitled'}`,
              metadata: { video_id: videoId },
            })

            // Update client view count
            const { data: clientData } = await supabase
              .from('clients')
              .select('total_views')
              .eq('id', clientId)
              .single()

            if (clientData) {
              await supabase
                .from('clients')
                .update({
                  total_views: (clientData.total_views ?? 0) + 1,
                  last_activity_at: new Date().toISOString(),
                  status: 'engaged',
                })
                .eq('id', clientId)
            }
          }
        }
      } catch (clientActErr) {
        console.error('[track-view] Client activity log error:', clientActErr)
      }
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
