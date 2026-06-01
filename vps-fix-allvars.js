const fs = require('fs')
let c = fs.readFileSync('/app/server.js', 'utf8')

// Remove ALL late variable definitions that cause "before initialization" errors
const varsToFix = ['brandName', 'brandColors', 'noContactBar', 'slideNarrations']

for (const varName of varsToFix) {
  // Find and remove ALL definitions of this variable
  const pattern = new RegExp('\\n\\s*const ' + varName + ' = [^\n]+', 'g')
  const matches = c.match(pattern)
  if (matches) {
    for (const m of matches) {
      c = c.replace(m, '')
    }
    console.log('Removed ' + (matches.length) + ' definitions of ' + varName)
  }
}

// Now add them ALL right after the request is received in the generate handler
// Find: the line that logs "FULL PIPELINE:"
const pipelineIdx = c.indexOf('FULL PIPELINE:')
if (pipelineIdx === -1) {
  console.log('ERROR: FULL PIPELINE not found')
  process.exit(1)
}

// Go to the start of that line
const lineStart = c.lastIndexOf('\n', pipelineIdx)

// Insert all variable definitions BEFORE the FULL PIPELINE log
const defs = `
    const brandName = (req.body && req.body.brandName) || null;
    const brandColors = (req.body && req.body.brandColors) || {primary:"#1B365D",secondary:"#4A90D9",text:"#FFFFFF"};
    const noContactBar = (req.body && req.body.noContactBar) || false;
    const slideNarrations = (req.body && req.body.slideNarrations) || null;
`

c = c.slice(0, lineStart) + '\n' + defs + c.slice(lineStart)

fs.writeFileSync('/app/server.js', c)
console.log('All 4 variables defined BEFORE FULL PIPELINE log')
console.log('Restart: docker restart docs2video-service')
