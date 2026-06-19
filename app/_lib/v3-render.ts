/**
 * V3 render payload builder. Maps the app's generated scenes + brand + extracted
 * data into the contract the VPS /render-v3 endpoint (Remotion) expects.
 *
 * Theme is auto-selected by CONTENT (the chosen direction): data-heavy content
 * → 'infographic' (animated counters/KPIs); narrative/qualitative → 'cinematic'
 * (Gemini backgrounds + text). Brand colors + logo variants are always applied.
 *
 * This keeps generate-video thin: it calls buildV3Payload(...) and POSTs the
 * result. No fabrication — scene text/metrics come straight from the generated
 * scenes, which were themselves grounded in the extracted document.
 */
import type { Brand } from './types'

export type V3Theme = 'cinematic' | 'infographic'

type Scene = {
  title?: string
  narration?: string
  beat?: string
  slideData?: { headline?: string; bullets?: string[]; stats?: { label: string; value: string }[] }
}

/** A metric value carries a real number → it animates well as a counter/KPI. */
function hasNumber(value: string): boolean {
  return /-?\d/.test(value || '')
}

/**
 * Count how much of the content is numeric/metric-shaped. Data-heavy decks
 * (insurance illustrations, financial reports) lean infographic; story/marketing
 * leans cinematic.
 */
export function pickTheme(scenes: Scene[], classification: { category?: string } | null): V3Theme {
  // 2026-06-18: infographic theme disabled — cinematic only until we improve it.
  // (Keep the heuristic below intact so we can re-enable by removing this line.)
  return 'cinematic'

  // eslint-disable-next-line no-unreachable
  const cat = (classification?.category || '').toLowerCase()
  // Categories that are almost always number-driven.
  if (cat === 'insurance' || cat === 'finance' || cat === 'business') return 'infographic'

  // Count scenes that carry real numeric data.
  let metricScenes = 0
  for (const s of scenes) {
    const stats = s.slideData?.stats ?? []
    if (stats.filter((st) => hasNumber(st.value)).length >= 1) metricScenes++
  }
  // Infographic is the SAFER default: it needs no per-scene Gemini images (so it
  // can't fail on image-gen / rate limits) and is faster. We only choose
  // cinematic when the content is clearly narrative — i.e. almost no metrics.
  // Threshold lowered to 1/4 so data-ish docs with no classification still get
  // the robust infographic engine rather than the image-dependent cinematic one.
  if (scenes.length === 0) return 'infographic'
  return metricScenes / scenes.length >= 0.25 ? 'infographic' : 'cinematic'
}

/** Brand → theme accents (the renderer applies these over the base theme). */
function brandAccents(brand: Brand | null): string[] | undefined {
  if (!brand) return undefined
  const a = [brand.primary_color, brand.accent_color, brand.secondary_color].filter(Boolean) as string[]
  return a.length ? a : undefined
}

/** Brand → logo for the render layer (real uploads only).
 *  Prefers processed light/dark variants; falls back to the raw uploaded logo
 *  (logo_url / logo_file_url) so a logo STILL shows for brands created before the
 *  variant pipeline, or when knockout produced no variants (item 7: logo missing).
 *  The raw fallback is used on a frosted chip so it reads on the dark ground. */
function brandLogo(brand: Brand | null): { light?: string; dark?: string; chip?: boolean } | undefined {
  if (!brand) return undefined
  const light = brand.logo_light_url || undefined
  const dark = brand.logo_dark_url || undefined
  if (light || dark) return { light, dark, chip: !!brand.logo_chip }
  // Fallback: raw uploaded logo, shown on a chip (we don't know its colors).
  const raw = brand.logo_url || (brand as any).logo_file_url || undefined
  if (raw) return { light: raw, dark: raw, chip: true }
  return undefined
}

export type V3Payload = {
  videoId: string
  userId: string
  voiceId: string
  theme: V3Theme
  brandName?: string
  brandAccents?: string[]
  logo?: { light?: string; dark?: string; chip?: boolean }
  industry?: string
  /** Background music: a ready URL, or a prompt to generate (Lyria), or aiMusic flag. */
  musicUrl?: string
  musicPrompt?: string
  aiMusic?: boolean
  /** Contact line for the closing CTA scene (phone | email | website). */
  contactLine?: string
  /** Per-scene content; the VPS generates images (cinematic) + narration + render. */
  scenes: {
    title: string
    narration: string
    beat?: string
    metrics?: { label: string; value: string; highlight?: boolean }[]
    bullets?: string[]
  }[]
}

export function buildV3Payload(opts: {
  videoId: string
  userId: string
  voiceId: string
  scenes: Scene[]
  brand: Brand | null
  brandName?: string | null
  classification: { category?: string } | null
  industry?: string
  /** The document's real extracted metrics — used to BACKFILL scenes that the
   *  script left without stats, so they render as data viz instead of bare text. */
  keyMetrics?: { label: string; value: string; highlight?: boolean }[]
  musicUrl?: string
  musicPrompt?: string
  aiMusic?: boolean
  contactLine?: string
}): V3Payload {
  // Cap cinematic scenes: each is a Gemini image + TTS + render. 17 scenes =
  // a 4-min video + 17 image calls (slow, rate-limit-prone). Keep the cover,
  // a focused middle, and the closing. ~9 reads tight and films well.
  const MAX_V3_SCENES = 9
  if (opts.scenes.length > MAX_V3_SCENES) {
    const first = opts.scenes[0]
    const last = opts.scenes[opts.scenes.length - 1]
    const middle = opts.scenes.slice(1, -1)
    const keep = MAX_V3_SCENES - 2
    // Evenly sample the middle so we keep a representative spread, not just the front.
    const step = middle.length / keep
    const sampledMiddle = Array.from({ length: keep }, (_, i) => middle[Math.floor(i * step)])
    opts = { ...opts, scenes: [first, ...sampledMiddle, last] }
  }

  const theme = pickTheme(opts.scenes, opts.classification)

  // Pool of real document metrics we can distribute to metric-less scenes.
  const pool = (opts.keyMetrics ?? []).filter((m) => m.label && m.value && hasNumber(m.value))
  let poolIdx = 0
  // How many middle (non-cover/closing) scenes have no stats — spread the pool
  // across them so several scenes become KPI/hero, not just the first.
  const middle = opts.scenes.slice(1, Math.max(1, opts.scenes.length - 1))
  const metricless = middle.filter((s) => !(s.slideData?.stats?.length)).length
  const perScene = metricless > 0 ? Math.max(2, Math.ceil(pool.length / metricless)) : 0

  return {
    videoId: opts.videoId,
    userId: opts.userId,
    voiceId: opts.voiceId,
    theme,
    brandName: opts.brandName || opts.brand?.name || undefined,
    brandAccents: brandAccents(opts.brand),
    logo: brandLogo(opts.brand),
    industry: opts.industry || undefined,
    musicUrl: opts.musicUrl || undefined,
    musicPrompt: opts.musicPrompt || undefined,
    aiMusic: opts.aiMusic || undefined,
    contactLine: opts.contactLine || undefined,
    scenes: opts.scenes.map((s, idx) => {
      const stats = s.slideData?.stats ?? []
      let metrics = stats
        .filter((st) => st.label && st.value)
        .map((st, i) => ({ label: st.label, value: st.value, highlight: i < 2 && hasNumber(st.value) }))

      // Backfill: a middle scene with NO stats borrows real metrics from the
      // document pool so it renders as a KPI grid / hero instead of plain text.
      const isMiddle = idx > 0 && idx < opts.scenes.length - 1
      if (metrics.length === 0 && isMiddle && poolIdx < pool.length) {
        const take = pool.slice(poolIdx, poolIdx + perScene)
        poolIdx += take.length
        metrics = take.map((m, i) => ({ label: m.label, value: m.value, highlight: i < 2 }))
      }

      return {
        title: s.slideData?.headline || s.title || '',
        narration: s.narration || '',
        beat: s.beat,
        ...(metrics.length ? { metrics } : {}),
        ...(s.slideData?.bullets?.length ? { bullets: s.slideData.bullets } : {}),
      }
    }),
  }
}
