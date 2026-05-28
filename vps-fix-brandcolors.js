/**
 * Emergency fix: define brandColors on VPS
 * The bar compositing code references brandColors but it was never extracted from req.body
 */
const fs = require('fs')
let c = fs.readFileSync('/app/server.js', 'utf8')

// Option A: brandName was added by v4 patch
const markerA = 'const brandName = req.body.brandName'
// Option B: directly before bar compositing
const markerB = 'const barColor = brandColors?.primary'

if (c.includes(markerA)) {
  // brandName line exists, add brandColors after it
  c = c.replace(
    markerA,
    markerA + '\n    const brandColors = req.body.brandColors || { primary: "#1B365D", secondary: "#4A90D9", text: "#FFFFFF" }'
  )
  fs.writeFileSync('/app/server.js', c)
  console.log('Fixed via Option A: added brandColors after brandName extraction')
} else if (c.includes(markerB)) {
  // No brandName line, define brandColors inline before bar code
  c = c.replace(
    markerB,
    'const brandColors = (typeof req !== "undefined" && req.body && req.body.brandColors) || { primary: "#1B365D", secondary: "#4A90D9", text: "#FFFFFF" }\n      const barColor = brandColors?.primary'
  )
  fs.writeFileSync('/app/server.js', c)
  console.log('Fixed via Option B: added brandColors before bar compositing')
} else {
  // Check what we have
  console.log('Has brandColors ref:', c.includes('brandColors'))
  console.log('Has barColor ref:', c.includes('barColor'))
  console.log('Has brandName ref:', c.includes('brandName'))

  // Nuclear option: just define brandColors as a default wherever it appears
  if (c.includes('brandColors') && !c.includes('const brandColors')) {
    // Find the generate handler and add brandColors at the top
    const genHandler = c.indexOf('FULL PIPELINE:')
    if (genHandler > -1) {
      const lineStart = c.lastIndexOf('\n', genHandler)
      c = c.slice(0, lineStart) + '\n    const brandColors = (req && req.body && req.body.brandColors) || { primary: "#1B365D", secondary: "#4A90D9", text: "#FFFFFF" }\n    const brandName = (req && req.body && req.body.brandName) || null' + c.slice(lineStart)
      fs.writeFileSync('/app/server.js', c)
      console.log('Fixed via Option C: added brandColors before FULL PIPELINE log')
    } else {
      console.log('ERROR: Could not find insertion point')
    }
  } else {
    console.log('No fix needed or already fixed')
  }
}
