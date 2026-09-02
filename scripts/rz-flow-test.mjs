// Real-screen test: remake with typed change; restyle with a wording tweak. Saves results for vision check.
import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'fs'
const S = 'C:/Users/tdani/AppData/Local/Temp/claude/C--dev-1---PrismGraphs/b49a578b-8a92-4baa-9740-01972f39bb4f/scratchpad/'
const env = readFileSync('C:/dev/1 - Restylez/.env.local', 'utf8')
const get = (k) => (env.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim().replace(/\r$/, '').replace(/^["']|["']$/g, '')
const TPL = 'C:/dev/1 - PrismGraphs/public/flyer-templates/'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 1000 } })
const errs = []; p.on('pageerror', (e) => errs.push(e.message.slice(0, 200)))
await p.goto('http://localhost:3005/login'); await p.fill('input[type=email]', get('SUPER_ADMIN_EMAIL')); await p.fill('input[type=password]', get('SUPER_ADMIN_PASSWORD')); await p.click('button.au-submit'); await p.waitForURL((u) => !u.pathname.startsWith('/login'))
const saveResult = async (name) => { const src = await p.getAttribute('img[alt="Remade"]', 'src'); writeFileSync(S + name, Buffer.from(src.split(',')[1], 'base64')); console.log('saved', name) }
const t0 = Date.now()
// --- REMAKE: same style, different content
await p.goto('http://localhost:3005/', { waitUntil: 'networkidle' })
await p.locator('input[type=file]').first().setInputFiles(TPL + 'fitness-spin-night.png'); await p.waitForTimeout(800)
await p.locator('textarea').first().fill('Change STRONGER to UNBREAKABLE. Change "STARTS 6 JANUARY" to "STARTS 3 MARCH". Change IRONWORKS GYM to FORGE FITNESS.')
await p.locator('input[type=checkbox]').first().check()
await p.click('button:has-text("Remake it")')
await p.waitForSelector('img[alt="Remade"]', { timeout: 300000 }); await saveResult('flow-remake.png')
console.log('remake took', Math.round((Date.now() - t0) / 1000), 's; error text:', await p.locator('text=/couldn|failed|Please/').first().textContent().catch(() => 'none'))
// --- RESTYLE: same content, different style + a wording tweak
await p.goto('http://localhost:3005/', { waitUntil: 'networkidle' })
await p.click('button:has-text("Same content, different style")'); await p.waitForTimeout(300)
const files = p.locator('input[type=file]')
await files.nth(0).setInputFiles(TPL + 'food-late-night-diner.png'); await p.waitForTimeout(500)
await files.nth(1).setInputFiles(TPL + 'business-awards-night.png'); await p.waitForTimeout(500)
await p.locator('textarea').first().fill('Change "$28 PER HEAD" to "$35 PER HEAD" and "EVERY FRIDAY" to "EVERY SATURDAY".')
await p.locator('input[type=checkbox]').first().check()
const t1 = Date.now()
await p.click('button:has-text("Restyle it")')
await p.waitForSelector('img[alt="Remade"]', { timeout: 300000 }); await saveResult('flow-restyle.png')
console.log('restyle took', Math.round((Date.now() - t1) / 1000), 's')
console.log('page errors:', errs); await b.close()
