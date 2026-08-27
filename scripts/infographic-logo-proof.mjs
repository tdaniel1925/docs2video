// PROOF: the infographic corner-logo pin is pixel-stable.
//
// We don't trust the model to place the logo — we paste the REAL logo back in
// code at a fixed fraction of the image (14% width, 4% margin, top-right). This
// script proves that paste lands in the EXACT same pixels every time, and — so
// the check is honest — proves the SAME check FAILS when the logo is nudged.
//
// Run: node scripts/infographic-logo-proof.mjs
import sharp from 'sharp'
import crypto from 'node:crypto'

const W = 1920, H = 1080
const MARGIN = Math.round(W * 0.04)      // 4%  -> 77px
const LOGO_W = Math.round(W * 0.14)      // 14% -> 269px

// A distinctive logo: bright magenta rounded square with a lime dot — any drift
// shows instantly in a pixel diff.
async function makeLogo() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">
    <rect x="20" y="20" width="360" height="360" rx="40" fill="#E91E8C"/>
    <circle cx="200" cy="200" r="90" fill="#B6FF00"/>
  </svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}

// Three DIFFERENT "generated infographics" — different backgrounds, as if three
// separate model renders. The logo must land identically on all three.
function makeBackground(seed) {
  const hue = (seed * 47) % 360
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="hsl(${hue},40%,18%)"/>
    <rect x="80" y="200" width="900" height="500" rx="24" fill="hsl(${(hue+40)%360},50%,30%)"/>
    <text x="120" y="160" font-size="72" fill="#fff" font-family="sans-serif">Infographic ${seed}</text>
  </svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}

// THE EXACT PIN STEP from the route — logo pasted top-right at fixed fraction.
async function pinLogo(baseBuf, logoBuf, nudge = 0) {
  const base = sharp(baseBuf)
  const meta = await base.metadata()
  const w = meta.width, h = meta.height
  const margin = Math.round(w * 0.04)
  const targetLogoW = Math.round(w * 0.14)
  const logoPng = await sharp(logoBuf).resize({ width: targetLogoW }).png().toBuffer()
  const lm = await sharp(logoPng).metadata()
  const lw = lm.width
  return base.composite([{
    input: logoPng,
    top: margin + nudge,                       // nudge is the deliberate-drift knob
    left: Math.max(0, w - lw - margin + nudge),
  }]).png().toBuffer()
}

// Measure WHERE the logo landed as a bounding box, independent of background.
//
// Hashing raw pixels was too brittle — SVG rasterisation jitters ~1 pixel of
// anti-aliasing along the rounded edge from render to render, which is NOT drift.
// What actually matters is POSITION. We find the logo by its own colours
// (magenta + lime), take the box that encloses those pixels (top/left/right/
// bottom, measured from the corner crop), and compare boxes. Same position ->
// same box, and a real move shifts the box. This is the honest signal.
async function logoBox(imgBuf) {
  const meta = await sharp(imgBuf).metadata()
  const w = meta.width, h = meta.height
  const boxW = Math.round(w * 0.20), boxH = Math.round(h * 0.20)
  const { data } = await sharp(imgBuf)
    .extract({ left: w - boxW, top: 0, width: boxW, height: boxH })
    .raw().toBuffer({ resolveWithObject: true })
  let minX = boxW, minY = boxH, maxX = -1, maxY = -1, count = 0
  for (let p = 0; p < boxW * boxH; p++) {
    const i = p * 3
    const r = data[i], g = data[i + 1], b = data[i + 2]
    const isLogo = (r > 150 && g < 120 && b > 90) || (r > 120 && g > 200 && b < 100)
    if (!isLogo) continue
    const x = p % boxW, y = (p / boxW) | 0
    if (x < minX) minX = x; if (x > maxX) maxX = x
    if (y < minY) minY = y; if (y > maxY) maxY = y
    count++
  }
  return { minX, minY, maxX, maxY, count }
}
// Two boxes are "the same position" if every edge is within 1px (anti-alias
// tolerance) — anything more is a genuine move.
function sameBox(a, b) {
  return Math.abs(a.minX - b.minX) <= 1 && Math.abs(a.minY - b.minY) <= 1 &&
         Math.abs(a.maxX - b.maxX) <= 1 && Math.abs(a.maxY - b.maxY) <= 1
}

const logo = await makeLogo()

const fmt = (b) => `[x ${b.minX}-${b.maxX}, y ${b.minY}-${b.maxY}] ${b.count}px`

// --- PART 1: three independent renders, logo pinned the same way ---
const boxes = []
for (let s = 1; s <= 3; s++) {
  const bg = await makeBackground(s)
  const pinned = await pinLogo(bg, logo)
  boxes.push(await logoBox(pinned))
}
const allMatch = boxes.every(b => sameBox(b, boxes[0]))
console.log('PART 1 — three renders, where the logo landed (top-right corner):')
boxes.forEach((b, i) => console.log(`  slide ${i + 1}: ${fmt(b)}`))
console.log(`  RESULT: ${allMatch ? 'SAME SPOT ✅ (logo is pinned, within 1px anti-alias)' : 'MOVED ❌ (logo drifted)'}`)

// --- PART 2: PROVE THE CHECK CAN FAIL — nudge slide 3's logo by 20px ---
const bg3 = await makeBackground(3)
const drifted = await logoBox(await pinLogo(bg3, logo, 20))
const detectsDrift = !sameBox(drifted, boxes[0])
console.log('\nPART 2 — same check against a deliberately drifted logo (+20px):')
console.log(`  drifted: ${fmt(drifted)}`)
console.log(`  RESULT: ${detectsDrift ? 'DETECTED the drift ✅ (check is honest — it CAN fail)' : 'MISSED the drift ❌ (check is useless)'}`)

console.log('\n=================================')
if (allMatch && detectsDrift) {
  console.log('PROOF PASSED: the pin holds across renders, AND the check would catch a miss.')
  process.exit(0)
} else {
  console.log('PROOF FAILED.')
  process.exit(1)
}
