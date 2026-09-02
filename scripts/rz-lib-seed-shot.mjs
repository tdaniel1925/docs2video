import { chromium } from 'playwright'
import { readFileSync } from 'fs'
const S = 'C:/Users/tdani/AppData/Local/Temp/claude/C--dev-1---PrismGraphs/b49a578b-8a92-4baa-9740-01972f39bb4f/scratchpad/'
const env = readFileSync('C:/dev/1 - Restylez/.env.local', 'utf8')
const get = (k) => (env.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim().replace(/\r$/, '').replace(/^["']|["']$/g, '')
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
await p.goto('http://localhost:3005/login'); await p.fill('input[type=email]', get('SUPER_ADMIN_EMAIL')); await p.fill('input[type=password]', get('SUPER_ADMIN_PASSWORD')); await p.click('button.au-submit'); await p.waitForURL((u) => !u.pathname.startsWith('/login'))
await p.goto('http://localhost:3005/library', { waitUntil: 'networkidle' })
// seed 30 designs straight into the app's own IndexedDB
await p.evaluate(async () => {
  const blob = await (await fetch('/examples/club-before.jpg')).blob()
  const db = await new Promise((res, rej) => { const r = indexedDB.open('restylez', 3); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
  const tx = db.transaction('designs', 'readwrite'); const st = tx.objectStore('designs')
  for (let i = 0; i < 30; i++) st.put({ id: 'seed-' + i, createdAt: Date.now() - i * 3600000, updatedAt: Date.now() - i * 3600000, changes: 'Test design ' + (i + 1), original: blob, result: blob, rounds: [], sizes: [] })
  await new Promise((res) => { tx.oncomplete = res })
})
await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(1500)
await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(500)
await p.screenshot({ path: S + 'library-paged.jpg', type: 'jpeg', quality: 60 })
const n = await p.evaluate(() => document.querySelectorAll('a[href^="/sizes?design="]').length)
console.log('More-sizes buttons on page 1:', n)
// clean up
await p.evaluate(async () => { const db = await new Promise((res) => { const r = indexedDB.open('restylez', 3); r.onsuccess = () => res(r.result) }); const tx = db.transaction('designs', 'readwrite'); for (let i = 0; i < 30; i++) tx.objectStore('designs').delete('seed-' + i); await new Promise((res) => { tx.oncomplete = res }) })
await b.close()
