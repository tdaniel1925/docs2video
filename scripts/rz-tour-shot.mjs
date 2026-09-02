import { chromium } from 'playwright'
const S = 'C:/Users/tdani/AppData/Local/Temp/claude/C--dev-1---PrismGraphs/b49a578b-8a92-4baa-9740-01972f39bb4f/scratchpad/'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
await p.goto('http://localhost:3005/welcome', { waitUntil: 'networkidle' }); await p.waitForTimeout(600)
console.log('inline video visible on desktop:', await p.isVisible('.mk-video-mobile'))
await p.click('.mk-play'); await p.waitForTimeout(900)
await p.screenshot({ path: S + 'tour-modal.jpg', type: 'jpeg', quality: 60 })
await p.keyboard.press('Escape'); await p.waitForTimeout(300); console.log('modal closed on Esc:', !(await p.isVisible('.mk-modal')))
const m = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true }); await m.goto('http://localhost:3005/welcome', { waitUntil: 'networkidle' })
console.log('inline video visible on phone:', await m.isVisible('.mk-video-mobile'))
await m.evaluate(() => document.querySelector('#video').scrollIntoView()); await m.waitForTimeout(800)
await m.screenshot({ path: S + 'tour-mobile.jpg', type: 'jpeg', quality: 60 }); await b.close()
