// =============================================================================
// SLIDE SPELL-CHECK (app side) — the free preview's copy of
// render-service/slide-spellcheck.js. The render service is its own deploy
// and can't import from here, so the two are MIRRORS: change one, change the
// other. tests/drawn-spellcheck.test.ts runs the same cases through both.
//
// What it does (full notes in the render-service file): after a "Drawn
// slides" picture is drawn, Gemini 2.5 Flash reads back every line of text
// and where it is; missing / wrong words and numbers are found by comparing
// with the intended words; words squeezed together ("toyou") are found by
// measuring the word gaps in the pixels. Fail → redraw once → keep the better
// one. If the read-back fails, the slide is accepted — a check never blocks.
//
// COST per check ≈ 0.1c (~1,800 image + ~250 prompt tokens in, ~150-300 out
// on Gemini 2.5 Flash, thinking off; measured 2026-10-09). ~1-2 s.
// =============================================================================

export type SeenLine = { text: string; box: number[] | null }
export type SlideReadBack = { lines: SeenLine[] }
export type CheckResult = { ok: boolean; problems: string[]; seen?: SlideReadBack }

type SharpLike = (input: Buffer) => {
  greyscale(): { raw(): { toBuffer(o: { resolveWithObject: true }): Promise<{ data: Buffer; info: { width: number; height: number; channels: number } }> } }
  resize(w: number, h: number, o: { fit: 'inside' }): { jpeg(o: { quality: number }): { toBuffer(): Promise<Buffer> } }
}

export const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
const CHECK_TIMEOUT_MS = 20000

export const VISION_PROMPT = [
  'Transcribe EVERY line of text visible in this image, exactly as it is drawn, letter for letter.',
  'Do NOT correct spelling. Do NOT add or guess words that are not visibly there.',
  'Keep $ signs, commas and decimal points in numbers exactly as drawn.',
  'For each line also give its bounding box as box_2d [ymin, xmin, ymax, xmax], normalised 0-1000, tight around that line\'s letters.',
  'Answer ONLY with JSON: {"lines": [{"text": "first line", "box_2d": [ymin, xmin, ymax, xmax]}, ...]} — top to bottom, left to right.',
].join(' ')

// ── What the slide was meant to say ─────────────────────────────────────────

/** The quoted words a drawnSlidePrompt asks for (HEADLINE / SUBTITLE / BIG NUMBER … label / BULLET). */
export function expectedFromPrompt(prompt: string): string[] {
  const out: string[] = []
  for (const line of String(prompt || '').split('\n')) {
    if (!/^(HEADLINE|SUBTITLE|BIG NUMBER|BULLET):/.test(line.trim())) continue
    for (const m of line.matchAll(/"([^"]*)"/g)) if (m[1].trim()) out.push(m[1].trim())
  }
  return out
}

// ── The forgiving compare ───────────────────────────────────────────────────

/** Words, forgiving case, punctuation, spacing, $ and thousands commas. */
export function normWords(s: unknown): string[] {
  return String(s || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['‘’`´]/g, '')
    .replace(/(\d),(?=\d{3}\b)/g, '$1')
    .replace(/\$/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
}

function linesOf(seen: SlideReadBack | (string | SeenLine)[] | null | undefined): string[] {
  if (Array.isArray(seen)) return seen.map((l) => (typeof l === 'string' ? l : String(l?.text || '')))
  return seen && Array.isArray(seen.lines) ? linesOf(seen.lines) : []
}

/** Missing words / numbers, and neighbouring words written joined ("toyou"). Extra words are not judged. */
export function compareSlideText(expected: string[], seen: SlideReadBack | (string | SeenLine)[]): { ok: boolean; problems: string[] } {
  const items = (expected || []).map((s) => ({ raw: s, words: normWords(s) })).filter((i) => i.words.length)
  const seenWords = normWords(linesOf(seen).join(' \n '))
  const left = new Map<string, number>()
  for (const w of seenWords) left.set(w, (left.get(w) || 0) + 1)
  const take = (w: string) => { const n = left.get(w) || 0; if (n > 0) { left.set(w, n - 1); return true } return false }
  const expectedSet = new Set(items.flatMap((i) => i.words))
  const problems: string[] = []

  for (const it of items) {
    const handled = new Array(it.words.length).fill(false)
    for (let i = 0; i + 1 < it.words.length; i++) {
      if (handled[i]) continue
      const a = it.words[i], b = it.words[i + 1], joined = a + b
      if (!expectedSet.has(joined) && take(joined)) {
        problems.push(`words run together: "${a} ${b}" drawn as "${joined}" (in "${it.raw}")`)
        handled[i] = handled[i + 1] = true
      }
    }
    for (let i = 0; i < it.words.length; i++) {
      if (handled[i]) continue
      if (!take(it.words[i])) problems.push(`missing "${it.words[i]}" (in "${it.raw}")`)
    }
  }
  return { ok: problems.length === 0, problems }
}

// ── Squeezed words, measured in the pixels ─────────────────────────────────

export const WORD_GAP_OF_HEIGHT = 0.16
const CHAR_ASPECT = 0.55

type Gray = { data: Uint8Array; width: number; height: number }
type Row = { height: number; width: number; groups: number }

export async function grayPixels(png: Buffer, sharp: SharpLike): Promise<Gray> {
  const { data, info } = await sharp(png).greyscale().raw().toBuffer({ resolveWithObject: true })
  if (info.channels !== 1) throw new Error('greyscale decode gave ' + info.channels + ' channels')
  return { data, width: info.width, height: info.height }
}

function rowsInWindow(img: Uint8Array, W: number, top: number, bottom: number, left: number, right: number): Row[] {
  const w = right - left, h = bottom - top
  if (w < 8 || h < 6) return []
  const px = (x: number, y: number) => img[(top + y) * W + left + x]
  const hist = new Array(256).fill(0)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) hist[px(x, y)]++
  const n = w * h
  let sum = 0
  for (let i = 0; i < 256; i++) sum += i * hist[i]
  let sB = 0, wB = 0, best = -1, th = 127, dark = 0
  for (let t = 0; t < 256; t++) {
    wB += hist[t]
    if (!wB) continue
    const wF = n - wB
    if (!wF) break
    sB += t * hist[t]
    const between = wB * wF * (sB / wB - (sum - sB) / wF) ** 2
    if (between > best) { best = between; th = t; dark = wB }
  }
  const inkIsDark = dark <= n / 2
  const isInk = (x: number, y: number) => (inkIsDark ? px(x, y) <= th : px(x, y) > th)
  const rowHasInk = new Array(h).fill(false)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (isInk(x, y)) { rowHasInk[y] = true; break }
  const out: Row[] = []
  for (let y = 0; y < h;) {
    if (!rowHasInk[y]) { y++; continue }
    const s = y
    while (y < h && rowHasInk[y]) y++
    if (y - s < 6 || s === 0 || y === h) continue
    const col = new Array(w).fill(false)
    for (let yy = s; yy < y; yy++) for (let x = 0; x < w; x++) if (!col[x] && isInk(x, yy)) col[x] = true
    const minGap = Math.max(3, (y - s) * WORD_GAP_OF_HEIGHT)
    let groups = 0, gap = Infinity, first = -1, last = -1
    for (let x = 0; x < w; x++) {
      if (col[x]) { if (gap >= minGap) groups++; gap = 0; if (first < 0) first = x; last = x } else gap++
    }
    out.push({ height: y - s, width: last - first + 1, groups })
  }
  return out
}

/** Word-groups per fitting text row near one line's (rough) box. Mirror of the render-service function. */
export function wordGroupsNear(gray: Gray, box: number[] | null, chars = 0): Row[] | null {
  if (!Array.isArray(box) || box.length !== 4 || box.some((n) => typeof n !== 'number' || !isFinite(n))) return null
  const [y0, x0, y1, x1] = box
  if (y1 <= y0 || x1 <= x0) return null
  const img = gray.data, W = gray.width, H = gray.height
  if (!W || !H) return null
  const by0 = y0 * H / 1000, by1 = y1 * H / 1000, bh = by1 - by0
  const left = Math.max(0, Math.round(x0 * W / 1000 - W * 0.03))
  const right = Math.min(W, Math.round(x1 * W / 1000 + W * 0.03))
  const win = (a: number, b: number) => rowsInWindow(img, W, Math.max(0, Math.round(a)), Math.min(H, Math.round(b)), left, right)
  const shaped = (r: Row) => r.height >= bh * 0.3 && r.height <= bh * 1.6 &&
    (!chars || (r.width / r.height >= chars * CHAR_ASPECT * 0.7 && r.width / r.height <= chars * CHAR_ASPECT * 1.8))
  return [
    ...win(by0 - bh * 0.5, by1 + bh * 0.5),
    ...win(by0 - bh * 0.9, by1 + bh * 0.9),
    ...win(by0 - bh * 1.1, by1 - bh * 0.1),
    ...win(by0 + bh * 0.1, by1 + bh * 1.1),
  ].filter(shaped)
}

/** Lines of the intended text whose pixels show 1-2 fewer word gaps than the line has words. */
export async function findSqueezedLines(png: Buffer, seen: SlideReadBack, expected: string[], sharp: SharpLike): Promise<string[]> {
  const exp = (expected || []).map((s) => normWords(s).join(' ')).filter(Boolean)
  const lines = seen && Array.isArray(seen.lines) ? seen.lines : []
  const problems: string[] = []
  let gray: Gray | null = null
  for (const l of lines) {
    const text = String(l?.text || '').trim()
    const tokens = text.split(/\s+/).filter((t) => /[a-z0-9]/i.test(t))
    if (tokens.length < 2 || !l.box) continue
    const nw = normWords(text).join(' ')
    if (!nw || !exp.some((e) => ` ${e} `.includes(` ${nw} `))) continue
    let rows: Row[] | null = null
    try {
      if (!gray) gray = await grayPixels(png, sharp)
      rows = wordGroupsNear(gray, l.box, text.length)
    } catch { rows = null }
    if (!rows || !rows.length) continue
    const groups = Math.max(...rows.map((r) => r.groups))
    const short = tokens.length - groups
    if (short >= 1 && short <= 2) problems.push(`words run together: "${text}" is drawn as ${groups} word${groups === 1 ? '' : 's'}, not ${tokens.length}`)
  }
  return problems
}

// ── Reading the slide ───────────────────────────────────────────────────────

type GeminiAnswer = { candidates?: { content?: { parts?: { text?: string }[] } }[]; error?: { message?: string } }

export function parseVisionAnswer(json: GeminiAnswer): SlideReadBack {
  const parts = json?.candidates?.[0]?.content?.parts || []
  const text = parts.map((p) => (typeof p?.text === 'string' ? p.text : '')).join('').trim()
  if (!text) throw new Error('vision answered with no text')
  const parsed = JSON.parse(text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')) as unknown
  const raw = Array.isArray(parsed) ? parsed : Array.isArray((parsed as { lines?: unknown })?.lines) ? (parsed as { lines: unknown[] }).lines : null
  if (!raw) throw new Error('vision answer had no lines')
  return {
    lines: raw.map((l) => {
      if (typeof l === 'string') return { text: l, box: null }
      const o = (l || {}) as { text?: unknown; box_2d?: unknown }
      return { text: String(o.text || ''), box: Array.isArray(o.box_2d) && o.box_2d.length === 4 ? o.box_2d.map(Number) : null }
    }),
  }
}

async function loadSharp(): Promise<SharpLike> {
  return (await import('sharp')).default as unknown as SharpLike
}

/** Read every line of text on a slide (Gemini 2.5 Flash, plain REST). Throws on any trouble. */
export async function readSlideText(png: Buffer, opts: { apiKey?: string; timeoutMs?: number; sharp?: SharpLike } = {}): Promise<SlideReadBack> {
  const key = opts.apiKey || process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY is not set')
  let img: { data: Buffer; mime: string } = { data: png, mime: 'image/png' }
  try { img = { data: await (opts.sharp || (await loadSharp()))(png).resize(1600, 900, { fit: 'inside' }).jpeg({ quality: 85 }).toBuffer(), mime: 'image/jpeg' } } catch { /* send as is */ }
  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    signal: AbortSignal.timeout(opts.timeoutMs || CHECK_TIMEOUT_MS),
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ inline_data: { mime_type: img.mime, data: img.data.toString('base64') } }, { text: VISION_PROMPT }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json', maxOutputTokens: 2048, mediaResolution: 'MEDIA_RESOLUTION_HIGH', thinkingConfig: { thinkingBudget: 0 } },
    }),
  })
  const json = (await res.json().catch(() => ({}))) as GeminiAnswer
  if (!res.ok) throw new Error(`vision ${res.status}: ${String(json?.error?.message || '').slice(0, 160)}`)
  return parseVisionAnswer(json)
}

type CheckOpts = { log?: (m: string) => void; read?: (png: Buffer) => Promise<SlideReadBack>; sharp?: SharpLike }

/** Check one slide. Null = could not be checked → the caller ACCEPTS the slide. */
export async function checkSlide(png: Buffer, expected: string[], opts: CheckOpts = {}): Promise<CheckResult | null> {
  if (!expected?.length) return null
  const log = opts.log || ((m: string) => console.warn(m))
  let seen: SlideReadBack
  try {
    seen = await (opts.read ? opts.read(png) : readSlideText(png, { sharp: opts.sharp }))
  } catch (e) {
    log(`[spellcheck] could not read the slide (${e instanceof Error ? e.message : e}) — accepting it`)
    return null
  }
  const words = compareSlideText(expected, seen)
  let squeezed: string[] = []
  try { squeezed = await findSqueezedLines(png, seen, expected, opts.sharp || (await loadSharp())) } catch { squeezed = [] }
  const problems = words.problems.some((p) => p.startsWith('words run together')) ? words.problems : [...words.problems, ...squeezed]
  return { ok: problems.length === 0, problems, seen }
}

export type DrawCheckedResult = { buf: Buffer | null; redrawn: boolean; problems: string[]; checked: boolean }

/** Draw → check → (on fail) redraw once → check → keep the better one. Mirror of the render-service drawChecked. */
export async function drawChecked(o: {
  expected: string[]
  draw: (attempt: 1 | 2) => Promise<Buffer | null>
  check?: (png: Buffer, expected: string[], opts: { log: (m: string) => void }) => Promise<CheckResult | null>
  canRedraw?: () => boolean
  log?: (m: string) => void
  label?: string
}): Promise<DrawCheckedResult> {
  const log = o.log || ((m: string) => console.warn(m))
  const label = o.label || 'slide'
  const check = o.check || ((png: Buffer, exp: string[], opts: { log: (m: string) => void }) => checkSlide(png, exp, opts))
  const first = await o.draw(1)
  if (!first) return { buf: null, redrawn: false, problems: [], checked: false }
  if (!o.expected?.length) return { buf: first, redrawn: false, problems: [], checked: false }
  const r1 = await check(first, o.expected, { log })
  if (!r1) return { buf: first, redrawn: false, problems: [], checked: false }
  if (r1.ok) return { buf: first, redrawn: false, problems: [], checked: true }
  if (o.canRedraw && !o.canRedraw()) {
    log(`[spellcheck] ${label}: ${r1.problems.join('; ')} — no time to redraw, keeping it`)
    return { buf: first, redrawn: false, problems: r1.problems, checked: true }
  }
  log(`[spellcheck] ${label}: ${r1.problems.join('; ')} — redrawing once`)
  let second: Buffer | null = null
  try { second = await o.draw(2) } catch (e) { log(`[spellcheck] ${label}: redraw failed (${e instanceof Error ? e.message : e})`) }
  if (!second) {
    log(`[spellcheck] ${label}: no redraw — keeping the first picture`)
    return { buf: first, redrawn: false, problems: r1.problems, checked: true }
  }
  const r2 = await check(second, o.expected, { log })
  if (!r2) return { buf: second, redrawn: true, problems: [], checked: false }
  if (r2.ok) { log(`[spellcheck] ${label}: redraw passed`); return { buf: second, redrawn: true, problems: [], checked: true } }
  const keepSecond = r2.problems.length < r1.problems.length
  const best = keepSecond ? r2 : r1
  log(`[spellcheck] ${label}: STILL WRONG after redraw — keeping the ${keepSecond ? 'redraw' : 'first picture'} (${best.problems.length} problem(s): ${best.problems.join('; ')})`)
  return { buf: keepSecond ? second : first, redrawn: keepSecond, problems: best.problems, checked: true }
}
