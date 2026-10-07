// =============================================================================
// Do any words drawn by CODE leave their picture?
//
// Most graphics tools in this app have the image model letter the words, and
// those can only be steered by the prompt. The ones below are drawn by code, so
// they can be MEASURED — the same four failures the video checker
// (remotion/scripts/overflow-qa.mjs) looks for:
//
//   off-frame      a word reaches past the edge of the picture
//   clipped        something that hides overflow cuts a word off
//                  (this includes "…" truncation and line clamps)
//   out-of-box     a word spills out of the card / pill drawn around it
//   box-off-frame  a card that holds words runs past the edge of the picture
//
// What is checked, with worst-case words (120+ character lines, one very long
// unbroken word, huge numbers):
//
//   design-preview   the live preview on /design — the customer's headline set
//                    over the chosen look, in the exact shape of every size
//                    (also checks the preview keeps the size's true shape)
//
// (The email-signature and brand-kit signature checks went with those retired
// tools, 2026-10.)
//
// A planted broken case runs every time. If the checker does not catch it, the
// run fails — a check nobody has watched fail proves nothing.
//
// Run:   node scripts/graphics-overflow-check.mjs            (everything)
//        node scripts/graphics-overflow-check.mjs preview    (one group)
// Stills: .shots/graphics-overflow/*.png — LOOK at them.
// Exit 1 on any finding, or if a case was not actually measured.
// =============================================================================

import { createServer } from 'node:http'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, extname, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { chromium } from 'playwright'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, '.shots', 'graphics-overflow')
mkdirSync(OUT, { recursive: true })
const only = process.argv[2] || ''

// Node strips the types itself (same as the other checks).
const { FLYER_SIZES, VISIBLE_STYLES } = await import('../app/_lib/flyer-engine/index.ts')

// esbuild lives in the video engine's packages; the app does not need its own.
const esbuild = createRequire(join(ROOT, 'remotion', 'package.json'))('esbuild')

// ── Worst-case words ─────────────────────────────────────────────────────────
const HEADLINES = {
  normal: 'Grand Opening BBQ',
  medium: 'Fall Harvest Festival — Live Music, Hayrides & Homemade Pie',
  long: 'Join Us For The Twenty-Fifth Annual Riverside Community Summer Music Festival, Food Truck Rally And Family Fireworks Spectacular',
  unbroken: 'Supercalifragilisticexpialidocious-Indemnification',
  number: '$1,234,567,890.00',
  extreme: 'Everything Must Go: Our Biggest Warehouse Clearance Event Ever With Up To Seventy Percent Off Every Sofa, Sectional, Recliner, Dining Set, Mattress And Outdoor Patio Collection In Stock This Weekend Only',
}

// ── A static server: the harness + the app's public folder (look thumbnails, fonts, images) ──
const files = new Map() // /__h/<name> → { body, type }
const TYPES = { '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.otf': 'font/otf', '.css': 'text/css', '.js': 'text/javascript', '.html': 'text/html' }
const server = createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0])
  const f = files.get(url)
  if (f) { res.writeHead(200, { 'content-type': f.type }); return res.end(f.body) }
  const p = join(ROOT, 'public', url)
  if (!p.startsWith(join(ROOT, 'public')) || !existsSync(p)) { res.writeHead(404); return res.end() }
  res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' })
  res.end(readFileSync(p))
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const BASE = `http://127.0.0.1:${server.address().port}`

// ── The measuring code, run inside the page ──────────────────────────────────
// A port of remotion/src/qa/OverflowGuard.tsx, scoped to one FRAME element
// (the picture) instead of the whole video.
const SCANNER = `
window.__scan = function (frame) {
  const TOL = 2
  const F = frame.getBoundingClientRect()
  const found = [], seen = new Set()
  const add = (f) => { const k = f.kind + '|' + f.text + '|' + f.where; if (!seen.has(k)) { seen.add(k); found.push(f) } }
  const effOpacity = (el) => { let o = 1; for (let e = el; e && e instanceof Element; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return 0; o *= parseFloat(cs.opacity || '1'); if (o < 0.05) return 0 } return o }
  const optedOut = (el) => { for (let e = el; e && e !== frame.parentElement; e = e.parentElement) if (e.hasAttribute && e.hasAttribute('data-overflow-ok')) return true; return false }
  const alpha = (c) => { const m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) return c === 'transparent' ? 0 : 1; const p = m[1].split(/[ ,/]+/).filter(Boolean); return p.length >= 4 ? parseFloat(p[3]) : 1 }
  const paints = (cs) => {
    if (alpha(cs.backgroundColor) > 0.04) return true
    if (cs.backgroundImage && cs.backgroundImage !== 'none' && cs.backgroundClip !== 'text') return true
    for (const s of ['Top', 'Right', 'Bottom', 'Left']) if (parseFloat(cs['border' + s + 'Width']) > 0 && alpha(cs['border' + s + 'Color']) > 0.04) return true
    return false
  }
  const describe = (el) => { const parts = []; for (let e = el, i = 0; e && i < 3 && e !== frame; e = e.parentElement, i++) { const t = e.tagName.toLowerCase(); const c = (e.getAttribute('class') || '').split(/\\s+/)[0]; parts.push(c ? t + '.' + c : t) } return parts.join(' < ') }
  let words = 0, minFont = Infinity
  const walker = document.createTreeWalker(frame, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = (n.textContent || '').replace(/\\s+/g, ' ').trim()
    if (!text) continue
    const el = n.parentElement
    if (!el || el.closest('script,style,title')) continue
    if (effOpacity(el) === 0 || optedOut(el)) continue
    const range = document.createRange(); range.selectNodeContents(n)
    const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0.5 && r.height > 0.5)
    if (!rects.length) continue
    words++
    minFont = Math.min(minFont, parseFloat(getComputedStyle(el).fontSize))
    const snippet = text.slice(0, 60), where = describe(el)
    for (const r of rects) {
      const over = Math.max(F.left - r.left, F.top - r.top, r.right - F.right, r.bottom - F.bottom)
      if (over > TOL) add({ kind: 'off-frame', text: snippet, by: Math.round(over), where })
      let boxDone = false
      for (let a = el; a && a !== frame; a = a.parentElement) {
        const cs = getComputedStyle(a), ar = a.getBoundingClientRect()
        if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
          const cx = cs.overflowX !== 'visible' ? Math.max(ar.left - r.left, r.right - ar.right) : 0
          const cy = cs.overflowY !== 'visible' ? Math.max(ar.top - r.top, r.bottom - ar.bottom) : 0
          const cut = Math.max(cx, cy)
          if (cut > TOL) add({ kind: 'clipped', text: snippet, by: Math.round(cut), where })
        }
        if (!boxDone && paints(cs)) {
          boxDone = true
          const spill = Math.max(ar.left - r.left, ar.top - r.top, r.right - ar.right, r.bottom - ar.bottom)
          if (spill > TOL) add({ kind: 'out-of-box', text: snippet, by: Math.round(spill), where })
          const boxOver = Math.max(F.left - ar.left, F.top - ar.top, ar.right - F.right, ar.bottom - F.bottom)
          if (boxOver > TOL && !optedOut(a)) add({ kind: 'box-off-frame', text: snippet, by: Math.round(boxOver), where: describe(a) })
        }
      }
    }
  }
  return { found, words, minFont: Number.isFinite(minFont) ? minFont : null }
}
`

// ── The design preview harness (bundles the REAL component) ──────────────────
const entry = join(OUT, '_preview-entry.tsx')
writeFileSync(entry, `
import { createRoot } from 'react-dom/client'
import { Preview } from '../../app/(dashboard)/design/system/Preview'
const cases = (window as any).__CASES__ as { id: string; group: string; sizeId: string; headline: string; templateId: string; width: number }[]
const groups = [...new Set(cases.map((c) => c.group))]
function App() {
  return (<div className="t2a">{groups.map((g) => (
    <section key={g} id={'g-' + g} style={{ display: 'flex', flexWrap: 'wrap', gap: 16, padding: 16, background: '#fff', alignItems: 'flex-start' }}>
      <h2 style={{ width: '100%', margin: 0, font: '600 14px sans-serif' }}>{g}</h2>
      {cases.filter((c) => c.group === g).map((c) => (
        <div key={c.id} data-case={c.id} data-size={c.sizeId} style={{ width: c.width }}>
          <Preview sizeId={c.sizeId} templateId={c.templateId} headline={c.headline} />
        </div>
      ))}
    </section>))}</div>)
}
createRoot(document.getElementById('root')!).render(<App />)
`)
const built = await esbuild.build({
  entryPoints: [entry], bundle: true, write: false, format: 'iife', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent',
  absWorkingDir: ROOT,
})
files.set('/__h/preview.js', { body: built.outputFiles[0].contents, type: 'text/javascript' })
files.set('/__h/tokens.css', { body: readFileSync(join(ROOT, 'app', '(dashboard)', 'design', 'system', 'tokens.css')), type: 'text/css' })

const FONTS_CSS = `
@font-face { font-family: 'Instrument Serif'; src: url('/fonts/InstrumentSerif-Regular.ttf') format('truetype'); }
@font-face { font-family: 'Plus Jakarta Sans'; font-weight: 400; src: url('/fonts/PlusJakartaSans-Regular.ttf') format('truetype'); }
@font-face { font-family: 'Plus Jakarta Sans'; font-weight: 700; src: url('/fonts/PlusJakartaSans-Bold.ttf') format('truetype'); }
* { box-sizing: border-box; } /* as app/globals.css sets it */
body { margin: 0; background: #f4f1ec; }
`

const results = [] // { id, group, findings[], words, minFont, notes[] }
const browser = await chromium.launch()

async function runPreview() {
  const style = VISIBLE_STYLES[0].id
  // The two places the preview is shown: the docked column on a wide screen
  // (320px column, 24px padding) and the slide-in panel on a phone.
  const setups = [
    { name: 'docked', viewport: { width: 1440, height: 900 }, width: 320 - 48 },
    { name: 'phone', viewport: { width: 375, height: 812 }, width: Math.min(360, 375 * 0.92) - 48 },
  ]
  for (const s of setups) {
    const cases = []
    for (const [hk, headline] of Object.entries(HEADLINES)) {
      for (const size of FLYER_SIZES) {
        cases.push({ id: `design-preview/${s.name}/${hk}/${size.id}`, group: `${s.name}-${hk}`, sizeId: size.id, headline, templateId: style, width: s.width })
      }
    }
    files.set(`/__h/preview-${s.name}.html`, {
      type: 'text/html',
      body: `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/__h/tokens.css"><style>${FONTS_CSS}</style>
<script>window.__CASES__ = ${JSON.stringify(cases)}</script><script>${SCANNER}</script></head>
<body><div id="root"></div><script src="/__h/preview.js"></script></body></html>`,
    })
    const page = await browser.newPage({ viewport: s.viewport })
    const logs = []
    page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()) })
    page.on('pageerror', (e) => logs.push(String(e)))
    await page.goto(`${BASE}/__h/preview-${s.name}.html`)
    await page.waitForSelector('[data-case]')
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(400) // let any fitting settle after fonts and images
    const out = await page.evaluate((sizes) => {
      return Array.from(document.querySelectorAll('[data-case]')).map((holder) => {
        const tile = holder.firstElementChild?.firstElementChild
        if (!tile) return { id: holder.dataset.case, missing: true }
        const size = sizes.find((z) => z.id === holder.dataset.size)
        const r = tile.getBoundingClientRect()
        const want = size.w / size.h, got = r.width / r.height
        const res = window.__scan(tile)
        const notes = []
        if (Math.abs(got - want) / want > 0.02) {
          res.found.push({ kind: 'wrong-shape', text: `${Math.round(r.width)}x${Math.round(r.height)} is ${got.toFixed(2)}:1, size is ${want.toFixed(2)}:1`, by: 0, where: 'tile' })
        }
        return { id: holder.dataset.case, ...res, notes }
      })
    }, FLYER_SIZES.map((z) => ({ id: z.id, w: z.w, h: z.h })))
    for (const o of out) results.push({ group: 'design-preview', ...o })
    if (logs.length) console.log(`  [${s.name}] page errors:\n    ` + logs.slice(0, 5).join('\n    '))
    for (const hk of Object.keys(HEADLINES)) {
      await page.locator(`#g-${s.name}-${hk}`).screenshot({ path: join(OUT, `preview-${s.name}-${hk}.png`) })
    }
    await page.close()
  }
}

// The planted failure: a line that runs out of its box, off its picture, and
// is cut by a hidden-overflow box. All four kinds must be reported.
async function runPlanted() {
  files.set('/__h/planted.html', { type: 'text/html', body: `<!doctype html><html><head><script>${SCANNER}</script></head><body style="margin:40px">
  <div id="frame" style="width:300px;height:200px;background:#ddd;position:relative">
    <div style="width:120px;background:#fc0;white-space:nowrap">100% High Cap Rate Acct (S&amp;P 500 Index)</div>
    <div style="width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">A label that gets an ellipsis at the end</div>
    <div style="position:absolute;left:220px;top:120px;width:160px;background:#0cf">Card past the edge</div>
  </div></body></html>` })
  const page = await browser.newPage()
  await page.goto(`${BASE}/__h/planted.html`)
  const r = await page.evaluate(() => window.__scan(document.getElementById('frame')))
  await page.close()
  const kinds = new Set(r.found.map((f) => f.kind))
  const want = ['off-frame', 'clipped', 'out-of-box', 'box-off-frame']
  const missed = want.filter((k) => !kinds.has(k))
  return { ok: missed.length === 0, missed }
}

const planted = await runPlanted()
if (!only || only === 'preview') await runPreview()
await browser.close()
server.close()

// ── Report ───────────────────────────────────────────────────────────────────
let findings = 0, notChecked = 0
const warnings = []
const byGroup = {}
for (const r of results) {
  byGroup[r.group] ??= { cases: 0, bad: 0 }
  byGroup[r.group].cases++
  if (r.missing || !r.words) { notChecked++; console.log(`NOT CHECKED  ${r.id}${r.missing ? ' (picture not found)' : ' (no words found)'}`); continue }
  if (r.found.length) byGroup[r.group].bad++
  for (const f of r.found) {
    findings++
    console.log(`${f.kind.padEnd(13)} ${r.id}  by ${f.by}px  "${f.text}"  @ ${f.where}`)
  }
  // The preview is a thumbnail: small type there is expected, but say when it
  // gets tiny so a human can judge it from the stills.
  if (r.group === 'design-preview' && r.minFont != null && r.minFont < 9) warnings.push(`${r.id} headline shrunk to ${r.minFont.toFixed(1)}px`)
}
for (const w of warnings) console.log(`WARN         ${w}`)
const smallest = results.filter((r) => r.group === 'design-preview' && r.minFont != null).sort((a, b) => a.minFont - b.minFont).slice(0, 3)
if (smallest.length) console.log('smallest preview headlines: ' + smallest.map((r) => `${r.minFont.toFixed(1)}px ${r.id}`).join(', '))
console.log('\n' + Object.entries(byGroup).map(([g, v]) => `${g}: ${v.cases} cases, ${v.bad} with findings`).join('\n'))
console.log(planted.ok ? 'planted broken case: caught (the checker can fail)' : `planted broken case: NOT CAUGHT (${planted.missed.join(', ')}) — the checker is broken`)
const pass = planted.ok && findings === 0 && notChecked === 0 && results.length > 0
console.log(`${pass ? 'PASS' : 'FAIL'} — ${results.length} pictures measured, ${findings} findings, ${notChecked} not checked, ${warnings.length} warnings. Stills: ${OUT}`)
process.exit(pass ? 0 : 1)
