// The machine quality gates, measured for every image.
//
//   node logo-lab/gates.mjs steer
//
// These are HYPOTHESES, not truths. Each is a cheap thing to compute that might
// predict whether a human calls a logo janky. Whether any of them actually does
// is the single most valuable question in the research, because a gate that
// works means quality can be enforced automatically before a customer ever sees
// anything — and a gate that does NOT work would quietly bin good work while
// looking productive.
//
// So: measure them all, keep the numbers, and let report.mjs check them against
// human ratings. Do not switch any of them on until that check passes.
import sharp from 'sharp'
import { existsSync } from 'fs'
import { posterize } from 'potrace'
import { loadResults, saveResults, upsert } from './lib.mjs'

const experiment = process.argv[2]
if (!experiment) { console.error('usage: gates.mjs <experiment>'); process.exit(2) }

const trace = (buf, opts) => new Promise((res, rej) =>
  posterize(buf, opts, (e, svg) => (e ? rej(e) : res(svg))))

async function measure(file) {
  const base = sharp(file).flatten({ background: '#ffffff' })

  // ── how many distinct inks? ───────────────────────────────────────────
  // A great mark is one or two colours. Many is the signature of a gradient
  // or a decorative illustration.
  const { data, info } = await base.clone().resize(200, 200, { fit: 'inside' })
      .raw().toBuffer({ resolveWithObject: true })
  const buckets = new Map()
  let ink = 0
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i], g = data[i + 1], b = data[i + 2]
    if (0.299 * r + 0.587 * g + 0.114 * b > 225) continue // paper
    ink++
    buckets.set(`${r >> 5},${g >> 5},${b >> 5}`, (buckets.get(`${r >> 5},${g >> 5},${b >> 5}`) ?? 0) + 1)
  }
  // Only count a colour that is actually present, not a stray fringe pixel.
  const colours = [...buckets.values()].filter((n) => n > ink * 0.02).length
  const inkCoverage = ink / (data.length / info.channels)

  // ── complexity, via the vector ────────────────────────────────────────
  // The most promising gate. A great mark is simple, and after tracing,
  // simplicity is literally countable. "Fussy" stops being a matter of taste.
  const big = await base.clone().resize(1024, 1024, { fit: 'inside' })
    .greyscale().threshold(200).png().toBuffer()
  let nodes = -1, paths = -1
  try {
    const svg = await trace(big, { steps: 1, threshold: 128, turdSize: 4, optTolerance: 0.3 })
    // Every curve and line command in the path data is one node.
    nodes = (svg.match(/[MLCQZ]/gi) || []).length
    paths = (svg.match(/<path/g) || []).length
  } catch { /* leave as -1 = not measured */ }

  // ── does it survive being tiny? ───────────────────────────────────────
  // Shrink to favicon size, blow it back up, and see how much detail was lost.
  // A mark that turns to mush here fails the only test that matters on a phone.
  const tiny = await base.clone().resize(16, 16, { fit: 'contain', background: '#fff' })
    .resize(200, 200, { kernel: 'nearest' }).greyscale().raw().toBuffer()
  const full = await base.clone().resize(200, 200, { fit: 'contain', background: '#fff' })
    .greyscale().raw().toBuffer()
  let diff = 0
  for (let i = 0; i < tiny.length; i++) diff += Math.abs(tiny[i] - full[i])
  const smallLoss = diff / tiny.length / 255 // 0 = survives perfectly

  // ── is it still readable in one colour? ───────────────────────────────
  // Flatten everything to black and check something is still there. A mark
  // that depends on colour contrast to be legible is an illustration.
  const flatStats = await base.clone().greyscale().threshold(160).stats()
  const oneColourInk = 1 - flatStats.channels[0].mean / 255

  return {
    colours,
    inkCoverage: +inkCoverage.toFixed(4),
    nodes,
    paths,
    smallLoss: +smallLoss.toFixed(4),
    oneColourInk: +oneColourInk.toFixed(4),
  }
}

const results = loadResults()
const todo = results.images.filter((x) => x.experiment === experiment && x.file && !x.error && existsSync(x.file))
console.log(`measuring ${todo.length} images\n`)

let n = 0
for (const img of todo) {
  try {
    upsert(results, { id: img.id, gates: await measure(img.file) })
  } catch (e) {
    upsert(results, { id: img.id, gates: { error: e.message } })
  }
  if (++n % 20 === 0) console.log(`  ${n}/${todo.length}`)
}
saveResults(results)

const ok = todo.map((t) => results.images.find((x) => x.id === t.id)?.gates).filter((g) => g && !g.error)
const med = (xs) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)]
console.log(`\ndone. medians across ${ok.length}:`)
console.log(`  colours ${med(ok.map((g) => g.colours))}   nodes ${med(ok.map((g) => g.nodes))}   smallLoss ${med(ok.map((g) => g.smallLoss)).toFixed(3)}`)
console.log(`\nnext:  node logo-lab/report.mjs ${experiment}`)
