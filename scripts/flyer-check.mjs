// Generate one design at several sizes and report what actually came back.
//
//   node scripts/flyer-check.mjs [templateId] [size ...]
//
// The point is to confirm each size is generated at its OWN shape rather than
// cropped out of another — so it prints the size asked of the API next to the
// size delivered, and flags anything that had to be trimmed.
import { readFileSync, writeFileSync } from 'fs'
import OpenAI from 'openai'
import sharp from 'sharp'

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const { FLYER_TEMPLATES, FLYER_SIZES, flyerPrompt, apiSize } = await import('../app/_lib/flyer.ts')
const ai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const MODEL = process.env.FLYER_IMAGE_MODEL || 'gpt-image-2'

const args = process.argv.slice(2)
const template = FLYER_TEMPLATES.find((t) => t.id === args[0]) ?? FLYER_TEMPLATES[0]
const want = args.slice(1).length ? args.slice(1) : ['fb-cover', 'li-banner', 'yt-banner']

const fields = {
  eyebrow: 'FRIDAY NIGHT', headline: 'PULSE',
  subhead: 'Three floors of house and techno',
  date: 'FRI 12 SEPT', time: 'DOORS 10PM', venue: 'WAREHOUSE 9',
  price: '$25 ADVANCE', cta: 'GET TICKETS ONLINE',
}

console.log(`${template.name} · ${MODEL}\n`)
await Promise.all(want.map(async (id) => {
  const size = FLYER_SIZES.find((s) => s.id === id)
  if (!size) { console.log(`  ${id}: unknown size`); return }
  const a = apiSize(size)
  try {
    const r = await ai.images.generate({
      model: MODEL, prompt: flyerPrompt(template, fields, size), size: a.size, quality: 'high', n: 1,
    })
    const W = size.unit === 'in' ? Math.round(size.w * 300) : size.w
    const H = size.unit === 'in' ? Math.round(size.h * 300) : size.h
    const out = await sharp(Buffer.from(r.data[0].b64_json, 'base64'))
      .resize(W, H, { fit: 'cover', position: 'centre' }).png().toBuffer()
    writeFileSync(`check-${id}.png`, out)
    // How much of the generated frame survived the resize?
    const kept = Math.min(1, (a.w / a.h) / (W / H), (W / H) / (a.w / a.h))
    console.log(`  ${id.padEnd(11)} asked ${a.size.padEnd(10)} → ${W}x${H}   ${
      kept > 0.98 ? 'native, nothing trimmed' : `${Math.round((1 - kept) * 100)}% trimmed (banded)`}`)
  } catch (e) {
    console.log(`  ${id.padEnd(11)} FAILED: ${String(e.message).split('\n')[0].slice(0, 100)}`)
  }
}))
