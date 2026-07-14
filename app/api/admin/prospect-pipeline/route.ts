import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { requireAdmin } from '../../../_lib/admin'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Admin prospect pipeline.
 *
 * NOTE (2026-07): The generation step is being MIGRATED to run on the VPS (like
 * the customer commercial/slide pipelines) instead of assembling video in-process
 * on Vercel. The old in-process path imported _lib/video (ffmpeg-static),
 * _lib/gemini, _lib/composite, _lib/tts + _lib/script-generator, which bundled
 * FFmpeg + native deps into this serverless function — 3.55GB, past Vercel's
 * 250MB limit, blocking ALL deploys.
 *
 * This version keeps the admin dashboard's list/reject/cancel working and creates
 * the prospect rows, but marks new generations as pending the VPS migration
 * (see the follow-up task) rather than running FFmpeg here. No heavy imports.
 */

/** Write a coarse status + granular progress for the live dashboard. */
async function setProgress(
  admin: ReturnType<typeof createAdminClient>,
  prospectId: string,
  status: string,
  progress_pct: number,
  stage_detail: string,
) {
  await admin.from('prospect_demos').update({
    status, progress_pct, stage_detail, updated_at: new Date().toISOString(),
  }).eq('id', prospectId)
}

export async function POST(request: Request) {
  try {
    const user = await requireAdmin()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const body = (await request.json()) as {
      url?: string; urls?: string[]; prospectId?: string; action?: string; regenerateId?: string
    }
    const { url, urls, action, regenerateId } = body
    const targetId = body.prospectId
    const admin = createAdminClient()

    // Reject / Cancel branches: flip status and stop.
    if ((action === 'reject' || url === '__reject__') && targetId) {
      const { error } = await admin.from('prospect_demos').update({ status: 'rejected' }).eq('id', targetId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, status: 'rejected' })
    }
    if (action === 'cancel' && targetId) {
      const { error } = await admin.from('prospect_demos')
        .update({ status: 'cancelled', stage_detail: 'Cancelled', updated_at: new Date().toISOString() })
        .eq('id', targetId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, status: 'cancelled' })
    }

    // Accept either a single url or a batch (urls[]). Normalize to a list.
    const rawList = (urls && urls.length ? urls : url ? [url] : [])
      .map((u) => (u || '').trim()).filter(Boolean)
    if (rawList.length === 0) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Regenerate: delete the prior row so we end with ONE fresh row per URL.
    if (regenerateId) {
      await admin.from('prospect_demos').delete().eq('id', regenerateId)
    }

    // Create a queued row per URL. Generation now runs on the VPS (migration in
    // progress) — mark the row so the dashboard shows a clear status instead of
    // spinning forever or running FFmpeg here.
    const created: any[] = []
    for (const raw of rawList) {
      let parsedUrl: URL
      try { parsedUrl = new URL(raw.startsWith('http') ? raw : `https://${raw}`) }
      catch { created.push({ url: raw, error: 'Invalid URL' }); continue }

      const { data: prospect, error: insertErr } = await admin
        .from('prospect_demos')
        .insert({ url: parsedUrl.href, status: 'pending', progress_pct: 0, stage_detail: 'Queued — generation is moving to the VPS pipeline.' })
        .select()
        .single()
      if (insertErr || !prospect) { created.push({ url: parsedUrl.href, error: 'Insert failed' }); continue }

      // Temporary: until the VPS migration lands, leave the row in a clear
      // pending state rather than assembling video in-process.
      await setProgress(admin, prospect.id, 'pending', 0,
        'Generation temporarily paused while the prospect pipeline moves to the VPS.')
      created.push(prospect)
    }

    return NextResponse.json({ success: true, started: created.length, prospects: created })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const user = await requireAdmin()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('prospect_demos')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ prospects: data ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 })
  }
}
