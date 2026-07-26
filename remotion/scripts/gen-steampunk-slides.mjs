// STEAMPUNK INSURANCE ILLUSTRATION — the original slide pipeline.
//
// Uses the app's REAL slide engine, not a reimplementation: buildSimpleSlidePrompt
// and getStylePrompt('steampunk') are imported from app/_lib/slide-engine so the
// look matches what the VPS produces for this template. Gemini renders each full
// slide; nothing is composited in code.
//
// COMPLIANCE: no carrier name, no product name, no logo. Client name and figures
// kept, agent-attributed, pointed back at the full illustration.
import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { build } from 'esbuild'
import { GoogleGenAI } from '@google/genai'

const HERE = dirname(fileURLToPath(import.meta.url)); const ROOT = join(HERE, '..', '..')
const OUT = join(HERE, '..', '.steampunk'); mkdirSync(OUT, { recursive: true })
const env = {}
for (const f of ['.env.local', '.env']) {
  const p = join(ROOT, f); if (!existsSync(p)) continue
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !env[m[1]]) env[m[1]] = m[2].trim()
  }
}
const genai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY })
const MODEL = env.IMAGE_MODEL || 'gemini-3-pro-image-preview'

// Pull the shipping prompt builder + style library out of the app.
const bundle = join(OUT, '_engine.mjs')
await build({
  entryPoints: [join(ROOT, 'app', '_lib', 'slide-engine', 'simple-prompt.ts')],
  bundle: true, format: 'esm', platform: 'node', outfile: bundle, logLevel: 'error',
})
const { buildSimpleSlidePrompt, getStylePrompt } = await import('file://' + bundle.replace(/\\/g, '/'))
const stylePrompt = getStylePrompt('steampunk')
console.log('[style]', stylePrompt, '\n')

// Brass + iron, so the generated palette stays inside the template's world.
const brandColors = { primary: '#D4A843', secondary: '#8C5A2B' }

/** Same six beats as the flyer deck, so the two are directly comparable. */
const SLIDES = [
  {
    type: 'cover', headline: 'Your Personal Illustration',
    subtitle: 'Prepared for Bill Propper',
    narrationContext: 'Hi Bill — thanks for your time. This is a short walk through the illustration we put together for you and your family.',
  },
  {
    type: 'content', headline: 'What You Put In',
    stats: [
      { label: 'Every year', value: '$15,000' },
      { label: 'Pay period', value: '20 Years' },
      { label: 'Total outlay', value: '$300,000' },
    ],
    bullets: [{ text: 'Your premium never increases' }, { text: 'Flexible after year ten' }],
    narrationContext: 'Fifteen thousand dollars a year for twenty years. Three hundred thousand total, and the premium never increases.',
  },
  {
    type: 'content', headline: 'What It Becomes',
    stats: [
      { label: 'Projected cash value', value: '$176,204' },
      { label: 'Participation rate', value: '98%' },
      { label: 'Floor in a down year', value: '0%' },
    ],
    bullets: [{ text: 'Projected values are not guaranteed' }],
    narrationContext: 'The illustration projects one hundred seventy six thousand two hundred and four dollars in cash value.',
  },
  {
    type: 'content', headline: 'What It Protects',
    bullets: [
      { text: 'Your family — a benefit paid directly to the people you name' },
      { text: 'Your income — access to value while living' },
      { text: 'Your plan — a floor under the account in a down year' },
    ],
    narrationContext: 'It protects three things at once: your family, your income, and your plan.',
  },
  {
    type: 'content', headline: 'The Road Ahead',
    stats: [
      { label: 'Start', value: 'Age 45' },
      { label: 'Building', value: 'Age 55' },
      { label: 'Access begins', value: 'Age 65' },
      { label: 'Legacy', value: 'Age 85' },
    ],
    narrationContext: 'You start at forty five. Value builds through your fifties. Access opens around sixty five.',
  },
  {
    type: 'closing', headline: 'Let’s Talk It Through',
    contactInfo: { phone: '1-555-014-2200', email: 'trent@example.com', website: 'example.com' },
    narrationContext: 'Take a look at the full illustration and call me any time.',
  },
]

async function gem(prompt, outPath) {
  for (let a = 0; a < 3; a++) {
    try {
      const r = await genai.models.generateContent({
        model: MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseFormat: { image: { aspectRatio: '16:9', imageSize: '2K' } } },
      })
      for (const p of (r.candidates?.[0]?.content?.parts ?? [])) {
        if (p.inlineData) { writeFileSync(outPath, Buffer.from(p.inlineData.data, 'base64')); return true }
      }
      throw new Error('no image in response')
    } catch (e) {
      console.log('  retry', a, String(e.message || e).slice(0, 110))
      if (a < 2) await new Promise((s) => setTimeout(s, 3000))
    }
  }
  return false
}

/** JPEG SOF parse — the API returns JPEG bytes whatever the filename says. */
function jpegSize(b) {
  let i = 2
  while (i < b.length) {
    if (b[i] !== 0xFF) { i++; continue }
    const m = b[i + 1]
    if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) {
      return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)]
    }
    i += 2 + b.readUInt16BE(i + 2)
  }
  return [0, 0]
}

let next = 0
async function worker() {
  for (;;) {
    const i = next++; if (i >= SLIDES.length) return
    const s = SLIDES[i]
    const out = join(OUT, `${String(i + 1).padStart(2, '0')}.png`)
    if (existsSync(out) && process.env.FORCE !== '1') { console.log('[slide] cached', i + 1); continue }
    const prompt = buildSimpleSlidePrompt({
      ...s, stylePrompt, brandColors,
      pageNumber: i + 1, totalPages: SLIDES.length,
    })
    // Aspect ratio comes back non-deterministically — a portrait page in a
    // landscape deck is unusable, so verify and retry rather than ship it.
    for (let attempt = 0; attempt < 3; attempt++) {
      const ok = await gem(prompt, out)
      if (!ok) { console.log('[slide]', i + 1, 'FAILED'); break }
      const [w, h] = jpegSize(readFileSync(out))
      if (w / h > 1.6) { console.log('[slide]', i + 1, `done ${w}x${h}`); break }
      console.log('[slide]', i + 1, `WRONG RATIO ${w}x${h} — regenerating`)
    }
  }
}
await Promise.all(Array.from({ length: 3 }, worker))
console.log('\nwrote', OUT)
