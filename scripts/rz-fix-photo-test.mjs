import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'fs'
const S = 'C:/Users/tdani/AppData/Local/Temp/claude/C--dev-1---PrismGraphs/b49a578b-8a92-4baa-9740-01972f39bb4f/scratchpad/'
const env = readFileSync('C:/dev/1 - Restylez/.env.local', 'utf8')
const get = (k) => (env.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim().replace(/\r$/, '').replace(/^["']|["']$/g, '')
const TPL = 'C:/dev/1 - PrismGraphs/public/flyer-templates/'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 1000 } })
const errs = []; p.on('pageerror', (e) => errs.push(e.message.slice(0, 200)))
await p.goto('http://localhost:3005/login'); await p.fill('input[type=email]', get('SUPER_ADMIN_EMAIL')); await p.fill('input[type=password]', get('SUPER_ADMIN_PASSWORD')); await p.click('button.au-submit'); await p.waitForURL((u) => !u.pathname.startsWith('/login'), { waitUntil: 'domcontentloaded', timeout: 90000 })
await p.goto('http://localhost:3005/', { waitUntil: 'networkidle' }); await p.waitForTimeout(2500)
// remake + ADD A PHOTO (the Jordyn founder photo as "the DJ")
await p.locator('input[type=file]').nth(0).setInputFiles(TPL + 'music-salsa-night.png'); await p.waitForTimeout(1200)
await p.locator('textarea').first().fill('Change THE OLD HALL to THE BLUE ROOM. Add my photo as the featured performer.')
await p.locator('input[type=file]').last().setInputFiles('C:/dev/1 - Restylez/public/about/founder-trent.webp'); await p.waitForTimeout(800)
for (let i = 0; i < 20 && !(await p.locator('input[type=checkbox]').count()); i++) await p.waitForTimeout(1000)
await p.screenshot({ path: S + 'photo-state.jpg', type: 'jpeg', quality: 55, fullPage: true })
await p.locator('input[type=checkbox]').first().check()
let t = Date.now(); await p.click('button:has-text("Remake it")'); await p.waitForSelector('img[alt="Remade"]', { timeout: 400000 })
let src = await p.getAttribute('img[alt="Remade"]', 'src'); writeFileSync(S + 'flow-photo.png', Buffer.from(src.split(',')[1], 'base64')); console.log('remake+photo done in', Math.round((Date.now() - t) / 1000), 's')
// FIX BY CHAT
await p.click('button:has-text("Fix")').catch(async () => { await p.click('text=/fix/i') })
await p.waitForSelector('aside textarea', { timeout: 10000 }); await p.locator('aside textarea').fill('Make the date line bigger and brighter.')
t = Date.now(); await p.click('aside button:has-text("Send")').catch(async () => { await p.locator('aside button.rz-btn--accent').click() })
await p.waitForFunction((old) => document.querySelector('img[alt="Remade"]')?.getAttribute('src') !== old, src, { timeout: 400000 })
src = await p.getAttribute('img[alt="Remade"]', 'src'); writeFileSync(S + 'flow-fix.png', Buffer.from(src.split(',')[1], 'base64')); console.log('fix round done in', Math.round((Date.now() - t) / 1000), 's')
console.log('rounds text:', (await p.locator('text=/fix round/').first().textContent().catch(() => '(none)')))
await p.screenshot({ path: S + 'flow-fix-ui.jpg', type: 'jpeg', quality: 55 }); await p.goto('http://localhost:3005/library', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500); console.log('library cards after remake:', await p.locator('a[href^="/?open="]').count() / 2)
console.log('errors:', errs); await b.close()
