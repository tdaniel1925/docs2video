import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
export const maxDuration = 30

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createAdminClient()

  // Get all completed videos by this user that have been sent (have sent_emails) or viewed
  const { data: videos } = await supabase
    .from('videos')
    .select('id, title, status, created_at')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })

  if (!videos || videos.length === 0) {
    return NextResponse.json({ clients: [] })
  }

  const videoIds = videos.map(v => v.id)

  // Get sent emails for these videos
  const { data: sentEmails } = await supabase
    .from('sent_emails')
    .select('to_email, to_name, video_id, created_at')
    .in('video_id', videoIds)
    .order('created_at', { ascending: false })

  // Get analytics for these videos (views, plays, chats)
  let analyticsRows: { video_id: string; event_type: string; created_at: string }[] = []
  try {
    const { data } = await admin
      .from('video_analytics')
      .select('video_id, event_type, created_at')
      .in('video_id', videoIds)
    if (data) analyticsRows = data
  } catch {
    // Table might not exist
  }

  // Get follow-up plans
  const { data: followUpPlans } = await supabase
    .from('follow_up_plans')
    .select('client_name, client_email, video_id')
    .eq('user_id', user.id)

  // Aggregate by client email
  const clientMap = new Map<string, {
    name: string
    email: string
    videosSent: number
    videoIds: string[]
    lastWatched: string | null
    totalViews: number
    totalPlays: number
    totalChats: number
  }>()

  // From sent emails
  for (const email of (sentEmails ?? [])) {
    const key = email.to_email.toLowerCase()
    if (!clientMap.has(key)) {
      clientMap.set(key, {
        name: email.to_name ?? '',
        email: email.to_email,
        videosSent: 0,
        videoIds: [],
        lastWatched: null,
        totalViews: 0,
        totalPlays: 0,
        totalChats: 0,
      })
    }
    const client = clientMap.get(key)!
    if (!client.videoIds.includes(email.video_id!)) {
      client.videoIds.push(email.video_id!)
      client.videosSent++
    }
    if (!client.name && email.to_name) client.name = email.to_name
  }

  // From follow-up plans
  for (const plan of (followUpPlans ?? [])) {
    if (!plan.client_email) continue
    const key = plan.client_email.toLowerCase()
    if (!clientMap.has(key)) {
      clientMap.set(key, {
        name: plan.client_name ?? '',
        email: plan.client_email,
        videosSent: 0,
        videoIds: [],
        lastWatched: null,
        totalViews: 0,
        totalPlays: 0,
        totalChats: 0,
      })
    }
    const client = clientMap.get(key)!
    if (!client.name && plan.client_name) client.name = plan.client_name
    if (plan.video_id && !client.videoIds.includes(plan.video_id)) {
      client.videoIds.push(plan.video_id)
      client.videosSent++
    }
  }

  // Enrich with analytics
  for (const row of analyticsRows) {
    // Find which client this video was sent to
    for (const [, client] of clientMap) {
      if (client.videoIds.includes(row.video_id)) {
        if (row.event_type === 'view') client.totalViews++
        if (row.event_type === 'play') client.totalPlays++
        if (row.event_type === 'chat_message') client.totalChats++
        if (row.event_type === 'view' || row.event_type === 'play') {
          if (!client.lastWatched || row.created_at > client.lastWatched) {
            client.lastWatched = row.created_at
          }
        }
      }
    }
  }

  // Build response
  const clients = Array.from(clientMap.values()).map(c => {
    let status: 'new' | 'watched' | 'engaged' = 'new'
    if (c.totalChats > 0) status = 'engaged'
    else if (c.totalPlays > 0 || c.totalViews > 0) status = 'watched'

    return {
      name: c.name,
      email: c.email,
      videosSent: c.videosSent,
      videoIds: c.videoIds,
      lastWatched: c.lastWatched,
      status,
      totalViews: c.totalViews,
      totalPlays: c.totalPlays,
      totalChats: c.totalChats,
    }
  })

  // Sort: engaged first, then watched, then new
  const statusOrder = { engaged: 0, watched: 1, new: 2 }
  clients.sort((a, b) => statusOrder[a.status] - statusOrder[b.status])

  return NextResponse.json({ clients })
}
