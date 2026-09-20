import { chromium } from 'playwright'
import { readFileSync } from 'fs'
const S = 'C:/Users/tdani/AppData/Local/Temp/claude/C--dev-1---PrismGraphs/b49a578b-8a92-4baa-9740-01972f39bb4f/scratchpad/'
const env = readFileSync('C:/dev/1 - Restylez/.env.local', 'utf8')
const get = (k) => (env.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim().replace(/\r$/, '').replace(/^["']|["']$/g, '')
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
const errs = []; p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))
await p.goto('http://localhost:3005/login', { waitUntil: 'networkidle' }); await p.waitForTimeout(1200); await p.fill('input[type=email]', get('SUPER_ADMIN_EMAIL')); await p.fill('input[type=password]', get('SUPER_ADMIN_PASSWORD')); await p.click('button.au-submit'); await p.waitForURL((u) => !u.pathname.startsWith('/login'), { waitUntil: 'domcontentloaded', timeout: 120000 })
await p.goto('http://localhost:3005/library', { waitUntil: 'networkidle' })
// seed 5 designs with real example images
await p.evaluate(async () => {
  const files = ['gym-after.jpg', 'club-after.jpg', 'summit-after.jpg', 'pool-after.jpg', 'salsa-photo.jpg']
  const db = await new Promise((res, rej) => { const r = indexedDB.open('restylez', 3); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
  for (const [i, f] of files.entries()) { const blob = await (await fetch('/examples/' + f)).blob(); const tx = db.transaction('designs', 'readwrite'); tx.objectStore('designs').put({ id: 'seed-' + i, createdAt: Date.now() - i * 3600000, updatedAt: Date.now() - i * 3600000, changes: ['Change STRONGER to UNBREAKABLE, starts 3 March', 'Friday 18 October, doors 10pm, The Warehouse', 'Founders Dinner, Friday 7 November', 'Sunday afternoon, 6 July, The Rooftop', 'The Blue Room, add my photo'][i], original: blob, result: blob, rounds: [{ note: 'Fresh from the maker', blob }], sizes: [] }); await new Promise((res) => { tx.oncomplete = res }) }
})
await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(1500)
await p.hover('.lib-thumb >> nth=1'); await p.waitForTimeout(400); await p.screenshot({ path: S + 'lib-list.jpg', type: 'jpeg', quality: 60 })
await p.click('.lib-toggle button:has-text("Grid")'); await p.waitForTimeout(600); await p.screenshot({ path: S + 'lib-grid.jpg', type: 'jpeg', quality: 60 })
await p.click('.lib-toggle button:has-text("List")'); await p.click('a[href="/edit?design=seed-0"]'); await p.waitForURL(/\/edit/); await p.waitForTimeout(2000); await p.screenshot({ path: S + 'editor.jpg', type: 'jpeg', quality: 60 })
await p.goto('http://localhost:3005/account', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500); await p.screenshot({ path: S + 'account2.jpg', type: 'jpeg', quality: 60, fullPage: true })
// clean seeds
await p.goto('http://localhost:3005/library', { waitUntil: 'networkidle' }); await p.evaluate(async () => { const db = await new Promise((res) => { const r = indexedDB.open('restylez', 3); r.onsuccess = () => res(r.result) }); const tx = db.transaction('designs', 'readwrite'); for (let i = 0; i < 5; i++) tx.objectStore('designs').delete('seed-' + i); await new Promise((res) => { tx.oncomplete = res }) })
console.log('errors:', errs); await b.close()
