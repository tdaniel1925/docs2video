import { chromium } from 'playwright'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
await p.goto('http://localhost:3005/welcome#tools', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500)
await p.evaluate(() => window.scrollBy(0, 260)); await p.waitForTimeout(1200)
const hs = await p.evaluate(() => [...document.querySelectorAll('#tools .mk-card')].map((c) => Math.round(c.getBoundingClientRect().height)))
console.log('card heights:', hs.join(','))
await p.screenshot({ path: 'C:/Users/tdani/AppData/Local/Temp/claude/C--dev-1---PrismGraphs/b49a578b-8a92-4baa-9740-01972f39bb4f/scratchpad/tools.jpg', type: 'jpeg', quality: 60 }); await b.close()
