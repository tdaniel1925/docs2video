// Link/button crawl: public pages logged-out, app + admin logged-in. Reports 4xx/5xx, console errors, dead buttons.
import { chromium } from 'playwright'
import { readFileSync } from 'fs'
const env = readFileSync('C:/dev/1 - Restylez/.env.local', 'utf8')
const get = (k) => (env.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim().replace(/\r$/, '').replace(/^["']|["']$/g, '')
const BASE = 'http://localhost:3005'
const b = await chromium.launch()
const report = []
async function crawl(page, urls, label) {
  const seen = new Set()
  for (const u of urls) {
    const errs = []; const bad = []
    const onErr = (e) => errs.push(e.message.slice(0, 120)); const onResp = (r) => { if (r.status() >= 400 && !r.url().includes('/_next/')) bad.push(r.status() + ' ' + r.url().replace(BASE, '')) }
    page.on('pageerror', onErr); page.on('response', onResp)
    const r = await page.goto(BASE + u, { waitUntil: 'networkidle' }).catch((e) => ({ status: () => 'ERR ' + e.message.slice(0, 60) }))
    const status = r.status(); const final = page.url().replace(BASE, '')
    const links = await page.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')).filter((h) => h && h.startsWith('/') && !h.startsWith('//')))
    const buttons = await page.evaluate(() => [...document.querySelectorAll('button')].map((x) => (x.textContent || x.getAttribute('aria-label') || '').trim().slice(0, 40)).filter(Boolean))
    // probe each internal link with a HEAD-ish GET
    const dead = []
    for (const l of new Set(links.map((l) => l.split('#')[0]).filter(Boolean))) { if (seen.has(l)) continue; seen.add(l); const rr = await page.request.get(BASE + l, { maxRedirects: 0 }).catch(() => null); const st = rr ? rr.status() : 'ERR'; if (st === 404 || st >= 500 || st === 'ERR') dead.push(st + ' ' + l) }
    report.push(`${label} ${u} → ${status} ${final !== u ? '(landed ' + final + ')' : ''} | ${links.length} links, ${buttons.length} buttons${dead.length ? ' | DEAD: ' + dead.join(', ') : ''}${bad.length ? ' | BAD RESPONSES: ' + [...new Set(bad)].join(', ') : ''}${errs.length ? ' | JS ERRORS: ' + errs.join(' ; ') : ''}`)
    page.off('pageerror', onErr); page.off('response', onResp)
  }
}
// 1. logged out
const anon = await b.newPage()
await crawl(anon, ['/', '/welcome', '/examples', '/vs', '/vs/canva', '/vs/claude-design', '/vs/chatgpt', '/vs/photoshop', '/vs/higgsfield', '/about', '/terms', '/privacy', '/copyright', '/login', '/signup', '/', '/deck', '/sizes', '/admin', '/sitemap.xml', '/robots.txt'], 'ANON')
const api = await anon.request.post(BASE + '/api/remake', { data: { imageDataUrl: 'x', owned: true, changes: 'y' } }); report.push(`ANON POST /api/remake → ${api.status()} (must be 401)`)
await anon.close()
// 2. logged in
const p = await b.newPage()
await p.goto(BASE + '/login'); await p.fill('input[type=email]', get('SUPER_ADMIN_EMAIL')); await p.fill('input[type=password]', get('SUPER_ADMIN_PASSWORD')); await p.click('button.au-submit'); await p.waitForURL((u) => !u.pathname.startsWith('/login'))
await crawl(p, ['/make', '/deck', '/powerpoint', '/pptx', '/pack', '/sizes', '/brands', '/library', '/account', '/admin', '/admin/customers', '/admin/jobs', '/admin/money', '/admin/settings', '/admin/health', '/admin/audit'], 'USER')
await b.close()
console.log(report.join('\n'))
