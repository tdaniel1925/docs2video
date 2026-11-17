// Check frames for a how-to film before the full render: bundles
// src/howto-entry.tsx once and renders a few stills (one at a time).
//   node scripts/svfilm-stills.mjs SvCourse7 out/svc7-stills 1020,1845,6000
import { bundle } from '@remotion/bundler'
import { renderStill, selectComposition } from '@remotion/renderer'
import { mkdirSync } from 'fs'
import { join, resolve } from 'path'
const [id, outDir, list] = process.argv.slice(2)
mkdirSync(outDir, { recursive: true })
const serveUrl = await bundle({ entryPoint: resolve('src/howto-entry.tsx'), publicDir: resolve('public') })
const composition = await selectComposition({ serveUrl, id })
console.log(id, composition.durationInFrames, 'frames', (composition.durationInFrames / composition.fps).toFixed(1) + 's')
for (const f of list.split(',').map(Number)) {
  await renderStill({ serveUrl, composition, frame: Math.min(f, composition.durationInFrames - 1), output: join(outDir, `f${String(f).padStart(5, '0')}.jpg`), imageFormat: 'jpeg', jpegQuality: 80 })
  console.log('still', f)
}
