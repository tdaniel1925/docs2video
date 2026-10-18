// =============================================================================
// SLIDE SPELL-CHECK — "Drawn slides" only. The image model sometimes drops a
// word ("…if something happens to" with no "you") or squeezes two together
// ("toyou"). After a slide is drawn we READ IT BACK and compare it with the
// words we asked for.
//
//   pass            → keep it
//   fail            → redraw ONCE (same prompt; a slide drawn with a style
//                     reference is redrawn WITHOUT it — the near-copy layout
//                     is what squeezed "to you"), check again
//   still failing   → keep whichever had fewer problems, log it. Never fails
//                     the video.
//   can't check     → (vision error / timeout / no key) accept the slide.
//
// HOW IT READS THE SLIDE (two parts):
//   1. Gemini 2.5 Flash transcribes every line of text AND where each line is
//      (a box). Missing / wrong words and numbers are found by comparing the
//      transcript with the intended words (forgiving case, punctuation,
//      spacing, $ and thousands commas).
//   2. Squeezed words: Flash reads "toyou" as "to you" like a person would
//      (measured 2026-10-09: it did, even when asked about gaps), so CODE
//      measures it: inside each line's box, the empty pixel columns between
//      ink are the gaps; letter gaps are tiny, word gaps are wide (measured on
//      the test slides: letters 1-5px, words 11-19px, "toyou" 2-4px on a ~50px
//      line). Fewer wide gaps than the transcript has spaces = words run together.
//
// Pure + no packages (plain fetch to the Gemini REST API; sharp to shrink /
// measure the picture). The app's free preview uses the TypeScript mirror in
// app/_lib/slide-spellcheck.ts — KEEP THE TWO IN SYNC (tests/drawn-spellcheck
// .test.ts runs the same cases through both).
//
// COST per check (Gemini 2.5 Flash, thinking off, $0.30/M in, $2.50/M out;
// measured usage 2026-10-09 at HIGH media resolution): ~1,800 image tokens +
// ~250 prompt tokens in, ~150-300 tokens out ≈ 0.06c + 0.06c ≈ 0.1c per
// check, ~1-2 s. A failed slide adds one fal redraw (~0.3c) + one more check.
// A 12-slide video adds ≈ 1.2c when every slide passes.
// =============================================================================

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
const CHECK_TIMEOUT_MS = 20000

const VISION_PROMPT = [
  'Transcribe EVERY line of text visible in this image, exactly as it is drawn, letter for letter.',
  'Do NOT correct spelling. Do NOT add or guess words that are not visibly there.',
  'Keep $ signs, commas and decimal points in numbers exactly as drawn.',
  'For each line also give its bounding box as box_2d [ymin, xmin, ymax, xmax], normalised 0-1000, tight around that line\'s letters.',
  'Answer ONLY with JSON: {"lines": [{"text": "first line", "box_2d": [ymin, xmin, ymax, xmax]}, ...]} — top to bottom, left to right.',
].join(' ')

// ── What the slide was meant to say ─────────────────────────────────────────

/**
 * The words a drawn-slide prompt asks for, read back out of the prompt that
 * app/_lib/drawn-slides.ts drawnSlidePrompt built (HEADLINE / SUBTITLE /
 * BIG NUMBER … with the small label … / BULLET lines). The render service
 * only receives prompts, so this is how it knows the intended words.
 */
function expectedFromPrompt(prompt) {
  const out = []
  for (const line of String(prompt || '').split('\n')) {
    if (!/^(HEADLINE|SUBTITLE|BIG NUMBER|BULLET):/.test(line.trim())) continue
    for (const m of line.matchAll(/"([^"]*)"/g)) if (m[1].trim()) out.push(m[1].trim())
  }
  return out
}

// ── The forgiving compare ───────────────────────────────────────────────────

/** Words, forgiving case, punctuation, spacing, $ and thousands commas. */
function normWords(s) {
  return String(s || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['‘’`´]/g, '')            // "Let’s" = "Lets" = "let's"
    .replace(/(\d),(?=\d{3}\b)/g, '$1')  // 500,000 → 500000
    .replace(/\$/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
}

/** The read-back as plain lines (accepts the parsed answer or a bare string[]). */
function linesOf(seen) {
  if (Array.isArray(seen)) return seen.map((l) => (typeof l === 'string' ? l : String((l && l.text) || '')))
  return seen && Array.isArray(seen.lines) ? linesOf(seen.lines) : []
}

/**
 * Compare the intended strings with the lines read off the slide.
 * Problems: a word (or number) that is not on the slide, or two neighbouring
 * words written joined in the read-back ("toyou"). Extra words on the slide
 * (decoration, a "65" badge) are not judged here.
 * @returns {{ ok: boolean, problems: string[] }}
 */
function compareSlideText(expected, seen) {
  const items = (expected || []).map((s) => ({ raw: s, words: normWords(s) })).filter((i) => i.words.length)
  const seenWords = normWords(linesOf(seen).join(' \n '))
  const left = new Map()
  for (const w of seenWords) left.set(w, (left.get(w) || 0) + 1)
  const take = (w) => { const n = left.get(w) || 0; if (n > 0) { left.set(w, n - 1); return true } return false }
  const expectedSet = new Set(items.flatMap((i) => i.words))
  const problems = []

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

/** A word gap is an empty run of pixel columns at least this share of the text height. */
const WORD_GAP_OF_HEIGHT = 0.16
/** Rough width of one character as a share of a text row's height (measured on the test slides: 0.48-0.64). */
const CHAR_ASPECT = 0.55

/** The slide as one byte per pixel (greyscale). */
async function grayPixels(png, sharp) {
  const { data, info } = await sharp(png).greyscale().raw().toBuffer({ resolveWithObject: true })
  if (info.channels !== 1) throw new Error('greyscale decode gave ' + info.channels + ' channels')
  return { data, width: info.width, height: info.height }
}

/** Word-groups per text row inside one window of a greyscale image. */
function rowsInWindow(img, W, top, bottom, left, right) {
  const w = right - left, h = bottom - top
  if (w < 8 || h < 6) return []
  const px = (x, y) => img[(top + y) * W + left + x]
  // Otsu threshold over the window; the ink is the smaller side.
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
  const isInk = (x, y) => (inkIsDark ? px(x, y) <= th : px(x, y) > th)
  // Text rows: runs of pixel rows that hold ink.
  const rowHasInk = new Array(h).fill(false)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (isInk(x, y)) { rowHasInk[y] = true; break }
  const out = []
  for (let y = 0; y < h;) {
    if (!rowHasInk[y]) { y++; continue }
    const s = y
    while (y < h && rowHasInk[y]) y++
    // A row touching the window's top or bottom edge was cut by the window
    // (half-letters look like many separate words) — only whole rows count.
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

/**
 * Word-groups per text row near one line, from its pixels. The vision model's
 * boxes are rough (measured 2026-10-09: off by up to half a line, or
 * swallowing the number above), so several windows are measured — the box
 * with half a box-height above and below, a taller strip, and the box
 * stretched up and stretched down — each a little wider than the box. In
 * each window ink is split from background (Otsu), the window is cut into
 * text rows (runs of rows with ink), and in each row the runs of empty
 * columns wider than WORD_GAP_OF_HEIGHT × the row's height are word gaps.
 * `gray` is the slide as greyscale pixels (grayPixels). `chars` = the
 * line's length, for the width check.
 * Returns [{ height, width, groups }] for every fitting text row, or null.
 */
function wordGroupsNear(gray, box, chars = 0) {
  if (!Array.isArray(box) || box.length !== 4 || box.some((n) => typeof n !== 'number' || !isFinite(n))) return null
  const [y0, x0, y1, x1] = box
  if (y1 <= y0 || x1 <= x0) return null
  const img = gray.data, W = gray.width, H = gray.height
  if (!W || !H) return null
  const by0 = y0 * H / 1000, by1 = y1 * H / 1000, bh = by1 - by0
  const left = Math.max(0, Math.round(x0 * W / 1000 - W * 0.03))
  const right = Math.min(W, Math.round(x1 * W / 1000 + W * 0.03))
  const win = (a, b) => rowsInWindow(img, W, Math.max(0, Math.round(a)), Math.min(H, Math.round(b)), left, right)
  // Only rows shaped like THIS line count: about one line tall (two lines
  // merged into one row, or a sliver of decoration, would give a wrong count)
  // and about as wide as its characters (a short number above it is not it).
  const shaped = (r) => r.height >= bh * 0.3 && r.height <= bh * 1.6 &&
    (!chars || (r.width / r.height >= chars * CHAR_ASPECT * 0.7 && r.width / r.height <= chars * CHAR_ASPECT * 1.8))
  return [
    ...win(by0 - bh * 0.5, by1 + bh * 0.5),
    ...win(by0 - bh * 0.9, by1 + bh * 0.9),
    ...win(by0 - bh * 1.1, by1 - bh * 0.1),
    ...win(by0 + bh * 0.1, by1 + bh * 1.1),
  ].filter(shaped)
}

/**
 * Lines that should be several words but whose pixels show fewer word gaps
 * ("happens toyou"). Only lines that are part of the intended text are
 * measured (decoration is ignored). Forgiving on purpose, because the boxes
 * are rough: a line passes when ANY text row near its box has at least as
 * many word groups as the line has words; it is flagged only when the best
 * row there is short by 1-2 (a squeeze), never by 3+ (a bad box / busy art).
 */
async function findSqueezedLines(png, seen, expected, sharp) {
  const exp = (expected || []).map((s) => normWords(s).join(' ')).filter(Boolean)
  const lines = seen && Array.isArray(seen.lines) ? seen.lines : []
  const problems = []
  let gray = null
  for (const l of lines) {
    const text = String((l && l.text) || '').trim()
    const tokens = text.split(/\s+/).filter((t) => /[a-z0-9]/i.test(t))
    if (tokens.length < 2 || !l.box) continue
    const nw = normWords(text).join(' ')
    if (!nw || !exp.some((e) => ` ${e} `.includes(` ${nw} `))) continue
    let rows = null
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

/** Parse the vision model's answer into { lines: [{ text, box }] }. Throws when unusable. */
function parseVisionAnswer(json) {
  const parts = (json && json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts) || []
  const text = parts.map((p) => (p && typeof p.text === 'string' ? p.text : '')).join('').trim()
  if (!text) throw new Error('vision answered with no text')
  const parsed = JSON.parse(text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, ''))
  const raw = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.lines) ? parsed.lines : null
  if (!raw) throw new Error('vision answer had no lines')
  return {
    lines: raw.map((l) => (typeof l === 'string'
      ? { text: l, box: null }
      : { text: String((l && l.text) || ''), box: l && Array.isArray(l.box_2d) && l.box_2d.length === 4 ? l.box_2d.map(Number) : null })),
  }
}

async function shrinkForVision(png, sharp) {
  try {
    return { data: await sharp(png).resize(1600, 900, { fit: 'inside' }).jpeg({ quality: 85 }).toBuffer(), mime: 'image/jpeg' }
  } catch {
    return { data: png, mime: 'image/png' }
  }
}

/** Read every line of text on a slide (Gemini 2.5 Flash, plain REST). Throws on any trouble. */
async function readSlideText(png, opts = {}) {
  const key = opts.apiKey || process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY is not set')
  const img = await shrinkForVision(png, opts.sharp || require('sharp'))
  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    signal: AbortSignal.timeout(opts.timeoutMs || CHECK_TIMEOUT_MS),
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ inline_data: { mime_type: img.mime, data: img.data.toString('base64') } }, { text: VISION_PROMPT }] }],
      // HIGH media resolution: sharper line boxes for the gap measurement.
      generationConfig: { temperature: 0, responseMimeType: 'application/json', maxOutputTokens: 2048, mediaResolution: 'MEDIA_RESOLUTION_HIGH', thinkingConfig: { thinkingBudget: 0 } },
    }),
  })
  const json = await res.json().catch(() => ({}))
  if (opts.onUsage && json.usageMetadata) opts.onUsage(json.usageMetadata)
  if (!res.ok) throw new Error(`vision ${res.status}: ${String((json.error && json.error.message) || '').slice(0, 160)}`)
  return parseVisionAnswer(json)
}

/**
 * Check one slide. Returns { ok, problems, seen } — or null when it could not
 * be checked (the caller then ACCEPTS the slide; a check never blocks a video).
 * opts.read replaces the Gemini call (tests).
 */
async function checkSlide(png, expected, opts = {}) {
  if (!expected || !expected.length) return null
  const log = opts.log || ((m) => console.warn(m))
  let seen
  try {
    seen = await (opts.read || readSlideText)(png, opts)
  } catch (e) {
    log(`[spellcheck] could not read the slide (${e && e.message ? e.message : e}) — accepting it`)
    return null
  }
  const words = compareSlideText(expected, seen)
  let squeezed = []
  try { squeezed = await findSqueezedLines(png, seen, expected, opts.sharp || require('sharp')) } catch { squeezed = [] }
  // A pair already reported as run together by the transcript isn't counted twice.
  const problems = words.problems.some((p) => p.startsWith('words run together')) ? words.problems : [...words.problems, ...squeezed]
  return { ok: problems.length === 0, problems, seen }
}

/**
 * Draw → check → (on fail) redraw once → check → keep the better one.
 * @param {{ expected: string[], draw: (attempt: 1|2) => Promise<Buffer|null>,
 *           check?: (png: Buffer, expected: string[], opts: object) => Promise<{ok:boolean, problems:string[]}|null>,
 *           canRedraw?: () => boolean, log?: (msg: string) => void, label?: string }} o
 *   draw: attempt 2 is the redraw (callers drop the style reference there).
 *         Null / throw on attempt 1 = no picture (caller falls back);
 *         on attempt 2 = keep the first picture.
 *   canRedraw: false skips the redraw (e.g. the free preview is out of time).
 * @returns {Promise<{ buf: Buffer|null, redrawn: boolean, problems: string[], checked: boolean }>}
 */
async function drawChecked(o) {
  const log = o.log || ((m) => console.warn(m))
  const label = o.label || 'slide'
  const check = o.check || checkSlide
  const first = await o.draw(1)
  if (!first) return { buf: null, redrawn: false, problems: [], checked: false }
  if (!o.expected || !o.expected.length) return { buf: first, redrawn: false, problems: [], checked: false }
  const r1 = await check(first, o.expected, { log })
  if (!r1) return { buf: first, redrawn: false, problems: [], checked: false }
  if (r1.ok) return { buf: first, redrawn: false, problems: [], checked: true }
  if (o.canRedraw && !o.canRedraw()) {
    log(`[spellcheck] ${label}: ${r1.problems.join('; ')} — no time to redraw, keeping it`)
    return { buf: first, redrawn: false, problems: r1.problems, checked: true }
  }
  log(`[spellcheck] ${label}: ${r1.problems.join('; ')} — redrawing once`)
  let second = null
  try { second = await o.draw(2) } catch (e) { log(`[spellcheck] ${label}: redraw failed (${e && e.message ? e.message : e})`) }
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

module.exports = {
  expectedFromPrompt, normWords, compareSlideText, grayPixels, wordGroupsNear, findSqueezedLines,
  parseVisionAnswer, readSlideText, checkSlide, drawChecked, VISION_PROMPT, GEMINI_URL, WORD_GAP_OF_HEIGHT,
}
