import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
export const maxDuration = 60

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Get user's videos
  const { data: videos } = await admin
    .from('videos')
    .select('id, title')
    .eq('user_id', user.id)

  if (!videos || videos.length === 0) {
    return NextResponse.json({ clients: [] })
  }

  const videoIds = videos.map(v => v.id)

  // Get video views grouped by viewer info
  const { data: views } = await admin
    .from('video_views')
    .select('video_id, viewer_ip, viewer_device, created_at')
    .in('video_id', videoIds)

  // Get sent emails for open rates
  const { data: sentEmails } = await admin
    .from('sent_emails')
    .select('video_id, recipient, email_type, sent_at')
    .in('video_id', videoIds)

  // Get quotes for conversion data
  const { data: quotes } = await admin
    .from('quotes')
    .select('video_id, client_email, client_name, status, created_at')
    .in('video_id', videoIds)

  // Get client profiles
  const { data: profiles } = await admin
    .from('client_profiles')
    .select('*')
    .eq('user_id', user.id)

  // Build per-client stats from quotes as primary client identifier
  const clientMap = new Map<string, {
    email: string
    name: string
    totalViews: number
    videosSent: number
    avgEngagement: number
    lastActivity: string | null
    converted: boolean
    preferredDevice: string | null
    preferredTime: string | null
  }>()

  // Seed from quotes
  for (const q of quotes ?? []) {
    if (!q.client_email) continue
    const existing = clientMap.get(q.client_email)
    if (!existing) {
      clientMap.set(q.client_email, {
        email: q.client_email,
        name: q.client_name ?? '',
        totalViews: 0,
        videosSent: 1,
        avgEngagement: 0,
        lastActivity: q.created_at,
        converted: q.status === 'paid' || q.status === 'accepted',
        preferredDevice: null,
        preferredTime: null,
      })
    } else {
      existing.videosSent++
      if (q.status === 'paid' || q.status === 'accepted') existing.converted = true
      if (q.created_at && (!existing.lastActivity || q.created_at > existing.lastActivity)) {
        existing.lastActivity = q.created_at
      }
    }
  }

  // Enrich from sent emails
  for (const e of sentEmails ?? []) {
    if (!e.recipient) continue
    const existing = clientMap.get(e.recipient)
    if (existing && e.sent_at && (!existing.lastActivity || e.sent_at > existing.lastActivity)) {
      existing.lastActivity = e.sent_at
    }
  }

  // Enrich from client_profiles table
  for (const p of profiles ?? []) {
    if (!p.client_email) continue
    const existing = clientMap.get(p.client_email)
    if (existing) {
      existing.totalViews = p.total_views ?? existing.totalViews
      existing.preferredDevice = p.preferred_device
      existing.preferredTime = p.preferred_time
      if (p.last_viewed_at && (!existing.lastActivity || p.last_viewed_at > existing.lastActivity)) {
        existing.lastActivity = p.last_viewed_at
      }
      if (p.converted) existing.converted = true
    } else {
      clientMap.set(p.client_email, {
        email: p.client_email,
        name: p.client_name ?? '',
        totalViews: p.total_views ?? 0,
        videosSent: p.total_videos_sent ?? 0,
        avgEngagement: p.avg_watch_pct ?? 0,
        lastActivity: p.last_viewed_at ?? p.updated_at,
        converted: p.converted ?? false,
        preferredDevice: p.preferred_device,
        preferredTime: p.preferred_time,
      })
    }
  }

  const clients = Array.from(clientMap.values()).sort((a, b) => {
    if (!a.lastActivity) return 1
    if (!b.lastActivity) return -1
    return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
  })

  return NextResponse.json({ clients })
}
