import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../_lib/supabase/server'
import { createAdminClient } from '../../../../_lib/supabase/admin'

export const maxDuration = 30

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, context: RouteContext) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { id } = await context.params
  const admin = createAdminClient()

  // Get client and verify ownership
  const { data: client } = await admin
    .from('clients')
    .select('id, email')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  // Videos directly assigned to this client
  const { data: assignedVideos } = await admin
    .from('videos')
    .select('id, title, thumbnail_url, status, created_at')
    .eq('client_id', id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // Videos sent to this client's email
  let emailVideos: typeof assignedVideos = []
  if (client.email) {
    const { data: sentEmails } = await admin
      .from('sent_emails')
      .select('video_id')
      .eq('user_id', user.id)
      .eq('to_email', client.email)
      .not('video_id', 'is', null)

    if (sentEmails && sentEmails.length > 0) {
      const videoIds = [...new Set(sentEmails.map(e => e.video_id).filter(Boolean))]
      const { data: vids } = await admin
        .from('videos')
        .select('id, title, thumbnail_url, status, created_at')
        .in('id', videoIds)
        .order('created_at', { ascending: false })
      emailVideos = vids ?? []
    }
  }

  // Merge and deduplicate
  const seen = new Set<string>()
  const allVideos = []
  for (const v of [...(assignedVideos ?? []), ...(emailVideos ?? [])]) {
    if (!seen.has(v.id)) {
      seen.add(v.id)
      allVideos.push(v)
    }
  }

  // Get view counts for each video
  const videoIds = allVideos.map(v => v.id)
  let viewCounts: Record<string, { views: number; plays: number }> = {}
  if (videoIds.length > 0) {
    const { data: analytics } = await admin
      .from('video_analytics')
      .select('video_id, event_type')
      .in('video_id', videoIds)

    if (analytics) {
      for (const a of analytics) {
        if (!viewCounts[a.video_id]) viewCounts[a.video_id] = { views: 0, plays: 0 }
        if (a.event_type === 'view') viewCounts[a.video_id].views++
        if (a.event_type === 'play') viewCounts[a.video_id].plays++
      }
    }
  }

  const enriched = allVideos.map(v => ({
    ...v,
    views: viewCounts[v.id]?.views ?? 0,
    plays: viewCounts[v.id]?.plays ?? 0,
  }))

  return NextResponse.json({ videos: enriched })
}
