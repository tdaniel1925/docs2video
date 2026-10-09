import { NextResponse } from 'next/server'
import { normalizeUrl } from '../../_lib/normalize-url'
import { lookup } from 'node:dns/promises'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { logError } from '../../_lib/error-logger'
import { videoServiceUrl } from '../../_lib/video-service'
import { isSafePublicUrl } from '../../_lib/brand-scraper'
import { isPaidTier } from '../../_lib/subscription'
import { checkCredits, deductCredits, refundVideoCredits, CREDIT_COSTS } from '../../_lib/credits'
import { creditDeniedResponse } from '../../_lib/credit-charge'
import { rateLimit, getRateLimitKey, LIMITS } from '../../_lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 60

const VIDEO_ASSEMBLY_URL = videoServiceUrl()
const VIDEO_ASSEMBLY_SECRET = (process.env.VIDEO_ASSEMBLY_SECRET || '').trim().replace(/[\r\n]/g, '')

// Fixed price for a produced commercial (comprehend + Opus direction + N VO clips
// + hero images + render). Single source of truth: CREDIT_COSTS.commercial.
const COMMERCIAL_COST = CREDIT_COSTS.commercial

/**
 * Commercial-video trigger (Vercel = thin orchestrator; the render service runs the whole
 * director + render). Auth + credit-gate + create the videos row, then fire the
 * render service /generate-commercial, which comprehends the URL, DIRECTS the spec (styleId
 * + beats), generates per-beat VO + hero images, renders TemplateCommercial, and
 * uploads — writing progress back to the same videos row the UI polls.
 *
 * Body: { url } (or { text }), plus optional brandName, music, style (force one
 * of the 10 styleIds), musicUrl.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const rl = rateLimit(getRateLimitKey(user.id, 'generation'), LIMITS.generation.limit, LIMITS.generation.windowMs)
  if (!rl.allowed) return NextResponse.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 })

  let body: any
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const { url: rawUrl, text, brandName, music, style, musicUrl, logoUrl, goal } = body || {}
  // No one has to type https:// — "botmakers.ai" is fine. Cleaned BEFORE the
  // name check below, so the check and the render get the same address.
  const url = rawUrl ? normalizeUrl(rawUrl) : undefined
  if (rawUrl && !url && !text) return NextResponse.json({ error: 'That doesn’t look like a website — try something like yourcompany.com', code: 'bad_url' }, { status: 400 })
  if (!url && !text) return NextResponse.json({ error: 'Provide a url or text' }, { status: 400 })

  // A mistyped address ("botmakersa.ai") used to start the job, fail on the
  // render service with "fetch failed", and show only "generation failed".
  // Check the name exists first and say so in plain words — nothing charged.
  if (url) {
    let host = ''
    try { host = new URL(url).hostname } catch { /* bad address */ }
    const found = host ? await lookup(host).then(() => true, (e: NodeJS.ErrnoException) => e?.code !== 'ENOTFOUND') : false
    if (!found) {
      return NextResponse.json({ error: `We couldn't find ${host || 'that website'}. Check the address for a typo and try again — nothing was charged.`, code: 'site_not_found' }, { status: 400 })
    }
  }

  // SSRF (audit 2026-10-09): the website, music and logo addresses are fetched
  // by our servers. Refuse any that point at a private / loopback / link-local
  // (cloud metadata) address before anything is charged or sent. The render
  // service checks again on every redirect.
  for (const [label, u] of [['website', url], ['music', musicUrl], ['logo', logoUrl]] as const) {
    if (u == null || u === '') continue
    if (typeof u !== 'string' || !(await isSafePublicUrl(u))) {
      return NextResponse.json({ error: `That ${label} address can’t be used. Please use a normal public web address (https://…) — nothing was charged.`, code: 'blocked_url' }, { status: 400 })
    }
  }

  const admin = createAdminClient()

  // --- Credit gate (skip for admins/beta; paid + free users are charged) ---
  const { data: profile } = await admin.from('profiles').select('subscription_status, is_admin, is_beta').eq('id', user.id).single()
  // Free only for flagged admin/beta accounts (the email list alone no longer counts — audit 2026-10-09).
  const isPrivileged = profile?.is_admin === true || profile?.is_beta === true
  let deductedCost = 0
  if (!isPrivileged) {
    const check = await checkCredits(user.id, COMMERCIAL_COST)
    // No card yet / failed payment / banned get their own words and code (the
    // page sends 'card_required' to the card page) — not "not enough credits".
    if (!check.allowed) return creditDeniedResponse(check, COMMERCIAL_COST)
  }

  // create the videos row the UI polls for progress.
  const { data: video, error: insErr } = await admin
    .from('videos')
    // 'pending' — the videos_status_check constraint rejects 'processing'.
    .insert({ user_id: user.id, status: 'pending', progress_pct: 5, progress_detail: 'Starting…', title: (brandName || (url ? new URL(url).hostname.replace(/^www\./, '') : 'Commercial')).toString().slice(0, 120) })
    .select('id')
    .single()
  if (insErr || !video) {
    logError('generate-commercial', insErr || new Error('insert failed'), { userId: user.id })
    return NextResponse.json({ error: 'Could not start the commercial' }, { status: 500 })
  }
  const videoId = video.id

  // deduct AFTER the row exists so a failure/refund is tied to a real videoId.
  if (!isPrivileged) {
    const ok = await deductCredits(user.id, COMMERCIAL_COST, 'commercial_generation', videoId)
    if (!ok) {
      await admin.from('videos').update({ status: 'failed', error_message: 'Credit deduction failed. Please try again.' }).eq('id', videoId)
      return NextResponse.json({ error: 'Credit deduction failed. Please try again.', videoId }, { status: 402 })
    }
    deductedCost = COMMERCIAL_COST
    await admin.from('videos').update({ deducted_cost: COMMERCIAL_COST }).eq('id', videoId).then(() => {}, () => {})
  }

  // any failure after deduction must refund + leave a terminal status (audit H2).
  const failAndRefund = async (status: number, message: string, detail?: string) => {
    await admin.from('videos').update({ status: 'failed', error_message: message, ...(detail ? { progress_detail: detail.slice(0, 500) } : {}) }).eq('id', videoId)
    if (deductedCost > 0) await refundVideoCredits(user.id, deductedCost, videoId)
    return NextResponse.json({ error: message, videoId }, { status })
  }

  // pre-check the render service is up so we fail early with a clear message (and refund).
  try {
    const health = await fetch(`${VIDEO_ASSEMBLY_URL}/health`, { signal: AbortSignal.timeout(6000) })
    if (!health.ok) throw new Error(`health ${health.status}`)
  } catch {
    return await failAndRefund(503, 'Video service is temporarily unavailable. Please try again shortly.')
  }

  // fire the render service job (async on the render service — it 200s immediately and works in the
  // background, writing progress to the videos row). We don't await the render.
  try {
    const res = await fetch(`${VIDEO_ASSEMBLY_URL}/generate-commercial`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-secret': VIDEO_ASSEMBLY_SECRET },
      body: JSON.stringify({ videoId, userId: user.id, url, text, brandName, music, style, musicUrl, logoUrl, goal }),
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) throw new Error(`render service ${res.status}: ${(await res.text()).slice(0, 160)}`)
  } catch (e: any) {
    logError('generate-commercial', e, { userId: user.id, videoId })
    return await failAndRefund(502, 'Could not start commercial generation.', `[fail] trigger: ${e.message}`)
  }

  return NextResponse.json({ success: true, videoId })
}
