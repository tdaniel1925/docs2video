// VPS patch: Add 0.3s silence at start of each audio clip to prevent cutoff
const fs = require('fs')
let code = fs.readFileSync('/tmp/server.js', 'utf8')

// Find where audio clips are written to files and add silence padding with ffmpeg
const old = `      if (audioBuffers[i] && audioBuffers[i].length > 0) {
        await writeFile(join(workDir, \`audio_\${i}.mp3\`), audioBuffers[i])`

const replacement = `      if (audioBuffers[i] && audioBuffers[i].length > 0) {
        // Add 0.3s silence at start to prevent audio cutoff
        const rawAudioPath = join(workDir, \`audio_raw_\${i}.mp3\`)
        const paddedAudioPath = join(workDir, \`audio_\${i}.mp3\`)
        await writeFile(rawAudioPath, audioBuffers[i])
        try {
          await runFfmpeg(['-f', 'lavfi', '-t', '0.3', '-i', 'anullsrc=r=44100:cl=mono', '-i', rawAudioPath, '-filter_complex', '[0:a][1:a]concat=n=2:v=0:a=1', '-y', paddedAudioPath])
        } catch {
          // If padding fails, use original
          await writeFile(paddedAudioPath, audioBuffers[i])`

if (code.includes(old)) {
  code = code.replace(old, replacement)
  // Close the try-catch
  code = code.replace(
    `        await writeFile(join(workDir, \`audio_\${i}.mp3\`), audioBuffers[i])
      }`,
    `        }
      }`
  )
  console.log('SUCCESS: Added audio padding')
} else {
  console.log('ERROR: Could not find audio write block')
  // Show what's there
  const idx = code.indexOf('audio_${i}.mp3')
  if (idx > -1) console.log('Found at:', code.slice(Math.max(0, idx - 100), idx + 100))
}

fs.writeFileSync('/tmp/server.js', code, 'utf8')
