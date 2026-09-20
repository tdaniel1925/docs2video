/**
 * JORDYN — the launch film's music. ElevenLabs Music.
 *
 * WRITTEN TO THE STORY, not just "upbeat". The film has a shape — a want, a
 * hard truth, a turn, four proofs, a close — and a track that ignores it
 * fights the voice the whole way. So the prompt describes the ARC: sparse and
 * unresolved under the problem, the lift at "Her name is Jordyn", driving
 * through the proof, resolved at the end.
 *
 * The Restylez track is four-on-the-floor from the first beat, which is right
 * for a fun product launch and wrong here — opening with a party under "that
 * person does not exist" would undercut the line.
 *
 * Run from remotion/: node scripts/gen-jordyn2-music.mjs [ms]
 */
import { config } from 'dotenv'
config({ path: '../.env.local', quiet: true })
import { writeFileSync, mkdirSync } from 'fs'

const KEY = process.env.ELEVENLABS_API_KEY
if (!KEY) throw new Error('no ELEVENLABS_API_KEY')
const ms = Number(process.argv[2] || 76000)
mkdirSync('public/showcase/jordyn-hire', { recursive: true })

const prompt = [
  'Upbeat modern commercial launch track, 128 BPM, instrumental only, no vocals.',
  'Driving four-on-the-floor kick from the very first beat, punchy claps on two and four, crisp hats, confident forward momentum the whole way through.',
  'Bright plucky synth hook over a warm analog bass. Energetic and optimistic rather than moody.',
  'A short filtered build around twenty seconds that drops back into the full beat — a lift, not a pause.',
  'Steady tempo throughout, never slowing down, never ambient, always something moving.',
  'Mixed so a voiceover sits on top cleanly. Ends on a big final hit.',
].join(' ')
const res = await fetch('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128', {
  method: 'POST',
  headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
  body: JSON.stringify({ prompt, music_length_ms: ms }),
  signal: AbortSignal.timeout(300000),
})
if (!res.ok) throw new Error(`eleven-music ${res.status} ${(await res.text()).slice(0, 200)}`)
const buf = Buffer.from(await res.arrayBuffer())
writeFileSync('public/showcase/jordyn-hire/music.mp3', buf)
console.log(`music ok — ${Math.round(buf.length / 1024)}KB, ${(ms / 1000).toFixed(0)}s`)
