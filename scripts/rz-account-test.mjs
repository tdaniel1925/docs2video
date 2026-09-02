import { chromium } from 'playwright'
import { readFileSync } from 'fs'
const S = 'C:/Users/tdani/AppData/Local/Temp/claude/C--dev-1---PrismGraphs/b49a578b-8a92-4baa-9740-01972f39bb4f/scratchpad/'
const env = readFileSync('C:/dev/1 - Restylez/.env.local', 'utf8')
const get = (k) => (env.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim().replace(/\r$/, '').replace(/^["']|["']$/g, '')
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 1000 } })
const errs = []; p.on('pageerror', (e) => errs.push(e.message.slice(0, 200)))
// SIGNUP with a fresh plus-address (real account; admin can delete)
await p.goto('http://localhost:3005/signup', { waitUntil: 'domcontentloaded' })
const email = get('SUPER_ADMIN_EMAIL').replace('@', '+audit' + Date.now().toString().slice(-5) + '@')
await p.fill('input[placeholder="Jordan Rivera"]', 'Audit Tester'); await p.fill('input[type=email]', email); await p.fill('input[type=password]', 'AuditPass123!'); await p.click('button.au-submit'); await p.waitForTimeout(5000); await p.screenshot({ path: S + 'signup-after.jpg', type: 'jpeg', quality: 55 })
console.log('signup →', p.url().replace('http://localhost:3005', ''), '|', (await p.locator('body').innerText()).replace(/\s+/g, ' ').match(/(check your (inbox|email)|confirm|welcome|first piece)[^.]{0,80}/i)?.[0] || '(no confirmation text)')
// FORGOT PASSWORD
await p.goto('http://localhost:3005/login', { waitUntil: 'domcontentloaded' }); await p.fill('input[type=email]', get('SUPER_ADMIN_EMAIL'))
await p.click('button:has-text("Forgot password")'); await p.waitForTimeout(3000); await p.screenshot({ path: S + 'forgot-after.jpg', type: 'jpeg', quality: 55 }); console.log('forgot →', (await p.locator('body').innerText()).replace(/\s+/g, ' ').match(/(sent|check|email|link)[^.]{0,80}/i)?.[0] || '(no message)')
// LOGIN + ACCOUNT
await p.goto('http://localhost:3005/login'); await p.fill('input[type=email]', get('SUPER_ADMIN_EMAIL')); await p.fill('input[type=password]', get('SUPER_ADMIN_PASSWORD')); await p.click('button.au-submit'); await p.waitForURL((u) => !u.pathname.startsWith('/login'), { waitUntil: 'domcontentloaded', timeout: 90000 })
await p.goto('http://localhost:3005/account', { waitUntil: 'domcontentloaded' }); await p.waitForSelector('input:visible', { timeout: 30000 })
const fileIn = p.locator('input[type=file]'); console.log('account: avatar input present:', await fileIn.count() > 0)
if (await fileIn.count()) { await fileIn.first().setInputFiles('C:/dev/1 - Restylez/public/icons/avatar.png'); await p.waitForTimeout(3000); console.log('account: avatar msg:', (await p.locator('body').innerText()).replace(/\s+/g, ' ').match(/(saved|updated|uploaded|failed|error)[^.]{0,60}/i)?.[0] || '(none)') }
console.log('account buttons:', (await p.locator('button').allInnerTexts()).map((t) => t.trim()).filter(Boolean).join(' | '))
await p.screenshot({ path: S + 'account.jpg', type: 'jpeg', quality: 55, fullPage: true })
// LIBRARY
await p.goto('http://localhost:3005/library', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500)
console.log('library: design cards:', await p.locator('a[href^="/?open="]').count() / 2, '| open first works:', await (async () => { const a = p.locator('a[href^="/?open="]').first(); if (!(await a.count())) return 'n/a'; await a.click(); await p.waitForURL(/open=/); await p.waitForTimeout(3000); return (await p.locator('img[alt="Remade"]').count()) > 0 })())
console.log('errors:', errs); await b.close()
