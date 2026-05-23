const fs = require('fs')
let code = fs.readFileSync('/tmp/server.js', 'utf8')

// Find and fix the broken audio padding try/catch
const broken = `        try {
          await runFfmpeg(['-f', 'lavfi', '-t', '0.3', '-i', 'anullsrc=r=44100:cl=mono', '-i', rawAudioPath, '-filter_complex', '[0:a][1:a]concat=n=2:v=0:a=1', '-y', paddedAudioPath])`

// Find everything from the try to the next "// Create clips" and replace
const tryIdx = code.indexOf(broken)
if (tryIdx === -1) {
  // Maybe it was already partially fixed — find by rawAudioPath
  const rawIdx = code.indexOf('const rawAudioPath')
  if (rawIdx === -1) {
    console.log('ERROR: Cannot find audio padding code')
    process.exit(1)
  }
  // Find the end of this if block — look for "// Create clips"
  const createClipsIdx = code.indexOf('// Create clips', rawIdx)
  const beforeRaw = code.lastIndexOf('if (audioBuffers[i]', rawIdx)

  // Replace the entire audio write block
  const replacement = `if (audioBuffers[i] && audioBuffers[i].length > 0) {
        await writeFile(join(workDir, \`audio_\${i}.mp3\`), audioBuffers[i])
      }
    }

    `

  // Find where to cut
  const blockStart = beforeRaw
  const blockEnd = createClipsIdx

  code = code.substring(0, blockStart) + replacement + code.substring(blockEnd)
  console.log('Fixed by replacing entire block (removed audio padding)')
} else {
  // Simple fix — just remove the padding and use direct write
  const createClipsIdx = code.indexOf('// Create clips', tryIdx)
  const blockStart = code.lastIndexOf('if (audioBuffers[i]', tryIdx)

  const replacement = `if (audioBuffers[i] && audioBuffers[i].length > 0) {
        await writeFile(join(workDir, \`audio_\${i}.mp3\`), audioBuffers[i])
      }
    }

    `

  code = code.substring(0, blockStart) + replacement + code.substring(createClipsIdx)
  console.log('Fixed by removing audio padding (was causing syntax error)')
}

fs.writeFileSync('/tmp/server.js', code, 'utf8')
console.log('Done. Deploy and restart.')
