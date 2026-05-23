const fs = require('fs')
let code = fs.readFileSync('/tmp/server.js', 'utf8')

// Find all logo composite positions and change to 15px from top and right
const oldPattern = /\.composite\(\[\{ input: logoResized, top: \d+, left: 1920 - lw - \d+ \}\]\)/g
const matches = code.match(oldPattern)

if (matches && matches.length > 0) {
  code = code.replace(oldPattern, '.composite([{ input: logoResized, top: 15, left: 1920 - lw - 15 }])')
  fs.writeFileSync('/tmp/server.js', code, 'utf8')
  console.log('SUCCESS: Updated ' + matches.length + ' logo positions to 15px from top-right')
} else {
  // Try alternative pattern
  const alt = /top: \d+, left: 1920 - lw - \d+/g
  const altMatches = code.match(alt)
  if (altMatches) {
    code = code.replace(alt, 'top: 15, left: 1920 - lw - 15')
    fs.writeFileSync('/tmp/server.js', code, 'utf8')
    console.log('SUCCESS: Updated ' + altMatches.length + ' logo positions to 15px (alt)')
  } else {
    console.log('ERROR: Could not find logo composite pattern')
  }
}
