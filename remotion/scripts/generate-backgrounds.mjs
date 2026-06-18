/**
 * Generates one concrete, on-topic Gemini background image per scene into
 * public/bg-<scene>.png. NO text on the images (Remotion adds all text); the
 * CENTER is kept calm so overlaid cards/titles stay readable. Brand palette baked in.
 *
 * Run: node scripts/generate-backgrounds.mjs
 * Reads GEMINI_API_KEY from ../.env.local or the environment.
 */
import { writeFile, mkdir, readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GoogleGenAI } from '@google/genai'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const PUBLIC = join(ROOT, 'public')

// Brand palette hint for the imagery (iHostPoker casino: deep red, gold, cream).
const PALETTE = 'deep casino red (#1A0608 to #C8102E), rich gold (#D4AF37), warm cream highlights; cinematic, premium, moody lighting'
const COMMON = `Cinematic, premium, high-end photographic background. ${PALETTE}. Shallow depth of field, soft bokeh, dramatic rim lighting, lots of negative space and depth. The CENTER of the frame must be visually calm, darker and uncluttered (large text and cards will be overlaid there). ABSOLUTELY NO text, no words, no letters, no logos, no numbers anywhere. 16:9, fills the whole 1920x1080 frame.`

const SCENES = {
  cover: `${COMMON} Subject: an elegant, dramatic casino party scene from a distance — a luxurious event hall with casino tables, warm golden glow, blurred guests, sense of occasion and excitement.`,
  pillars: `${COMMON} Subject: a moody close-up of a premium casino table felt with stacks of chips and playing cards catching the light, deep shadows, dark calm center.`,
  stat: `${COMMON} Subject: a striking abstract of golden casino chips cascading / stacking against a deep red-black void, dramatic single-source lighting, very dark calm center for a big number.`,
  bullets: `${COMMON} Subject: an upscale event setup — elegant tables and ambient party lighting receding into darkness on the right, calm darker area on the left/center for a list.`,
  closing: `${COMMON} Subject: a warm, inviting wide shot of a casino event winding down, soft golden glow, hopeful conclusive mood, dark calm center.`,
}

async function getKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY
  try {
    const env = await readFile(join(ROOT, '..', '.env.local'), 'utf8')
    const m = env.match(/^GEMINI_API_KEY=(.+)$/m)
    if (m) return m[1].trim().replace(/^["']|["']$/g, '')
  } catch {}
  throw new Error('GEMINI_API_KEY not found (env or ../.env.local)')
}

async function main() {
  const ai = new GoogleGenAI({ apiKey: await getKey() })
  await mkdir(PUBLIC, { recursive: true })
  for (const [scene, prompt] of Object.entries(SCENES)) {
    process.stdout.write(`BG ${scene}... `)
    let ok = false
    for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
      try {
        const resp = await ai.models.generateContent({
          model: 'gemini-3-pro-image-preview',
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: { responseFormat: { image: { aspectRatio: '16:9', imageSize: '2K' } } },
        })
        const parts = resp.candidates?.[0]?.content?.parts ?? []
        const img = parts.find((p) => p.inlineData)
        if (!img) throw new Error('no image in response')
        await writeFile(join(PUBLIC, `bg-${scene}.png`), Buffer.from(img.inlineData.data, 'base64'))
        console.log('ok')
        ok = true
      } catch (e) {
        console.log(`attempt ${attempt} failed: ${e.message?.slice(0, 80)}`)
        if (attempt < 3) await new Promise((r) => setTimeout(r, 3000 * attempt))
      }
    }
    if (!ok) console.log(`  ${scene}: FAILED — scene will fall back to mesh glow`)
  }
  console.log('Backgrounds done.')
}

main().catch((e) => { console.error(e.message); process.exit(1) })
