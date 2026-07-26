// TEXT-STRIP PASS — turn each finished Gemini slide into a clean background
// plate with all type removed, so Remotion can lay real, editable, animated
// text back on top in the same positions.
//
// The trick is that we do NOT regenerate from the original prompt (that would
// produce a different composition). We feed the FINISHED SLIDE back to Gemini
// as an image and ask it to inpaint the type away, leaving artwork, people,
// bars, badges and lighting untouched. The slide we already have becomes the
// layout guide; this is the same slide minus the words.
import { readFileSync, mkdirSync, existsSync, writeFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { GoogleGenAI } from '@google/genai'

const HERE = dirname(fileURLToPath(import.meta.url)); const ROOT = join(HERE, '..', '..')
const SRC = join(HERE, '..', process.env.SLIDES_DIR || '.illus-flyer')
const OUT = join(HERE, '..', (process.env.SLIDES_DIR || '.illus-flyer') + '-plate')
mkdirSync(OUT, { recursive: true })

const env = {}
for (const f of ['.env.local', '.env']) {
  const p = join(ROOT, f); if (!existsSync(p)) continue
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !env[m[1]]) env[m[1]] = m[2].trim()
  }
}
const genai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY })
const MODEL = env.IMAGE_MODEL || 'gemini-3-pro-image-preview'

const STRIP = `Edit this presentation slide image: REMOVE ALL TEXT from it, completely.

Remove every letter, word, number, currency figure, percentage and caption anywhere in the
image — including text inside sticker badges, text inside the bottom information bar, section
numbers, headlines, labels and any small print.

Keep absolutely everything else EXACTLY as it is, pixel for pixel where possible:
• the photographic people and their white cut-out stroke outlines
• the background sky, gradient, halftone dot texture and paper grain
• every coloured shape — the badges, the bars, the panels, the chart columns, the circles —
  must all REMAIN in place at the same size, position, rotation and colour. Keep the empty
  badge shapes and the empty bottom bar as blank coloured shapes.
• all lighting, shadows and drop shadows

Where text used to be, cleanly and seamlessly fill in whatever was behind it — the sky, the
gradient, the flat badge colour, the flat bar colour, the texture — so the result looks like a
finished background plate that simply never had any type on it. No smudges, no ghosting, no
blurred patches, no leftover letter fragments.

Do not add anything new. Do not add any text. Do not change the composition or the colours.
Output the same 16:9 widescreen image with the type removed.`

async function strip(srcPath, outPath) {
  const b64 = readFileSync(srcPath).toString('base64')
  for (let a = 0; a < 3; a++) {
    try {
      const r = await genai.models.generateContent({
        model: MODEL,
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: b64 } },
            { text: STRIP },
          ],
        }],
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

const files = readdirSync(SRC).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort()
let next = 0
async function worker() {
  for (;;) {
    const i = next++; if (i >= files.length) return
    const f = files[i]
    const out = join(OUT, f)
    if (existsSync(out) && process.env.FORCE !== '1') { console.log('[plate] cached', f); continue }
    const ok = await strip(join(SRC, f), out)
    console.log('[plate]', f, ok ? 'done' : 'FAILED')
  }
}
await Promise.all(Array.from({ length: 3 }, worker))
console.log('\nwrote', OUT)
