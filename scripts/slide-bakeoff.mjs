/**
 * WHICH ENGINE SHOULD DRAW AN EXPLAINER SLIDE?
 *
 * An infographic slide is almost entirely TEXT AND NUMBERS, which is exactly
 * where this repo has measured Gemini failing twice ("3/12 right after three
 * tries each"). Before switching the slides path, measure the same slide on
 * both engines rather than trusting either note.
 *
 *   node scripts/slide-bakeoff.mjs
 *
 * Writes PNGs to scripts/.bakeoff/ and prints cost + time. Reading the words
 * back is a human job — open the files.
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/))
    .filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')]),
)
mkdirSync('scripts/.bakeoff', { recursive: true })

/*
 * THE HARD CASE, because the easy one told us nothing.
 *
 * A first run used three round figures and three two-word labels. BOTH
 * engines drew every character correctly, which is not a result — it is a
 * test that could not fail. Three numbers on a dark ground is not where an
 * image model breaks.
 *
 * A real explainer slide is a BULLETED one: full sentences, proper nouns, a
 * date, an arrow, a decimal and a percentage in the same line. That is where
 * this repo has measured models turning a real word into a DIFFERENT real
 * word — the failure that survives a glance and gets found by the customer's
 * customer.
 */
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
  '- Use ONLY the words and numbers above. Spell every word exactly. Invent nothing, drop nothing.',
  '- Every figure keeps its $ sign, its commas, its decimal point and its % exactly as written.',
  '- Leave the BOTTOM-RIGHT CORNER clear — a logo is placed there afterwards by code.',
  '- No fake logos, no brand marks, no watermarks, no placeholder text.',
  '- Clean, modern, professional. Deep navy background, cyan and white type.',
].join('\n')

const t = async (label, fn) => {
  const t0 = Date.now()
  try {
    const buf = await fn()
    const ms = Date.now() - t0
    const out = `scripts/.bakeoff/hi-${label}.png`
    writeFileSync(out, buf)
    console.log(`${label.padEnd(8)} ${String(ms / 1000).padStart(6)}s  ${(buf.length / 1024).toFixed(0)}KB  -> ${out}`)
  } catch (e) {
    console.log(`${label.padEnd(8)} FAILED: ${(e.message || e).toString().slice(0, 120)}`)
  }
}

await t('fal', async () => {
  const r = await fetch('https://fal.run/openai/gpt-image-2.5/flare/text-to-image', {
    method: 'POST',
    headers: { authorization: `Key ${env.FAL_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: PROMPT, image_size: { width: 1920, height: 1088 }, quality: 'high', num_images: 1 }),
  })
  const txt = await r.text()
  if (!r.ok) throw new Error(`${r.status}: ${txt.slice(0, 200)}`)
  const url = JSON.parse(txt).images?.[0]?.url
  if (!url) throw new Error('no image in response')
  return Buffer.from(await (await fetch(url)).arrayBuffer())
})

await t('gemini', async () => {
  const model = env.IMAGE_MODEL || 'gemini-3-pro-image-preview'
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: PROMPT }] }],
      generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "16:9", imageSize: "4K" } },
    }),
  })
  const txt = await r.text()
  if (!r.ok) throw new Error(`${r.status}: ${txt.slice(0, 200)}`)
  const parts = JSON.parse(txt).candidates?.[0]?.content?.parts ?? []
  const img = parts.find((p) => p.inlineData?.data)
  if (!img) throw new Error('no image in response')
  return Buffer.from(img.inlineData.data, 'base64')
})
