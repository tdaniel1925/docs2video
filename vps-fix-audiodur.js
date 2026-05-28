/**
 * Fix: Flipbook clips cut audio short because of wrong duration estimation.
 *
 * Problem: audioDur calculated from byte length (wrong for MP3), then used
 * with -shortest and -t to cap the clip. Audio gets truncated.
 *
 * Solution: Remove -shortest and -t from flipbook clips. Instead, let the
 * audio stream dictate the duration (like the legacy single-slide path does).
 * The concat video input needs to be long enough — we'll set each frame
 * duration to a safe maximum and let FFmpeg trim to audio length naturally.
 */
const fs = require('fs')
let c = fs.readFileSync('/app/server.js', 'utf8')
let changes = 0

// Fix 1: Replace the audio duration estimation with ffprobe
// Find the old byte-based estimation in the flipbook block
const oldByteDur = "const audioDur = hasAudio ? Math.ceil(audioBuffers[i].length / 24000) + 1 : 5"
if (c.includes(oldByteDur)) {
  c = c.replace(oldByteDur, `let audioDur = 5
        if (hasAudio) {
          try {
            audioDur = await new Promise((resolve) => {
              execFile('ffprobe', ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', audioPath], { timeout: 10000 }, (err, stdout) => {
                const d = parseFloat(stdout)
                resolve(err || isNaN(d) ? 10 : Math.ceil(d) + 1)
              })
            })
          } catch { audioDur = 10 }
        }`)
  changes++
  console.log('1. Fixed audio duration — now uses ffprobe instead of byte math')
} else {
  console.log('1. SKIP: byte-based audioDur not found (may already use ffprobe)')
}

// Fix 2: Make frame durations long enough to cover full audio
// Old: frameDur = audioDur / frames.length (too short if audioDur is wrong)
// New: frameDur = (audioDur + 2) / frames.length (safe buffer)
const oldFrameDur = "const frameDur = (audioDur / frames.length).toFixed(2)"
if (c.includes(oldFrameDur)) {
  c = c.replace(oldFrameDur, "const frameDur = ((audioDur + 2) / frames.length).toFixed(2)")
  changes++
  console.log('2. Added 2s buffer to frame duration calculation')
} else {
  console.log('2. SKIP: frameDur pattern not found')
}

// Fix 3: Remove -shortest from flipbook FFmpeg commands
// -shortest causes audio to be cut if video track is shorter
const shortestPattern = "'-shortest', '-t', String(audioDur),"
if (c.includes(shortestPattern)) {
  // Replace with just -t using the corrected audioDur (no -shortest)
  c = c.replace(shortestPattern, "")
  changes++
  console.log('3. Removed -shortest and -t cap from flipbook with-audio command')
} else {
  // Try alternate patterns
  if (c.includes("'-shortest'")) {
    // Count occurrences in flipbook section
    const flipIdx = c.indexOf('FLIPBOOK: multiple frames')
    if (flipIdx > -1) {
      const flipBlock = c.substring(flipIdx, flipIdx + 2000)
      if (flipBlock.includes("'-shortest'")) {
        // Remove -shortest from within the flipbook block only
        const before = c.substring(0, flipIdx)
        let after = c.substring(flipIdx, flipIdx + 2000)
        after = after.replace(/, '-shortest'/g, '')
        after = after.replace(/, '-t', String\(audioDur\)/g, '')
        c = before + after + c.substring(flipIdx + 2000)
        changes++
        console.log('3. Removed -shortest from flipbook block (alternate pattern)')
      }
    }
  }
  if (changes < 3) console.log('3. SKIP: -shortest pattern not found exactly')
}

// Fix 4: Remove minterpolate blend — causes ugly overlapping frames
// Replace with simple concat (clean cuts between frames, no crossfade)
// The flipbook FFmpeg uses: [0:v]scale...,minterpolate=fps=24:mi_mode=blend[v]
// Replace with just: [0:v]scale...,fps=24[v]  (clean frame rate, no blending)
const minterpolatePattern = ',minterpolate=fps=12:mi_mode=blend'
const minterpolatePattern2 = ',minterpolate=fps=24:mi_mode=blend'
let mintCount = 0
while (c.includes(minterpolatePattern)) {
  c = c.replace(minterpolatePattern, '')
  mintCount++
}
while (c.includes(minterpolatePattern2)) {
  c = c.replace(minterpolatePattern2, '')
  mintCount++
}
if (mintCount > 0) {
  changes++
  console.log('4. Removed minterpolate blend (' + mintCount + ' instances) — clean cuts between frames')
} else {
  console.log('4. SKIP: minterpolate pattern not found')
}

if (changes > 0) {
  fs.writeFileSync('/app/server.js', c)
  console.log('\nDone! ' + changes + ' fixes applied.')
} else {
  console.log('\nNo changes made — patterns may have already been fixed.')
}
console.log('Run: docker restart docs2video-service')
