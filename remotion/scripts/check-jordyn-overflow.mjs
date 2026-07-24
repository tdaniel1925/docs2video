// Overflow audit: walk every section at multiple viewports, report any element
// whose rect exceeds the viewport (cut off) or collides with the bottom nav.
import { chromium } from 'playwright'
const b = await chromium.launch()
const VPS = [[1366, 768], [1280, 720], [1440, 900], [1920, 1080]]
for (const [w, h] of VPS) {
  const pg = await b.newPage({ viewport: { width: w, height: h } })
  await pg.goto('file:///C:/dev/1%20-%20PrismGraphs/remotion/out/jordyn-features.html')
  await pg.waitForTimeout(500)
  const n = await pg.evaluate(() => document.querySelectorAll('.sec').length)
  for (let i = 0; i < n; i++) {
    await pg.evaluate((idx) => { /* jump directly */ window.__go && window.__go(idx) }, i)
    // fallback: press right until index (engine has no global; use dots)
    await pg.evaluate((idx) => { document.querySelectorAll('#dots i')[idx].click() }, i)
    await pg.waitForTimeout(450)
    const navTop = await pg.evaluate(() => document.getElementById('nav').getBoundingClientRect().top)
    const issues = await pg.evaluate(({ vw, vh, navTop }) => {
      const sec = [...document.querySelectorAll('.sec')].find(s => s.classList.contains('on'))
      const out = []
      const els = sec.querySelectorAll('h1,h2,.lead,.step,.fcard,.scard,.pcard,.chan,.illo,.btn,.marq,.dcard,.wrap')
      for (const el of els) {
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) continue
        const tag = el.className.split(' ')[0] + (el.tagName.match(/H\d/) ? '' : '')
        if (r.bottom > vh + 1) out.push(`${tag} bottom ${Math.round(r.bottom)}>${vh} (cut off bottom)`)
        if (r.top < -1) out.push(`${tag} top ${Math.round(r.top)}<0 (cut off top)`)
        if (r.right > vw + 1) out.push(`${tag} right ${Math.round(r.right)}>${vw}`)
        if (r.left < -1) out.push(`${tag} left ${Math.round(r.left)}<0`)
        // collides with nav (nav sits ~bottom center)
        if (r.bottom > navTop && r.top < navTop && r.left < vw * 0.75 && r.right > vw * 0.25) out.push(`${tag} overlaps nav (bottom ${Math.round(r.bottom)} > navTop ${Math.round(navTop)})`)
      }
      const name = sec.querySelector('.lab') // not present
      return [...new Set(out)]
    }, { vw: w, vh: h, navTop })
    if (issues.length) console.log(`[${w}x${h}] section ${i}: ` + issues.join(' | '))
  }
  await pg.close()
}
console.log('AUDIT DONE')
await b.close()
process.exit(0)
