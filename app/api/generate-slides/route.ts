import { NextResponse } from 'next/server'
import { VIDEO_WORKING } from '../../_lib/video-status'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { logError } from '../../_lib/error-logger'
import { videoServiceUrl } from '../../_lib/video-service'

export const runtime = 'nodejs'
export const maxDuration = 60

const VIDEO_ASSEMBLY_URL = videoServiceUrl()
const VIDEO_ASSEMBLY_SECRET = (process.env.VIDEO_ASSEMBLY_SECRET || '').trim().replace(/[\r\n]/g, '')

/**
 * Slide-deck video trigger (Vercel = thin orchestrator; the VPS does the heavy
 * work). Auth + create the videos row, then fire-and-forget POST the source to
 * the VPS /generate-slides, which reads the doc, comprehends + writes the deck,
 * generates VO + backdrops, renders DirectedVideo, and uploads the mp4 — writing
 * progress back to the same videos row the UI polls.
 *
 * Accepts one of: { fileBase64, fileName } (document), { text } (pasted), or
 * { url } (website — pending Playwright on the VPS). Plus optional preparer,
 * recipient, music, glass, footer, accent, logoUrl, musicUrl.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let body: any
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const { fileBase64, fileName, text, url, preparer, recipient, music, glass, footer, accent, logoUrl, musicUrl } = body || {}
  if (!fileBase64 && !text && !url) {
    return NextResponse.json({ error: 'Provide a document (fileBase64), text, or url' }, { status: 400 })
  }

  const admin = createAdminClient()

  // THE CLOSING CONTACT is the AGENT'S, never our platform. If the caller didn't
  // pass a footer, build one from the agent's profile in priority order:
  // website → calendly → phone → email → company. Only fall back further if the
  // agent has set literally nothing. (Bug this fixes: the footer was defaulting
  // to docs2video.com on the client-facing closing slide.)
  let contactFooter: string | undefined = (footer || '').toString().trim() || undefined
  let profilePreparer: string | undefined
  if (!contactFooter || !preparer) {
    const { data: prof } = await admin
      .from('profiles')
      .select('full_name, company_name, phone, calendly_url, email, payment_link_url')
      .eq('id', user.id).maybeSingle()
    const p = prof as Record<string, string | null> | null
    profilePreparer = (p?.full_name || p?.company_name || undefined) as string | undefined
    if (!contactFooter && p) {
      const fmtPhone = (raw?: string | null) => {
        const d = (raw || '').replace(/\D/g, '')
        if (d.length === 11 && d.startsWith('1')) return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`
        if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
        return raw || ''
      }
      contactFooter =
        (p.payment_link_url && p.payment_link_url.replace(/^https?:\/\//, '')) ||
        (p.calendly_url && p.calendly_url.replace(/^https?:\/\//, '')) ||
        (p.phone ? fmtPhone(p.phone) : '') ||
        p.email ||
        p.company_name ||
        undefined
    }
  }

  // create the videos row the UI will poll for progress.
  const { data: video, error: insErr } = await admin
    .from('videos')
    .insert({ user_id: user.id, status: VIDEO_WORKING, progress_pct: 5, progress_detail: 'Starting…', title: (preparer || fileName || 'Slide video').toString().slice(0, 120) })
    .select('id')
    .single()
  if (insErr || !video) {
    logError('generate-slides', insErr || new Error('insert failed'), { userId: user.id })
    return NextResponse.json({ error: 'Could not start the video' }, { status: 500 })
  }
  const videoId = video.id

  // pre-check the VPS is up (fast) so we fail early with a clear message.
  try {
    const health = await fetch(`${VIDEO_ASSEMBLY_URL}/health`, { signal: AbortSignal.timeout(6000) })
    if (!health.ok) throw new Error(`health ${health.status}`)
  } catch (e: any) {
    await admin.from('videos').update({ status: 'failed', error_message: 'Video service is temporarily unavailable. Please try again shortly.' }).eq('id', videoId)
    return NextResponse.json({ error: 'Video service unavailable', videoId }, { status: 503 })
  }

  // fire the VPS job (async on the VPS — it 200s immediately and works in the
  // background, writing progress to the videos row). We don't await the render.
  try {
    const res = await fetch(`${VIDEO_ASSEMBLY_URL}/generate-slides`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-secret': VIDEO_ASSEMBLY_SECRET },
      body: JSON.stringify({ videoId, userId: user.id, fileBase64, fileName, text, url, preparer: preparer || profilePreparer, recipient, music, glass, footer: contactFooter, accent, logoUrl, musicUrl }),
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) throw new Error(`VPS ${res.status}: ${(await res.text()).slice(0, 160)}`)
  } catch (e: any) {
    await admin.from('videos').update({ status: 'failed', error_message: 'Could not start video generation.', progress_detail: `[fail] trigger: ${e.message}`.slice(0, 500) }).eq('id', videoId)
    logError('generate-slides', e, { userId: user.id, videoId })
    return NextResponse.json({ error: 'Could not start generation', videoId }, { status: 502 })
  }

  return NextResponse.json({ success: true, videoId })
}
