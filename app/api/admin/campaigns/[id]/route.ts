import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../_lib/supabase/admin'
import { requireAdmin } from '../../../../_lib/admin'
export const maxDuration = 300

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params
  const admin = createAdminClient()

  const { data: campaign, error } = await admin
    .from('campaigns')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  const { data: contacts } = await admin
    .from('campaign_contacts')
    .select('*')
    .eq('campaign_id', id)
    .order('created_at', { ascending: true })

  // Enrich each contact with its linked video's live progress (for the polling
  // UI): progress_pct + a stage label while generating, + thumbnail when ready.
  const list = contacts ?? []
  const videoIds = list.map((c: any) => c.video_id).filter(Boolean)
  let vmap: Record<string, any> = {}
  if (videoIds.length) {
    const { data: vids } = await admin
      .from('videos')
      .select('id, status, progress_pct, progress_detail, thumbnail_url, video_url')
      .in('id', videoIds)
    vmap = Object.fromEntries((vids ?? []).map((v: any) => [v.id, v]))
  }
  const enriched = list.map((c: any) => {
    const v = c.video_id ? vmap[c.video_id] : null
    return {
      ...c,
      video_progress_pct: v?.progress_pct ?? null,
      video_stage: v?.progress_detail ?? v?.status ?? null,
      video_thumbnail_url: v?.thumbnail_url ?? null,
      video_url: v?.video_url ?? null,
    }
  })

  return NextResponse.json({ ...campaign, contacts: enriched })
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params
  const body = await request.json()
  const { status } = body as { status: string }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('campaigns')
    .update({ status })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params
  const admin = createAdminClient()

  const { error } = await admin.from('campaigns').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
