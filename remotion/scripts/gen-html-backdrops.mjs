// Gemini abstract DATA/TECH backdrops for the Apex comp HTML explainer.
// 8 dark navy/red glowing data-viz scenes (light streaks, particles, soft grids),
// designed to sit BEHIND code-drawn charts. Writes public/htmlaudio/bd-N.png.
import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { GoogleGenAI } from '@google/genai'
const HERE = dirname(fileURLToPath(import.meta.url)); const ROOT = join(HERE, '..', '..')
const OUT = join(HERE, '..', 'public', 'htmlaudio'); mkdirSync(OUT, { recursive: true })
const FORCE = process.env.FORCE === '1'
const env = {}; for (const f of ['.env.local', '.env']) { for (const base of [ROOT, join(HERE, '..')]) { const p = join(base, f); if (existsSync(p)) for (const line of readFileSync(p, 'utf8').split('\n')) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !env[m[1]]) env[m[1]] = m[2].trim() } } }
const GEMINI = env.GEMINI_API_KEY, IMAGE_MODEL = env.IMAGE_MODEL || 'gemini-3-pro-image-preview'
const genai = new GoogleGenAI({ apiKey: GEMINI })
const log = (...a) => console.log('[bd]', ...a)

const BASE = "Abstract data-visualization tech background, 16:9, deep navy blue (#132649 to #1e3a70) with subtle crimson red (#c0272d) accents. Dark, premium, atmospheric. Glowing thin light streaks, soft particle bokeh, a faint perspective grid receding into depth, gentle volumetric glow, elegant and modern analytics aesthetic. MUTED and DARK overall (this is a BACKDROP behind bright text/charts) — keep the CENTER darker and calmer so overlaid content stays readable. CRITICAL: absolutely NO text, NO words, NO numbers, NO letters, NO real chart labels — abstract shapes and light only.";
const SCENES = [
  "soft radiant glow rising from the horizon, a welcoming premium opening.",
  "a single glowing data node with light connections branching out, one key concept.",
  "two streams of glowing light particles flowing and merging, two paths converging.",
  "an ascending staircase of light bars climbing into the dark, rising ranks.",
  "layered translucent depth planes receding, deeper and deeper levels of light.",
  "a warm burst of golden-red light particles scattering upward, a reward moment.",
  "a steady pulsing ring of light, consistency and rhythm.",
  "an expansive bright horizon of light with upward streaks, an aspirational finish.",
]

async function gem(prompt, outPath) {
  for (let a = 0; a < 3; a++) {
    try {
      const r = await genai.models.generateContent({ model: IMAGE_MODEL, contents: [{ role: 'user', parts: [{ text: prompt }] }], config: { responseFormat: { image: { aspectRatio: '16:9', imageSize: '2K' } } } })
      const parts = r.candidates?.[0]?.content?.parts ?? []
      for (const p of parts) { if (p.inlineData) { writeFileSync(outPath, Buffer.from(p.inlineData.data, 'base64')); return true } }
      throw new Error('no image')
    } catch (e) { log('retry', a, String(e.message || e).slice(0, 70)); if (a < 2) await new Promise((s) => setTimeout(s, 2500)) }
  }
  return false
}
for (let i = 0; i < SCENES.length; i++) {
  const f = join(OUT, `bd-${i}.png`); if (!FORCE && existsSync(f)) { log(`bd-${i} cached`); continue }
  const ok = await gem(`${BASE}\n\nComposition: ${SCENES[i]}`, f); log(`bd-${i} ${ok ? 'ok' : 'FAILED'}`)
}
log('BACKDROPS DONE')
