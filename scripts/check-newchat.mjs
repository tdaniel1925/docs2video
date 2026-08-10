// Does "New chat" actually give you a new chat?
//
//   $env:D2V_USER='...'; $env:D2V_PASS='...'; node scripts/check-newchat.mjs
//
// The reported bug: pressing New chat dropped you back at the bottom of the
// conversation you were already in. The server was asked for a chat that had
// nothing saved under it yet, and answered with the most recent one instead.
import { chromium } from 'playwright'

const EMAIL = process.env.D2V_USER
const PASS = process.env.D2V_PASS
const BASE = process.env.D2V_BASE || 'https://docs2video.com'
if (!EMAIL || !PASS) { console.error('set D2V_USER and D2V_PASS'); process.exit(2) }

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } })

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

  const designsBefore = await page.locator('figure img').count()
  const bodyBefore = await page.locator('body').innerText()
  check(designsBefore > 0, 'started in a chat that has designs in it', `${designsBefore} on screen`)

  await page.getByRole('button', { name: '+ New chat' }).click()
  // Long enough that a stray fetch would have landed and repopulated the page.
  await page.waitForTimeout(6000)

  const designsAfter = await page.locator('figure img').count()
  const bodyAfter = await page.locator('body').innerText()

  check(designsAfter === 0, 'the new chat is EMPTY', `${designsAfter} design(s) still showing`)
  check(/New job\. Tell me what this one is for/i.test(bodyAfter), 'it greets you as a fresh job')
  check(!/Picking up where you left off/i.test(bodyAfter), 'it does not restore the previous conversation')
  check(!/What goes on the design/i.test(bodyAfter), 'the previous brief is cleared')
  check(bodyAfter !== bodyBefore, 'the page actually changed')

  await page.screenshot({ path: 'check-newchat.png', fullPage: false })
  console.log('  saved check-newchat.png')
} catch (e) {
  console.log('FAILED: ' + String(e.message).split('\n')[0])
  bad++
  await page.screenshot({ path: 'check-newchat-error.png' }).catch(() => {})
} finally {
  await browser.close()
  console.log(bad ? `\n${bad} problem(s)` : '\nNew chat gives you a new chat')
  process.exit(bad ? 1 : 0)
}
