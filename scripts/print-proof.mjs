// Prove the print path end to end, on a real generation.
//
//   node scripts/print-proof.mjs            letter, with bleed
//   node scripts/print-proof.mjs poster      any size id
//
// Checks the things a print shop checks, and that nothing else in this codebase
// can see: the finished pixel dimensions, the dpi tag written into the file,
// whether the upscaler actually ran, and how much REAL detail is in there as
// opposed to how much the header claims.
import fs from 'node:fs'
import OpenAI from 'openai'

for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const { FLYER_TEMPLATES, FLYER_SIZES, flyerPrompt, apiSize, printPixels, dpiFor } =
  await import('../app/_lib/flyer-engine/index.ts')
const { upscaleForPrint } = await import('../app/_lib/upscale.ts')
const sharp = (await import('sharp')).default

const sizeId = process.argv[2] || 'letter'
const size = FLYER_SIZES.find((s) => s.id === sizeId)
if (!size) { console.error('unknown size:', sizeId); process.exit(1) }
const BLEED = size.unit === 'in'
const BLEED_ADD = BLEED ? 0.25 : 0

const t = FLYER_TEMPLATES.find((x) => x.id === 'corporate') ?? FLYER_TEMPLATES[0]
const fields = {
  eyebrow: 'YOU ARE INVITED',
  headline: 'GROWTH SUMMIT',
  date: 'THURSDAY 12 SEPTEMBER',
  time: '6PM',
  venue: 'THE EXCHANGE',
  cta: 'RESERVE YOUR SEAT',
  contact: '555 0134 · hello@example.com',
}

const ask = apiSize(size, BLEED)
const target = printPixels(size, BLEED)
console.log(`${size.label}   bleed: on`)
console.log(`  asking the generator for  ${ask.size}`)
console.log(`  finished file must be     ${target.w}x${target.h} at ${target.dpi} dpi\n`)

const ai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const t0 = Date.now()
const res = await ai.images.generate({
  model: process.env.FLYER_IMAGE_MODEL || 'gpt-image-2',
  prompt: flyerPrompt(t, fields, size, [], false, BLEED),
  size: ask.size, quality: 'high', n: 1,
})
const raw = Buffer.from(res.data[0].b64_json, 'base64')
const rawMeta = await sharp(raw).metadata()
console.log(`generated ${rawMeta.width}x${rawMeta.height} in ${((Date.now() - t0) / 1000).toFixed(0)}s`)

const t1 = Date.now()
const grown = await upscaleForPrint(raw, target.w, target.h)
const grownMeta = await sharp(grown.buffer).metadata()
console.log(`upscaled  ${grownMeta.width}x${grownMeta.height} in ${((Date.now() - t1) / 1000).toFixed(0)}s` +
  `  (ran: ${grown.upscaled}${grown.reason ? ', ' + grown.reason : ''})`)

const png = await sharp(grown.buffer)
  .resize(target.w, target.h, { fit: 'cover', position: 'centre' })
  .withMetadata({ density: dpiFor(size) })
  .png()
  .toBuffer()
fs.writeFileSync('.print-proof.png', png)

const final = await sharp(png).metadata()
const onPaper = size.unit === 'in'
const claimed = onPaper ? dpiFor(size) : 72
const nativeDpi = onPaper ? Math.round((grownMeta.width ?? 0) / (size.w + BLEED_ADD)) : claimed

const checks = [
  [final.width === target.w && final.height === target.h, `finished size is ${final.width}x${final.height}`],
  [final.density === claimed, `file is tagged ${final.density} dpi`],
  ...(onPaper
    ? [[nativeDpi >= claimed, `real detail is ${nativeDpi} dpi against ${claimed} claimed`]]
    : []),
  [png.length > (onPaper ? 500_000 : 200_000), `file is ${(png.length / 1024 / 1024).toFixed(1)} MB`],
]
console.log()
let bad = 0
for (const [ok, label] of checks) { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`); if (!ok) bad++ }
console.log(bad ? `\n${bad} problem(s)` : '\nprint-ready\n')
process.exit(bad ? 1 : 0)
