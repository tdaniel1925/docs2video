const fs = require('fs')
let code = fs.readFileSync('/tmp/server.js', 'utf8')

// Add audio padding during clip assembly — add 0.3s delay before audio starts
// This is done in the FFmpeg command, not by modifying audio files

const oldClip = `      if (audioBuffers[i] && audioBuffers[i].length > 100) {
        await runFfmpeg(['-loop', '1', '-i', slidePath, '-i', audioPath, '-c:v', 'libx264', '-tune', 'stillimage', '-c:a', 'aac', '-b:a', '192k', '-pix_fmt', 'yuv420p', '-vf', vf, '-shortest', '-y', clipPath])`

const newClip = `      if (audioBuffers[i] && audioBuffers[i].length > 100) {
        // Add 0.3s delay before audio starts to prevent clipping
        await runFfmpeg(['-loop', '1', '-i', slidePath, '-i', audioPath, '-c:v', 'libx264', '-tune', 'stillimage', '-c:a', 'aac', '-b:a', '192k', '-pix_fmt', 'yuv420p', '-vf', vf, '-af', 'adelay=300|300', '-shortest', '-y', clipPath])`

if (code.includes(oldClip)) {
  code = code.replace(oldClip, newClip)
  console.log('SUCCESS: Added 300ms audio delay to prevent clipping')
} else {
  console.log('ERROR: Could not find clip assembly command')
}

fs.writeFileSync('/tmp/server.js', code, 'utf8')
