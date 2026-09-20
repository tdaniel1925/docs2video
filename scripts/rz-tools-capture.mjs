// Capture the real Restylez tool flows for the explainer videos.
//   node scripts/rz-tools-capture.mjs <sizes|deck|pptx|edit|library|all>
// Full-page PNGs + boxes.json (page coords + page heights) → remotion/public/showcase/rz<tool>/
// Uses ONE persistent browser profile so the library accumulates across tools.
import { chromium } from 'playwright'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
const RZ = 'C:/dev/1 - Restylez'
const env = readFileSync(RZ + '/.env.local', 'utf8')
const get = (k) => (env.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim().replace(/\r$/, '').replace(/^["']|["']$/g, '')
const ROOT = 'C:/dev/1 - PrismGraphs/remotion/public/showcase/'
const FLYER = 'C:/dev/1 - PrismGraphs/public/flyer-templates/fitness-spin-night.png'
const LOOK = 'C:/dev/1 - PrismGraphs/remotion/public/restylez/reference-2.png'
const PPTX = 'C:/dev/1 - PrismGraphs/refs/sample-healthcare.pptx'
const PROFILE = process.env.TEMP + '/rz-profile'
const which = process.argv[2] || 'all'

const ctx = process.env.RZ_FRESH ? await (await chromium.launch()).newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 }) : await chromium.launchPersistentContext(PROFILE, { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
const p = ctx.pages()[0] || await ctx.newPage()
let OUT = '', boxes = {}
const hide = async () => { await p.addStyleTag({ content: 'nextjs-portal, [data-nextjs-toast], a[href="/admin"] { display: none !important }' }).catch(() => {}) }
const box = async (name, loc) => { const b = await loc.boundingBox().catch(() => null); const sy = await p.evaluate(() => window.scrollY); if (b) boxes[name] = { x: Math.round(b.x), y: Math.round(b.y + sy), w: Math.round(b.width), h: Math.round(b.height) }; return b }
const shot = async (name) => { await hide(); await p.screenshot({ path: OUT + name + '.png', fullPage: true }); boxes['page_' + name] = await p.evaluate(() => document.documentElement.scrollHeight); console.log(' shot', name) }
const start = (id) => { OUT = ROOT + id + '/'; mkdirSync(OUT, { recursive: true }); boxes = {}; console.log('==', id) }
const finish = () => writeFileSync(OUT + 'boxes.json', JSON.stringify(boxes, null, 2))
const login = async () => {
  await p.goto('http://localhost:3005/login', { waitUntil: 'networkidle' })
  if (p.url().includes('/login')) { await p.fill('input[type=email]', get('SUPER_ADMIN_EMAIL')); await p.fill('input[type=password]', get('SUPER_ADMIN_PASSWORD')); await p.click('button.au-submit'); await p.waitForURL((u) => !u.pathname.startsWith('/login')) }
}
const go = async (path) => { await p.goto('http://localhost:3005' + path, { waitUntil: 'networkidle' }); await p.waitForTimeout(1200) }
const hasText = (t, timeout = 600000) => p.waitForFunction((t) => document.body.innerText.includes(t), t, { timeout })
const own = async () => { const cb = p.locator('input[type=checkbox]').first(); await box('ownit', cb); await cb.check(); await p.waitForTimeout(300) }

// a remake in this profile so the library has a design (needed by edit + library)
const remake = async () => {
  await go('/make'); await p.locator('input[type=file]').first().setInputFiles(FLYER); await p.waitForTimeout(1200)
  await p.locator('textarea').first().fill('Change STRONGER to UNSTOPPABLE. Change "STARTS 6 JANUARY" to "STARTS 6 OCTOBER". Change IRONWORKS GYM to FORGE FITNESS.')
  await p.locator('input[type=checkbox]').first().check(); await p.click('button:has-text("Remake it")')
  await p.waitForSelector('img[alt="Remade"]', { timeout: 300000 }); await p.waitForTimeout(1500)
}

await login()

if (which === 'edit' || which === 'all') {
  start('rzedit')
  await go('/library'); if (!(await p.locator('a[title="Open in the editor"]').count())) { await remake(); await go('/library') }
 const ed = p.locator('a[title="Open in the editor"]').first(); await box('edit', ed); await shot('1-library')
  await ed.click(); await p.waitForURL((u) => u.pathname.startsWith('/edit')); await p.waitForTimeout(1500); await shot('2-editor')
  const ta = p.locator('textarea').first(); await box('textarea', ta)
  await ta.fill('Make the headline bigger and change 6AM DAILY to 5:30AM DAILY.'); await p.waitForTimeout(300)
  const fix = p.locator('button:has-text("Fix it")').first(); await box('fix', fix); await shot('3-typed')
  await fix.click(); await p.waitForTimeout(1500); await shot('4-working')
  await hasText('fix round', 400000); await p.waitForTimeout(1500)
  await box('result', p.locator('img[alt="Your design"]').first()); await shot('5-result')
  await p.locator('button[title="Fresh from the maker"]').first().click().catch(() => {}); await p.waitForTimeout(500)
  await box('keep', p.locator('button:has-text("Keep this version")').first()); await shot('6-versions'); finish()
}

if (which === 'sizes' || which === 'all') {
  start('rzsizes')
  await go('/sizes'); await shot('1-empty')
  const lib = p.locator('button[title]').first()
  if (await lib.count()) { await box('picked', lib); await lib.click() } else { await p.locator('input[type=file]').first().setInputFiles(FLYER) }
  await p.waitForTimeout(1500); if (!boxes.picked) await box('picked', p.locator('img').first()); await shot('2-picked')
  const kit = p.locator('button:has-text("Print kit")').first(); await box('printkit', kit); await kit.click(); await p.waitForTimeout(500)
  const mk = p.locator('button:has-text("Make")').first(); await box('make', mk); await shot('3-kit')
  await mk.click(); await p.waitForTimeout(2000); await shot('4-working')
  await hasText('Making ', 30000).catch(() => {}); await p.waitForFunction(() => !/Making /.test(document.body.innerText), null, { timeout: 900000 }); await p.waitForTimeout(2000)
  await box('results', p.locator('text=Your sizes').first()); await shot('5-result'); finish()
}

if (which === 'pptx' || which === 'all') {
  start('rzpptx')
  await go('/powerpoint'); const choose = p.locator('text=Edit a finished deck').first(); await box('editfinished', choose); await shot('1-choose')
  await choose.click(); await p.waitForURL((u) => u.pathname.startsWith('/pptx')); await p.waitForTimeout(1200); await shot('2-empty')
  await p.locator('input[type=file]').first().setInputFiles(PPTX); await p.waitForTimeout(3000); await shot('3-read')
  const ta = p.locator('textarea').first(); await box('textarea', ta); await ta.fill('Change the client name to Harbor Life Group and every date to October 2026.'); await own()
  const apply = p.locator('button:has-text("Open + apply my changes")').first(); await box('apply', apply); await shot('4-typed')
  await apply.click(); await p.waitForFunction(() => /Download my PowerPoint|couldn’t|Could not|Tick “this/.test(document.body.innerText), null, { timeout: 600000 }); await p.waitForTimeout(1500)
  if (!/Download my PowerPoint/.test(await p.evaluate(() => document.body.innerText))) { console.log('PPTX ERROR:', (await p.evaluate(() => document.body.innerText)).match(/.*(couldn’t|Could not|Tick “this).*/)?.[0]); await shot('err'); finish(); throw new Error('pptx apply failed') }
  await box('download', p.locator('text=Download my PowerPoint').first()); await shot('5-result'); finish()
}

if (which === 'deck' || which === 'all') {
  start('rzdeck')
  await go('/deck'); await shot('1-empty')
  const ta = p.locator('textarea').first(); await box('textarea', ta)
  await ta.fill('A 6-slide pitch for Forge Fitness: a six-week strength program. Cover, the problem, the program, coaches, results (3,105 members, 96% finished), and how to join.'); await p.waitForTimeout(300)
  const plan = p.locator('button:has-text("Build the plan")').first(); await box('plan', plan); await shot('2-typed')
  await plan.click(); await hasText('Build the deck', 300000); await p.waitForTimeout(1200)
  const build = p.locator('button:has-text("Build the deck")').first(); await box('build', build); await shot('3-plan')
  await p.locator('input[type=file][accept="image/*"]').first().setInputFiles(LOOK); await p.waitForTimeout(1800)
  const lookImg = p.locator('img[alt="The look to copy"], img[alt="Look"]').first(); if (await lookImg.count()) await box('look', lookImg); else await box('look', build)
  await own(); await shot('4-look')
  if (process.env.RZ_DECK_NOBUILD) { boxes['page_5-working'] = boxes['page_4-look']; boxes['page_6-result'] = 1085; boxes.deck = { x: 582, y: 330, w: 1000, h: 60 }; finish(); await ctx.close(); console.log('captures done (no build)'); process.exit(0) }
  await build.click(); await p.waitForTimeout(2500); await shot('5-working')
  await p.waitForFunction(() => /Your deck — d+ slide/.test(document.body.innerText), null, { timeout: 900000 }); await p.waitForTimeout(20000)
  await box('deck', p.locator('text=/Your deck — \d+ slide/').first()); await shot('6-result'); finish()
}

if (which === 'library' || which === 'all') {
  start('rzlibrary')
  await go('/library'); await box('firstrow', p.locator('a[title="Open in the editor"]').first()); await shot('1-list')
  const grid = p.locator('button[title*="rid"], button:has-text("Grid")').first(); if (await grid.count()) { await grid.click(); await p.waitForTimeout(600); await shot('2-grid'); await p.locator('button[title*="ist"], button:has-text("List")').first().click().catch(() => {}) }
  await p.locator('a[title="Open in the editor"]').first().hover(); await p.waitForTimeout(400); await shot('3-hover')
  await go('/account'); await box('add50', p.locator('button:has-text("$50")').first()); await box('balance', p.locator('text=Balance').first()); await box('costs', p.locator('text=What things cost').first()); await box('history', p.locator('text=History').first()); await shot('4-account'); finish()
}
await ctx.close(); console.log('captures done')
