import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const S = 'C:/Users/tdani/AppData/Local/Temp/claude/C--dev-1---PrismGraphs/b49a578b-8a92-4baa-9740-01972f39bb4f/scratchpad/'
const b = await chromium.launch(); const ctx = await b.newContext(); const p = await ctx.newPage({ viewport: { width: 1440, height: 1000 } })
await p.goto('http://localhost:3005/#demo', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500)
await p.click('.mk-demo-look:nth-child(2)')  // Gold Gala
await p.fill('.mk-demo-form input[placeholder="Forge Fitness"]', 'Harbor Dental Studio')
await p.fill('.mk-demo-form input[placeholder^="Small-group"]', 'Gentle family dentistry and smile makeovers in Tampa')
const email = 'tdaniel+demo' + Date.now().toString().slice(-5) + '@botmakers.ai'
await p.fill('.mk-demo-form input[type=email]', email)
const t = Date.now(); await p.click('button:has-text("Make mine in Gold Gala")')
await p.waitForSelector('text=Made just now', { timeout: 400000 }); console.log('demo made in', Math.round((Date.now() - t) / 1000), 's')
await p.evaluate(() => document.querySelector('#demo')?.scrollIntoView()); await p.waitForTimeout(1500)
await p.screenshot({ path: S + 'demo-result.jpg', type: 'jpeg', quality: 60 })
// second attempt from same browser → cookie returns the same run, no spend
const r = await p.request.post('http://localhost:3005/api/demo', { data: { look: 'neon', name: 'X', about: '', email: 'other' + Date.now() + '@botmakers.ai' } }); const j = await r.json(); console.log('same browser again →', r.status(), j.code || j.error)
// fresh browser, same email → refused
const p2 = await (await b.newContext()).newPage(); const r2 = await p2.request.post('http://localhost:3005/api/demo', { data: { look: 'neon', name: 'X', about: '', email } }); const j2 = await r2.json(); console.log('new browser, same email →', r2.status(), j2.code, '|', j2.error)
const r3 = await p2.request.post('http://localhost:3005/api/demo', { data: { look: 'neon', name: 'X', about: '', email: 'a@mailinator.com' } }); const j3 = await r3.json(); console.log('throwaway email →', r3.status(), j3.code)
const r4 = await p2.request.post('http://localhost:3005/api/demo', { data: { look: 'neon', name: 'X', about: '', email: 'bot@x.com', website: 'spam' } }); console.log('honeypot →', r4.status())
await b.close()
