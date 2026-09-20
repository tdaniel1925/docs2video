import { chromium } from 'playwright'
import { readFileSync } from 'fs'
const RZ = 'C:/dev/1 - Restylez'; const env = readFileSync(RZ + '/.env.local', 'utf8')
const get = (k) => (env.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim().replace(/\r$/, '').replace(/^["']|["']$/g, '')
const PPTX = 'C:/dev/1 - PrismGraphs/refs/BotMakers Strategic AI Partnership Proposal to Zinnia for SmartViews Explainer.pptx'
const ctx = await chromium.launchPersistentContext(process.env.TEMP + '/rz-profile', { viewport: { width: 1920, height: 1080 } })
const p = ctx.pages()[0] || await ctx.newPage()
p.on('response', (r) => { if (r.url().includes('/api/')) console.log(new Date().toISOString().slice(11, 19), r.status(), r.url().replace('http://localhost:3005', '')) })
await p.goto('http://localhost:3005/login', { waitUntil: 'networkidle' })
if (p.url().includes('/login')) { await p.fill('input[type=email]', get('SUPER_ADMIN_EMAIL')); await p.fill('input[type=password]', get('SUPER_ADMIN_PASSWORD')); await p.click('button.au-submit'); await p.waitForURL((u) => !u.pathname.startsWith('/login')) }
await p.goto('http://localhost:3005/pptx', { waitUntil: 'networkidle' }); await p.waitForTimeout(1000)
await p.locator('input[type=file]').first().setInputFiles(PPTX); await p.waitForTimeout(3000)
console.log('after upload:', (await p.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 400))
await p.locator('textarea').first().fill('Change the client name to Harbor Life Group and every date to October 2026.')
await p.locator('input[type=checkbox]').first().check()
await p.locator('button:has-text("Open + apply my changes")').first().click()
for (let i = 0; i < 16; i++) { await p.waitForTimeout(30000); const t = (await p.evaluate(() => document.body.innerText)).replace(/\s+/g, ' '); console.log(`t+${(i + 1) * 30}s:`, t.slice(t.indexOf('PowerPoint'), t.indexOf('PowerPoint') + 260)); if (/Download my PowerPoint|couldn’t|Could not/.test(t)) break }
await p.screenshot({ path: process.env.TEMP + '/pptx-diag.png', fullPage: true }); await ctx.close()
