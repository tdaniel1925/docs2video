import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import {
  authenticateApiKey,
  getApiBalance,
  chargeApiCredits,
  refundApiCredits,
  checkApiRateLimit,
  logApiUsage,
} from '../../../_lib/api-auth'
import { videoServiceUrl } from '../../../_lib/video-service'

export const runtime = 'nodejs'
export const maxDuration = 60

const VIDEO_ASSEMBLY_URL = videoServiceUrl()
const VIDEO_ASSEMBLY_SECRET = (process.env.VIDEO_ASSEMBLY_SECRET || '').trim().replace(/[\r\n]/g, '')

// Flat price for a produced commercial (same as the UI route COMMERCIAL_COST).
const COMMERCIAL_COST = 600

const STYLE_IDS = ['fintech', 'luxury', 'tech', 'upbeat', 'emerald', 'redblueprint', 'data', 'playful', 'casino', 'clean']

interface Body {
  url?: string
  text?: string
  brandName?: string
  style?: string
  music?: string
  musicUrl?: string
  webhook_url?: string
}

/**
 * POST /api/v1/commercials
 * Public, async commercial generation from a URL (or pasted text). The VPS runs
 * the whole director (comprehend → direct → VO → images → ElevenLabs Music →
 * render). Auth: Authorization: Bearer <api_key>. Charges the metered API credit
 * pool. Returns { job_id, status: 'queued' }; poll GET /api/v1/videos/{job_id}.
 */
export async function POST(request: Request) {
  const caller = await authenticateApiKey(request)
  if (!caller) return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })

  if (!(await checkApiRateLimit(caller.keyId))) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  let body: Body
  try { body = (await request.json()) as Body } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  const { url, text, brandName, music, musicUrl } = body
  if (!url?.trim() && !text?.trim()) {
    return NextResponse.json({ error: 'url (or text) is required' }, { status: 400 })
  }
  const style = body.style && STYLE_IDS.includes(body.style) ? body.style : undefined

  // --- Metered API credit check + charge (separate from UI credits) ---
  const balance = await getApiBalance(caller.userId)
  if (balance < COMMERCIAL_COST) {
    return NextResponse.json({ error: `Insufficient API credits. Need ${COMMERCIAL_COST}, have ${balance}.` }, { status: 402 })
  }
  if (!(await chargeApiCredits(caller.userId, COMMERCIAL_COST))) {
    return NextResponse.json({ error: 'Insufficient API credits.' }, { status: 402 })
  }

  const admin = createAdminClient()
  const fail = async (status: number, message: string, jobId?: string) => {
    await refundApiCredits(caller.userId, COMMERCIAL_COST)
    await logApiUsage({ apiKeyId: caller.keyId, userId: caller.userId, endpoint: 'POST /api/v1/commercials', videoId: jobId ?? null, creditsCharged: 0, status: 'failed' })
    return NextResponse.json({ error: message, ...(jobId ? { job_id: jobId } : {}) }, { status })
  }

  // --- Create the videos row (job) ---
  const title = (brandName || (url ? safeHost(url) : 'Commercial')).slice(0, 120)
  const { data: row, error: insErr } = await admin
    .from('videos')
    .insert({
      user_id: caller.userId,
      status: 'processing',
      progress_pct: 5,
      progress_detail: 'Starting…',
      title,
      draft_data: { apiWebhookUrl: body.webhook_url || null, apiKeyId: caller.keyId, apiCost: COMMERCIAL_COST, source: 'api', kind: 'commercial' },
    })
    .select('id')
    .single()
  if (insErr || !row) return fail(500, 'Failed to create job')
  const jobId = row.id as string

  // --- VPS health pre-check (fast) ---
  try {
    const h = await fetch(`${VIDEO_ASSEMBLY_URL}/health`, { signal: AbortSignal.timeout(6000) })
    if (!h.ok) throw new Error(`health ${h.status}`)
  } catch {
    await admin.from('videos').update({ status: 'failed', error_message: 'Video service temporarily unavailable.' }).eq('id', jobId)
    return fail(503, 'Video service temporarily unavailable.', jobId)
  }

  // --- Kick off the VPS commercial pipeline (async on the VPS) ---
  try {
    const r = await fetch(`${VIDEO_ASSEMBLY_URL}/generate-commercial`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-secret': VIDEO_ASSEMBLY_SECRET },
      body: JSON.stringify({ videoId: jobId, userId: caller.userId, url, text, brandName, music, style, musicUrl }),
      signal: AbortSignal.timeout(30000),
    })
    if (!r.ok) throw new Error(`VPS ${r.status}: ${(await r.text()).slice(0, 160)}`)
  } catch (e: any) {
    await admin.from('videos').update({ status: 'failed', error_message: 'Could not start commercial generation.', progress_detail: `[fail] trigger: ${e.message}`.slice(0, 500) }).eq('id', jobId)
    return fail(502, 'Failed to start generation', jobId)
  }

  await logApiUsage({ apiKeyId: caller.keyId, userId: caller.userId, endpoint: 'POST /api/v1/commercials', videoId: jobId, creditsCharged: COMMERCIAL_COST, status: 'ok' })
  return NextResponse.json({ job_id: jobId, status: 'queued', credits_charged: COMMERCIAL_COST }, { status: 202 })
}

function safeHost(u: string): string {
  try { return new URL(u).hostname.replace(/^www\./, '') } catch { return 'Commercial' }
}
