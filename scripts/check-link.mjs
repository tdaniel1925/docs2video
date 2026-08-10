// Does a link actually open, and does it render rather than download?
//
//   node scripts/check-link.mjs <url> [...more]
//
// Handing over a URL without opening it is how you send someone a 404.
for (const url of process.argv.slice(2)) {
  try {
    const res = await fetch(url)
    const type = res.headers.get('content-type') || '?'
    const len = res.headers.get('content-length') || '?'
    const ok = res.ok
    // An HTML page served as a download prompts a file save instead of showing.
    const renders = !url.endsWith('.html') || type.includes('text/html')
    console.log(`${ok && renders ? 'OK  ' : 'BAD '} ${res.status}  ${type}  ${len}b  ${url.split('/').pop()}`)
    if (ok && url.endsWith('.html')) {
      const body = await res.text()
      const imgs = (body.match(/<img /g) || []).length
      console.log(`      the page references ${imgs} image(s)`)
    }
  } catch (e) {
    console.log(`BAD  ${String(e.message).slice(0, 60)}  ${url}`)
  }
}
