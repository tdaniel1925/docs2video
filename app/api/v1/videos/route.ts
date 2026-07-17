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
import { calculateVideoCost } from '../../../_lib/credits'

export const runtime = 'nodejs'
export const maxDuration = 300

const BASE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://docs2video.com').replace(/\/$/, '')
const INTERNAL_SECRET = (process.env.INTERNAL_API_SECRET || '').trim()

type OutputType = 'video' | 'pptx' | 'pdf'
type DetailLevel = 'quick' | 'standard' | 'detailed'

interface V1Body {
  input?: {
    type: 'text' | 'url' | 'file' | 'idea'
    text?: string
    url?: string
    file_base64?: string
    filename?: string
    topic?: string
    audience?: string
    tone?: string
  }
  purpose?: string
  brandId?: string | null
  voiceId?: string
  styleId?: string
  /** Visual style (slides|aurora|cinematic|editorial|explainer). Distinct from
   *  styleId (a custom slide-template id). */
  videoStyle?: string
  detailLevel?: DetailLevel
  outputType?: OutputType
  recipientName?: string
  /** An approved brief (from POST /api/v1/brief) — steers what the video covers,
   *  same as the wizard's Review step. */
  brief?: unknown
  webhook_url?: string
}

/** Call an internal route server-to-server, acting as the resolved owner. */
async function callInternal(path: string, userId: string, body: unknown): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-internal-service': INTERNAL_SECRET,
      'x-internal-user-id': userId,
    },
    body: JSON.stringify(body),
  })
}

/**
 * GET /api/v1/videos
 * List the caller's recent videos (read-only, no charge). Owner-scoped by API key.
 * Query: ?limit=20 (max 50), ?status=completed|processing|failed|queued.
 * Returns { videos: [{ id, title, status, video_url, thumbnail_url, created_at }] }.
 */
export async function GET(request: Request) {
  const caller = await authenticateApiKey(request)
  if (!caller) return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })

  const url = new URL(request.url)
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '20', 10) || 20, 1), 50)
  const statusFilter = url.searchParams.get('status') || undefined

  const admin = createAdminClient()
  let q = admin
    .from('videos')
    .select('id, title, status, video_url, thumbnail_url, created_at')
    .eq('user_id', caller.userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (statusFilter) q = q.eq('status', statusFilter)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: 'Could not list videos' }, { status: 500 })

  const statusMap: Record<string, string> = { draft: 'queued', queued: 'queued', processing: 'processing', scripting: 'processing', generating_slides: 'processing', generating_audio: 'processing', assembling: 'processing', rendering: 'processing', completed: 'completed', failed: 'failed' }
  return NextResponse.json({
    videos: (data ?? []).map((v) => ({
      id: v.id,
      title: v.title ?? null,
      status: statusMap[v.status] || v.status,
      video_url: v.video_url ?? null,
      thumbnail_url: v.thumbnail_url ?? null,
      created_at: v.created_at,
    })),
  })
}

/**
 * POST /api/v1/videos
 * Public, async video/deck/pdf generation from text, URL, file, or an AI idea.
 * Auth: Authorization: Bearer <api_key>. Charges the metered API credit pool.
 * Returns { job_id, status: 'queued' }; poll GET /api/v1/videos/{job_id}.
 */
export async function POST(request: Request) {
  if (!INTERNAL_SECRET) {
    return NextResponse.json({ error: 'API not configured' }, { status: 503 })
  }

  const caller = await authenticateApiKey(request)
  if (!caller) {
    return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })
  }

  if (!(await checkApiRateLimit(caller.keyId))) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  let body: V1Body
  try {
    body = (await request.json()) as V1Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const input = body.input
  if (!input?.type) {
    return NextResponse.json({ error: 'input.type is required (text|url|file|idea)' }, { status: 400 })
  }
  if (!body.purpose?.trim()) {
    return NextResponse.json({ error: 'purpose is required' }, { status: 400 })
  }

  const outputType: OutputType = body.outputType || 'video'
  const detailLevel: DetailLevel = body.detailLevel || 'standard'
  // Pass userId so a grandfathered account is charged its real rate via the API too.
  const cost = calculateVideoCost({ outputType, detailLevel, narrationStyle: 'solo', userId: caller.userId })

  // --- Metered API credit check + charge (separate from UI credits) ---
  const balance = await getApiBalance(caller.userId)
  if (balance < cost) {
    return NextResponse.json(
      { error: `Insufficient API credits. Need ${cost}, have ${balance}.` },
      { status: 402 },
    )
  }
  const charged = await chargeApiCredits(caller.userId, cost)
  if (!charged) {
    return NextResponse.json({ error: 'Insufficient API credits.' }, { status: 402 })
  }

  const admin = createAdminClient()

  // Helper to refund + log + respond on any downstream failure.
  const fail = async (status: number, message: string, videoId?: string) => {
    await refundApiCredits(caller.userId, cost)
    await logApiUsage({
      apiKeyId: caller.keyId,
      userId: caller.userId,
      endpoint: 'POST /api/v1/videos',
      videoId: videoId ?? null,
      creditsCharged: 0,
      status: 'failed',
    })
    return NextResponse.json({ error: message }, { status })
  }

  // --- 1. Extraction (reuse internal routes via trusted header) ---
  let extracted: any
  try {
    // All extraction routes return the ExtractedData object directly (not wrapped).
    if (input.type === 'text') {
      if (!input.text?.trim()) return fail(400, 'input.text is required for type "text"')
      const r = await callInternal('/api/extract-text', caller.userId, { text: input.text })
      if (!r.ok) return fail(502, `Extraction failed (${r.status})`)
      extracted = await r.json()
    } else if (input.type === 'url') {
      if (!input.url?.trim()) return fail(400, 'input.url is required for type "url"')
      const r = await callInternal('/api/extract-url', caller.userId, { url: input.url })
      if (!r.ok) {
        const msg = await r.json().catch(() => ({}))
        return fail(r.status === 400 ? 400 : 502, msg.error || `URL extraction failed (${r.status})`)
      }
      extracted = await r.json()
    } else if (input.type === 'idea') {
      if (!input.topic?.trim()) return fail(400, 'input.topic is required for type "idea"')
      const r = await callInternal('/api/generate-from-idea', caller.userId, {
        topic: input.topic,
        audience: input.audience || 'general audience',
        tone: input.tone || 'professional',
      })
      if (!r.ok) return fail(502, `Idea generation failed (${r.status})`)
      extracted = await r.json()
    } else if (input.type === 'file') {
      if (!input.file_base64 || !input.filename) {
        return fail(400, 'input.file_base64 and input.filename are required for type "file"')
      }
      // The extract route reads multipart form data.
      const buf = Buffer.from(input.file_base64, 'base64')
      const form = new FormData()
      form.append('file', new Blob([buf]), input.filename)
      const r = await fetch(`${BASE_URL}/api/extract?mode=summarize`, {
        method: 'POST',
        headers: { 'x-internal-service': INTERNAL_SECRET, 'x-internal-user-id': caller.userId },
        body: form,
      })
      if (!r.ok) return fail(502, `File extraction failed (${r.status})`)
      extracted = await r.json()
    } else {
      return fail(400, `Unsupported input.type "${input.type}"`)
    }
  } catch (e) {
    console.error('[v1/videos] extraction error', e)
    return fail(502, 'Extraction failed')
  }

  if (!extracted || typeof extracted !== 'object') {
    return fail(422, 'Could not extract usable content from the input.')
  }

  // --- 2. Create the videos row (job) ---
  const { data: row, error: insertErr } = await admin
    .from('videos')
    .insert({
      user_id: caller.userId,
      status: 'draft',
      output_type: outputType,
      draft_data: {
        ...(body.recipientName ? { recipientName: body.recipientName } : {}),
        // An approved brief is read by generate-video from draft_data.brief — the
        // SAME field the wizard uses — so API/MCP videos honor it identically.
        ...(body.brief ? { brief: body.brief } : {}),
        apiWebhookUrl: body.webhook_url || null,
        apiKeyId: caller.keyId,
        apiCost: cost,
        source: 'api',
      },
      draft_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
    .select('id')
    .single()

  if (insertErr || !row) {
    console.error('[v1/videos] insert error', insertErr)
    return fail(500, 'Failed to create job')
  }
  const jobId = row.id as string

  // --- 3. Kick off generation (server-to-server, charges nothing further) ---
  try {
    const r = await callInternal('/api/generate-video', caller.userId, {
      videoId: jobId,
      policyData: extracted,
      brandId: body.brandId ?? null,
      voiceId: body.voiceId || undefined,
      styleId: body.styleId || undefined,
      videoStyle: body.videoStyle || undefined,   // slides|aurora|cinematic|editorial|explainer
      purpose: body.purpose,
      detailLevel,
      detailed: detailLevel === 'detailed',
      outputType,
      recipientName: body.recipientName,
    })
    if (!r.ok) {
      const msg = await r.json().catch(() => ({}))
      await admin.from('videos').update({ status: 'failed', error_message: msg.error || 'generation rejected' }).eq('id', jobId)
      return fail(502, msg.error || 'Failed to start generation', jobId)
    }
  } catch (e) {
    console.error('[v1/videos] generation kickoff error', e)
    await admin.from('videos').update({ status: 'failed', error_message: 'kickoff failed' }).eq('id', jobId)
    return fail(502, 'Failed to start generation', jobId)
  }

  await logApiUsage({
    apiKeyId: caller.keyId,
    userId: caller.userId,
    endpoint: 'POST /api/v1/videos',
    videoId: jobId,
    creditsCharged: cost,
    status: 'ok',
  })

  return NextResponse.json({ job_id: jobId, status: 'queued', credits_charged: cost }, { status: 202 })
}
