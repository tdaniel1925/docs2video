import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { isAdmin } from '../../../_lib/admin'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { videoId } = await request.json() as { videoId: string }
  if (!videoId) {
    return NextResponse.json({ error: 'videoId is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  try {
    const { error } = await admin
      .from('videos')
      .update({ status: 'pending', error_message: null, progress_pct: 0, progress_detail: null })
      .eq('id', videoId)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/retry-video] Error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
