import { chromium } from 'playwright'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
await p.goto('http://localhost:3005/welcome'); await p.waitForTimeout(800)
const r = await p.evaluate(() => [...document.querySelectorAll('.mk [id]')].map((s) => { const h = s.querySelector('.mk-h2, h2, h1'); const st = getComputedStyle(s); return `${s.id}: tag=${s.tagName} class=${s.className.slice(0,30)} padTop=${st.paddingTop} scrollMargin=${st.scrollMarginTop} h2offset=${h ? Math.round(h.getBoundingClientRect().top - s.getBoundingClientRect().top) : 'none'}` }))
console.log(r.join('\n')); await b.close()
