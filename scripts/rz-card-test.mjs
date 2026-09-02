import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'fs'
import sharp from 'sharp'
const S = 'C:/Users/tdani/AppData/Local/Temp/claude/C--dev-1---PrismGraphs/b49a578b-8a92-4baa-9740-01972f39bb4f/scratchpad/'
const env = readFileSync('C:/dev/1 - Restylez/.env.local', 'utf8')
const get = (k) => (env.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim().replace(/\r$/, '').replace(/^["']|["']$/g, '')
const b = await chromium.launch(); const p = await b.newPage()
await p.goto('http://localhost:3005/login'); await p.fill('input[type=email]', get('SUPER_ADMIN_EMAIL')); await p.fill('input[type=password]', get('SUPER_ADMIN_PASSWORD')); await p.click('button.au-submit'); await p.waitForURL((u) => !u.pathname.startsWith('/login'), { waitUntil: 'domcontentloaded', timeout: 90000 })
const src = 'data:image/png;base64,' + (await sharp('C:/dev/1 - Restylez/public/examples/club-before.jpg').resize(1400, 1400, { fit: 'inside' }).png().toBuffer()).toString('base64')
const r = await p.request.post('http://localhost:3005/api/remake', { data: { imageDataUrl: src, owned: true, resize: { sizeId: 'biz-card' }, changes: 'Business card: keep the name/logo, the headline and one contact line (site or phone). Drop body text and small print.' }, timeout: 300000 })
const j = await r.json(); console.log('biz-card →', r.status(), j.error || `${j.w}x${j.h}`); if (j.png) writeFileSync(S + 'card-test.png', Buffer.from(j.png.split(',')[1], 'base64'))
await b.close()
