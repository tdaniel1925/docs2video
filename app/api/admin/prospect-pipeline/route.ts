import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { requireAdmin } from '../../../_lib/admin'
import { videoServiceUrl } from '../../../_lib/video-service'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Admin prospect pipeline — paste prospect website URLs, each becomes a directed
 * sales-demo commercial for outreach.
 *
 * Generation runs ON THE VPS (the same director as the customer commercial
 * pipeline), NOT in-process on Vercel. Vercel is a thin orchestrator: it creates
 * a prospect_demos row (the admin dashboard polls it) + a videos row (the VPS
 * writes to it), then fires the VPS /generate-commercial with prospectId. The VPS
 * MIRRORS its progress + final result (video_url, thumbnail, company_name,
 * duration → status ready_for_review) back into prospect_demos.
 *
 * This replaced the old in-process pipeline (assembleVideo/ffmpeg-static + gemini
 * + tts) that bundled 3.55GB into this function and blocked all Vercel deploys.
 */

const VIDEO_ASSEMBLY_URL = videoServiceUrl()
const VIDEO_ASSEMBLY_SECRET = (process.env.VIDEO_ASSEMBLY_SECRET || '').trim().replace(/[\r\n]/g, '')

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

    // Fail fast if the VPS is down (so the admin gets a clear error, not a row
    // that spins forever).
    try {
      const health = await fetch(`${VIDEO_ASSEMBLY_URL}/health`, { signal: AbortSignal.timeout(6000) })
      if (!health.ok) throw new Error(`health ${health.status}`)
    } catch {
      return NextResponse.json({ error: 'The video service is temporarily unavailable. Please try again shortly.' }, { status: 503 })
    }

    const created: any[] = []
    for (const raw of rawList) {
      let parsedUrl: URL
      try { parsedUrl = new URL(raw.startsWith('http') ? raw : `https://${raw}`) }
      catch { created.push({ url: raw, error: 'Invalid URL' }); continue }

      // 1) prospect_demos row (the admin dashboard polls this).
      const { data: prospect, error: insertErr } = await admin
        .from('prospect_demos')
        .insert({ url: parsedUrl.href, status: 'generating', progress_pct: 5, stage_detail: 'Queued…' })
        .select()
        .single()
      if (insertErr || !prospect) { created.push({ url: parsedUrl.href, error: 'Insert failed' }); continue }

      // 2) videos row the VPS writes progress to (owned by the admin's user).
      const { data: video, error: vErr } = await admin
        .from('videos')
        .insert({ user_id: user.id, status: 'pending', progress_pct: 5, progress_detail: 'Starting…', title: `Prospect: ${parsedUrl.hostname.replace(/^www\./, '')}`.slice(0, 120) })
        .select('id')
        .single()
      if (vErr || !video) {
        await admin.from('prospect_demos').update({ status: 'failed', stage_detail: 'Could not start', error_message: 'videos row insert failed' }).eq('id', prospect.id)
        created.push({ url: parsedUrl.href, error: 'Video row insert failed' }); continue
      }

      // 3) Fire the VPS director (async — it 200s immediately, works in the
      //    background, and mirrors progress/result into prospect_demos).
      try {
        const res = await fetch(`${VIDEO_ASSEMBLY_URL}/generate-commercial`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-secret': VIDEO_ASSEMBLY_SECRET },
          body: JSON.stringify({ videoId: video.id, userId: user.id, url: parsedUrl.href, music: true, prospectId: prospect.id }),
          signal: AbortSignal.timeout(30000),
        })
        if (!res.ok) throw new Error(`VPS ${res.status}`)
      } catch (e: any) {
        await admin.from('prospect_demos').update({ status: 'failed', stage_detail: 'Could not start generation', error_message: e?.message?.slice(0, 300) ?? 'trigger failed' }).eq('id', prospect.id)
        created.push({ url: parsedUrl.href, error: 'Could not start generation' }); continue
      }

      created.push(prospect)
    }

    return NextResponse.json({ success: true, started: created.filter((c) => !c.error).length, prospects: created })
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
