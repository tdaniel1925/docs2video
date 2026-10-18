import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { buildEmailTemplate, sendViaGoogle, sendViaMicrosoft, sendViaSMTP } from '../../_lib/email'
import { rateLimit, getRateLimitKey, LIMITS, checkRateLimit } from '../../_lib/rate-limit'
import type { EmailConnection } from '../../_lib/types'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  // In-memory limit (per server) + the shared one (across servers, when the
  // rate_limit_hit function exists) — the in-memory map alone resets on
  // every cold start.
  const rl = rateLimit(getRateLimitKey(user.id, 'email'), LIMITS.email.limit, LIMITS.email.windowMs)
  if (!rl.allowed || !(await checkRateLimit(`client-email:user:${user.id}`, 30, 3600)).allowed) {
    return NextResponse.json({ error: 'Email rate limit exceeded. Please try again later.' }, { status: 429 })
  }

  const body = await request.json()
  const { toEmail, toName, subject, videoId, infographicId, connectionId } = body as {
    toEmail: string
    toName: string
    subject: string
    videoId?: string
    infographicId?: string
    connectionId: string
  }

  if (!toEmail || !EMAIL_RE.test(toEmail.trim())) {
    return NextResponse.json({ error: 'Invalid recipient email address' }, { status: 400 })
  }
  if (!subject?.trim()) {
    return NextResponse.json({ error: 'Subject is required' }, { status: 400 })
  }

  // Get email connection
  const { data: connection } = await supabase
    .from('email_connections')
    .select('*')
    .eq('id', connectionId)
    .eq('user_id', user.id)
    .single()

  if (!connection) return NextResponse.json({ error: 'Email connection not found' }, { status: 404 })
  const conn = connection as EmailConnection

  // Get agent profile
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const agentName = profile?.full_name ?? profile?.company_name ?? 'Your Agent'

  // Get brand
  const { data: brand } = await supabase.from('brands').select('*').eq('user_id', user.id).eq('is_default', true).single()

  // Get content URLs
  let videoUrl: string | undefined
  let infographicUrl: string | undefined
  let thumbnailUrl: string | undefined
  let title = 'Your Policy Overview'

  if (videoId) {
    const { data: video } = await supabase.from('videos').select('*').eq('id', videoId).eq('user_id', user.id).single()
    if (video) {
      videoUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001'}/watch/${videoId}`
      thumbnailUrl = video.thumbnail_url
      title = video.title ?? title
    }
  }

  if (infographicId) {
    const { data: ig } = await supabase.from('infographics').select('*').eq('id', infographicId).single()
    if (ig) {
      // the raw storage image is used ONLY as the email's preview thumbnail — NEVER
      // as the click target. There is no branded infographic viewer page yet, so the
      // CTA points at the app's branded infographics page instead of a bare file URL.
      infographicUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001'}/infographics`
      thumbnailUrl = ig.image_url
      title = ig.title ?? title
    }
  }

  // Create tracking pixel URL
  const { data: sentRecord } = await supabase.from('sent_emails').insert({
    user_id: user.id,
    video_id: videoId ?? null,
    infographic_id: infographicId ?? null,
    connection_id: connectionId,
    to_email: toEmail,
    to_name: toName || null,
    subject,
  }).select().single()

  const trackingPixelUrl = sentRecord
    ? `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001'}/api/email-track?id=${sentRecord.id}`
    : undefined

  // Build email HTML
  const html = buildEmailTemplate({
    videoUrl,
    infographicUrl,
    thumbnailUrl,
    title,
    clientName: toName || 'there',
    agentName,
    agentPhoto: profile?.photo_url,
    logoUrl: brand?.logo_file_url ?? brand?.logo_url,
    brandColors: {
      primary: brand?.primary_color ?? '#1B365D',
      secondary: brand?.secondary_color ?? '#4A90D9',
      accent: brand?.accent_color ?? '#FFB347',
    },
    trackingPixelUrl,
  })

  try {
    switch (conn.provider) {
      case 'google':
        await sendViaGoogle(conn, toEmail, subject, html)
        break
      case 'microsoft':
        await sendViaMicrosoft(conn, toEmail, subject, html)
        break
      case 'smtp':
        await sendViaSMTP(conn, toEmail, subject, html)
        break
    }

    // Log activity to client record
    try {
      const { createAdminClient } = await import('../../_lib/supabase/admin')
      const admin = createAdminClient()
      const normalizedEmail = toEmail.toLowerCase().trim()

      const { data: existingClient } = await admin
        .from('clients')
        .select('id, status')
        .eq('user_id', user.id)
        .eq('email', normalizedEmail)
        .maybeSingle()

      let cid = existingClient?.id
      if (!cid) {
        const { data: newClient } = await admin
          .from('clients')
          .insert({
            user_id: user.id,
            name: toName || normalizedEmail,
            email: normalizedEmail,
            source: 'email',
            status: 'active',
            total_videos_sent: videoId ? 1 : 0,
            first_contact_at: new Date().toISOString(),
            last_activity_at: new Date().toISOString(),
          })
          .select('id')
          .single()
        cid = newClient?.id
      } else {
        // Never DOWNGRADE: an engaged or converted client stays that way.
        const promote = ['lead', 'inactive', null, undefined].includes(existingClient?.status as string | null | undefined)
        await admin
          .from('clients')
          .update({ last_activity_at: new Date().toISOString(), ...(promote ? { status: 'active' } : {}) })
          .eq('id', cid)
      }

      if (cid) {
        await admin.from('client_activities').insert({
          client_id: cid,
          user_id: user.id,
          type: 'email_sent',
          title: `Email sent: ${subject}`,
          description: `Sent "${title}" to ${normalizedEmail}`,
          metadata: { video_id: videoId ?? null, subject },
        })
      }
    } catch (actErr) {
      console.error('[send-email] Activity log error:', actErr)
    }

    return NextResponse.json({ success: true, sentEmailId: sentRecord?.id })
  } catch (err) {
    // It didn't go — remove the tracking row so the history doesn't list an
    // email the client never received.
    // (Service role: the table has no delete policy for signed-in users.)
    if (sentRecord?.id) {
      const { createAdminClient } = await import('../../_lib/supabase/admin')
      await createAdminClient().from('sent_emails').delete().eq('id', sentRecord.id).eq('user_id', user.id)
    }
    const message = err instanceof Error ? err.message : 'Failed to send email'
    return NextResponse.json({ error: `The email did NOT send: ${message}` }, { status: 500 })
  }
}
