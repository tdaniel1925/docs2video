// Render a sample flyer end to end so the output can be LOOKED AT.
//
//   node scripts/flyer-proof.mjs
//
// Generates one real piece of artwork, renders the real template, and
// screenshots the artboard. A layout that typechecks is not a layout that
// looks good — this is the only check that answers the actual question.
import { readFileSync, writeFileSync } from 'fs'
import { chromium } from 'playwright'
import { GoogleGenAI } from '@google/genai'

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

// The template module is TypeScript; pull the two functions in via tsx.
const { renderFlyer, FLYER_LAYOUTS, FLYER_SIZES, artPrompt } = await import('../app/_lib/flyer.ts')

const layout = FLYER_LAYOUTS.find((l) => l.id === 'bleed-bottom')
const size = FLYER_SIZES.find((s) => s.id === 'letter')
const accent = '#E11D48'

const fields = {
  eyebrow: 'Saturday · Main Room',
  headline: 'Midnight Society',
  subhead: 'One night. Three rooms. Resident DJs until close.',
  date: 'Sat 23 August',
  time: 'Doors 9pm',
  venue: 'The Foundry',
  address: '114 Wharf Street, Dallas TX',
  price: '$20 door / $15 advance',
  details: ['DJ Sable — headline set', 'Late licence to 4am', 'Over 21s, ID required'],
  cta: 'Tickets at the door',
  contact: 'thefoundry.club · @foundrydallas',
}

console.log('generating artwork…')
const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
let art = null
try {
  const res = await genai.models.generateContent({
    model: process.env.IMAGE_MODEL || 'gemini-3-pro-image-preview',
    contents: [{ role: 'user', parts: [{ text: artPrompt(layout, 'a packed late-night club, crowd silhouettes, coloured stage haze', accent) }] }],
    config: { responseFormat: { image: { aspectRatio: '3:4', imageSize: '2K' } } },
  })
  for (const p of res.candidates?.[0]?.content?.parts ?? []) {
    if (p.inlineData?.data) art = `data:image/png;base64,${p.inlineData.data}`
  }
} catch (e) {
  console.log('  art failed (' + e.message.slice(0, 80) + ') — rendering with the gradient fallback')
}
console.log(art ? '  got artwork' : '  no artwork')

const html = renderFlyer({ layout, size, fields, artUrl: art, accent })
writeFileSync('flyer-proof.html', html)

const b = await chromium.launch()
const page = await b.newPage({
  viewport: { width: Math.round(size.w * 96), height: Math.round(size.h * 96) },
  deviceScaleFactor: 2,
})
await page.setContent(html, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
await page.locator('.page').screenshot({ path: 'flyer-proof.png' })

// Did anything overflow its artboard? A flyer that clips its own phone number
// is worse than an ugly one.
const overflow = await page.evaluate(() => {
  const el = document.querySelector('.inner')
  const p = document.querySelector('.page')
  return { over: el.scrollHeight - p.clientHeight, h1: getComputedStyle(document.querySelector('h1')).fontSize }
})
console.log(`headline size ${overflow.h1}, content overflow ${overflow.over > 0 ? overflow.over + 'px — TOO TALL' : 'none'}`)
await b.close()
console.log('wrote flyer-proof.png')
