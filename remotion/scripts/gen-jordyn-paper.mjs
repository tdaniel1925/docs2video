// PAPER-CRAFT Jordyn ad — generate 8 Gemini cutout-paper illustrations following
// a recurring flat character ("Sam"), warm brand palette. Reuses the existing
// Rachel VO (public/jordyn/vo-*.mp3) + music. Writes p-0..p-7.png into
// public/jordyn-paper/.
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const OUT = join(HERE, '..', 'public', 'jordyn-paper')
mkdirSync(OUT, { recursive: true })
const FORCE = process.env.FORCE === '1'

const env = {}
for (const f of ['.env.local', '.env']) {
  const p = join(ROOT, f)
  if (existsSync(p)) for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !env[m[1]]) env[m[1]] = m[2].trim()
  }
}
const GEMINI = env.GEMINI_API_KEY
const IMG_MODEL = env.IMAGE_MODEL || 'gemini-3-pro-image-preview'
const log = (...a) => console.log(...a)

// Consistent paper-craft art direction + a recurring character description so
// the figure looks like the same person across scenes.
const STYLE = "Cut-paper craft illustration, handmade layered construction-paper collage, flat 2D characters with simple friendly features, visible torn and cut paper edges, soft realistic drop shadows between paper layers, subtle paper grain and fiber texture, warm color palette (cream #faf9f5 background, terracotta rust #c4623f, warm peach #e8b4a0, soft gold #e5d9a8, sage green #b6c4a2), gentle even lighting, charming and warm, editorial paper-craft advertising style, 16:9. NO text, NO letters, NO logos, NO words anywhere."
const SAM = "The recurring character 'Sam': a simple flat cut-paper person, round friendly head, minimal dot eyes, wearing a rust-and-cream outfit, same character in every scene."

const SCENES = [
  // 0 — overwhelmed by email
  `${STYLE} ${SAM} Scene: Sam sits at a small paper desk, overwhelmed and stressed, buried under an avalanche of many paper envelopes tumbling down around them, a cluttered chaotic morning, expression frazzled.`,
  // 1 — the blank box (other AI)
  `${STYLE} ${SAM} Scene: Sam stands looking puzzled at a large empty blank paper speech-box / empty card floating in front of them, a big empty rectangle of white paper, Sam scratching head, confused, question-mark feeling (no actual text).`,
  // 2 — the turn: a warm paper 'brain' / spark appears
  `${STYLE} ${SAM} Scene: a glowing warm terracotta paper brain-shape or radiant paper spark-star assembles from layered cut-paper pieces snapping together in front of a hopeful Sam, sense of an assistant arriving, warm light.`,
  // 3 — arrives fluent (paper tools/industry icons)
  `${STYLE} ${SAM} Scene: the paper assistant presents neat paper folders, paper documents, and a paper calendar to Sam, everything organized and labeled with blank paper tags, Sam looking pleasantly surprised.`,
  // 4 — it learns you (reads the inbox)
  `${STYLE} ${SAM} Scene: friendly paper envelopes flow in an orderly stream into a tidy paper inbox tray, the paper assistant sorting them, Sam watching calmly, a few envelopes turning into small organized paper cards.`,
  // 5 — it just works: tidy organized desk
  `${STYLE} ${SAM} Scene: Sam relaxed at a clean tidy paper desk holding a paper coffee cup, calm and happy, neat stacks of sorted paper folders, a small paper checklist with paper checkmarks beside them, peaceful morning.`,
  // 6 — answers the phone
  `${STYLE} ${SAM} Scene: a cheerful paper telephone rings with little paper sound-wave shapes, and a friendly paper assistant hand/figure answers it for Sam while Sam relaxes, warm and helpful.`,
  // 7 — finale: calm hero, open space for logo
  `${STYLE} ${SAM} Scene: Sam standing confident and happy in a calm open cream paper scene with a few floating warm paper shapes and a soft sunburst of cut-paper rays, generous empty space in the center-lower area for a logo, optimistic finale.`,
]

async function gen(i, prompt) {
  const f = join(OUT, `p-${i}.png`)
  if (!FORCE && existsSync(f)) { log(`p-${i} cached`); return }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${IMG_MODEL}:generateContent?key=${GEMINI}`
  for (let a = 0; a < 3; a++) {
    try {
      const r = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '16:9' } } }),
      })
      if (!r.ok) throw new Error(`${r.status}: ${(await r.text()).slice(0, 130)}`)
      const j = await r.json()
      const img = (j.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData?.data)
      if (!img) throw new Error('no image')
      writeFileSync(f, Buffer.from(img.inlineData.data, 'base64')); log(`p-${i} ok`); return
    } catch (e) { log(`p-${i} try${a + 1}: ${e.message}`); if (a < 2) await new Promise((s) => setTimeout(s, 2500)); else log(`p-${i} GIVE UP`) }
  }
}
const idx = SCENES.map((_, i) => i)
while (idx.length) { const b = idx.splice(0, 2); await Promise.all(b.map((i) => gen(i, SCENES[i]))) }
log('PAPER SCENES DONE')
