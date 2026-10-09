// =============================================================================
// FREE FIRST-SCENE PREVIEW — the small, pure rules.
//
// On step 3 ("Make it yours") a customer can see, before paying, a still
// picture of their FIRST CONTENT scene in the look they picked, plus ~10
// seconds of the voice reading that scene. Three per account per UTC day
// (admins unlimited). It never touches credits.
//
// Everything here is pure (no database, no network) so each rule has a test
// that can actually fail: tests/first-scene-preview.test.ts. The parts that
// talk to storage, the voice service and the render service live in
// first-scene-preview-server.ts; the cache keys (which need node's crypto) in
// first-scene-preview-keys.ts, so this file is safe to use in the browser too.
// =============================================================================

// voice-choice.ts is itself import-free, so this file stays browser-safe.
import { OPENAI_VOICES, normalizeVoice, wantsChosenVoice } from './voice-choice'

export const FREE_PREVIEWS_PER_DAY = 3

/** Shown when the day's free previews are used up. */
export const CAP_REACHED_MESSAGE =
  'You’ve used today’s 3 free previews. They come back tomorrow — or press Make to see the whole thing.'

// ── The daily cap ───────────────────────────────────────────────────────────
//
// Counted in the existing `rate_limits` table (one row per account per day,
// bumped atomically by the `rate_limit_hit` database function). The DAY is in
// the row's key, so the count starts again at midnight UTC no matter when the
// first preview of the day was made; the window is just "long enough to
// outlive the day".

/** The UTC calendar day, e.g. "2026-10-07". */
export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10)
}

/** The rate_limits key holding one account's previews for one UTC day. */
export function previewCapKey(userId: string, now: Date): string {
  return `first-scene-preview:${userId}:${utcDay(now)}`
}

/** rate_limits window: two days, so a row never resets inside its own day. */
export const CAP_WINDOW_SECS = 2 * 24 * 60 * 60

/** Free previews left today. `null` = no limit (admins). */
export function previewsLeft(usedToday: number, isAdmin: boolean): number | null {
  if (isAdmin) return null
  return Math.max(0, FREE_PREVIEWS_PER_DAY - Math.max(0, Math.floor(usedToday || 0)))
}

/** May this account make another preview right now? */
export function capDecision(o: { usedToday: number; isAdmin: boolean }): { allowed: boolean; remainingAfter: number | null } {
  if (o.isAdmin) return { allowed: true, remainingAfter: null }
  const left = previewsLeft(o.usedToday, false) as number
  return left > 0 ? { allowed: true, remainingAfter: left - 1 } : { allowed: false, remainingAfter: 0 }
}

/** The label under the button. */
export function previewsLeftLabel(left: number | null): string {
  if (left === null) return 'Free previews: no limit for admins'
  if (left === 0) return 'No free previews left today'
  return `${left} free preview${left === 1 ? '' : 's'} left today`
}

// ── Which scene ─────────────────────────────────────────────────────────────

export type PreviewScene = {
  title?: string
  narration?: string
  beat?: string
  _role?: 'cover' | 'closing' | string
  _auto?: boolean
  _autoNarration?: string
  slideData?: { headline?: string; bullets?: string[]; stats?: { label?: string; value?: string }[]; cta?: string }
}

const isBookend = (s: PreviewScene) => s?._role === 'cover' || s?._role === 'closing'

/** The cover, the FIRST CONTENT scene (the one previewed), the next content
 *  scene (some engines lay a slide out by its neighbours) and the closing. */
export function pickPreviewScenes(scenes: unknown): { cover?: PreviewScene; content: PreviewScene; next?: PreviewScene; closing?: PreviewScene; contentScenes: PreviewScene[] } | null {
  if (!Array.isArray(scenes)) return null
  const list = scenes.filter((s): s is PreviewScene => !!s && typeof s === 'object')
  const contentScenes = list.filter((s) => !isBookend(s) && typeof s.narration === 'string' && s.narration.trim().length > 0)
  if (!contentScenes.length) return null
  return {
    cover: list.find((s) => s._role === 'cover'),
    content: contentScenes[0],
    next: contentScenes[1],
    closing: list.find((s) => s._role === 'closing'),
    contentScenes,
  }
}

/**
 * About ten seconds of narration: whole sentences up to ~26 words (people
 * hear ~2.5 words a second). A first sentence longer than that is cut at the
 * last comma or dash inside the limit (but not in its first third), so the
 * sample still ends on a pause.
 */
export function narrationSample(text: string, maxWords = 26): string {
  const clean = String(text || '').replace(/\s+/g, ' ').trim()
  if (!clean) return ''
  const sentences = clean.match(/[^.!?]+[.!?]+["”’)]*\s*|[^.!?]+$/g) ?? [clean]
  let out = ''
  for (const s of sentences) {
    const next = (out + s).trim()
    if (next.split(' ').length > maxWords) break
    out = next + ' '
  }
  out = out.trim()
  if (out) return out
  const words = clean.split(' ').slice(0, maxWords)
  for (let i = words.length - 1; i >= Math.ceil(maxWords / 3); i--) {
    if (/[,;:]$/.test(words[i]) || /^[—–-]+$/.test(words[i])) {
      return words.slice(0, /^[—–-]+$/.test(words[i]) ? i : i + 1).join(' ').replace(/[,;:]$/, '') + '.'
    }
  }
  return words.join(' ') + '.'
}

// ── Which engine draws the still ────────────────────────────────────────────

export type PreviewOutput = 'video' | 'interactive' | 'deck'
export type StillEngine = 'directed' | 'v3' | 'editorial' | 'html' | 'drawn' | 'kit'

export const VIDEO_PREVIEW_LOOKS = ['slides', 'aurora', 'cinematic', 'infographic', 'editorial', 'explainer', 'drawn',
  // the scene kit (KIT_ENGINE=on): "kit:<look>" — kit-looks.ts previewLookFor
  'kit:animated-slides', 'kit:editorial', 'kit:bright', 'kit:brand'] as const

/** The real renderer for each look (null = no preview for that output). */
export function stillEngineFor(output: string, look: string): StillEngine | null {
  if (output === 'interactive' || output === 'deck') return 'html'
  if (output !== 'video') return null
  if (look.startsWith('kit:')) return 'kit'                      // KitVideo (the scene kit)
  if (look === 'slides') return 'directed'                       // DirectedVideo
  if (look === 'aurora' || look === 'cinematic' || look === 'infographic') return 'v3' // V3Video / InfographicVideo
  if (look === 'editorial' || look === 'explainer') return 'editorial'                // EditorialVideo
  if (look === 'drawn') return 'drawn'   // one real AI picture (gpt-image on fal, ~0.3c) — drawn-slides.ts
  return null
}

/** An honest line under the picture when the finished video adds something
 *  the free preview leaves out (an AI picture costs money to make). */
export function lookNote(output: string, look: string): string | null {
  if (output !== 'video') return null
  if (look.startsWith('kit:')) return 'The finished video picks the scene design that suits each part of your story. This shows one of them.'
  if (look === 'cinematic') return 'The finished video adds a photo behind each scene. This preview shows the layout and your words.'
  if (look === 'infographic') return 'The finished video adds a designed background picture. This preview shows the layout and your numbers.'
  if (look === 'editorial' || look === 'explainer') return 'The finished video can give this page a different layout (numbers, a list or a quote) to suit what it says.'
  if (look === 'drawn') return 'Every slide is drawn fresh, so the finished slides will look a little different from this one — same style, same words.'
  return null
}

// ── Which voice ─────────────────────────────────────────────────────────────
//
// The sample must sound like the finished video. Every narrated look —
// Animated slides, Aurora, Cinematic, Infographic, Editorial, Explainer — and
// interactive presentations now follow ONE rule (voice-choice.ts):
//  • Sarah (the default) is spoken by ElevenLabs;
//  • any other voice picked is spoken by that OpenAI voice.
// (Before, only the Animated slides look used the pick and the sample said so.)
//  • Slide decks (output 'deck') have no voice.
// `note` stays in the shape for callers; there is nothing to warn about now.

export { OPENAI_VOICES }

export function voiceForPreview(output: string, look: string, voiceId: string): { engine: 'elevenlabs' | 'openai'; voice: string; note: string | null } | null {
  if (output === 'deck') return null
  const v = normalizeVoice(voiceId)
  return wantsChosenVoice(v) ? { engine: 'openai', voice: v, note: null } : { engine: 'elevenlabs', voice: 'nova', note: null }
}

// ── Editorial / Explainer page for a scene (code only) ──────────────────────
//
// The finished editorial video asks Claude to pick each page's layout. A free
// preview doesn't spend that call: it picks the same way from what the scene
// already holds — numbers → a stat page, several points → a list, otherwise a
// paragraph page — using only the scene's own words.

type EdScene = { archetype: string; kicker?: string; title: string; dek?: string; body?: string; items?: { title: string; detail?: string }[]; metrics?: { label: string; value: string }[]; narration: string }

export function editorialPreviewScenes(o: { cover?: PreviewScene; content: PreviewScene; closing?: PreviewScene; title: string; contactLine?: string }): EdScene[] {
  const s = o.content
  const sd = s.slideData ?? {}
  const heading = (sd.headline || s.title || '').trim()
  const stats = (sd.stats ?? []).filter((x): x is { label: string; value: string } => !!x && !!x.label && !!x.value).slice(0, 3)
  const bullets = (sd.bullets ?? []).filter((b) => typeof b === 'string' && b.trim()).slice(0, 5)
  const kicker = s.beat ? String(s.beat).toUpperCase() : undefined
  const narration = s.narration || heading || ' '
  const page: EdScene = stats.length
    ? { archetype: 'stat', kicker, title: heading, metrics: stats, narration }
    : bullets.length >= 2
      ? { archetype: 'list', kicker, title: heading, items: bullets.map((b) => ({ title: b })), narration }
      : { archetype: 'lede', kicker, title: heading, body: s.narration || '', narration }
  const coverTitle = (o.cover?.slideData?.headline || o.cover?.title || o.title || '').trim()
  return [
    { archetype: 'cover', title: coverTitle || o.title, narration: o.cover?.narration || coverTitle || ' ' },
    page,
    { archetype: 'decision', title: (o.closing?.slideData?.headline || o.closing?.title || 'Thank you').trim(), dek: o.contactLine, narration: o.closing?.narration || ' ' },
  ]
}
