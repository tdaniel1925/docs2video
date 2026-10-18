import { NextResponse } from 'next/server'
import { createClient } from '../../../../_lib/supabase/server'
import { createAdminClient } from '../../../../_lib/supabase/admin'
import { sceneChoices, thumbMeta, uploadProblem, videoThumbnail } from '../../../../_lib/video-thumbnail'
import { THUMB_COLUMNS, pictureSize, setCustom, setScene, useCover, type ThumbRow } from '../../../../_lib/video-thumbnail-make'

export const runtime = 'nodejs'
export const maxDuration = 60

/*
 * /api/videos/<id>/thumbnail — the Library's "Change thumbnail" dialog.
 *   GET   what is in use, the cover, and the scenes to pick from
 *   POST  JSON { action: 'scene', index } | { action: 'cover' },
 *         or a form with `file` (the person's own picture, re-made at 1280×720)
 * Owner only; finished videos only. The choice goes to thumbnail_url, so the
 * library, the watch page, its link preview and the email all show it.
 */
async function ownRow(id: string): Promise<{ row: ThumbRow } | { res: NextResponse }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { res: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) }
  const admin = createAdminClient()
  const { data } = await admin.from('videos').select(THUMB_COLUMNS).eq('id', id).eq('user_id', user.id).maybeSingle()
  if (!data) return { res: NextResponse.json({ error: 'We couldn’t find that video.' }, { status: 404 }) }
  const row = data as unknown as ThumbRow
  if (row.status !== 'completed') return { res: NextResponse.json({ error: 'The thumbnail can be changed once the video is finished.' }, { status: 409 }) }
  return { row }
}

function view(row: ThumbRow) {
  const m = thumbMeta(row.draft_data)
  return {
    current: videoThumbnail(row),
    cover: m.cover || null,
    chosen: m.chosen === 'custom' && m.custom ? 'custom' : 'cover',
    scene: m.chosen === 'custom' ? (m.scene ?? null) : null,
    scenes: sceneChoices(row),
  }
}

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const got = await ownRow(id)
  if ('res' in got) return got.res
  return NextResponse.json(view(got.row))
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const got = await ownRow(id)
  if ('res' in got) return got.res
  const admin = createAdminClient()
  try {
    if ((req.headers.get('content-type') ?? '').startsWith('multipart/form-data')) {
      const form = await req.formData()
      const file = form.get('file')
      if (!(file instanceof Blob)) return NextResponse.json({ error: 'Choose a picture first.' }, { status: 400 })
      const early = uploadProblem({ type: file.type, size: file.size })
      if (early) return NextResponse.json({ error: early }, { status: 400 })
      const buf = Buffer.from(await file.arrayBuffer())
      const size = await pictureSize(buf)
      if (!size) return NextResponse.json({ error: 'We couldn’t read that picture. Try another.' }, { status: 400 })
      const late = uploadProblem({ type: file.type, size: file.size, ...size })
      if (late) return NextResponse.json({ error: late }, { status: 400 })
      await setCustom(admin, got.row, buf, null)
    } else {
      const body = await req.json().catch(() => ({})) as { action?: string; index?: unknown }
      if (body.action === 'scene' && typeof body.index === 'number' && Number.isInteger(body.index)) await setScene(admin, got.row, body.index)
      else if (body.action === 'cover') {
        if (!(await useCover(admin, got.row))) return NextResponse.json({ error: 'This video has no cover picture to go back to.' }, { status: 409 })
      } else return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 })
    }
  } catch (e) {
    console.error('[videos/thumbnail]', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: e instanceof Error && /scene has no picture/.test(e.message) ? e.message : 'We couldn’t save that thumbnail. Please try again.' }, { status: 500 })
  }
  const { data } = await admin.from('videos').select(THUMB_COLUMNS).eq('id', id).maybeSingle()
  return NextResponse.json(view((data ?? got.row) as unknown as ThumbRow))
}
