// Does the mic button ever fail SILENTLY?
//
//   $env:D2V_USER='...'; $env:D2V_PASS='...'; node scripts/check-mic.mjs
//
// It cannot prove dictation works — that needs a real voice and Google's speech
// service, which a headless browser does not have. What it CAN prove is the
// thing that was actually reported: pressing the button did nothing and said
// nothing. After this fix every path must either start listening or show a
// message explaining why not.
import { chromium } from 'playwright'

const EMAIL = process.env.D2V_USER
const PASS = process.env.D2V_PASS
const BASE = process.env.D2V_BASE || 'https://docs2video.com'
if (!EMAIL || !PASS) { console.error('set D2V_USER and D2V_PASS'); process.exit(2) }

const browser = await chromium.launch({
  // Grant the microphone and feed it a fake device, so the run tests OUR code
  // rather than a permission dialog nobody can click.
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
})
const ctx = await browser.newContext({ permissions: ['microphone'], viewport: { width: 1400, height: 1000 } })
const page = await ctx.newPage()

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
  await page.waitForTimeout(4000)

  const supported = await page.evaluate(() =>
    !!(window.SpeechRecognition || window.webkitSpeechRecognition))
  console.log(`  (this browser reports speech support: ${supported})`)

  const mic = page.getByRole('button', { name: /Dictate|Stop listening/ })
  check(await mic.count() > 0, 'the mic button is on the page even when it may not work')

  await mic.click()
  await page.waitForTimeout(4000)
  const after = await page.locator('body').innerText()

  const nowListening = /Listening…|● Stop/.test(after)
  // Read the message OUT OF THE ERROR BAR rather than diffing the page text.
  // An earlier version subtracted the old body from the new one and reported
  // the first line of the leftovers, which was "Dashboard" — a pass with a
  // meaningless explanation is one bad day away from a pass for the wrong
  // reason entirely.
  const shown = (await page.locator('div', { hasText: /microphone|speech recognition|didn't (hear|catch)/i })
    .last().innerText().catch(() => '')) || ''
  const explained = /microphone|speech|didn't (hear|catch)|padlock|browser can/i.test(shown)

  // The whole point: pressing it must do ONE of these, never neither.
  check(nowListening || explained, 'pressing it either starts listening or explains why not',
    nowListening ? 'started listening' : shown.split('\n').find((l) => l.trim())?.slice(0, 120) || 'NOTHING SHOWN')

  await page.screenshot({ path: 'check-mic.png', fullPage: false })
  console.log('  saved check-mic.png')
} catch (e) {
  console.log('FAILED: ' + String(e.message).split('\n')[0])
  bad++
  await page.screenshot({ path: 'check-mic-error.png' }).catch(() => {})
} finally {
  await browser.close()
  console.log(bad ? `\n${bad} problem(s)` : '\nno silent failure')
  process.exit(bad ? 1 : 0)
}
