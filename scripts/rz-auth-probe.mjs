import { chromium } from 'playwright'
import { readFileSync } from 'fs'
const S = 'C:/Users/tdani/AppData/Local/Temp/claude/C--dev-1---PrismGraphs/b49a578b-8a92-4baa-9740-01972f39bb4f/scratchpad/'
const env = readFileSync('C:/dev/1 - Restylez/.env.local', 'utf8')
const get = (k) => (env.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim().replace(/\r$/, '').replace(/^["']|["']$/g, '')
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 1000 } })
const net = []; p.on('response', (r) => { if (/supabase|auth\/v1|\/api\//.test(r.url())) net.push(r.status() + ' ' + r.request().method() + ' ' + r.url().replace(/https?:\/\/[^/]+/, '').slice(0, 80)) })
p.on('pageerror', (e) => net.push('PAGEERROR ' + e.message.slice(0, 160))); p.on('framenavigated', (f) => f === p.mainFrame() && net.push('NAV ' + f.url().replace('http://localhost:3005', '')))
await p.goto('http://localhost:3005/signup', { waitUntil: 'networkidle' }); await p.waitForTimeout(2500)
const email = get('SUPER_ADMIN_EMAIL').replace('@', '+audit' + Date.now().toString().slice(-5) + '@')
await p.fill('input[placeholder="Jordan Rivera"]', 'Audit Tester'); await p.fill('input[type=email]', email); await p.fill('input[type=password]', 'AuditPass123!')
await p.click('button.au-submit'); await p.waitForTimeout(8000)
await p.screenshot({ path: S + 'signup-after2.jpg', type: 'jpeg', quality: 55 }); console.log('after signup:', p.url().replace('http://localhost:3005', ''), '| text:', (await p.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 260))
await p.goto('http://localhost:3005/login', { waitUntil: 'networkidle' }); await p.waitForTimeout(2500); await p.fill('input[type=email]', get('SUPER_ADMIN_EMAIL')); await p.click('button:has-text("Forgot password")'); await p.waitForTimeout(8000)
console.log('after forgot:', (await p.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 260))
console.log('network:\n' + net.join('\n')); await b.close()
