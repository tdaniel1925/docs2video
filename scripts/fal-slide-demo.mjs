/**
 * THE SAME SLIDE, DRAWN ON FAL, USING THE RESTYLEZ WORDING.
 *
 * Restylez already solves this exact problem for deck slides: fal draws the
 * slide, the prompt reserves a corner in PERCENTAGES, and lib/style-slide
 * pins the real logo there afterwards with sharp. It works today.
 *
 * My earlier corner test asked Gemini to "leave the corner clear" and got a
 * white rectangle — I concluded the phrasing was the problem. The real
 * difference is that Restylez says "free of TEXT AND IMPORTANT DETAIL" and
 * names the size, which is an instruction about content rather than an
 * object to draw.
 *
 *   node scripts/fal-slide-demo.mjs
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/))
    .filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')]),
)
mkdirSync('scripts/.bakeoff', { recursive: true })

/* The same rectangle the prompt quotes and the paste uses — one definition,
   so they cannot drift. These are the Restylez numbers. */
const LOGO = { w: 0.22, h: 0.16, right: 0.04, bottom: 0.05 }

const PROMPT = [
  'Design ONE presentation slide, 16:9, for a business explainer video.',
  'Layout: a BULLETED slide. The heading is "What changed in the 2026 renewal".',
  'Set these five points as a clean, readable list, each on its own line:',
  '  - Carrier switched from Ameritas to Penn Mutual on March 1st',
  '  - Annual premium rises $4,280 to $4,715 (a 10.2% increase)',
  '  - The waiver-of-premium rider is retained; the child rider lapses',
  '  - Guaranteed cash value at year 20: $61,940',
  '  - Renewal paperwork is due back by Friday, 27 February',
  '',
  'RULES:',
  '- Use ONLY the words and numbers above. Spell every word exactly.',
  '- Every figure keeps its $ sign, its commas, its decimal point and its %.',
  /* VERBATIM from lib/style-slide.ts in Restylez. */
  '- Leave the BOTTOM-RIGHT corner (about 22% of the width, 16% of the height) free of text and important detail — a real logo will be placed there afterwards. Do NOT draw any logo yourself.',
  '- No fake logos, no brand marks, no watermarks. No lorem ipsum, no placeholder text.',
  '- Clean, modern, professional. Deep navy background, cyan and white type.',
].join('\n')

console.log('1. drawing on fal...')
const t0 = Date.now()
const r = await fetch('https://fal.run/openai/gpt-image-2.5/flare/text-to-image', {
  method: 'POST',
  headers: { authorization: `Key ${env.FAL_KEY}`, 'content-type': 'application/json' },
  body: JSON.stringify({ prompt: PROMPT, image_size: { width: 1920, height: 1088 }, quality: 'high', num_images: 1 }),
})
const txt = await r.text()
if (!r.ok) throw new Error(`${r.status}: ${txt.slice(0, 200)}`)
const url = JSON.parse(txt).images?.[0]?.url
const slide = Buffer.from(await (await fetch(url)).arrayBuffer())
const meta = await sharp(slide).metadata()
console.log(`   ${meta.width}x${meta.height} in ${((Date.now() - t0) / 1000).toFixed(1)}s`)

/* Is the reserved corner actually empty? Crop to a buffer FIRST — .stats()
   after .extract() reports whole-image numbers in this sharp version. */
const probe = await sharp(slide).extract({
  left: Math.round(meta.width * (1 - LOGO.w - LOGO.right)),
  top: Math.round(meta.height * (1 - LOGO.h - LOGO.bottom)),
  width: Math.round(meta.width * LOGO.w), height: Math.round(meta.height * LOGO.h),
}).toBuffer()
const spread = Math.max(...(await sharp(probe).stats()).channels.slice(0, 3).map((c) => c.stdev))
console.log(`2. reserved corner variation ${spread.toFixed(1)} — ${spread < 6 ? 'clear' : 'NOT CLEAR'}`)

console.log('3. pinning the real logo...')
const boxW = Math.round(meta.width * LOGO.w)
const logo = await sharp('public/logo-nav.png').resize({ width: boxW, fit: 'inside' }).toBuffer()
const lm = await sharp(logo).metadata()
const out = await sharp(slide).composite([{
  input: logo,
  left: meta.width - boxW - Math.round(meta.width * LOGO.right),
  top: meta.height - lm.height - Math.round(meta.height * LOGO.bottom),
}]).png().toBuffer()
writeFileSync('scripts/.bakeoff/fal-slide.png', out)
console.log('   -> scripts/.bakeoff/fal-slide.png')
