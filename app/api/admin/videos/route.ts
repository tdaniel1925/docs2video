import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { requireAdmin } from '../../../_lib/admin'
import { ADMIN_VIDEO_COLUMNS } from '../../../_lib/admin/columns'
import { failReason, reviewReason } from '../../../_lib/admin/fail-reason'

export const maxDuration = 30

const RUNNING = ['pending', 'scripting', 'generating_slides', 'generating_audio', 'assembling', 'processing', 'rendering']

/**
 * GET /api/admin/videos?page=0&status=&since=24h&q= — one page of videos with
 * the owner's email, view/play counts for THAT page only, and (for failed and
 * held ones) the saved reason in plain words. Counted by the database.
 *   status: '' | completed | failed | running | review_required | draft
 *   since:  '' | 24h | 7d
 */
export async function GET(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  const url = new URL(request.url)
  const page = Math.max(0, Number(url.searchParams.get('page')) || 0)
  const size = Math.min(100, Math.max(5, Number(url.searchParams.get('size')) || 25))
  const status = url.searchParams.get('status') || ''
  const since = url.searchParams.get('since') || ''
  const q = (url.searchParams.get('q') || '').trim().replace(/[%,()]/g, '')

  const db = createAdminClient()
  let query = db.from('videos').select(ADMIN_VIDEO_COLUMNS, { count: 'exact' })
    .order('updated_at', { ascending: false }).range(page * size, page * size + size - 1)
  if (status === 'running') query = query.in('status', RUNNING)
  else if (status) query = query.eq('status', status)
  else query = query.neq('status', 'draft')
  if (since === '24h') query = query.gte('updated_at', new Date(Date.now() - 86_400_000).toISOString())
  if (since === '7d') query = query.gte('updated_at', new Date(Date.now() - 7 * 86_400_000).toISOString())
  if (q) query = query.ilike('title', `%${q}%`)
  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = data ?? []
  const ids = rows.map((v) => v.id)
  const owners = [...new Set(rows.map((v) => v.user_id))]
  const [{ data: profiles }, { data: events }] = await Promise.all([
    owners.length ? db.from('profiles').select('id, email').in('id', owners) : Promise.resolve({ data: [] as { id: string; email: string }[] }),
    ids.length ? db.from('video_analytics').select('video_id, event_type').in('video_id', ids).limit(20000) : Promise.resolve({ data: [] as { video_id: string; event_type: string }[] }),
  ])
  const emailOf = new Map((profiles ?? []).map((p) => [p.id, p.email]))
  const stats: Record<string, { views: number; plays: number }> = {}
  for (const e of events ?? []) {
    const s = (stats[e.video_id] ??= { views: 0, plays: 0 })
    if (e.event_type === 'view') s.views++
    if (e.event_type === 'play') s.plays++
  }

  return NextResponse.json({
    videos: rows.map((v) => {
      const reason = v.status === 'failed' ? failReason(v.progress_detail, v.error_message)
        : v.status === 'review_required' ? { plain: reviewReason(v.progress_detail), technical: v.progress_detail } : null
      return {
        id: v.id, user_id: v.user_id, title: v.title, status: v.status, output_type: v.output_type,
        created_at: v.created_at, updated_at: v.updated_at,
        owner_email: emailOf.get(v.user_id) ?? null,
        views: stats[v.id]?.views ?? 0, plays: stats[v.id]?.plays ?? 0,
        reason: reason?.plain ?? null, technical: reason?.technical ?? null,
      }
    }),
    total: count ?? 0,
    page,
    size,
  })
}
