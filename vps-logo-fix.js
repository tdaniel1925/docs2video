const fs = require('fs')
let code = fs.readFileSync('/tmp/server.js', 'utf8')

// Fix: when images.edit fails due to invalid logo, fall back to images.generate
const old = `          console.error(\`[\${videoId}] Slide \${idx + 1} attempt \${attempt}/3 failed:\`, retryErr.message?.slice(0, 150))
          if (attempt < 3) await new Promise(r => setTimeout(r, 3000 * attempt))`

const fix = `          console.error(\`[\${videoId}] Slide \${idx + 1} attempt \${attempt}/3 failed:\`, retryErr.message?.slice(0, 150))
          // If logo is invalid, disable it and retry with images.generate instead
          if (retryErr.message?.includes('Invalid image') && logoBase64) {
            console.log(\`[\${videoId}] Logo image invalid for OpenAI, disabling logo for remaining slides\`)
            logoBase64 = null
          }
          if (attempt < 3) await new Promise(r => setTimeout(r, 3000 * attempt))`

if (code.includes(old)) {
  code = code.replace(old, fix)
  console.log('SUCCESS: Added logo fallback on Invalid image error')
} else {
  console.log('ERROR: Could not find the error handling block')
  // Try to find what's actually there
  const lines = code.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('attempt}/3 failed')) {
      console.log('Found at line', i + 1, ':', lines[i].trim())
      console.log('Next line:', lines[i+1]?.trim())
    }
  }
}

fs.writeFileSync('/tmp/server.js', code, 'utf8')
