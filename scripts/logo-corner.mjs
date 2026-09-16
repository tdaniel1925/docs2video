/**
 * HOW DO YOU RESERVE SPACE FOR A REAL LOGO WITHOUT AN UGLY HOLE?
 *
 * Telling the model "leave the bottom-right corner clear" made it DRAW a
 * white rectangle there — it read "clear" as an object. The logo is pasted by
 * code afterwards (lib/composite), so what the slide actually needs is empty
 * BACKGROUND in that corner, not a shape.
 *
 * Four ways to ask. Same slide, same everything else.
 *
 *   node scripts/logo-corner.mjs
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/))
    .filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')]),
)
mkdirSync('scripts/.bakeoff', { recursive: true })

const SLIDE = [
  'Design ONE presentation slide, 16:9, for a business explainer video.',
  'Layout: a BULLETED slide. The heading is "What changed in the 2026 renewal".',
  'Set these five points as a clean, readable list, each on its own line:',
  '  - Carrier switched from Ameritas to Penn Mutual on March 1st',
  '  - Annual premium rises $4,280 to $4,715 (a 10.2% increase)',
  '  - The waiver-of-premium rider is retained; the child rider lapses',
  '  - Guaranteed cash value at year 20: $61,940',
  '  - Renewal paperwork is due back by Friday, 27 February',
  '',
  'RULES:',
  '- Use ONLY the words and numbers above. Spell every word exactly.',
  '- Every figure keeps its $ sign, its commas, its decimal point and its %.',
  '- No logos, no brand marks, no watermarks, no placeholder text.',
  '- Clean, modern, professional. Deep navy background, cyan and white type.',
]

/* The four ways of asking, from most explicit to least. */
const WAYS = {
  /* What we did before — and what drew a white box. */
  clear: '- Leave the BOTTOM-RIGHT CORNER clear — a logo is placed there afterwards by code.',
  /* Name the thing we want: background, not a shape. */
  background: '- The bottom-right corner must be PLAIN EMPTY BACKGROUND — continue the background colour into it. Put no text, no shape, no box and no panel there.',
  /* Say nothing about a corner; just keep content inside a margin. */
  margin: '- Keep ALL text and graphics inside the upper-left three quarters of the slide. The lower-right quarter stays plain background.',
  /* Say nothing at all — paste the logo over whatever is there. */
  nothing: '',
}

const t = async (label, rules) => {
  const t0 = Date.now()
  const prompt = [...SLIDE, rules].filter(Boolean).join('\n')
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env.IMAGE_MODEL || 'gemini-3-pro-image-preview'}:generateContent?key=${env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '16:9', imageSize: '2K' } },
      }),
    })
    const txt = await r.text()
    if (!r.ok) throw new Error(`${r.status}: ${txt.slice(0, 160)}`)
    const img = (JSON.parse(txt).candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.data)
    if (!img) throw new Error('no image')
    const buf = Buffer.from(img.inlineData.data, 'base64')
    writeFileSync(`scripts/.bakeoff/corner-${label}.png`, buf)
    console.log(`${label.padEnd(11)} ${((Date.now() - t0) / 1000).toFixed(1)}s  -> scripts/.bakeoff/corner-${label}.png`)
  } catch (e) {
    console.log(`${label.padEnd(11)} FAILED: ${(e.message || e).toString().slice(0, 100)}`)
  }
}

for (const [k, v] of Object.entries(WAYS)) await t(k, v)
