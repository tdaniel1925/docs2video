// Generate a vertical's 10 scene images with Cloudflare FLUX (schnell) instead of
// Gemini — the cheap/near-free path. Reuses the vertical's existing VO/music/
// data/logo. Usage: VERT=dental node scripts/gen-vertical-flux.mjs
// Writes into public/vert-<id>-flux/.
import { readFileSync, mkdirSync, writeFileSync, existsSync, copyFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { VERTICALS, STYLE } from './verticals-config.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const VERT = process.env.VERT || 'dental'
const V = VERTICALS[VERT]
if (!V) { console.error('unknown VERT'); process.exit(1) }
const SRC = join(HERE, '..', 'public', `vert-${VERT}`)      // reuse VO/music/data/logo
const OUT = join(HERE, '..', 'public', `vert-${VERT}-flux`)
mkdirSync(OUT, { recursive: true })

const env = {}
for (const f of ['.env.local', '.env']) { const p = join(ROOT, f); if (existsSync(p)) for (const line of readFileSync(p, 'utf8').split('\n')) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !env[m[1]]) env[m[1]] = m[2].trim() } }
const CF_ACCOUNT = env.CLOUDFLARE_ACCOUNT_ID
const CF_TOKEN = env.CLOUDFLARE_API_KEY
const CF_MODEL = env.CF_IMAGE_MODEL || '@cf/black-forest-labs/flux-1-schnell'
const log = (...a) => console.log('[flux]', ...a)

// copy over the reusable assets so the flux folder is self-contained
for (const name of [...Array(10).keys()].map((i) => `vo-${i}.mp3`).concat(['music.mp3', 'logo.png', 'data.json'])) {
  try { copyFileSync(join(SRC, name), join(OUT, name)) } catch {}
}

async function flux(prompt, outPath) {
  // FLUX schnell on Workers AI: returns base64 image in result.image
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/ai/run/${CF_MODEL}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: prompt.slice(0, 2048), steps: 6, width: 1280, height: 720 }),
  })
  if (!r.ok) throw new Error(`${r.status}: ${(await r.text()).slice(0, 160)}`)
  const j = await r.json()
  const b64 = j?.result?.image
  if (!b64) throw new Error('no image in FLUX response: ' + JSON.stringify(j).slice(0, 160))
  writeFileSync(outPath, Buffer.from(b64, 'base64'))
}

// FLUX-tuning: a light palette nudge PREPENDED (keeps the scene subject intact),
// plus a gentle no-gibberish note APPENDED. Keeping it light avoids the
// over-correction where FLUX drops the subject and draws only blobs.
const FLUX_PRE = 'Soft, desaturated, muted palette — warm cream, terracotta rust, warm tan, sage green, soft gold; gentle and calm, not bright or neon. '
const FLUX_POST = ' Keep any signs, screens, calendars, or documents blank or with simple placeholder lines — no gibberish text.'
async function gen(i) {
  const f = join(OUT, `f-${i}.png`)
  if (existsSync(f) && process.env.FORCE !== '1') { log(`f-${i} cached`); return }
  const prompt = FLUX_PRE + V.scenes[i] + FLUX_POST
  for (let a = 0; a < 3; a++) {
    try { await flux(prompt, f); log(`f-${i} ok`); return }
    catch (e) { log(`f-${i} try${a + 1}: ${e.message}`); if (a < 2) await new Promise((s) => setTimeout(s, 2000)); else log(`f-${i} GIVE UP`) }
  }
}
// FLUX schnell is fast; do them 3 at a time
const idx = V.scenes.map((_, i) => i)
while (idx.length) { const b = idx.splice(0, 3); await Promise.all(b.map((i) => gen(i))) }
log(`DONE — ${VERT} via FLUX in public/vert-${VERT}-flux/`)
