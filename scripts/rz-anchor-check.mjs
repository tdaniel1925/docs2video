import { chromium } from 'playwright'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
await p.goto('http://localhost:3005/welcome'); await p.waitForTimeout(800)
for (const id of ['flyers', 'decks', 'compare']) {
  await p.click(`.mk-nav a[href="#${id}"]`); await p.waitForTimeout(3000)
  const r = await p.evaluate((id) => { const h = document.querySelector(`#${id} .mk-h2`); return h ? Math.round(h.getBoundingClientRect().top) : -1 }, id)
  console.log(id, 'title top from viewport:', r)
}
await p.screenshot({ path: 'C:/Users/tdani/AppData/Local/Temp/claude/C--dev-1---PrismGraphs/b49a578b-8a92-4baa-9740-01972f39bb4f/scratchpad/anchor.jpg', type: 'jpeg', quality: 60 })
await b.close()
