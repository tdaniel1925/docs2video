import { chromium } from 'playwright'
import { readFileSync } from 'fs'
const S = 'C:/Users/tdani/AppData/Local/Temp/claude/C--dev-1---PrismGraphs/b49a578b-8a92-4baa-9740-01972f39bb4f/scratchpad/'
const env = readFileSync('C:/dev/1 - Restylez/.env.local', 'utf8')
const get = (k) => (env.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim().replace(/\r$/, '').replace(/^["']|["']$/g, '')
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
await p.goto('http://localhost:3005/about', { waitUntil: 'networkidle' }); await p.screenshot({ path: S + 'about-nav.jpg', type: 'jpeg', quality: 55, clip: { x: 0, y: 0, width: 1440, height: 120 } })
await p.goto('http://localhost:3005/', { waitUntil: 'networkidle' }); await p.screenshot({ path: S + 'home-nav.jpg', type: 'jpeg', quality: 55, clip: { x: 0, y: 0, width: 1440, height: 120 } })
await p.click('.mk-nav a[href="/#pricing"]'); await p.waitForTimeout(2000); console.log('pricing anchor from home lands title at:', await p.evaluate(() => Math.round(document.querySelector('#pricing .mk-h2')?.getBoundingClientRect().top ?? -1)))
await p.goto('http://localhost:3005/login', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500); await p.fill('input[type=email]', get('SUPER_ADMIN_EMAIL')); await p.fill('input[type=password]', get('SUPER_ADMIN_PASSWORD')); await p.click('button.au-submit'); await p.waitForURL((u) => !u.pathname.startsWith('/login'), { waitUntil: 'domcontentloaded', timeout: 120000 }); console.log('after login →', p.url().replace('http://localhost:3005', ''))
const r = await p.request.post('http://localhost:3005/api/wallet/checkout', { data: { cents: 12345 } }); const j = await r.json().catch(() => ({})); console.log('checkout 123.45 →', r.status(), j.error || ('stripe url: ' + String(j.url).startsWith('https://checkout.stripe.com') + ', bonus ' + j.bonus))
await p.goto('http://localhost:3005/account', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500); const el = p.locator('text=ADD FUNDS').first(); await el.scrollIntoViewIfNeeded(); await p.screenshot({ path: S + 'topup.jpg', type: 'jpeg', quality: 60 })
await b.close()
