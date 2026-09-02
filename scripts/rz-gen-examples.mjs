// Generate NEW Restylez example outputs through the real engine (logged-in Playwright session).
import { chromium } from 'playwright'
import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'fs'
const RZ = 'C:/dev/1 - Restylez'
const env = readFileSync(RZ + '/.env.local', 'utf8')
const get = (k) => (env.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim().replace(/\r$/, '').replace(/^["']|["']$/g, '')
const EMAIL = get('SUPER_ADMIN_EMAIL'), PASS = get('SUPER_ADMIN_PASSWORD')
const OUT = RZ + '/public/examples/'
const TPL = 'C:/dev/1 - PrismGraphs/public/flyer-templates/'
const JORDYN = 'C:/dev/1 - jordyn 2026/public/marketing/ads/flyer.png'

const toDataUrl = async (file, max = 1600) => 'data:image/png;base64,' + (await sharp(file).resize(max, max, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()).toString('base64')
const save = async (dataUrl, name, max = 1800) => { const b = Buffer.from(dataUrl.split(',')[1], 'base64'); await sharp(b).resize(max, max, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88 }).toFile(OUT + name); console.log('saved', name) }

const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto('http://localhost:3005/login')
await page.fill('input[type=email]', EMAIL); await page.fill('input[type=password]', PASS)
await page.click('button.au-submit'); await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 })
console.log('logged in →', page.url())
const login = async () => { await page.goto('http://localhost:3005/login'); await page.fill('input[type=email]', EMAIL); await page.fill('input[type=password]', PASS); await page.click('button.au-submit'); await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 }) }
const post = async (path, data, retry = true) => { const r = await page.request.post('http://localhost:3005' + path, { data, timeout: 300000 }); const j = await r.json(); if (r.status() === 401 && retry) { console.log('session expired — logging in again'); await login(); return post(path, data, false) } if (!r.ok()) throw new Error(path + ' ' + r.status() + ' ' + j.error); return j }

const jobs = process.argv.slice(2)
const want = (n) => !jobs.length || jobs.includes(n)
try {
  // 1. CLUB FLYER — edit the words (Midnight Society → new date/venue/price)
  if (want('club')) {
    await sharp(TPL + 'neonclub.png').resize(1100, 1100, { fit: 'inside' }).jpeg({ quality: 88 }).toFile(OUT + 'club-before.jpg')
    await sharp(TPL + 'nightlife-pool-party.png').resize(1100, 1100, { fit: 'inside' }).jpeg({ quality: 88 }).toFile(OUT + 'club-restyle.jpg')
    const r = await post('/api/remake', { imageDataUrl: await toDataUrl(TPL + 'neonclub.png'), owned: true, changes: 'Change SATURDAY NIGHT to FRIDAY NIGHT. Change the date to FRIDAY 18 OCTOBER and doors to 10PM. Change the venue to THE WAREHOUSE. Change the price to $15 DOOR. Keep the name Midnight Society, the neon style, layout and everything else exactly the same.' })
    await save(r.png, 'club-after.jpg')
  }
  // 2. JORDYN — same flyer in other formats
  if (want('jordyn-fan')) {
    const src = await toDataUrl(JORDYN)
    const NOTES = {
      'biz-card': 'This is a BUSINESS CARD. Keep only: the Jordyn logo, the headline "The AI assistant with a brain for your business", jordyn.app, and "3-day free trial · $149/month". Drop the feature list, the brain illustration and all small print. Big, clean, readable.',
      'ig-post': 'This is an INSTAGRAM POST. Keep: the Jordyn logo, the headline, the brain illustration, jordyn.app and "Start free". Drop the feature list and all small print. Big readable type, illustration as the hero.',
      'postcard': 'This is the FRONT OF A POSTCARD. Keep: the logo, the headline, the brain illustration, the three feature titles (Works your inbox all day / Picks up the phone / Writes the paperwork) WITHOUT their small descriptions, jordyn.app and the trial line. Drop all other small print.',
    }
    for (const [sizeId, name] of [['biz-card', 'jordyn-card.jpg'], ['ig-post', 'jordyn-social.jpg'], ['postcard', 'jordyn-postcard.jpg']]) {
      const r = await post('/api/remake', { imageDataUrl: src, owned: true, resize: { sizeId }, changes: NOTES[sizeId] })
      await save(r.png, name)
    }
  }
  // 3. JORDYN — a deck in the flyer's look
  if (want('jordyn-deck')) {
    const look = await toDataUrl(JORDYN)
    const o = await post('/api/outline', { topic: 'Jordyn quarterly update for investors: Jordyn is the AI assistant with a brain for your business. Q1 revenue $84,000, Q2 $131,500, Q3 $212,000, Q4 $318,250. 2,140 businesses signed up, 96% keep their plan, 1.2 million emails handled. Industries: real estate, law, dental, HVAC, accounting, insurance. Plan: launch phone answering and paperwork automation next quarter.', owned: true })
    const slides = o.slides
    const pick = [slides[0], slides.find((s) => s.chart) || slides[1], { title: 'The year at a glance', layout: 'stat', bullets: ['$745,750 in revenue', '2,140 businesses signed up', '96% keep their plan'] }]
    console.log('outline layouts:', slides.map((s) => s.layout).join(','), '→ picked', pick.map((s) => s.layout).join(','))
    for (let i = 0; i < pick.length; i++) { const r = await post('/api/slide', { lookDataUrl: look, slide: pick[i], index: i, total: pick.length, owned: true }); await save(r.png, `jordyn-slide-${i + 1}.jpg`) }
  }
  // 4. SUPPER CLUB — restaurant flyer → card + post (variety beyond one brand)
  if (want('supper')) {
    const src = await toDataUrl(TPL + 'food-late-night-diner.png')
    await sharp(TPL + 'food-late-night-diner.png').resize(1100, 1100, { fit: 'inside' }).jpeg({ quality: 88 }).toFile(OUT + 'supper-flyer.jpg')
    const SN = { 'biz-card': 'This is a BUSINESS CARD. Keep only: the neon "Supper Club" sign, "Every Friday · from 5pm", "The Corner Table", and "Book a table". Drop the food photo and the price. Big and readable.', 'ig-post': 'This is an INSTAGRAM POST. Keep the neon sign, the food photo as the hero, "Every Friday · from 5pm", "$28 per head" and "Book a table". Drop the rest. Big readable type.' }
    for (const [sizeId, name] of [['biz-card', 'supper-card.jpg'], ['ig-post', 'supper-social.jpg']]) { const r = await post('/api/remake', { imageDataUrl: src, owned: true, resize: { sizeId }, changes: SN[sizeId] }); await save(r.png, name) }
  }
  // 5. GROWTH SUMMIT — gold invite, new words
  if (want('summit')) {
    await sharp(TPL + 'business-awards-night.png').resize(1100, 1100, { fit: 'inside' }).jpeg({ quality: 88 }).toFile(OUT + 'summit-before.jpg')
    const r = await post('/api/remake', { imageDataUrl: await toDataUrl(TPL + 'business-awards-night.png'), owned: true, changes: 'Change GROWTH SUMMIT to FOUNDERS DINNER. Change the date line to "FRIDAY 7 NOVEMBER · 7PM". Change THE EXCHANGE to THE GRAND HALL. Keep the gold style, layout and everything else exactly the same.' })
    await save(r.png, 'summit-after.jpg')
  }
  // 6. LONG WAY HOME — gig poster restyled into the gold invite look
  if (want('salsa')) {
    await sharp(TPL + 'music-salsa-night.png').resize(1100, 1100, { fit: 'inside' }).jpeg({ quality: 88 }).toFile(OUT + 'salsa-before.jpg')
    const r = await post('/api/remake', { imageDataUrl: await toDataUrl(TPL + 'music-salsa-night.png'), owned: true, restyle: { lookDataUrl: await toDataUrl(TPL + 'business-awards-night.png') } })
    await save(r.png, 'salsa-restyle.jpg')
  }
} catch (e) { console.error('FAILED:', e.message) }
await browser.close()
