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

/** Brand → logo variants for the render layer (real uploads only). */
function brandLogo(brand: Brand | null): { light?: string; dark?: string; chip?: boolean } | undefined {
  if (!brand) return undefined
  const light = brand.logo_light_url || undefined
  const dark = brand.logo_dark_url || undefined
  if (!light && !dark) return undefined
  return { light, dark, chip: !!brand.logo_chip }
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
}): V3Payload {
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
