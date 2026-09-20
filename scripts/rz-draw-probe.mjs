/**
 * WHY DID ALL THREE DIRECTIONS FAIL?
 *
 * The job log shows the shortlist ran and then nothing — no drawing was even
 * attempted. So the request is failing before it reaches the model, and the
 * card only says "this one didn't come through". This signs in for real and
 * prints the actual status and body of the draw call.
 */
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(readFileSync('C:/dev/1 - Restylez/.env.local','utf8').split(/\r?\n/).map(l=>l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)).filter(Boolean).map(m=>[m[1],m[2].replace(/^["']|["']$/g,'')]))
const b = await chromium.launch()
const p = await b.newPage()
p.setDefaultTimeout(300_000)

// Every failing API answer, in full.
p.on('response', async (r) => {
  if (!r.url().includes('/api/logo')) return
  if (r.ok()) { console.log(`  ${r.status()} ok`); return }
  const body = await r.text().catch(() => '')
  console.log(`  ${r.status()} FAILED — ${body.slice(0, 300)}`)
})
p.on('console', (m) => { if (m.type() === 'error') console.log('  [browser]', m.text().slice(0, 200)) })

await p.goto('http://localhost:3005/login', { waitUntil: 'networkidle' })
await p.fill('input[type="email"]', env.SUPER_ADMIN_EMAIL)
await p.fill('input[type="password"]', env.SUPER_ADMIN_PASSWORD)
await p.getByRole('button', { name: /sign in/i }).click()
for (let i = 0; i < 80 && new URL(p.url()).pathname.startsWith('/login'); i++) await p.waitForTimeout(250)

await p.goto('http://localhost:3005/logo', { waitUntil: 'networkidle' })
const fresh = p.locator('button:has-text("Start a new project")')
if (await fresh.count()) { await fresh.first().click(); await p.waitForTimeout(500) }

await p.fill('input[placeholder*="Ridgeline" i]', 'BotMakers')
await p.fill('input[placeholder*="coffee roaster" i], textarea[placeholder*="coffee roaster" i]', 'AI powered software and web solutions')
console.log('\nstarting…')
await p.getByRole('button', { name: /Start Logo Studio/i }).click()
await p.waitForSelector('#picking', { timeout: 120_000 })

console.log('\ntaking one and drawing it…')
await p.locator('[data-pick]').first().click()
await p.locator('button[data-action="draw"]').click()
await p.waitForSelector('#directions', { timeout: 60_000 })

// Wait for it to land or give up, then say which.
for (let i = 0; i < 120; i++) {
  const done = await p.locator('.rz-logo-card img').count()
  const dead = await p.locator('.rz-logo-card').filter({ hasText: /didn.t come through/i }).count()
  if (done || dead) { console.log(`\nresult: ${done ? 'DREW IT' : 'failed'}`); break }
  await p.waitForTimeout(2000)
}
await p.screenshot({ path: 'C:/Users/tdani/AppData/Local/Temp/claude/C--dev-1---PrismGraphs/b49a578b-8a92-4baa-9740-01972f39bb4f/scratchpad/draw-probe.png', fullPage: true })
await b.close()
