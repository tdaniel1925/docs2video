import { chromium } from 'playwright'
import { readFileSync } from 'fs'
const S = 'C:/Users/tdani/AppData/Local/Temp/claude/C--dev-1---PrismGraphs/b49a578b-8a92-4baa-9740-01972f39bb4f/scratchpad/'
const env = readFileSync('C:/dev/1 - Restylez/.env.local', 'utf8')
const get = (k) => (env.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim().replace(/\r$/, '').replace(/^["']|["']$/g, '')
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 1000 } })
const errs = []; p.on('pageerror', (e) => errs.push(e.message.slice(0, 200))); p.on('console', (m) => m.type() === 'error' && errs.push('console: ' + m.text().slice(0, 200)))
await p.goto('http://localhost:3005/login'); await p.fill('input[type=email]', get('SUPER_ADMIN_EMAIL')); await p.fill('input[type=password]', get('SUPER_ADMIN_PASSWORD')); await p.click('button.au-submit'); await p.waitForURL((u) => !u.pathname.startsWith('/login'), { waitUntil: 'domcontentloaded', timeout: 90000 })
await p.goto('http://localhost:3005/pptx', { waitUntil: 'domcontentloaded' }); await p.waitForSelector('input[type=file]', { state: 'attached' })
await p.locator('input[type=file]').first().setInputFiles('C:/dev/1 - Apex Pre-Launch Site/General - Apex Flyer.pptx')
for (let i = 0; i < 20; i++) { await p.waitForTimeout(1000); if (await p.locator('input[type=checkbox]').count()) break }
console.log('checkbox appeared:', await p.locator('input[type=checkbox]').count() > 0, '| body:', (await p.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 400))
await p.screenshot({ path: S + 'pptx-state.jpg', type: 'jpeg', quality: 55, fullPage: true }); console.log('errors:', errs); await b.close()
