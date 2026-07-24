// Presentation → MP4 export (the "video is a derived export" proof).
// 1. Opens the presentation in ?record=1 (no controls, no page audio),
//    drives slide timing from the VO manifest, records the page at 1080p.
// 2. Builds the narration track on the SAME schedule (concat clips + gaps —
//    the proven anti-drift approach) and muxes with h264.
// Usage: node scripts/export-presentation-video.mjs
import { readFileSync, mkdirSync, readdirSync, copyFileSync, rmSync } from 'fs'
import { execFileSync } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { chromium } from 'playwright'
const HERE = dirname(fileURLToPath(import.meta.url))
const OUTDIR = join(HERE, '..', 'out')
const PAGE = 'file:///C:/dev/1%20-%20PrismGraphs/remotion/out/annuity-explainer.html?record=1'
const MANIFEST = JSON.parse(readFileSync(join(OUTDIR, 'annuity-vo-manifest.json'), 'utf8'))
const GAP_MS = 800          // breath between slides after narration ends
const TAIL_MS = 1800        // hold on the final slide
const log = (...a) => console.log('[export]', ...a)

// Per-slide display durations = its narration + the gap (last gets the tail)
const durs = MANIFEST.clips.map((c, i, arr) => c.durMs + (i === arr.length - 1 ? TAIL_MS : GAP_MS))
const totalMs = durs.reduce((a, b) => a + b, 0)
log('slides:', durs.length, '| total:', (totalMs / 1000).toFixed(1) + 's')

// ── 1. Capture ──
const capDir = join(OUTDIR, '.capture'); rmSync(capDir, { recursive: true, force: true }); mkdirSync(capDir, { recursive: true })
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, recordVideo: { dir: capDir, size: { width: 1920, height: 1080 } } })
const page = await ctx.newPage()
const tPageMs = Date.now()
await page.goto(PAGE, { waitUntil: 'networkidle' })
await page.waitForTimeout(900) // fonts + grain settle
const leadMs = Date.now() - tPageMs
await page.evaluate((d) => window.startShow(d), durs)
log('show started · lead ≈', leadMs + 'ms')
await page.waitForTimeout(totalMs + 800)
await page.close(); await ctx.close(); await browser.close()
const webm = join(capDir, readdirSync(capDir).find((f) => f.endsWith('.webm')))
log('captured', webm)

// ── 2. Narration track on the identical schedule ──
// lead silence → clip1 → gap → clip2 → … (concat filter — silence survives)
const inputs = []; const labels = []; const filters = []
inputs.push('-f', 'lavfi', '-t', (leadMs / 1000).toFixed(3), '-i', 'anullsrc=r=44100:cl=stereo')
labels.push('[0:a]')
MANIFEST.clips.forEach((c, i) => {
  inputs.push('-i', c.file)
  filters.push(`[${inputs.filter((x) => x === '-i').length - 1}:a]aresample=44100,pan=stereo|c0=c0|c1=c0[c${i}]`)
  labels.push(`[c${i}]`)
  if (i < MANIFEST.clips.length - 1) {
    inputs.push('-f', 'lavfi', '-t', (GAP_MS / 1000).toFixed(3), '-i', 'anullsrc=r=44100:cl=stereo')
    labels.push(`[${inputs.filter((x) => x === '-i').length - 1}:a]`)
  }
})
const audioWav = join(OUTDIR, '.capture', 'narration.wav')
execFileSync('ffmpeg', ['-y', ...inputs, '-filter_complex',
  `${filters.join(';')};${labels.join('')}concat=n=${labels.length}:v=0:a=1,loudnorm=I=-16:TP=-1.5:LRA=9[out]`,
  '-map', '[out]', audioWav], { stdio: 'pipe' })
log('narration track built')

// ── 3. Mux → MP4 ──
const mp4 = join(OUTDIR, 'annuity-explainer.mp4')
execFileSync('ffmpeg', ['-y', '-i', webm, '-i', audioWav,
  '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
  '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-b:a', '160k', '-shortest', mp4], { stdio: 'pipe' })
const probe = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size', '-of', 'csv=p=0', mp4]).toString().trim()
log('MP4 written:', mp4, '·', probe.split(',').map((x, i) => i === 0 ? (+x).toFixed(1) + 's' : Math.round(x / 1048576) + 'MB').join(' · '))
