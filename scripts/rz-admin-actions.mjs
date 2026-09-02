// Exercise every admin action + account save against the live DB (self-targeted, net-zero money).
import { chromium } from 'playwright'
import { readFileSync } from 'fs'
const env = readFileSync('C:/dev/1 - Restylez/.env.local', 'utf8')
const get = (k) => (env.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim().replace(/\r$/, '').replace(/^["']|["']$/g, '')
const BASE = 'http://localhost:3005'
const b = await chromium.launch(); const p = await b.newPage()
await p.goto(BASE + '/login'); await p.fill('input[type=email]', get('SUPER_ADMIN_EMAIL')); await p.fill('input[type=password]', get('SUPER_ADMIN_PASSWORD')); await p.click('button.au-submit'); await p.waitForURL((u) => !u.pathname.startsWith('/login'))
const J = async (path, data) => { const r = data ? await p.request.post(BASE + path, { data }) : await p.request.get(BASE + path); const j = await r.json().catch(() => ({})); return { s: r.status(), j } }
const me = (await J('/api/admin?view=me')).j; const uid = me.admin?.id; console.log('me:', me.admin?.email, me.admin?.role, uid ? 'id ok' : 'NO ID')
const before = (await J('/api/account')).j; console.log('account before: name=', before.user?.name, 'balance cents=', before.wallet?.balance_cents ?? before.wallet?.balance)
const steps = [
  ['grant +100', { action: 'grant', userId: uid, cents: 100, note: 'audit test +' }],
  ['grant -100', { action: 'grant', userId: uid, cents: -100, note: 'audit test -' }],
  ['note', { action: 'note', userId: uid, notes: 'audit test note ' + Date.now() }],
  ['resetFree', { action: 'resetFree', userId: uid }],
  ['disable', { action: 'disable', userId: uid }],
  ['enable', { action: 'enable', userId: uid }],
  ['role keep', { action: 'role', userId: uid, role: 'super_admin' }],
  ['refund bad job', { action: 'refund', jobId: 999999999 }],
  ['setting bad key', { action: 'setting', key: 'nope', value: 1 }],
]
for (const [n, d] of steps) { const r = await J('/api/admin', d); console.log(n, '→', r.s, r.j.error || 'ok') }
const st = (await J('/api/admin?view=settings')).j.settings
const r1 = await J('/api/admin', { action: 'setting', key: 'banner', value: { text: 'AUDIT BANNER TEST', kind: 'info' } }); console.log('banner set →', r1.s, r1.j.error || 'ok')
await p.goto(BASE + '/', { waitUntil: 'networkidle' }); console.log('banner visible on site:', await p.locator('text=AUDIT BANNER TEST').count() > 0)
const r2 = await J('/api/admin', { action: 'setting', key: 'banner', value: st.banner }); console.log('banner restored →', r2.s, r2.j.error || 'ok')
const after = (await J('/api/account')).j; console.log('balance after (must equal before):', after.wallet?.balance_cents ?? after.wallet?.balance)
const acct = await J('/api/account', { name: before.user?.name || 'Trent Daniel' }); console.log('account name save →', acct.s, acct.j.error || 'ok')
const audit = (await J('/api/admin?view=audit')).j.audit || []; console.log('audit rows:', audit.length, 'latest actions:', audit.slice(0, 8).map((a) => a.action).join(','))
const cust = (await J('/api/admin?view=customers&q=' + encodeURIComponent(get('SUPER_ADMIN_EMAIL').split('@')[0]))).j; console.log('customer search hits:', cust.customers?.length, 'first has:', Object.keys(cust.customers?.[0] || {}).slice(0, 6).join(','))
if (cust.customers?.[0]) { const d = (await J('/api/admin?view=customer&id=' + cust.customers[0].user_id)).j; console.log('customer detail keys:', Object.keys(d).join(',')) }
const health = (await J('/api/admin?view=health')).j; console.log('health:', JSON.stringify(health).slice(0, 200))
const tg = await J('/api/admin', { action: 'testGeneration' }); console.log('testGeneration →', tg.s, JSON.stringify(tg.j).slice(0, 120))
await b.close()
