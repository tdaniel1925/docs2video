import { NextResponse } from 'next/server'
import { createClient } from '../../../../_lib/supabase/server'
import { createAdminClient } from '../../../../_lib/supabase/admin'
import { markReadySeen } from '../../../../_lib/video-ready'

export const runtime = 'nodejs'

/**
 * POST /api/videos/<id>/ready-seen
 *
 * The waiting screen calls this when it sees the project finish while the
 * person is still looking. It records the "ready" notice as already read, so
 * they don't also get the "your video is ready" email, and Home doesn't show
 * it under "Finished while you were away". Owner only; finished projects only.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createAdminClient()
  const { data: video } = await admin.from('videos')
    .select('id, user_id, title, status, output_type')
    .eq('id', id).eq('user_id', user.id).maybeSingle()
  if (!video) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await markReadySeen(admin, video)
  return NextResponse.json({ ok: true })
}
