import { NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { createAdminClient } from '../../../_lib/supabase/admin'
import {
  authenticateApiKey,
  getApiBalance,
  chargeApiCredits,
  refundApiCredits,
  checkApiRateLimit,
  logApiUsage,
} from '../../../_lib/api-auth'
import { CREDIT_COSTS } from '../../../_lib/credits'
import { generateScript } from '../../../_lib/script-generator'
import { PRESENTATION_TEMPLATES } from '../../../_lib/presentation'

export const runtime = 'nodejs'
// Script generation is chained Claude calls (minutes). We return the job id
// immediately and run script→build in the BACKGROUND via waitUntil; the
// caller polls GET /api/v1/videos/{job_id} (share_url appears when done).
export const maxDuration = 800

const BASE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://docs2video.com').replace(/\/$/, '')
const INTERNAL_SECRET = (process.env.INTERNAL_API_SECRET || '').trim()

interface V1PresentationBody {
  input?: {
    type: 'text' | 'url' | 'idea'
    text?: string
    url?: string
    topic?: string
    audience?: string
    tone?: string
  }
  /** What the presentation should accomplish — drives the script. */
  purpose?: string
  /** Personalize for this person — cover + greeting. */
  recipient_name?: string
  /** Template id (heritage|warm|bold|midnight|mint|certificate). Default heritage. */
  template?: string
  /** 'interactive' (narrated share page, default) or 'deck' (silent, PDF/PPTX). */
  output_type?: 'interactive' | 'deck'
  /** Presenter contact shown on the closing card + spoken in the outro. */
  contact?: { name?: string; phone?: string; email?: string; website?: string }
  /** Partner attribution (e.g. the Jordyn user id) — stored for reporting. */
  partner_user_id?: string
}

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
 * POST /api/v1/presentations
 * Public, async Interactive Presentation / Slide Deck generation from a URL,
 * text, or an idea. Auth: Authorization: Bearer <api_key>. Charges the key
 * owner's credit pool. Returns { job_id, status: 'queued', share_url };
 * poll GET /api/v1/videos/{job_id} until status === 'completed'.
 */
export async function POST(request: Request) {
  if (!INTERNAL_SECRET) return NextResponse.json({ error: 'API not configured' }, { status: 503 })

  const caller = await authenticateApiKey(request)
  if (!caller) return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })
  if (!(await checkApiRateLimit(caller.keyId))) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  let body: V1PresentationBody
  try {
    body = (await request.json()) as V1PresentationBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const input = body.input
  if (!input?.type) return NextResponse.json({ error: 'input.type is required (text|url|idea)' }, { status: 400 })
  if (!body.purpose?.trim()) return NextResponse.json({ error: 'purpose is required' }, { status: 400 })

  const outputType = body.output_type === 'deck' ? 'deck' : 'interactive'
  const templateId = PRESENTATION_TEMPLATES.some((t) => t.id === body.template)
    ? (body.template as string)
    : 'heritage'
  const cost = (CREDIT_COSTS as Record<string, number>)[outputType === 'interactive' ? 'interactive' : 'deck'] ?? 700

  const balance = await getApiBalance(caller.userId)
  if (balance < cost) {
    return NextResponse.json({ error: `Insufficient credits. Need ${cost}, have ${balance}.` }, { status: 402 })
  }
  const charged = await chargeApiCredits(caller.userId, cost)
  if (!charged) return NextResponse.json({ error: 'Insufficient credits.' }, { status: 402 })

  const admin = createAdminClient()

  const fail = async (status: number, message: string, videoId?: string) => {
    await refundApiCredits(caller.userId, cost)
    await logApiUsage({
      apiKeyId: caller.keyId,
      userId: caller.userId,
      endpoint: 'POST /api/v1/presentations',
      videoId: videoId ?? null,
      creditsCharged: 0,
      status: 'failed',
    })
    return NextResponse.json({ error: message }, { status })
  }

  // --- 1. Extraction (reuse internal routes via the trusted header) ---
  let extracted: Record<string, unknown>
  try {
    if (input.type === 'text') {
      if (!input.text?.trim()) return fail(400, 'input.text is required for type "text"')
      const r = await callInternal('/api/extract-text', caller.userId, { text: input.text })
      if (!r.ok) return fail(502, `Extraction failed (${r.status})`)
      extracted = await r.json()
    } else if (input.type === 'url') {
      if (!input.url?.trim()) return fail(400, 'input.url is required for type "url"')
      const r = await callInternal('/api/extract-url', caller.userId, { url: input.url })
      if (!r.ok) {
        const msg = await r.json().catch(() => ({} as { error?: string }))
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
    } else {
      return fail(400, `Unsupported input.type "${input.type}"`)
    }
  } catch (e) {
    console.error('[v1/presentations] extraction error', e)
    return fail(502, 'Extraction failed')
  }
  if (!extracted || typeof extracted !== 'object') {
    return fail(422, 'Could not extract usable content from the input.')
  }

  // --- 2. Create the job row ---
  const { data: row, error: insertErr } = await admin
    .from('videos')
    .insert({
      user_id: caller.userId,
      status: 'processing',
      output_type: outputType,
      draft_data: {
        extractedData: extracted,
        purpose: body.purpose,
        presentationTemplate: templateId,
        ...(body.recipient_name ? { recipientName: body.recipient_name } : {}),
        ...(body.contact?.phone ? { contactPhone: body.contact.phone } : {}),
        ...(body.contact?.email ? { contactEmail: body.contact.email } : {}),
        ...(body.contact?.website ? { contactWebsite: body.contact.website } : {}),
        ...(body.partner_user_id ? { partnerUserId: body.partner_user_id } : {}),
        apiKeyId: caller.keyId,
        apiCost: cost,
        source: 'api',
      },
      draft_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
    .select('id')
    .single()
  if (insertErr || !row) {
    console.error('[v1/presentations] insert error', insertErr)
    return fail(500, 'Failed to create job')
  }
  const jobId = row.id as string

  // --- 3. Background: script → presentation build ---
  waitUntil((async () => {
    try {
      await admin.from('videos').update({
        status: 'scripting', progress_pct: 8, progress_detail: 'Writing the script',
        progress_updated_at: new Date().toISOString(),
      }).eq('id', jobId)

      const colors = { primary: '#1B365D', secondary: '#4A90D9', accent: '#FFB347', background: '#0a1628', text: '#FFFFFF' }
      const scenes = await Promise.race([
        generateScript(
          extracted as never, null, colors, false, 0, undefined, undefined,
          { phone: body.contact?.phone, email: body.contact?.email },
          body.purpose, undefined, undefined, 'standard', 'solo', null,
        ),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Script generation timed out')), 300000)),
      ])
      if (!Array.isArray(scenes) || scenes.length === 0) throw new Error('Script generation returned no scenes')

      const { data: cur } = await admin.from('videos').select('draft_data').eq('id', jobId).single()
      await admin.from('videos').update({
        draft_data: { ...((cur?.draft_data as Record<string, unknown>) || {}), scenes },
      }).eq('id', jobId)

      const r = await callInternal('/api/generate-presentation', caller.userId, {
        videoId: jobId, templateId, outputType,
      })
      if (!r.ok) {
        const msg = await r.json().catch(() => ({} as { error?: string }))
        throw new Error(msg.error || `Presentation build failed (${r.status})`)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Generation failed'
      console.error(`[v1/presentations:bg ${jobId}] FAILED:`, message)
      await refundApiCredits(caller.userId, cost).catch(() => {})
      await admin.from('videos').update({ status: 'failed', error_message: message }).eq('id', jobId)
    }
  })())

  await logApiUsage({
    apiKeyId: caller.keyId,
    userId: caller.userId,
    endpoint: 'POST /api/v1/presentations',
    videoId: jobId,
    creditsCharged: cost,
    status: 'ok',
  })

  return NextResponse.json(
    {
      job_id: jobId,
      status: 'queued',
      credits_charged: cost,
      // The client-facing deliverable once status === 'completed':
      share_url: `${BASE_URL}/watch/${jobId}`,
    },
    { status: 202 },
  )
}
