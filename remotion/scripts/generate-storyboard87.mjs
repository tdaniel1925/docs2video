/** Generates the 4 cinematic backgrounds for the "87 Pages" storyboard.
 *  Premium look: dark navy, neon-green volumetric glow. Writes public/sb-*.png */
import { writeFile, mkdir, readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GoogleGenAI } from '@google/genai'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const PUBLIC = join(ROOT, 'public')

const LOOK = 'Cinematic film still, dramatic dark navy background, volumetric neon-green light glow and green light streaks, premium SaaS/tech aesthetic, shallow depth of field, moody low-key lighting, subtle particles, deep negative space. Photoreal, NOT illustration. 16:9, fills 1920x1080. ABSOLUTELY NO text, words, letters, numbers, charts, or logos anywhere.'

const IMAGES = [
  { name: 'sb-pages', prompt: 'A dramatic stack of dense insurance illustration paper documents floating/levitating on a dark desk, edges catching neon-green rim light, papers slightly fanned, deep shadows. Center-right composition, dark calm left side.' },
  { name: 'sb-agent', prompt: 'A stressed insurance agent at a dark desk at night, hand on forehead, glow of a laptop on his face, looking overwhelmed. Positioned on the RIGHT, the LEFT side dark and empty.' },
  { name: 'sb-client', prompt: 'A relaxed, smiling professional woman watching something on a tablet on a couch, warm soft light, reassured expression, premium lifestyle. Centered subject.' },
  { name: 'sb-close', prompt: 'An abstract sweeping neon-green light ray crossing a dark navy void with floating particles and bokeh, sense of momentum and arrival, very dark calm center for text.' },
]

async function getKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY
  const e = await readFile(join(ROOT, '..', '.env.local'), 'utf8')
  const m = e.match(/^GEMINI_API_KEY=(.+)$/m)
  if (m) return m[1].trim().replace(/^["']|["']$/g, '')
  throw new Error('GEMINI_API_KEY not found')
}

async function main() {
  const ai = new GoogleGenAI({ apiKey: await getKey() })
  await mkdir(PUBLIC, { recursive: true })
  for (const im of IMAGES) {
    process.stdout.write(`${im.name}... `)
    let ok = false
    for (let a = 1; a <= 3 && !ok; a++) {
      try {
        const r = await ai.models.generateContent({
          model: 'gemini-3-pro-image-preview',
          contents: [{ role: 'user', parts: [{ text: `${im.prompt}\n\n${LOOK}` }] }],
          config: { responseFormat: { image: { aspectRatio: '16:9', imageSize: '2K' } } },
        })
        const img = (r.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData)
        if (!img) throw new Error('no image')
        await writeFile(join(PUBLIC, `${im.name}.png`), Buffer.from(img.inlineData.data, 'base64'))
        ok = true; console.log('ok')
      } catch (e) { console.log(`attempt ${a}: ${e.message?.slice(0, 60)}`); if (a < 3) await new Promise((r) => setTimeout(r, 3000 * a)) }
    }
  }
  console.log('done')
}
main().catch((e) => { console.error(e.message); process.exit(1) })
