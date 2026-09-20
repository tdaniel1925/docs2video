// Remake the supper-club ad on PRODUCTION and measure whether it comes back
// framed. Uses the same look and words as the failing one.
import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'fs'

const env = readFileSync('C:/dev/1 - Restylez/.env.local', 'utf8')
const get = (k) => (env.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim().replace(/\r$/, '').replace(/^["']|["']$/g, '')

const LOOK = 'C:/Users/tdani/AppData/Local/Temp/ad-reference.png'   // the supper-club design
const WORDS = [
  'We are open for business',
  '12 noon on saturday the 5th',
  'Be there or be square',
].join('\n')

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } })
p.on('console', (m) => { if (m.type() === 'error') console.log('page error:', m.text().slice(0, 120)) })

await p.goto('https://restylez.app/login', { waitUntil: 'networkidle' })
await p.fill('input[type=email]', get('SUPER_ADMIN_EMAIL'))
await p.fill('input[type=password]', get('SUPER_ADMIN_PASSWORD'))
await p.click('button.au-submit')
await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 })
console.log('signed in')

// Call the maker directly with the same shape the New Design page sends.
const lookDataUrl = 'data:image/png;base64,' + readFileSync(LOOK).toString('base64')
const out = await p.evaluate(async ({ words, lookDataUrl }) => {
  const r = await fetch('/api/create', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: words, sizeId: 'ad-fb-feed', lookDataUrl, owned: true }),
  })
  const d = await r.json().catch(() => ({}))
  return { status: r.status, png: d.png ? d.png.slice(0, 40) + '…' : null, full: d.png || '', checks: d.checks || d.report || null, error: d.error }
}, { words: WORDS, lookDataUrl })

console.log('status', out.status, out.error ? '| ' + out.error : '')
if (out.full) {
  writeFileSync(process.env.TEMP + '/ad-remade.png', Buffer.from(out.full.split(',')[1], 'base64'))
  console.log('saved the new ad')
}
if (out.checks) console.log('checks reported:', JSON.stringify(out.checks).slice(0, 400))
await b.close()
