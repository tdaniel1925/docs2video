import { chromium } from 'playwright'
import { readFileSync } from 'fs'
const S = 'C:/Users/tdani/AppData/Local/Temp/claude/C--dev-1---PrismGraphs/b49a578b-8a92-4baa-9740-01972f39bb4f/scratchpad/'
const env = readFileSync('C:/dev/1 - Restylez/.env.local', 'utf8')
const get = (k) => (env.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim().replace(/\r$/, '').replace(/^["']|["']$/g, '')
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 1000 } })
await p.goto('http://localhost:3005/login', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500); await p.fill('input[type=email]', get('SUPER_ADMIN_EMAIL')); await p.fill('input[type=password]', get('SUPER_ADMIN_PASSWORD')); await p.click('button.au-submit'); await p.waitForURL((u) => !u.pathname.startsWith('/login'), { waitUntil: 'domcontentloaded', timeout: 120000 })
for (const cents of [500, 2000, 12345]) { const r = await p.request.post('http://localhost:3005/api/wallet/checkout', { data: { cents } }); const j = await r.json().catch(() => ({})); console.log('checkout', cents, '→', r.status(), j.error || ('url ok: ' + String(j.url).startsWith('https://checkout.stripe.com') + ' bonus ' + j.bonus)) }
await p.goto('http://localhost:3005/account', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500)
await p.evaluate(() => document.querySelector('text=ADD FUNDS')); await p.screenshot({ path: S + 'topup.jpg', type: 'jpeg', quality: 60, fullPage: true })
await p.goto('http://localhost:3005/welcome#demo', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500); await p.evaluate(() => document.querySelector('#demo')?.scrollIntoView()); await p.waitForTimeout(1200)
await p.screenshot({ path: S + 'demo-section.jpg', type: 'jpeg', quality: 60 }); await b.close()
