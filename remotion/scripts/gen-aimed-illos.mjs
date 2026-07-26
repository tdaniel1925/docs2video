// 12 custom infographic illustrations for the "AI in Medicine" deck.
// Locked clinical-editorial style, accent as the single brand variable.
// Prompts live in remotion/prompts/ai-in-medicine-deck.md.
import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { GoogleGenAI } from '@google/genai'

const HERE = dirname(fileURLToPath(import.meta.url)); const ROOT = join(HERE, '..', '..')
const OUT = join(HERE, '..', '.aimed-illos'); mkdirSync(OUT, { recursive: true })
const env = {}
for (const f of ['.env.local', '.env']) {
  const p = join(ROOT, f); if (!existsSync(p)) continue
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !env[m[1]]) env[m[1]] = m[2].trim()
  }
}
const genai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY })
const MODEL = env.IMAGE_MODEL || 'gemini-3-pro-image-preview'

const ACCENT = 'deep clinical teal (#0E7C7B)'
const ACCENT_SOFT = 'pale mint (#DCEFEE)'
const STYLE = `Flat modern editorial infographic illustration, premium medical-technology publication style. ` +
  `Palette: soft off-white background (#FAFAF8), ${ACCENT} as the dominant accent, ${ACCENT_SOFT} for fills, ` +
  `one muted slate blue (#5B6B7C) and one warm sand (#E4D9C8) as supporting tones, charcoal line work (#2C3238). ` +
  `Clean geometric shapes with generous negative space, subtle paper grain, soft diffused shadows, thin precise 2px linework. ` +
  `Data-visual motifs — rings, arcs, layered panels, node graphs, gradient bars — rendered as ABSTRACT SHAPE only, ` +
  `with no axis labels or readable values. Calm, credible and clinical rather than sci-fi: no glowing blue holograms, ` +
  `no circuit-board brains, no robot hands touching screens, no neon. Centered single subject, generous margins, ` +
  `square composition on a plain off-white field so it sits inside a rounded card.\n\n` +
  `CRITICAL: absolutely NO text, NO words, NO letters, NO numbers, NO logos, NO brand marks, NO readable UI labels, ` +
  `NO watermarks, NO signatures. Pure illustration only. Do not depict identifiable real people. ` +
  `Do not render any specific medical device brand, hospital name, or drug name.`

const ILLOS = {
  cover: 'a calm human figure in profile composed of soft overlapping translucent layers, with a gentle arc of light passing through — the meeting of a person and a system that understands them. Wide and uncluttered, with clear empty space on the left third.',
  adoption: 'a rising stepped curve made of stacked rounded blocks climbing across the frame, with small clinician figures standing at three of the steps — steady, measured adoption rather than a spike.',
  pipeline: 'a left-to-right pipeline of three linked rounded panels — a stack of records, a layered processing core, a clinician silhouette — connected by clean flowing lines, with the final arrow pointing back toward the human.',
  imaging: 'a soft-edged scan panel on a stand with a faint highlighted region ringed by a delicate circle, a magnifier arc hovering nearby — attention being drawn, not a diagnosis being made.',
  risk: 'two diverging paths on a gentle timeline, one branching earlier than the other toward a small sunrise, with a subtle ring gauge beside them — catching something sooner.',
  discovery: 'a lattice of connected molecular nodes partially resolving out of a cloud of scattered dots into an ordered cluster — search collapsing into a candidate.',
  scribe: 'a clinician and a patient seated facing each other in conversation, with a soft ambient wave gently forming an ordered stack of paper behind them — the note writing itself while attention stays on the patient.',
  triage: 'a queue of rounded tokens funneling through a wide sorting gate into three lanes of differing urgency, one lane clearly moving faster.',
  evidence: 'a balance scale where one pan holds a small stack of solid weighted blocks and the other holds light translucent floating shapes — settled evidence against open claims.',
  risks: 'a warning-toned composition of a skewed dataset shown as an unbalanced ring chart beside a confidently drawn shape whose outline does not quite match its fill — bias and confident error.',
  governance: 'a protective arc over a small system diagram, with three checkpoint markers along the arc and a human hand-shape resting at the final one — oversight with a person at the end.',
  close: 'two open hands offering a small softly glowing circular form forward, with a gentle sunrise gradient behind — an invitation to continue the conversation. Leave the right half visually quiet.',
}

async function gem(prompt, outPath) {
  for (let a = 0; a < 3; a++) {
    try {
      const r = await genai.models.generateContent({
        model: MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseFormat: { image: { aspectRatio: '1:1', imageSize: '1K' } } },
      })
      for (const p of (r.candidates?.[0]?.content?.parts ?? [])) {
        if (p.inlineData) { writeFileSync(outPath, Buffer.from(p.inlineData.data, 'base64')); return true }
      }
      throw new Error('no image')
    } catch (e) {
      console.log('[illo] retry', a, String(e.message || e).slice(0, 90))
      if (a < 2) await new Promise((s) => setTimeout(s, 2500))
    }
  }
  return false
}

const entries = Object.entries(ILLOS)
let done = 0
// Small concurrency — the image model rate-limits hard above ~4 in flight.
async function worker() {
  for (;;) {
    const i = done++; if (i >= entries.length) return
    const [key, subject] = entries[i]
    const out = join(OUT, `${key}.png`)
    if (existsSync(out) && process.env.FORCE !== '1') { console.log('[illo] cached', key); continue }
    const ok = await gem(`${STYLE}\n\nSubject: ${subject}`, out)
    console.log('[illo]', key, ok ? 'done' : 'FAILED')
  }
}
await Promise.all(Array.from({ length: 3 }, worker))
console.log('\nwrote', OUT)
