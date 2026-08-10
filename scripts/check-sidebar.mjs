// Does the chat sidebar stay put, and stay VISIBLE, when you scroll?
//
//   $env:D2V_USER='...'; $env:D2V_PASS='...'; node scripts/check-sidebar.mjs
//
// Sticking is not enough on its own: the site header is pinned to the top of
// the window, so a sidebar that sticks too high slides underneath it and loses
// the top of the New chat button. This measures real positions rather than
// trusting that `position: sticky` is present.
import { chromium } from 'playwright'

const EMAIL = process.env.D2V_USER
const PASS = process.env.D2V_PASS
const BASE = process.env.D2V_BASE || 'https://docs2video.com'
if (!EMAIL || !PASS) { console.error('set D2V_USER and D2V_PASS'); process.exit(2) }

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1400, height: 800 } })

let bad = 0
const check = (ok, label, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`)
  if (!ok) bad++
}

try {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[name="email"]', EMAIL)
  await page.fill('input[name="password"]', PASS)
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 45000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ])
  await page.waitForTimeout(2500)
  if (page.url().includes('/login')) throw new Error('login failed')

  await page.goto(`${BASE}/flyer`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(5000)

  const btn = page.getByRole('button', { name: '+ New chat' })
  const headerBottom = await page.evaluate(() => {
    const h = document.querySelector('.app-header')
    return h ? Math.round(h.getBoundingClientRect().bottom) : 0
  })
  console.log(`  (the pinned header ends ${headerBottom}px down the window)`)

  const before = await btn.boundingBox()
  await page.evaluate(() => window.scrollBy(0, 900))
  await page.waitForTimeout(1200)
  const after = await btn.boundingBox()

  if (!before || !after) throw new Error('could not find the New chat button')

  // It should hold its place on screen rather than scrolling away with the page.
  check(Math.abs(after.y - before.y) < 200, 'the sidebar stays put when you scroll',
    `top was ${Math.round(before.y)}px, now ${Math.round(after.y)}px`)

  // And it must sit BELOW the header, not behind it.
  check(after.y >= headerBottom - 1, 'it is not hidden under the site header',
    `button top ${Math.round(after.y)}px vs header bottom ${headerBottom}px`)

  // Weak on its own — isVisible() is true even for an element completely
  // covered by something else, which is exactly the failure here. The header
  // check above is the one that actually catches it; this only spots the
  // button disappearing altogether.
  check(await btn.isVisible(), 'New chat is still rendered after scrolling')

  await page.screenshot({ path: 'check-sidebar.png' })
  console.log('  saved check-sidebar.png')
} catch (e) {
  console.log('FAILED: ' + String(e.message).split('\n')[0])
  bad++
  await page.screenshot({ path: 'check-sidebar-error.png' }).catch(() => {})
} finally {
  await browser.close()
  console.log(bad ? `\n${bad} problem(s)` : '\nthe sidebar holds its place')
  process.exit(bad ? 1 : 0)
}
