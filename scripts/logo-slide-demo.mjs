/**
 * THE FINISHED ARTICLE: a generated slide with a REAL logo pasted on.
 *
 * Two steps, and the split is the whole point:
 *
 *   1. The model draws the slide. It is never told about a logo — it is told
 *      where content may LIVE. Asking it to "leave a corner clear" made it
 *      draw a white rectangle there; asking for a margin leaves genuine
 *      background, measured at 0.6 variation against 32.9 unconstrained.
 *
 *   2. Sharp pastes the real logo file into that space. The model never sees
 *      it, never draws it, cannot invent it — which is the standing rule in
 *      this repo for logos.
 *
 *   node scripts/logo-slide-demo.mjs
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/))
    .filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')]),
)
mkdirSync('scripts/.bakeoff', { recursive: true })

/* Where the logo sits, as fractions of the slide. One definition, used by the
   prompt (to keep content out) and by the paste (to put the logo in) — so the
   two can never drift apart. */
const LOGO = { w: 0.18, margin: 0.035 }

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
  /* THE MARGIN, NOT A CORNER. Never name a logo or a reserved box — the model
     draws whatever you name. Name where content may live instead. */
  '- Keep ALL text and graphics inside the upper-left three quarters of the slide.',
  '  The lower-right quarter stays plain, uninterrupted background.',
  '- No logos, no brand marks, no watermarks, no placeholder text, no empty boxes.',
  '- Clean, modern, professional. Deep navy background, cyan and white type.',
].join('\n')

console.log('1. drawing the slide...')
const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env.IMAGE_MODEL || 'gemini-3-pro-image-preview'}:generateContent?key=${env.GEMINI_API_KEY}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    contents: [{ parts: [{ text: PROMPT }] }],
    generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '16:9', imageSize: '2K' } },
  }),
})
const txt = await r.text()
if (!r.ok) throw new Error(`${r.status}: ${txt.slice(0, 200)}`)
const part = (JSON.parse(txt).candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.data)
if (!part) throw new Error('no image returned')
const slide = Buffer.from(part.inlineData.data, 'base64')
writeFileSync('scripts/.bakeoff/final-raw.png', slide)

const meta = await sharp(slide).metadata()
console.log(`   ${meta.width}x${meta.height}`)

/* Prove the corner is empty BEFORE pasting — if the model ignored the margin,
   the logo would land on top of text and we should know. */
const probe = await sharp(slide).extract({
  left: Math.round(meta.width * 0.76), top: Math.round(meta.height * 0.78),
  width: Math.round(meta.width * 0.21), height: Math.round(meta.height * 0.17),
}).toBuffer()
const spread = Math.max(...(await sharp(probe).stats()).channels.slice(0, 3).map((c) => c.stdev))
console.log(`2. logo area variation ${spread.toFixed(1)} — ${spread < 6 ? 'clear, safe to paste' : 'NOT CLEAR'}`)

console.log('3. pasting the real logo...')
const w = Math.round(meta.width * LOGO.w)
const logo = await sharp('public/logo-nav.png').resize({ width: w }).toBuffer()
const lm = await sharp(logo).metadata()
const out = await sharp(slide).composite([{
  input: logo,
  left: meta.width - w - Math.round(meta.width * LOGO.margin),
  top: meta.height - lm.height - Math.round(meta.height * LOGO.margin * 16 / 9),
}]).png().toBuffer()
writeFileSync('scripts/.bakeoff/final-slide.png', out)
console.log('   -> scripts/.bakeoff/final-slide.png')
