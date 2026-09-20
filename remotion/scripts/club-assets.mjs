// Layers for the club demo: text-free widescreen plate + transparent crowd + DJ, from the flyer.
import { config } from 'dotenv'; config({ path: '../.env.local', quiet: true })
import { readFileSync, writeFileSync, existsSync } from 'fs'
const KEY = process.env.OPENAI_API_KEY
const OUT = 'public/showcase/club'
async function edit(name, prompt, size, transparent = false) {
  const f = `${OUT}/${name}.png`; if (existsSync(f)) { console.log('skip', name); return }
  const fd = new FormData()
  fd.append('model', 'gpt-image-2'); fd.append('prompt', prompt); fd.append('size', size); fd.append('quality', 'high'); fd.append('n', '1')
  if (transparent) fd.append('background', 'transparent')
  fd.append('output_format', 'png')
  fd.append('image[]', new Blob([readFileSync(`${OUT}/flyer.jpg`)], { type: 'image/jpeg' }), 'flyer.jpg')
  const r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${KEY}` }, body: fd })
  const j = await r.json(); if (!r.ok) throw new Error(`${name}: ${r.status} ${JSON.stringify(j).slice(0, 300)}`)
  writeFileSync(f, Buffer.from(j.data[0].b64_json, 'base64')); console.log('made', name, j.usage ? JSON.stringify(j.usage) : '')
}
const STYLE = 'Same neon nightclub scene and colour palette as the reference flyer: electric blue and hot pink neon, magenta laser beams, stage haze, vertical neon tubes along the walls.'
await edit('plate', `${STYLE} Re-create the scene as a WIDESCREEN 16:9 photograph-style background plate with NO text, NO lettering, NO logos, NO signs, and NO people in the lower third — an empty dance floor looking toward the stage, lasers and haze, so headlines can be placed over it later.`, '1536x1024')
await edit('crowd', `From the reference flyer's crowd: a wide strip of a dancing crowd seen from behind in near-black silhouette with raised hands, rim-lit in pink and blue neon, on a TRANSPARENT background. No text. Fill the bottom half of the frame, transparent above the heads.`, '1536x1024', true)
await edit('dj', `A single DJ silhouette behind decks, arms raised, rim-lit in electric blue and hot pink matching the reference flyer, on a TRANSPARENT background. No text. Centered, full figure.`, '1024x1024', true)
console.log('done')
