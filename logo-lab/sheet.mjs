// Build a BLIND contact sheet for rating.
//
//   node logo-lab/sheet.mjs steer
//
// One numbered image with everything visible at once. Nothing on the sheet says
// which variant produced which logo — the order is shuffled and the key is
// written to a separate file that is not opened until after rating.
//
// This is the part that makes the whole exercise honest. Rating with the
// variant on screen measures what was expected, not what happened, and the
// expectation here is strong: the whole premise says the studio steer should
// win. That is exactly the condition under which blinding matters most.
import sharp from 'sharp'
import { existsSync } from 'fs'
import { RUNS, save, loadResults, writeJson } from './lib.mjs'

const experiment = process.argv[2]
if (!experiment) { console.error('usage: sheet.mjs <experiment>'); process.exit(2) }

const results = loadResults()
const imgs = results.images.filter((x) => x.experiment === experiment && x.file && !x.error && existsSync(x.file))
if (!imgs.length) { console.error(`no images for "${experiment}" — run it first`); process.exit(1) }

// Deterministic shuffle from a fixed seed, so the same sheet can be rebuilt if
// a rating session is interrupted, without reshuffling the numbers underneath.
let seed = 1337
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
const order = [...imgs].sort(() => rnd() - 0.5)

const CELL = 260
const PAD = 14
const LABEL = 26
const COLS = 6
const rows = Math.ceil(order.length / COLS)
const W = COLS * (CELL + PAD) + PAD
const H = rows * (CELL + PAD + LABEL) + PAD

const tiles = []
for (const [i, img] of order.entries()) {
  const col = i % COLS, row = Math.floor(i / COLS)
  const x = PAD + col * (CELL + PAD)
  const y = PAD + row * (CELL + PAD + LABEL)
  const buf = await sharp(img.file)
    .flatten({ background: '#ffffff' })
    .resize(CELL, CELL, { fit: 'contain', background: '#ffffff' })
    .toBuffer()
  tiles.push({ input: buf, left: x, top: y })
  // The number is ALL the sheet reveals.
  tiles.push({
    input: Buffer.from(
      `<svg width="${CELL}" height="${LABEL}"><text x="${CELL / 2}" y="18" font-family="sans-serif"
       font-size="15" font-weight="700" fill="#444" text-anchor="middle">${i + 1}</text></svg>`),
    left: x, top: y + CELL,
  })
}

const out = `${RUNS}/${experiment}-SHEET.png`
save(out, await sharp({ create: { width: W, height: H, channels: 3, background: '#f2f2f2' } })
  .composite(tiles).png().toBuffer())

// The key, written where it will not be read by accident.
writeJson(`${RUNS}/${experiment}-KEY.json`, order.map((img, i) => ({ n: i + 1, id: img.id, variant: img.variant, brand: img.brand })))

console.log(`\n  ${out}`)
console.log(`  ${order.length} logos, numbered 1–${order.length}, variant hidden.\n`)
console.log('  Rate each 1–5 on: would I show this to a client?')
console.log('    1 = janky   3 = passable   5 = I would put my name on it\n')
console.log(`  Then:  node logo-lab/score.mjs ${experiment} "1:3 2:5 3:1 ..."`)
console.log('  (any you skip are simply left unrated)\n')
