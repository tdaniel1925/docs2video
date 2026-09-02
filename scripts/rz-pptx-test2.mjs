import { chromium } from 'playwright'
import { readFileSync } from 'fs'
import JSZip from 'jszip'
const S = 'C:/Users/tdani/AppData/Local/Temp/claude/C--dev-1---PrismGraphs/b49a578b-8a92-4baa-9740-01972f39bb4f/scratchpad/'
const env = readFileSync('C:/dev/1 - Restylez/.env.local', 'utf8')
const get = (k) => (env.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim().replace(/\r$/, '').replace(/^["']|["']$/g, '')
const PPTX = 'C:/dev/1 - Apex Pre-Launch Site/General - Apex Flyer.pptx'
const b = await chromium.launch(); const ctx = await b.newContext({ acceptDownloads: true }); const p = await ctx.newPage({ viewport: { width: 1440, height: 1000 } })
const errs = []; p.on('pageerror', (e) => errs.push(e.message.slice(0, 200)))
await p.goto('http://localhost:3005/login'); await p.fill('input[type=email]', get('SUPER_ADMIN_EMAIL')); await p.fill('input[type=password]', get('SUPER_ADMIN_PASSWORD')); await p.click('button.au-submit'); await p.waitForURL((u) => !u.pathname.startsWith('/login'), { waitUntil: 'domcontentloaded', timeout: 90000 })
await p.goto('http://localhost:3005/pptx', { waitUntil: 'domcontentloaded' }); await p.waitForSelector('label.rz-drop')
const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('label.rz-drop')]); await fc.setFiles(PPTX)
await p.waitForSelector('input[type=checkbox]', { timeout: 20000 }); console.log('pptx: file accepted (checkbox shown)')
await p.locator('input[type=checkbox]').first().check()
await p.click('button:has-text("Just open the text")'); await p.waitForSelector('input.rz-input', { timeout: 60000 })
const n = await p.locator('input.rz-input').count(); console.log('pptx: text boxes:', n)
const first = p.locator('input.rz-input').first(); const orig = await first.inputValue(); await first.fill('AUDIT EDIT ' + orig.slice(0, 20)); console.log('pptx: edited first box from', JSON.stringify(orig.slice(0, 40)))
const dlBtn = p.locator('button:has-text("Download my PowerPoint")'); console.log('pptx: download enabled:', !(await dlBtn.isDisabled()))
const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), dlBtn.click()]); const path = S + 'pptx-out.pptx'; await dl.saveAs(path)
const z = await JSZip.loadAsync(readFileSync(path)); let t = ''; for (const f of Object.keys(z.files).filter((x) => /ppt\/slides\/slide\d+\.xml$/.test(x))) t += await z.file(f).async('string')
console.log('pptx: output contains the edit:', t.includes('AUDIT EDIT'), '| file size KB:', Math.round(readFileSync(path).length / 1024))
// AI-plan path
await p.goto('http://localhost:3005/pptx', { waitUntil: 'domcontentloaded' }); await p.waitForSelector('label.rz-drop')
const [fc2] = await Promise.all([p.waitForEvent('filechooser'), p.click('label.rz-drop')]); await fc2.setFiles(PPTX)
await p.waitForSelector('input[type=checkbox]'); await p.locator('input[type=checkbox]').first().check()
await p.locator('textarea').first().fill('Change every phone number to (555) 010-2030. Change the year 2025 to 2026 wherever it appears. Change the word Apex to Summit everywhere.')
await p.click('button:has-text("Open + apply my changes")'); await p.waitForSelector('button:has-text("Download my PowerPoint")', { timeout: 180000 })
const changedTxt = await p.locator('body').innerText(); console.log('pptx AI plan summary:', changedTxt.match(/\d+ (change|box|edit)[^.]{0,80}/i)?.[0] || '(no count found)', '| download enabled:', !(await p.locator('button:has-text("Download my PowerPoint")').isDisabled()))
console.log('errors:', errs); await b.close()
