// =============================================================================
// SOUND CHECK — render short made-up videos with each engine and MEASURE the
// sound: is the voice at full level, and does the music sit at ~0.20 between
// lines and ~0.08 under the voice?
//
// Engines: Slide Deck (DirectedVideo, music inside Remotion), Aurora/Cinematic
// (V3Video), Infographic, Editorial (music mixed afterwards by the render
// service's audio-mix.js — the same code that ships).
//
// No paid calls. The voice is Windows' built-in speech (made-up lines from
// sample-content.ts); the music is a local track. Per-video files are served
// from a tiny local web server and passed as `assetBase` (the Lambda path), so
// nothing is written into remotion/public.
//
// Run from the repo root (Windows):  npx jiti scripts/look-samples/sound-check.ts
// Output: .shots/sound-fix/<engine>-*.mp4 + frames, and a numbers table.
// =============================================================================

import fs from 'fs'
import path from 'path'
import http from 'http'
import { execFileSync } from 'child_process'
import { createRequire } from 'module'
import { buildPreviewPlan } from '../../app/_lib/first-scene-preview-server'
import type { Brand } from '../../app/_lib/types'
import { SAMPLE_BRAND, SAMPLE_CLIENT, SAMPLE_EXTRACTED, SAMPLE_SCENES } from './sample-content'

const ROOT = path.resolve(__dirname, '..', '..')
const REMOTION_DIR = path.join(ROOT, 'remotion')
const OUT = path.join(ROOT, '.shots', 'sound-fix')
const WORK = path.join(OUT, 'work')
const reqRemotion = createRequire(path.join(REMOTION_DIR, 'package.json'))
const reqRoot = createRequire(path.join(ROOT, 'package.json'))
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mix: any = reqRoot(path.join(ROOT, 'render-service/audio-mix.js'))

const serverSrc = fs.readFileSync(path.join(ROOT, 'render-service/server.js'), 'utf8')
const cut = (from: string, to: string) => serverSrc.slice(serverSrc.indexOf(from), serverSrc.indexOf(to))
const pure = cut('// ==== PURE HELPERS (BEGIN) ====', '// ==== PURE HELPERS (END) ====')
const themeSrc = cut('function guardAccentDark(', "app.post('/render-v3'")
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const H: any = new Function(`${pure}\n${themeSrc}\nreturn { previewDirectedJob, previewV3Job, previewEditorialJob, v3Theme }`)()
const slides = reqRoot(path.join(ROOT, 'render-service/slides.js'))

const now = new Date().toISOString()
const brand: Brand = {
  id: 'sample', user_id: 'sample', name: SAMPLE_BRAND.name,
  logo_url: null, logo_file_url: null, logo_light_url: null, logo_dark_url: null, show_logo: false,
  primary_color: SAMPLE_BRAND.primary_color, secondary_color: SAMPLE_BRAND.secondary_color,
  accent_color: SAMPLE_BRAND.accent_color, background_color: SAMPLE_BRAND.background_color, text_color: SAMPLE_BRAND.text_color,
  tagline: null, description: null, industry: 'insurance', tone: null, target_audience: null,
  fonts: [], brand_values: [], services: [], social_links: {}, content_themes: [], competitor_notes: null,
  unique_selling_points: [], logo_kit: null, reference_slides: null, deck_style_id: null, is_default: true,
  brand_guide_data: { phone: SAMPLE_BRAND.phone, email: SAMPLE_BRAND.email, website: SAMPLE_BRAND.website },
  profile_type: 'company', photo_placement: 'none', created_at: now, updated_at: now,
}
const draft = { scenes: SAMPLE_SCENES, extractedData: SAMPLE_EXTRACTED, recipientName: SAMPLE_CLIENT, brandId: 'sample' }

const sh = (bin: string, args: string[]) => execFileSync(bin, args, { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1e8 }).toString()
const ffErr = (args: string[]) => { try { execFileSync('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1e8 }); return '' } catch (e) { return String((e as { stderr?: Buffer }).stderr || '') } }
const ffLog = (args: string[]) => { const r = require('child_process').spawnSync('ffmpeg', args, { maxBuffer: 1e8 }); return String(r.stderr || '') }
const dur = (f: string) => parseFloat(sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).trim())
const lufs = (f: string) => { const m = ffLog(['-nostats', '-i', f, '-map', '0:a:0', '-af', 'ebur128', '-f', 'null', '-']).match(/I:\s+(-?[\d.]+) LUFS/g); return m ? parseFloat(m[m.length - 1].split(/\s+/)[1]) : NaN }
const rmsAt = (f: string, ss: number, t: number) => { const m = ffLog(['-nostats', '-ss', ss.toFixed(3), '-t', t.toFixed(3), '-i', f, '-map', '0:a:0', '-af', 'volumedetect', '-f', 'null', '-']).match(/mean_volume:\s*(-?[\d.]+)/); return m ? parseFloat(m[1]) : NaN }
const avg = (a: number[]) => a.filter(Number.isFinite).reduce((s, v) => s + v, 0) / Math.max(1, a.filter(Number.isFinite).length)
void ffErr

// ── made-up voice lines (Windows speech) ───────────────────────────────────
function makeVoices(n: number): string[] {
  const lines = SAMPLE_SCENES.map((s) => String(s.narration || s.title)).filter(Boolean)
  const files: string[] = []
  for (let i = 0; i < n; i++) {
    const wav = path.join(WORK, `sapi-${i}.wav`), mp3 = path.join(WORK, `voice-${i}.mp3`)
    if (!fs.existsSync(mp3)) {
      const text = lines[i % lines.length].replace(/'/g, "''").slice(0, 260)
      execFileSync('powershell', ['-NoProfile', '-Command', `Add-Type -AssemblyName System.Speech; $s=New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.SelectVoiceByHints('Female'); $s.SetOutputToWaveFile('${wav}'); $s.Speak('${text}'); $s.Dispose()`])
      // a typical TTS level (-16 LUFS), mono 44.1k like the real voice files
      sh('ffmpeg', ['-v', 'error', '-y', '-i', wav, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '44100', '-ac', '1', '-b:a', '128k', mp3])
    }
    files.push(mp3)
  }
  return files
}
const silentLike = (src: string, out: string) => { if (!fs.existsSync(out)) sh('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', dur(src).toFixed(3), '-b:a', '64k', out]); return out }

// ── local asset server (the Lambda `assetBase` path) ───────────────────────
function serve(dir: string): Promise<{ url: string; close: () => void }> {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const f = path.join(dir, decodeURIComponent((req.url || '/').split('?')[0]).replace(/^\/+/, ''))
      res.setHeader('Access-Control-Allow-Origin', '*')
      if (!f.startsWith(dir) || !fs.existsSync(f)) { res.statusCode = 404; return res.end() }
      const stat = fs.statSync(f)
      const type = f.endsWith('.mp3') ? 'audio/mpeg' : f.endsWith('.png') ? 'image/png' : f.endsWith('.jpg') ? 'image/jpeg' : 'application/octet-stream'
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
    srv.listen(0, '127.0.0.1', () => {
      const port = (srv.address() as { port: number }).port
      resolve({ url: `http://127.0.0.1:${port}`, close: () => srv.close() })
    })
  })
}

type Row = Record<string, string | number>

async function main() {
  fs.mkdirSync(WORK, { recursive: true })
  const only = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  const want = (id: string) => !only.length || only.includes(id)
  const music = path.join(WORK, 'music12.mp3')   // 12 s on purpose: proves the loop
  if (!fs.existsSync(music)) sh('ffmpeg', ['-v', 'error', '-y', '-i', path.join(REMOTION_DIR, 'public', 'ai-music.mp3'), '-t', '12', music])
  const voices = makeVoices(6)
  const assets = await serve(WORK)
  const { bundle } = reqRemotion('@remotion/bundler')
  const { selectComposition, renderMedia, renderStill } = reqRemotion('@remotion/renderer')
  console.log('Bundling remotion…')
  const serveUrl = await bundle({ entryPoint: path.join(REMOTION_DIR, 'src', 'index.ts'), publicDir: path.join(REMOTION_DIR, 'public') })
  const rows: Row[] = []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const render = async (id: string, comp: string, props: any, out: string, stillsFor: (c: any) => { name: string; frame: number }[] = () => []) => {
    const composition = await selectComposition({ serveUrl, id: comp, inputProps: props })
    await renderMedia({ composition, serveUrl, codec: 'h264', outputLocation: out, inputProps: props, scale: 0.25, chromiumOptions: { gl: 'swiftshader' }, concurrency: 4 })
    for (const s of stillsFor(composition)) {
      await renderStill({ composition, serveUrl, output: path.join(OUT, `${id}-${s.name}.png`), frame: Math.min(s.frame, composition.durationInFrames - 1), inputProps: props, imageFormat: 'png', chromiumOptions: { gl: 'swiftshader' }, scale: 0.5 })
    }
    return composition.durationInFrames as number
  }

  // music between/under from a BED-ONLY render, using the voice track's own lines
  const bedLevels = (bedFile: string, voiceFile: string) => {
    const det = mix.parseSpeech(ffLog(['-hide_banner', '-nostats', '-i', voiceFile, '-map', '0:a:0', '-af', 'silencedetect=noise=-38dB:d=0.3', '-f', 'null', '-']), dur(voiceFile))
    const segs: [number, number][] = mix.mergeSegments(det)
    const under = segs.filter(([a, b]) => b - a > 1.6).map(([a, b]) => rmsAt(bedFile, a + 0.6, b - a - 1.2))
    const gaps: number[] = []
    for (let i = 1; i < segs.length; i++) { const g = segs[i][0] - segs[i - 1][1]; if (g > 1.0) gaps.push(rmsAt(bedFile, segs[i - 1][1] + 0.35, g - 0.7)) }
    return { under: +avg(under).toFixed(1), between: gaps.length ? +avg(gaps).toFixed(1) : NaN, voiceRms: +avg(segs.filter(([a, b]) => b - a > 1.6).map(([a, b]) => rmsAt(voiceFile, a + 0.6, b - a - 1.2))).toFixed(1) }
  }

  // ── Slide Deck (DirectedVideo): music is inside Remotion ─────────────────
  if (want('slides')) {
    const plan = buildPreviewPlan({ output: 'video', look: 'slides', draft, brand })!
    const j = H.previewDirectedJob(plan.request, { planFromSuppliedScenes: slides.planFromSuppliedScenes, buildBrandPalette: slides.buildBrandPalette })
    const p = JSON.parse(JSON.stringify(j.props))
    delete p.still; delete p.starts; delete p.total
    p.plan.noSfx = true   // measure the music bed alone (sfx are separate accents)
    const ids: number[] = p.plan.scenes.map((s: { id: number }) => s.id)
    // three asset sets: real (voice + music), voice only (silent music), bed only (silent voice)
    for (const set of ['mix', 'voice', 'bed']) {
      const dir = path.join(WORK, `dir-${set}`); fs.mkdirSync(dir, { recursive: true })
      ids.forEach((id, i) => {
        const v = voices[i % voices.length]
        fs.copyFileSync(set === 'bed' ? silentLike(v, path.join(WORK, `silent-${i % voices.length}.mp3`)) : v, path.join(dir, `dir-vo-${id}.mp3`))
      })
      fs.copyFileSync(set === 'voice' ? silentLike(music, path.join(WORK, 'silent-music.mp3')) : music, path.join(dir, 'dir-music.mp3'))
    }
    const outs: Record<string, string> = {}
    for (const set of ['mix', 'voice', 'bed']) {
      outs[set] = path.join(OUT, `slides-${set}.mp4`)
      await render('slides', 'DirectedVideo', { ...p, assetBase: `${assets.url}/dir-${set}` }, outs[set], set === 'mix' ? (c) => (c.props.starts as number[]).map((st: number, i: number) => ({ name: `scene${i}`, frame: st + 75 })) : () => [])
    }
    const lv = bedLevels(outs.bed, outs.voice)
    // BEFORE: the old bed was the same track at a flat 0.28, never ducked
    const oldBed = path.join(WORK, 'slides-bed-old.wav')
    sh('ffmpeg', ['-v', 'error', '-y', '-stream_loop', '-1', '-i', music, '-filter_complex', `[0:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:${dur(outs.voice)},volume=0.28[o]`, '-map', '[o]', oldBed])
    const lvOld = bedLevels(oldBed, outs.voice)
    rows.push({ engine: 'Slide Deck', voiceLUFS: lufs(outs.voice), afterLUFS: lufs(outs.mix), musicUnder_dB: lv.under, musicBetween_dB: lv.between, musicOld_dB: lvOld.under, voiceRms_dB: lv.voiceRms, musicLooped: `${dur(outs.mix).toFixed(1)}s video / 12s track` })
  }

  // ── V3 (aurora / cinematic), Infographic, Editorial: music mixed afterwards ──
  for (const look of ['aurora', 'cinematic', 'infographic', 'editorial']) {
    if (!want(look)) continue
    const plan = buildPreviewPlan({ output: 'video', look, draft, brand })!
    const isEd = look === 'editorial'
    const j = isEd ? H.previewEditorialJob(plan.request) : H.previewV3Job(plan.request, { v3Theme: H.v3Theme })
    const p = JSON.parse(JSON.stringify(j.props))
    delete p.__preview
    const dir = path.join(WORK, `${look}`); fs.mkdirSync(dir, { recursive: true })
    p.scenes.forEach((s: { audio?: string; durationInFrames: number; image?: string }, i: number) => {
      const v = voices[i % voices.length]
      fs.copyFileSync(v, path.join(dir, `vo-${i}.mp3`))
      s.audio = `vo-${i}.mp3`
      s.durationInFrames = Math.ceil((dur(v) + 0.9) * 30)
      if (look === 'cinematic') s.image = `pexels-${(i % 3) + 1}.jpg`
    })
    if (look === 'cinematic') for (let k = 1; k <= 3; k++) fs.copyFileSync(path.join(REMOTION_DIR, 'public', `pexels-bg-${k}.jpg`), path.join(dir, `pexels-${k}.jpg`))
    p.assetBase = `${assets.url}/${look}`
    const voiceOnly = path.join(OUT, `${look}-voice.mp4`)
    await render(look, j.comp, p, voiceOnly, () => [{ name: 'cover', frame: 60 }, { name: 'content', frame: (isEd ? 0 : 105) + p.scenes[0].durationInFrames + 90 }])
    // AFTER: the shipped mix (audio-mix.js)
    const after = path.join(OUT, `${look}-after.mp4`)
    const r = await mix.mixMusicUnderVoice({ videoIn: voiceOnly, musicPath: music, outPath: after })
    // BEFORE: the old render-v3 / render-editorial filter (amix without normalize=0)
    const before = path.join(OUT, `${look}-before.mp4`)
    const oldVol = isEd ? 0.02 : 0.024
    sh('ffmpeg', ['-v', 'error', '-y', '-i', voiceOnly, '-stream_loop', '-1', '-i', music, '-filter_complex', `[0:a]volume=1.0[n];[1:a]volume=${oldVol},afade=t=in:st=0:d=2[b];[n][b]amix=inputs=2:duration=first:dropout_transition=3[a]`, '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', before])
    // bed alone, same envelope, to read the music level under vs between lines
    const bed = path.join(WORK, `${look}-bed.wav`)
    sh('ffmpeg', ['-v', 'error', '-y', '-stream_loop', '-1', '-i', music, '-filter_complex', `[0:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:${r.duration},asetpts=PTS-STARTPTS,volume='${mix.duckVolumeExpr(r.segments)}':eval=frame[o]`, '-map', '[o]', bed])
    const lv = bedLevels(bed, voiceOnly)
    const oldBed = path.join(WORK, `${look}-bed-old.wav`)
    sh('ffmpeg', ['-v', 'error', '-y', '-stream_loop', '-1', '-i', music, '-filter_complex', `[0:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:${r.duration},volume=${oldVol / 2}[o]`, '-map', '[o]', oldBed])
    const lvOld = bedLevels(oldBed, voiceOnly)
    rows.push({ engine: look, voiceLUFS: lufs(voiceOnly), beforeLUFS: lufs(before), afterLUFS: lufs(after), musicUnder_dB: lv.under, musicBetween_dB: lv.between, musicOld_dB: lvOld.under, voiceRms_dB: lv.voiceRms, musicLooped: `${dur(after).toFixed(1)}s video / 12s track` })
  }
  assets.close()
  fs.writeFileSync(path.join(OUT, 'sound-numbers.json'), JSON.stringify(rows, null, 2))
  console.table(rows)
}

main().catch((e) => { console.error(e); process.exit(1) })
