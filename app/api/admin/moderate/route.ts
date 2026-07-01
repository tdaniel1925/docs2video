import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { requireAdmin } from '../../../_lib/admin'

export const maxDuration = 30

export async function GET(request: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  try {
    const admin = createAdminClient()
    const { searchParams } = new URL(request.url)
    const flaggedOnly = searchParams.get('flagged') === 'true'

    let query = admin
      .from('videos')
      .select('id, title, status, created_at, user_id, flagged')
      .order('created_at', { ascending: false })
      .limit(100)

    if (flaggedOnly) {
      query = query.eq('flagged', true)
    }

    const { data: videos, error } = await query

    if (error) {
      console.error('[admin/moderate] DB error:', error)
      return NextResponse.json({ error: 'Failed to fetch videos' }, { status: 500 })
    }

    return NextResponse.json({ videos: videos ?? [] })
  } catch (err) {
    console.error('[admin/moderate] Error:', err)
    const message = err instanceof Error ? err.message : 'An unexpected error occurred'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  try {
    const admin = createAdminClient()
    const body = await request.json()
    const { action, videoId } = body as { action: string; videoId: string }

    if (!videoId || !action) {
      return NextResponse.json({ error: 'Missing videoId or action' }, { status: 400 })
    }

    if (!['flag', 'unflag', 'delete'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Must be flag, unflag, or delete' }, { status: 400 })
    }

    if (action === 'delete') {
      const { error } = await admin.from('videos').delete().eq('id', videoId)
      if (error) {
        console.error('[admin/moderate] Delete error:', error)
        return NextResponse.json({ error: 'Failed to delete video' }, { status: 500 })
      }
      return NextResponse.json({ success: true, action: 'deleted', videoId })
    }

    // flag or unflag
    const flagged = action === 'flag'
    const { error } = await admin
      .from('videos')
      .update({ flagged })
      .eq('id', videoId)

    if (error) {
      console.error('[admin/moderate] Update error:', error)
      return NextResponse.json({ error: `Failed to ${action} video` }, { status: 500 })
    }

    return NextResponse.json({ success: true, action, videoId })
  } catch (err) {
    console.error('[admin/moderate] Error:', err)
    const message = err instanceof Error ? err.message : 'An unexpected error occurred'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
