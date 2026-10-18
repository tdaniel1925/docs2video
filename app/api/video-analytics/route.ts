import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
export const maxDuration = 30

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
    // Count queries, not row fetches: a row fetch stops at 1,000, so a
    // popular video's numbers used to freeze there.
    const count = (type: string) => admin
      .from('video_analytics')
      .select('id', { count: 'exact', head: true })
      .eq('video_id', videoId)
      .eq('event_type', type)
    const [v, p, c] = await Promise.all([count('view'), count('play'), count('chat_message')])

    if (v.error) {
      // Table might not exist yet
      return NextResponse.json({ views: 0, plays: 0, chats: 0 })
    }

    return NextResponse.json({
      views: v.count ?? 0,
      plays: p.count ?? 0,
      chats: c.count ?? 0,
    })
  } catch {
    return NextResponse.json({ views: 0, plays: 0, chats: 0 })
  }
}
