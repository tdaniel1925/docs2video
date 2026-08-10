// What did the experiment actually say?
//
//   node logo-lab/report.mjs steer
//
// Two questions, in order of importance:
//   1. Which variant won, and is the gap big enough to believe?
//   2. Do the machine gates predict the human ratings at all?
//
// The second is the valuable one. A gate that tracks human judgement can be
// switched on and will silently protect every customer forever. A gate that
// does not would silently throw away good work while looking productive — so it
// must be checked, not assumed. That is the same mistake as a test that agrees
// with you: not evidence until you have watched it disagree.
import { loadResults } from './lib.mjs'

const experiment = process.argv[2]
const rater = process.argv.find((a) => a.startsWith('--rater='))?.split('=')[1] ?? 'owner'
if (!experiment) { console.error('usage: report.mjs <experiment> [--rater=name]'); process.exit(2) }

const imgs = loadResults().images.filter((x) => x.experiment === experiment && !x.error)
if (!imgs.length) { console.error(`nothing for "${experiment}"`); process.exit(1) }

const rated = imgs.filter((x) => typeof x.ratings?.[rater] === 'number')
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length
const sd = (xs) => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))) }

console.log(`\n${experiment} — ${imgs.length} images, ${rated.length} rated by "${rater}"\n`)

if (!rated.length) {
  console.log('  Nothing rated yet. Build the sheet, rate it, then come back:')
  console.log(`    node logo-lab/sheet.mjs ${experiment}\n`)
  process.exit(0)
}

// ── 1. which variant won ────────────────────────────────────────────────
const byVariant = new Map()
for (const img of rated) {
  const list = byVariant.get(img.variant) ?? []
  list.push(img.ratings[rater])
  byVariant.set(img.variant, list)
}

const rows = [...byVariant.entries()]
  .map(([variant, scores]) => ({
    variant, n: scores.length, avg: mean(scores), sd: sd(scores),
    great: scores.filter((s) => s >= 4).length / scores.length,
  }))
  .sort((a, b) => b.avg - a.avg)

console.log('  VARIANT                        n    avg    ±     4-or-5')
console.log('  ' + '-'.repeat(58))
for (const r of rows) {
  console.log(`  ${r.variant.padEnd(28)} ${String(r.n).padStart(3)}  ${r.avg.toFixed(2)}  ${r.sd.toFixed(2)}   ${(r.great * 100).toFixed(0)}%`)
}

// Is the gap worth believing? A rough standard-error check — not a formal
// test, but enough to stop a 0.2 difference on 12 images being called a result.
if (rows.length >= 2) {
  const [a, b] = rows
  const se = Math.sqrt(a.sd ** 2 / a.n + b.sd ** 2 / b.n)
  const gap = a.avg - b.avg
  console.log(`\n  Top two differ by ${gap.toFixed(2)} (rough margin of error ±${(se * 2).toFixed(2)}).`)
  console.log(gap > se * 2
    ? `  → "${a.variant}" looks genuinely better than "${b.variant}".`
    : `  → TOO CLOSE TO CALL. Generate more before believing this.`)
}

// ── 2. do the gates predict the human? ──────────────────────────────────
const withGates = rated.filter((x) => x.gates && !x.gates.error)
if (withGates.length >= 8) {
  console.log(`\n  DO THE MACHINE GATES PREDICT THE RATINGS?  (${withGates.length} images)`)
  console.log('  ' + '-'.repeat(58))

  const corr = (xs, ys) => {
    const mx = mean(xs), my = mean(ys)
    const num = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0)
    const den = Math.sqrt(xs.reduce((a, x) => a + (x - mx) ** 2, 0) * ys.reduce((a, y) => a + (y - my) ** 2, 0))
    return den === 0 ? 0 : num / den
  }

  const human = withGates.map((x) => x.ratings[rater])
  for (const gate of ['nodes', 'colours', 'smallLoss', 'oneColourInk', 'inkCoverage']) {
    const vals = withGates.map((x) => x.gates[gate])
    if (vals.some((v) => typeof v !== 'number' || v < 0)) continue
    const r = corr(vals, human)
    const strength = Math.abs(r) > 0.5 ? 'STRONG' : Math.abs(r) > 0.3 ? 'some' : 'none'
    const dir = r < 0 ? 'more = worse' : 'more = better'
    console.log(`  ${gate.padEnd(14)} r = ${r >= 0 ? ' ' : ''}${r.toFixed(2)}   ${strength.padEnd(7)} ${Math.abs(r) > 0.3 ? `(${dir})` : ''}`)
  }
  console.log('\n  Anything reaching STRONG can become an automatic gate.')
  console.log('  Anything at "none" must NOT be used to reject work.')
} else {
  console.log(`\n  Not enough rated images with gate scores yet (${withGates.length}).`)
  console.log(`  Run:  node logo-lab/gates.mjs ${experiment}`)
}

// ── the extremes, for eyeballing ────────────────────────────────────────
const sorted = [...rated].sort((a, b) => b.ratings[rater] - a.ratings[rater])
console.log('\n  BEST')
for (const x of sorted.slice(0, 3)) console.log(`    ${x.ratings[rater]}  ${x.variant.padEnd(26)} ${x.file}`)
console.log('  WORST')
for (const x of sorted.slice(-3).reverse()) console.log(`    ${x.ratings[rater]}  ${x.variant.padEnd(26)} ${x.file}`)
console.log()
