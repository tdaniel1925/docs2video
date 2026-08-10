// Does the same server really serve two brands — and is Docs2Video untouched?
//
//   npx next start -p 3111    then:  node scripts/check-brands.mjs 3111
//
// Sends the SAME request twice with different Host headers. The second brand is
// worth nothing if it costs the first one, so the Docs2Video assertions are the
// important half.
//
// USES node:http, NOT fetch(). Host is a forbidden header in the Fetch spec and
// undici drops it silently — the first version of this script used fetch, so
// both requests arrived as localhost, both fell back to Docs2Video, and it
// reported that the Text2Art branding was broken when it was working perfectly.
// A false alarm is a checker lying just as much as a false pass is.
import http from 'node:http'

const port = Number(process.argv[2] || 3000)

const get = (host, path = '/') => new Promise((resolve) => {
  const req = http.request({ host: '127.0.0.1', port, path, headers: { Host: host } }, (res) => {
    let body = ''
    res.on('data', (d) => (body += d))
    res.on('end', () => resolve({ status: res.statusCode, location: res.headers.location, body }))
  })
  req.on('error', (e) => resolve({ status: 0, body: 'ERR ' + e.message }))
  req.end()
})

let bad = 0
const check = (ok, label, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`)
  if (!ok) bad++
}

console.log(`\nlocalhost:${port}\n`)

const t2a = await get('text2art.app')
const d2v = await get('docs2video.com')

if (t2a.status === 0) { console.log('  server not running on that port'); process.exit(2) }

// The two hosts must genuinely produce different pages. Without this, every
// other assertion below can pass on a single fallback page.
check(t2a.body !== d2v.body, 'the two hosts get DIFFERENT pages')

check(/Text2Art/i.test(t2a.body), 'text2art.app says Text2Art')
check(t2a.body.includes('text2art-logo'), 'the Text2Art logo is used, not just type')
check(!/Docs2Video/i.test(t2a.body), 'Docs2Video is not mentioned on the Text2Art landing page')

check(/Docs2Video/i.test(d2v.body), 'docs2video.com still says Docs2Video')
check(!/Text2Art/i.test(d2v.body), 'Text2Art does not leak onto Docs2Video')
check(!d2v.body.includes('text2art-logo'), 'the Text2Art logo does not appear on Docs2Video')

// The signed-in chrome must not say the wrong company either. These pages
// redirect to /login when signed out, so what is checked is that the LOGIN
// page they land on is branded correctly — the deeper pages need a session
// and are covered by eye.
for (const path of ['/settings', '/help']) {
  const t = await get('text2art.app', path)
  const d = await get('docs2video.com', path)
  check(!/Docs2Video/i.test(t.body || ''), `${path} on text2art.app never says Docs2Video`)
  check(t.status === d.status, `${path} behaves the same on both hosts`, `${t.status} vs ${d.status}`)
}

// Nothing on a Text2Art page should talk about VIDEOS. The customer cannot
// make one, so "20 videos/mo included" reads like they bought the wrong
// product. Credits are the shared currency and the only honest unit here.
const VIDEO_WORDS = /(video|videos|explainer|voiceover|narration|slide deck)/i
for (const path of ['/', '/login']) {
  const t = await get('text2art.app', path)
  const hit = (t.body || '').match(VIDEO_WORDS)
  check(!hit, `${path} on text2art.app never mentions video`, hit ? `found "${hit[0]}"` : '')
}

// An unknown host — a Vercel preview URL, a health check, a missing Host —
// must fall back rather than error.
const unknown = await get('some-preview-abc.vercel.app')
check(unknown.status === 200 && /Docs2Video/i.test(unknown.body),
  'an unrecognised host falls back to Docs2Video', `status ${unknown.status}`)

console.log(bad ? `\n${bad} problem(s)\n` : '\nboth storefronts behave\n')
process.exit(bad ? 1 : 0)
