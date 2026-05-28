/**
 * VPS Patch: Use pre-rendered cover + closing slides from Next.js
 *
 * When coverImageBase64 and closingImageBase64 are in the request,
 * use them directly instead of generating via AI for the first and last slides.
 */
const fs = require('fs')
const serverPath = '/app/server.js'
let c = fs.readFileSync(serverPath, 'utf8')
let changes = 0

// Extract coverImageBase64 and closingImageBase64 from request
const pipelineLog = 'FULL PIPELINE:'
const pipelineIdx = c.indexOf(pipelineLog)
if (pipelineIdx > -1) {
  const lineEnd = c.indexOf('\n', pipelineIdx)
  if (!c.includes('coverImageBase64')) {
    c = c.slice(0, lineEnd) +
      '\n    const coverImageBase64 = req.body.coverImageBase64 || null' +
      '\n    const closingImageBase64 = req.body.closingImageBase64 || null' +
      '\n    const noContactBar = req.body.noContactBar || false' +
      c.slice(lineEnd)
    changes++
    console.log('1. Extracted coverImageBase64, closingImageBase64, noContactBar from request')
  } else {
    console.log('1. SKIP: already extracted')
  }
} else {
  console.log('1. SKIP: pipeline log not found')
}

// Find the slide generation loop and make it skip cover/closing if pre-rendered
// The image generation uses generateOneSlide or generateFlipbookFrames
// We need to intercept BEFORE image generation and use pre-rendered buffer instead
const batchLoop = 'isFlipbookMode(j) ? generateFlipbookFrames(j) : generateOneSlide(j)'
if (c.includes(batchLoop)) {
  c = c.replace(
    batchLoop,
    `(j === 0 && coverImageBase64) ? Promise.resolve(Buffer.from(coverImageBase64, 'base64')) : (j === slidePrompts.length - 1 && closingImageBase64) ? Promise.resolve(Buffer.from(closingImageBase64, 'base64')) : (isFlipbookMode(j) ? generateFlipbookFrames(j) : generateOneSlide(j))`
  )
  changes++
  console.log('2. Added cover/closing bypass in batch loop (flipbook path)')
} else {
  // Try the simpler pattern (flipbook disabled)
  const simpleBatch = 'generateOneSlide(j)'
  const batchIdx = c.indexOf('batch.push(')
  if (batchIdx > -1) {
    const batchLine = c.substring(batchIdx, c.indexOf('\n', batchIdx))
    if (batchLine.includes('generateOneSlide(j)')) {
      // Replace the entire batch.push line
      const oldLine = batchLine
      const newLine = batchLine.replace(
        'generateOneSlide(j)',
        `((j === 0 && coverImageBase64) ? Promise.resolve(Buffer.from(coverImageBase64, 'base64')) : (j === slidePrompts.length - 1 && closingImageBase64) ? Promise.resolve(Buffer.from(closingImageBase64, 'base64')) : generateOneSlide(j))`
      )
      c = c.replace(oldLine, newLine)
      changes++
      console.log('2. Added cover/closing bypass in batch loop (simple path)')
    }
  }
  if (changes < 2) console.log('2. SKIP: batch loop pattern not found')
}

// Also skip the bar compositing on cover/closing slides (they already have branding)
const barCheck = 'const barColor = brandColors?.primary'
if (c.includes(barCheck)) {
  c = c.replace(
    barCheck,
    'if (noContactBar || i === 0 || i === slideBuffers.length - 1) { clipFiles.push(clipPath); /* skip bar on cover/closing/opted-out */ } else {\n      const barColor = brandColors?.primary'
  )
  // Need to close the else block — find the clipFiles.push after the bar code
  // This is tricky with string replacement. Let's add a simpler guard instead.
  // Actually let's revert and use a simpler approach
  c = c.replace(
    'if (noContactBar || i === 0 || i === slideBuffers.length - 1) { clipFiles.push(clipPath); /* skip bar on cover/closing/opted-out */ } else {\n      const barColor = brandColors?.primary',
    barCheck
  )
  // Simpler: wrap the entire bar block in a condition
  const barBlock = 'const barColor = brandColors?.primary'
  const barBlockIdx = c.indexOf(barBlock)
  if (barBlockIdx > -1) {
    const beforeBar = c.lastIndexOf('\n', barBlockIdx)
    c = c.slice(0, beforeBar) + '\n      // Skip bar on cover, closing, or if opted out\n      if (!noContactBar && i > 0 && i < slideBuffers.length - 1) {' + c.slice(beforeBar)
    // Find the end of the bar block (the catch block end or clipFiles.push)
    const barEndMarker = "// Continue with original clip (no bar)"
    const barEndIdx = c.indexOf(barEndMarker, barBlockIdx)
    if (barEndIdx > -1) {
      const afterBarEnd = c.indexOf('\n', c.indexOf('\n', barEndIdx) + 1)
      c = c.slice(0, afterBarEnd) + '\n      }' + c.slice(afterBarEnd)
      changes++
      console.log('3. Skip bar on cover/closing slides and when opted out')
    } else {
      console.log('3. SKIP: could not find bar block end')
    }
  }
} else {
  console.log('3. SKIP: bar code not found')
}

if (changes > 0) {
  fs.writeFileSync(serverPath, c)
  console.log('\nDone! ' + changes + ' fixes applied.')
} else {
  console.log('\nNo changes made.')
}
console.log('Run: docker restart docs2video-service')
