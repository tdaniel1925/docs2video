// Fetch a page and report what it ACTUALLY contains.
//   node scripts/dump-page.mjs <url>
const res = await fetch(process.argv[2])
const body = await res.text()
console.log('status', res.status, res.headers.get('content-type'))
console.log('bytes  ', body.length)
console.log('<img>  ', (body.match(/<img /g) || []).length)
console.log('pairs  ', (body.match(/class="pair"/g) || []).length)
console.log('h2     ', (body.match(/<h2>/g) || []).length)
console.log('--- first 300 chars ---')
console.log(body.slice(0, 300))
