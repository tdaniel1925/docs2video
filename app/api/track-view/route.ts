import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '../../_lib/supabase/admin'
import { createClient } from '../../_lib/supabase/server'
import { checkRateLimit } from '../../_lib/rate-limit'
import { sendVideoViewedEmail, sendVideoViewedSms, buildVideoViewedHtml, type ViewDetails } from '../../_lib/notifications'
import { normalizePref, shouldSendViewAlert, COOLDOWN_HOURS } from '../../_lib/view-alerts'
import type { EmailConnection } from '../../_lib/types'

export const runtime = 'nodejs'
export const maxDuration = 30

// Every event the share page sends. Anything else is REJECTED — it used to be
// silently turned into a 'view', so "question_asked" counted as a new view and
// fired another "someone watched" alert.
const VALID_EVENTS = ['view', 'play', 'progress', 'complete', 'chat_message', 'download', 'book_meeting', 'booking_click', 'payment_click', 'social_share', 'question_asked'] as const

// Client stages in order. A view can move a client UP to 'engaged' but never
// back down — a converted client who rewatches is still converted.
const STATUS_RANK: Record<string, number> = { lead: 0, inactive: 0, active: 1, engaged: 2, converted: 3 }

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
    if (event && !VALID_EVENTS.includes(event as typeof VALID_EVENTS[number])) {
      return NextResponse.json({ error: 'Unknown event' }, { status: 400 })
    }
    const eventType = event || 'view'

    const supabase = createAdminClient()

    // Get viewer info from headers
    const viewerIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

    // Durable cross-instance limit (review S6) — in-memory maps reset per serverless instance.
    // Per-(ip+video+event): max 30 per 60s, so a bot can't flood analytics or
    // amplify owner notifications. Same silent-throttle response as before.
    const { allowed } = await checkRateLimit(`track-view:ip:${viewerIp}:${videoId}:${eventType}`, 30, 60)
    if (!allowed) {
      return NextResponse.json({ ok: true, throttled: true })
    }

    // Verify the video actually exists before writing analytics / firing owner
    // notifications — stops flooding garbage ids to spam the owner (cost + noise).
    const { data: video } = await supabase
      .from('videos')
      .select('id, user_id, client_id, title')
      .eq('id', videoId)
      .maybeSingle()
    if (!video) {
      return NextResponse.json({ ok: true }) // silently no-op; don't reveal existence
    }

    // THE OWNER'S OWN VIEWS DON'T COUNT. Agents open their share link to check
    // it; that used to count as a client view and text the agent about
    // themselves. Only checked when a login cookie is present, so anonymous
    // clients don't pay for an extra auth call.
    if (await isOwnerViewing(video.user_id)) {
      return NextResponse.json({ ok: true, owner: true })
    }

    const viewerDevice = request.headers.get('user-agent') ?? 'unknown'
    const referrer = request.headers.get('referer') ?? null

    // ── Richer view context for owner notifications (all best-effort) ──
    const ua = viewerDevice.toLowerCase()
    const deviceLabel = ua.includes('ipad') || ua.includes('tablet') ? 'Tablet'
      : (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) ? 'Mobile'
      : 'Desktop'
    const browser = ua.includes('edg/') ? 'Edge'
      : ua.includes('chrome') && !ua.includes('edg/') ? 'Chrome'
      : ua.includes('firefox') ? 'Firefox'
      : ua.includes('safari') ? 'Safari'
      : null
    const os = ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios') ? 'iOS'
      : ua.includes('android') ? 'Android'
      : ua.includes('mac os') || ua.includes('macintosh') ? 'macOS'
      : ua.includes('windows') ? 'Windows'
      : ua.includes('linux') ? 'Linux'
      : null
    // Vercel injects geo headers at the edge (no extra API needed).
    const geoCity = request.headers.get('x-vercel-ip-city')
    const geoRegion = request.headers.get('x-vercel-ip-country-region')
    const geoCountry = request.headers.get('x-vercel-ip-country')
    let city: string | null = null
    if (geoCity) { try { city = decodeURIComponent(geoCity) } catch { city = geoCity } }
    const location = [city, geoRegion, geoCountry].filter(Boolean).join(', ') || null
    // Clean referrer to a hostname (full URLs are noisy).
    let referrerHost: string | null = null
    if (referrer) { try { referrerHost = new URL(referrer).hostname } catch { referrerHost = referrer.slice(0, 60) } }

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

    // The client this video was quoted to. A video can have several quotes
    // (re-quotes); take the newest real one. `.single()` used to error when
    // there were two, which quietly stopped all client tracking for the video.
    const { data: quote } = eventType === 'view'
      ? await supabase
          .from('quotes')
          .select('client_email, client_name')
          .eq('video_id', videoId)
          .neq('status', 'draft')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null }

    // Upsert client_profiles for intelligence tracking (view events only)
    if (eventType === 'view' && quote?.client_email) {
      try {
        const device = ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')
          ? 'mobile'
          : ua.includes('tablet') || ua.includes('ipad')
          ? 'tablet'
          : 'desktop'

        // Determine preferred time based on hour
        const hour = new Date().getUTCHours()
        const timeOfDay = hour < 6 ? 'night' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'

        const { data: existing } = await supabase
          .from('client_profiles')
          .select('id, total_views')
          .eq('user_id', video.user_id)
          .eq('client_email', quote.client_email)
          .limit(1)
          .maybeSingle()

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
      } catch (profileErr) {
        console.error('[track-view] Client profile upsert error:', profileErr)
      }
    }

    // Log activity to client record if viewer matches a client
    if (eventType === 'view' || eventType === 'play') {
      try {
        // Check if video has a client_id directly, or find via sent_emails
        let clientId = video.client_id
        if (!clientId) {
          const { data: sentEmail } = await supabase
            .from('sent_emails')
            .select('to_email')
            .eq('video_id', videoId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (sentEmail?.to_email) {
            const { data: client } = await supabase
              .from('clients')
              .select('id')
              .eq('user_id', video.user_id)
              .eq('email', sentEmail.to_email.toLowerCase())
              .maybeSingle()
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
            .select('total_views, status')
            .eq('id', clientId)
            .single()

          if (clientData) {
            const current = String(clientData.status ?? 'lead')
            const moveUp = (STATUS_RANK[current] ?? 0) < STATUS_RANK.engaged
            await supabase
              .from('clients')
              .update({
                total_views: (clientData.total_views ?? 0) + 1,
                last_activity_at: new Date().toISOString(),
                ...(moveUp ? { status: 'engaged' } : {}),
              })
              .eq('id', clientId)
          }
        }
      } catch (clientActErr) {
        console.error('[track-view] Client activity log error:', clientActErr)
      }
    }

    // Send notification email + SMS to video owner (view events only),
    // subject to the owner's alert setting and a per-viewer cooldown.
    if (eventType === 'view') {
      try {
        await maybeAlertOwner({
          supabase, videoId, ownerId: video.user_id, videoTitle: video.title ?? 'Untitled',
          viewerIp, viewerName: quote?.client_name ?? null,
          details: { device: deviceLabel, browser, os, location, referrer: referrerHost },
        })
      } catch (notifyErr) {
        // Don't fail the view tracking if notification fails
        console.error('[track-view] Notification error:', notifyErr)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    console.error('[track-view] Error:', err)
    return NextResponse.json({ error: 'Could not record that event' }, { status: 500 })
  }
}

/** Is the signed-in visitor the video's owner? Never throws. */
async function isOwnerViewing(ownerId: string): Promise<boolean> {
  try {
    const store = await cookies()
    if (!store.getAll().some(c => c.name.startsWith('sb-'))) return false
    const sb = await createClient()
    const { data: { user } } = await sb.auth.getUser()
    return !!user && user.id === ownerId
  } catch {
    return false
  }
}

async function maybeAlertOwner(o: {
  supabase: ReturnType<typeof createAdminClient>
  videoId: string
  ownerId: string
  videoTitle: string
  viewerIp: string
  viewerName: string | null
  details: Pick<ViewDetails, 'device' | 'browser' | 'os' | 'location' | 'referrer'>
}) {
  const { supabase, videoId, ownerId, videoTitle, viewerIp } = o

  const { data: profile } = await supabase
    .from('profiles')
    .select('email, full_name, phone')
    .eq('id', ownerId)
    .single()
  if (!profile) return

  // The agent's alert setting (migration 20260926). Missing column → 'all'.
  const { data: prefRow, error: prefErr } = await supabase
    .from('profiles').select('view_alerts').eq('id', ownerId).maybeSingle()
  const pref = normalizePref(prefErr ? null : (prefRow as { view_alerts?: string } | null)?.view_alerts)
  if (pref === 'off') return

  const since = new Date(Date.now() - COOLDOWN_HOURS * 3600 * 1000).toISOString()
  const [{ count: totalViews }, { count: priorFromIp }, { count: recentFromIp }] = await Promise.all([
    supabase.from('video_analytics').select('id', { count: 'exact', head: true })
      .eq('video_id', videoId).eq('event_type', 'view'),
    supabase.from('video_analytics').select('id', { count: 'exact', head: true })
      .eq('video_id', videoId).eq('event_type', 'view').eq('viewer_ip', viewerIp),
    supabase.from('video_analytics').select('id', { count: 'exact', head: true })
      .eq('video_id', videoId).eq('event_type', 'view').eq('viewer_ip', viewerIp).gte('created_at', since),
  ])
  if (!shouldSendViewAlert({ pref, viewsFromViewerInCooldown: recentFromIp ?? 0, viewsFromViewerEver: priorFromIp ?? 0 })) return

  // A burst of different viewers (a link posted somewhere) must not become a
  // burst of texts: at most 6 alerts per video per hour.
  const { allowed } = await checkRateLimit(`view-alert:video:${videoId}`, 6, 3600)
  if (!allowed) return

  const details: ViewDetails = {
    ...o.details,
    viewerIp,
    viewerName: o.viewerName,
    viewNumber: totalViews ?? null,
    isReturningViewer: (priorFromIp ?? 0) > 1,
    viewedAt: new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
    videoId,
  }

  // Send email via connected provider if available, otherwise fall back to Resend
  if (profile.email) {
    const { data: connection } = await supabase
      .from('email_connections')
      .select('*')
      .eq('user_id', ownerId)
      .eq('is_default', true)
      .limit(1)
      .maybeSingle()

    let sent = false
    if (connection) {
      try {
        const { sendViaConnection } = await import('../../_lib/email')
        const subject = `${o.viewerName ? o.viewerName + ' viewed' : 'Someone viewed'} your video: ${videoTitle}`
        await sendViaConnection(connection as EmailConnection, profile.email, subject, buildVideoViewedHtml(videoTitle, details))
        sent = true
      } catch (e) {
        console.error('[track-view] connected-mailbox alert failed, using fallback:', e)
      }
    }
    if (!sent) await sendVideoViewedEmail(profile.email, videoTitle, details)
  }

  // Send SMS to creator if they have a phone number
  if (profile.phone) {
    await sendVideoViewedSms(profile.phone, videoTitle, details)
  }
}
