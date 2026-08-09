// Wait until a specific change is actually LIVE, not until a guessed number of
// seconds have passed.
//
//   node scripts/wait-deploy.mjs "<string that only exists in the new code>" [url]
//
// It loads the page, follows every script the page pulls in, and looks for the
// marker inside them. Re-testing against the old build wastes a generation and,
// worse, produces a result that looks like a verdict on the new code.
const MARKER = process.argv[2]
const URL_ = process.argv[3] || 'https://docs2video.com/flyer'
if (!MARKER) { console.error('give me a marker string'); process.exit(2) }

const DEADLINE = Date.now() + 6 * 60 * 1000

async function live() {
  const res = await fetch(URL_, { redirect: 'follow' })
  const html = await res.text()
  const origin = new globalThis.URL(URL_).origin

  // A SIGNED-OUT FETCH OF A PROTECTED PAGE LANDS ON /login, whose scripts will
  // never contain the marker — so this loop would poll until it timed out and
  // report "not deployed" about a deploy that went out fine. Say so instead of
  // quietly producing a wrong answer.
  if (new globalThis.URL(res.url).pathname !== new globalThis.URL(URL_).pathname) {
    throw new Error(`${URL_} redirected to ${res.url} — it needs a signed-in session, so this script cannot check it. Point it at a public page, or check the behaviour directly.`)
  }

  const chunks = [...new Set([...html.matchAll(/"(\/_next\/static\/[^"]+\.js)"/g)].map((m) => m[1]))]
  if (!chunks.length) throw new Error(`no scripts found at ${URL_} — nothing to search`)
  for (const c of chunks) {
    const body = await fetch(origin + c).then((r) => r.text()).catch(() => '')
    if (body.includes(MARKER)) return true
  }
  return false
}

let n = 0
for (;;) {
  n++
  if (await live().catch((e) => { console.error(e.message); process.exit(2) })) {
    console.log(`live after ${n} check(s)`)
    process.exit(0)
  }
  if (Date.now() > DEADLINE) {
    console.log('still not live after 6 minutes — check the Vercel build log')
    process.exit(1)
  }
  await new Promise((r) => setTimeout(r, 20000))
}
