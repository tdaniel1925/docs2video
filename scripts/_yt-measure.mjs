/**
 * WHERE DID THE INK LAND?
 *
 * A YouTube banner is 2560x1440, but YouTube shows only the middle 1546x423
 * on a phone. A file with the right dimensions and its content outside that
 * window is exactly the failure reported: "a lot of the image was cut off
 * when I actually added it to YouTube."
 *
 * This measures the finished banner against YouTube's own three windows and
 * says, in plain percentages, how much of the design survives each one.
 */
import { readFileSync, writeFileSync } from 'fs'
import sharp from 'sharp'

const OUT = 'C:/Users/tdani/AppData/Local/Temp/claude/C--dev-1---PrismGraphs/b49a578b-8a92-4baa-9740-01972f39bb4f/scratchpad/yt'
const png = readFileSync(OUT + '/banner.png')
const img = sharp(png)
const { width: W, height: H } = await img.metadata()
console.log('banner: ' + W + 'x' + H)

/* YouTube's published windows, all centred on the same point. */
const WINDOWS = [
  ['phone (all anyone is guaranteed to see)', 1546, 423],
  ['tablet', 1855, 423],
  ['desktop', 2560, 423],
  ['TV (the whole file)', 2560, 1440],
]

/*
 * "Content" means ink that differs from the background. The background is
 * sampled from the four corners — a banner's corners are background by
 * construction, and that is what makes them croppable.
 */
const raw = await img.clone().removeAlpha().raw().toBuffer({ resolveWithObject: true })
const { data, info } = raw
const ch = info.channels
const at = (x, y) => { const i = (y * info.width + x) * ch; return [data[i], data[i + 1], data[i + 2]] }
const corners = [at(4, 4), at(W - 5, 4), at(4, H - 5), at(W - 5, H - 5)]
const bg = [0, 1, 2].map((c) => Math.round(corners.reduce((n, p) => n + p[c], 0) / corners.length))
console.log('background sampled from the corners: rgb(' + bg.join(',') + ')')

/* A pixel counts as content if it is clearly not the background. 42 is about
   16% of the channel range — past the noise of a gradient, well under a real
   design element. */
const THRESH = 42
const isInk = (x, y) => {
  const [r, g, b] = at(x, y)
  return Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]) > THRESH * 3
}

/* Sample on a grid rather than every pixel — 3.7M pixels is slow and the
   answer does not change. */
const STEP = 4
let total = 0
const ink = []
for (let y = 0; y < H; y += STEP) {
  for (let x = 0; x < W; x += STEP) {
    if (isInk(x, y)) { ink.push([x, y]); total++ }
  }
}
console.log('content pixels found: ' + total.toLocaleString() + ' (sampled every ' + STEP + 'px)')

console.log('')
console.log('HOW MUCH SURVIVES EACH CROP')
console.log('window                                    kept    lost')
for (const [name, w, h] of WINDOWS) {
  const x0 = (W - w) / 2, x1 = x0 + w, y0 = (H - h) / 2, y1 = y0 + h
  const inside = ink.filter(([x, y]) => x >= x0 && x < x1 && y >= y0 && y < y1).length
  const pct = total ? Math.round((inside / total) * 100) : 0
  const flag = pct >= 95 ? '  OK' : pct >= 80 ? '  some loss' : '  BADLY CROPPED'
  console.log(name.padEnd(42) + (pct + '%').padStart(5) + (100 - pct + '%').padStart(8) + flag)
}

/* And a picture of it, so the number can be checked by eye. */
const strip = { left: Math.round((W - 1546) / 2), top: Math.round((H - 423) / 2), width: 1546, height: 423 }
await sharp(png).extract(strip).toFile(OUT + '/phone-crop.png')
console.log('')
console.log('what a phone shows: ' + OUT + '/phone-crop.png')
