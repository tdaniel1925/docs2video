// =============================================================================
// THE KIT PLANNER — Claude picks ONE kit scene per narration beat and fills it.
//
// Input: the story the user APPROVED (their scenes: narration + on-screen
// headline/bullets/stats) and the numbers extracted from their document.
// Output: one KitScene per beat (remotion/src/kit/spec.ts), ready for the
// render service to voice and render.
//
// The steps, in order:
//   1. ONE Claude call (claude-sonnet-5). The long, never-changing system
//      prompt is cached, so repeat videos pay ~10% for it.
//   2. CODE CHECKS every scene (validateKitScenes): word limits, numbers only
//      from the source and written the house way, no two of the same scene in
//      a row, a comparison has two REAL sides, nothing on the compliance
//      blocklist, no sales-pressure wording ("act now"), never our own name.
//   3. If anything failed: ONE repair call with the exact problems listed.
//   4. Anything STILL wrong is replaced, scene by scene, by the deterministic
//      mapping (fallbackScene) — the same mapping that runs when there is no
//      API key, the call fails, or the money cap would be passed. The video
//      always gets made; the worst case is a plainer scene, never a wrong one.
//
// MONEY: hard cap $0.25 per video (KIT_PLAN_CAP_USD). Before every call the
// worst case is worked out (input tokens counted generously + the most output
// we allow); a call that could pass the cap is shrunk, or not made. The real
// spend is read back from the usage the API returns and logged per video.
//
// The CTA contact details are never Claude's: they always come from the
// agent's own profile (input.contact). Narration is never rewritten here —
// it is the story the user approved.
// =============================================================================

import Anthropic from '@anthropic-ai/sdk'
import {
  countWords, defaultMood, formatFigure, isPlatformName, LIMITS, numbersIn, parseFigure, SCENE_TYPES, spelledNumbersIn,
  type BigNumberScene, type ChartScene, type ChecklistScene, type ComparisonScene, type CtaScene, type Figure,
  type KitScene, type QuoteScene, type SceneType, type TimelineScene, type TitleScene,
} from '../../remotion/src/kit/spec'
import { normalizeForMatch, scrubComplianceText } from './compliance'

export const KIT_PLANNER_MODEL = 'claude-sonnet-5'
export const KIT_PLAN_CAP_USD = 0.25
/** claude-sonnet-5 list prices, $ per token. Cache writes 1.25x input, reads 0.1x. */
export const SONNET5_PRICE = { input: 2 / 1e6, output: 10 / 1e6, cacheWrite: 2.5 / 1e6, cacheRead: 0.2 / 1e6 }

export type PlannerBeat = {
  role: 'cover' | 'content' | 'closing'
  title?: string
  narration: string
  slideData?: { headline?: string; bullets?: (string | { text?: string })[]; stats?: { label?: string; value?: string }[]; cta?: string }
}
export type PlannerInput = {
  beats: PlannerBeat[]
  /** Numbers the extractor found in the document. */
  keyMetrics?: { label?: string; value?: string }[]
  regulated: boolean
  /** Carrier/product words found in THIS document (compliance.ts productTokens). */
  productTokens?: string[]
  recipient?: string
  brandName?: string
  hasPresenter?: boolean
  contact?: CtaScene['contact']
  /** For the log line. */
  videoId?: string
}

export type Usage = { input_tokens?: number | null; output_tokens?: number | null; cache_creation_input_tokens?: number | null; cache_read_input_tokens?: number | null }
export type CallResult = { text: string; usage: Usage; stopReason?: string | null }
/** The one place the API is called; tests pass their own. */
export type PlannerCall = (req: { system: string; user: string; maxTokens: number }) => Promise<CallResult>

export type PlanResult = {
  scenes: KitScene[]
  /** claude = first answer passed; repaired = passed after the repair call; mixed = some scenes replaced by the fallback; fallback = no usable answer. */
  source: 'claude' | 'repaired' | 'mixed' | 'fallback'
  costUsd: number
  calls: number
  /** What the checks found on the final answer before any fallback swap (for the log). */
  issues: string[]
  /** Why the planner fell back, when it did. */
  note?: string
  /** Token totals across calls (cache hits show in cacheRead). */
  tokens?: { input: number; output: number; cacheWrite: number; cacheRead: number }
}

export function costOf(u: Usage): number {
  return (u.input_tokens || 0) * SONNET5_PRICE.input + (u.output_tokens || 0) * SONNET5_PRICE.output
    + (u.cache_creation_input_tokens || 0) * SONNET5_PRICE.cacheWrite + (u.cache_read_input_tokens || 0) * SONNET5_PRICE.cacheRead
}
/**
 * Token count, rounded UP on purpose. Measured on this prompt (JSON-heavy):
 * ~2.85 characters a token (5,300 characters = 1,859 tokens), so 2.5 always
 * over-counts.
 */
export const estimateTokens = (s: string) => Math.ceil(s.length / 2.5)

// ── the prompt ───────────────────────────────────────────────────────────────

export const KIT_SYSTEM_PROMPT = `You are the art director for a narrated explainer video. The script is FINISHED and approved by the customer; your job is to choose how each narration beat is SHOWN, using a fixed kit of eight scene designs, and to fill each scene with short on-screen words.

THE KIT (one scene per beat, same order as the beats):
1. "title" — the cover. {"type":"title","headline":string (≤${LIMITS.headline} words),"sub"?:string (≤${LIMITS.sub} words)}
2. "bignumber" — ONE number fills the screen and counts up as it is spoken. {"type":"bignumber","label":string (≤${LIMITS.label} words, what the number is),"figure":{"value":number,"prefix"?:"$","suffix"?:string,"decimals"?:number},"context"?:string (≤${LIMITS.context} words),"landOn":string (the exact words in the narration where the number is spoken, e.g. "five hundred thousand")}
3. "comparison" — two REAL sides side by side. {"type":"comparison","heading":string (≤${LIMITS.heading} words),"left":{"label":string (≤${LIMITS.sideLabel} words),"figure"?:Figure,"points"?:string[] (≤${LIMITS.points} items, ≤${LIMITS.point} words each)},"right":{same},"verdict"?:string (≤${LIMITS.verdict} words)}
4. "timeline" — steps in time order. {"type":"timeline","heading":string,"steps":[{"when":string (≤${LIMITS.when} words),"label":string (≤${LIMITS.stepLabel} words)}] (${LIMITS.steps[0]}-${LIMITS.steps[1]} steps)}
5. "chart" — several numbers of the SAME kind. {"type":"chart","heading":string,"kind":"bar"|"donut"|"line","points":[{"label":string (≤${LIMITS.chartLabel} words),"value":number}] (${LIMITS.chartPoints[0]}-${LIMITS.chartPoints[1]} points),"prefix"?:"$","suffix"?:string,"highlight"?:index,"takeaway"?:string (≤${LIMITS.takeaway} words)}. bar = compare amounts; donut = parts of one whole (percentages that add up); line = change over time (labels are times, in order).
6. "checklist" — up to ${LIMITS.items[1]} short points. {"type":"checklist","heading":string,"items":string[] (${LIMITS.items[0]}-${LIMITS.items[1]} items, ≤${LIMITS.item} words each)}
7. "quote" — one memorable sentence, big. {"type":"quote","quote":string (≤${LIMITS.quote} words),"attribution"?:string (≤${LIMITS.attribution} words)}
8. "cta" — the closing ask. {"type":"cta","headline":string,"action":string (button words, ≤${LIMITS.action} words)}

Every scene may also carry "mood": "calm" (dissolve in — covers, quotes, sign-offs), "build" (push in — lists, steps, charts) or "reveal" (zoom in — a big number or a before/after). Omit it to use the default for the scene type.

HOW TO CHOOSE
- The FIRST beat (role "cover") is always "title"; the LAST beat (role "closing") is always "cta". Never use "title" or "cta" anywhere else.
- For each content beat, pick the scene that shows the beat's ONE most important idea:
  · a single key amount or rate that the narration says out loud → "bignumber";
  · two real options/situations being contrasted (before/after, without/with, option A/option B) → "comparison";
  · a sequence of dates, ages, years or steps → "timeline";
  · three or more numbers of the same unit → "chart";
  · reasons, features, steps without dates → "checklist";
  · a single strong statement with no numbers → "quote".
- NEVER put the same scene type on two beats in a row. Vary the video: if two neighbouring beats both suit a checklist, show one of them another way.
- Prefer showing a number when the beat has one — numbers make the video feel specific.

HARD RULES (code checks every one; breaking one wastes the scene)
- NUMBERS: use ONLY numbers that appear in that beat's narration, its on-screen stats, or the document's key numbers. Never invent, round differently, estimate, total up, or convert a number. "value" is a plain JSON number (500000, not "$500,000"). Money gets "prefix":"$". Percent gets "suffix":"%". Monthly money gets "suffix":"/mo", yearly "/yr". Ages and years: put the word in "prefix" ("Age ") or keep them as plain words in timeline "when".
- Never write a number with 4+ digits inside on-screen WORDS (labels, headings, points); put numbers in figure/value fields so the video formats them ("$1,234").
- "comparison" needs two REAL sides of ONE question that the narration actually contrasts (without/with, before/after, option A/option B), measured the same way (dollars vs dollars). Two different facts (a price and a length of time) are NOT a comparison. Never make up the second side, never use "N/A", "Other", "None" or a blank side. If there is no real second side, use another scene.
- When two neighbouring beats each have one key number, give "bignumber" to the more important one and show the other beat another way (a checklist of its points, or a chart if it has several numbers of one kind).
- Keep every word limit. Short, concrete, plain words — the voice already explains; the screen shows the key idea.
- Never use pressure wording: no "act now", "limited time", "don't wait", "hurry", "last chance", "today only", "risk-free", "guaranteed returns". The closing action is a calm invitation (e.g. "Book a 15-minute call", "Ask me anything").
- Never name an insurance company, carrier, or branded product, and never write "Docs2Video". Generic words only ("your plan", "your coverage").
- Do not write contact details (phone, email, website) — the system adds the agent's own.
- On-screen words must agree with the narration; never add a claim the narration does not make.

OUTPUT: only a JSON object, no prose, no code fences. Write "types" FIRST — the scene type for every beat in order — and check it: first is "title", last is "cta", and no two neighbours are the same. Then write the scenes to match:
{"types":["title", ...],"scenes":[ ...exactly one object per beat, in order... ]}`

function beatsForPrompt(input: PlannerInput) {
  return input.beats.map((b, i) => {
    const sd = b.slideData || {}
    const bullets = (sd.bullets || []).map((x) => (typeof x === 'string' ? x : x?.text || '')).filter(Boolean)
    const stats = (sd.stats || []).filter((s) => s && s.value).map((s) => ({ label: s.label || '', value: s.value || '' }))
    return {
      beat: i + 1, role: b.role, narration: b.narration,
      ...(sd.headline || b.title ? { headline: sd.headline || b.title } : {}),
      ...(bullets.length ? { bullets } : {}),
      ...(stats.length ? { stats } : {}),
      ...(sd.cta ? { cta: sd.cta } : {}),
    }
  })
}

export function plannerUserMessage(input: PlannerInput): string {
  const ctx = {
    regulated_insurance_or_financial: input.regulated,
    has_presenter_photo: !!input.hasPresenter,
    closing_has_contact_details: !!(input.contact && Object.values(input.contact).some(Boolean)),
    key_numbers: (input.keyMetrics || []).filter((k) => k && k.value).slice(0, 24),
  }
  return `CONTEXT:\n${JSON.stringify(ctx)}\n\nBEATS (${input.beats.length}):\n${JSON.stringify(beatsForPrompt(input), null, 1)}\n\nReturn {"scenes":[...]} with exactly ${input.beats.length} scenes.`
}

// ── checks ───────────────────────────────────────────────────────────────────

const PRESSURE = /\b(act now|act fast|limited[- ]time|don'?t wait|do not wait|hurry|before it'?s too late|last chance|only (today|this week)|today only|expires? (soon|today)|risk[- ]free|guaranteed (returns?|growth|income|profits?)|once[- ]in[- ]a[- ]lifetime|sign (up )?today|while (supplies|spots) last|call now|buy now)\b/i
const PLACEHOLDER_SIDE = /^(n\/?a|none|other|tbd|-+|\?+|unknown|nothing|blank|x)$/i
const RAW_BIG_NUMBER = /\$?\d{4,}(?![\d,])/   // a number of 4+ digits written without commas
const YEARISH = /^(19|20)\d{2}$/

/** Every number the source gives us (digits and spelled-out), for grounding. */
export function sourceNumbers(input: PlannerInput): number[] {
  const out: number[] = []
  for (const b of input.beats) {
    out.push(...numbersIn(b.narration), ...spelledNumbersIn(b.narration), ...numbersIn(b.title))
    const sd = b.slideData || {}
    out.push(...numbersIn(sd.headline))
    for (const s of sd.stats || []) { out.push(...numbersIn(s?.value), ...numbersIn(s?.label)); const f = parseFigure(s?.value); if (f) out.push(f.value) }
    for (const x of sd.bullets || []) out.push(...numbersIn(typeof x === 'string' ? x : x?.text))
  }
  for (const k of input.keyMetrics || []) { out.push(...numbersIn(k?.value)); const f = parseFigure(k?.value); if (f) out.push(f.value) }
  return out
}
const grounded = (v: number, pool: number[]) => pool.some((p) => p === v || (Math.abs(p) > 0 && Math.abs(p - v) / Math.abs(p) < 0.005))

/** Every on-screen string in a scene (what a viewer reads). */
export function sceneStrings(s: KitScene): string[] {
  const out: (string | undefined)[] = []
  switch (s.type) {
    case 'title': out.push(s.headline, s.sub); break
    case 'bignumber': out.push(s.label, s.context, s.figure?.prefix, s.figure?.suffix); break
    case 'comparison': out.push(s.heading, s.verdict, s.left?.label, s.right?.label, ...(s.left?.points || []), ...(s.right?.points || [])); break
    case 'timeline': out.push(s.heading, ...(s.steps || []).flatMap((x) => [x?.when, x?.label])); break
    case 'chart': out.push(s.heading, s.takeaway, s.prefix, s.suffix, ...(s.points || []).map((p) => p?.label)); break
    case 'checklist': out.push(s.heading, ...(s.items || [])); break
    case 'quote': out.push(s.quote, s.attribution); break
    case 'cta': out.push(s.headline, s.action); break
  }
  return out.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
}

function figureIssues(f: Figure | undefined, where: string, pool: number[], money: number[]): string[] {
  if (!f) return []
  const out: string[] = []
  const pf = (f.prefix || '').trim()
  if (typeof f.value !== 'number' || !isFinite(f.value)) out.push(`${where}: "value" must be a plain number`)
  else {
    if (!grounded(f.value, pool)) out.push(`${where}: the number ${f.value} is not in the source — use only numbers from the beat or key numbers`)
    // Money is always written as money: a dollar amount in the source keeps its $.
    if (grounded(f.value, money) && !grounded(f.value, pool.filter((v) => !money.includes(v))) && !pf.includes('$')) out.push(`${where}: ${f.value} is a dollar amount in the source — give it "prefix":"$"`)
  }
  if (pf && !/^(\$|[A-Za-z]{1,10}( \$)?)$/.test(pf)) out.push(`${where}: prefix must be "$" or a short word like "Age "`)
  if (f.suffix && f.suffix.length > 12) out.push(`${where}: suffix too long`)
  return out
}

/** Numbers the source writes as money ($…), for the "money keeps its $" check. */
export function moneyNumbers(input: PlannerInput): number[] {
  const hay = [
    ...input.beats.flatMap((b) => [b.narration, b.title, b.slideData?.headline, ...(b.slideData?.stats || []).map((s) => s?.value), ...(b.slideData?.bullets || []).map((x) => (typeof x === 'string' ? x : x?.text))]),
    ...(input.keyMetrics || []).map((k) => k?.value),
  ].filter(Boolean).join(' \n ')
  const out: number[] = []
  for (const m of hay.matchAll(/\$\s?[\d,.]+\s*(?:thousand|million|billion|[kKmMbB](?![a-z]))?/g)) out.push(...numbersIn(m[0]))
  return out
}

function words(where: string, s: string | undefined, max: number): string[] {
  return s && countWords(s) > max ? [`${where}: ${countWords(s)} words (limit ${max})`] : []
}

/**
 * Checks a full plan. Returns problems as plain sentences, each starting
 * "scene N" so the repair call (and a human) can find them.
 */
export function validateKitScenes(scenes: unknown, input: PlannerInput): string[] {
  const issues: string[] = []
  if (!Array.isArray(scenes)) return ['the answer has no "scenes" list']
  if (scenes.length !== input.beats.length) issues.push(`expected ${input.beats.length} scenes, got ${scenes.length}`)
  const ctx = checkCtx(input)
  scenes.forEach((raw, i) => issues.push(...validateScene(raw, i, input, ctx, scenes[i - 1])))
  return issues
}

export type CheckCtx = { pool: number[]; money: number[]; tokens: string[] }
export const checkCtx = (input: PlannerInput): CheckCtx => ({ pool: sourceNumbers(input), money: moneyNumbers(input), tokens: input.productTokens || [] })

export function validateScene(raw: unknown, i: number, input: PlannerInput, ctx: CheckCtx, prev?: unknown): string[] {
  const { pool, money, tokens } = ctx
  const n = `scene ${i + 1}`
  const s = raw as KitScene
  if (!s || typeof s !== 'object' || !SCENE_TYPES.includes((s as { type: SceneType }).type)) return [`${n}: unknown scene type`]
  const out: string[] = []
  const role = input.beats[i]?.role
  if (role === 'cover' && s.type !== 'title') out.push(`${n}: the cover beat must be "title"`)
  if (role === 'closing' && s.type !== 'cta') out.push(`${n}: the closing beat must be "cta"`)
  if (role === 'content' && (s.type === 'title' || s.type === 'cta')) out.push(`${n}: "${s.type}" is only for the cover/closing`)
  if (prev && (prev as KitScene).type === s.type) out.push(`${n}: same scene type as the scene before ("${s.type}") — pick a different one`)
  const L = LIMITS
  switch (s.type) {
    case 'title':
      if (!s.headline?.trim()) out.push(`${n}: title needs a headline`)
      out.push(...words(`${n} headline`, s.headline, L.headline), ...words(`${n} sub`, s.sub, L.sub)); break
    case 'bignumber':
      if (!s.label?.trim()) out.push(`${n}: bignumber needs a label`)
      if (!s.figure) out.push(`${n}: bignumber needs a figure`)
      out.push(...words(`${n} label`, s.label, L.label), ...words(`${n} context`, s.context, L.context), ...figureIssues(s.figure, `${n} figure`, pool, money)); break
    case 'comparison': {
      const sides = [['left', s.left], ['right', s.right]] as const
      for (const [k, side] of sides) {
        if (!side || !side.label?.trim() || PLACEHOLDER_SIDE.test(side.label.trim())) out.push(`${n}: the ${k} side needs a real label`)
        else if (!side.figure && !(side.points && side.points.filter((p) => p?.trim()).length)) out.push(`${n}: the ${k} side needs a figure or at least one point`)
        out.push(...words(`${n} ${k} label`, side?.label, L.sideLabel))
        if ((side?.points || []).length > L.points) out.push(`${n}: the ${k} side has more than ${L.points} points`)
        for (const p of side?.points || []) { out.push(...words(`${n} ${k} point`, p, L.point)); if (PLACEHOLDER_SIDE.test(String(p).trim())) out.push(`${n}: the ${k} side has a placeholder point`) }
        out.push(...figureIssues(side?.figure, `${n} ${k} figure`, pool, money))
      }
      if (s.left?.label && s.right?.label && s.left.label.trim().toLowerCase() === s.right.label.trim().toLowerCase()) out.push(`${n}: both sides have the same label`)
      if (!!s.left?.figure !== !!s.right?.figure) out.push(`${n}: give both sides a figure, or neither`)
      // Two SIDES of one question measure the same thing: $ vs $, %/mo vs %/mo. "$142/mo" against "20 years" is two facts, not a comparison.
      const unit = (f?: Figure) => `${(f?.prefix || '').trim()}|${(f?.suffix || '').trim()}`
      if (s.left?.figure && s.right?.figure && unit(s.left.figure) !== unit(s.right.figure)) out.push(`${n}: the two sides measure different things (${formatFigure(s.left.figure)} vs ${formatFigure(s.right.figure)}) — a comparison needs the same kind of number on both sides; show these another way`)
      out.push(...words(`${n} heading`, s.heading, L.heading), ...words(`${n} verdict`, s.verdict, L.verdict)); break
    }
    case 'timeline':
      if (!Array.isArray(s.steps) || s.steps.length < L.steps[0] || s.steps.length > L.steps[1]) out.push(`${n}: a timeline needs ${L.steps[0]}-${L.steps[1]} steps`)
      for (const st of s.steps || []) { if (!st?.when?.trim() || !st?.label?.trim()) out.push(`${n}: every step needs "when" and "label"`); out.push(...words(`${n} when`, st?.when, L.when), ...words(`${n} step`, st?.label, L.stepLabel)) }
      out.push(...words(`${n} heading`, s.heading, L.heading)); break
    case 'chart': {
      const pts = Array.isArray(s.points) ? s.points : []
      if (pts.length < L.chartPoints[0] || pts.length > L.chartPoints[1]) out.push(`${n}: a chart needs ${L.chartPoints[0]}-${L.chartPoints[1]} points`)
      if (!['bar', 'donut', 'line'].includes(s.kind)) out.push(`${n}: chart kind must be bar, donut or line`)
      for (const p of pts) {
        if (typeof p?.value !== 'number' || !isFinite(p.value)) out.push(`${n}: every chart point needs a numeric value`)
        else if (!grounded(p.value, pool)) out.push(`${n}: the chart value ${p.value} is not in the source`)
        if (s.kind === 'donut' && typeof p?.value === 'number' && p.value < 0) out.push(`${n}: a donut cannot show a negative value`)
        out.push(...words(`${n} chart label`, p?.label, L.chartLabel))
      }
      if (new Set(pts.map((p) => String(p?.label || '').toLowerCase())).size !== pts.length) out.push(`${n}: chart labels must be different`)
      const vals = pts.map((p) => Math.abs(Number(p?.value) || 0)).filter((v) => v > 0)
      if (s.kind === 'bar' && vals.length >= 2 && Math.max(...vals) > 40 * Math.min(...vals)) out.push(`${n}: these bar values are not comparable (one is over 40x another, so the small bars vanish) — show them another way`)
      out.push(...words(`${n} heading`, s.heading, L.heading), ...words(`${n} takeaway`, s.takeaway, L.takeaway)); break
    }
    case 'checklist':
      if (!Array.isArray(s.items) || s.items.length < L.items[0] || s.items.length > L.items[1]) out.push(`${n}: a checklist needs ${L.items[0]}-${L.items[1]} items`)
      for (const it of s.items || []) out.push(...words(`${n} item`, it, L.item))
      out.push(...words(`${n} heading`, s.heading, L.heading)); break
    case 'quote':
      if (!s.quote?.trim()) out.push(`${n}: a quote needs words`)
      out.push(...words(`${n} quote`, s.quote, L.quote), ...words(`${n} attribution`, s.attribution, L.attribution)); break
    case 'cta':
      if (!s.headline?.trim() || !s.action?.trim()) out.push(`${n}: the closing needs a headline and an action`)
      out.push(...words(`${n} headline`, s.headline, L.headline), ...words(`${n} action`, s.action, L.action)); break
  }
  for (const str of sceneStrings(s)) {
    if (PRESSURE.test(str)) out.push(`${n}: sales-pressure wording ("${str.match(PRESSURE)![0]}") — use a calm invitation instead`)
    if (isPlatformName(str)) out.push(`${n}: never show "Docs2Video"`)
    const m = str.match(RAW_BIG_NUMBER)
    if (m && !YEARISH.test(m[0])) out.push(`${n}: "${m[0]}" is written without commas — put numbers in a figure/value field`)
    if (input.regulated && complianceChanges(str, tokens)) out.push(`${n}: "${str.slice(0, 60)}" names an insurance company/product or makes a guarantee promise — use generic, non-promissory words`)
  }
  return out
}

/** Would the shared compliance scrub change these words (a name removed, a promise softened)? Case and punctuation don't count. */
export function complianceChanges(str: string, tokens: string[]): boolean {
  const norm = (x: string) => normalizeForMatch(x).replace(/[^a-z0-9$%]+/g, ' ').trim()
  return norm(scrubComplianceText(str, tokens)) !== norm(str)
}

// ── the deterministic mapping (fallback) ─────────────────────────────────────

/** Shorten to `max` words at a clause break when possible, else at a word. */
export function clip(s: string | undefined, max: number): string {
  const all = String(s || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  if (all.length <= max) return all.join(' ')
  for (let i = max - 1; i >= Math.ceil(max / 2); i--) if (/[,;:.!?]$/.test(all[i])) return all.slice(0, i + 1).join(' ').replace(/[,;:]$/, '')
  const cut = all.slice(0, max)
  while (cut.length > 2 && /^(the|a|an|and|or|of|to|for|with|in|on|at|by|your|our|is|are)$/i.test(cut[cut.length - 1])) cut.pop()
  return cut.join(' ')
}
const sentences = (t: string) => String(t || '').split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter((x) => x.length > 3)
const bulletsOf = (b: PlannerBeat) => (b.slideData?.bullets || []).map((x) => (typeof x === 'string' ? x : x?.text || '')).map((x) => x.trim()).filter(Boolean)
const statsOf = (b: PlannerBeat) => (b.slideData?.stats || []).map((s) => ({ label: String(s?.label || '').trim(), fig: parseFigure(s?.value) })).filter((s): s is { label: string; fig: Figure } => !!s.fig)
const headingOf = (b: PlannerBeat, fallback: string) => clip(b.slideData?.headline || b.title || fallback, LIMITS.heading)
// Strip anything the checks would refuse from free text we lift ourselves.
function safe(text: string, input: PlannerInput): string {
  let s = text.replace(PRESSURE, '').replace(/\s{2,}/g, ' ').trim()
  if (input.regulated) s = scrubComplianceText(s, input.productTokens || [])
  if (isPlatformName(s)) s = ''
  return s.replace(RAW_BIG_NUMBER, (m) => (YEARISH.test(m) ? m : formatFigure({ value: Number(m.replace('$', '')), prefix: m.startsWith('$') ? '$' : '' })))
}

/** The plain, always-valid choices for one beat, best first. */
function fallbackOptions(b: PlannerBeat, i: number, input: PlannerInput): KitScene[] {
  const id = i + 1
  const narration = b.narration
  if (b.role === 'cover') {
    return [{ id, narration, type: 'title', headline: safe(clip(b.slideData?.headline || b.title || 'Your summary', LIMITS.headline), input) || 'Your summary', mood: 'calm' } as TitleScene]
  }
  if (b.role === 'closing') {
    const c = input.contact || {}
    const action = clip(safe(b.slideData?.cta || '', input), LIMITS.action) || (c.booking ? 'Book a quick call' : c.phone ? 'Give us a call' : c.email ? 'Send us a note' : 'Get in touch')
    return [{ id, narration, type: 'cta', headline: safe(clip(b.slideData?.headline || b.title || 'Questions? Let’s talk', LIMITS.headline), input) || 'Questions? Let’s talk', action, mood: 'calm' } as CtaScene]
  }
  const opts: KitScene[] = []
  const stats = statsOf(b)
  const heading = safe(headingOf(b, 'Here’s the idea'), input) || 'Here’s the idea'
  const bullets = bulletsOf(b).map((x) => safe(clip(x, LIMITS.item), input)).filter(Boolean)
  // several numbers of one kind → a bar chart
  const same = stats.filter((s) => (s.fig.prefix || '') === (stats[0]?.fig.prefix || '') && (s.fig.suffix || '') === (stats[0]?.fig.suffix || ''))
  const spreadOk = same.length >= 2 && Math.max(...same.map((s) => Math.abs(s.fig.value))) <= 20 * Math.max(1e-9, Math.min(...same.map((s) => Math.abs(s.fig.value))))
  if (spreadOk && same.length <= 6 && new Set(same.map((s) => s.label.toLowerCase())).size === same.length && same.every((s) => s.label)) {
    opts.push({ id, narration, type: 'chart', kind: 'bar', heading, mood: 'build', prefix: same[0].fig.prefix, suffix: same[0].fig.suffix, points: same.map((s) => ({ label: safe(clip(s.label, LIMITS.chartLabel), input) || '—', value: s.fig.value })) } as ChartScene)
  }
  // one number → the big number
  if (stats.length >= 1) {
    const s0 = stats[0]
    opts.push({ id, narration, type: 'bignumber', label: safe(clip(s0.label || heading, LIMITS.label), input) || 'The number', figure: s0.fig, context: bullets[0] ? clip(bullets[0], LIMITS.context) : undefined, mood: 'reveal' } as BigNumberScene)
  }
  // a money amount said in the narration, with no stats
  if (!stats.length) {
    const m = narration.match(/\$\s?\d{1,3}(?:,\d{3})+(?:\.\d+)?|\$\s?\d+(?:\.\d+)?/)
    const f = m ? parseFigure(m[0].replace(/\s/g, '')) : null
    if (f) opts.push({ id, narration, type: 'bignumber', label: safe(clip(heading, LIMITS.label), input) || 'The number', figure: f, mood: 'reveal' } as BigNumberScene)
  }
  if (bullets.length) opts.push({ id, narration, type: 'checklist', heading, items: bullets.slice(0, 4), mood: 'build' } as ChecklistScene)
  const lines = sentences(narration).map((x) => safe(clip(x, LIMITS.item), input)).filter(Boolean)
  if (lines.length >= 2) opts.push({ id, narration, type: 'checklist', heading, items: lines.slice(0, 3), mood: 'build' } as ChecklistScene)
  const q = safe(clip(sentences(narration)[0] || heading, LIMITS.quote), input) || heading
  opts.push({ id, narration, type: 'quote', quote: q, mood: 'calm' } as QuoteScene)
  // last resort that differs from a quote: a one-item checklist
  opts.push({ id, narration, type: 'checklist', heading, items: [clip(q, LIMITS.item)], mood: 'build' } as ChecklistScene)
  return opts
}

/** The deterministic scene for beat i: the best option that passes the checks and differs from the scene before. */
export function fallbackScene(i: number, input: PlannerInput, prev?: KitScene, ctx = checkCtx(input)): KitScene {
  const opts = fallbackOptions(input.beats[i], i, input)
  for (const o of opts) if (!validateScene(o, i, input, ctx, prev).length) return o
  // Nothing passed cleanly (e.g. the beat's own words trip a check): take the
  // first option that at least differs from the scene before.
  return opts.find((o) => o.type !== prev?.type) || opts[opts.length - 1]
}

/** The whole plan with no AI at all. */
export function fallbackPlan(input: PlannerInput): KitScene[] {
  const out: KitScene[] = []
  const ctx = checkCtx(input)
  input.beats.forEach((_, i) => out.push(fallbackScene(i, input, out[i - 1], ctx)))
  return finish(out, input)
}

// ── assembling ───────────────────────────────────────────────────────────────

function parseScenes(text: string): unknown[] | null {
  const t = String(text || '').replace(/^```(?:json)?/m, '').replace(/```\s*$/m, '')
  const a = t.indexOf('{'), b = t.lastIndexOf('}')
  if (a < 0 || b <= a) return null
  try {
    const j = JSON.parse(t.slice(a, b + 1))
    return Array.isArray(j?.scenes) ? j.scenes : null
  } catch { return null }
}

/** Ids, narration, moods, the agent's own contact on the closing, and clean figure values. */
function finish(scenes: KitScene[], input: PlannerInput): KitScene[] {
  return scenes.map((s, i) => {
    const b = input.beats[i]
    const out = { ...s, id: i + 1, narration: b?.narration ?? s.narration, mood: s.mood && ['calm', 'build', 'reveal'].includes(s.mood) ? s.mood : defaultMood(s.type) } as KitScene
    if (out.type === 'cta') out.contact = input.contact && Object.values(input.contact).some(Boolean) ? { ...input.contact } : undefined
    if (out.type === 'bignumber' && out.landOn && !String(b?.narration || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').includes(out.landOn.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').trim())) delete out.landOn
    if (out.type === 'chart' && typeof out.highlight === 'number' && (out.highlight < 0 || out.highlight >= out.points.length)) delete out.highlight
    return out
  })
}

/** Merge: keep every Claude scene that passes; swap each failing one for the fallback. */
function merge(candidate: unknown[], input: PlannerInput): { scenes: KitScene[]; swapped: number } {
  const ctx = checkCtx(input)
  const out: KitScene[] = []
  let swapped = 0
  for (let i = 0; i < input.beats.length; i++) {
    const c = candidate[i]
    const ok = c && !validateScene(c, i, input, ctx, out[i - 1]).length
    if (ok) out.push(c as KitScene)
    else { out.push(fallbackScene(i, input, out[i - 1], ctx)); swapped++ }
  }
  return { scenes: out, swapped }
}

function defaultCall(): PlannerCall | null {
  if (!process.env.ANTHROPIC_API_KEY) return null
  const client = new Anthropic()
  return async ({ system, user, maxTokens }) => {
    const r = await client.messages.create({
      model: KIT_PLANNER_MODEL,
      max_tokens: maxTokens,
      // Thinking off: a mapping task with a strict schema, and every output
      // token counts against the per-video cap.
      thinking: { type: 'disabled' },
      // The system prompt never changes → cached; repeat videos read it at 10%.
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: user }],
    }, { timeout: 90_000, maxRetries: 1 })
    const text = r.content.map((c) => (c.type === 'text' ? c.text : '')).join('')
    return { text, usage: r.usage as Usage, stopReason: r.stop_reason }
  }
}

/**
 * Plan a video. Never throws: any failure ends in the deterministic plan.
 * `opts.call` replaces the API (tests); `opts.capUsd` replaces the $0.25 cap.
 */
export async function planKitScenes(input: PlannerInput, opts: { call?: PlannerCall | null; capUsd?: number; log?: (line: string) => void } = {}): Promise<PlanResult> {
  const cap = opts.capUsd ?? KIT_PLAN_CAP_USD
  const log = opts.log ?? ((l: string) => console.log(l))
  const call = opts.call === undefined ? defaultCall() : opts.call
  const t0 = Date.now()
  let spent = 0, calls = 0
  const tokens = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 }
  const done = (r: Omit<PlanResult, 'costUsd' | 'calls'>): PlanResult => {
    const res = { ...r, costUsd: Math.round(spent * 1e6) / 1e6, calls, tokens }
    log(`[kit-planner] ${JSON.stringify({ videoId: input.videoId || null, source: res.source, beats: input.beats.length, calls, costUsd: res.costUsd, tokens, ms: Date.now() - t0, issues: res.issues.length, note: res.note || undefined })}`)
    return res
  }
  if (!input.beats.length) return done({ scenes: [], source: 'fallback', issues: [], note: 'no beats' })
  if (!call) return done({ scenes: fallbackPlan(input), source: 'fallback', issues: [], note: 'no API key' })

  // Room for the answer: ~150 tokens a scene is typical; allow ~3x.
  const wantOut = Math.min(8000, 500 + 450 * input.beats.length)
  /** The most output we can afford for this prompt without passing the cap, or 0. */
  const budget = (user: string) => {
    const inWorst = estimateTokens(KIT_SYSTEM_PROMPT + user) * SONNET5_PRICE.cacheWrite   // worst case: a cache WRITE at 1.25x
    const room = cap - spent - inWorst
    const maxOut = Math.floor(room / SONNET5_PRICE.output)
    const need = Math.min(wantOut, 200 + 180 * input.beats.length)   // below this a full answer can't fit
    return maxOut >= need ? Math.min(wantOut, maxOut) : 0
  }
  const ask = async (user: string): Promise<CallResult | null> => {
    const maxTokens = budget(user)
    if (!maxTokens) return null
    calls++
    const r = await call({ system: KIT_SYSTEM_PROMPT, user, maxTokens })
    spent += costOf(r.usage || {})
    tokens.input += r.usage?.input_tokens || 0; tokens.output += r.usage?.output_tokens || 0
    tokens.cacheWrite += r.usage?.cache_creation_input_tokens || 0; tokens.cacheRead += r.usage?.cache_read_input_tokens || 0
    return r
  }

  try {
    const user = plannerUserMessage(input)
    const first = await ask(user)
    if (!first) return done({ scenes: fallbackPlan(input), source: 'fallback', issues: [], note: 'cost cap: prompt too large' })
    let cand = first.stopReason === 'max_tokens' ? null : parseScenes(first.text)
    let issues = cand ? validateKitScenes(cand, input) : ['the answer was not valid JSON (or was cut off)']
    if (!issues.length && cand) return done({ scenes: finish(cand as KitScene[], input), source: 'claude', issues: [] })

    // ONE repair call with the exact problems.
    const repairUser = `${user}\n\nYOUR PREVIOUS ANSWER:\n${cand ? JSON.stringify({ scenes: cand }) : String(first.text).slice(0, 6000)}\n\nIT FAILED THESE CHECKS — fix every one and return the COMPLETE corrected JSON (all ${input.beats.length} scenes):\n- ${issues.slice(0, 40).join('\n- ')}`
    const second = await ask(repairUser)
    if (second) {
      const c2 = second.stopReason === 'max_tokens' ? null : parseScenes(second.text)
      if (c2) {
        const i2 = validateKitScenes(c2, input)
        if (!i2.length) return done({ scenes: finish(c2 as KitScene[], input), source: 'repaired', issues })
        cand = c2; issues = i2
      }
    }
    if (!cand) return done({ scenes: fallbackPlan(input), source: 'fallback', issues, note: second ? 'repair answer unusable' : 'cost cap reached before repair' })
    const merged = merge(cand, input)
    return done({ scenes: finish(merged.scenes, input), source: merged.swapped === input.beats.length ? 'fallback' : 'mixed', issues, note: `${merged.swapped} scene(s) from the fallback` })
  } catch (e) {
    return done({ scenes: fallbackPlan(input), source: 'fallback', issues: [], note: `planner error: ${(e as Error).message}`.slice(0, 200) })
  }
}
