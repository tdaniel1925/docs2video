/**
 * Fix: Generate TTS audio per slide instead of per scene
 *
 * Currently: audioPromise iterates scenes.length → 1 audio per scene
 * New: when slideNarrations is available, iterate slideNarrations.length → 1 audio per slide
 */
const fs = require('fs')
const serverPath = '/app/server.js'
let c = fs.readFileSync(serverPath, 'utf8')
let changes = 0

// Find the audio generation loop
const oldLoop = 'for (let i = 0; i < scenes.length; i++) {\n        const scene = scenes[i]\n        if (!scene.narration?.trim()) {'
if (c.includes(oldLoop)) {
  const newLoop = `// Use per-slide narrations if available (flat 1:1 with slidePrompts)
      const narrationSource = slideNarrations && slideNarrations.length > 0 ? slideNarrations : null
      const narrationCount = narrationSource ? narrationSource.length : scenes.length
      for (let i = 0; i < narrationCount; i++) {
        const scene = i < scenes.length ? scenes[i] : scenes[scenes.length - 1]
        const narrationText = narrationSource ? narrationSource[i] : scene.narration
        if (!narrationText?.trim()) {`

  c = c.replace(oldLoop, newLoop)
  changes++
  console.log('1. Changed TTS loop to use slideNarrations when available')
} else {
  console.log('1. SKIP: TTS loop pattern not found')
}

// Also replace scene.narration references inside the loop with narrationText
// Find "scene.narration" after the loop and replace with narrationText
const oldNarrRef1 = "scene.narration?.trim()"
// This was already replaced above for the condition, but there may be more
// Look for the text content being passed to TTS
const oldTtsInput = "scene.narration.slice(0, 4096)"
if (c.includes(oldTtsInput)) {
  // Replace all instances within a reasonable range
  c = c.replace(new RegExp("scene\\.narration\\.slice\\(0, 4096\\)", 'g'), "narrationText.slice(0, 4096)")
  changes++
  console.log('2. Updated TTS input to use narrationText')
} else {
  // Try alternate pattern
  const alt = "scene.narration.substring"
  if (c.includes(alt)) {
    c = c.replace(new RegExp("scene\\.narration\\.substring", 'g'), "narrationText.substring")
    changes++
    console.log('2. Updated TTS input (substring) to use narrationText')
  } else {
    console.log('2. SKIP: TTS input pattern not found')
    // Show what the TTS call looks like
    const ttsIdx = c.indexOf('cartesiaTTS(')
    if (ttsIdx > -1) {
      console.log('   TTS call context:', c.substring(ttsIdx, ttsIdx + 100))
    }
  }
}

// Also need to ensure the "ensure every slide has audio" loop works with the new count
const oldEnsure = 'while (audioBuffers.length < slideBuffers.length)'
if (c.includes(oldEnsure)) {
  console.log('3. Audio padding loop exists — will fill missing audio automatically')
} else {
  console.log('3. SKIP: audio padding loop not found')
}

if (changes > 0) {
  fs.writeFileSync(serverPath, c)
  console.log('\nDone! ' + changes + ' fixes applied.')
} else {
  console.log('\nNo changes made.')
}
console.log('Run: docker restart docs2video-service')
