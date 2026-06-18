/**
 * Generates cinematic HERO images where the SUBJECT is deliberately on one side,
 * leaving the opposite side clean/darker for text. Writes public/hero-<n>.png.
 * Run: node scripts/generate-hero-images.mjs
 */
import { writeFile, mkdir, readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GoogleGenAI } from '@google/genai'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const PUBLIC = join(ROOT, 'public')

const CINE = 'Cinematic, photographic, premium advertising key art. Shallow depth of field, dramatic film lighting, rich contrast, warm casino tones (deep red, gold, cream). 16:9, fills 1920x1080. ABSOLUTELY NO text, words, letters, or logos anywhere.'

// Each: subject on a side, the OTHER side intentionally darker/empty for text.
const HEROS = [
  { name: 'hero-1', side: 'right', prompt: `${CINE} A glamorous woman in an elegant evening dress laughing with joy at a luxury casino party, positioned on the RIGHT THIRD of the frame, looking toward camera. The LEFT TWO-THIRDS is a softly blurred, darker casino background with empty negative space for text.` },
  { name: 'hero-2', side: 'left', prompt: `${CINE} A confident professional male dealer in a vest dealing cards at a casino table, positioned on the LEFT THIRD of the frame. The RIGHT TWO-THIRDS recedes into soft, darker bokeh with empty negative space for text.` },
  { name: 'hero-3', side: 'right', prompt: `${CINE} A close-up of elegant hands stacking glowing golden casino chips, the chips and hands on the RIGHT side, dramatic single-source light. The LEFT side falls into deep shadow with empty space for text.` },
]

async function getKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY
  const env = await readFile(join(ROOT, '..', '.env.local'), 'utf8')
  const m = env.match(/^GEMINI_API_KEY=(.+)$/m)
  if (m) return m[1].trim().replace(/^["']|["']$/g, '')
  throw new Error('GEMINI_API_KEY not found')
}

async function main() {
  const ai = new GoogleGenAI({ apiKey: await getKey() })
  await mkdir(PUBLIC, { recursive: true })
  const manifest = []
  for (const h of HEROS) {
    process.stdout.write(`${h.name} (${h.side})... `)
    let ok = false
    for (let a = 1; a <= 3 && !ok; a++) {
      try {
        const resp = await ai.models.generateContent({
          model: 'gemini-3-pro-image-preview',
          contents: [{ role: 'user', parts: [{ text: h.prompt }] }],
          config: { responseFormat: { image: { aspectRatio: '16:9', imageSize: '2K' } } },
        })
        const img = (resp.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData)
        if (!img) throw new Error('no image')
        await writeFile(join(PUBLIC, `${h.name}.png`), Buffer.from(img.inlineData.data, 'base64'))
        manifest.push({ image: `${h.name}.png`, focalSide: h.side })
        console.log('ok'); ok = true
      } catch (e) { console.log(`attempt ${a} failed: ${e.message?.slice(0, 70)}`); if (a < 3) await new Promise(r => setTimeout(r, 3000 * a)) }
    }
  }
  await writeFile(join(PUBLIC, 'heroes.json'), JSON.stringify(manifest, null, 2))
  console.log('Wrote public/heroes.json')
}
main().catch((e) => { console.error(e.message); process.exit(1) })
