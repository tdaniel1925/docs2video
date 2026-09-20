// Take the fixed wide ad into a TALL size — the worst case for cropping —
// and check the framing verdict on the result.
import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'fs'

const env = readFileSync('C:/dev/1 - Restylez/.env.local', 'utf8')
const get = (k) => (env.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim().replace(/\r$/, '').replace(/^["']|["']$/g, '')

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } })
await p.goto('https://restylez.app/login', { waitUntil: 'networkidle' })
await p.fill('input[type=email]', get('SUPER_ADMIN_EMAIL'))
await p.fill('input[type=password]', get('SUPER_ADMIN_PASSWORD'))
await p.click('button.au-submit')
await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 })
console.log('signed in')

const wideAd = 'data:image/png;base64,' + readFileSync(process.env.TEMP + '/ad-remade.png').toString('base64')

// 1200x628 wide → Instagram story 1080x1920 (very tall). Nothing may be cut.
const out = await p.evaluate(async (imageDataUrl) => {
  const r = await fetch('/api/remake', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ imageDataUrl, owned: true, resize: { sizeId: 'ig-story', bleed: false } }),
  })
  const d = await r.json().catch(() => ({}))
  return { status: r.status, full: d.png || '', checks: d.checks || d.report || null, error: d.error }
}, wideAd)

console.log('status', out.status, out.error ? '| ' + out.error : '')
if (out.full) {
  writeFileSync(process.env.TEMP + '/size-story.png', Buffer.from(out.full.split(',')[1], 'base64'))
  console.log('saved the story size')
}
if (out.checks?.framing) console.log('framing:', JSON.stringify(out.checks.framing))
await b.close()
