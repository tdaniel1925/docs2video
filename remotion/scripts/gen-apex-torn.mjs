// Torn/cut-paper craft scenes for the Apex video, in the navy/red/cream Apex
// palette. FLUX (cheap). Reuses Apex VO + music. Writes public/apex-torn/.
import { readFileSync, mkdirSync, existsSync, writeFileSync, copyFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const OUT = join(HERE, '..', 'public', 'apex-torn')
mkdirSync(OUT, { recursive: true })
const FORCE = process.env.FORCE === '1'

const env = {}
for (const f of ['.env.local', '.env']) { const p = join(ROOT, f); if (existsSync(p)) for (const line of readFileSync(p, 'utf8').split('\n')) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !env[m[1]]) env[m[1]] = m[2].trim() } }
const CF_ACCOUNT = env.CLOUDFLARE_ACCOUNT_ID, CF_TOKEN = env.CLOUDFLARE_API_KEY, CF_MODEL = env.CF_IMAGE_MODEL || '@cf/black-forest-labs/flux-1-schnell'
const log = (...a) => console.log('[apex-torn]', ...a)

// reuse Apex VO / music / logo
for (const name of [...Array(16).keys()].map((i) => `vo-${i}.mp3`).concat(['music.mp3', 'musicDucked.mp3', 'voMaster.mp3', 'logo.png', 'durations.json'])) {
  try { copyFileSync(join(HERE, '..', 'public', 'apex', name), join(OUT, name)) } catch {}
}

// Cut-paper craft in the Apex brand palette. 16 scenes matching the Apex beats.
const PAPER = "Cut-paper craft collage illustration, handmade layered construction-paper, visible torn and cut paper edges, soft realistic drop shadows between paper layers, subtle paper grain and fiber texture. Palette: deep navy blue, bright red, and clean cream white — patriotic American corporate feel. Charming, premium, editorial paper-craft advertising style. 16:9. NO text, NO letters, NO logos, NO words."
const SCENES = [
  `${PAPER} A paper person at a fork with two diverging paper roads, choosing a direction, hopeful.`,
  `${PAPER} Two paper paths / two pillars side by side with a paper team figure between them, unity and choice.`,
  `${PAPER} A paper insurance agent handing a paper shield/policy to a paper family at a paper table, trust.`,
  `${PAPER} A warm paper family (parents and kids) under a protective paper roof/shield, safe and protected.`,
  `${PAPER} A paper lightbulb / spark and a small paper laptop, an advantage and modern tools, red and navy accents.`,
  `${PAPER} A paper analytics dashboard / bar chart made of layered paper with a magnifying glass, insight from data.`,
  `${PAPER} A paper document transforming into a paper play-button video screen, a document that sells.`,
  `${PAPER} A paper gear / tech-stack tower of layered paper blocks, a purpose-built system, navy and red.`,
  `${PAPER} A paper mentor figure guiding a paper newcomer up a set of paper stairs, training and support.`,
  `${PAPER} A paper open door with light coming through and a big paper zero, no barrier, free to start.`,
  `${PAPER} A paper upward arrow / rising paper bar chart, growth and earnings, red and navy.`,
  `${PAPER} A paper leader with a small paper team of figures behind them, building a team, camaraderie.`,
  `${PAPER} A paper mountain summit with a paper flag at the top, achievement and winning.`,
  `${PAPER} A diverse row of different paper people standing together, room for everyone, inclusive.`,
  `${PAPER} Two paper hands shaking / two paper figures united, partnership and opportunity.`,
  `${PAPER} A single confident paper hero figure at a paper sunrise with paper rays, generous cream space for a logo, optimistic finale.`,
]

async function flux(prompt, outPath) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/ai/run/${CF_MODEL}`, { method: 'POST', headers: { Authorization: `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: prompt.slice(0, 2048), steps: 6, width: 1280, height: 720 }) })
  if (!r.ok) throw new Error(`${r.status}: ${(await r.text()).slice(0, 140)}`)
  const j = await r.json(); const b64 = j?.result?.image; if (!b64) throw new Error('no image')
  writeFileSync(outPath, Buffer.from(b64, 'base64'))
}
async function gen(i) { const f = join(OUT, `f-${i}.png`); if (!FORCE && existsSync(f)) { log(`f-${i} cached`); return } for (let a = 0; a < 3; a++) { try { await flux(SCENES[i], f); log(`f-${i} ok`); return } catch (e) { log(`f-${i} try${a + 1}: ${e.message}`); if (a < 2) await new Promise((s) => setTimeout(s, 2000)); else log(`f-${i} GIVE UP`) } } }
const idx = SCENES.map((_, i) => i)
while (idx.length) { const b = idx.splice(0, 3); await Promise.all(b.map((i) => gen(i))) }
log('DONE')
