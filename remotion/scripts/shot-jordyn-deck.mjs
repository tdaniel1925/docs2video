import { chromium } from 'playwright'
const b = await chromium.launch()
const pg = await b.newPage({ viewport: { width: 1600, height: 900 } })
await pg.goto('file:///C:/dev/1%20-%20PrismGraphs/remotion/out/jordyn-features.html')
const next = async (n) => { await pg.keyboard.press('ArrowRight'); await pg.waitForTimeout(650); if (n) await pg.screenshot({ path: 'out/jd-' + n + '.png' }) }
await pg.waitForTimeout(700); await pg.screenshot({ path: 'out/jd-0hero.png' })
await next('1steps')
await next('2grid')
// click a feature card -> detail overlay
await pg.click('#fgrid .fcard:nth-child(7)'); await pg.waitForTimeout(500); await pg.screenshot({ path: 'out/jd-2detail.png' })
await pg.keyboard.press('Escape'); await pg.waitForTimeout(300)
await next('3chan')
// click Phone tab
await pg.click('#chantabs .chantab:nth-child(2)'); await pg.waitForTimeout(400); await pg.screenshot({ path: 'out/jd-3chan-phone.png' })
await next('4brain')
await next('5integ')
await next('6sec')
await next('7price')
await next('8cta')
console.log('done')
await b.close()
process.exit(0)
