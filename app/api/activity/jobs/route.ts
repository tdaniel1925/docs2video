import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'

export const runtime = 'nodejs'
export const maxDuration = 30

// A job still "in progress" after this long has stopped; nothing will move it again.
const STALE_MS = 2 * 60 * 60 * 1000

type Job = {
  id: string; type: string; title: string | null; status: string; progress: number
  metadata: Record<string, unknown> | null; result_url: string | null; error_message: string | null
  created_at: string; completed_at: string | null
}

/*
 * The Activity page's jobs (2026-11-15). A video's job used to stop at 5% for good: the video is
 * finished later by the render service, which never touched the job. So each time the list is read,
 * a video job takes its state from the VIDEO itself (made → Done with a link, failed → Didn't finish,
 * deleted → gone), and any other job left "in progress" for over two hours is closed as unfinished.
 * The fixes are saved, so they stay fixed. Each video job also gets the video's real title.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createAdminClient()
  const { data } = await admin
    .from('jobs')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)
  let jobs = (data ?? []) as Job[]

  const videoIds = [...new Set(jobs.map((j) => (j.type === 'video' ? j.metadata?.videoId : null)).filter((v): v is string => typeof v === 'string'))]
  const videos = new Map<string, { status: string; title: string | null; created_at: string }>()
  if (videoIds.length) {
    const { data: vs } = await admin.from('videos').select('id, status, title, created_at').in('id', videoIds).eq('user_id', user.id)
    for (const v of vs ?? []) videos.set(v.id as string, v as { status: string; title: string | null; created_at: string })
  }

  const gone: string[] = []
  const fixes: Array<{ id: string; update: Record<string, unknown> }> = []
  const now = Date.now()
  jobs = jobs.flatMap((j) => {
    const vid = j.type === 'video' && typeof j.metadata?.videoId === 'string' ? j.metadata.videoId : null
    const active = j.status === 'queued' || j.status === 'running'
    if (vid) {
      const v = videos.get(vid)
      if (!v) { gone.push(j.id); return [] } // the video was deleted
      const title = v.title ? `Video: ${v.title}` : j.title
      if (active && v.status === 'completed') {
        const update = { status: 'completed', progress: 100, completed_at: j.completed_at ?? new Date().toISOString(), result_url: `/videos/${vid}`, title }
        fixes.push({ id: j.id, update })
        return [{ ...j, ...update } as Job]
      }
      if (active && v.status === 'failed') {
        const update = { status: 'failed', error_message: j.error_message ?? 'This video didn’t finish.', title }
        fixes.push({ id: j.id, update })
        return [{ ...j, ...update } as Job]
      }
      if (title !== j.title) { fixes.push({ id: j.id, update: { title } }); j = { ...j, title } }
      if (!j.result_url && j.status === 'completed') j = { ...j, result_url: `/videos/${vid}` }
    }
    if (active && now - new Date(j.created_at).getTime() > STALE_MS) {
      const update = { status: 'failed', error_message: 'Stopped without finishing.' }
      fixes.push({ id: j.id, update })
      return [{ ...j, ...update } as Job]
    }
    return [j]
  })

  // Save the fixes (best effort — the list above is right either way).
  await Promise.all([
    gone.length ? admin.from('jobs').delete().in('id', gone).eq('user_id', user.id) : null,
    ...fixes.map((f) => admin.from('jobs').update(f.update).eq('id', f.id).eq('user_id', user.id)),
  ].filter(Boolean)).catch(() => {})

  return NextResponse.json({ jobs })
}

// Remove one job, or every finished/unfinished one ("Clear"), from the list. Owner-scoped.
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { id, all } = (await request.json().catch(() => ({}))) as { id?: string; all?: 'completed' | 'failed' }
  const admin = createAdminClient()
  if (id) await admin.from('jobs').delete().eq('id', id).eq('user_id', user.id)
  else if (all === 'completed' || all === 'failed') await admin.from('jobs').delete().eq('user_id', user.id).eq('status', all)
  else return NextResponse.json({ error: 'Say which job' }, { status: 400 })
  return NextResponse.json({ success: true })
}
