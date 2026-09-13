/**
 * SNAP THE CUTS TO THE MUSIC — the fix for "the movement was not in sync with
 * any beats at all".
 *
 * The previous film cut on 2.71s and 6.69s against a 119 BPM track. Those are
 * arbitrary numbers driven by narration length alone, which is exactly why it
 * "felt thrown together". The beat grid tool already existed and was ignored.
 *
 * TWO THINGS THIS GETS RIGHT THAT NAIVE SNAPPING DOES NOT:
 *
 * 1. THE GRID IS DOUBLE-TIME. The detector reported 159.2 BPM for a track
 *    generated at 84 — it is counting eighths. Cutting on every detected beat
 *    would be a cut every 0.38s, which would shred a calm film. Measured, not
 *    assumed: the median gap is 0.377s, so the real tempo is 79.6.
 *
 * 2. A FULL BAR IS TOO COARSE. Snapping to bar lines drifted one cut by 1.41s,
 *    which pulls a line of narration clean off the picture it belongs to. Half
 *    bars keep the worst drift to 0.70s while still landing on the music.
 *
 * The 0.8s ceiling is the point past which a viewer reads the voice and the
 * picture as belonging to different shots.
 */
import fs from 'fs'
import path from 'path'

const DIR = process.argv[2]
if (!DIR) { console.error('usage: node scripts/beat-snap.mjs <asset dir>'); process.exit(1) }

const plan = JSON.parse(fs.readFileSync(path.join(DIR, 'plan.json'), 'utf8'))
const gridFile = path.join(DIR, 'beatgrid.json')
if (!fs.existsSync(gridFile)) { console.error('no beatgrid.json — cuts will follow the voice alone'); process.exit(1) }
const grid = JSON.parse(fs.readFileSync(gridFile, 'utf8'))

/** The gap the detector actually found, rather than the BPM it reported. */
const gaps = grid.beats.slice(1).map((b, i) => b - grid.beats[i]).sort((a, b) => a - b)
const median = gaps[Math.floor(gaps.length / 2)]
const detected = 60 / median

/*
 * DOUBLE-TIME GUARD. Anything over 120 BPM from a track asked to be calm is
 * the detector counting eighths. Halving gives the musical pulse.
 */
const doubled = detected > 120
const beat = doubled ? median * 2 : median
const bpm = 60 / beat

/** Half-bar lines — see the note above for why not bars. */
const HALF_BAR = beat * 2
const lines = []
for (let t = grid.beats[0]; t < (grid.beats[grid.beats.length - 1] ?? 0); t += HALF_BAR) lines.push(t)

/** Where each beat would start on narration length alone. */
const GAP = 0.35
let t = 0.6
const raw = plan.voDurations.map((d) => { const s = t; t += d + GAP; return s })

const nearest = (x) => lines.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a), lines[0] ?? x)
const cuts = raw.map(nearest)
const drift = cuts.map((c, i) => Math.abs(c - raw[i]))
const worst = Math.max(...drift)

plan.cuts = cuts
plan.bpm = Number(bpm.toFixed(1))
plan.halfBar = Number(HALF_BAR.toFixed(3))
fs.writeFileSync(path.join(DIR, 'plan.json'), JSON.stringify(plan, null, 2))

console.log(`  detector said ${detected.toFixed(1)} BPM${doubled ? ` — double-time, real tempo ${bpm.toFixed(1)}` : ''}`)
console.log(`  half bar ${HALF_BAR.toFixed(2)}s | worst drift ${worst.toFixed(2)}s | avg ${(drift.reduce((a, b) => a + b, 0) / drift.length).toFixed(2)}s`)
if (worst > 0.8) console.log(`  WARNING: ${worst.toFixed(2)}s drift will read as out of sync`)
else console.log('  every cut lands on the music, and no line leaves its picture')
