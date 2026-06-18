import { parseMetric } from './format'
import type { GlyphName } from './Glyph'

/**
 * The layout-picker — the pure-code brain of the auto infographic theme. Given a
 * scene's structured content (what the generator emits per scene), it decides
 * which infographic component renders it. No AI guessing at render time: the
 * decision is a deterministic function of the data SHAPE.
 *
 *   1 dominant metric        -> 'hero'      (HeroMetric)
 *   2-4 metrics              -> 'kpis'      (KPIGrid)
 *   ordered steps/process    -> 'timeline'  (ProgressTimeline)
 *   3 metrics, no clear hero -> 'iconrow'   (IconMetric row)
 *   descriptive sections     -> 'cards'     (InfoCard)
 *   plain headline           -> 'statement' (title card)
 */
export type SceneKind = 'hero' | 'kpis' | 'barchart' | 'iconrow' | 'timeline' | 'cards' | 'statement'

export type Metric = { label: string; value: string; highlight?: boolean; icon?: GlyphName }
export type StepItem = { label: string; sub?: string; icon?: GlyphName }
export type CardItem = { title: string; body?: string; icon?: GlyphName }

/** What the generator produces per scene (a superset; fields used per kind). */
export type SceneContent = {
  eyebrow?: string
  title: string
  body?: string
  /** explicit kind from the generator; if absent we infer from the data. */
  kind?: SceneKind
  metrics?: Metric[]
  steps?: StepItem[]
  cards?: CardItem[]
}

/** Does a metric value carry a real number (so a counter makes sense)? */
function isNumeric(value: string): boolean {
  return parseMetric(value).number != null
}

/** The unit signature of a value ("$"+"" , ""+"%", ""+" years") for grouping. */
function unitOf(value: string): string {
  const p = parseMetric(value)
  return `${p.prefix.trim()}|${p.suffix.trim().toLowerCase()}`
}

/** Do these metrics share ONE comparable unit, so a bar chart is meaningful?
 *  (Comparing $176,204 vs $10,000 = yes; comparing $176k vs "20 years" = no.) */
function sameComparableUnit(metrics: Metric[]): boolean {
  const numeric = metrics.filter((m) => isNumeric(m.value))
  if (numeric.length < 3) return false
  const units = new Set(numeric.map((m) => unitOf(m.value)))
  return units.size === 1
}

/**
 * Decide the kind for a scene. Honors an explicit `kind` when the generator set
 * one; otherwise infers from the data present. Always returns something
 * renderable (falls back to 'statement').
 */
export function pickKind(s: SceneContent): SceneKind {
  if (s.kind) return s.kind

  const metrics = s.metrics ?? []
  const steps = s.steps ?? []
  const cards = s.cards ?? []

  if (steps.length >= 2) return 'timeline'

  if (metrics.length >= 2) {
    // 3-5 metrics in ONE comparable unit -> an actual BAR CHART (the most
    // "infographic" layout). Comparing like-with-like is what makes bars read.
    if (metrics.length >= 3 && metrics.length <= 5 && sameComparableUnit(metrics)) return 'barchart'

    // A single highlighted metric among others reads as a hero; else a grid.
    const highlights = metrics.filter((m) => m.highlight)
    if (metrics.length >= 2 && metrics.length <= 4) {
      // 3 numeric metrics (mixed units) with no dominant highlight -> icon row.
      if (metrics.length === 3 && highlights.length !== 1 && metrics.every((m) => isNumeric(m.value))) return 'iconrow'
      return 'kpis'
    }
    return 'kpis'
  }

  if (metrics.length === 1) return 'hero'

  if (cards.length >= 1) return 'cards'

  return 'statement'
}

/**
 * Heuristic glyph assignment from a label's words — gives icon rows/cards a
 * sensible default icon when the generator didn't specify one. Pure + cheap.
 */
const KEYWORD_GLYPH: Array<[RegExp, GlyphName]> = [
  [/death|benefit|protect|cover|shield|guarant/i, 'shield'],
  [/premium|pay|cost|price|fee|annual/i, 'coin'],
  [/cash|value|growth|return|gain|index|account|interest/i, 'growth'],
  [/year|age|duration|term|time|month/i, 'clock'],
  [/rider|feature|include|option|add/i, 'star'],
  [/policy|document|illustration|report|page/i, 'doc'],
  [/health|life|care|family/i, 'heart'],
  [/lock|secure|guarantee|protection/i, 'lock'],
  [/review|check|annual review|ensure/i, 'check'],
  [/rate|chart|performance|market|stat/i, 'chart'],
  [/people|client|owner|insured|advisor/i, 'people'],
]

export function glyphFor(label: string): GlyphName {
  for (const [re, g] of KEYWORD_GLYPH) if (re.test(label)) return g
  return 'spark'
}
