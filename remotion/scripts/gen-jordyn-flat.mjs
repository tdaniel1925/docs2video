// FLAT-EDITORIAL Jordyn ad — Gemini scenes matching the jordyn.app illustration
// style: soft muted flat vector, warm cream/terracotta/sage, gentle geometric
// shapes, subtle grain, calm professional characters. Same story. Reuses VO+music.
// Writes f-0..f-7.png into public/jordyn-flat/.
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const OUT = join(HERE, '..', 'public', 'jordyn-flat')
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

// Art direction matched to the jordyn.app hero illustrations (woman w/ tablet;
// coffee by the window): FLAT modern editorial vector illustration, soft muted.
const STYLE = "Flat modern editorial vector illustration in a soft, warm, muted style. Limited palette: warm cream #faf9f5 background, terracotta rust #c4623f, warm tan #d8a07a, sage green #b6c4a2, soft gold #e5d9a8, muted charcoal #4a3f35. Gentle soft shadows, simple rounded organic shapes, subtle film grain texture, calm and premium, generous negative space, tasteful and professional — like a high-end SaaS brand illustration. Soft ambient lighting. 16:9. NO text, NO letters, NO logos, NO UI, NO words."
const CHAR = "A friendly professional character drawn in this same flat editorial style — simple clean features, warm skin tone, wearing a terracotta blazer, calm and approachable (consistent character across scenes)."

const SCENES = [
  // 0 — overwhelmed by email (but tasteful/flat, not chaotic paper)
  `${STYLE} ${CHAR} Scene: the professional sits at a tidy desk looking a little overwhelmed, surrounded by softly floating flat envelope shapes and notification dots, a large stylized inbox, early-morning window light. Calm-but-busy mood.`,
  // 1 — the blank box (other AI)
  `${STYLE} ${CHAR} Scene: the professional faces a large empty rounded chat/prompt panel floating in soft space, a blank card with a small blinking cursor shape, they look uncertain, a subtle question-mark motif. Minimal and clean.`,
  // 2 — the turn: a warm glowing brain/spark orb
  `${STYLE} Scene: a warm glowing terracotta orb or soft stylized 'brain' icon of light radiating gentle rays, floating in a calm cream space with soft sage leaf shapes around it, a sense of a helpful assistant arriving. No character, hero icon, generous space.`,
  // 3 — arrives fluent (industry tools)
  `${STYLE} ${CHAR} Scene: the professional smiles as neat flat folders, a calendar, and document cards float in an organized arc around them, everything tidy and labeled with blank tags, confident and pleased.`,
  // 4 — it learns you (reads the inbox)
  `${STYLE} ${CHAR} Scene: flat envelope shapes flow in an orderly stream into a tidy inbox tray beside the calm professional, a few turning into small organized contact cards, a sense of the assistant sorting everything.`,
  // 5 — it just works: calm, coffee, sorted (echo the site's coffee-window image)
  `${STYLE} Scene: a serene desk by a large window with soft morning light, a steaming coffee cup, a small potted plant, a tidy stack of sorted folders and a checklist with checkmarks — calm and peaceful, in the exact soft flat editorial style of the reference. No character, ambient scene.`,
  // 6 — answers the phone
  `${STYLE} ${CHAR} Scene: the professional relaxes while a friendly stylized phone with soft sound-wave arcs is answered by a glowing assistant presence, warm and effortless, calm expression.`,
  // 7 — finale: confident hero (echo the site's woman-with-tablet), room for logo
  `${STYLE} ${CHAR} Scene: the confident professional stands calmly holding a tablet, soft sage leaf shapes behind them in a rounded frame, warm and self-assured, generous empty cream space in the lower center for a logo. Optimistic, premium.`,
]

async function gen(i, prompt) {
  const f = join(OUT, `f-${i}.png`)
  if (!FORCE && existsSync(f)) { log(`f-${i} cached`); return }
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
      writeFileSync(f, Buffer.from(img.inlineData.data, 'base64')); log(`f-${i} ok`); return
    } catch (e) { log(`f-${i} try${a + 1}: ${e.message}`); if (a < 2) await new Promise((s) => setTimeout(s, 2500)); else log(`f-${i} GIVE UP`) }
  }
}
const idx = SCENES.map((_, i) => i)
while (idx.length) { const b = idx.splice(0, 2); await Promise.all(b.map((i) => gen(i, SCENES[i]))) }
log('FLAT SCENES DONE')
