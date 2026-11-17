// Renders a how-to film master in segments, so a stopped render costs one
// segment and not the whole film.
//   node scripts/svfilm-render.mjs SvCourse7 out/training/course-7-master.mp4 [framesPerSegment]
// Bundles src/howto-entry.tsx once. Picture: each frame range is rendered muted
// (h264, same settings) to <out>.parts/seg-NN.mp4; a finished segment with the
// right frame count is kept on a re-run. Sound: the whole mix is rendered once
// to a WAV. Then the segments are joined without re-encoding and the WAV is
// added as AAC. Before every segment free RAM must be 4 GB or more (waits up to
// 20 minutes, then stops). Concurrency 1, offthread video cache 1 GB.
// The join is verified: frame count, and the audio length against the picture.
import { bundle } from '@remotion/bundler'
import { renderMedia, selectComposition } from '@remotion/renderer'
import { execFileSync } from 'child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { freemem } from 'os'
import { join, resolve } from 'path'
const [id, out, perArg] = process.argv.slice(2)
const PER = Number(perArg || 1200)
const parts = out + '.parts'
mkdirSync(parts, { recursive: true })
const GB = 1024 ** 3
const frameCount = (f) => parseInt(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-count_packets', '-show_entries', 'stream=nb_read_packets', '-of', 'csv=p=0', f]).toString().trim(), 10)
const durOf = (f, s) => parseFloat(execFileSync('ffprobe', ['-v', 'error', '-select_streams', s, '-show_entries', 'stream=duration', '-of', 'csv=p=0', f]).toString().trim())
async function roomToRender(label) {
  for (let i = 0; i <= 40; i++) {
    const free = freemem() / GB
    if (free >= 4) { console.log(`${label}: ${free.toFixed(1)} GB free, starting`); return }
    if (i === 40) { console.log(`${label}: only ${free.toFixed(1)} GB free after 20 minutes. Stopping; finished segments are kept.`); process.exit(3) }
    if (i % 4 === 0) console.log(`${label}: ${free.toFixed(1)} GB free, waiting`)
    await new Promise((r) => setTimeout(r, 30000))
  }
}
const serveUrl = await bundle({ entryPoint: resolve('src/howto-entry.tsx'), publicDir: resolve('public') })
try {
  const composition = await selectComposition({ serveUrl, id })
  const N = composition.durationInFrames
  const common = { serveUrl, composition, concurrency: 1, offthreadVideoCacheSizeInBytes: GB, logLevel: 'error' }
  const segs = []
  for (let a = 0, k = 0; a < N; a += PER, k++) segs.push({ a, b: Math.min(N, a + PER) - 1, file: join(parts, `seg-${String(k).padStart(2, '0')}.mp4`) })
  console.log(`${id}: ${N} frames in ${segs.length} segments`)
  for (const s of segs) {
    const want = s.b - s.a + 1
    if (existsSync(s.file) && frameCount(s.file) === want) { console.log(`kept ${s.file}`); continue }
    await roomToRender(`frames ${s.a}-${s.b}`)
    await renderMedia({ ...common, codec: 'h264', imageFormat: 'jpeg', frameRange: [s.a, s.b], muted: true, outputLocation: s.file })
    const got = frameCount(s.file)
    if (got !== want) throw new Error(`${s.file}: ${got} frames, expected ${want}`)
    console.log(`done ${s.file} (${got} frames)`)
  }
  const wav = join(parts, 'mix.wav')
  await roomToRender('sound')
  await renderMedia({ ...common, codec: 'wav', outputLocation: wav })
  const list = join(parts, 'list.txt')
  writeFileSync(list, segs.map((s) => `file '${resolve(s.file).replace(/\\/g, '/')}'`).join('\n'))
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-movflags', '+faststart', out])
  const got = frameCount(out), v = durOf(out, 'v:0'), a = durOf(out, 'a:0')
  console.log(`joined ${out}: ${got} frames (expected ${N}), picture ${v.toFixed(3)}s, sound ${a.toFixed(3)}s, wav ${durOf(wav, 'a:0').toFixed(3)}s`)
  if (got !== N || Math.abs(v - N / composition.fps) > 0.05 || Math.abs(a - v) > 0.08) throw new Error('join check failed')
  console.log('join check passed')
} finally {
  try { rmSync(serveUrl, { recursive: true, force: true }) } catch { /* temp bundle */ }
}
