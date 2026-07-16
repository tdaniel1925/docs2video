/**
 * Frame-review tool: extract N evenly-spaced frames from a rendered MP4 so the
 * motion can be VERIFIED by eye (is the camera actually moving, or frozen?).
 * Closes the feedback loop — render → look at frames → catch dead motion myself.
 * Run: npx tsx scripts/review-frames.ts <video.mp4> <startSec> <endSec> [count]
 */
import { execFileSync } from 'child_process'
import { mkdirSync, rmSync } from 'fs'
import { join } from 'path'

const [, , video, startS = '0', endS = '5', countS = '6'] = process.argv
const start = parseFloat(startS), end = parseFloat(endS), count = parseInt(countS)
const OUT = join(__dirname, '..', 'remotion', 'out', 'frames')
rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true })

for (let i = 0; i < count; i++) {
  const t = start + (end - start) * (i / (count - 1))
  const file = join(OUT, `f${String(i).padStart(2, '0')}_${t.toFixed(2)}s.png`)
  execFileSync('ffmpeg', ['-y', '-ss', String(t), '-i', video, '-frames:v', '1', '-vf', 'scale=640:-1', file], { stdio: 'ignore' })
  console.log(`frame ${i}: ${t.toFixed(2)}s`)
}
console.log(`\nframes in: ${OUT}`)
