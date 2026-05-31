/**
 * VPS: Remove logo compositing from content slides.
 * Video branding is now text-only — logos are for other features (email, share page).
 */
const fs = require('fs')
const serverPath = '/app/server.js'
let c = fs.readFileSync(serverPath, 'utf8')
let changes = 0

// Find and disable the logo compositing in generateOneSlide
// Look for logoBase64 usage
const logoComposite = c.indexOf('logoBase64')
if (logoComposite > -1) {
  // Find the section that fetches and composites the logo
  const logoFetch = c.indexOf('logoUrl', c.indexOf('async function generateOneSlide'))
  if (logoFetch > -1 && logoFetch < c.indexOf('const BATCH_SIZE')) {
    // Comment out logo fetching and compositing by finding the block
    // Look for "if (logoUrl)" or "if (logoBase64)" in generateOneSlide
    const genSlideStart = c.indexOf('async function generateOneSlide')
    const genSlideEnd = c.indexOf('async function generateCover')
    if (genSlideStart > -1 && genSlideEnd > -1) {
      const genSlideCode = c.substring(genSlideStart, genSlideEnd)
      if (genSlideCode.includes('logoBase64') || genSlideCode.includes('logoUrl')) {
        // Replace logo compositing with a pass-through
        const newCode = genSlideCode
          .replace(/if\s*\(logoBase64\)\s*\{[\s\S]*?\}\s*(?=return|const|\/\/)/g, '// Logo compositing removed — video branding is text-only\n      ')
          .replace(/const logoBase64[\s\S]*?(?=for \(let attempt|const prompt)/g, '// Logo fetching removed\n      ')
        c = c.substring(0, genSlideStart) + newCode + c.substring(genSlideEnd)
        changes++
        console.log('1. Removed logo compositing from generateOneSlide')
      }
    }
  }
}

if (changes === 0) {
  // Try simpler approach — just skip the logo fetch
  const logoUrlFetch = 'if (logoUrl)'
  const genSlideIdx = c.indexOf('async function generateOneSlide')
  if (genSlideIdx > -1) {
    const nextIdx = c.indexOf(logoUrlFetch, genSlideIdx)
    const batchIdx = c.indexOf('const BATCH_SIZE', genSlideIdx)
    if (nextIdx > -1 && nextIdx < batchIdx) {
      // Find the matching closing brace
      let depth = 0
      let pos = nextIdx
      let blockStart = -1
      let blockEnd = -1
      for (let i = pos; i < batchIdx; i++) {
        if (c[i] === '{') { if (depth === 0) blockStart = i; depth++ }
        if (c[i] === '}') { depth--; if (depth === 0) { blockEnd = i + 1; break } }
      }
      if (blockStart > -1 && blockEnd > -1) {
        c = c.substring(0, nextIdx) + '// Logo compositing removed — text-only branding\n      ' + c.substring(blockEnd)
        changes++
        console.log('1. Removed logo if-block from generateOneSlide')
      }
    }
  }
}

// Also remove logo fetching before generateOneSlide
const logoFetchLine = 'let logoBase64'
const fetchIdx = c.indexOf(logoFetchLine)
if (fetchIdx > -1) {
  const lineEnd = c.indexOf('\n', fetchIdx)
  // Find the end of the logo fetch block (usually goes until the next blank line or function)
  let endPos = lineEnd
  // Keep removing lines that are part of logo fetching
  while (endPos < c.length) {
    const nextLine = c.substring(endPos + 1, c.indexOf('\n', endPos + 1))
    if (nextLine.trim().startsWith('if (logoUrl') || nextLine.trim().startsWith('const logo') || nextLine.trim().startsWith('logo') || nextLine.trim() === '') {
      endPos = c.indexOf('\n', endPos + 1)
      if (endPos === -1) break
    } else {
      break
    }
  }
  c = c.substring(0, fetchIdx) + '// Logo fetching removed — text-only branding' + c.substring(endPos)
  changes++
  console.log('2. Removed logo fetching block')
}

if (changes > 0) {
  fs.writeFileSync(serverPath, c)
  console.log('Done! ' + changes + ' changes.')
} else {
  console.log('No logo code found to remove — may already be clean')
}
console.log('Run: docker restart docs2video-service')
