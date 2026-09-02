import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'fs'
import JSZip from 'jszip'
const S = 'C:/Users/tdani/AppData/Local/Temp/claude/C--dev-1---PrismGraphs/b49a578b-8a92-4baa-9740-01972f39bb4f/scratchpad/'
const env = readFileSync('C:/dev/1 - Restylez/.env.local', 'utf8')
const get = (k) => (env.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim().replace(/\r$/, '').replace(/^["']|["']$/g, '')
const BASE = 'http://localhost:3005'
const PPTX = 'C:/dev/1 - Apex Pre-Launch Site/General - Apex Flyer.pptx'
const PACK = 'C:/dev/1 - Apex Pre-Launch Site/videos-ai/Apex Affinity Group - Licensed Insurance Compensation Plan.pptx'
const b = await chromium.launch(); const ctx = await b.newContext({ acceptDownloads: true }); const p = await ctx.newPage({ viewport: { width: 1440, height: 1000 } })
const errs = []; p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))
await p.goto(BASE + '/login'); await p.fill('input[type=email]', get('SUPER_ADMIN_EMAIL')); await p.fill('input[type=password]', get('SUPER_ADMIN_PASSWORD')); await p.click('button.au-submit'); await p.waitForURL((u) => !u.pathname.startsWith('/login'), { waitUntil: 'domcontentloaded', timeout: 90000 })
const textOf = async (buf) => { const z = await JSZip.loadAsync(buf); let t = ''; for (const f of Object.keys(z.files).filter((n) => /ppt\/slides\/slide\d+\.xml$/.test(n))) t += await z.file(f).async('string'); return t.replace(/<[^>]+>/g, ' ') }
// --- PPTX EDITOR
try {
  await p.goto(BASE + '/pptx', { waitUntil: 'networkidle' })
  await p.locator('input[type=file]').first().setInputFiles(PPTX); await p.waitForTimeout(1200)
  await p.locator('input[type=checkbox]').first().check()
  await p.locator('textarea').first().fill('Change every phone number to (555) 010-2030 and change the year 2025 to 2026 wherever it appears.')
  await p.click('button:has-text("Open + apply my changes")'); await p.waitForSelector('button:has-text("Download my PowerPoint")', { timeout: 180000 })
  const changed = await p.locator('input.rz-input').count(); console.log('pptx: edit boxes shown:', changed)
  const dlBtn = p.locator('button:has-text("Download my PowerPoint")'); console.log('pptx: download enabled:', !(await dlBtn.isDisabled()))
  if (!(await dlBtn.isDisabled())) { const [dl] = await Promise.all([p.waitForEvent('download'), dlBtn.click()]); const path = S + 'pptx-out.pptx'; await dl.saveAs(path); const t = await textOf(readFileSync(path)); console.log('pptx: output has 555 number:', t.includes('555') , '| has 2026:', t.includes('2026'), '| still has 2025:', t.includes('2025')) }
} catch (e) { console.log('PPTX FAIL:', e.message.slice(0, 200)) }
// --- TEMPLATE PACK
try {
  await p.goto(BASE + '/pack', { waitUntil: 'networkidle' })
  await p.locator('input[type=file]').first().setInputFiles(PACK); await p.waitForTimeout(3000)
  await p.locator('input[type=checkbox]').first().check()
  await p.click('button:has-text("Read the pack")'); await p.waitForSelector('textarea', { timeout: 300000 })
  await p.locator('textarea').first().fill('A 6-slide pitch for Forge Fitness: the problem (crowded gyms), our solution (small-group coaching), results (38% growth, 3,105 members), pricing, and a call to action.')
  await p.click('button:has-text("Pick the best layouts")'); await p.waitForSelector('button:has-text("Build my PowerPoint")', { timeout: 300000 })
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 300000 }), p.click('button:has-text("Build my PowerPoint")')]); const path = S + 'pack-out.pptx'; await dl.saveAs(path)
  const z = await JSZip.loadAsync(readFileSync(path)); const n = Object.keys(z.files).filter((f) => /ppt\/slides\/slide\d+\.xml$/.test(f)).length; const t = await textOf(readFileSync(path)); console.log('pack: slides in output:', n, '| mentions Forge:', t.includes('Forge'))
} catch (e) { console.log('PACK FAIL:', e.message.slice(0, 200)) }
// --- SIZES PAGE
try {
  await p.goto(BASE + '/sizes', { waitUntil: 'networkidle' })
  await p.locator('input[type=file]').first().setInputFiles('C:/dev/1 - Restylez/public/examples/club-before.jpg'); await p.waitForTimeout(800)
  await p.click('button:has-text("Business card")'); await p.locator('input[type=checkbox]').last().check()
  await p.click('button:has-text("Make 1 size")'); await p.waitForSelector('button:has-text("PDF")', { timeout: 300000 })
  const png = await p.getAttribute('img[alt="Business card 3.5×2\\""]', 'src').catch(() => null); if (png) writeFileSync(S + 'sizes-card.png', Buffer.from(png.split(',')[1], 'base64'))
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.click('button:has-text("PDF")')]); console.log('sizes: pdf download name:', dl.suggestedFilename())
  await p.goto(BASE + '/library', { waitUntil: 'networkidle' }); await p.waitForTimeout(1200); console.log('library: cards with Sizes button:', await p.locator('a[href^="/sizes?design="]').count())
} catch (e) { console.log('SIZES FAIL:', e.message.slice(0, 200)) }
console.log('page errors:', errs); await b.close()
