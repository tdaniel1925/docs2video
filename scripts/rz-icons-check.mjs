/**
 * Are any two sidebar tools showing the same icon?
 *
 * A first version read the inline `svg *` shapes and reported nine duplicates
 * — but these icons are IMAGES, so that selector matched nothing and every
 * item looked identical. Comparing the rendered pixels is the honest check.
 */
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const env = Object.fromEntries(readFileSync('C:/dev/1 - Restylez/.env.local','utf8').split(/\r?\n/).map(l=>l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)).filter(Boolean).map(m=>[m[1],m[2].replace(/^["']|["']$/g,'')]))
const b = await chromium.launch(); const p = await b.newPage()
await p.goto('http://localhost:3005/login', { waitUntil: 'networkidle' })
await p.fill('input[type="email"]', env.SUPER_ADMIN_EMAIL)
await p.fill('input[type="password"]', env.SUPER_ADMIN_PASSWORD)
await p.getByRole('button', { name: /sign in/i }).click()
for (let i = 0; i < 60 && new URL(p.url()).pathname.startsWith('/login'); i++) await p.waitForTimeout(250)
await p.goto('http://localhost:3005/make', { waitUntil: 'networkidle' })
await p.waitForTimeout(600)

const links = await p.$$('.rz-nav a')
const seen = new Map()
let dupes = 0
for (const a of links) {
  const label = (await a.textContent()).trim()
  const icon = await a.$('svg, img')
  if (!icon) { console.log(`  no icon at all: "${label}"`); dupes++; continue }
  const shot = await icon.screenshot()
  const key = createHash('sha1').update(shot).digest('hex')
  if (seen.has(key)) { console.log(`  DUPLICATE: "${label}" is pixel-identical to "${seen.get(key)}"`); dupes++ }
  else seen.set(key, label)
}
console.log(dupes ? `\n${dupes} problem(s)` : `\nall ${links.length} sidebar icons are distinct`)
await b.close()
