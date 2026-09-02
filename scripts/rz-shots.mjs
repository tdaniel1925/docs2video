import { chromium } from 'playwright'
const S = 'C:/Users/tdani/AppData/Local/Temp/claude/C--dev-1---PrismGraphs/b49a578b-8a92-4baa-9740-01972f39bb4f/scratchpad/'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
const errs = []; p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 120)))
await p.goto('http://localhost:3005/examples', { waitUntil: 'networkidle' })
// force all reveals visible then full-page shot
await p.evaluate(() => { window.scrollTo(0, document.body.scrollHeight) }); await p.waitForTimeout(800)
for (let y = 0; y < 20000; y += 700) { await p.evaluate((y) => window.scrollTo(0, y), y); await p.waitForTimeout(120) }
await p.waitForTimeout(800)
const broken = await p.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.getAttribute('src')))
console.log('broken images on /examples:', broken)
await p.screenshot({ path: S + 'examples-full.jpg', type: 'jpeg', quality: 55, fullPage: true })
await p.goto('http://localhost:3005/welcome', { waitUntil: 'networkidle' })
for (let y = 0; y < 20000; y += 700) { await p.evaluate((y) => window.scrollTo(0, y), y); await p.waitForTimeout(120) }
const broken2 = await p.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.getAttribute('src')))
console.log('broken images on /welcome:', broken2)
await p.evaluate(() => document.querySelector('#formats').scrollIntoView()); await p.waitForTimeout(1500)
await p.screenshot({ path: S + 'welcome-formats.jpg', type: 'jpeg', quality: 60 })
await p.evaluate(() => document.querySelector('#flyers').scrollIntoView()); await p.waitForTimeout(1500)
await p.screenshot({ path: S + 'welcome-flyers.jpg', type: 'jpeg', quality: 60 })
await p.evaluate(() => document.querySelector('.mk-foot').scrollIntoView()); await p.waitForTimeout(1200)
await p.screenshot({ path: S + 'welcome-footer.jpg', type: 'jpeg', quality: 60 })
console.log('console errors:', errs.slice(0, 5)); await b.close()
