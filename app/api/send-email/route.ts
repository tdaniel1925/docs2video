import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { buildEmailTemplate, sendViaGoogle, sendViaMicrosoft, sendViaSMTP } from '../../_lib/email'
import type { EmailConnection } from '../../_lib/types'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json()
  const { toEmail, toName, subject, videoId, infographicId, connectionId } = body as {
    toEmail: string
    toName: string
    subject: string
    videoId?: string
    infographicId?: string
    connectionId: string
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
    const { data: video } = await supabase.from('videos').select('*').eq('id', videoId).single()
    if (video) {
      videoUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001'}/watch/${videoId}`
      thumbnailUrl = video.thumbnail_url
      title = video.title ?? title
    }
  }

  if (infographicId) {
    const { data: ig } = await supabase.from('infographics').select('*').eq('id', infographicId).single()
    if (ig) {
      infographicUrl = ig.image_url
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

    return NextResponse.json({ success: true, sentEmailId: sentRecord?.id })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send email'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
