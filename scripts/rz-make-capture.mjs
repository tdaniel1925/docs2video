// Capture the real Remake flow step by step for the explainer video: screenshots + button boxes.
import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'fs'
const RZ = 'C:/dev/1 - Restylez'
const env = readFileSync(RZ + '/.env.local', 'utf8')
const get = (k) => (env.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim().replace(/\r$/, '').replace(/^["']|["']$/g, '')
const OUT = 'C:/dev/1 - PrismGraphs/remotion/public/showcase/rzmake/'
const SRC = 'C:/dev/1 - PrismGraphs/public/flyer-templates/fitness-spin-night.png'
const boxes = {}
const box = async (name, loc) => { const b = await loc.boundingBox(); const sy = await p.evaluate(() => window.scrollY); if (b) boxes[name] = { x: Math.round(b.x), y: Math.round(b.y + sy), w: Math.round(b.width), h: Math.round(b.height) }; return b }
const hide = async () => { await p.addStyleTag({ content: 'nextjs-portal, [data-nextjs-toast], a[href="/admin"] { display: none !important }' }).catch(() => {}) }
const shot = async (name) => { await hide(); await p.screenshot({ path: OUT + name + '.png', fullPage: true }); const h = await p.evaluate(() => document.documentElement.scrollHeight); boxes['page_' + name] = h; console.log('shot', name, h) }

const browser = await chromium.launch()
const p = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
await p.goto('http://localhost:3005/login'); await p.fill('input[type=email]', get('SUPER_ADMIN_EMAIL')); await p.fill('input[type=password]', get('SUPER_ADMIN_PASSWORD')); await p.click('button.au-submit'); await p.waitForURL((u) => !u.pathname.startsWith('/login'))
await p.goto('http://localhost:3005/make', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500)
await box('drop', p.locator('.rz-drop').first())
await shot('1-empty')
await p.locator('input[type=file]').first().setInputFiles(SRC); await p.waitForTimeout(1500)
await shot('2-uploaded')
const ta = p.locator('textarea').first(); await box('textarea', ta)
const text = 'Change STRONGER to UNSTOPPABLE. Change "STARTS 6 JANUARY" to "STARTS 6 OCTOBER". Change IRONWORKS GYM to FORGE FITNESS.'
await ta.fill(''); await shot('3-typing-empty')
await ta.fill(text); await p.waitForTimeout(300)
const cb = p.locator('input[type=checkbox]').first(); await box('ownit', cb)
const btn = p.locator('button:has-text("Remake it")').first(); await box('remake', btn)
await shot('4-typed')
await cb.check(); await p.waitForTimeout(400); await shot('4b-ticked')
await btn.click(); await p.waitForTimeout(1200)
await shot('5-working')
await p.waitForSelector('img[alt="Remade"]', { timeout: 300000 }); await p.waitForTimeout(1500)
await box('remade', p.locator('img[alt="Remade"]').first())
for (const n of ['Download', 'Edit', 'Sizes', 'Library']) { const l = p.locator(`a:has-text("${n}"), button:has-text("${n}")`).first(); if (await l.count()) await box(n.toLowerCase(), l) }
await shot('6-result')
// save the remade image itself at full size
const src = await p.locator('img[alt="Remade"]').first().getAttribute('src')
if (src?.startsWith('data:')) writeFileSync(OUT + 'remade.png', Buffer.from(src.split(',')[1], 'base64'))
else if (src) { const r = await p.request.get(src); writeFileSync(OUT + 'remade.png', await r.body()) }
await p.goto('http://localhost:3005/library', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500)
await shot('7-library')
writeFileSync(OUT + 'boxes.json', JSON.stringify(boxes, null, 2)); console.log(JSON.stringify(boxes))
await browser.close()
