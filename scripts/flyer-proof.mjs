// Render ONE design at several sizes so the output can be looked at.
//
//   node scripts/flyer-proof.mjs [templateId]
//
// A layout that typechecks is not a layout that looks good, and a multi-size
// engine that works portrait can still crush a banner. This builds real
// artwork, renders the ticked sizes, and fails loudly if anything overflows
// its own artboard.
import { readFileSync, writeFileSync } from 'fs'
import { chromium } from 'playwright'
import OpenAI from 'openai'
import { GoogleGenAI } from '@google/genai'

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const { renderFlyer, FLYER_TEMPLATES, FLYER_SIZES, artPrompt } = await import('../app/_lib/flyer.ts')

const template = FLYER_TEMPLATES.find((t) => t.id === (process.argv[2] || 'rnb'))
const fields = {
  eyebrow: 'Saturday · Main Room',
  headline: 'Midnight Society',
  subhead: 'Three rooms. Resident DJs until close.',
  date: 'Sat 23 August', time: 'Doors 9pm', venue: 'The Foundry',
  address: '114 Wharf Street, Dallas TX',
  price: '$20 door',
  details: ['DJ Sable — headline set', 'Late licence to 4am', 'Over 21s, ID required'],
  cta: 'Tickets at the door',
  contact: 'thefoundry.club · @foundrydallas',
}

const ai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const MODEL = process.env.FLYER_IMAGE_MODEL || 'gpt-image-2'

const gem = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
const SUBJECT = 'a packed late-night club, crowd silhouettes, coloured stage haze'

// OpenAI first (the requested engine), Gemini if it is unavailable. The first
// live run of this returned nothing at all because the OpenAI account was out
// of credits — a billing state on one vendor should degrade the artwork, not
// delete the proof.
async function art(portrait) {
  const prompt = artPrompt(template, SUBJECT, portrait)
  try {
    const r = await ai.images.generate({
      model: MODEL, prompt,
      size: portrait ? '1024x1536' : '1536x1024',
      quality: 'high', n: 1,
    })
    if (r.data?.[0]?.b64_json) return { url: `data:image/png;base64,${r.data[0].b64_json}`, via: MODEL }
  } catch (e) {
    console.log(`  ${portrait ? 'upright' : 'wide  '} ${MODEL}: ${String(e.message).slice(0, 70)}`)
  }
  try {
    const r = await gem.models.generateContent({
      model: process.env.IMAGE_MODEL || 'gemini-3-pro-image-preview',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseFormat: { image: { aspectRatio: portrait ? '3:4' : '4:3', imageSize: '2K' } } },
    })
    for (const p of r.candidates?.[0]?.content?.parts ?? []) {
      if (p.inlineData?.data) return { url: `data:image/png;base64,${p.inlineData.data}`, via: 'gemini' }
    }
  } catch (e) {
    console.log(`  ${portrait ? 'upright' : 'wide  '} gemini: ${String(e.message).slice(0, 70)}`)
  }
  return { url: null, via: 'none' }
}

console.log(`template: ${template.name} (${MODEL})`)
const [tallR, wideR] = await Promise.all([art(true), art(false)])
const tall = tallR.url, wide = wideR.url
console.log(`  art: upright ${tallR.via}, wide ${wideR.via}`)

const want = ['letter', 'square4', 'ig-post', 'ig-story', 'fb-ad', 'yt-banner']
const b = await chromium.launch()
const strip = []

for (const id of want) {
  const size = FLYER_SIZES.find((s) => s.id === id)
  const isWide = size.w / size.h > 1.35
  const html = renderFlyer({ template, size, fields, artUrl: isWide ? (wide ?? tall) : tall })
  const cssW = size.unit === 'in' ? size.w * 96 : size.w
  const cssH = size.unit === 'in' ? size.h * 96 : size.h
  const page = await b.newPage({
    viewport: { width: Math.round(cssW), height: Math.round(cssH) },
    deviceScaleFactor: Math.min(size.unit === 'in' ? 300 / 96 : 1, 2),
  })
  await page.setContent(html, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(400)
  const file = `flyer-${id}.png`
  await page.locator('.page').screenshot({ path: file })

  const chk = await page.evaluate(() => {
    const inner = document.querySelector('.inner')
    const pg = document.querySelector('.page')
    const h1 = document.querySelector('h1')
    return {
      over: Math.round(inner.scrollHeight - inner.clientHeight),
      h1: h1 ? Math.round(parseFloat(getComputedStyle(h1).fontSize)) : 0,
    }
  })
  strip.push(file)
  console.log(`  ${size.label.padEnd(30)} headline ${String(chk.h1).padStart(4)}px  ${chk.over > 2 ? `OVERFLOW ${chk.over}px` : 'fits'}`)
  await page.close()
}

// One contact sheet so every size can be judged side by side.
const sheet = await b.newPage({ viewport: { width: 1500, height: 620 }, deviceScaleFactor: 1 })
await sheet.setContent(`<body style="margin:0;background:#1a1a1e;display:flex;gap:12px;align-items:center;padding:14px">
${strip.map((f) => `<img src="file:///${process.cwd().replace(/\\/g, '/')}/${f}" style="max-height:560px;max-width:230px;object-fit:contain;box-shadow:0 6px 20px #0008">`).join('')}
</body>`, { waitUntil: 'networkidle' })
await sheet.screenshot({ path: 'flyer-sizes.png' })
await b.close()
console.log('wrote flyer-sizes.png')
