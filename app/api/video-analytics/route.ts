import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const url = new URL(request.url)
  const videoId = url.searchParams.get('videoId')
  if (!videoId) return NextResponse.json({ error: 'Missing videoId' }, { status: 400 })

  // Verify user owns this video
  const { data: video } = await supabase.from('videos').select('id').eq('id', videoId).eq('user_id', user.id).single()
  if (!video) return NextResponse.json({ error: 'Video not found' }, { status: 404 })

  // Use admin client to bypass RLS on video_analytics
  const admin = createAdminClient()

  try {
    const { data, error } = await admin
      .from('video_analytics')
      .select('event_type')
      .eq('video_id', videoId)

    if (error) {
      // Table might not exist yet
      return NextResponse.json({ views: 0, plays: 0, chats: 0 })
    }

    const rows = data ?? []
    return NextResponse.json({
      views: rows.filter(r => r.event_type === 'view').length,
      plays: rows.filter(r => r.event_type === 'play').length,
      chats: rows.filter(r => r.event_type === 'chat_message').length,
    })
  } catch {
    return NextResponse.json({ views: 0, plays: 0, chats: 0 })
  }
}
