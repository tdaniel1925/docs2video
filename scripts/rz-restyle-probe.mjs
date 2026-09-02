import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'fs'
const S = 'C:/Users/tdani/AppData/Local/Temp/claude/C--dev-1---PrismGraphs/b49a578b-8a92-4baa-9740-01972f39bb4f/scratchpad/'
const env = readFileSync('C:/dev/1 - Restylez/.env.local', 'utf8')
const get = (k) => (env.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim().replace(/\r$/, '').replace(/^["']|["']$/g, '')
const TPL = 'C:/dev/1 - PrismGraphs/public/flyer-templates/'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 1000 } })
await p.goto('http://localhost:3005/login'); await p.fill('input[type=email]', get('SUPER_ADMIN_EMAIL')); await p.fill('input[type=password]', get('SUPER_ADMIN_PASSWORD')); await p.click('button.au-submit'); await p.waitForURL((u) => !u.pathname.startsWith('/login'), { waitUntil: 'domcontentloaded', timeout: 90000 })
await p.goto('http://localhost:3005/', { waitUntil: 'networkidle' })
await p.click('button:has-text("Same content, different style")'); await p.waitForTimeout(400)
const files = p.locator('input[type=file]'); console.log('file inputs in restyle mode:', await files.count())
await files.nth(0).setInputFiles(TPL + 'food-late-night-diner.png'); await p.waitForTimeout(1500)
await p.locator('label.rz-drop input[type=file]').first().setInputFiles(TPL + 'business-awards-night.png'); await p.waitForTimeout(1500)
console.log('preview imgs:', await p.locator('img[src^="data:"]').count())
const cbs = p.locator('input[type=checkbox]'); console.log('checkboxes:', await cbs.count()); await cbs.first().check()
await p.locator('textarea').first().fill('Change "$28 PER HEAD" to "$35 PER HEAD" and "EVERY FRIDAY" to "EVERY SATURDAY".')
const btn = p.locator('button:has-text("Restyle it")'); console.log('button disabled:', await btn.isDisabled())
await p.screenshot({ path: S + 'restyle-state.jpg', type: 'jpeg', quality: 55, fullPage: true })
if (!(await btn.isDisabled())) {
  const t = Date.now(); await btn.click(); await p.waitForSelector('img[alt="Remade"]', { timeout: 300000 })
  const src = await p.getAttribute('img[alt="Remade"]', 'src'); writeFileSync(S + 'flow-restyle.png', Buffer.from(src.split(',')[1], 'base64')); console.log('restyle done in', Math.round((Date.now() - t) / 1000), 's')
}
await b.close()
