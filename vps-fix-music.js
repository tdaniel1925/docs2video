const fs = require('fs')
let code = fs.readFileSync('/tmp/server.js', 'utf8')

// Find where music duration is calculated and cap it at 60 seconds
// Lyria fails for clips over ~90 seconds
const old = "const durationMin = Math.floor(totalDurationEst / 60)"
const fix = "const musicDuration = Math.min(totalDurationEst, 60) // Cap at 60s — Lyria fails for longer\n        const durationMin = Math.floor(musicDuration / 60)"

if (code.includes(old)) {
  code = code.replace(old, fix)
  // Also update the seconds calculation
  code = code.replace(
    "const durationSec = Math.round(totalDurationEst % 60)",
    "const durationSec = Math.round(musicDuration % 60)"
  )
  console.log('SUCCESS: Capped music request at 60 seconds')
} else {
  console.log('ERROR: Could not find duration calculation')
}

fs.writeFileSync('/tmp/server.js', code, 'utf8')
