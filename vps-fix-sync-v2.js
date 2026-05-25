// VPS patch: Fix audio-slide sync by replacing -shortest with explicit -t duration
// This ensures each slide stays visible for exactly the length of its audio + padding
const fs = require('fs')
const path = '/app/server.js'

let code = fs.readFileSync(path, 'utf8')
let changes = 0

// 1. Add probeAudioDuration helper function (before the /generate route)
if (!code.includes('probeAudioDuration')) {
  const routeMarker = "app.post('/generate'"
  const routeIdx = code.indexOf(routeMarker)
  if (routeIdx > -1) {
    const probe = `
// Probe real audio duration using ffmpeg (instead of buffer-size guessing)
function probeAudioDuration(audioPath) {
  return new Promise((resolve) => {
    execFile('ffmpeg', ['-i', audioPath, '-f', 'null', '-'], { timeout: 10000 }, (_err, _stdout, stderr) => {
      const match = stderr.match(/Duration: (\\d+):(\\d+):(\\d+)\\.(\\d+)/)
      if (match) {
        const h = parseInt(match[1])
        const m = parseInt(match[2])
        const s = parseInt(match[3])
        const ms = parseInt(match[4]) * 10
        resolve(h * 3600 + m * 60 + s + ms / 1000)
      } else {
        resolve(0) // caller uses fallback
      }
    })
  })
}

`
    code = code.slice(0, routeIdx) + probe + code.slice(routeIdx)
    console.log('1. Added probeAudioDuration function')
    changes++
  } else {
    console.log('1. WARNING: Could not find /generate route marker')
  }
} else {
  console.log('1. probeAudioDuration already exists')
}

// 2. Ensure execFile is imported
if (!code.includes("execFile") || !code.includes("require('child_process')")) {
  if (code.includes("const { join }")) {
    code = code.replace(
      "const { join }",
      "const { execFile } = require('child_process')\nconst { join }"
    )
    console.log('2. Added execFile import')
    changes++
  } else {
    console.log('2. WARNING: Could not find join import to add execFile')
  }
} else {
  console.log('2. execFile already imported')
}

// 3. Replace -shortest with explicit -t duration in clip assembly
// Look for the pattern where clips are created with -shortest
// Handle both the adelay variant and the plain variant

// Pattern A: with adelay (from vps-fix-padding.js)
const shortestWithDelay = "'-af', 'adelay=300|300', '-shortest'"
if (code.includes(shortestWithDelay)) {
  // Need to replace the entire clip assembly block to use probed duration
  // Find the block that creates clips with audio
  const clipBlockOld = `      if (audioBuffers[i] && audioBuffers[i].length > 100) {
        // Add 0.3s delay before audio starts to prevent clipping
        await runFfmpeg(['-loop', '1', '-i', slidePath, '-i', audioPath, '-c:v', 'libx264', '-tune', 'stillimage', '-c:a', 'aac', '-b:a', '192k', '-pix_fmt', 'yuv420p', '-vf', vf, '-af', 'adelay=300|300', '-shortest', '-y', clipPath])`

  const clipBlockNew = `      if (audioBuffers[i] && audioBuffers[i].length > 100) {
        // Probe real audio duration for precise slide timing
        const realDur = await probeAudioDuration(audioPath)
        const clipDur = realDur > 0 ? realDur + 0.8 : Math.ceil(audioBuffers[i].length / 16000) + 1
        console.log(\`[\${videoId}] Slide \${i + 1}: audio=\${realDur.toFixed(1)}s, clip=\${clipDur.toFixed(1)}s\`)
        await runFfmpeg(['-loop', '1', '-i', slidePath, '-i', audioPath, '-c:v', 'libx264', '-tune', 'stillimage', '-c:a', 'aac', '-b:a', '192k', '-pix_fmt', 'yuv420p', '-vf', vf, '-t', String(clipDur), '-y', clipPath])`

  if (code.includes(clipBlockOld)) {
    code = code.replace(clipBlockOld, clipBlockNew)
    console.log('3a. Replaced -shortest+adelay with probed -t duration')
    changes++
  } else {
    console.log('3a. WARNING: Could not find adelay clip block exactly')
  }
} else {
  console.log('3a. No adelay variant found, checking plain -shortest')
}

// Pattern B: plain -shortest without adelay
const shortestPlain = "'-shortest', '-y', clipPath"
if (code.includes(shortestPlain)) {
  // Find the whole if block for audio clips
  const plainOld = `      if (audioBuffers[i] && audioBuffers[i].length > 100) {
        await runFfmpeg(['-loop', '1', '-i', slidePath, '-i', audioPath, '-c:v', 'libx264', '-tune', 'stillimage', '-c:a', 'aac', '-b:a', '192k', '-pix_fmt', 'yuv420p', '-vf', vf, '-shortest', '-y', clipPath])`

  const plainNew = `      if (audioBuffers[i] && audioBuffers[i].length > 100) {
        // Probe real audio duration for precise slide timing
        const realDur = await probeAudioDuration(audioPath)
        const clipDur = realDur > 0 ? realDur + 0.8 : Math.ceil(audioBuffers[i].length / 16000) + 1
        console.log(\`[\${videoId}] Slide \${i + 1}: audio=\${realDur.toFixed(1)}s, clip=\${clipDur.toFixed(1)}s\`)
        await runFfmpeg(['-loop', '1', '-i', slidePath, '-i', audioPath, '-c:v', 'libx264', '-tune', 'stillimage', '-c:a', 'aac', '-b:a', '192k', '-pix_fmt', 'yuv420p', '-vf', vf, '-t', String(clipDur), '-y', clipPath])`

  if (code.includes(plainOld)) {
    code = code.replace(plainOld, plainNew)
    console.log('3b. Replaced plain -shortest with probed -t duration')
    changes++
  } else {
    // Try a more flexible replacement — just swap -shortest for -t with duration
    // This handles any formatting variant
    console.log('3b. Exact plain block not found, trying flexible replacement')
  }
}

// Pattern C: If neither exact block matched, do a surgical swap of just the flag
if (code.includes("'-shortest'")) {
  // Count remaining instances
  const count = (code.match(/'-shortest'/g) || []).length
  console.log(`3c. Found ${count} remaining -shortest flag(s), replacing with -t duration approach`)

  // For each remaining -shortest, we need to add probing before the runFfmpeg call
  // This is trickier — let's replace the flag and add duration calculation inline
  // Replace: '-shortest', '-y', clipPath
  // With: '-t', String(clipDur), '-y', clipPath
  // But we also need clipDur to be defined — look for the surrounding context

  // If probeAudioDuration was added but the block replacement failed,
  // do a simpler fix: just add duration probing before each runFfmpeg with -shortest
  code = code.replace(
    /(\s+)(await runFfmpeg\(\[.*?)'-shortest'(.*?clipPath\]\))/g,
    `$1const realDur = await probeAudioDuration(audioPath)\n$1const clipDur = realDur > 0 ? realDur + 0.8 : Math.ceil(audioBuffers[i].length / 16000) + 1\n$1$2'-t', String(clipDur)$3`
  )
  changes++
  console.log('3c. Applied regex replacement for remaining -shortest flags')
}

// 4. Verify no -shortest remains
const remaining = (code.match(/'-shortest'/g) || []).length
if (remaining > 0) {
  console.log(`WARNING: ${remaining} -shortest flag(s) still remain!`)
} else {
  console.log('4. Verified: no -shortest flags remain')
}

// 5. Add array length validation before clip assembly
if (!code.includes('Audio-slide count mismatch')) {
  const clipLoopMarker = '    // Create clips'
  if (code.includes(clipLoopMarker)) {
    const validation = `    // Validate audio-slide pairing
    if (audioBuffers.length !== slideBuffers.length) {
      console.warn(\`[\${videoId}] Audio-slide count mismatch: \${audioBuffers.length} audio vs \${slideBuffers.length} slides\`)
      // Pad audio array with empty buffers to prevent index misalignment
      while (audioBuffers.length < slideBuffers.length) {
        audioBuffers.push(Buffer.alloc(0))
      }
      // Trim excess audio if somehow more than slides
      if (audioBuffers.length > slideBuffers.length) {
        audioBuffers.length = slideBuffers.length
      }
    }

`
    code = code.replace(clipLoopMarker, validation + clipLoopMarker)
    console.log('5. Added audio-slide array length validation')
    changes++
  } else {
    console.log('5. WARNING: Could not find "// Create clips" marker')
  }
} else {
  console.log('5. Array validation already exists')
}

if (changes > 0) {
  fs.writeFileSync(path, code, 'utf8')
  console.log(`\nDone! Applied ${changes} fixes. Restart: docker restart docs2video-service`)
} else {
  console.log('\nNo changes applied — check warnings above')
}
