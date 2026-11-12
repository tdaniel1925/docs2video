'use strict'
/**
 * WALK-THROUGH — the "Walk-through" video style (videoStyle 'walkthrough').
 *
 * The client's own PDF (a quote, an illustration, a policy summary) IS the
 * picture: every scene shows one real page, the camera glides to the spot the
 * voice is talking about, a gold box draws around it, and a card lifts the
 * figure out (count-up, range, before/after, short list). Remotion
 * composition: remotion/src/walkthrough/WalkthroughVideo.tsx.
 *
 * Steps (all here, called by POST /generate-walkthrough in server.js):
 *   readPdf()        pages → PNG (2400 px wide), every text line with its box,
 *                    every picture with its box (poppler, already in the image)
 *   hideOnPages()    blur what a client video must never show: insurer and
 *                    product names, the client's name and personal numbers,
 *                    small logos in the page margins. Hidden lines are never
 *                    pointed at.
 *   planWalkthrough() one Claude call picks, per scene, the page, the lines to
 *                    box and the card; checked in code (pages/lines exist,
 *                    every figure on a card is printed in the document, short
 *                    words, compliance scrub). Any scene it gets wrong falls
 *                    back to a plain match (fallbackShot) — never a failure.
 */
const { execFile } = require('child_process')
const { readFile, readdir, mkdir, rm } = require('fs/promises')
const { join } = require('path')

const PAGE_PX = 2400
const MAX_PAGES = 40
const run = (cmd, args, opts = {}) => new Promise((resolve, reject) =>
  execFile(cmd, args, { timeout: 120000, maxBuffer: 64 << 20, ...opts }, (e, stdout, stderr) => (e ? reject(new Error(`${cmd}: ${(stderr || e.message || '').toString().slice(0, 300)}`)) : resolve(stdout))))

const decode = (s) => String(s).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")

/** Lines with boxes from `pdftotext -bbox-layout` XHTML, per page, in PDF points. */
function parseBboxLayout(xhtml) {
  const pages = []
  const pageRe = /<page width="([\d.]+)" height="([\d.]+)">([\s\S]*?)<\/page>/g
  let pm
  while ((pm = pageRe.exec(xhtml))) {
    const lines = []
    const lineRe = /<line xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([\s\S]*?)<\/line>/g
    let lm
    while ((lm = lineRe.exec(pm[3]))) {
      const words = [...lm[5].matchAll(/<word[^>]*>([\s\S]*?)<\/word>/g)].map((w) => decode(w[1]).trim()).filter(Boolean)
      if (!words.length) continue
      lines.push({ x0: +lm[1], y0: +lm[2], x1: +lm[3], y1: +lm[4], text: words.join(' ') })
    }
    pages.push({ w: +pm[1], h: +pm[2], lines })
  }
  return pages
}

/** Pictures with boxes from `pdftohtml -xml`, per page number, in that page's own units. */
function parseImagesXml(xml) {
  const out = {}
  const pageRe = /<page number="(\d+)"[^>]*height="([\d.]+)" width="([\d.]+)">([\s\S]*?)<\/page>/g
  let pm
  while ((pm = pageRe.exec(xml))) {
    const imgs = [...pm[4].matchAll(/<image top="(-?[\d.]+)" left="(-?[\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)].map((m) => ({ top: +m[1], left: +m[2], w: +m[3], h: +m[4] }))
    out[+pm[1]] = { w: +pm[3], h: +pm[2], imgs }
  }
  return out
}

/**
 * Pages as pictures + text lines + pictures, all in the 2400-px-wide page
 * picture's own pixels. Throws a plain-words error for a PDF it can't read.
 */
async function readPdf(pdfFile, workDir) {
  await mkdir(workDir, { recursive: true })
  const info = await run('pdfinfo', [pdfFile]).catch(() => '')
  const count = Math.min(MAX_PAGES, parseInt((String(info).match(/Pages:\s+(\d+)/) || [])[1] || '0', 10))
  if (!count) throw new Error('We could not open the pages of this PDF.')
  await run('pdftoppm', ['-png', '-f', '1', '-l', String(count), '-scale-to-x', String(PAGE_PX), '-scale-to-y', '-1', pdfFile, join(workDir, 'pg')], { timeout: 300000 })
  const pngs = (await readdir(workDir)).filter((f) => /^pg-\d+\.png$/.test(f)).sort((a, b) => parseInt(a.slice(3), 10) - parseInt(b.slice(3), 10))
  const layout = parseBboxLayout(await run('pdftotext', ['-bbox-layout', '-f', '1', '-l', String(count), pdfFile, '-']))
  let images = {}
  try {
    await run('pdftohtml', ['-xml', '-q', '-f', '1', '-l', String(count), pdfFile, join(workDir, 'imgs')])
    images = parseImagesXml(await readFile(join(workDir, 'imgs.xml'), 'utf8'))
  } catch { /* no picture boxes: margin fallback below still covers logos */ }
  const sharp = require('sharp')
  const pages = []
  for (let i = 0; i < pngs.length; i++) {
    const n = i + 1
    const file = join(workDir, pngs[i])
    const meta = await sharp(file).metadata()
    const lay = layout[i] || { w: 612, h: 792, lines: [] }
    const k = meta.width / lay.w
    const lines = lay.lines.map((l, j) => ({
      id: `p${n}l${j}`, text: l.text,
      x: Math.round(l.x0 * k), y: Math.round(l.y0 * k), w: Math.max(1, Math.round((l.x1 - l.x0) * k)), h: Math.max(1, Math.round((l.y1 - l.y0) * k)),
    }))
    const im = images[n]
    const ik = im ? meta.width / im.w : 1
    const imgs = im ? im.imgs.map((g) => ({ x: Math.round(g.left * ik), y: Math.round(g.top * ik), w: Math.round(g.w * ik), h: Math.round(g.h * ik) })) : []
    pages.push({ n, file, w: meta.width, h: meta.height, lines, imgs, imgBoxesKnown: !!im })
  }
  return pages
}

// ---------------------------------------------------------------------------
// What a client video must never show
// ---------------------------------------------------------------------------
const PERSONAL_RE = /\b(client name|insured name|owner name|name of insured|prepared for|designed for|date of birth|birth ?date|d\.?o\.?b\.?|social security|ssn|policy (?:number|no\.?|#)|contract (?:number|no\.?|#)|account (?:number|no\.?|#)|member id)\b|\b\d{3}-\d{2}-\d{4}\b/i
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** One test for every word that must be hidden (whole words, any case). */
function hideMatcher(terms) {
  const clean = [...new Set((terms || []).map((t) => String(t || '').trim()).filter((t) => t.length >= 3))]
  if (!clean.length) return () => false
  const re = new RegExp(`(^|[^a-z0-9])(${clean.map(escapeRe).join('|')})(?=$|[^a-z0-9])`, 'i')
  return (text) => re.test(text)
}

/** The client's name as words to hide (each part of 3+ letters too: "IMTIAZ ALI" → imtiaz). */
function nameTerms(name) {
  const n = String(name || '').trim()
  if (!n) return []
  const parts = n.split(/\s+/).filter((p) => p.length >= 3 && !/^(mr|mrs|ms|dr|the|and)$/i.test(p))
  return [n, ...parts]
}

/**
 * Blur, in place on each page picture, every line that names an insurer,
 * product or the client or carries personal numbers, and every small picture
 * in the page margins (logos). Marks those lines hidden. When the picture
 * boxes are unknown, the top and bottom margins are blurred instead.
 */
/**
 * Short names a document uses for an insurer it also names in full:
 * "American General Life Insurance Company" → AGL, AGLI, AGLIC. ("AGL does
 * not solicit…" was left showing on the first live test page.)
 */
function initialsFor(pages, isNamed) {
  const out = new Set()
  for (const p of pages) for (const l of p.lines) {
    if (!isNamed(l.text)) continue
    for (const run of l.text.match(/(?:[A-Z][A-Za-z&]+\s+){1,6}[A-Z][A-Za-z&]+/g) || []) {
      if (!isNamed(run)) continue
      const caps = run.split(/\s+/).map((w) => w[0]).join('')
      for (let k = 3; k <= caps.length; k++) out.add(caps.slice(0, k))
    }
  }
  return [...out]
}
/** A trademark sign marks a product or company slogan ("Quality of Life… Insurance®"). */
const MARK_RE = /[®™℠]|\(R\)|\bTM\b/

/** Words on a card never name an insurer, product or the client: those words are taken out. */
function makeScrub(terms, clientName) {
  const clean = [...new Set([...(terms || []), ...nameTerms(clientName)].map((x) => String(x || '').trim()).filter((x) => x.length >= 3))]
  if (!clean.length) return (s) => s
  const re = new RegExp(`(^|[^a-z0-9])(${clean.map(escapeRe).join('|')})(?=$|[^a-z0-9])`, 'gi')
  const tidy = (t) => t.replace(/[®™℠]/g, '').replace(/\s{2,}/g, ' ').replace(/\s+([,.;:])/g, '$1').replace(/^[\s,.;:–—-]+/, '').trim()
  // Twice: removing one name can leave the next one at a new word edge ("Imtiaz Ali").
  return (s) => tidy(String(s || '').replace(re, '$1').replace(re, '$1'))
}

async function hideOnPages(pages, { terms = [], clientName = '' } = {}) {
  const sharp = require('sharp')
  const named = hideMatcher(terms)
  const isHidden = hideMatcher([...terms, ...initialsFor(pages, named), ...nameTerms(clientName)])
  const report = []
  for (const p of pages) {
    const regions = []
    for (const l of p.lines) {
      if (isHidden(l.text) || PERSONAL_RE.test(l.text) || MARK_RE.test(l.text)) { l.hidden = true; regions.push({ x: l.x - 10, y: l.y - 6, w: l.w + 20, h: l.h + 12 }) }
    }
    const area = p.w * p.h
    if (p.imgBoxesKnown) {
      for (const g of p.imgs) {
        const small = g.w * g.h < area * 0.06
        const inMargin = g.y < p.h * 0.16 || g.y + g.h > p.h * 0.86
        if (small && inMargin) regions.push({ x: g.x - 12, y: g.y - 12, w: g.w + 24, h: g.h + 24 })
      }
    } else {
      regions.push({ x: 0, y: 0, w: p.w, h: Math.round(p.h * 0.07) }, { x: 0, y: Math.round(p.h * 0.94), w: p.w, h: Math.round(p.h * 0.06) })
    }
    const comps = []
    for (const r0 of regions) {
      const x = Math.max(0, Math.round(r0.x)), y = Math.max(0, Math.round(r0.y))
      const w = Math.min(p.w - x, Math.round(r0.w)), h = Math.min(p.h - y, Math.round(r0.h))
      if (w < 2 || h < 2) continue
      const piece = await sharp(p.file).extract({ left: x, top: y, width: w, height: h }).blur(Math.max(8, Math.min(28, h / 3))).toBuffer()
      comps.push({ input: piece, left: x, top: y })
    }
    if (comps.length) {
      const buf = await sharp(p.file).composite(comps).png().toBuffer()
      await require('fs/promises').writeFile(p.file, buf)
    }
    report.push({ page: p.n, blurred: comps.length })
  }
  return report
}

// ---------------------------------------------------------------------------
// The plan: which page, which lines, which card — per scene
// ---------------------------------------------------------------------------
const CARD_TYPES = ['figure', 'range', 'compare', 'chips', 'statement']
const digitsOf = (s) => String(s || '').replace(/[^0-9]/g, '')
/** Every number written on a card (as digits, cents kept), e.g. "$1,000,000.00" → "100000000"/"1000000". */
const numbersIn = (s) => (String(s || '').match(/\d[\d,]*(?:\.\d+)?/g) || []).map((n) => n.replace(/,/g, ''))
const clip = (s, n) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : t }

/** The document's numbers, in every way a card might write them. */
function docNumberSet(pages) {
  const set = new Set()
  for (const p of pages) for (const l of p.lines) for (const n of numbersIn(l.text)) {
    set.add(n); set.add(n.replace(/\.0+$/, '')); set.add(n.replace(/\.\d+$/, ''))
  }
  return set
}
/** True when every number on the card is printed in the document (cents optional; 20 years / age 62 count too). */
function cardNumbersOk(card, docNums) {
  const texts = []
  const walk = (v) => { if (typeof v === 'string') texts.push(v); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') Object.values(v).forEach(walk) }
  walk(card)
  for (const t of texts) for (const n of numbersIn(t)) {
    if (!docNums.has(n) && !docNums.has(n.replace(/\.0+$/, '')) && !docNums.has(n.replace(/\.\d+$/, ''))) return false
  }
  return true
}

function cleanCard(card, scrub) {
  if (!card || typeof card !== 'object' || !CARD_TYPES.includes(card.type)) return null
  const s = (v, n) => { const t = clip(v, n); return scrub ? scrub(t) : t }
  const eyebrow = s(card.eyebrow, 40)
  switch (card.type) {
    case 'figure': { const value = s(card.value, 22); return value ? { type: 'figure', eyebrow, value, unit: s(card.unit, 22), note: s(card.note, 90) } : null }
    case 'range': { const low = s(card.low, 18), high = s(card.high, 18); return low && high ? { type: 'range', eyebrow, low, high, note: s(card.note, 90) } : null }
    case 'compare': {
      const side = (x) => (x && typeof x === 'object' ? { label: s(x.label, 24), value: s(x.value, 18), sub: s(x.sub, 30) } : null)
      const a = side(card.a), b = side(card.b)
      return a && b && a.value && b.value ? { type: 'compare', eyebrow, a, b } : null
    }
    case 'chips': { const items = (Array.isArray(card.items) ? card.items : []).map((x) => s(x, 28)).filter(Boolean).slice(0, 3); return items.length ? { type: 'chips', eyebrow, title: s(card.title, 60), items } : null }
    case 'statement': { const text = s(card.text, 90); return text ? { type: 'statement', eyebrow, text } : null }
  }
  return null
}

const words = (t) => String(t || '').toLowerCase().match(/[a-z0-9$%.,]+/g) || []
const STOP = new Set('the a an and or of to in on for is are be it this that your you with at by as from can will may not'.split(' '))

/** No usable answer for a scene: the page and line that share the most words with it, and a plain card. */
function fallbackShot(scene, pages, scrub) {
  const want = new Set(words(`${scene.narration} ${scene.title || ''} ${(scene.slideData && scene.slideData.headline) || ''}`).filter((w) => !STOP.has(w) && w.length > 2))
  const stats = (scene.slideData && Array.isArray(scene.slideData.stats)) ? scene.slideData.stats : []
  const statDigits = stats.map((x) => digitsOf(x && x.value)).filter((d) => d.length >= 2)
  let best = null
  for (const p of pages) for (const l of p.lines) {
    if (l.hidden || l.text.length < 3) continue
    let score = 0
    for (const w of words(l.text)) if (want.has(w)) score += 1
    const d = digitsOf(l.text)
    if (d && statDigits.some((sd) => d.includes(sd))) score += 6
    if (!best || score > best.score) best = { score, page: p.n, line: l }
  }
  const stat = stats.find((x) => x && x.value && statDigits.length)
  const card = stat
    ? cleanCard({ type: 'figure', eyebrow: stat.label || '', value: stat.value }, scrub)
    : cleanCard({ type: 'statement', eyebrow: '', text: (scene.slideData && scene.slideData.headline) || scene.title || '' }, scrub)
  return {
    page: best ? best.page : 1,
    lines: best && best.score > 0 ? withRowMates(pages.find((p) => p.n === best.page), [best.line.id]) : [],
    card, ringWord: null, cardWord: null, source: 'fallback',
  }
}

const PLAN_SYSTEM = `You direct a short video that walks a client through their own document, page by page.
For each scene you get the words the voice will say. You choose:
- page: the ONE page number that shows what the voice is talking about
- lines: 1 to 4 line ids ON THAT PAGE (next to each other) that hold the exact figure or sentence being discussed. A gold box will be drawn around them. Prefer the line with the number.
- ringWord: one word from the scene's narration, said when the box should appear
- card: a small card that lifts the key point off the page:
    {"type":"figure","eyebrow":"Your coverage","value":"$1,000,000","unit":"a month","note":"..."}   one key number
    {"type":"range","eyebrow":"At age 62","low":"$130,000","high":"$636,654","note":"A range, not a promise"}   a low-to-high range
    {"type":"compare","eyebrow":"...","a":{"label":"Years 1–20","value":"$1,000,000","sub":"$2,400.84 a year"},"b":{"label":"Year 21","value":"$61,999","sub":"$3,151.56 a year"}}   before vs after, or guaranteed vs projected
    {"type":"chips","eyebrow":"...","title":"...","items":["Cancer","Heart attack","Stroke"]}   up to 3 short items
    {"type":"statement","eyebrow":"...","text":"..."}   one plain sentence when there is no number
- cardWord: one word from the narration, said when the card should appear (usually the number's first word)
Rules:
- Every number on a card must be printed in the document exactly (you may drop cents or commas). Never invent, round or add numbers.
- Money keeps its $ and commas. Short words: eyebrow up to 5 words, values up to 14 characters.
- When the document shows guaranteed and non-guaranteed (projected/illustrated/current) values, a card about the projected one must say it is not guaranteed.
- Never use the name of an insurance company, product, or the client. Never use lines marked HIDDEN.
- Use different pages and cards across scenes when the document allows it.
Answer with JSON only: {"scenes":[{"i":0,"page":3,"lines":["p3l12"],"ringWord":"million","card":{...},"cardWord":"million"}, ...]}`

function pagesForPrompt(pages, maxLines = 1400) {
  const perPage = Math.max(40, Math.floor(maxLines / Math.max(1, pages.length)))
  return pages.map((p) => {
    const ls = p.lines.filter((l) => l.text.length >= 2).slice(0, perPage)
    return `=== PAGE ${p.n} ===\n` + ls.map((l) => `${l.id}${l.hidden ? ' HIDDEN' : ''}: ${l.text.slice(0, 110)}`).join('\n')
  }).join('\n')
}

/** The plan JSON from a model reply (tolerates fences and words around it). */
function parsePlanReply(text) {
  const t = String(text || '')
  const a = t.indexOf('{'), b = t.lastIndexOf('}')
  if (a < 0 || b <= a) return null
  try { const j = JSON.parse(t.slice(a, b + 1)); return Array.isArray(j.scenes) ? j.scenes : null } catch { return null }
}

/** Check one model answer for a scene; null when it can't be used as given. */
function checkShot(ans, scene, pages, docNums, scrub) {
  if (!ans || typeof ans !== 'object') return null
  const page = pages.find((p) => p.n === Number(ans.page))
  if (!page) return null
  const ids = (Array.isArray(ans.lines) ? ans.lines : []).map(String).slice(0, 4)
  const lines = ids.map((id) => page.lines.find((l) => l.id === id)).filter(Boolean)
  if (!lines.length || lines.some((l) => l.hidden)) return null
  const top = Math.min(...lines.map((l) => l.y)), bottom = Math.max(...lines.map((l) => l.y + l.h))
  if (bottom - top > page.h * 0.3) return null
  let card = cleanCard(ans.card, scrub)
  if (card && !cardNumbersOk(card, docNums)) card = null
  if (!card) card = fallbackShot(scene, pages, scrub).card
  const said = new Set(words(scene.narration).map((w) => w.replace(/[^a-z0-9-]/g, '')))
  const cue = (w) => { const x = String(w || '').toLowerCase().replace(/[^a-z0-9-]/g, ''); return x && said.has(x) ? x : null }
  return { page: page.n, lines: withRowMates(page, lines.map((l) => l.id)), card, ringWord: cue(ans.ringWord), cardWord: cue(ans.cardWord), source: 'plan' }
}

/**
 * The shot for every scene. `claude(system, user, maxTokens, opts)` is slides.claude.
 * Never throws: a failed or partial answer falls back scene by scene.
 */
async function planWalkthrough({ scenes, pages, claude, model, scrub, log = () => {} }) {
  const docNums = docNumberSet(pages)
  let answers = []
  if (claude) {
    const user = `DOCUMENT\n${pagesForPrompt(pages)}\n\nSCENES\n` + scenes.map((s, i) => `[${i}] ${s.title ? `(${s.title}) ` : ''}${s.narration}`).join('\n')
    try {
      const reply = await claude(PLAN_SYSTEM, user, 4000, { model })
      answers = parsePlanReply(typeof reply === 'string' ? reply : reply && reply.text) || []
    } catch (e) { log(`planner failed, plain matching instead: ${e.message}`) }
  }
  let planned = 0
  const shots = scenes.map((s, i) => {
    const got = checkShot(answers.find((a) => a && Number(a.i) === i), s, pages, docNums, scrub)
    if (got) { planned++; return got }
    return fallbackShot(s, pages, scrub)
  })
  log(`planned ${planned}/${scenes.length} scenes, ${scenes.length - planned} by plain matching`)
  return shots
}

/**
 * A label and its figure are often two separate pieces of text on one row
 * ("Death Benefit:" … "$500,000.00"). When none of the chosen lines has a
 * number, the numbers on the same row (to the right, not hidden) join them,
 * so the gold box goes round the figure and not just its label.
 */
function withRowMates(page, lineIds) {
  const chosen = (lineIds || []).map((id) => page.lines.find((l) => l.id === id)).filter(Boolean)
  if (!chosen.length || chosen.some((l) => /\d/.test(l.text))) return lineIds || []
  const extra = []
  for (const c of chosen) {
    const mid = c.y + c.h / 2
    for (const l of page.lines) {
      if (l.hidden || chosen.includes(l) || extra.includes(l) || !/\d/.test(l.text)) continue
      const sameRow = Math.abs(l.y + l.h / 2 - mid) < Math.max(c.h, l.h) * 0.5
      if (sameRow && l.x > c.x && l.x - (c.x + c.w) < 1100) extra.push(l)
    }
  }
  return [...chosen, ...extra].map((l) => l.id)
}

/** The box around a shot's lines, in page pixels (null when there are none). */
function ringBox(page, lineIds) {
  const ls = (lineIds || []).map((id) => page.lines.find((l) => l.id === id)).filter(Boolean)
  if (!ls.length) return null
  const x = Math.min(...ls.map((l) => l.x)), y = Math.min(...ls.map((l) => l.y))
  return { x, y, w: Math.max(...ls.map((l) => l.x + l.w)) - x, h: Math.max(...ls.map((l) => l.y + l.h)) - y }
}

async function cleanupWalk(dir) { if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {}) }

// Same timing as walkTimeline() in WalkthroughVideo.tsx (a test keeps them equal).
const WALK = { FPS: 30, LEAD: 0.35, GAP: 0.7, TAIL: 1.4, MUSIC: 'music/bed-warm-128.wav' }
function walkTimelineSec(voSecs) {
  const f = (x) => Math.round(x * WALK.FPS)
  let t = 0
  return voSecs.map((v, i) => {
    const len = f(WALK.LEAD) + f(Math.max(1.2, Number(v) || 0)) + f(i === voSecs.length - 1 ? WALK.TAIL : WALK.GAP)
    const a = t; t += len
    return { startSec: a / WALK.FPS, endSec: t / WALK.FPS }
  })
}

/**
 * Everything the composition needs, in <pub>/walk-<videoId>/: the pages it
 * shows (blurred, as JPEG), one voice clip per scene with word timings, and
 * the props. `scenes` are the approved story scenes; `cover`/`closing` carry
 * their own narration. deps: { claude, model, ttsTimed, tts, normalize, audioDurationSec, scrub }.
 */
async function prepareWalkthrough({ pub, videoId, pdfFile, scenes, cover, closing, hideTerms = [], clientName = '', voiceId, theme, deps, log = () => {} }) {
  const sharp = require('sharp')
  const dirName = `walk-${String(videoId).replace(/[^a-zA-Z0-9-]/g, '')}`
  const dir = join(pub, dirName), work = join(dir, '_work')
  await mkdir(dir, { recursive: true })
  const pages = await readPdf(pdfFile, work)
  const blurred = await hideOnPages(pages, { terms: hideTerms, clientName })
  log(`${pages.length} pages read, ${blurred.reduce((a, b) => a + b.blurred, 0)} areas blurred`)
  const shots = await planWalkthrough({ scenes, pages, claude: deps.claude, model: deps.model, scrub: deps.scrub, log })

  const used = [...new Set([1, ...shots.map((s) => s.page)])].sort((a, b) => a - b)
  const pageProps = []
  for (const n of used) {
    const p = pages.find((x) => x.n === n); if (!p) continue
    await sharp(p.file).jpeg({ quality: 86 }).toFile(join(dir, `page-${n}.jpg`))
    pageProps.push({ n, src: `${dirName}/page-${n}.jpg`, w: p.w, h: p.h })
  }

  const all = [
    { kind: 'cover', narration: cover.narration },
    ...scenes.map((s, i) => ({ kind: 'page', narration: s.narration, title: s.title, shot: shots[i] })),
    { kind: 'close', narration: closing.narration },
  ].filter((s) => s.kind === 'page' || (s.narration && s.narration.trim()))
  await Promise.all(all.map(async (s, i) => {
    const file = `${dirName}/vo-${i}.mp3`
    const timed = await deps.tts(() => deps.ttsTimed(s.narration, join(pub, file), voiceId))
    if (deps.normalize) await deps.normalize(join(pub, file)).catch((e) => log(`voice level not normalised (${e.message})`))
    let sec = Number(timed && timed.durationSec) || 0
    if (deps.audioDurationSec) { const m = await deps.audioDurationSec(join(pub, file)).catch(() => 0); if (m > 0) sec = m }
    s.vo = file; s.voSec = Math.round(sec * 1000) / 1000
    s.words = (timed && Array.isArray(timed.words) ? timed.words : []).map((w) => ({ w: w.w, start: Math.round(w.start * 1000) / 1000, end: Math.round(w.end * 1000) / 1000 }))
  }))
  await rm(work, { recursive: true, force: true }).catch(() => {})

  const propScenes = all.map((s) => {
    const base = { kind: s.kind, vo: s.vo, voSec: s.voSec, words: s.words }
    if (s.kind !== 'page') return base
    const page = pages.find((p) => p.n === s.shot.page)
    return { ...base, page: s.shot.page, ring: page ? ringBox(page, s.shot.lines) : null, card: s.shot.card || null, ringWord: s.shot.ringWord, cardWord: s.shot.cardWord }
  })
  const times = walkTimelineSec(all.map((s) => s.voSec))
  const sceneMeta = all.map((s, i) => ({
    index: i, kind: s.kind, startSec: Math.round(times[i].startSec * 10) / 10, endSec: Math.round(times[i].endSec * 10) / 10,
    // the picture for the scene list: card in, before the cut
    midSec: Math.round((times[i].startSec + Math.max(0.8, (times[i].endSec - times[i].startSec) * 0.75)) * 10) / 10,
    label: String(s.kind === 'cover' ? cover.title : s.kind === 'close' ? closing.title : (s.title || (s.shot.card && (s.shot.card.eyebrow || s.shot.card.text)) || `Page ${s.shot.page}`)).slice(0, 120),
    narration: s.narration, voFile: s.vo,
  }))
  const props = {
    pages: pageProps, scenes: propScenes,
    cover: { eyebrow: cover.eyebrow, title: cover.title, prepared: cover.prepared, from: cover.from },
    closing: { eyebrow: closing.eyebrow, title: closing.title, line: closing.line, contact: closing.contact },
    ...(theme && typeof theme === 'object' ? { theme } : {}), music: WALK.MUSIC, assetDir: dirName,
  }
  return { props, dirName, dir, sceneMeta, shots, blurred }
}

module.exports = {
  WALK, walkTimelineSec, prepareWalkthrough,
  PAGE_PX, readPdf, parseBboxLayout, parseImagesXml, hideOnPages, hideMatcher, makeScrub, nameTerms, initialsFor, PERSONAL_RE, MARK_RE,
  planWalkthrough, checkShot, fallbackShot, withRowMates, cleanCard, cardNumbersOk, docNumberSet, parsePlanReply, pagesForPrompt, ringBox, cleanupWalk,
}
