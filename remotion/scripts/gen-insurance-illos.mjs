// Custom per-deck illustrations in the LOCKED jordyn editorial style —
// subjects come from the insurance illustration content; accent = brand color.
import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { GoogleGenAI } from '@google/genai'
const HERE = dirname(fileURLToPath(import.meta.url)); const ROOT = join(HERE, '..', '..')
const OUT = join(HERE, '..', '.ins-illos'); mkdirSync(OUT, { recursive: true })
const env = {}; for (const f of ['.env.local', '.env']) { const p = join(ROOT, f); if (existsSync(p)) for (const line of readFileSync(p, 'utf8').split('\n')) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !env[m[1]]) env[m[1]] = m[2].trim() } }
const genai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY })
const MODEL = env.IMAGE_MODEL || 'gemini-3-pro-image-preview'

// The LOCKED style — identical to the jordyn demo art, with the ACCENT as the
// brand variable (here: an advisor's deep steel blue instead of terracotta).
const ACCENT = 'deep steel blue (#2E5F8A)'
const ACCENT_SOFT = 'soft ice blue (#DFE9F3)'
const STYLE = `Flat modern editorial spot illustration in a warm, cozy business style. ` +
  `Palette: soft cream background (#FAF9F5), ${ACCENT} as the main accent, ` +
  `muted sage green, ${ACCENT_SOFT}, warm charcoal-brown line work (#3D3929). ` +
  `Soft rounded organic shapes, gentle grain/texture, subtle warm shadows, hand-crafted friendly feel — ` +
  `like a premium SaaS brand illustration (Notion / Intercom warmth). Centered single subject, generous margins, ` +
  `calm and inviting. Square composition on a plain soft-cream field so it sits inside a rounded card. ` +
  `CRITICAL: absolutely NO text, NO words, NO letters, NO numbers, NO UI mockups with readable labels — pure illustration only.`

const ILLOS = {
  cover: 'a family of three soft rounded figures standing together under a large sheltering tree, warm calm light — protection and belonging.',
  decision: 'a single figure at a gentle crossroads with a small signpost, one path leading toward a soft glowing shield — a good decision being made.',
  benefit: 'a large soft rounded shield with a heart at its center, gently sheltering two small figures beneath it — a family protected.',
  cost: 'a friendly coffee cup beside a small neat stack of coins and a soft calendar page — an everyday, manageable cost.',
  growth: 'a young plant growing up along a softly rising curve, protected under a clear glass dome — growth with a floor beneath it.',
  living: 'two gentle open hands holding a soft glowing heart with a small leaf — benefits you can use while living.',
  ages: 'a warm hourglass beside a long winding path leading toward a soft distant sun — time, horizons, and a promise kept.',
  cta: 'a friendly telephone handset with warm rising sound-waves and a small sunrise behind it — an inviting call.',
}

async function gem(prompt, outPath) {
  for (let a = 0; a < 3; a++) {
    try {
      const r = await genai.models.generateContent({ model: MODEL, contents: [{ role: 'user', parts: [{ text: prompt }] }], config: { responseFormat: { image: { aspectRatio: '1:1', imageSize: '1K' } } } })
      const parts = r.candidates?.[0]?.content?.parts ?? []
      for (const p of parts) { if (p.inlineData) { writeFileSync(outPath, Buffer.from(p.inlineData.data, 'base64')); return true } }
      throw new Error('no image')
    } catch (e) { console.log('[illo] retry', a, String(e.message || e).slice(0, 90)); if (a < 2) await new Promise((s) => setTimeout(s, 2500)) }
  }
  return false
}

for (const [key, subject] of Object.entries(ILLOS)) {
  const out = join(OUT, `${key}.png`)
  if (existsSync(out) && process.env.FORCE !== '1') { console.log('[illo] cached', key); continue }
  const ok = await gem(`${STYLE}\n\nSubject: ${subject}`, out)
  console.log('[illo]', key, ok ? 'done' : 'FAILED')
}
