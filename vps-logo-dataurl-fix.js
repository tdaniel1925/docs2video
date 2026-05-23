const fs = require('fs')
let code = fs.readFileSync('/tmp/server.js', 'utf8')

const old = `    // Fetch logo image if available (for reference in prompts)
    let logoBase64 = null
    if (logoUrl) {
      try {
        const logoRes = await fetch(logoUrl, { signal: AbortSignal.timeout(8000) })
        if (logoRes.ok) logoBase64 = Buffer.from(await logoRes.arrayBuffer()).toString('base64')
      } catch (e) { console.log(\`[\${videoId}] Logo fetch failed:\`, e.message) }
    }`

const fix = `    // Fetch logo image if available (for reference in prompts)
    let logoBase64 = null
    if (logoUrl) {
      try {
        if (logoUrl.startsWith('data:')) {
          // Data URL — extract base64 directly, no fetch needed
          logoBase64 = logoUrl.split(',')[1]
          console.log(\`[\${videoId}] Logo from data URL: \${(logoBase64.length / 1024).toFixed(0)}KB\`)
        } else {
          // HTTP URL — fetch from storage/web
          const logoRes = await fetch(logoUrl, { signal: AbortSignal.timeout(8000) })
          if (logoRes.ok) logoBase64 = Buffer.from(await logoRes.arrayBuffer()).toString('base64')
        }
      } catch (e) { console.log(\`[\${videoId}] Logo fetch failed:\`, e.message) }
    }`

if (code.includes(old)) {
  code = code.replace(old, fix)
  console.log('SUCCESS: Fixed data URL logo handling')
} else {
  console.log('ERROR: Could not find logo fetch block')
}

fs.writeFileSync('/tmp/server.js', code, 'utf8')
