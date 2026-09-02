import { chromium } from 'playwright'
import { readFileSync } from 'fs'
const env = readFileSync('C:/dev/1 - Restylez/.env.local', 'utf8')
const get = (k) => (env.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim().replace(/\r$/, '').replace(/^["']|["']$/g, '')
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 1000 } })
await p.goto('http://localhost:3005/login'); await p.fill('input[type=email]', get('SUPER_ADMIN_EMAIL')); await p.fill('input[type=password]', get('SUPER_ADMIN_PASSWORD')); await p.click('button.au-submit'); await p.waitForURL((u) => !u.pathname.startsWith('/login'), { waitUntil: 'domcontentloaded', timeout: 90000 })
const r = await p.request.post('http://localhost:3005/api/brand', { data: { url: 'https://jordyn.app' }, timeout: 120000 }); const j = await r.json().catch(() => ({}))
const B = j.brand || {}; console.log('brand →', r.status(), j.error || '', `name=${B.name} colours=${(B.colors || []).join(',')} logo=${B.logo ? 'yes(' + (B.logoGrade || '?') + ')' : 'NO'}`)
await p.goto('http://localhost:3005/pptx', { waitUntil: 'domcontentloaded' }); await p.waitForSelector('input[type=file]', { state: 'attached' })
await p.locator('input[type=file]').first().setInputFiles('C:/dev/1 - Apex Pre-Launch Site/General - Apex Flyer.pptx'); await p.waitForTimeout(1500)
await p.locator('input[type=checkbox]').first().check()
await p.click('button:has-text("Just open the text")'); await p.waitForTimeout(5000)
console.log('pptx boxes after Just open:', await p.locator('input.rz-input').count(), '| sample:', (await p.locator('body').innerText()).replace(/\s+/g, ' ').match(/(boxes|slide|text)[^.]{0,120}/i)?.[0])
await b.close()
