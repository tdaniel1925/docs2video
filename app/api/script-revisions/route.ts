import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const videoId = searchParams.get('videoId')

  if (!videoId) {
    return NextResponse.json({ error: 'Missing videoId parameter' }, { status: 400 })
  }

  // Verify user owns this video
  const { data: video } = await supabase
    .from('videos')
    .select('id')
    .eq('id', videoId)
    .eq('user_id', user.id)
    .single()

  if (!video) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 })
  }

  const admin = createAdminClient()
  const { data: revisions, error } = await admin
    .from('script_revisions')
    .select('id, revision_number, scenes, prompt_versions, created_at')
    .eq('video_id', videoId)
    .order('revision_number', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch revisions' }, { status: 500 })
  }

  return NextResponse.json({ revisions: revisions ?? [] })
}
