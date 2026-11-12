// Stills of a WalkthroughVideo from a props file, as one contact sheet.
//   node scripts/walk-stills.mjs <props.json> <outDir> 3 9 ...   (seconds; "auto" = 2 per scene)
import { bundle } from '@remotion/bundler'
import { renderStill, selectComposition } from '@remotion/renderer'
import { execFileSync } from 'child_process'
import { mkdirSync, readFileSync } from 'fs'
import { resolve, join } from 'path'
const [propsFile, out, ...secs] = process.argv.slice(2); mkdirSync(out, { recursive: true })
const inputProps = JSON.parse(readFileSync(propsFile, 'utf8'))
const serveUrl = await bundle({ entryPoint: resolve('src/walk-entry.tsx'), publicDir: resolve('public') })
const composition = await selectComposition({ serveUrl, id: 'WalkthroughVideo', inputProps })
const tl = composition.props.timeline
let frames = secs.map((t) => Math.round(Number(t) * 30))
if (secs[0] === 'auto') frames = tl.starts.flatMap((a, i) => [a + Math.round(tl.lens[i] * 0.3), a + Math.round(tl.lens[i] * 0.85)])
console.log('frames', composition.durationInFrames, 'stills', frames.length)
for (const [i, fr] of frames.entries()) {
  await renderStill({ serveUrl, composition, inputProps, frame: Math.min(composition.durationInFrames - 1, fr), output: join(out, `st-${String(i).padStart(2, '0')}.jpg`), imageFormat: 'jpeg', jpegQuality: 80 })
}
const cols = 4, rows = Math.ceil(frames.length / cols)
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', join(out, 'st-%02d.jpg'), '-vf', `scale=480:-2,tile=${cols}x${rows}`, '-frames:v', '1', join(out, 'sheet.jpg')])
console.log('sheet', join(out, 'sheet.jpg'))
