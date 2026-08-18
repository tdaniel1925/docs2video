import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { authenticateApiKey, checkApiRateLimit, getApiBalance, chargeApiCredits, refundApiCredits, logApiUsage } from '../../../_lib/api-auth'
import { costForUser } from '../../../_lib/credits'
import { planDeck, MIN_SLIDES, MAX_SLIDES, type PlannedSlide } from '../../../_lib/deck-plan'
import { extractPptxSlides, buildDeckSplit } from '../../../_lib/deck-split'
import { generatePptx, type DeckSlide } from '../../../_lib/pptx-generator'
import { buildSimpleSlidePrompt, getStylePrompt } from '../../../_lib/slide-engine/simple-prompt'
import type { SimpleSlideInput } from '../../../_lib/slide-engine/simple-prompt'
import { generateSlideFromPrompt } from '../../../_lib/gemini'

// =============================================================================
// PUBLIC API v1 — DOCUMENT → STYLED DECK.  Key-authed (Authorization: Bearer),
// so it bills the caller's shared credit pool and a revoked key (is_active=false)
// is rejected by authenticateApiKey. Powers the MCP create_deck tool.
//
// Source (one of):
//   { document_url }  a link to a .pptx / .pdf — FETCHED + parsed server-side, so
//                     no base64/size bottleneck over the MCP transport.
//   { text }          raw source text (notes / an outline).
//   { topic }         a plain brief ("a 10-slide pitch for my roofing company").
//
// Then: plan the running order (planDeck) → draw every slide (Gemini) → PPTX →
// upload → return the download URL. Synchronous (fits the 600s function like the
// UI deck route). Charges once up front; refunds on any failure.
// =============================================================================

export const runtime = 'nodejs'
export const maxDuration = 600

const STYLES = ['executive', 'warm-story', 'dark-cinematic', 'bold-infographic', 'isometric', 'editorial'] as const

type Body = { document_url?: string; text?: string; topic?: string; style?: string; slides?: number; title?: string }

// planDeck's PlannedSlide → the generate-deck slide shape the Gemini prompt builder wants.
function toGenSlide(s: PlannedSlide, i: number, total: number): {
  headline: string; subheadline?: string; bodyPoints: string[]
  slideType: 'cover' | 'content' | 'data' | 'quote' | 'closing'
} {
  const f = s.fields || {}
  const roleToType: Record<string, 'cover' | 'content' | 'data' | 'quote' | 'closing'> = {
    cover: 'cover', point: 'content', numbers: 'data', quote: 'quote', closing: 'closing',
  }
  const type = i === 0 ? 'cover' : i === total - 1 ? 'closing' : (roleToType[s.role] || 'content')
  const bodyPoints = [
    ...(Array.isArray(f.details) ? f.details : []),
    ...(f.cta ? [f.cta] : []),
    ...(f.contact ? [f.contact] : []),
  ].filter(Boolean)
  return { headline: f.headline || '', subheadline: f.subhead, bodyPoints, slideType: type }
}

export async function POST(request: Request) {
  const caller = await authenticateApiKey(request)
  if (!caller) return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })
  if (!(await checkApiRateLimit(caller.keyId))) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })

  let body: Body
  try { body = (await request.json()) as Body } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  const wantSlides = Number(body.slides)
  const slideCount = Number.isFinite(wantSlides) ? Math.max(MIN_SLIDES, Math.min(MAX_SLIDES, Math.round(wantSlides))) : 8
  const styleId = STYLES.includes(body.style as any) ? (body.style as string) : 'executive'

  // 1) resolve the source text: document_url (fetch+parse) | text | topic
  let brief = ''
  try {
    if (body.document_url?.trim()) {
      const u = body.document_url.trim()
      const res = await fetch(u, { signal: AbortSignal.timeout(20000) })
      if (!res.ok) return NextResponse.json({ error: `Could not fetch document_url (HTTP ${res.status}).` }, { status: 400 })
      const ct = (res.headers.get('content-type') || '').toLowerCase()
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.byteLength > 40 * 1024 * 1024) return NextResponse.json({ error: 'That document is over 40MB.' }, { status: 400 })
      const isPptx = /\.pptx?(\?|$)/i.test(u) || ct.includes('presentation')
      if (isPptx) {
        const raw = await extractPptxSlides(buf).catch(() => [])
        const split = buildDeckSplit(raw)
        brief = split.slides.map((s) => [s.heading, ...s.bullets].filter(Boolean).join('\n')).join('\n\n')
      } else {
        // treat as text (pdf text extraction over MCP is out of scope here — a
        // .pptx or a text/topic is the supported path; a raw-text PDF url still
        // yields its bytes as text which planDeck can partially use).
        brief = buf.toString('utf8').replace(/[^\x09\x0A\x0D\x20-\x7E]/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, 12000)
      }
      if (brief.trim().length < 20) return NextResponse.json({ error: 'We could not read readable text from that document. Try a .pptx or pass `text`/`topic` instead.' }, { status: 422 })
    } else if (body.text?.trim()) {
      brief = body.text.trim().slice(0, 12000)
    } else if (body.topic?.trim()) {
      brief = body.topic.trim()
    } else {
      return NextResponse.json({ error: 'Provide one of: document_url, text, or topic.' }, { status: 400 })
    }
  } catch (e: any) {
    return NextResponse.json({ error: `Could not read the source: ${e?.message || 'unknown'}` }, { status: 400 })
  }

  // 2) charge up front (idempotent refund on any failure below)
  const DECK_COST = costForUser('deck', caller.userId)
  const reqId = randomUUID()
  const balance = await getApiBalance(caller.userId)
  if (balance < DECK_COST) return NextResponse.json({ error: `Insufficient credits. A deck costs ${DECK_COST}, you have ${balance}.` }, { status: 402 })
  if (!(await chargeApiCredits(caller.userId, DECK_COST))) return NextResponse.json({ error: 'Insufficient credits.' }, { status: 402 })

  const admin = createAdminClient()

  // 3) create the JOB row (a videos row of output_type 'deck') so a big deck runs
  //    in the BACKGROUND and check_deck (GET /api/v1/videos/{id}) can poll it —
  //    the drawing never has to finish inside the request window.
  const { data: row, error: insErr } = await admin
    .from('videos')
    .insert({ user_id: caller.userId, status: 'pending', progress_pct: 3, progress_detail: 'Planning your deck…', title: (body.title || 'Deck').slice(0, 120), output_type: 'deck', draft_data: { apiKeyId: caller.keyId, apiCost: DECK_COST, source: 'api', kind: 'deck' } })
    .select('id')
    .single()
  if (insErr || !row) {
    await refundApiCredits(caller.userId, DECK_COST)
    return NextResponse.json({ error: 'Failed to create deck job.' }, { status: 500 })
  }
  const jobId = row.id as string

  // 4) do the heavy work in the background; the response returns immediately.
  waitUntil((async () => {
    const setFail = async (message: string) => {
      await admin.from('videos').update({ status: 'failed', error_message: message.slice(0, 500), progress_pct: 0 }).eq('id', jobId).then(() => {}, () => {})
      await refundApiCredits(caller.userId, DECK_COST)   // idempotent per-call key inside
      await logApiUsage({ apiKeyId: caller.keyId, userId: caller.userId, endpoint: 'POST /api/v1/decks', videoId: jobId, creditsCharged: 0, status: 'failed' }).catch(() => {})
      console.error(`[v1/decks ${reqId}] failed:`, message)
    }
    try {
      const plan = await planDeck(brief, slideCount)
      const specs = (plan.slides || []).map((s, i) => toGenSlide(s, i, plan.slides.length)).filter((s) => s.headline)
      if (!specs.length) return setFail('Could not plan a deck from that source.')
      await admin.from('videos').update({ progress_pct: 10, progress_detail: `Drawing ${specs.length} slides…` }).eq('id', jobId).then(() => {}, () => {})

      const stylePrompt = getStylePrompt(styleId)
      let done = 0
      const deckSlides: DeckSlide[] = await Promise.all(specs.map(async (spec, i) => {
        const input: SimpleSlideInput = {
          hasLogo: false,
          type: spec.slideType === 'cover' ? 'cover' : spec.slideType === 'closing' ? 'closing' : 'content',
          stylePrompt, headline: spec.headline, subtitle: spec.subheadline,
          brandColors: { primary: '#1B365D', secondary: '#4A90D9' },
          bullets: spec.bodyPoints.map((text) => ({ text })),
          pageNumber: i + 1, totalPages: specs.length,
        }
        let backgroundImage: Buffer
        try {
          const buf = await generateSlideFromPrompt(buildSimpleSlidePrompt(input))
          if (!buf) throw new Error('no image')
          backgroundImage = buf
        } catch {
          const sharpMod = await import('sharp'); const sharp = sharpMod.default ?? sharpMod
          backgroundImage = await sharp({ create: { width: 1920, height: 1080, channels: 4, background: { r: 240, g: 244, b: 248, alpha: 1 } } }).png().toBuffer()
        }
        done++
        await admin.from('videos').update({ progress_pct: 10 + Math.round((done / specs.length) * 75) }).eq('id', jobId).then(() => {}, () => {})
        return { ...spec, backgroundImage }
      }))

      const title = (body.title || plan.title || 'Deck').slice(0, 120)
      const pptxBuffer = await generatePptx(deckSlides, { brandName: title, primaryColor: '#1B365D', secondaryColor: '#4A90D9', accentColor: '#FFB347', textColor: '#FFFFFF', logoBuffer: null, contactInfo: { phone: '', website: '' } })
      const path = `${caller.userId}/decks/api-${jobId}.pptx`
      await admin.storage.from('videos').upload(path, pptxBuffer, { contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', upsert: true })
      const { data: urlData } = admin.storage.from('videos').getPublicUrl(path)

      await admin.from('videos').update({ status: 'completed', progress_pct: 100, progress_detail: null, video_url: urlData.publicUrl, title }).eq('id', jobId).then(() => {}, () => {})
      await admin.from('creations').insert({ user_id: caller.userId, type: 'deck', title: `Deck: ${title}`, file_url: urlData.publicUrl, credits_used: DECK_COST }).then(() => {}, () => {})
      await logApiUsage({ apiKeyId: caller.keyId, userId: caller.userId, endpoint: 'POST /api/v1/decks', videoId: jobId, creditsCharged: DECK_COST, status: 'ok' }).catch(() => {})
    } catch (e: any) {
      await setFail(e?.message || 'Deck generation failed.')
    }
  })())

  // 5) respond immediately with the job id. Poll GET /api/v1/videos/{job_id};
  //    when completed, video_url holds the .pptx download link.
  return NextResponse.json({ job_id: jobId, status: 'queued', credits_charged: DECK_COST }, { status: 202 })
}
