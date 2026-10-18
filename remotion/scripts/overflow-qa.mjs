// =============================================================================
// Does any word in any video run off the screen, out of its card, or get cut?
//
// A customer's video showed "100% High Cap Rate Ac" with the rest of the card
// off the right edge. The content came from a model reading their document;
// the card was sized for "$10,000". Nothing checked, so it shipped.
//
// This renders the REAL production compositions with worst-case content (the
// cases in src/qa/cases/), and in every frame it scans, an in-page guard
// (src/qa/OverflowGuard.tsx) measures every word and every card that holds
// words. Nothing is judged by eye.
//
//   npm run qa:overflow                    every engine
//   npm run qa:overflow -- infographic     only cases whose id contains it
//   npm run qa:overflow -- --list          list the cases and stop
//
// Stricter modes (the release gate runs both):
//   QA_OVERLAP=1   also fail on two pieces of text drawn on top of each other,
//                  and on words running under a logo / icon / small picture
//   QA_SEQUENCE=4  render the 4 frames BEFORE each checked frame in the same
//                  tab first, the way a real render does. A single still starts
//                  from nothing every time, so anything that drifts from frame
//                  to frame (cached sizes, a fit that chases its box) is only
//                  visible this way.
//
// Exits 1 if anything overflows — OR if the guard didn't report back for a
// frame, because a check that silently didn't run is a check that lies.
// Stills are saved to out/qa-overflow/ so a flagged frame can be looked at.
// =============================================================================
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { bundle } from '@remotion/bundler'
import { getCompositions, renderStill, renderFrames, openBrowser } from '@remotion/renderer'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'out', 'qa-overflow')
const args = process.argv.slice(2)
const listOnly = args.includes('--list')
const filters = args.filter((a) => !a.startsWith('--'))
// Several engines get checked at once on an 8-core box; keep each run light.
const PARALLEL = Number(process.env.QA_PARALLEL || 2)
const OVERLAP = process.env.QA_OVERLAP === '1'
const SEQUENCE = Math.max(0, Number(process.env.QA_SEQUENCE || 0))

fs.mkdirSync(OUT, { recursive: true })

console.log('Bundling the QA entry (src/qa/index.ts)…')
const serveUrl = await bundle({
  entryPoint: path.join(ROOT, 'src', 'qa', 'index.ts'),
  rootDir: ROOT,
  // The real public/ is 2.5 GB of per-video files. QA cases use qa-public/.
  publicDir: path.join(ROOT, 'qa-public'),
  // Several runs can bundle at once; a shared webpack cache would race.
  enableCaching: false,
})

const comps = (await getCompositions(serveUrl, { inputProps: {} }))
  .filter((c) => c.id.startsWith('QA-'))
  // The planted-broken self-test always runs: it proves the guard can fail.
  .filter((c) => !filters.length || c.id.startsWith('QA-selftest') || filters.some((f) => c.id.includes(f)))

if (!comps.some((c) => !c.id.startsWith('QA-selftest'))) {
  console.log(filters.length ? `No QA cases match: ${filters.join(', ')}` : 'No QA cases defined.')
  process.exit(filters.length ? 1 : 0)
}

const jobs = comps.flatMap((c) => (c.defaultProps.__qaFrames || []).map((frame) => ({ comp: c, frame })))
console.log(`${comps.length} case(s), ${jobs.length} frame(s) to scan.${OVERLAP ? ' Overlap check ON.' : ''}${SEQUENCE ? ` Each after ${SEQUENCE} warm-up frames.` : ''}`)
if (listOnly) {
  for (const c of comps) console.log(`  ${c.id}  frames ${JSON.stringify(c.defaultProps.__qaFrames)}`)
  process.exit(0)
}
const unframed = comps.filter((c) => !(c.defaultProps.__qaFrames || []).length)
for (const c of unframed) console.log(`  ! ${c.id} has no frames to scan`)

const browser = await openBrowser('chrome')
const findings = []
const warnings = []
const failures = []
const planted = []
let done = 0

async function run({ comp, frame }) {
  const logs = []
  let file = path.join(OUT, `${comp.id}-f${frame}.png`)
  const inputProps = OVERLAP ? { ...comp.defaultProps, __qaOverlap: true } : comp.defaultProps
  const onBrowserLog = (log) => { if (log.text.startsWith('D2V_')) logs.push(log.text) }
  try {
    if (SEQUENCE) {
      // One tab, frames in order, like a real render; only the last is judged.
      const dir = fs.mkdtempSync(path.join(OUT, '.seq-'))
      await renderFrames({
        composition: comp, serveUrl, inputProps, outputDir: dir, imageFormat: 'jpeg',
        frameRange: [Math.max(0, frame - SEQUENCE), frame], concurrency: 1,
        // Pictures only: sound is never fetched, so fixtures don't need audio files.
        muted: true,
        puppeteerInstance: browser, timeoutInMilliseconds: 90000, onBrowserLog,
        onStart: () => {}, onFrameUpdate: () => {},
      })
      const last = fs.readdirSync(dir).filter((f) => f.endsWith('.jpeg')).sort().pop()
      file = path.join(OUT, `${comp.id}-f${frame}.jpeg`)
      if (last) fs.copyFileSync(path.join(dir, last), file)
      fs.rmSync(dir, { recursive: true, force: true })
    } else {
      await renderStill({
        composition: comp, serveUrl, output: file, frame, inputProps,
        puppeteerInstance: browser, timeoutInMilliseconds: 90000, onBrowserLog,
      })
    }
  } catch (e) {
    failures.push({ id: comp.id, frame, error: String(e.message || e).split('\n')[0] })
    return
  } finally {
    done++
    if (done % 10 === 0 || done === jobs.length) console.log(`  …${done}/${jobs.length}`)
  }
  let scanned = false
  for (const line of logs) {
    const sp = line.indexOf(' ')
    const tag = line.slice(0, sp)
    const data = JSON.parse(line.slice(sp + 1))
    // In sequence mode the warm-up frames log too; only the checked frame counts.
    if (data.frame != null && data.frame !== frame) continue
    if (tag === 'D2V_SCANNED') scanned = true
    else if (tag === 'D2V_OVERFLOW') (comp.id.startsWith('QA-selftest') ? planted : findings).push({ id: comp.id, file: path.relative(ROOT, file), ...data })
    else if (tag === 'D2V_FIT_SMALL') warnings.push({ id: comp.id, frame, ...data })
  }
  if (!scanned) failures.push({ id: comp.id, frame, error: 'the overflow guard never reported — this frame was NOT checked' })
}

const queue = [...jobs]
await Promise.all(Array.from({ length: PARALLEL }, async () => {
  while (queue.length) await run(queue.shift())
}))
await browser.close({ silent: true })

// Every planted fault must have been caught, or the guard is broken.
const expected = ['off-frame', 'clipped', 'out-of-box', 'box-off-frame', ...(OVERLAP ? ['overlap', 'over-image'] : [])]
const missed = expected.filter((k) => !planted.some((f) => f.kind === k))
const selftestRan = comps.some((c) => c.id.startsWith('QA-selftest'))
if (selftestRan && missed.length) failures.push({ id: 'QA-selftest-planted-broken', frame: '-', error: `the guard MISSED planted fault(s): ${missed.join(', ')} — the checker is broken` })

console.log('')
if (selftestRan && !missed.length) console.log(`Self-test: caught all ${expected.length} planted faults (the checker can fail).`)
if (warnings.length) {
  const seen = new Set()
  console.log(`SHRUNK BELOW ITS MINIMUM (fits, but small — ${warnings.length}):`)
  for (const w of warnings) {
    const k = `${w.id}|${w.text}`
    if (seen.has(k)) continue
    seen.add(k)
    console.log(`  ${w.id} f${w.frame}  ${w.what} ${w.size} < ${w.min}  "${w.text}"`)
  }
  console.log('')
}
if (findings.length) {
  console.log(`OVERFLOW (${findings.length}):`)
  for (const f of findings) console.log(`  ${f.id} f${f.frame}  ${f.kind} by ${f.by}px  "${f.text}"  [${f.where}]`)
  console.log('')
}
if (failures.length) {
  console.log(`NOT CHECKED (${failures.length}):`)
  for (const f of failures) console.log(`  ${f.id} f${f.frame}  ${f.error}`)
  console.log('')
}
fs.writeFileSync(path.join(OUT, `report${filters.length ? '-' + filters.join('-') : ''}.json`), JSON.stringify({ findings, warnings, failures }, null, 2))

const clean = !findings.length && !failures.length && !unframed.length
console.log(clean
  ? `PASS — ${jobs.length} frame(s) across ${comps.length} case(s); nothing off screen, out of its box, or cut off.`
  : `FAIL — ${findings.length} overflow(s), ${failures.length} frame(s) not checked. Stills: ${path.relative(ROOT, OUT)}`)
process.exit(clean ? 0 : 1)
