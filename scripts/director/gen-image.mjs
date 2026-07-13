import { config } from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

// load .env.local from the repo root regardless of cwd (scripts run from anywhere)
const __dir = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dir, '..', '..')
config({ path: path.join(ROOT, '.env.local') })

/**
 * Smart image router for the video studio.
 *
 * Picks the BEST model for each shot, then normalizes to 16:9:
 *   · Cloudflare FLUX-schnell — FREE, ~2s, great for bright/upbeat/abstract/
 *     backdrop shots and anything where "stock-good" is enough. Returns 1024²,
 *     so we center-crop to 16:9.
 *   · Gemini 3 Pro Image — ~$0.04, photoreal, superior lighting/mood/emotion.
 *     Native 16:9. Reserved for cinematic HERO shots (dramatic light, emotional
 *     human moments, moody atmosphere) where fidelity actually shows.
 *
 * The chooser scores the prompt for "cinematic intent" and routes accordingly;
 * pass tier:'hero' | 'standard' to force it.
 *
 * Usage (as a module):
 *   import { genImage } from './gen-image.mjs'
 *   await genImage({ prompt, out: 'path/foo.png', tier: 'auto', look: '...' })
 */

const CF_ACCT = process.env.CLOUDFLARE_ACCOUNT_ID
const CF_KEY = process.env.CLOUDFLARE_API_KEY
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
const GEMINI_MODEL = 'gemini-3-pro-image-preview'

// words that signal a shot NEEDS photoreal mood/lighting → Gemini (global flag!)
const CINEMATIC = /\b(cinematic|dramatic|moody|emotional|exhausted|overwhelmed|lonely|night|shadow|film[- ]?noir|dim|somber|gold beam|volumetric|portrait|close[- ]?up|hero shot|melanchol|tense|intimate|golden hour|rim[- ]?light|chiaroscuro)\b/gi
// words that signal bright/graphic/upbeat → FLUX is plenty (global flag!)
const UPBEAT = /\b(bright|upbeat|energetic|vibrant|celebrat|abstract|backdrop|pattern|clean|graphic|colorful|dynamic|optimistic|sunny|airy)\b/gi

function classify(prompt, tier) {
  if (tier === 'hero') return 'gemini'
  if (tier === 'standard') return 'flux'
  // auto: count cinematic vs upbeat cues; cinematic intent → Gemini, else free FLUX
  const cine = (prompt.match(CINEMATIC) || []).length
  const up = (prompt.match(UPBEAT) || []).length
  return cine > up ? 'gemini' : 'flux'
}

async function flux(prompt, out) {
  // FLUX-schnell caps the prompt (~77 CLIP tokens). Trim to the most salient
  // ~320 chars so long "look + prompt" strings don't 400 with code 7003.
  const p = prompt.length > 320 ? prompt.slice(0, 320).replace(/\s+\S*$/, '') : prompt
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCT}/ai/run/@cf/black-forest-labs/flux-1-schnell`, {
    method: 'POST', headers: { Authorization: 'Bearer ' + CF_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: p, steps: 6 }), signal: AbortSignal.timeout(60000),
  })
  const j = await r.json()
  if (!j.success || !j.result?.image) throw new Error('flux: ' + JSON.stringify(j).slice(0, 160))
  const tmp = out.replace(/\.png$/, '.sq.png')
  fs.writeFileSync(tmp, Buffer.from(j.result.image, 'base64'))
  // center-crop the 1024² down to 16:9 (1024x576) then upscale to 1920x1080
  execSync(`ffmpeg -y -i "${tmp}" -vf "crop=1024:576:0:224,scale=1920:1080" "${out}" -loglevel error`)
  fs.unlinkSync(tmp)
  return 'flux'
}

async function gemini(prompt, out) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'] } }),
    signal: AbortSignal.timeout(120000),
  })
  if (!r.ok) throw new Error('gemini ' + r.status)
  const j = await r.json()
  const part = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)
  if (!part) throw new Error('gemini: no image')
  fs.writeFileSync(out, Buffer.from(part.inlineData.data, 'base64'))
  return 'gemini'
}

/**
 * @param {{prompt:string, out:string, look?:string, tier?:'auto'|'hero'|'standard'}} o
 * @returns {Promise<{model:string, cost:number}>}
 */
export async function genImage({ prompt, out, look = '', tier = 'auto' }) {
  const full = (look ? look + ' ' : '') + prompt
  const choice = classify(full, tier)
  fs.mkdirSync(out.replace(/\/[^/]+$/, ''), { recursive: true })
  try {
    if (choice === 'gemini') { await gemini(full, out); return { model: 'gemini', cost: 0.04 } }
    await flux(full, out); return { model: 'flux', cost: 0 }
  } catch (e) {
    // fallback: if the free path fails, try the other one so a shot never blocks
    console.error(`  ↳ ${choice} failed (${String(e.message).slice(0, 60)}), falling back`)
    if (choice === 'flux') { await gemini(full, out); return { model: 'gemini (fallback)', cost: 0.04 } }
    await flux(full, out); return { model: 'flux (fallback)', cost: 0 }
  }
}

// CLI: node gen-image.mjs "<prompt>" <out.png> [hero|standard|auto]
// (robust entry check — works on Windows where file:// path encoding differs)
const invoked = process.argv[1] && import.meta.url.includes(
  process.argv[1].replace(/\\/g, '/').replace(/^[A-Za-z]:/, '').split('/').pop()
)
if (invoked) {
  const [, , prompt, out, tier = 'auto'] = process.argv
  if (!prompt || !out) { console.log('usage: node gen-image.mjs "<prompt>" <out.png> [hero|standard|auto]'); process.exit(1) }
  const res = await genImage({ prompt, out, tier })
  console.log(`✓ ${out} via ${res.model} ($${res.cost})`)
}
