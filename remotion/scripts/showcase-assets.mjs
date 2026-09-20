// Assets for a showcase video from a project file:
//   node scripts/showcase-assets.mjs scripts/showcase/<id>.json
// Makes public/showcase/<id>/{vo-N.mp3, vo.json, music.mp3, beatgrid.json, f-N.mp4}
import { config } from 'dotenv'
config({ path: '../.env.local', quiet: true })
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { execFileSync } from 'child_process'

const P = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const ONLY = process.argv[3] || 'all'   // all | footage | audio
const OUT = `public/showcase/${P.id}`
mkdirSync(OUT, { recursive: true })
const dur = (f) => parseFloat(execFileSync('ffprobe', ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString())

// ---- narration (ElevenLabs) ----
const durations = []
for (let i = 0; i < P.lines.length; i++) {
  if (ONLY === 'footage') break
  const f = `${OUT}/vo-${i + 1}.mp3`
  if (!existsSync(f) && P.provider === 'openai') {
    const r = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: P.openaiModel || 'tts-1-hd', voice: P.openaiVoice || 'nova', input: P.lines[i], speed: P.speed ?? 1.0, response_format: 'mp3' }),
    })
    if (!r.ok) throw new Error(`VO ${i + 1}: ${r.status} ${await r.text()}`)
    writeFileSync(f, Buffer.from(await r.arrayBuffer()))
  } else if (!existsSync(f)) {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${P.voice}?output_format=mp3_44100_128`, {
      method: 'POST', headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: P.lines[i], model_id: 'eleven_multilingual_v2', voice_settings: { stability: P.stability ?? 0.45, similarity_boost: 0.8, style: P.style ?? 0.35, use_speaker_boost: true, speed: P.speed ?? 1.0 } }),
    })
    if (!r.ok) throw new Error(`VO ${i + 1}: ${r.status} ${await r.text()}`)
    writeFileSync(f, Buffer.from(await r.arrayBuffer()))
  }
  durations.push(+dur(f).toFixed(2)); console.log(`${P.id} vo ${i + 1}: ${durations[i]}s`)
}
if (ONLY !== 'footage') writeFileSync(`${OUT}/vo.json`, JSON.stringify({ lines: P.lines, durations }, null, 2))

// ---- music (ElevenLabs Music) + beat grid ----
if (ONLY !== 'footage' && !existsSync(`${OUT}/music.mp3`)) {
  const r = await fetch('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128', {
    method: 'POST', headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: P.music, music_length_ms: P.musicMs }),
  })
  if (!r.ok) console.warn(`music skipped: ${r.status} ${(await r.text()).slice(0, 120)}`)
  else writeFileSync(`${OUT}/music.mp3`, Buffer.from(await r.arrayBuffer()))
}
if (ONLY !== 'footage') execFileSync('node', ['scripts/beatgrid.mjs', `${OUT}/music.mp3`, `${OUT}/beatgrid.json`], { stdio: 'inherit' })
if (ONLY !== 'footage') console.log(`${P.id} music: ${dur(`${OUT}/music.mp3`).toFixed(1)}s`)

// ---- footage (Pexels) ----
for (const [i, q] of (ONLY === 'audio' ? [] : (P.footage || [])).entries()) {
  const f = `${OUT}/f-${i}.mp4`
  if (existsSync(f)) continue
  const r = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(q.q)}&orientation=landscape&size=medium&per_page=8`, { headers: { Authorization: process.env.PEXELS_API_KEY } })
  const j = await r.json()
  const vids = (j.videos || []).filter((v) => v.duration >= 6)
  const v = vids[q.pick ?? 0] || vids[0]
  if (!v) { console.log(`${P.id} footage ${i}: nothing for "${q.q}"`); continue }
  const file = v.video_files.filter((x) => x.width >= 1280 && x.width <= 2000).sort((a, b) => b.width - a.width)[0] || v.video_files.sort((a, b) => b.width - a.width)[0]
  const buf = Buffer.from(await (await fetch(file.link)).arrayBuffer())
  writeFileSync(`${OUT}/raw-${i}.mp4`, buf)
  // normalise: 1920x1080, 30fps, no audio, first N seconds — keeps renders predictable
  execFileSync('ffmpeg', ['-v', 'quiet', '-y', '-i', `${OUT}/raw-${i}.mp4`, '-t', String(q.secs ?? 8), '-vf', 'scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30', '-an', '-c:v', 'libx264', '-crf', '20', '-preset', 'fast', f])
  console.log(`${P.id} footage ${i}: "${q.q}" → ${v.user?.name} (${file.width}x${file.height})`)
}
console.log(`${P.id} assets done`)
