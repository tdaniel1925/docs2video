// =============================================================================
// "SOMETHING I LIKE" — reading a reference picture, PDF or website into a look.
//
//   1. Get one picture:  an image as is · a PDF's FIRST page (pdf-lib keeps
//      page 1, the render service's /convert draws it) · a website's
//      screenshot (the same microlink screenshot the commercial maker uses,
//      after the SSRF guard says the address is public). Video links are
//      refused politely: "send a screenshot".
//   2. Colours are MEASURED in code (sharp → k-means, look-palette.ts):
//      one accent + calm neutrals, framework defaults set aside.
//   3. One cheap vision call (Gemini 2.5 Flash, ~0.05¢) names the mood,
//      the closest font family FROM OUR FREE LIST, density and energy, in a
//      fixed JSON shape. Code checks every field; anything odd → a default.
//   4. Only colours, a font family and a feel are taken. Words, logos and
//      photos in the reference are never used (the prompt says so, and the
//      look has nowhere to put them).
//
// Cost control: cached per account by the file's hash (website: by address,
// 7 days) — a cache hit costs nothing and isn't counted; otherwise 20 reads a
// day per account (rate_limit_hit, fail CLOSED). Any failure → the caller
// falls back to the brand with a plain message. Nothing is ever blocked.
// =============================================================================

import { createHash } from 'node:crypto'
import { closestFreeFont, FONT_IDS, isFontId, KIT_FONTS, type FontId } from '../../remotion/src/kit/spec'
import { clusterPixels, pickPalette, type MeasuredPalette } from './look-palette'
import { lookFromPalette, type ReferenceRead } from './look-wizard'
import type { Look } from '../../remotion/src/kit/spec'

export const REFERENCE_READS_PER_DAY = 20
export const REFERENCE_MAX_BYTES = 15 * 1024 * 1024
export const WEBSITE_CACHE_DAYS = 7
/** Bump when the colour rules change, so old cached reads aren't reused. */
const CACHE_VERSION = 'v2'

export type ReferenceKind = 'image' | 'pdf' | 'website'

export type ReferenceOk = {
  ok: true
  look: Look
  palette: MeasuredPalette
  read: ReferenceRead
  fontLabel: string
  source: ReferenceKind
  cached: boolean
  costUsd: number
}
export type ReferenceFail = {
  ok: false
  /** The look screen loads the brand instead and shows `message`. */
  fallback: 'brand'
  code: 'video_link' | 'bad_address' | 'too_big' | 'unreadable' | 'cap' | 'resting' | 'failed'
  message: string
}
export type ReferenceResult = ReferenceOk | ReferenceFail

export const FALLBACK_MESSAGE = 'We couldn’t read that one, so we started from your brand instead. Try another picture, or a screenshot of what you like.'
export const CAP_MESSAGE = `You’ve read ${REFERENCE_READS_PER_DAY} references today — that’s the daily limit. We started from your brand; you can read more tomorrow.`
export const VIDEO_LINK_MESSAGE = 'We can’t read videos. Pause it on a frame you like, take a screenshot, and upload that picture instead.'

const VIDEO_HOSTS = /(^|\.)(youtube\.com|youtu\.be|vimeo\.com|tiktok\.com|loom\.com|wistia\.com|wistia\.net|vidyard\.com|dailymotion\.com|twitch\.tv|instagram\.com\/reel)/i
export function isVideoLink(raw: string): boolean {
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
    return VIDEO_HOSTS.test(u.hostname) || /\.(mp4|mov|webm|m4v|avi)(\?|$)/i.test(u.pathname)
  } catch { return false }
}

/** "jordyn.app" → "https://jordyn.app/". null when it isn't a web address. */
export function normalizeAddress(raw: string): string | null {
  const s = String(raw || '').trim()
  if (!s || s.length > 500) return null
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    if (!u.hostname.includes('.')) return null
    u.hash = ''
    return u.toString()
  } catch { return null }
}

export const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex').slice(0, 40)

// ── the vision step's answer, checked ───────────────────────────────────────

const FAMILY_TO_ID = new Map(FONT_IDS.map((id) => [KIT_FONTS[id].family.toLowerCase(), id] as const))

/** Gemini's family name → one of our free fonts (it is asked to pick from the list; anything else is matched). */
export function fontFromName(name: unknown): { id: FontId; exact: boolean } {
  const n = String(name ?? '').trim()
  const hit = FAMILY_TO_ID.get(n.toLowerCase())
  if (hit) return { id: hit, exact: false } // a reference's own font is never used: always the closest free match
  if (isFontId(n)) return { id: n, exact: false }
  const low = n.toLowerCase()
  if (/script|hand|brush|calligra/.test(low)) return { id: 'fraunces', exact: false }
  if (/condensed|narrow|compressed|impact/.test(low)) return { id: 'oswald', exact: false }
  if (/slab/.test(low)) return { id: 'archivo', exact: false }
  if (/rounded/.test(low)) return { id: 'outfit', exact: false }
  if (/serif/.test(low) && !/sans/.test(low)) return { id: 'playfair', exact: false }
  if (/geometric/.test(low)) return { id: 'montserrat', exact: false }
  if (/grotesk|grotesque/.test(low)) return { id: 'space-grotesk', exact: false }
  const c = closestFreeFont(n, 'inter')
  return { id: c.id, exact: false }
}

/** The fixed shape, from whatever came back. Every field has a safe default. */
export function checkRead(raw: unknown): ReferenceRead {
  const r = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const mood = r.mood === 'calm' || r.mood === 'premium' || r.mood === 'energetic' ? r.mood : 'premium'
  const density = r.density === 'airy' || r.density === 'balanced' || r.density === 'dense' ? r.density : 'balanced'
  const energy = r.energy === 'low' || r.energy === 'medium' || r.energy === 'high' ? r.energy : 'medium'
  const f = fontFromName(r.closestFontFamily)
  return { mood, density, energy, font: f.id, fontExact: f.exact }
}

export const VISION_PROMPT = [
  'You are looking at a design reference someone likes. Describe ONLY its visual style.',
  'Never read out, copy or describe any words, names, logos, people or photos in it — they are not used.',
  'Answer with JSON only, exactly this shape:',
  '{"mood":"calm|premium|energetic","closestFontFamily":"<one family from the list>","density":"airy|balanced|dense","energy":"low|medium|high"}',
  `closestFontFamily must be the family from this list whose shapes are closest to the main headline type: ${FONT_IDS.map((id) => KIT_FONTS[id].family).join(', ')}.`,
  'mood: calm = soft, quiet, lots of space; premium = refined, restrained, luxurious; energetic = bold, bright, lively.',
].join('\n')

// ── the read itself ─────────────────────────────────────────────────────────

export type ReadDeps = {
  /** A cached result for this account + key, or null. */
  cacheGet: (key: string) => Promise<{ palette: MeasuredPalette; read: ReferenceRead; at: string; source: ReferenceKind } | null>
  cachePut: (key: string, value: { palette: MeasuredPalette; read: ReferenceRead; at: string; source: ReferenceKind }) => Promise<void>
  /** Count one read against the daily cap: 'allowed' | 'over' | 'error' (fail closed). */
  countRead: () => Promise<'allowed' | 'over' | 'error'>
  /** RGB pixels (3 bytes each) of the picture, downsized. Throws when unreadable. */
  pixels: (picture: Buffer) => Promise<Uint8Array>
  /** A small JPEG of the picture for the vision step. */
  thumb: (picture: Buffer) => Promise<Buffer>
  /** The vision step; returns the raw JSON object + what it cost. Throws on failure. */
  vision: (jpeg: Buffer) => Promise<{ json: unknown; costUsd: number }>
  /** PDF bytes → a picture of its first page. */
  pdfFirstPage: (pdf: Buffer) => Promise<Buffer>
  /** Website → a screenshot (null when it can't). Only called for public addresses. */
  screenshot: (url: string) => Promise<Buffer | null>
  /** Is this a public address (the SSRF guard)? */
  isPublic: (url: string) => Promise<boolean>
  /** The site's own font names (optional; never fetched for private addresses). */
  siteFonts?: (url: string) => Promise<string[]>
  log?: (line: string) => void
}

export type ReadInput =
  | { kind: 'image' | 'pdf'; bytes: Buffer }
  | { kind: 'website'; url: string }

const fail = (code: ReferenceFail['code'], message = FALLBACK_MESSAGE): ReferenceFail => ({ ok: false, fallback: 'brand', code, message })

function finish(palette: MeasuredPalette, read: ReferenceRead, source: ReferenceKind, cached: boolean, costUsd: number): ReferenceOk {
  const look = { ...lookFromPalette(palette, read, { light: palette.light }), name: source === 'website' ? 'From your website' : source === 'pdf' ? 'From your PDF' : 'From your picture' }
  return { ok: true, look, palette, read, fontLabel: `${KIT_FONTS[read.font].family} · closest match`, source, cached, costUsd }
}

export async function readReference(input: ReadInput, deps: ReadDeps): Promise<ReferenceResult> {
  const log = deps.log ?? (() => {})
  // Which thing, and its cache key.
  let key: string
  let url: string | null = null
  if (input.kind === 'website') {
    if (isVideoLink(input.url)) return fail('video_link', VIDEO_LINK_MESSAGE)
    url = normalizeAddress(input.url)
    if (!url) return fail('bad_address', 'That doesn’t look like a web address. We started from your brand instead.')
    key = `${CACHE_VERSION}-site-${sha(url)}`
  } else {
    if (!input.bytes?.length) return fail('unreadable')
    if (input.bytes.length > REFERENCE_MAX_BYTES) return fail('too_big', 'That file is too big (15 MB at most). We started from your brand instead.')
    key = `${CACHE_VERSION}-${input.kind}-${sha(input.bytes)}`
  }

  // 1. Cache (free, not counted).
  try {
    const hit = await deps.cacheGet(key)
    const fresh = hit && (input.kind !== 'website' || Date.now() - Date.parse(hit.at) < WEBSITE_CACHE_DAYS * 86400e3)
    if (hit && fresh) return finish(hit.palette, checkRead({ ...hit.read, closestFontFamily: KIT_FONTS[hit.read.font]?.family }), hit.source, true, 0)
  } catch (e) { log(`cache read skipped: ${(e as Error).message}`) }

  // 2. The daily cap (fail CLOSED: a counter we can't read means no read).
  if (url && !(await deps.isPublic(url))) return fail('bad_address', 'We can only read public websites. We started from your brand instead.')
  const counted = await deps.countRead()
  if (counted === 'over') return fail('cap', CAP_MESSAGE)
  if (counted === 'error') return fail('resting', 'Reading references is resting for a moment. We started from your brand instead — please try again shortly.')

  // 3. One picture.
  let picture: Buffer | null = null
  try {
    if (input.kind === 'image') picture = input.bytes
    else if (input.kind === 'pdf') picture = await deps.pdfFirstPage(input.bytes)
    else picture = await deps.screenshot(url!)
  } catch (e) { log(`picture failed: ${(e as Error).message}`) }
  if (!picture) return fail('unreadable')

  // 4. Colours, measured in code.
  let palette: MeasuredPalette
  try {
    const px = await deps.pixels(picture)
    if (px.length < 300) throw new Error('empty picture')
    palette = pickPalette(clusterPixels(px))
  } catch (e) {
    log(`colours failed: ${(e as Error).message}`)
    return fail('unreadable')
  }

  // 5. Mood + closest font (cheap vision). If it fails, the colours still stand.
  let read: ReferenceRead = checkRead(null)
  let costUsd = 0
  try {
    const v = await deps.vision(await deps.thumb(picture))
    read = checkRead(v.json)
    costUsd = v.costUsd
  } catch (e) { log(`vision skipped (defaults used): ${(e as Error).message}`) }
  // A website names its own fonts: use the closest free one to the first real family.
  if (url && deps.siteFonts) {
    try {
      const fam = (await deps.siteFonts(url)).find((f) => f && !/inherit|initial|system-ui|sans-serif|^serif$|monospace|var\(|icon|awesome|emoji/i.test(f))
      if (fam) { const f = closestFreeFont(fam, read.font); read = { ...read, font: f.id, fontExact: false } }
    } catch { /* the vision answer stands */ }
  }

  const at = new Date().toISOString()
  try { await deps.cachePut(key, { palette, read, at, source: input.kind }) } catch (e) { log(`cache write skipped: ${(e as Error).message}`) }
  log(JSON.stringify({ kind: input.kind, costUsd: Math.round(costUsd * 1e6) / 1e6, font: read.font, mood: read.mood }))
  return finish(palette, read, input.kind, false, costUsd)
}
