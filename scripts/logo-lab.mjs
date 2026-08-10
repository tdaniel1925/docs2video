// Can these models make a logo an agency would put its name to?
//
//   node -r dotenv/config scripts/logo-lab.mjs dotenv_config_path=.env.local
//
// The honest way to answer "is this a good idea" is to generate the things and
// look at them, not to reason about it. Two engines, the same briefs, saved
// side by side.
//
// The cheesy-AI-logo problem is mostly a PROMPT problem: ask for "a logo for a
// coffee shop" and you get a cartoon bean with a swoosh. Real identity work is
// one idea, built geometrically, that survives being printed at 8mm in one
// colour. So the brief below bans the entire vocabulary of bad logos and asks
// for the constraints a design director would actually impose.
import { writeFileSync, mkdirSync } from 'fs'
import OpenAI from 'openai'

const OUT = '.logo-lab'
mkdirSync(OUT, { recursive: true })

const ai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const GEMINI = process.env.GEMINI_API_KEY

/** What every brief inherits. This is where agency-quality lives or dies. */
const CRAFT = `
ABSOLUTE STYLE RULES — this is a professional identity, not an illustration:
- FLAT VECTOR. Pure solid shapes. No gradient, no 3D, no bevel, no emboss, no drop shadow, no glow, no reflection, no texture, no photorealism.
- ONE IDEA, executed simply. Not a scene, not a collage of symbols, not a mascot.
- Built geometrically: consistent stroke weights, deliberate optical balance, clean curves and true tangents.
- It must still read at 8mm on a business card and work in one colour.
- NO clipart, NO swooshes, NO generic globes, NO cartoon characters, NO shields-with-everything, NO stock "startup" gradients, NO sparkles, NO circles-of-dots-around-a-word.
- NOTHING in the frame except the logo itself, centred on a plain white background with generous empty margin. No mockup, no business card, no packaging, no hand, no desk, no presentation board, no colour swatches, no alternate versions, no grid lines, no annotations.
- Any lettering must be flawlessly spelled, evenly spaced and properly kerned.
`.trim()

const BRIEFS = [
  {
    id: 'meridian',
    label: 'Architecture — geometric monogram',
    brief: `A wordmark logo reading exactly "MERIDIAN" for an architecture practice.
Set in a refined geometric sans serif, all capitals, generously letterspaced, in a single solid near-black.
Above the word, a small precise mark: a fine horizontal line intersected by a thin vertical, suggesting a horizon and a plumb line. Nothing more.
Restrained, confident, Swiss. Black on white only.`,
  },
  {
    id: 'thicket',
    label: 'Botanical skincare — negative space mark',
    brief: `A logo for a botanical skincare brand called "THICKET".
A single symbol above the name: overlapping leaf forms whose NEGATIVE SPACE reads as a droplet. The cleverness must be quiet — legible first, clever second.
The word "THICKET" beneath in a fine, wide-letterspaced serif, all capitals.
One solid deep-green ink on white. No second colour.`,
  },
  {
    id: 'halden',
    label: 'Private wealth — serif wordmark',
    brief: `A pure wordmark reading exactly "HALDEN & CO." for a private wealth firm.
A high-contrast transitional serif, all capitals, tight but even letterspacing, with one considered detail: the ampersand drawn slightly more expressively than the rest.
No symbol, no icon, no line, no crest — the typography IS the logo.
Solid ink navy on white.`,
  },
  {
    id: 'northbound',
    label: 'Outdoor outfitter — pictorial mark',
    brief: `A pictorial logo mark for an outdoor outfitter called "NORTHBOUND".
A single symbol: a compass needle and a mountain ridge resolved into ONE continuous geometric form, so it reads as both. Heavy, confident, woodcut-simple — the kind of mark that still works branded onto leather.
The word "NORTHBOUND" below in a sturdy condensed sans, all capitals.
One solid rust-brown ink on white.`,
  },
]

async function openai(b) {
  const res = await ai.images.generate({
    model: 'gpt-image-2',
    prompt: `${b.brief}\n\n${CRAFT}`,
    size: '1024x1024',
    quality: 'high',
    n: 1,
  })
  return Buffer.from(res.data[0].b64_json, 'base64')
}

// Nano Banana — Gemini's image model.
async function nano(b) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${GEMINI}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${b.brief}\n\n${CRAFT}` }] }],
        generationConfig: { responseModalities: ['IMAGE'] },
      }),
    },
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`)
  const part = (data.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData || p.inline_data)
  const b64 = part?.inlineData?.data ?? part?.inline_data?.data
  if (!b64) throw new Error('no image came back')
  return Buffer.from(b64, 'base64')
}

const only = process.argv.find((a) => a.startsWith('--engine='))?.split('=')[1]
const engines = [
  ['gptimage2', openai],
  ['nanobanana', nano],
].filter(([n]) => !only || n === only)

for (const b of BRIEFS) {
  for (const [name, fn] of engines) {
    const t0 = Date.now()
    try {
      const buf = await fn(b)
      const file = `${OUT}/${b.id}-${name}.png`
      writeFileSync(file, buf)
      console.log(`ok    ${file}  (${Math.round((Date.now() - t0) / 1000)}s, ${Math.round(buf.length / 1024)}kb)`)
    } catch (e) {
      console.log(`FAIL  ${b.id}-${name}: ${String(e.message).slice(0, 120)}`)
    }
  }
}
console.log(`\nlook in ${OUT}/`)
