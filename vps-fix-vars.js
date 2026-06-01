const fs = require('fs')
let c = fs.readFileSync('/app/server.js', 'utf8')
const marker = c.indexOf('FULL PIPELINE:')
if (marker === -1) { console.log('ERROR: no pipeline marker'); process.exit(1) }
const lineEnd = c.indexOf('\n', marker)
const vars = [
  'const brandName = (req.body && req.body.brandName) || null',
  'const brandColors = (req.body && req.body.brandColors) || {primary:"#1B365D",secondary:"#4A90D9",text:"#FFFFFF"}',
  'const noContactBar = (req.body && req.body.noContactBar) || false',
  'const slideNarrations = (req.body && req.body.slideNarrations) || null',
]
let added = 0
for (const v of vars) {
  const name = v.match(/const (\w+)/)[1]
  if (!c.includes('const ' + name + ' =')) {
    c = c.slice(0, lineEnd) + '\n    ' + v + c.slice(lineEnd)
    added++
  }
}
if (added > 0) {
  fs.writeFileSync('/app/server.js', c)
  console.log('Added ' + added + ' variable definitions')
} else {
  console.log('All variables already defined')
}
