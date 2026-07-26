// Narration for the AI-in-Medicine deck. ElevenLabs (Rachel) with an OpenAI
// TTS fallback, one clip per page, cached by index.
import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const HERE = dirname(fileURLToPath(import.meta.url)); const ROOT = join(HERE, '..', '..')
const OUT = join(HERE, '..', '.aimed-vo'); mkdirSync(OUT, { recursive: true })
const env = {}
for (const f of ['.env.local', '.env']) {
  const p = join(ROOT, f); if (!existsSync(p)) continue
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !env[m[1]]) env[m[1]] = m[2].trim()
  }
}

// Pull the narration straight out of the deck builder so the two can't drift.
const src = readFileSync(join(HERE, 'build-aimed-deck.mjs'), 'utf8')
const LINES = [...src.matchAll(/narration:\s*"((?:[^"\\]|\\.)*)"/g)]
  .map((m) => m[1].replace(/\\"/g, '"').replace(/\\'/g, "'"))
if (LINES.length !== 12) { console.error(`expected 12 narration lines, found ${LINES.length}`); process.exit(1) }

const VOICE = env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM' // Rachel

async function eleven(text) {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text, model_id: 'eleven_turbo_v2_5',
      // Slightly higher stability than the marketing default — this is a
      // clinical topic and it should read measured, not enthusiastic.
      voice_settings: { stability: 0.62, similarity_boost: 0.8, style: 0.08 },
    }),
  })
  if (!r.ok) throw new Error(`eleven ${r.status} ${(await r.text()).slice(0, 120)}`)
  return Buffer.from(await r.arrayBuffer())
}

async function openai(text) {
  const r = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'tts-1-hd', voice: 'nova', input: text }),
  })
  if (!r.ok) throw new Error(`openai ${r.status}`)
  return Buffer.from(await r.arrayBuffer())
}

let i = 0
async function worker() {
  for (;;) {
    const n = i++; if (n >= LINES.length) return
    const out = join(OUT, `${String(n).padStart(2, '0')}.mp3`)
    if (existsSync(out) && process.env.FORCE !== '1') { console.log('[vo] cached', n); continue }
    let buf
    try { buf = await eleven(LINES[n]) } catch (e) {
      console.log('[vo] eleven failed, falling back to OpenAI:', String(e.message).slice(0, 80))
      buf = await openai(LINES[n])
    }
    writeFileSync(out, buf)
    console.log('[vo]', n, `${(buf.length / 1024).toFixed(0)}kb`)
  }
}
await Promise.all(Array.from({ length: 3 }, worker))
console.log('\nwrote', OUT)
