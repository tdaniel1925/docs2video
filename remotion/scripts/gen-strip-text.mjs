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

// Asking to "remove all text" only clears the small stuff — the model reads a
// giant stylised headline as artwork and leaves it standing. Framing the job as
// "produce the background plate, and the display type IS type" is what actually
// clears the whole layer.
const STRIP = `Produce the BLANK BACKGROUND PLATE version of this slide design.

A background plate is the artwork with the entire type layer switched off — the version a
designer works on before any words are placed. The finished plate must contain ZERO readable
characters anywhere. Not one letter, not one digit.

This includes the giant stylised display headline and any enormous currency or percentage
figure. Those are TYPE, not artwork — delete them completely. Also delete the small section
number, all labels, all caption text, all text inside sticker badges, all text inside coloured
panels, and all text inside the bottom bar.

Everything that is NOT type stays exactly where it is, unchanged: the photographed people and
their white cut-out outlines, the sky and gradient, the halftone and grain texture, any chart
columns, timeline bands, circles or panels, the coloured badge shapes (now empty), the bottom
bar (now an empty solid bar), and all shadows and lighting.

Where type used to sit, continue the background that was behind it — sky, gradient, texture,
flat colour — seamlessly, with no ghosting, blur patches, smears or letter fragments. Large
areas will simply become clean open background. That is correct and expected.

Add nothing. Output the same 16:9 widescreen image, type layer removed.`

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
