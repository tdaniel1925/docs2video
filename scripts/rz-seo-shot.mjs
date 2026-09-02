import { chromium } from 'playwright'
const S = 'C:/Users/tdani/AppData/Local/Temp/claude/C--dev-1---PrismGraphs/b49a578b-8a92-4baa-9740-01972f39bb4f/scratchpad/'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
for (const u of ['/sitemap.xml', '/robots.txt']) { const r = await p.request.get('http://localhost:3005' + u); console.log(u, r.status(), (await r.text()).slice(0, 160).replace(/\n/g, ' ')) }
await p.goto('http://localhost:3005/vs/canva', { waitUntil: 'networkidle' })
console.log('title:', await p.title()); console.log('og:', await p.getAttribute('meta[property="og:image"]', 'content'))
for (let y = 0; y < 6000; y += 600) { await p.evaluate((y) => window.scrollTo(0, y), y); await p.waitForTimeout(100) }
await p.screenshot({ path: S + 'vs-canva.jpg', type: 'jpeg', quality: 50, fullPage: true })
await p.goto('http://localhost:3005/welcome#flyers', { waitUntil: 'networkidle' }); await p.waitForTimeout(800)
await p.evaluate(() => { const c = document.querySelectorAll('.mk-stack-card')[2]; window.scrollBy(0, c.getBoundingClientRect().top - 200) }); await p.waitForTimeout(1200)
await p.screenshot({ path: S + 'stack.jpg', type: 'jpeg', quality: 60 })
const broken = await p.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.getAttribute('src')))
console.log('broken images on welcome:', broken); await b.close()
