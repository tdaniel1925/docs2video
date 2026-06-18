/** Subject-on-a-side corporate photos for the premium composed scenes.
 *  Writes public/pp-<n>.png. Run: node scripts/generate-premium-photos.mjs */
import { writeFile, mkdir, readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GoogleGenAI } from '@google/genai'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const PUBLIC = join(ROOT, 'public')

const CINE = 'Cinematic corporate photography, premium, professional, soft natural lighting, shallow depth of field. 16:9, fills 1920x1080. ABSOLUTELY NO text, words, letters, numbers, or logos anywhere.'

const PHOTOS = [
  { name: 'pp-1', prompt: `${CINE} A confident professional woman (educator/administrator) standing facing a bright modern classroom of adults, seen from behind-three-quarter, positioned on the RIGHT side of the frame. Left side recedes into soft, darker office bokeh with empty negative space.` },
  { name: 'pp-2', prompt: `${CINE} A warm portrait of a financial advisor reviewing documents with a client at a sunlit desk, positioned on the LEFT side of the frame. Right side falls into soft darker background with empty negative space.` },
  { name: 'pp-3', prompt: `${CINE} A happy multigenerational family relaxing together at home, warm and reassuring, positioned on the RIGHT side of the frame. Left side soft, darker, empty negative space for text.` },
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
  for (const p of PHOTOS) {
    process.stdout.write(`${p.name}... `)
    let ok = false
    for (let a = 1; a <= 3 && !ok; a++) {
      try {
        const resp = await ai.models.generateContent({
          model: 'gemini-3-pro-image-preview',
          contents: [{ role: 'user', parts: [{ text: p.prompt }] }],
          config: { responseFormat: { image: { aspectRatio: '16:9', imageSize: '2K' } } },
        })
        const img = (resp.candidates?.[0]?.content?.parts ?? []).find((x) => x.inlineData)
        if (!img) throw new Error('no image')
        await writeFile(join(PUBLIC, `${p.name}.png`), Buffer.from(img.inlineData.data, 'base64'))
        console.log('ok'); ok = true
      } catch (e) { console.log(`attempt ${a}: ${e.message?.slice(0, 60)}`); if (a < 3) await new Promise(r => setTimeout(r, 3000 * a)) }
    }
  }
  console.log('done')
}
main().catch((e) => { console.error(e.message); process.exit(1) })
