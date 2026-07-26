// Generate VO (ElevenLabs, warm female) + a synth music bed for the Pulse ad.
// Writes per-scene mp3s + durations.json + music.mp3 into remotion/public/d2v-pulse/.
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'fs'
import { execFileSync } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')          // project root
const OUT = join(HERE, '..', 'public', 'd2v-pulse')
mkdirSync(OUT, { recursive: true })

// load keys from .env.local
const env = {}
for (const f of ['.env.local', '.env']) {
  const p = join(ROOT, f)
  if (existsSync(p)) for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !env[m[1]]) env[m[1]] = m[2].trim()
  }
}
const ELEVEN = env.ELEVENLABS_API_KEY
const VOICE = env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM' // Rachel
const OPENAI = env.OPENAI_API_KEY

// one VO line per scene (grounded, punchy, spoken)
const LINES = [
  "Nobody reads your PDF.",
  "Meet docs2video — turn any document into a branded, narrated video.",
  "Just three steps: drop a link or a file, our AI writes and narrates it, then you share the video.",
  "Tuned for twelve industries. File to film in about four minutes. And it's free to start.",
  "Brand-matched from your site, real voiceover, a share page with analytics, decks, PDFs, even an API.",
  "Docs2video dot com. Start free — two videos on us.",
]

async function eleven(text) {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': ELEVEN, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: 'eleven_turbo_v2_5', voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.15 } }),
  })
  if (!r.ok) throw new Error(`eleven ${r.status}: ${(await r.text()).slice(0, 160)}`)
  return Buffer.from(await r.arrayBuffer())
}
async function openai(text) {
  const r = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST', headers: { Authorization: `Bearer ${OPENAI}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'tts-1-hd', voice: 'nova', input: text }),
  })
  if (!r.ok) throw new Error(`openai ${r.status}: ${(await r.text()).slice(0, 160)}`)
  return Buffer.from(await r.arrayBuffer())
}
const durOf = (file) => {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim()
  return parseFloat(out)
}

const durations = []
for (let i = 0; i < LINES.length; i++) {
  let buf
  try { buf = ELEVEN ? await eleven(LINES[i]) : await openai(LINES[i]) }
  catch (e) { console.error(`scene ${i} eleven failed (${e.message}); trying OpenAI`); buf = await openai(LINES[i]) }
  const f = join(OUT, `vo-${i}.mp3`)
  writeFileSync(f, buf)
  const d = durOf(f)
  durations.push(d)
  console.log(`vo-${i}.mp3  ${d.toFixed(2)}s  "${LINES[i].slice(0, 44)}..."`)
}

// total with small pre/post pad per scene handled in the composition; write raw VO durs
writeFileSync(join(OUT, 'durations.json'), JSON.stringify({ vo: durations, lines: LINES }, null, 2))
const total = durations.reduce((a, b) => a + b, 0)
console.log(`TOTAL VO ${total.toFixed(2)}s`)

// ---- music bed: a mellow synth pad + soft pulse, exactly total+pad seconds ----
const musicLen = Math.ceil(total + 5)
const music = join(OUT, 'music.mp3')
// layered sines (chord) + subtle tremolo, gentle highpass, fade in/out
execFileSync('ffmpeg', ['-y',
  '-f', 'lavfi', '-i', `sine=frequency=110:duration=${musicLen}`,
  '-f', 'lavfi', '-i', `sine=frequency=164.81:duration=${musicLen}`,
  '-f', 'lavfi', '-i', `sine=frequency=220:duration=${musicLen}`,
  '-filter_complex',
  `[0:a]volume=0.5[a];[1:a]volume=0.32[b];[2:a]volume=0.22[c];` +
  `[a][b][c]amix=inputs=3:normalize=0[m];` +
  `[m]tremolo=f=2:d=0.25,highpass=f=90,lowpass=f=1200,` +
  `afade=t=in:st=0:d=1.5,afade=t=out:st=${musicLen - 2}:d=2,volume=0.5[out]`,
  '-map', '[out]', '-ac', '2', '-ar', '44100', music,
], { stdio: 'ignore' })
console.log(`music.mp3  ${musicLen}s`)
console.log('DONE')
