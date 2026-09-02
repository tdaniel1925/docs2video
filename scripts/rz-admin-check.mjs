import { chromium } from 'playwright'
import { readFileSync } from 'fs'
const env = readFileSync('C:/dev/1 - Restylez/.env.local', 'utf8')
const get = (k) => (env.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim().replace(/\r$/, '').replace(/^["']|["']$/g, '')
const b = await chromium.launch(); const p = await b.newPage()
await p.goto('http://localhost:3005/login'); await p.fill('input[type=email]', get('SUPER_ADMIN_EMAIL')); await p.fill('input[type=password]', get('SUPER_ADMIN_PASSWORD')); await p.click('button.au-submit'); await p.waitForURL((u) => !u.pathname.startsWith('/login'))
for (const v of ['me', 'stats', 'customers', 'jobs', 'settings', 'audit', 'health']) {
  const r = await p.request.get('http://localhost:3005/api/admin?view=' + v); const j = await r.json()
  console.log(v, r.status(), j.error ? 'ERROR: ' + j.error : Object.keys(j).slice(0, 5).join(','))
}
await b.close()
