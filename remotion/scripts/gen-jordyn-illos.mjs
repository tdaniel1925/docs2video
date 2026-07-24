// Gemini on-brand spot illustrations in Jordyn's exact editorial style.
// Warm cream + terracotta, flat soft-rounded, cozy business motifs, NO text.
// One per feature/section -> public/jordyn/illo-<key>.png
import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { GoogleGenAI } from '@google/genai'
const HERE = dirname(fileURLToPath(import.meta.url)); const ROOT = join(HERE, '..', '..')
const OUT = join(HERE, '..', 'public', 'jordyn'); mkdirSync(OUT, { recursive: true })
const FORCE = process.env.FORCE === '1'
const ONLY = process.env.ONLY // comma keys
const env = {}; for (const f of ['.env.local', '.env']) { for (const base of [ROOT, join(HERE, '..')]) { const p = join(base, f); if (existsSync(p)) for (const line of readFileSync(p, 'utf8').split('\n')) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !env[m[1]]) env[m[1]] = m[2].trim() } } }
const GEMINI = env.GEMINI_API_KEY, IMAGE_MODEL = env.IMAGE_MODEL || 'gemini-3-pro-image-preview'
const genai = new GoogleGenAI({ apiKey: GEMINI })
const log = (...a) => console.log('[illo]', ...a)

// Reproduce the jordyn.app spot-illustration style precisely.
const STYLE = "Flat modern editorial spot illustration in a warm, cozy business style. " +
  "Palette: soft cream background (#FAF9F5), warm terracotta / burnt-orange (#C96442) as the main accent, " +
  "muted sage green, soft peach (#F5E6DF), warm charcoal-brown line work (#3D3929). " +
  "Soft rounded organic shapes, gentle grain/texture, subtle warm shadows, hand-crafted friendly feel — " +
  "like a premium SaaS brand illustration (Notion / Intercom warmth). Centered single subject, generous margins, " +
  "calm and inviting. Square composition on a plain soft-cream field so it sits inside a rounded card. " +
  "CRITICAL: absolutely NO text, NO words, NO letters, NO numbers, NO UI mockups with readable labels — pure illustration only."

const ILLOS = {
  hero: "a friendly professional woman at a tidy warm desk with a laptop and a coffee, a soft plant nearby, calm morning light — the feeling of a business handled.",
  step1: "a single hand pointing at a small signpost of industry icons (a house, a shield, a wrench) — choosing your industry.",
  step2: "a glowing brain-shaped shape made of soft interlocking puzzle pieces clicking into a slot — an installing 'brain'.",
  step3: "a warm speech bubble and a heart connecting to a small figure — an assistant learning a person.",
  email: "a cozy stack of tidy envelopes and a paper airplane lifting off, one envelope glowing — an inbox handled.",
  phone: "a friendly desk phone / smartphone with a soft sound-wave ring and a small headset — a call being answered warmly.",
  paperwork: "a neat stack of documents with a checkmark seal and a fountain pen — verified paperwork on letterhead.",
  clients: "a set of small folders each with a tiny portrait, grouped together — client workspaces.",
  pipeline: "a rising set of soft rounded bars / a funnel with little tokens flowing down — a self-building pipeline.",
  automation: "interlocking soft gears with a little spark and a play button — plain-English automations running.",
  invoice: "a friendly invoice card with a coin and a card-tap symbol — getting paid in one sentence.",
  booking: "a small calendar page with a soft checkmark and a clock — a booking page.",
  memory: "an open filing drawer glowing softly with a magnifying glass finding one file — every file remembered.",
  voice: "a small microphone with warm sound waves — dictate, don't type.",
  brain: "a cross-section of a friendly rounded head with swappable modular blocks inside — the swappable brain.",
  security: "a soft rounded shield with a keyhole and a gentle glow, cozy not corporate — trust and security.",
  integrations: "a central warm hub with many little app tiles orbiting it on soft connecting lines — connects with your tools.",
  pricing: "three warm rounded pricing tiers as friendly stacked platforms of increasing height — simple pricing.",
  cta: "a bright optimistic sunrise over a tidy desk with a laptop, a warm inviting finish — get started.",
}

async function gem(prompt, outPath) {
  for (let a = 0; a < 3; a++) {
    try {
      const r = await genai.models.generateContent({ model: IMAGE_MODEL, contents: [{ role: 'user', parts: [{ text: prompt }] }], config: { responseFormat: { image: { aspectRatio: '1:1', imageSize: '2K' } } } })
      const parts = r.candidates?.[0]?.content?.parts ?? []
      for (const p of parts) { if (p.inlineData) { writeFileSync(outPath, Buffer.from(p.inlineData.data, 'base64')); return true } }
      throw new Error('no image')
    } catch (e) { log('retry', a, String(e.message || e).slice(0, 80)); if (a < 2) await new Promise((s) => setTimeout(s, 2500)) }
  }
  return false
}

const keys = ONLY ? ONLY.split(',') : Object.keys(ILLOS)
for (const k of keys) {
  const f = join(OUT, `illo-${k}.png`)
  if (!FORCE && existsSync(f)) { log(`illo-${k} cached`); continue }
  const ok = await gem(`${STYLE}\n\nSubject: ${ILLOS[k]}`, f)
  log(`illo-${k} ${ok ? 'ok' : 'FAILED'}`)
}
log('ILLOS DONE')
