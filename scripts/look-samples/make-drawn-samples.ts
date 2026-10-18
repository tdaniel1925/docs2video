// =============================================================================
// DRAWN SLIDES — measure the fal gpt-image-2.5 cost/quality and make the look
// samples (public/style-samples/drawn-*.png) from the made-up story in
// sample-content.ts. PAID: one fal picture per call (~0.3c low, ~0.7c medium,
// ~3.7c high at 1920x1088). Owner-approved budget for the first run: 6 pictures.
//
// Uses the REAL prompt builder (app/_lib/drawn-slides.ts) and the REAL fal
// caller the render service ships (render-service/fal-image.js).
//
// Run from the repo root (FAL_KEY from .env.local):
//   npx jiti scripts/look-samples/make-drawn-samples.ts <style> <cover|data|reasons|closing> <low|medium|high> [ref.png]
//   npx jiti scripts/look-samples/make-drawn-samples.ts --publish   (shrinks chosen raws into public/style-samples)
// Every call is appended to .shots/drawn-look/raw/ledger.json; the script
// refuses to draw once the ledger holds 6 pictures (DRAWN_SAMPLE_BUDGET to change).
// =============================================================================

import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import { buildDrawnSlides, isDrawStyle } from '../../app/_lib/drawn-slides'
import { SAMPLE_BRAND, SAMPLE_CLIENT, SAMPLE_SCENES, SAMPLE_TITLE } from './sample-content'

const ROOT = path.resolve(__dirname, '..', '..')
const RAW = path.join(ROOT, '.shots', 'drawn-look', 'raw')
const LEDGER = path.join(RAW, 'ledger.json')
const req = createRequire(path.join(ROOT, 'package.json'))
const sharp = req('sharp')

function loadKey() {
  if (process.env.FAL_KEY) return
  const env = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
  const m = env.match(/^FAL_KEY=(.*)$/m)
  if (m) process.env.FAL_KEY = m[1].trim().replace(/^"|"$/g, '')
}

async function publish() {
  // cover/data/closing of the default style = the look card + its samples;
  // one picture per style for the style chips.
  const pick: Record<string, string> = JSON.parse(fs.readFileSync(path.join(RAW, 'publish.json'), 'utf8'))
  const out = path.join(ROOT, 'public', 'style-samples')
  for (const [name, raw] of Object.entries(pick)) {
    await sharp(path.join(RAW, raw)).resize(960, 540, { fit: 'cover' }).png({ compressionLevel: 9, effort: 10 }).toFile(path.join(out, `${name}.png`))
    console.log('wrote', `public/style-samples/${name}.png`, '←', raw)
  }
}

async function main() {
  if (process.argv[2] === '--publish') return publish()
  const [style, kind, quality, refPath] = process.argv.slice(2)
  if (!isDrawStyle(style) || !['cover', 'data', 'reasons', 'closing'].includes(kind) || !['low', 'medium', 'high'].includes(quality)) {
    throw new Error('usage: <3d|illustrated|classic> <cover|data|reasons|closing> <low|medium|high> [ref.png]')
  }
  fs.mkdirSync(RAW, { recursive: true })
  const ledger: any[] = fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, 'utf8')) : []
  const budget = Number(process.env.DRAWN_SAMPLE_BUDGET || 6)
  if (ledger.length >= budget) throw new Error(`budget reached: ${ledger.length}/${budget} pictures already drawn`)

  loadKey()
  const { drawWithFal, falImageCost, DRAWN_W, DRAWN_H } = req(path.join(ROOT, 'render-service', 'fal-image.js'))
  const [cover, data, reasons, closing] = SAMPLE_SCENES as any[]
  const plan = buildDrawnSlides({
    style, cover, scenes: [data, reasons], closing,
    colors: { primary: SAMPLE_BRAND.primary_color, secondary: SAMPLE_BRAND.secondary_color },
    videoTitle: SAMPLE_TITLE, recipient: SAMPLE_CLIENT,
  })
  const idx = { cover: 0, data: 1, reasons: 2, closing: 3 }[kind as 'cover']
  const prompt = plan.prompts[idx]
  const ref = refPath ? fs.readFileSync(path.resolve(RAW, refPath)) : null
  const name = `${style}-${kind}-${quality}${ref ? '-ref' : ''}-${ledger.length + 1}.png`
  const t0 = Date.now()
  let ok = true, err = ''
  try {
    const buf: Buffer = await drawWithFal(prompt, { quality, refImage: ref })
    const meta = await sharp(buf).metadata()
    fs.writeFileSync(path.join(RAW, name), buf)
    console.log(`${name}: ${meta.width}x${meta.height}, ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  } catch (e) { ok = false; err = (e as Error).message; console.error('FAILED', err) }
  const cents = falImageCost(DRAWN_W, DRAWN_H, quality)
  ledger.push({ name, style, kind, quality, ref: !!ref, ok, err, seconds: (Date.now() - t0) / 1000, estCents: Math.round(cents * 100) / 100, text: plan.texts[idx] })
  fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 2))
  console.log(`estimated ${cents.toFixed(2)}c · ledger ${ledger.length}/${budget}`)
  console.log('words asked for:', JSON.stringify(plan.texts[idx]))
}

main().catch((e) => { console.error(e); process.exit(1) })
