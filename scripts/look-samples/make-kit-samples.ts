// =============================================================================
// SCENE KIT SAMPLE VIDEOS — the quality gate for the new engine.
//
//   npx jiti scripts/look-samples/make-kit-samples.ts [--only=<video id>] [--no-audio-check] [--stills-only]
//
// Renders, LOCALLY, three full videos with the real production code path:
//   plan:   .shots/kit/plans/<story>.json — written by kit-plan-try.ts with
//           the REAL Claude planner (run that first)
//   voice:  render-service/slides.js ttsTimed (ElevenLabs, word timings),
//           cached in .shots/kit/vo-cache so re-runs cost nothing
//   prep:   render-service/kit.js prepareKitPlan (what /generate-kit runs)
//   render: KitVideo, files served from a local web server as `assetBase`
//           (the Lambda path), so nothing is written into remotion/public
//
//   insurance × animated-slides · insurance × editorial · bakery × bright
//
// Outputs in .shots/kit/:
//   <id>.mp4                 the full video
//   <id>-sheet.png           one settled frame per scene
//   <id>-motion.png          three frames inside each scene (proves nothing freezes)
//   short-<id>.mp4           ~18-second cuts (two of them)
//   kit-numbers.json         loudness + music levels + timing per video
// and the step-3 card pictures public/style-samples/kit-<look>-{cover,data,closing}.png
// =============================================================================

import fs from 'fs'
import path from 'path'
import http from 'http'
import crypto from 'crypto'
import { execFileSync, spawnSync } from 'child_process'
import { createRequire } from 'module'
import type { KitPlan, KitScene, Look } from '../../remotion/src/kit/spec'
import { KIT_LOOKS } from '../../remotion/src/kit/spec'
import { assembleKitPlan } from '../../app/_lib/kit-engine'
import { KIT_STORY_BAKERY, KIT_STORY_INSURANCE, type KitSampleStory } from './kit-stories'
// @ts-expect-error — plain ESM helper
import { contactSheet } from './kit-sheet.mjs'

const ROOT = path.resolve(__dirname, '..', '..')
const REMOTION_DIR = path.join(ROOT, 'remotion')
const OUT = path.join(ROOT, '.shots', 'kit')
const WORK = path.join(OUT, 'work')
const VO_CACHE = path.join(OUT, 'vo-cache')
const FIX = path.join(REMOTION_DIR, 'qa-public', 'kit-qa')
const reqRemotion = createRequire(path.join(REMOTION_DIR, 'package.json'))
const reqRoot = createRequire(path.join(ROOT, 'package.json'))

for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
  if (m && /^(ELEVENLABS_|OPENAI_API_KEY)/.test(m[1]) && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const slides: any = reqRoot(path.join(ROOT, 'render-service/slides.js'))
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const kit: any = reqRoot(path.join(ROOT, 'render-service/kit.js'))
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mix: any = reqRoot(path.join(ROOT, 'render-service/audio-mix.js'))

const sh = (bin: string, args: string[]) => execFileSync(bin, args, { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1e8 }).toString()
const ffLog = (args: string[]) => String(spawnSync('ffmpeg', args, { maxBuffer: 1e8 }).stderr || '')
const dur = (f: string) => parseFloat(sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).trim())
const lufs = (f: string) => { const m = ffLog(['-nostats', '-i', f, '-map', '0:a:0', '-af', 'ebur128', '-f', 'null', '-']).match(/I:\s+(-?[\d.]+) LUFS/g); return m ? parseFloat(m[m.length - 1].split(/\s+/)[1]) : NaN }
const rmsAt = (f: string, ss: number, t: number) => { const m = ffLog(['-nostats', '-ss', ss.toFixed(3), '-t', t.toFixed(3), '-i', f, '-map', '0:a:0', '-af', 'volumedetect', '-f', 'null', '-']).match(/mean_volume:\s*(-?[\d.]+)/); return m ? parseFloat(m[1]) : NaN }
const avg = (a: number[]) => { const b = a.filter(Number.isFinite); return b.reduce((s, v) => s + v, 0) / Math.max(1, b.length) }

type Job = { id: string; story: KitSampleStory; look: Look; withLogo: boolean }
const JOBS: Job[] = [
  { id: 'insurance-animated-slides', story: KIT_STORY_INSURANCE, look: KIT_LOOKS['animated-slides'], withLogo: true },
  { id: 'insurance-editorial', story: KIT_STORY_INSURANCE, look: KIT_LOOKS.editorial, withLogo: true },
  { id: 'bakery-bright', story: KIT_STORY_BAKERY, look: KIT_LOOKS.bright, withLogo: false },
]

// Voice, cached by text: same story in two looks = one set of voice calls.
// The real services first (ElevenLabs, then OpenAI — slides.ttsTimed). When
// both refuse (2026-10-09: ElevenLabs "payment_required", OpenAI "no credits"),
// Windows' built-in voice reads the line instead, free, with word timings
// estimated from the text (the same estimate the OpenAI path uses).
let paidVoiceDown = process.env.KIT_SAMPLE_VOICE === 'sapi'
function sapiTimed(text: string, mp3: string) {
  const wav = mp3.replace(/\.mp3$/, '.wav')
  const spoken = slides.speakable(text) as string
  const esc = spoken.replace(/'/g, "''")
  execFileSync('powershell', ['-NoProfile', '-Command', `Add-Type -AssemblyName System.Speech; $s=New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.SelectVoiceByHints('Female'); $s.Rate=0; $s.SetOutputToWaveFile('${wav}'); $s.Speak('${esc}'); $s.Dispose()`])
  // trim the synthesizer's lead-in/out silence, and shorten its long
  // between-sentence pauses (~0.9s, which preflight rightly fails) to ~0.45s
  const trimmed = wav.replace(/\.wav$/, '.t.wav')
  sh('ffmpeg', ['-v', 'error', '-y', '-i', wav, '-af', 'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse', trimmed])
  // every pause longer than 0.5s → 0.45s (kept as 0.225s each side of the cut)
  const log = ffLog(['-nostats', '-i', trimmed, '-af', 'silencedetect=noise=-40dB:d=0.5', '-f', 'null', '-'])
  const ends = [...log.matchAll(/silence_end:\s*([\d.]+)\s*\|\s*silence_duration:\s*([\d.]+)/g)].map((m) => [parseFloat(m[1]) - parseFloat(m[2]), parseFloat(m[1])])
  const total = dur(trimmed)
  const keep: [number, number][] = []
  let t = 0
  for (const [a, b] of ends) { keep.push([t, a + 0.225]); t = b - 0.225 }
  keep.push([t, total])
  const filt = keep.map(([a, b], i) => `[0:a]atrim=${a.toFixed(3)}:${b.toFixed(3)},asetpts=PTS-STARTPTS[s${i}]`).join(';') + ';' + keep.map((_, i) => `[s${i}]`).join('') + `concat=n=${keep.length}:v=0:a=1[o]`
  sh('ffmpeg', ['-v', 'error', '-y', '-i', trimmed, '-filter_complex', filt, '-map', '[o]', '-ar', '44100', '-ac', '1', '-b:a', '160k', mp3])
  fs.rmSync(wav, { force: true }); fs.rmSync(trimmed, { force: true })
  const durationSec = dur(mp3)
  return { words: slides.estimateWordTimings(spoken, durationSec), durationSec, voice: 'windows-sapi' }
}
async function cachedTts(text: string, outPath: string) {
  fs.mkdirSync(VO_CACHE, { recursive: true })
  const key = crypto.createHash('sha1').update(`nova|${text}`).digest('hex').slice(0, 16)
  const mp3 = path.join(VO_CACHE, `${key}.mp3`), meta = path.join(VO_CACHE, `${key}.json`)
  if (!fs.existsSync(mp3) || !fs.existsSync(meta)) {
    let timed
    if (!paidVoiceDown) {
      try { timed = await slides.ttsTimed(text, mp3, 'nova') } catch (e) {
        paidVoiceDown = true
        console.warn(`  voice services refused (${String((e as Error).message).slice(0, 90)}) — using the built-in Windows voice for the samples`)
      }
    }
    if (!timed) timed = sapiTimed(text, mp3)
    fs.writeFileSync(meta, JSON.stringify(timed))
  }
  fs.copyFileSync(mp3, outPath)
  return JSON.parse(fs.readFileSync(meta, 'utf8'))
}

function serve(dir: string): Promise<{ url: string; close: () => void }> {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const f = path.join(dir, decodeURIComponent((req.url || '/').split('?')[0]).replace(/^\/+/, ''))
      res.setHeader('Access-Control-Allow-Origin', '*')
      if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.statusCode = 404; return res.end() }
      const stat = fs.statSync(f)
      const type = f.endsWith('.mp3') ? 'audio/mpeg' : f.endsWith('.png') ? 'image/png' : f.endsWith('.wav') ? 'audio/wav' : 'application/octet-stream'
      const range = req.headers.range
      if (range) {
        const [a, b] = range.replace('bytes=', '').split('-')
        const start = parseInt(a, 10), end = b ? parseInt(b, 10) : stat.size - 1
        res.writeHead(206, { 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, 'Content-Type': type })
        return fs.createReadStream(f, { start, end }).pipe(res)
      }
      res.writeHead(200, { 'Content-Length': stat.size, 'Content-Type': type, 'Accept-Ranges': 'bytes' })
      fs.createReadStream(f).pipe(res)
    })
    srv.listen(0, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${(srv.address() as { port: number }).port}`, close: () => srv.close() }))
  })
}

async function prepare(job: Job): Promise<{ plan: KitPlan; timeline: { starts: number[]; durations: number[]; voFrames: number[]; cut: number; total: number }; dirName: string }> {
  const planned = JSON.parse(fs.readFileSync(path.join(OUT, 'plans', `${job.story.id}.json`), 'utf8')) as { scenes: KitScene[] }
  const s = job.story
  const base = assembleKitPlan({
    title: s.beats[0].title, scenes: planned.scenes, look: job.look, brandName: s.brandName,
    presenter: s.presenter || null, photo: { cover: true, closing: true }, recipient: s.recipient, regulated: s.regulated,
  })
  const prepared = await kit.prepareKitPlan({
    pub: WORK, videoId: job.id, plan: base,
    assets: job.withLogo ? { logo_light: path.join(FIX, 'logo-light.png'), logo_dark: path.join(FIX, 'logo-dark.png'), presenter_photo: s.presenter ? path.join(FIX, 'presenter.png') : undefined } : {},
    voiceId: 'nova', music: {},
    deps: {
      ttsTimed: (text: string, outPath: string) => cachedTts(text, outPath),
      tts: (fn: () => Promise<unknown>) => fn(),
      fetchTo: async (src: string, out: string) => { fs.copyFileSync(src, out) },
      audioDurationSec: slides.audioDurationSec,
      normalize: kit.normalizeVoice,
    },
    log: (m: string) => console.log(`  [${job.id}] ${m}`),
  })
  return { plan: prepared.plan, timeline: prepared.timeline, dirName: prepared.dirName }
}

/** The same plan with one part of the sound swapped for silence (to measure each part alone). */
function stemPlan(plan: KitPlan, which: 'voice' | 'bed', dirName: string): KitPlan {
  const p = JSON.parse(JSON.stringify(plan)) as KitPlan
  p.audio = { ...(p.audio || {}), sfx: 'off' }
  if (which === 'voice') {
    const silent = path.join(WORK, dirName, 'silent-music.mp3')
    if (!fs.existsSync(silent)) sh('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-t', '20', '-b:a', '64k', silent])
    p.audio.music = `${dirName}/silent-music.mp3`
  } else {
    for (const s of p.scenes) {
      const src = path.join(WORK, String(s.vo))
      const out = src.replace(/\.mp3$/, '.silent.mp3')
      if (!fs.existsSync(out)) sh('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', dur(src).toFixed(3), '-b:a', '64k', out])
      s.vo = path.relative(WORK, out).replace(/\\/g, '/')
    }
  }
  return p
}

async function main() {
  const args = process.argv.slice(2)
  const only = (args.find((a) => a.startsWith('--only=')) || '').slice(7)
  const audioCheck = !args.includes('--no-audio-check')
  const stillsOnly = args.includes('--stills-only')
  fs.mkdirSync(WORK, { recursive: true })
  const assets = await serve(WORK)
  const { bundle } = reqRemotion('@remotion/bundler')
  const { selectComposition, renderMedia, renderStill } = reqRemotion('@remotion/renderer')
  console.log('Bundling remotion…')
  const serveUrl = await bundle({ entryPoint: path.join(REMOTION_DIR, 'src', 'index.ts'), publicDir: path.join(REMOTION_DIR, 'public'), enableCaching: false })
  const numbers: Record<string, unknown>[] = fs.existsSync(path.join(OUT, 'kit-numbers.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'kit-numbers.json'), 'utf8')) : []

  for (const job of JOBS.filter((j) => !only || j.id === only)) {
    console.log(`\n== ${job.id}`)
    const { plan, timeline, dirName } = await prepare(job)
    const props = { plan, assetBase: assets.url }
    const composition = await selectComposition({ serveUrl, id: 'KitVideo', inputProps: props })
    const tl = composition.props.timeline as typeof timeline
    const mp4 = path.join(OUT, `${job.id}.mp4`)
    if (!stillsOnly) {
      const t0 = Date.now()
      await renderMedia({ composition, serveUrl, codec: 'h264', crf: 20, outputLocation: mp4, inputProps: props, chromiumOptions: { gl: 'swiftshader' }, concurrency: 6, onProgress: ({ progress }: { progress: number }) => { if (Math.round(progress * 100) % 25 === 0) process.stdout.write(` ${Math.round(progress * 100)}%`) } })
      console.log(`\n  rendered ${(composition.durationInFrames / 30).toFixed(1)}s in ${((Date.now() - t0) / 1000).toFixed(0)}s`)
    }

    // One settled frame per scene + three frames inside each (alive check).
    const stills: string[] = [], motion: string[] = []
    for (let i = 0; i < plan.scenes.length; i++) {
      const a = tl.starts[i], d = tl.durations[i]
      // the scene complete: every item has arrived, just before the cut out
      const settled = a + d - tl.cut - 6
      const f = path.join(WORK, `${job.id}-s${i}.png`)
      await renderStill({ composition, serveUrl, output: f, frame: settled, inputProps: props, imageFormat: 'png', chromiumOptions: { gl: 'swiftshader' } })
      stills.push(f)
      for (const [k, at] of [[0, a + Math.round(tl.cut * 0.5)], [1, a + Math.round(d * 0.35)], [2, a + d - tl.cut - 2]] as const) {
        const g = path.join(WORK, `${job.id}-m${i}-${k}.png`)
        await renderStill({ composition, serveUrl, output: g, frame: Math.min(at, composition.durationInFrames - 1), inputProps: props, imageFormat: 'png', chromiumOptions: { gl: 'swiftshader' }, scale: 0.5 })
        motion.push(g)
      }
    }
    await contactSheet(path.join(OUT, `${job.id}-sheet.png`), stills, 3, 640)
    await contactSheet(path.join(OUT, `${job.id}-motion.png`), motion, 6, 320)

    // Step-3 card pictures from the insurance story (the made-up Rivera family).
    if (job.story.id === 'insurance' || job.id === 'bakery-bright') {
      const sharp = reqRoot('sharp')
      const pick = { cover: plan.scenes.findIndex((s) => s.type === 'title'), data: plan.scenes.findIndex((s) => s.type === 'bignumber'), closing: plan.scenes.findIndex((s) => s.type === 'cta') }
      for (const [kind, idx] of Object.entries(pick)) {
        if (idx < 0) continue
        await sharp(stills[idx]).resize(960, 540).png({ compressionLevel: 9, palette: true, quality: 90 }).toFile(path.join(ROOT, 'public', 'style-samples', `kit-${job.look.id}-${kind}.png`))
      }
    }
    if (stillsOnly) continue

    // Sound: voice alone and music alone (no sound effects), measured the
    // same way as scripts/look-samples/sound-check.ts.
    const row: Record<string, unknown> = { video: job.id, seconds: +(composition.durationInFrames / 30).toFixed(1), scenes: plan.scenes.length, types: plan.scenes.map((s) => s.type).join(' '), mixLUFS: lufs(mp4) }
    if (audioCheck) {
      const outs: Record<string, string> = {}
      for (const which of ['voice', 'bed'] as const) {
        const p2 = { plan: stemPlan(plan, which, dirName), assetBase: assets.url }
        const c2 = await selectComposition({ serveUrl, id: 'KitVideo', inputProps: p2 })
        outs[which] = path.join(WORK, `${job.id}-${which}.mp4`)
        await renderMedia({ composition: c2, serveUrl, codec: 'h264', outputLocation: outs[which], inputProps: p2, scale: 0.25, chromiumOptions: { gl: 'swiftshader' }, concurrency: 6 })
      }
      const det = mix.parseSpeech(ffLog(['-hide_banner', '-nostats', '-i', outs.voice, '-map', '0:a:0', '-af', 'silencedetect=noise=-38dB:d=0.3', '-f', 'null', '-']), dur(outs.voice))
      const segs: [number, number][] = mix.mergeSegments(det)
      const long = segs.filter(([a, b]) => b - a > 1.6)
      const gaps: number[] = []
      for (let i = 1; i < segs.length; i++) { const g = segs[i][0] - segs[i - 1][1]; if (g > 1.0) gaps.push(rmsAt(outs.bed, segs[i - 1][1] + 0.35, g - 0.7)) }
      Object.assign(row, {
        voiceLUFS: lufs(outs.voice),
        voiceRms_dB: +avg(long.map(([a, b]) => rmsAt(outs.voice, a + 0.6, b - a - 1.2))).toFixed(1),
        musicUnderVoice_dB: +avg(long.map(([a, b]) => rmsAt(outs.bed, a + 0.6, b - a - 1.2))).toFixed(1),
        musicBetween_dB: gaps.length ? +avg(gaps).toFixed(1) : null,
        musicCoversEnd: rmsAt(outs.bed, dur(outs.bed) - 3.2, 1.5) > -70,
      })
    }
    console.log('  ', JSON.stringify(row))
    const i = numbers.findIndex((r) => r.video === job.id)
    if (i >= 0) numbers[i] = row; else numbers.push(row)
    fs.writeFileSync(path.join(OUT, `${job.id}-plan.json`), JSON.stringify(plan, null, 1))
  }
  fs.writeFileSync(path.join(OUT, 'kit-numbers.json'), JSON.stringify(numbers, null, 2))

  // Two short cuts for a quick look (the hero number + comparison stretch, and the bakery chart run).
  const cutShort = (src: string, from: number, len: number, out: string) => { if (fs.existsSync(src)) sh('ffmpeg', ['-v', 'error', '-y', '-ss', String(from), '-t', String(len), '-i', src, '-c:v', 'libx264', '-crf', '22', '-preset', 'veryfast', '-c:a', 'aac', '-b:a', '160k', out]) }
  if (!stillsOnly && (!only || only === 'insurance-animated-slides')) cutShort(path.join(OUT, 'insurance-animated-slides.mp4'), 0, 22, path.join(OUT, 'short-insurance-animated-slides.mp4'))
  if (!stillsOnly && (!only || only === 'bakery-bright')) cutShort(path.join(OUT, 'bakery-bright.mp4'), 4, 20, path.join(OUT, 'short-bakery-bright.mp4'))
  assets.close()
  console.table(numbers)
}

main().catch((e) => { console.error(e); process.exit(1) })
