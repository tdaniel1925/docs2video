// What security headers is the live site actually sending?
//
//   node scripts/check-headers.mjs [url]
//
// A Permissions-Policy of `microphone=()` disables the microphone for the
// WHOLE site — including our own pages, and no amount of clicking Allow in the
// browser can override it. That is invisible in the code until you look.
const url = process.argv[2] || 'https://docs2video.com/login'
const res = await fetch(url, { redirect: 'follow' })

const interesting = ['permissions-policy', 'feature-policy', 'content-security-policy', 'x-frame-options']
console.log(res.status, res.url)
for (const h of interesting) {
  const v = res.headers.get(h)
  if (v) console.log(`  ${h}: ${v}`)
}

const pp = res.headers.get('permissions-policy') || ''
const micBlocked = /microphone=\(\)/.test(pp)
console.log(micBlocked
  ? '\n  MICROPHONE IS BLOCKED SITE-WIDE by our own header — no browser setting can override it.'
  : /microphone=\(self\)/.test(pp)
    ? '\n  microphone allowed for our own pages.'
    : '\n  no microphone restriction in the policy.')
process.exit(micBlocked ? 1 : 0)
