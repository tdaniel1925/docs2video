import { chromium } from 'playwright'
import { readFileSync } from 'fs'
const RZ = 'C:/dev/1 - Restylez'; const env = readFileSync(RZ + '/.env.local', 'utf8')
const get = (k) => (env.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim().replace(/\r$/, '').replace(/^["']|["']$/g, '')
const PPTX = process.argv[2] || 'C:/dev/1 - Apex Pre-Launch Site/General - Apex Flyer.pptx'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 1080 } })
const ts = () => new Date().toISOString().slice(11, 19)
p.on('response', (r) => { if (r.url().includes('/api/')) console.log(ts(), r.status(), r.url().replace('http://localhost:3005', '')) })
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('CONSOLE', m.type(), m.text().slice(0, 240)) })
p.on('pageerror', (e) => console.log('PAGEERROR', String(e).slice(0, 240)))
await p.goto('http://localhost:3005/login', { waitUntil: 'networkidle' })
await p.fill('input[type=email]', get('SUPER_ADMIN_EMAIL')); await p.fill('input[type=password]', get('SUPER_ADMIN_PASSWORD')); await p.click('button.au-submit'); await p.waitForURL((u) => !u.pathname.startsWith('/login'))
await p.goto('http://localhost:3005/pptx', { waitUntil: 'networkidle' }); await p.waitForTimeout(800)
await p.locator('input[type=file]').first().setInputFiles(PPTX); await p.waitForTimeout(4000)
await p.locator('textarea').first().fill('Change the client name to Harbor Life Group and every date to October 2026.')
await p.locator('input[type=checkbox]').first().check(); await p.waitForTimeout(300)
const btn = p.locator('button:has-text("Open + apply my changes")').first(); console.log(ts(), 'enabled', await btn.isEnabled()); await btn.click()
for (let i = 0; i < 8; i++) { await p.waitForTimeout(10000); const t = (await p.evaluate(() => document.body.innerText)).replace(/\s+/g, ' '); const k = t.indexOf('Tell the AI'); console.log(ts(), t.slice(k, k + 200)); if (/Download my PowerPoint|couldn’t|Could not/.test(t)) break }
await b.close()
