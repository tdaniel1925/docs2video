// =============================================================================
// Can ANY text in a presentation go off screen, out of its card, or get cut off?
//
// The presentation outputs ("Interactive Presentation" and "Slide Deck") are an
// HTML page first; the PowerPoint, PDF and MP4 are made from it or from the
// same scenes. The words on every slide come from a model reading somebody's
// document, so a value built for "$10,000" can arrive as
// "100% High Cap Rate Acct (S&P 500 Index)". This check feeds the REAL builders
// fixed worst-case content (scripts/deck-overflow-fixtures.mjs — no AI calls, no
// database) and MEASURES the result. Nothing is judged by eye.
//
//   node scripts/deck-overflow-check.mjs                 everything
//   node scripts/deck-overflow-check.mjs --only=html     just the HTML deck
//   node scripts/deck-overflow-check.mjs --only=pptx     just the PowerPoint files
//   node scripts/deck-overflow-check.mjs --only=pdf      just the PDF
//   --deck=worst-heritage   --size=phone   --shots (save every slide picture)
//
// HTML: every deck is opened at the window sizes a real person sees it at —
// full screen on a desktop, the share page's player on a desktop and a phone,
// a phone held both ways, and the 1920x1080 page the MP4 export records — and
// every slide is measured with the same four tests as the video checker
// (remotion/src/qa/OverflowGuard.tsx, copied in below, not imported):
//   off-frame      text past the edge (the decorative border, where drawn)
//   clipped        text cut by something that hides overflow (incl. "…")
//   out-of-box     text spilling out of the card / pill drawn around it
//   box-off-frame  a card holding text running past the edge
// plus what only a deck has:
//   under-chrome   slide text or a card sitting under the nav pill, the corner
//                  title block or the standing disclaimer
//   chrome-overlap the nav pill, corner block and disclaimer running into each other
//   graphic-off-frame  a picture on the slide running past the edge
// A slide where no text was found at all is a failure too (NOT CHECKED), so a
// broken page can never pass by being empty.
//
// PPTX: every text box is read back out of the finished file and laid out in
// Chromium with the same font, size, box width, margins and line spacing, then
// its height is compared with the box. PowerPoint's own "shrink on overflow"
// only happens when PowerPoint recalculates, so it is never counted on.
// PDF: the finished file is read back with pdf.js and every line's position and
// width is checked against the page, and every word asked for must be present.
//
// Exit code 1 on any finding.
// =============================================================================

import { chromium } from 'playwright'
import { registerHooks } from 'node:module'
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { pathToFileURL, fileURLToPath } from 'node:url'
import path from 'node:path'
import * as FX from './deck-overflow-fixtures.mjs'

// The libs use extensionless relative imports (Next resolves them); plain Node
// needs the .ts spelled out. Try the real name first, then with .ts.
registerHooks({
  resolve(spec, ctx, next) {
    try { return next(spec, ctx) } catch (e) {
      if (/^\.\.?\//.test(spec) && !/\.(m?js|ts|json)$/.test(spec)) return next(spec + '.ts', ctx)
      throw e
    }
  },
})

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const arg = (k) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : undefined }
const flag = (k) => process.argv.includes(`--${k}`)
const ONLY = (arg('only') || 'html,pptx,pdf').split(',')
const DECK_F = arg('deck'); const SIZE_F = arg('size'); const TPL_F = arg('template')
const LABEL = arg('label') || 'run'
const SHOTS = flag('shots')
const OUT = path.join(ROOT, '.deckcheck', 'overflow', LABEL)
mkdirSync(OUT, { recursive: true })

// --builder=<file> measures another copy of the deck builder (the original, for a before/after).
const BUILDER = arg('builder') ? path.resolve(ROOT, arg('builder')) : path.join(ROOT, 'app/_lib/presentation.ts')
const { buildPresentationHtml, PRESENTATION_TEMPLATES } = await import(pathToFileURL(BUILDER).href)

let failures = 0
const report = { html: [], pptx: [], pdf: [], warnings: [] }

// ─────────────────────────────────────────────────────────────────────────────
// HTML
// ─────────────────────────────────────────────────────────────────────────────

/** Window sizes a real person sees a deck at. */
const SIZES = [
  { name: 'desktop-1920x1080', w: 1920, h: 1080 },
  { name: 'laptop-1440x900', w: 1440, h: 900 },
  { name: 'laptop-1280x720', w: 1280, h: 720 },
  { name: 'tablet-1024x768', w: 1024, h: 768 },
  { name: 'share-desktop-798x449', w: 798, h: 449 },   // the share page's 16:9 player (800px column, 1px border)
  { name: 'dashboard-700x394', w: 700, h: 394 },       // the owner's own preview (60% column)
  { name: 'share-phone-341x192', w: 341, h: 192 },     // the share page's player on a 375px phone (16px gutters)
  { name: 'phone-390x844', w: 390, h: 844 },           // opened directly / full screen, held upright
  { name: 'phone-844x390', w: 844, h: 390 },           // held sideways
  { name: 'mp4-record-1920x1080', w: 1920, h: 1080, record: true }, // what the MP4 export captures
]

function deckList() {
  const out = []
  const typeOpts = (type, scenes) => type === 'interactive'
    ? { voClips: scenes.map(() => 'AAAA'), shareActions: true, hasSourceDoc: true, hasDeckDownload: true }
    : {}
  for (const t of PRESENTATION_TEMPLATES) {
    for (const type of ['interactive', 'deck']) {
      const w = FX.worstScenes(); const n = FX.normalScenes()
      out.push({ id: `worst-${t.id}-${type}`, opts: { ...FX.WORST_OPTS, scenes: w, templateId: t.id, ...typeOpts(type, w) } })
      out.push({ id: `normal-${t.id}-${type}`, opts: { ...FX.NORMAL_OPTS, scenes: n, templateId: t.id, ...typeOpts(type, n) } })
    }
    const a = FX.worstArtScenes()
    out.push({ id: `art-${t.id}-interactive`, opts: { ...FX.WORST_OPTS, scenes: a, templateId: t.id, ...typeOpts('interactive', a) } })
  }
  for (const type of ['interactive', 'deck']) {
    const e = FX.emptyScenes()
    out.push({ id: `empty-heritage-${type}`, opts: { ...FX.EMPTY_OPTS, scenes: e, templateId: 'heritage', ...typeOpts(type, e) } })
  }
  return out.filter((d) => (!DECK_F || d.id.includes(DECK_F)) && (!TPL_F || d.id.includes(`-${TPL_F}-`)))
}

/** In-page measurement. Same four tests as remotion/src/qa/OverflowGuard.tsx
 *  (copied, since that file is React/Remotion), plus the deck's own chrome. */
function scanSlide({ tol }) {
  const W = innerWidth, H = innerHeight
  const found = []; const seen = new Set()
  const add = (f) => { const k = f.kind + '|' + f.text + '|' + f.where; if (!seen.has(k)) { seen.add(k); found.push(f) } }
  const opac = (el) => {
    let o = 1
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const cs = getComputedStyle(e)
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse') return 0
      o *= parseFloat(cs.opacity || '1')
      if (o < 0.05) return 0
    }
    return o
  }
  const optedOut = (el) => !!(el && el.closest && el.closest('[data-overflow-ok]'))
  const alpha = (c) => {
    const m = String(c).match(/rgba?\(([^)]+)\)/)
    if (!m) return c === 'transparent' ? 0 : 1
    const parts = m[1].split(/[ ,/]+/).filter(Boolean)
    return parts.length >= 4 ? parseFloat(parts[3]) : 1
  }
  const paints = (cs) => {
    if (alpha(cs.backgroundColor) > 0.04) return true
    if (cs.backgroundImage && cs.backgroundImage !== 'none' && cs.backgroundClip !== 'text' && cs.webkitBackgroundClip !== 'text') return true
    for (const s of ['Top', 'Right', 'Bottom', 'Left']) {
      if (parseFloat(cs['border' + s + 'Width']) > 0 && alpha(cs['border' + s + 'Color']) > 0.04) return true
    }
    return false
  }
  const describe = (el) => {
    const parts = []
    for (let e = el, i = 0; e && i < 4; e = e.parentElement, i++) {
      const tag = e.tagName.toLowerCase()
      const id = e.id ? '#' + e.id : (e.getAttribute('class') || '').split(/\s+/).filter(Boolean).slice(0, 2).map((c) => '.' + c).join('')
      parts.push(tag + id)
    }
    return parts.join(' < ')
  }
  const inter = (a, b) => Math.min(Math.min(a.right, b.right) - Math.max(a.left, b.left), Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))

  // The edge a reader sees: the decorative border where the template draws
  // one (text crossing that line reads as spilling out), else the window.
  let F = { left: 0, top: 0, right: W, bottom: H }
  const fr = document.getElementById('frame')
  if (fr) {
    const cs = getComputedStyle(fr)
    if (cs.display !== 'none' && parseFloat(cs.borderTopWidth) > 0 && alpha(cs.borderTopColor) > 0.04) {
      const r = fr.getBoundingClientRect(); F = { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
    }
  }
  const offBy = (r) => Math.max(F.left - r.left, F.top - r.top, r.right - F.right, r.bottom - F.bottom)

  // Chrome pinned over every slide.
  const chrome = []
  const nav = document.getElementById('nav')
  if (nav && opac(nav) > 0) chrome.push({ name: 'nav', r: nav.getBoundingClientRect() })
  const corner = document.querySelector('.corner')
  if (corner) for (const c of corner.children) {
    if (opac(c) === 0) continue
    const r = c.getBoundingClientRect(); if (r.width > 0.5 && r.height > 0.5) chrome.push({ name: 'corner', r })
  }
  const disc = document.querySelector('.disc')
  if (disc && opac(disc) > 0) chrome.push({ name: 'disclaimer', r: disc.getBoundingClientRect() })

  const sec = document.querySelector('.sec.on')
  let textCount = 0, minFont = Infinity, minFontText = ''
  const boxesChecked = new Set()
  for (const root of [sec, nav, corner, disc]) {
    if (!root) continue
    const inSlide = root === sec
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = (n.textContent || '').replace(/\s+/g, ' ').trim()
      if (!text) continue
      const el = n.parentElement
      if (!el || el.closest('script,style')) continue
      if (opac(el) === 0 || optedOut(el)) continue
      const range = document.createRange(); range.selectNodeContents(n)
      const rects = [...range.getClientRects()].filter((r) => r.width > 0.5 && r.height > 0.5)
      if (!rects.length) continue
      if (inSlide) textCount++
      // The fixtures mark items past each layout's limit; the engine must drop them.
      if (/MUST NOT SHOW/.test(text)) add({ kind: 'cap-broken', text: text.slice(0, 60), by: 0, where: describe(el) })
      // A figure must never break across lines: "$1,234,567,890.0" over "0" reads as a different number.
      const figRe = /[$€£]?\d[\d,]*(?:\.\d+)?%?/g
      for (let fm; (fm = figRe.exec(n.textContent));) {
        if (fm[0].length < 4) continue
        const rr = document.createRange(); rr.setStart(n, fm.index); rr.setEnd(n, fm.index + fm[0].length)
        const tops = new Set([...rr.getClientRects()].filter((q) => q.width > 0.5).map((q) => Math.round(q.top)))
        if (tops.size > 1) add({ kind: 'number-split', text: fm[0], by: 0, where: describe(el) })
      }
      const snippet = text.slice(0, 60); const where = describe(el)
      // The size a reader actually sees, after every scale on the way up.
      const er = el.getBoundingClientRect()
      const k = el.offsetHeight ? er.height / el.offsetHeight : 1
      const px = parseFloat(getComputedStyle(el).fontSize) * k
      if (inSlide && px < minFont) { minFont = px; minFontText = snippet }
      for (const r of rects) {
        const over = offBy(r)
        if (over > tol) add({ kind: 'off-frame', text: snippet, by: Math.round(over), where })
        let boxDone = false
        for (let a = el; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
          const cs = getComputedStyle(a); const ar = a.getBoundingClientRect()
          const clipX = cs.overflowX !== 'visible', clipY = cs.overflowY !== 'visible'
          if (clipX || clipY) {
            const cut = Math.max(clipX ? Math.max(ar.left - r.left, r.right - ar.right) : 0, clipY ? Math.max(ar.top - r.top, r.bottom - ar.bottom) : 0)
            if (cut > tol) add({ kind: 'clipped', text: snippet, by: Math.round(cut), where })
          }
          const bigAsWindow = ar.width >= W * 0.97 && ar.height >= H * 0.97
          if (!boxDone && !bigAsWindow && paints(cs)) {
            boxDone = true
            const spill = Math.max(ar.left - r.left, ar.top - r.top, r.right - ar.right, r.bottom - ar.bottom)
            if (spill > tol) add({ kind: 'out-of-box', text: snippet, by: Math.round(spill), where })
            if (!boxesChecked.has(a)) {
              boxesChecked.add(a)
              const bo = offBy(ar)
              if (bo > tol && !optedOut(a)) add({ kind: 'box-off-frame', text: snippet, by: Math.round(bo), where: describe(a) })
              if (inSlide) for (const c of chrome) {
                const o = inter(ar, c.r)
                if (o > tol) add({ kind: 'under-chrome', text: 'card: ' + snippet, by: Math.round(o), where: describe(a) + ' x ' + c.name })
              }
            }
          }
        }
        if (inSlide) for (const c of chrome) {
          const o = inter(r, c.r)
          if (o > tol) add({ kind: 'under-chrome', text: snippet, by: Math.round(o), where: where + ' x ' + c.name })
        }
      }
    }
  }
  for (let i = 0; i < chrome.length; i++) {
    const bo = offBy(chrome[i].r)
    if (bo > tol) add({ kind: 'box-off-frame', text: chrome[i].name, by: Math.round(bo), where: chrome[i].name })
    for (let j = i + 1; j < chrome.length; j++) {
      if (chrome[i].name === chrome[j].name) continue
      const o = inter(chrome[i].r, chrome[j].r)
      if (o > tol) add({ kind: 'chrome-overlap', text: chrome[i].name + ' / ' + chrome[j].name, by: Math.round(o), where: 'chrome' })
    }
  }
  if (sec) for (const img of sec.querySelectorAll('img')) {
    if (opac(img) === 0) continue
    const r = img.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue
    // A picture is clipped by its rounded card on purpose; the CARD must fit.
    const card = img.closest('.illocard') || img
    const cr = card.getBoundingClientRect()
    const bo = offBy(cr)
    if (bo > tol) add({ kind: 'graphic-off-frame', text: 'picture', by: Math.round(bo), where: describe(card) })
    for (const c of chrome) {
      const o = inter(cr, c.r)
      if (o > tol) add({ kind: 'under-chrome', text: 'picture', by: Math.round(o), where: describe(card) + ' x ' + c.name })
    }
  }
  const wrap = sec && sec.querySelector('.wrap')
  const m = wrap && /scale\(([\d.]+)\)/.exec(wrap.style.transform || '')
  const stage = document.getElementById('stage')
  const sm = stage && /scale\(([\d.]+)\)/.exec(stage.style.transform || '')
  return {
    found, textCount,
    minFont: isFinite(minFont) ? Math.round(minFont * 10) / 10 : null, minFontText,
    scale: m ? Number(m[1]) : 1,
    stage: sm ? Number(sm[1]) : 1,
    sideways: document.documentElement.scrollWidth > W + 1 || document.body.scrollWidth > W + 1,
    // The deck marks a slide it had to shrink below 0.62 (D2V_FIT_SMALL): it fits, but it is carrying a lot.
    fitSmall: !!(sec && sec.hasAttribute('data-fit-small')),
  }
}

function settle() {
  // Entrance animations are decoration; measure where things come to rest.
  for (const a of document.getAnimations()) {
    try {
      const t = a.effect && a.effect.getComputedTiming()
      if (t && Number.isFinite(t.endTime)) a.finish()
    } catch { /* an infinite loop (the gradient drift) — leave it running */ }
  }
}

async function runHtml() {
  const decks = deckList()
  const sizes = SIZES.filter((s) => !SIZE_F || s.name.includes(SIZE_F))
  const png = FX.makePng(512, 512, [200, 170, 140])
  const browser = await chromium.launch()
  const jobs = []
  for (const d of decks) for (const s of sizes) jobs.push({ d, s })
  const files = new Map()
  for (const d of decks) {
    const f = path.join(OUT, `${d.id}.html`)
    writeFileSync(f, buildPresentationHtml(d.opts))
    files.set(d.id, f)
  }
  let done = 0
  const lines = []
  const worker = async () => {
    while (jobs.length) {
      const { d, s } = jobs.shift()
      const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h } })
      // The Jordyn house illustrations live on jordyn.app — serve a stand-in
      // so the check does not depend on that site being up.
      await ctx.route('https://jordyn.app/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: png }))
      const page = await ctx.newPage()
      await page.clock.install()
      const url = pathToFileURL(files.get(d.id)).href + (s.record ? '?record=1' : '?share=1')
      await page.goto(url, { waitUntil: 'load' })
      await page.evaluate(() => (document.fonts ? document.fonts.ready.then(() => true) : true))
      await page.clock.runFor(300)
      const n = await page.evaluate(() => document.querySelectorAll('.sec').length)
      for (let i = 0; i < n; i++) {
        await page.evaluate((k) => window.go(k), i)
        await page.evaluate(settle)
        await page.clock.runFor(2600) // count-up numbers reach their final value
        await page.evaluate(settle)
        const res = await page.evaluate(scanSlide, { tol: 2 })
        // Phones: nothing may make the page scroll sideways.
        if (res.sideways) res.found.push({ kind: 'sideways-scroll', text: 'the page is wider than the window', by: 0, where: 'page' })
        const view = { deck: d.id, size: s.name, slide: i + 1, of: n, ...res }
        const bad = res.found.length > 0 || res.textCount === 0
        if (bad) failures++
        if (res.textCount === 0) res.found.push({ kind: 'NOT CHECKED', text: 'no visible text on this slide', by: 0, where: '' })
        report.html.push(view)
        if (res.fitSmall && s.w >= 1024) report.warnings.push(`${d.id} @ ${s.name} slide ${i + 1}: D2V_FIT_SMALL — whole slide shrunk to ${res.scale}`)
        if (s.w >= 1024 && res.minFont !== null && res.minFont < 10) {
          report.warnings.push(`${d.id} @ ${s.name} slide ${i + 1}: smallest text ${res.minFont}px ("${res.minFontText}")`)
        }
        if (bad) {
          lines.push(`  FAIL ${d.id} @ ${s.name} slide ${i + 1}/${n} (scale ${res.scale}${res.stage !== 1 ? ', stage ' + res.stage : ''})`)
          for (const f of res.found.slice(0, 6)) lines.push(`       ${f.kind.padEnd(17)} by ${String(f.by).padStart(4)}px  "${f.text}"  [${f.where}]`)
          if (res.found.length > 6) lines.push(`       … and ${res.found.length - 6} more`)
        }
        if (bad || SHOTS) {
          await page.screenshot({ path: path.join(OUT, `${d.id}__${s.name}__s${String(i + 1).padStart(2, '0')}${bad ? '__FAIL' : ''}.png`) })
        }
      }
      await ctx.close()
      done++
      if (done % 20 === 0) process.stdout.write(`  … ${done}/${decks.length * sizes.length} deck views measured\n`)
    }
  }
  await Promise.all(Array.from({ length: Number(process.env.DECK_PARALLEL || 2) }, worker))
  await browser.close()
  for (const l of lines) console.log(l)
  const views = report.html.length
  const bad = report.html.filter((v) => v.found.length || v.textCount === 0)
  const kinds = {}
  for (const v of bad) for (const f of v.found) kinds[f.kind] = (kinds[f.kind] || 0) + 1
  console.log(`\nHTML: ${views} slide views measured (${decks.length} decks x ${sizes.length} sizes), ${bad.length} with problems`)
  if (bad.length) console.log('      by kind: ' + Object.entries(kinds).map(([k, v]) => `${k} ${v}`).join(' · '))
  const bySize = {}
  for (const v of bad) bySize[v.size] = (bySize[v.size] || 0) + 1
  if (bad.length) console.log('      by size: ' + Object.entries(bySize).map(([k, v]) => `${k} ${v}`).join(' · '))
  // The smallest text a reader sees, per size (after every shrink).
  const minBy = {}
  for (const v of report.html) if (v.minFont !== null) minBy[v.size] = Math.min(minBy[v.size] ?? 99, v.minFont)
  console.log('      smallest text seen: ' + Object.entries(minBy).map(([k, v]) => `${k} ${v}px`).join(' · '))
}

// ─────────────────────────────────────────────────────────────────────────────
// PPTX — every text box read back out of the finished file and laid out in a
// real browser with the same font, size, width, margins and line spacing.
// ─────────────────────────────────────────────────────────────────────────────

// --exports=<dir> / --pptxgen=<file> point at other copies of the builders
// (the "before" run uses the originals pulled read-only out of git).
const EXPORTS = arg('exports') ? path.resolve(ROOT, arg('exports'), 'presentation-exports.ts') : path.join(ROOT, 'app/_lib/presentation-exports.ts')
const PPTXGEN = arg('pptxgen') ? path.resolve(ROOT, arg('pptxgen')) : path.join(ROOT, 'app/_lib/pptx-generator.ts')

const EMU = 914400
const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&amp;/g, '&')

async function readPptx(buf) {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(buf)
  const pres = await zip.file('ppt/presentation.xml').async('string')
  const sz = /<p:sldSz cx="(\d+)" cy="(\d+)"/.exec(pres)
  const attr = (s, k, d) => { const m = new RegExp('\\b' + k + '="(-?\\d+)"').exec(s || ''); return m ? +m[1] : d }
  const files = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
    .sort((a, b) => +a.match(/(\d+)\.xml/)[1] - +b.match(/(\d+)\.xml/)[1])
  const boxes = []
  for (const [si, f] of files.entries()) {
    const xml = await zip.file(f).async('string')
    for (const sp of xml.split('<p:sp>').slice(1)) {
      if (!sp.includes('<p:txBody>')) continue
      const off = /<a:off x="(-?\d+)" y="(-?\d+)"\/>/.exec(sp), ext = /<a:ext cx="(\d+)" cy="(\d+)"\/>/.exec(sp)
      const bodyPr = (/<a:bodyPr([^>]*)>/.exec(sp) || [])[1] || ''
      const paras = []
      for (const p of sp.split(/<a:p>/).slice(1)) {
        const pPr = (/<a:pPr([^>]*)>/.exec(p) || [])[1] || ''
        const lnPct = /<a:lnSpc><a:spcPct val="(\d+)"/.exec(p), lnPts = /<a:lnSpc><a:spcPts val="(\d+)"/.exec(p)
        const aft = /<a:spcAft><a:spcPts val="(\d+)"/.exec(p), bef = /<a:spcBef><a:spcPts val="(\d+)"/.exec(p)
        const runs = []
        const re = /<a:r>([\s\S]*?)<\/a:r>|<a:br\b/g
        let m
        while ((m = re.exec(p))) {
          if (!m[1]) { runs.push({ br: true }); continue }
          const rPr = (/<a:rPr([^>]*)/.exec(m[1]) || [])[1] || ''
          runs.push({
            text: decode((/<a:t>([\s\S]*?)<\/a:t>/.exec(m[1]) || [])[1] || ''),
            pt: attr(rPr, 'sz', 1800) / 100, bold: /\bb="1"/.test(rPr),
            face: (/<a:latin typeface="([^"]+)"/.exec(m[1]) || [])[1] || 'Calibri', // theme minor font
          })
        }
        paras.push({
          marL: attr(pPr, 'marL', 0), lnPct: lnPct ? +lnPct[1] / 100000 : null, lnPts: lnPts ? +lnPts[1] / 100 : null,
          aft: aft ? +aft[1] / 100 : 0, bef: bef ? +bef[1] / 100 : 0, runs,
          endPt: attr((/<a:endParaRPr([^>]*)/.exec(p) || [])[1], 'sz', 1800) / 100,
        })
      }
      boxes.push({
        slide: si + 1, x: +off[1], y: +off[2], w: +ext[1], h: +ext[2],
        ins: { l: attr(bodyPr, 'lIns', 91440), r: attr(bodyPr, 'rIns', 91440), t: attr(bodyPr, 'tIns', 45720), b: attr(bodyPr, 'bIns', 45720) },
        paras, text: paras.map((p) => p.runs.map((r) => r.text || '').join('')).join(' ').trim(),
      })
    }
  }
  return { SW: +sz[1], SH: +sz[2], boxes, slides: files.length }
}

/** Lay every text box out in Chromium and measure it against its own box. */
async function measurePptx(browser, deck) {
  const PX = 96 / EMU, PT = 96 / 72
  const html = ['<!doctype html><html><body style="margin:0">']
  deck.boxes.forEach((b, k) => {
    const w = (b.w - b.ins.l - b.ins.r) * PX
    html.push(`<div class="bx" data-k="${k}" style="position:relative;width:${w}px;display:flow-root;margin-bottom:40px">`)
    for (const p of b.paras) {
      const maxPt = Math.max(p.endPt, ...p.runs.filter((r) => !r.br).map((r) => r.pt), 1)
      // PowerPoint's single spacing ~1.2x the size; Calibri's own is 1.22 — the most generous.
      const lh = p.lnPts ? p.lnPts * PT : (p.lnPct ?? 1) * 1.22 * maxPt * PT
      // The paragraph itself carries the main run's font, so the browser's line
      // "strut" matches the text (a 16px default strut inflates every line).
      const main = p.runs.filter((r) => !r.br).sort((x, y) => y.pt - x.pt)[0] || { face: 'Calibri', pt: p.endPt }
      html.push(`<div class="pp" style="font-family:'${main.face}';font-size:${main.pt * PT}px;padding-left:${p.marL * PX}px;line-height:${lh}px;margin:${p.bef * PT}px 0 ${p.aft * PT}px;overflow-wrap:break-word;white-space:pre-wrap">`)
      for (const r of p.runs) {
        if (r.br) { html.push('<br>'); continue }
        const t = r.text.replace(/&/g, '&amp;').replace(/</g, '&lt;')
        html.push(`<span style="font-family:'${r.face}';font-size:${r.pt * PT}px;font-weight:${r.bold ? 700 : 400}">${t}</span>`)
      }
      if (!p.runs.some((r) => !r.br && r.text)) html.push('&#8203;')
      html.push('</div>')
    }
    html.push('</div>')
  })
  html.push('</body></html>')
  const page = await browser.newPage()
  await page.setContent(html.join(''))
  await page.evaluate(() => document.fonts.ready)
  const res = await page.evaluate(() => [...document.querySelectorAll('.bx')].map((bx) => {
    const need = bx.scrollHeight
    // Would any word have to break mid-word?
    const pps = [...bx.querySelectorAll('.pp')]
    pps.forEach((p) => { p.style.overflowWrap = 'normal' })
    const broke = pps.some((p) => p.scrollWidth > p.clientWidth + 1)
    return { need, broke }
  }))
  await page.close()
  return res
}

function pptxFixtures() {
  const bg = FX.makePng(320, 180)
  const slide = (slideType, headline, bodyPoints, extra = {}) => ({ slideType, headline, bodyPoints, backgroundImage: bg, ...extra })
  // This builder has no item limit, so nine long bullets must all fit.
  const LB = [...FX.worstScenes()[1].slideData.bullets.slice(0, 6), 'A seventh long bullet about the waiver of premium rider and how it applies after six months of disability', 'An eighth bullet about accelerated death benefits for chronic and terminal illness riders', 'A ninth bullet about the policy loan provisions, interest rates and what happens if loans are not repaid']
  return {
    worst: [
      slide('cover', FX.WORST_OPTS.title, [], { subheadline: FX.WORST_OPTS.subtitle }),
      slide('content', FX.T120, LB),
      slide('data', FX.T120, LB.slice(0, 3), { stats: [
        { value: FX.LONG_VALUE, label: 'Total Projected Accumulation Value At Age 100' },
        { value: FX.HUGE, label: 'Face Amount With Every Rider' }, { value: '98%', label: FX.UNBROKEN },
        { value: FX.LONG_EMAIL, label: 'Contact' }, { value: '$7', label: 'Five' }, { value: '$8', label: 'Six' },
        { value: '$9', label: 'Seven' }, { value: '$10', label: 'Eight' }, { value: '$11', label: 'Nine' },
      ] }),
      slide('data', 'Only Numbers', [], { stats: [{ value: FX.HUGE, label: FX.LONG_WORD }, { value: '12%', label: 'Cap' }] }),
      slide('quote', `"${FX.T120} ${FX.T120}"`, [FX.LONG_PRESENTER]),
      slide('closing', `${FX.T120} ${FX.LONG_WORD}`, LB.slice(0, 5)),
    ],
    normal: [
      slide('cover', 'Your Indexed Universal Life Illustration', [], { subheadline: 'A plain-English walk through your policy' }),
      slide('content', 'What Your Policy Does', ['Pays a tax-free death benefit', 'Builds cash value you can borrow', 'Protects you with a 0% floor']),
      slide('data', 'The Numbers', ['Premiums are flexible'], { stats: [{ value: '$500,000', label: 'Death Benefit' }, { value: '$412', label: 'Monthly Premium' }, { value: '0%', label: 'Floor' }] }),
      slide('closing', 'Let’s Review It Together', ['Book a 20-minute call']),
    ],
    opts: { brandName: FX.LONG_BRAND, primaryColor: '#1B365D', secondaryColor: '#4A90D9', accentColor: '#FFB347', textColor: '#FFFFFF', logoBuffer: null, contactInfo: { phone: '1-800-555-0199', website: FX.LONG_URL } },
    normalOpts: { brandName: 'Northside Insurance Group', primaryColor: '#1B365D', secondaryColor: '#4A90D9', accentColor: '#FFB347', textColor: '#FFFFFF', logoBuffer: null, contactInfo: { phone: '1-555-201-4410', website: 'northside.com' } },
  }
}

async function runPptx() {
  const { buildDeckPptx } = await import(pathToFileURL(EXPORTS).href)
  const { generatePptx } = await import(pathToFileURL(PPTXGEN).href)
  const P = pptxFixtures()
  const cases = [
    { id: 'deck-export-worst', make: () => buildDeckPptx(FX.WORST_OPTS.title, FX.worstScenes(), 'heritage', '#e8d44d') },
    { id: 'deck-export-normal', make: () => buildDeckPptx(FX.NORMAL_OPTS.title, FX.normalScenes(), 'mint') },
    { id: 'deck-export-empty', make: () => buildDeckPptx('Presentation', FX.emptyScenes(), 'midnight') },
    { id: 'api-deck-worst', make: () => generatePptx(P.worst, P.opts) },
    { id: 'api-deck-normal', make: () => generatePptx(P.normal, P.normalOpts) },
  ].filter((c) => !DECK_F || c.id.includes(DECK_F))
  const browser = await chromium.launch()
  let boxes = 0, bad = 0
  for (const c of cases) {
    const buf = await c.make()
    writeFileSync(path.join(OUT, `${c.id}.pptx`), buf)
    const deck = await readPptx(buf)
    const res = await measurePptx(browser, deck)
    const tol = 0.02 * EMU
    deck.boxes.forEach((b, k) => {
      if (!b.text) return
      boxes++
      const found = []
      const avail = (b.h - b.ins.t - b.ins.b) * 96 / EMU
      if (res[k].need > avail + 0.5) found.push(`text-overflows-box by ${Math.round(res[k].need - avail)}px (needs ${Math.round(res[k].need)}px, box holds ${Math.round(avail)}px)`)
      if (b.x < -tol || b.y < -tol || b.x + b.w > deck.SW + tol || b.y + b.h > deck.SH + tol) found.push('box-off-slide')
      for (const o of deck.boxes) {
        if (o === b || !o.text || o.slide !== b.slide || deck.boxes.indexOf(o) < k) continue
        const ox = Math.min(b.x + b.w, o.x + o.w) - Math.max(b.x, o.x), oy = Math.min(b.y + b.h, o.y + o.h) - Math.max(b.y, o.y)
        if (ox > tol && oy > tol) found.push(`boxes-overlap with "${o.text.slice(0, 30)}"`)
      }
      if (res[k].broke) report.warnings.push(`${c.id} slide ${b.slide}: a word had to break mid-word in "${b.text.slice(0, 50)}"`)
      report.pptx.push({ deck: c.id, slide: b.slide, text: b.text.slice(0, 60), found })
      if (found.length) {
        bad++; failures++
        console.log(`  FAIL ${c.id} slide ${b.slide}  "${b.text.slice(0, 50)}"`)
        for (const f of found) console.log(`       ${f}`)
      }
    })
  }
  await browser.close()
  console.log(`\nPPTX: ${boxes} text boxes measured in ${cases.length} files, ${bad} with problems`)
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF — read back with pdf.js (bundled with pdf-parse): every line must sit on
// the page, no two lines may collide, and every word asked for must be there.
// ─────────────────────────────────────────────────────────────────────────────

async function runPdf() {
  const { createRequire } = await import('node:module')
  const require = createRequire(import.meta.url)
  const PDFJS = require('pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js')
  PDFJS.disableWorker = true
  const { buildDeckPdf } = await import(pathToFileURL(EXPORTS).href)
  // Letters a document can easily carry that the built-in PDF fonts cannot draw.
  const symbols = [{ narration: 'x', title: 'Rates ≈ 4.5% → up to 12% for age ≥ 65 ✓', slideData: { headline: 'Rates ≈ 4.5% → up to 12% for age ≥ 65 ✓', bullets: ['Non‑tobacco rate class (non-breaking hyphen)', 'Guaranteed ✓', '😀 emoji'] } }]
  const cases = [
    { id: 'pdf-worst', title: FX.WORST_OPTS.title, scenes: FX.worstScenes() },
    { id: 'pdf-normal', title: FX.NORMAL_OPTS.title, scenes: FX.normalScenes() },
    { id: 'pdf-empty', title: 'Presentation', scenes: FX.emptyScenes() },
    { id: 'pdf-symbols', title: 'Symbols ≈ →', scenes: symbols },
  ].filter((c) => !DECK_F || c.id.includes(DECK_F))
  const norm = (s) => String(s ?? '').normalize('NFKD').replace(/[^A-Za-z0-9]/g, '').toLowerCase()
  let items = 0, bad = 0
  for (const c of cases) {
    let bytes
    try { bytes = await buildDeckPdf(c.title, c.scenes, 'heritage') } catch (e) {
      failures++; bad++
      console.log(`  FAIL ${c.id}: the PDF could not be made at all — ${String(e.message).slice(0, 120)}`)
      report.pdf.push({ deck: c.id, found: ['crash: ' + e.message] })
      continue
    }
    writeFileSync(path.join(OUT, `${c.id}.pdf`), bytes)
    const doc = await PDFJS.getDocument({ data: new Uint8Array(bytes) })
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p)
      const [, , W, H] = page.view
      const tc = await page.getTextContent()
      const its = tc.items.filter((it) => it.str.trim()).map((it) => {
        const size = Math.hypot(it.transform[2], it.transform[3])
        return { str: it.str, x: it.transform[4], y: it.transform[5], w: it.width, size }
      })
      items += its.length
      const found = []
      for (const it of its) {
        const over = Math.max(20 - it.x, it.x + it.w - (W - 20), 12 - (it.y - it.size * 0.25), it.y + it.size * 0.8 - (H - 12))
        if (over > 1) found.push(`off-page by ${Math.round(over)}pt: "${it.str.slice(0, 40)}"`)
      }
      for (let a = 0; a < its.length; a++) for (let b = a + 1; b < its.length; b++) {
        const A = its[a], B = its[b]
        const ox = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x)
        const oy = Math.min(A.y + A.size * 0.8, B.y + B.size * 0.8) - Math.max(A.y - A.size * 0.2, B.y - B.size * 0.2)
        if (ox > 1 && oy > 1) found.push(`lines collide: "${A.str.slice(0, 25)}" / "${B.str.slice(0, 25)}"`)
      }
      // Every word asked for must be on the page (nothing silently dropped).
      const s = c.scenes[p - 1]
      if (s) {
        const sd = s.slideData ?? {}
        const want = [sd.headline || s.title || (p === 1 ? c.title : ''), ...(sd.bullets ?? []).filter(Boolean).slice(0, 6),
          ...(sd.stats ?? []).filter((x) => x && x.value).slice(0, 6).flatMap((x) => [x.label, x.value])]
        // Body and heading only — the footer repeats the deck title, which would hide a heading that lost its last words.
        const have = norm(its.filter((it) => it.y > 45).map((it) => it.str).join(''))
        for (const t of want) {
          for (const word of String(t ?? '').split(/\s+/)) {
            const n = norm(word)
            if (n && /^[\x20-\x7e]+$/.test(word) && !have.includes(n)) { found.push(`missing text: "${word.slice(0, 40)}" (from "${String(t).slice(0, 30)}")`); break }
          }
        }
      }
      report.pdf.push({ deck: c.id, page: p, found })
      if (found.length) {
        bad++; failures++
        console.log(`  FAIL ${c.id} page ${p}/${doc.numPages}`)
        for (const f of found.slice(0, 5)) console.log(`       ${f}`)
        if (found.length > 5) console.log(`       … and ${found.length - 5} more`)
      }
    }
  }
  console.log(`\nPDF: ${items} lines of text measured in ${cases.length} files, ${bad} page(s) with problems`)
}

if (ONLY.includes('html')) await runHtml()
if (ONLY.includes('pptx')) await runPptx()
if (ONLY.includes('pdf')) await runPdf()

if (report.warnings.length) {
  console.log(`\nWarnings — nothing is cut off, but worth a look (text under 10px on a desktop-size window, a slide shrunk below 0.62, a word broken mid-word): ${report.warnings.length}`)
  for (const w of report.warnings.slice(0, 30)) console.log('  WARN ' + w)
}
writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1))
console.log(failures ? `\n${failures} view(s) with problems — pictures in ${path.relative(ROOT, OUT)}` : '\nPASS — nothing off screen, out of its box or cut off')
process.exit(failures ? 1 : 0)
