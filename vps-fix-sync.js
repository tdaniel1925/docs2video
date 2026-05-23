const fs = require('fs')
let code = fs.readFileSync('/tmp/server.js', 'utf8')

// Fix: if any audio clips are missing, generate them before clip assembly
// Add a check after audio is done to fill gaps

const old = `    // Create clips
    const clipFiles = []
    const durations = []
    for (let i = 0; i < slideBuffers.length; i++) {`

const fix = `    // Ensure every slide has audio — regenerate any missing clips
    while (audioBuffers.length < slideBuffers.length) {
      console.log(\`[\${videoId}] Missing audio for slide \${audioBuffers.length + 1}, generating...\`)
      const missingIdx = audioBuffers.length
      const missingScene = scenes[missingIdx]
      if (missingScene?.narration?.trim()) {
        try {
          const audioBuf = await cartesiaTTS(missingScene.narration.slice(0, 4096), voiceId || 'nova')
          audioBuffers.push(audioBuf)
        } catch (e) {
          console.log(\`[\${videoId}] Failed to generate missing audio \${missingIdx + 1}:\`, e.message)
          audioBuffers.push(Buffer.alloc(0))
        }
      } else {
        audioBuffers.push(Buffer.alloc(0))
      }
    }
    // Write any newly generated audio files
    for (let i = 0; i < audioBuffers.length; i++) {
      const audioPath = join(workDir, \`audio_\${i}.mp3\`)
      if (audioBuffers[i] && audioBuffers[i].length > 0) {
        await writeFile(audioPath, audioBuffers[i])
      }
    }

    // Create clips
    const clipFiles = []
    const durations = []
    for (let i = 0; i < slideBuffers.length; i++) {`

if (code.includes(old)) {
  code = code.replace(old, fix)
  console.log('SUCCESS: Added missing audio regeneration before clip assembly')
} else {
  console.log('ERROR: Could not find clip assembly block')
}

fs.writeFileSync('/tmp/server.js', code, 'utf8')
