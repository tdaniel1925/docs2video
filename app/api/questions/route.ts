import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { alertMissingSchema, isMissingSchema } from '../../_lib/feature-tables'
import { OPEN_STATUSES } from '../../_lib/client-questions'

export const runtime = 'nodejs'

/**
 * GET /api/questions — the signed-in agent's client questions, newest first.
 *   ?videoId=…  only one video's
 *   ?open=1     only the ones still waiting on them
 * { available: false } when the questions table hasn't been made yet (the
 * screens then say so instead of breaking).
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const url = new URL(req.url)
  const videoId = url.searchParams.get('videoId')
  const open = url.searchParams.get('open') === '1'

  const admin = createAdminClient()
  let q = admin.from('client_questions')
    .select('id, video_id, question, asker_name, asker_email, status, ai_unsure, published, answered_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)
  if (videoId) q = q.eq('video_id', videoId)
  if (open) q = q.in('status', OPEN_STATUSES)
  const { data, error } = await q
  if (error) {
    if (isMissingSchema(error)) {
      await alertMissingSchema('questions', error.message)
      return NextResponse.json({ available: false, questions: [] })
    }
    console.error('[questions] list failed:', error.message)
    return NextResponse.json({ error: 'Could not load questions.' }, { status: 500 })
  }

  const rows = (data ?? []) as { video_id: string }[]
  const ids = [...new Set(rows.map((r) => r.video_id))]
  const titles = new Map<string, string>()
  if (ids.length) {
    const { data: vids } = await admin.from('videos').select('id, title').eq('user_id', user.id).in('id', ids)
    for (const v of (vids ?? []) as { id: string; title: string | null }[]) titles.set(v.id, v.title || 'Untitled')
  }
  return NextResponse.json({
    available: true,
    questions: rows.map((r) => ({ ...r, video_title: titles.get(r.video_id) ?? 'Untitled' })),
  })
}
