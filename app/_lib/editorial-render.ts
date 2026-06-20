/**
 * Editorial (EPOCH magazine) payload builder. Turns the already-generated,
 * GROUNDED scenes + the document's extracted data into editorial ARCHETYPE
 * scenes (cover / lede / grid / pullquote / stat / list / decision) via one
 * Claude call. The renderer (VPS or Lambda) then adds TTS narration + optional
 * framed images and renders the EditorialVideo composition.
 *
 * No fabrication: Claude restructures EXISTING grounded content into archetypes;
 * it does not invent facts/numbers.
 */
import Anthropic from '@anthropic-ai/sdk'
import { withRetry } from './with-retry'
import type { Brand } from './types'
import { type Presenter, resolveDisplayName } from './presenter'

let _claude: Anthropic | null = null
function claude() {
  if (!_claude) _claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })
  return _claude
}

type Scene = {
  title?: string
  narration?: string
  beat?: string
  slideData?: { headline?: string; bullets?: string[]; stats?: { label: string; value: string }[] }
}

export type EditorialPayload = {
  videoId: string
  userId: string
  voiceId: string
  masthead: string
  runningTitle?: string
  brandColor?: string
  musicUrl?: string
  musicPrompt?: string
  aiMusic?: boolean
  /** Contact line for the closing decision page. */
  contactLine?: string
  /** Presenter identity (Person profile): photo + name/role rendered per style. */
  presenter?: Presenter
  photoPlacement?: 'auto' | 'cover' | 'closing' | 'both' | 'none'
  /** Editorial scenes (no audio/image yet — renderer fills those in). */
  scenes: {
    archetype?: string
    kicker?: string
    title: string
    dek?: string
    body?: string
    quote?: string
    attribution?: string
    items?: { title: string; detail?: string }[]
    metrics?: { label: string; value: string }[]
    /** the spoken narration for this scene (renderer turns it into TTS) */
    narration: string
    /** true if this archetype benefits from a framed image (cover/lede) */
    wantsImage?: boolean
  }[]
}

const SYS = `You are an editor laying out a PREMIUM magazine-style explainer video (think a private-bank report or The Economist). You are given GROUNDED scenes already written from a real document. Restructure them into editorial ARCHETYPE slides. Use ONLY facts present in the input — do NOT invent numbers, names, or claims.

Return ONLY JSON: an array of scene objects. Each scene has an "archetype" (one of: cover, lede, grid, pullquote, stat, list, decision) and the fields that archetype needs:
- cover (FIRST scene only): { archetype, kicker, title (the subject, short & punchy), dek (one-line subtitle), narration }
- lede (narrative intro): { archetype, kicker, title, body (a 2-3 sentence paragraph of real prose), narration, wantsImage:true }
- stat (the numbers): { archetype, kicker, title, metrics:[{label,value}] (1-3 REAL figures), narration }
- list (ordered points/steps/principles): { archetype, kicker, title, items:[{title, detail}] (2-5), narration }
- grid (4-6 parallel items): { archetype, kicker, title, items:[{title, detail}], narration }
- pullquote (one powerful takeaway): { archetype, title (the quote itself, <=18 words), attribution (optional), narration }
- decision (LAST scene): { archetype, kicker, title (call to action), dek (contact line if provided), narration }

Rules:
- Scene 1 = cover. Last scene = decision.
- Choose the archetype that best fits each scene's content (numbers -> stat, several parallel features -> grid/list, a strong statement -> pullquote, narrative -> lede).
- "narration" = the warm spoken sentence(s) for that scene, drawn from the input. No greetings, no "next slide".
- "value" strings keep their exact units (e.g. "$176,204", "20 years").
Return ONLY the JSON array.`

export async function buildEditorialPayload(opts: {
  videoId: string
  userId: string
  voiceId: string
  scenes: Scene[]
  brand: Brand | null
  brandName?: string | null
  extracted: any
  contactLine?: string
  musicUrl?: string
  musicPrompt?: string
  aiMusic?: boolean
  presenter?: Presenter | null
  photoPlacement?: 'auto' | 'cover' | 'closing' | 'both' | 'none'
}): Promise<EditorialPayload> {
  // Compact brief of the grounded scenes + the doc's real metrics.
  const brief = opts.scenes.map((s, i) => {
    const stats = (s.slideData?.stats ?? []).map((x) => `${x.label}: ${x.value}`).join('; ')
    const bullets = (s.slideData?.bullets ?? []).join(' | ')
    return `SCENE ${i + 1} [${s.beat || ''}]\nheadline: ${s.slideData?.headline || s.title || ''}\nnarration: ${s.narration || ''}${stats ? `\nstats: ${stats}` : ''}${bullets ? `\npoints: ${bullets}` : ''}`
  }).join('\n\n')
  const keyMetrics = (opts.extracted?.keyMetrics ?? []).map((m: any) => `${m.label}: ${m.value}`).join('; ')

  let scenes: EditorialPayload['scenes'] = []
  try {
    const resp = await withRetry(() => claude().messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 8000,
      system: SYS,
      messages: [{ role: 'user', content: `DOCUMENT METRICS: ${keyMetrics || '(none)'}\n${opts.contactLine ? `CONTACT: ${opts.contactLine}\n` : ''}\nGROUNDED SCENES:\n\n${brief}` }],
    }) as Promise<Anthropic.Message>, { label: 'editorial-structure' })
    const text = resp.content.filter((b) => b.type === 'text').map((b: any) => b.text).join('')
    const arr = JSON.parse(text.slice(text.indexOf('['), text.lastIndexOf(']') + 1))
    if (Array.isArray(arr) && arr.length) {
      scenes = arr.map((s: any) => ({
        archetype: s.archetype,
        kicker: s.kicker, title: s.title || '', dek: s.dek, body: s.body,
        quote: s.quote, attribution: s.attribution,
        items: Array.isArray(s.items) ? s.items.slice(0, 6) : undefined,
        metrics: Array.isArray(s.metrics) ? s.metrics.slice(0, 3) : undefined,
        narration: s.narration || s.title || ' ',
        wantsImage: !!s.wantsImage || s.archetype === 'cover' || s.archetype === 'lede',
      }))
    }
  } catch { /* fall through to a minimal mapping */ }

  // Safety fallback: if Claude failed, map the raw scenes straight across so a
  // video still renders (cover first, decision last, lede in between).
  if (!scenes.length) {
    scenes = opts.scenes.map((s, i) => ({
      archetype: i === 0 ? 'cover' : i === opts.scenes.length - 1 ? 'decision' : 'lede',
      kicker: s.beat ? s.beat.toUpperCase() : undefined,
      title: s.slideData?.headline || s.title || '',
      body: i !== 0 ? (s.narration || '') : undefined,
      dek: i === 0 ? (s.narration || '').slice(0, 120) : (i === opts.scenes.length - 1 ? opts.contactLine : undefined),
      metrics: (s.slideData?.stats ?? []).slice(0, 3),
      narration: s.narration || s.title || ' ',
      wantsImage: i === 0,
    }))
  }

  // Masthead respects a Person's show_name_on_slides toggle; falls back to the
  // doc title or REPORT so the magazine header is never empty.
  const displayName = opts.brandName || resolveDisplayName(opts.brand)
  return {
    videoId: opts.videoId, userId: opts.userId, voiceId: opts.voiceId,
    masthead: (displayName || opts.extracted?.title || 'REPORT').toUpperCase().slice(0, 18),
    runningTitle: (opts.extracted?.title || displayName || '').slice(0, 40),
    brandColor: opts.brand?.primary_color || undefined,
    musicUrl: opts.musicUrl, musicPrompt: opts.musicPrompt, aiMusic: opts.aiMusic,
    contactLine: opts.contactLine || undefined,
    presenter: opts.presenter || undefined,
    photoPlacement: opts.photoPlacement || undefined,
    scenes,
  }
}
