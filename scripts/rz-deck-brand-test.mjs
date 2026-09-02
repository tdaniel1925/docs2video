import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'fs'
import sharp from 'sharp'
const S = 'C:/Users/tdani/AppData/Local/Temp/claude/C--dev-1---PrismGraphs/b49a578b-8a92-4baa-9740-01972f39bb4f/scratchpad/'
const env = readFileSync('C:/dev/1 - Restylez/.env.local', 'utf8')
const get = (k) => (env.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim().replace(/\r$/, '').replace(/^["']|["']$/g, '')
const BASE = 'http://localhost:3005'
const b = await chromium.launch(); const p = await b.newPage()
await p.goto(BASE + '/login'); await p.fill('input[type=email]', get('SUPER_ADMIN_EMAIL')); await p.fill('input[type=password]', get('SUPER_ADMIN_PASSWORD')); await p.click('button.au-submit'); await p.waitForURL((u) => !u.pathname.startsWith('/login'), { waitUntil: 'domcontentloaded', timeout: 90000 })
const J = async (path, data) => { const r = await p.request.post(BASE + path, { data, timeout: 300000 }); const j = await r.json().catch(() => ({})); return { s: r.status(), j } }
// BRAND scrape
const br = await J('/api/brand', { site: 'https://jordyn.app' }); console.log('brand →', br.s, br.j.error || `name=${br.j.name} colours=${(br.j.colors || []).join(',')} logo=${br.j.logo ? 'yes (' + br.j.logoGrade + ')' : 'NO'}`)
// OUTLINE from a topic with money
const o = await J('/api/outline', { topic: 'Forge Fitness investor update. Members: 1,240 in Q1, 1,910 in Q2, 2,480 in Q3, 3,105 in Q4. Revenue $412,500.75 this year, up 38%. Plan: open a second gym in March.', owned: true })
console.log('outline →', o.s, o.j.error || o.j.slides.map((s) => `${s.layout}${s.chart ? '(chart:' + s.chart.kind + ')' : ''}`).join(','))
const chart = o.j.slides?.find((s) => s.chart); if (chart) console.log('chart points:', JSON.stringify(chart.chart.points).slice(0, 160), 'unit:', chart.chart.unit)
const look = 'data:image/png;base64,' + (await sharp('C:/dev/1 - PrismGraphs/public/flyer-templates/fitness-spin-night.png').resize(1200, 1200, { fit: 'inside' }).png().toBuffer()).toString('base64')
const logo = 'data:image/png;base64,' + readFileSync('C:/dev/1 - Restylez/public/examples/jordyn-logo.png').toString('base64')
const pick = [o.j.slides[0], chart || o.j.slides[1]]
for (let i = 0; i < pick.length; i++) { const r = await J('/api/slide', { lookDataUrl: look, slide: pick[i], index: i, total: pick.length, owned: true, logoDataUrl: logo }); console.log('slide', i + 1, '→', r.s, r.j.error || r.j.layout); if (r.j.png) writeFileSync(S + `deck-test-${i + 1}.png`, Buffer.from(r.j.png.split(',')[1], 'base64')) }
await b.close()
