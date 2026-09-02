import { chromium } from 'playwright'
const S = 'C:/Users/tdani/AppData/Local/Temp/claude/C--dev-1---PrismGraphs/b49a578b-8a92-4baa-9740-01972f39bb4f/scratchpad/'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 1000 } })
await p.goto('http://localhost:3005/#demo', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500)
await p.evaluate(() => document.querySelector('#demo')?.scrollIntoView()); await p.waitForTimeout(1500)
await p.screenshot({ path: S + 'demo-section.jpg', type: 'jpeg', quality: 60 })
await p.click('.mk-demo-look:nth-child(2)'); await p.waitForTimeout(800); await p.screenshot({ path: S + 'demo-gold.jpg', type: 'jpeg', quality: 60 })
console.log('broken imgs:', await p.evaluate(() => [...document.querySelectorAll('.mk-demo img')].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.getAttribute('src'))))
await b.close()
