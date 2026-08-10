// Record blind ratings from the contact sheet.
//
//   node logo-lab/score.mjs steer "1:4 2:2 3:5 4:1"
//   node logo-lab/score.mjs steer --rater=alex "1:3 2:4"
//
// Ratings are stored per rater, so a designer's judgement can be kept separate
// from the owner's and the two compared. If they disagree wildly, that is worth
// knowing BEFORE tuning a whole prompt system against one person's taste.
import { readJson, loadResults, saveResults, upsert, RUNS } from './lib.mjs'

const experiment = process.argv[2]
const rater = process.argv.find((a) => a.startsWith('--rater='))?.split('=')[1] ?? 'owner'
const scores = process.argv.slice(3).filter((a) => !a.startsWith('--')).join(' ')
if (!experiment || !scores) {
  console.error('usage: score.mjs <experiment> [--rater=name] "1:4 2:2 3:5"')
  process.exit(2)
}

const key = readJson(`${RUNS}/${experiment}-KEY.json`, null)
if (!key) { console.error(`no key for "${experiment}" — build the sheet first`); process.exit(1) }

const results = loadResults()
let applied = 0
const bad = []

for (const pair of scores.split(/[\s,]+/).filter(Boolean)) {
  const [nStr, vStr] = pair.split(':')
  const n = Number(nStr), v = Number(vStr)
  if (!Number.isFinite(n) || !Number.isFinite(v) || v < 1 || v > 5) { bad.push(pair); continue }
  const entry = key.find((k) => k.n === n)
  if (!entry) { bad.push(pair); continue }
  const existing = results.images.find((x) => x.id === entry.id)
  upsert(results, { id: entry.id, ratings: { ...(existing?.ratings ?? {}), [rater]: v } })
  applied++
}

saveResults(results)
if (bad.length) console.log(`ignored (not "number:1-5" or out of range): ${bad.join(' ')}`)

const rated = results.images.filter((x) => x.experiment === experiment && x.ratings?.[rater])
console.log(`\n${applied} recorded for "${rater}" — ${rated.length}/${key.length} of this batch now rated`)
if (rated.length < key.length) {
  const missing = key.filter((k) => !results.images.find((x) => x.id === k.id)?.ratings?.[rater]).map((k) => k.n)
  console.log(`still unrated: ${missing.slice(0, 40).join(' ')}${missing.length > 40 ? ` …and ${missing.length - 40} more` : ''}`)
}
console.log(`\nnext:  node logo-lab/report.mjs ${experiment}`)
