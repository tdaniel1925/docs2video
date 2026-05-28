/**
 * Fix: Define brandName and brandColors before bar compositing on VPS.
 * The bar compositing code (from v3 patch) references these variables
 * but they were never extracted from the request body.
 */
const fs = require('fs')
let c = fs.readFileSync('/app/server.js', 'utf8')
let changes = 0

// The bar compositing code references:
//   brandColors?.primary, brandColors?.text, brandName
// These need to be defined in scope.

// Strategy: Find the bar compositing block and add variable definitions
// right before it, using a safe pattern that works regardless of prior patches.

// Find ALL occurrences of barColor that reference brandColors
const barPattern = 'const barColor = brandColors?.primary'
let searchIdx = 0
while ((searchIdx = c.indexOf(barPattern, searchIdx)) > -1) {
  // Check if brandColors is already defined before this point in the same block
  const blockStart = c.lastIndexOf('for (let i = 0;', searchIdx)
  const codeBeforeBar = c.substring(blockStart, searchIdx)

  if (!codeBeforeBar.includes('const brandColors =') && !codeBeforeBar.includes('let brandColors =')) {
    // Need to add brandColors definition
    // Also check for brandName
    const needsBrandName = c.substring(searchIdx, searchIdx + 500).includes('brandName') && !codeBeforeBar.includes('const brandName =')

    let insertion = '      // Bar variables — extract from request or use defaults\n'
    insertion += '      const brandColors = (typeof req !== "undefined" && req.body && req.body.brandColors) || { primary: "#1B365D", secondary: "#4A90D9", text: "#FFFFFF" }\n'
    if (needsBrandName) {
      insertion += '      const brandName = (typeof req !== "undefined" && req.body && req.body.brandName) || null\n'
    }

    c = c.substring(0, searchIdx) + insertion + c.substring(searchIdx)
    searchIdx += insertion.length + barPattern.length
    changes++
    console.log('Fixed bar compositing block at position ' + searchIdx)
  } else {
    // Already has brandColors defined
    // But check if brandName is missing
    if (c.substring(searchIdx, searchIdx + 500).includes('brandName') && !codeBeforeBar.includes('const brandName =')) {
      const insertion = '      const brandName = (typeof req !== "undefined" && req.body && req.body.brandName) || null\n'
      c = c.substring(0, searchIdx) + insertion + c.substring(searchIdx)
      searchIdx += insertion.length + barPattern.length
      changes++
      console.log('Added brandName definition')
    } else {
      searchIdx += barPattern.length
      console.log('Block already has both variables defined')
    }
  }
}

if (changes > 0) {
  fs.writeFileSync('/app/server.js', c)
  console.log('Done! ' + changes + ' fixes applied.')
} else {
  // Fallback: check if the issue is something else
  console.log('No barColor patterns found. Checking for bare brandName references...')

  // Find any bare brandName references in the generate handler
  const genIdx = c.indexOf('FULL PIPELINE:')
  if (genIdx > -1) {
    const genBlock = c.substring(genIdx, genIdx + 10000)
    const hasBrandName = genBlock.includes('brandName') && !genBlock.includes('const brandName')
    const hasBrandColors = genBlock.includes('brandColors') && !genBlock.includes('const brandColors')
    console.log('In generate handler:')
    console.log('  brandName referenced but not defined:', hasBrandName)
    console.log('  brandColors referenced but not defined:', hasBrandColors)

    if (hasBrandName || hasBrandColors) {
      // Insert definitions right after the FULL PIPELINE log line
      const logLine = c.indexOf('\n', c.indexOf('FULL PIPELINE:'))
      let defs = ''
      if (hasBrandName) defs += '\n    const brandName = req.body.brandName || null'
      if (hasBrandColors) defs += '\n    const brandColors = req.body.brandColors || { primary: "#1B365D", secondary: "#4A90D9", text: "#FFFFFF" }'
      c = c.substring(0, logLine) + defs + c.substring(logLine)
      fs.writeFileSync('/app/server.js', c)
      console.log('Fixed! Definitions added after FULL PIPELINE log.')
    }
  }
}
console.log('Restart: docker restart docs2video-service')
