const fs = require('fs')
let c = fs.readFileSync('/app/server.js', 'utf8')

// The problem: brandName is defined AFTER the batch loop that uses it.
// Fix: remove the late definition and add it BEFORE the batch loop.

// Step 1: Find the batch loop (where brandName is first used)
const batchIdx = c.indexOf('batch.push(')
if (batchIdx === -1) { console.log('ERROR: no batch.push found'); process.exit(1) }

// Step 2: Find the for loop that contains the batch
const forIdx = c.lastIndexOf('for (let i = 0;', batchIdx)
if (forIdx === -1) { console.log('ERROR: no for loop found'); process.exit(1) }

// Step 3: Find a good insertion point before the for loop
const insertPoint = c.lastIndexOf('\n', forIdx)

// Step 4: Check if brandName is already defined before this point
const codeBefore = c.substring(0, insertPoint)
if (codeBefore.includes('const brandName =')) {
  console.log('brandName already defined before batch loop - checking order...')
  const defIdx = codeBefore.indexOf('const brandName =')
  console.log('Defined at:', defIdx, 'Batch at:', batchIdx, '- OK')
} else {
  // Remove the late definition
  const lateDef = c.indexOf('const brandName = (req.body && req.body.brandName)')
  if (lateDef === -1) {
    // Try alternate pattern
    const altDef = c.indexOf('const brandName = (typeof req')
    if (altDef > -1) {
      // Find the full line and remove it
      const lineStart = c.lastIndexOf('\n', altDef)
      const lineEnd = c.indexOf('\n', altDef)
      c = c.substring(0, lineStart) + c.substring(lineEnd)
      console.log('Removed late brandName definition')
    }
  } else {
    const lineStart = c.lastIndexOf('\n', lateDef)
    const lineEnd = c.indexOf('\n', lateDef)
    c = c.substring(0, lineStart) + c.substring(lineEnd)
    console.log('Removed late brandName definition')
  }

  // Also remove late brandColors, noContactBar, slideNarrations if after batch
  for (const varName of ['brandColors', 'noContactBar', 'slideNarrations']) {
    const varIdx = c.indexOf('const ' + varName + ' =')
    if (varIdx > -1 && varIdx > batchIdx) {
      const ls = c.lastIndexOf('\n', varIdx)
      const le = c.indexOf('\n', varIdx)
      c = c.substring(0, ls) + c.substring(le)
      console.log('Removed late ' + varName + ' definition')
    }
  }

  // Now insert all definitions BEFORE the batch loop
  const defs = `
    // Variables extracted from request body (must be before batch loop)
    const brandName = (req.body && req.body.brandName) || null
    const brandColors = (req.body && req.body.brandColors) || {primary:"#1B365D",secondary:"#4A90D9",text:"#FFFFFF"}
    const noContactBar = (req.body && req.body.noContactBar) || false
    const slideNarrations = (req.body && req.body.slideNarrations) || null
`
  // Re-find insertion point (may have shifted)
  const newForIdx = c.indexOf('for (let i = 0;', c.indexOf('STAGE 1'))
  if (newForIdx > -1) {
    const newInsert = c.lastIndexOf('\n', newForIdx)
    c = c.substring(0, newInsert) + defs + c.substring(newInsert)
    console.log('Added variable definitions BEFORE batch loop')
  } else {
    // Fallback: insert after FULL PIPELINE log but that's where they were...
    // Try inserting right after slidePrompts array is received
    const promptsIdx = c.indexOf('slidePrompts.length')
    if (promptsIdx > -1) {
      const afterLog = c.indexOf('\n', promptsIdx)
      c = c.substring(0, afterLog) + defs + c.substring(afterLog)
      console.log('Added variable definitions after slidePrompts log')
    }
  }
}

fs.writeFileSync('/app/server.js', c)
console.log('Done! Restart the service.')
