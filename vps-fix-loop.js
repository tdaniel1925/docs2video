/**
 * Fix: -loop 1 clips run forever because -shortest was removed.
 * Add -shortest back to the legacy still-image clip encoding.
 * This is safe now because audio duration is accurate via ffprobe.
 */
const fs = require('fs')
const serverPath = '/app/server.js'
let c = fs.readFileSync(serverPath, 'utf8')
let changes = 0

// Find the legacy clip encoding with audio (the -loop 1 path)
// It should have: -loop 1 -i slidePath -i audioPath ... -y clipPath
// We need to add -shortest before -y
const legacyWithAudio = "'-af', 'adelay=300|300', '-y', clipPath"
if (c.includes(legacyWithAudio)) {
  c = c.replace(legacyWithAudio, "'-af', 'adelay=300|300', '-shortest', '-y', clipPath")
  changes++
  console.log('1. Added -shortest to legacy still-image+audio clip encoding')
} else {
  console.log('1. SKIP: legacy audio clip pattern not found')
  // Try finding any -loop 1 + audio path without -shortest
  const loopPattern = "'-loop', '1'"
  const idx = c.indexOf(loopPattern)
  if (idx > -1) {
    const block = c.substring(idx, idx + 500)
    console.log('1. Found -loop 1 context:', block.slice(0, 200))
  }
}

if (changes > 0) {
  fs.writeFileSync(serverPath, c)
  console.log('\nDone! ' + changes + ' fixes applied.')
} else {
  console.log('\nNo changes made.')
}
console.log('Run: docker restart docs2video-service')
