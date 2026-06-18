/**
 * Throwaway harness to verify the logo-processor knockout + variant logic on a
 * real image, using the app's sharp. Mirrors app/_lib/logo-processor.ts. Run:
 *   node scripts/test-logo-processor.mjs
 */
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'

const OUT = join(process.cwd(), 'scripts', 'logo-test-out')
const LIGHT = { r: 245, g: 248, b: 255 }, DARK = { r: 14, g: 26, b: 43 }

// A WHITE-background logo (no alpha) — the hard knockout case.
const whiteBg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200">
  <rect width="600" height="200" fill="#ffffff"/>
  <circle cx="100" cy="100" r="60" fill="#1B365D"/>
  <text x="190" y="125" font-family="Arial" font-size="72" font-weight="800" fill="#1B365D">Acme</text>
</svg>`

async function knockout(input) {
  const { data, info } = await input.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  const corners = [0, (width - 1) * channels, (height - 1) * width * channels, ((height - 1) * width + (width - 1)) * channels]
  let br = 0, bg = 0, bb = 0
  for (const c of corners) { br += data[c]; bg += data[c + 1]; bb += data[c + 2] }
  br /= 4; bg /= 4; bb /= 4
  const TOL = 38
  for (let i = 0; i < data.length; i += channels) {
    const dr = data[i] - br, dg = data[i + 1] - bg, db = data[i + 2] - bb
    if (Math.sqrt(dr * dr + dg * dg + db * db) < TOL) data[i + 3] = 0
  }
  return { data: Buffer.from(data), info }
}
async function recolor(raw, info, color) {
  const { width, height, channels } = info
  const out = Buffer.from(raw)
  for (let i = 0; i < out.length; i += channels) if (out[i + 3] > 8) { out[i] = color.r; out[i + 1] = color.g; out[i + 2] = color.b }
  return sharp(out, { raw: { width, height, channels } }).png().toBuffer()
}
function contentRatio(raw, info) {
  const { channels } = info; let o = 0, t = 0
  for (let i = 0; i < raw.length; i += channels) { t++; if (raw[i + 3] > 32) o++ }
  return t ? o / t : 0
}

async function main() {
  await mkdir(OUT, { recursive: true })
  const base = sharp(Buffer.from(whiteBg)).trim({ threshold: 10 })
  const { data: raw, info } = await knockout(base)
  const ratio = contentRatio(raw, info)
  await writeFile(join(OUT, 'light.png'), await recolor(raw, info, LIGHT))
  await writeFile(join(OUT, 'dark.png'), await recolor(raw, info, DARK))
  // Composite light variant onto a dark bg + dark variant onto light bg to eyeball.
  const W = info.width, H = info.height
  const onDark = await sharp({ create: { width: W + 80, height: H + 80, channels: 4, background: '#0B1424' } })
    .composite([{ input: await recolor(raw, info, LIGHT), top: 40, left: 40 }]).png().toBuffer()
  const onLight = await sharp({ create: { width: W + 80, height: H + 80, channels: 4, background: '#F4F6FA' } })
    .composite([{ input: await recolor(raw, info, DARK), top: 40, left: 40 }]).png().toBuffer()
  await writeFile(join(OUT, 'preview-on-dark.png'), onDark)
  await writeFile(join(OUT, 'preview-on-light.png'), onLight)
  console.log(`contentRatio=${ratio.toFixed(3)} (good knockout ~0.05-0.4; >0.92 = failed)`)
  console.log(`wrote ${OUT}/{light,dark,preview-on-dark,preview-on-light}.png`)
}
main().catch((e) => { console.error(e); process.exit(1) })
