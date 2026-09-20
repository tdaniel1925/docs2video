/** What actually happens when sign-in is clicked. */
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('C:/dev/1 - Restylez/.env.local', 'utf8')
    .split(/\r?\n/).map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/))
    .filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')]),
)

const browser = await chromium.launch()
const page = await browser.newPage()
page.on('console', (m) => console.log(`  [${m.type()}]`, m.text().slice(0, 160)))
page.on('response', (r) => { if (r.url().includes('/api/') && r.request().method() === 'POST') console.log(`  POST ${new URL(r.url()).pathname} → ${r.status()}`) })

await page.goto('http://localhost:3005/login', { waitUntil: 'networkidle' })
await page.fill('input[type="email"]', env.SUPER_ADMIN_EMAIL)
await page.fill('input[type="password"]', env.SUPER_ADMIN_PASSWORD)
await page.getByRole('button', { name: /sign in/i }).click()
await page.waitForTimeout(6000)

console.log('\nurl now:', page.url())
// Any message shown to the user, without dumping the whole page.
const msgs = await page.evaluate(() =>
  Array.from(document.querySelectorAll('p, span, div'))
    .map((el) => (el.childElementCount === 0 ? el.textContent?.trim() : ''))
    .filter((s) => s && s.length > 8 && s.length < 160 && /wrong|invalid|error|incorrect|not|try|check/i.test(s))
    .slice(0, 5))
console.log('messages on screen:', msgs.length ? msgs : '(none)')
await browser.close()
