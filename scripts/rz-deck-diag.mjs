import { chromium } from 'playwright'
import { readFileSync } from 'fs'
const RZ = 'C:/dev/1 - Restylez'; const env = readFileSync(RZ + '/.env.local', 'utf8')
const get = (k) => (env.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim().replace(/\r$/, '').replace(/^["']|["']$/g, '')
const LOOK = 'C:/dev/1 - PrismGraphs/remotion/public/restylez/reference-2.png'
const OUT = 'C:/dev/1 - PrismGraphs/remotion/public/showcase/rzdeck/'
const ctx = await chromium.launchPersistentContext(process.env.TEMP + '/rz-profile', { viewport: { width: 1920, height: 1080 } })
const p = ctx.pages()[0] || await ctx.newPage()
const ts = () => new Date().toISOString().slice(11, 19)
p.on('response', (r) => { if (r.url().includes('/api/')) console.log(ts(), r.status(), r.url().replace('http://localhost:3005', '')) })
p.on('pageerror', (e) => console.log('PAGEERROR', String(e).slice(0, 200)))
await p.goto('http://localhost:3005/login', { waitUntil: 'networkidle' })
if (p.url().includes('/login')) { await p.fill('input[type=email]', get('SUPER_ADMIN_EMAIL')); await p.fill('input[type=password]', get('SUPER_ADMIN_PASSWORD')); await p.click('button.au-submit'); await p.waitForURL((u) => !u.pathname.startsWith('/login')) }
await p.goto('http://localhost:3005/deck', { waitUntil: 'networkidle' }); await p.waitForTimeout(1000)
await p.locator('textarea').first().fill('A 6-slide pitch for Forge Fitness: a six-week strength program. Cover, the problem, the program, coaches, results (3,105 members, 96% finished), and how to join.')
await p.locator('button:has-text("Build the plan")').first().click(); await p.waitForFunction(() => document.body.innerText.includes('Build the deck'), null, { timeout: 300000 })
console.log(ts(), 'plan ready'); await p.waitForTimeout(800)
await p.locator('input[type=file][accept="image/*"]').first().setInputFiles(LOOK); await p.waitForTimeout(1800)
await p.locator('input[type=checkbox]').first().check(); await p.waitForTimeout(300)
const b = p.locator('button:has-text("Build the deck")').first(); console.log(ts(), 'build enabled:', await b.isEnabled()); await b.click()
for (let i = 0; i < 20; i++) {
  await p.waitForTimeout(45000); const t = (await p.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  const k = t.indexOf('Style'); console.log(ts(), t.slice(Math.max(0, t.indexOf('Your deck')), t.indexOf('Your deck') + 120) || '(no Your deck)', '|', t.slice(k, k + 160))
  if (/Your deck — \d+ slide/.test(t) || /failed/.test(t)) break
}
await p.screenshot({ path: OUT + '6-result.png', fullPage: true }); console.log(ts(), 'shot saved, pageH', await p.evaluate(() => document.documentElement.scrollHeight))
await ctx.close()
