// Narration for the 6-page illustration deck. ElevenLabs (Rachel), OpenAI fallback.
import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
const HERE = dirname(fileURLToPath(import.meta.url)); const ROOT = join(HERE, '..', '..')
const OUT = join(HERE, '..', 'public', 'illus-vo'); mkdirSync(OUT, { recursive: true })
const env = {}
for (const f of ['.env.local', '.env']) { const p = join(ROOT, f); if (!existsSync(p)) continue
  for (const l of readFileSync(p, 'utf8').split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !env[m[1]]) env[m[1]] = m[2].trim() } }

// Client-facing and compliance-safe: no carrier, no product name, figures kept,
// every claim pointed back at the full illustration.
export const LINES = [
  "Hi Bill — thanks for your time. This is a short walk through the illustration we put together for you and your family.",
  "Here's what you put in. Fifteen thousand dollars a year, for twenty years. That's three hundred thousand total, and the premium never increases.",
  "And here's what the illustration projects it becomes. One hundred seventy six thousand, two hundred and four dollars in cash value, with a ninety eight percent participation rate and a floor of zero in a down year.",
  "It's protecting three things at once. Your family, through a benefit paid directly to the people you name. Your income, through access to value while you're living. And your plan, through that floor underneath the account.",
  "Here's the road ahead. You start at forty five. Value builds through your fifties. Access opens up around sixty five. And whatever's left goes to your family.",
  "That's the short version. Take a look at the full illustration, and call me any time — I'm happy to walk through any part of it with you.",
]

const VOICE = env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'
async function eleven(text) {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
    method: 'POST', headers: { 'xi-api-key': env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: 'eleven_turbo_v2_5', voice_settings: { stability: 0.6, similarity_boost: 0.8, style: 0.1 } }) })
  if (!r.ok) throw new Error(`eleven ${r.status}`)
  return Buffer.from(await r.arrayBuffer())
}
async function openai(text) {
  const r = await fetch('https://api.openai.com/v1/audio/speech', { method: 'POST',
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'tts-1-hd', voice: 'nova', input: text }) })
  if (!r.ok) throw new Error(`openai ${r.status}`)
  return Buffer.from(await r.arrayBuffer())
}
let i = 0
async function worker() {
  for (;;) { const n = i++; if (n >= LINES.length) return
    const out = join(OUT, `${n}.mp3`)
    if (existsSync(out) && process.env.FORCE !== '1') { console.log('[vo] cached', n); continue }
    let b; try { b = await eleven(LINES[n]) } catch (e) { console.log('[vo] fallback:', String(e.message).slice(0,60)); b = await openai(LINES[n]) }
    writeFileSync(out, b); console.log('[vo]', n, (b.length/1024).toFixed(0)+'kb') }
}
await Promise.all(Array.from({ length: 3 }, worker))
console.log('wrote', OUT)
