// =============================================================================
// "DRAWN SLIDES" — the look where an AI draws every slide as ONE finished
// picture (headline, bullets and big numbers drawn in), then the voice and
// optional music play over it. It is the original Docs2Video look, brought
// back on the classic render route (render service POST /generate).
//
// This file is the ONE place that decides WHAT is drawn on each slide. It is
// pure (no network, no imports with side effects) so tests can call it and
// the free preview / generate-video / scripts all build the same prompts.
//
// The rules (owner, 2026-10-09):
//   - Short headline + at most 4 short bullets per slide. Numbers keep their
//     $ and commas ("$500,000", never "$500000").
//   - Never draw a real carrier / product name: every word passes the shared
//     compliance scrubber (app/_lib/compliance.ts) when the document is
//     regulated. No logos, no company marks, no contact details drawn — the
//     closing contact line is added as plain text by the render service code.
//   - 16:9. Every slide of one video uses the same style prompt and colours
//     so they look like one set (gpt-image has no seed; the render service
//     also passes the first slide as a style reference to the rest).
//
// Which model draws: OpenAI gpt-image-2.5 on fal.ai (render-service/server.js
// drawWithFal), Gemini 3 Pro Image as the fallback when fal fails. Measured
// cost is recorded next to CREDIT_COSTS.drawnSlides in credits.ts.
// =============================================================================

export type DrawStyleId = '3d' | 'illustrated' | 'classic'

export const DRAW_STYLES: { id: DrawStyleId; name: string; hint: string; prompt: string }[] = [
  {
    id: '3d',
    name: '3D infographic',
    hint: 'Glossy isometric 3D objects and cards.',
    prompt:
      'Premium isometric 3D infographic slide. Glossy, softly lit 3D objects — rounded blocks, coins, shields, arrows, gauges, charts, devices — rendered like polished plastic and glass with soft shadows and gentle reflections, arranged on a clean isometric layout. Smooth gradient background built from the palette colours. Each bullet or number sits on its own glossy 3D card or beside a matching 3D icon. Modern tech-marketing look: crisp, bright, premium and uncluttered.',
  },
  {
    id: 'illustrated',
    name: 'Illustrated',
    hint: 'Friendly flat illustration.',
    prompt:
      'Flat vector illustration slide. Friendly flat illustrations made of simple shapes and soft solid colours from the palette, in a modern editorial style like a fintech landing page — simple people, homes, documents, charts and plants where they help the meaning. Light warm background, rounded cards for the bullets, simple matching icons. No 3D rendering, no photos, no gradients heavier than a soft wash.',
  },
  {
    id: 'classic',
    name: 'Classic',
    hint: 'Clean corporate slide.',
    prompt:
      'Clean corporate presentation slide, like a premium consulting deck. White or very light background, a strong grid, one bold accent shape or band in the primary colour, thin line icons, clear typographic hierarchy with a bold sans-serif headline. Numbers shown large in simple boxes. Minimal decoration: no 3D, no illustrated people, no photos.',
  },
]

export const DEFAULT_DRAW_STYLE: DrawStyleId = '3d'

export function isDrawStyle(v: unknown): v is DrawStyleId {
  return DRAW_STYLES.some((s) => s.id === v)
}

/** The style chosen, or the default when nothing (or nonsense) was saved. */
export function drawStyleOf(v: unknown): DrawStyleId {
  return isDrawStyle(v) ? v : DEFAULT_DRAW_STYLE
}

/** The id the create flow saves as `videoStyle` for this look. */
export const DRAWN_LOOK_ID = 'drawn' as const

// ── Words on a slide ───────────────────────────────────────────────────────

export const MAX_BULLETS = 4
export const MAX_HEADLINE_WORDS = 8
export const MAX_BULLET_WORDS = 10

/**
 * "$500000" → "$500,000", "1250000" → "1,250,000", "$1234.5" → "$1,234.5".
 * Money (after a $) always gets commas; a bare number only from 5 digits up,
 * so years ("2026") and ages ("65") are left alone.
 */
export function formatFigures(s: string): string {
  if (typeof s !== 'string' || !s) return s
  const commas = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return s
    .replace(/\$\s?(\d{4,})(\.\d+)?/g, (_m, d: string, dec?: string) => `$${commas(d)}${dec ?? ''}`)
    .replace(/(^|[^\d$,.])(\d{5,})(?![\d,])/g, (_m, pre: string, d: string) => `${pre}${commas(d)}`)
}

const CONTACT_RE = /(\b\d{3}[-.\s)]?\s?\d{3}[-.\s]?\d{4}\b|@|https?:\/\/|www\.|\.(com|net|org|io|co)\b)/i

const DANGLING = /^(a|an|the|to|of|for|and|or|but|if|in|on|at|by|with|your|our|their|is|are|was|that|this|from|as)$/i

/** Cut to `max` words, drop trailing punctuation and quotes (the prompt quotes it). */
function tidy(s: unknown, max: number): string {
  if (typeof s !== 'string') return ''
  const words = s.replace(/["“”]/g, '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  const kept = words.slice(0, max)
  // A cut line must not end on a dangling little word ("…happens to").
  if (words.length > max) while (kept.length > 1 && DANGLING.test(kept[kept.length - 1])) kept.pop()
  return kept.join(' ').replace(/[\s,;:—–-]+$/, '').replace(/\.$/, '')
}

export type DrawnSlideText = {
  role: 'cover' | 'content' | 'closing'
  headline: string
  /** Big numbers first ("$500,000 — Coverage amount"), then plain bullets. ≤ 4 in all. */
  numbers: { value: string; label: string }[]
  bullets: string[]
  /** Cover only: "Prepared for …" (the client's name is allowed — compliance keeps it). */
  subtitle?: string
}

type SceneLike = {
  title?: string
  narration?: string
  slideData?: {
    headline?: string
    bullets?: unknown[]
    stats?: { label?: string; value?: string }[]
    cta?: string
  }
  bullets?: unknown[]
  stats?: { label?: string; value?: string }[]
}

/**
 * The words ONE slide shows, from a scene the create flow made. `scrub` is the
 * compliance scrubber (complianceScrubberFor) — pass it whenever the document
 * is regulated; it runs on EVERY string that will be drawn.
 */
export function drawnSlideText(
  scene: SceneLike,
  role: DrawnSlideText['role'],
  opts: { scrub?: ((s: string) => string) | null; fallbackTitle?: string; recipient?: string | null } = {},
): DrawnSlideText {
  const scrub = (s: string) => (opts.scrub && s ? opts.scrub(s) : s)
  const clean = (s: unknown, max: number) => formatFigures(tidy(scrub(tidy(s, max * 2)), max))
  const sd = scene?.slideData || {}

  if (role === 'cover') {
    const headline = clean(sd.headline || scene?.title || opts.fallbackTitle || 'Your summary', MAX_HEADLINE_WORDS) || 'Your summary'
    const who = tidy(opts.recipient, 6)
    return { role, headline, numbers: [], bullets: [], ...(who ? { subtitle: `Prepared for ${who}` } : {}) }
  }
  if (role === 'closing') {
    const headline = clean(sd.headline || scene?.title || 'Thank you', MAX_HEADLINE_WORDS) || 'Thank you'
    const cta = clean(sd.cta, MAX_BULLET_WORDS)
    return { role, headline, numbers: [], bullets: cta && !CONTACT_RE.test(cta) ? [cta] : [] }
  }

  const headline = clean(sd.headline || scene?.title || '', MAX_HEADLINE_WORDS)
  const rawStats = (Array.isArray(sd.stats) ? sd.stats : Array.isArray(scene?.stats) ? scene.stats : []) || []
  const numbers = rawStats
    .map((st) => ({ value: clean(st?.value, 4), label: clean(st?.label, 5) }))
    .filter((n) => n.value && !CONTACT_RE.test(n.value) && !CONTACT_RE.test(n.label))
    .slice(0, 3)
  const rawBullets = (Array.isArray(sd.bullets) ? sd.bullets : Array.isArray(scene?.bullets) ? scene.bullets : []) as unknown[]
  let bullets = rawBullets
    .map((b) => clean(typeof b === 'string' ? b : (b as { text?: string })?.text, MAX_BULLET_WORDS))
    .filter((b) => b && !CONTACT_RE.test(b))
  // Nothing to show? Two short lines from the narration, so the slide isn't empty.
  if (!numbers.length && !bullets.length && scene?.narration) {
    bullets = String(scrub(scene.narration)).split(/[.!?]+/).map((s) => clean(s, MAX_BULLET_WORDS)).filter((s) => s.split(' ').length >= 3 && !CONTACT_RE.test(s)).slice(0, 2)
  }
  bullets = bullets.slice(0, Math.max(0, MAX_BULLETS - numbers.length))
  return { role, headline, numbers, bullets }
}

// ── The picture prompt ─────────────────────────────────────────────────────

/** What Drawn slides take from a video look: its colours and its feel. */
export type DrawnLook = { colors: { bg: string; glow: string; accent: string; text: string }; feel?: string }

const FEEL_WORDS: Record<string, string> = {
  calm: 'calm and unhurried — soft shapes, lots of breathing room',
  premium: 'premium and polished — refined, restrained, confident',
  energetic: 'energetic and bright — bold shapes, lively but tidy',
}

/** The look's colours and feel as drawing instructions (colours only — never codes on the slide). */
export function drawnLookPalette(look: DrawnLook): string {
  const hex = (v: unknown, d: string) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : d)
  const c = look.colors || ({} as DrawnLook['colors'])
  const feel = FEEL_WORDS[String(look.feel)] ?? FEEL_WORDS.premium
  return `COLOUR PALETTE: background ${hex(c.bg, '#0b1424')}, second colour ${hex(c.glow, '#1d3358')}, ONE accent ${hex(c.accent, '#d8b25a')} for the key number and highlights, words in ${hex(c.text, '#f4f1ec')}. Use these colours only — never write the colour codes on the slide. FEEL: ${feel}.`
}

/** A draft's saved look (kitLookCustom) as Drawn slides reads it, or null. */
export function drawnLookFrom(raw: unknown): DrawnLook | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as { colors?: Record<string, unknown>; feel?: unknown }
  const c = r.colors
  if (!c || typeof c !== 'object') return null
  const hex = (v: unknown) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : null)
  const bg = hex(c.bg), accent = hex(c.accent)
  if (!bg || !accent) return null
  return { colors: { bg, glow: hex(c.glow) ?? bg, accent, text: hex(c.text) ?? '#f4f1ec' }, feel: typeof r.feel === 'string' ? r.feel : undefined }
}

export function drawnSlidePrompt(args: {
  style: DrawStyleId
  text: DrawnSlideText
  colors: { primary: string; secondary: string }
  /** e.g. "slide 3 of 10" — keeps the model aware it is part of a set. */
  position?: { index: number; total: number }
  /** The video look made on the look screen (its colours + feel), when there is one. */
  look?: DrawnLook | null
}): string {
  const style = DRAW_STYLES.find((s) => s.id === args.style) ?? DRAW_STYLES[0]
  const t = args.text
  const lines: string[] = []
  lines.push(`HEADLINE: "${t.headline}"`)
  if (t.subtitle) lines.push(`SUBTITLE: "${t.subtitle}"`)
  for (const n of t.numbers) lines.push(`BIG NUMBER: "${n.value}" with the small label "${n.label}"`)
  for (const b of t.bullets) lines.push(`BULLET: "${b}"`)
  const kind =
    t.role === 'cover' ? 'the opening title slide — the headline is the hero, with simple supporting artwork and NO numbers or charts'
    : t.role === 'closing' ? 'the closing slide — warm and simple, the headline is the hero, NO numbers or charts'
    : 'a content slide — lay the numbers and bullets out clearly so each one reads at a glance'

  return [
    `A 16:9 presentation slide, ${kind}${args.position ? ` (slide ${args.position.index} of ${args.position.total} in one matching set)` : ''}.`,
    `STYLE: ${style.prompt}`,
    args.look ? drawnLookPalette(args.look) : `COLOUR PALETTE: primary ${args.colors.primary}, secondary ${args.colors.secondary}, plus white and soft neutrals. These are colours only — never write the colour codes on the slide.`,
    `TEXT ON THE SLIDE — draw EXACTLY these words and nothing else:\n${lines.join('\n')}`,
    'Spell every word exactly as written, letter for letter. Copy every number exactly, keeping its $ sign, commas and decimal point. Large, clean, highly legible sans-serif type with strong contrast.',
    'Do NOT add any other words: no extra titles, labels, captions, page numbers, dates, legends, watermarks or placeholder text. Do NOT draw any logo, brand mark, company name, product name, phone number, email address or website.',
    'Keep every word and important shape at least 7% in from every edge. No solid bar or strip along the top or bottom edge.',
  ].join('\n\n')
}

/** Everything the render service needs for a drawn-slides video, in order: cover, content…, closing. */
export function buildDrawnSlides(args: {
  style: unknown
  cover: SceneLike
  scenes: SceneLike[]
  closing: SceneLike
  colors: { primary: string; secondary: string }
  scrub?: ((s: string) => string) | null
  videoTitle?: string
  recipient?: string | null
  look?: DrawnLook | null
}): { style: DrawStyleId; texts: DrawnSlideText[]; prompts: string[] } {
  const style = drawStyleOf(args.style)
  const texts: DrawnSlideText[] = [
    drawnSlideText(args.cover, 'cover', { scrub: args.scrub, fallbackTitle: args.videoTitle, recipient: args.recipient }),
    ...args.scenes.map((s) => drawnSlideText(s, 'content', { scrub: args.scrub })),
    drawnSlideText(args.closing, 'closing', { scrub: args.scrub }),
  ]
  const total = texts.length
  const prompts = texts.map((text, i) => drawnSlidePrompt({ style, text, colors: args.colors, position: { index: i + 1, total }, look: args.look }))
  return { style, texts, prompts }
}
