const c = require('fs').readFileSync('/app/server.js', 'utf8')

// Find all sharp references
let pos = 0
let count = 0
while ((pos = c.indexOf('sharp', pos + 1)) > -1) {
  count++
  if (count <= 15) {
    const line = c.substring(0, pos).split('\n').length
    const context = c.substring(pos - 40, pos + 40).replace(/\n/g, ' ')
    console.log('sharp #' + count + ' line ' + line + ': ...' + context + '...')
  }
}
console.log('\nTotal sharp refs:', count)

// Check if there's Sharp compositing after generateCover
const coverEnd = c.indexOf('const BATCH_SIZE')
if (coverEnd > -1) {
  const afterCover = c.substring(coverEnd)
  if (afterCover.includes('.composite(')) {
    const compIdx = afterCover.indexOf('.composite(')
    const compLine = c.substring(0, coverEnd + compIdx).split('\n').length
    console.log('\nWARNING: Sharp .composite() found AFTER generateCover at line', compLine)
    console.log('Context:', afterCover.substring(compIdx - 50, compIdx + 100).replace(/\n/g, ' '))
  } else {
    console.log('\nNo Sharp .composite() found after generateCover - GOOD')
  }
}
