import { chromium } from 'playwright'
import { readFileSync } from 'fs'
const S = 'C:/Users/tdani/AppData/Local/Temp/claude/C--dev-1---PrismGraphs/b49a578b-8a92-4baa-9740-01972f39bb4f/scratchpad/'
const env = readFileSync('C:/dev/1 - Restylez/.env.local', 'utf8')
const get = (k) => (env.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim().replace(/\r$/, '').replace(/^["']|["']$/g, '')
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
const errs = []; p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))
await p.goto('http://localhost:3005/login'); await p.fill('input[type=email]', get('SUPER_ADMIN_EMAIL')); await p.fill('input[type=password]', get('SUPER_ADMIN_PASSWORD')); await p.click('button.au-submit'); await p.waitForURL((u) => !u.pathname.startsWith('/login'))
await p.goto('http://localhost:3005/sizes', { waitUntil: 'networkidle' }); await p.waitForTimeout(800)
await p.screenshot({ path: S + 'sizes-1.jpg', type: 'jpeg', quality: 60 })
// upload a design and open the size picker
await p.setInputFiles('input[type=file]', 'C:/dev/1 - Restylez/public/examples/club-before.jpg'); await p.waitForTimeout(600)
await p.click('text=Event kit'); await p.waitForTimeout(300)
await p.screenshot({ path: S + 'sizes-2.jpg', type: 'jpeg', quality: 60, fullPage: true })
await p.goto('http://localhost:3005/library', { waitUntil: 'networkidle' }); await p.waitForTimeout(800)
await p.screenshot({ path: S + 'library.jpg', type: 'jpeg', quality: 60 })
console.log('page errors:', errs); await b.close()
