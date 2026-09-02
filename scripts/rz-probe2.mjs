import { chromium } from 'playwright'
import { readFileSync } from 'fs'
const env = readFileSync('C:/dev/1 - Restylez/.env.local', 'utf8')
const get = (k) => (env.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim().replace(/\r$/, '').replace(/^["']|["']$/g, '')
const TPL = 'C:/dev/1 - PrismGraphs/public/flyer-templates/'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 1000 } })
await p.goto('http://localhost:3005/login'); await p.fill('input[type=email]', get('SUPER_ADMIN_EMAIL')); await p.fill('input[type=password]', get('SUPER_ADMIN_PASSWORD')); await p.click('button.au-submit'); await p.waitForURL((u) => !u.pathname.startsWith('/login'), { waitUntil: 'domcontentloaded', timeout: 90000 })
// RESTYLE state probe
await p.goto('http://localhost:3005/', { waitUntil: 'domcontentloaded' }); await p.waitForSelector('button:has-text("Same content, different style")')
await p.click('button:has-text("Same content, different style")'); await p.waitForTimeout(400)
await p.locator('input[type=file]').nth(0).setInputFiles(TPL + 'food-late-night-diner.png'); await p.waitForTimeout(1500)
const lookInput = p.locator('label.rz-drop input[type=file]'); console.log('look inputs matched:', await lookInput.count())
await lookInput.last().setInputFiles(TPL + 'business-awards-night.png'); await p.waitForTimeout(1500)
await p.locator('input[type=checkbox]').first().check(); await p.waitForTimeout(300)
console.log('why-disabled hint:', await p.locator('.rz-why-disabled').textContent().catch(() => '(none)'), '| button disabled:', await p.locator('button:has-text("Restyle it")').isDisabled())
console.log('look section shows a preview:', await p.locator('text=Drop the design whose LOOK you want').count() === 0)
// PPTX probe: just open the text
await p.goto('http://localhost:3005/pptx', { waitUntil: 'domcontentloaded' }); await p.waitForSelector('input[type=file]')
await p.locator('input[type=file]').first().setInputFiles('C:/dev/1 - Apex Pre-Launch Site/General - Apex Flyer.pptx'); await p.waitForTimeout(1500)
await p.locator('input[type=checkbox]').first().check()
await p.click('button:has-text("Just open the text")'); await p.waitForTimeout(4000)
console.log('pptx text boxes after "Just open":', await p.locator('input.rz-input').count(), '| page text sample:', (await p.locator('main, body').first().innerText()).replace(/\s+/g, ' ').slice(0, 300))
await b.close()
