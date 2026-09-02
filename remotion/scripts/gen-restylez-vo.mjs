// Restylez launch video — ElevenLabs narration (Sarah), one MP3 per beat + durations.
// Run from remotion/: node scripts/gen-restylez-vo.mjs
import { config } from 'dotenv'
config({ path: '../.env.local', quiet: true })
import { writeFileSync, mkdirSync } from 'fs'
import { execFileSync } from 'child_process'

const KEY = process.env.ELEVENLABS_API_KEY
const VOICE = process.env.RESTYLEZ_EL_VOICE || 'EXAVITQu4vr4xnSDxMaL' // Sarah
const OUT = 'public/restylez'
mkdirSync(OUT, { recursive: true })

// No "..." (TTS choke). Canva named once, softly. "ReStyles" so it is said re-styles.
const LINES = [
  `Still dragging boxes around at midnight?`,
  `Meet ReStyles. The first AI graphic designer in a box. Agency quality. Agency speed. Not agency prices.`,
  `Premium work, for your business, or for your clients.`,
  `Show it one design. Get every format back in that exact look. The deck, the cards, the posts, the postcard.`,
  `New night, new words. Nothing else moves.`,
  `Or keep your words, and give them a whole new look.`,
  `Whole decks from a document or a topic. Charts stay charts. Numbers stay exact.`,
  `Real, editable PowerPoint. Hand it a template pack, and it picks the slides you need.`,
  `Agencies charge hundreds a month. A freelancer, fifteen hundred a deck. Here, a deck is thirty five. A flyer, ten. And you can finally leave Canva behind.`,
  `Every size, print ready. With brochures, booklets and magazines on the way.`,
  `ReStyles. The premium spot for everything graphic design.`,
]

const durations = []
for (let i = 0; i < LINES.length; i++) {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: LINES[i],
      model_id: 'eleven_multilingual_v2',
      // upbeat launch-ad read: a little style, steady, faster
      voice_settings: { stability: 0.42, similarity_boost: 0.8, style: 0.4, use_speaker_boost: true, speed: 1.08 },
    }),
  })
  if (!r.ok) throw new Error(`ElevenLabs ${i + 1}: ${r.status} ${await r.text()}`)
  const f = `${OUT}/vo-${i + 1}.mp3`
  writeFileSync(f, Buffer.from(await r.arrayBuffer()))
  const d = parseFloat(execFileSync('ffprobe', ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString())
  durations.push(+d.toFixed(2)); console.log(i + 1, d.toFixed(2), LINES[i].slice(0, 40))
}
writeFileSync(`${OUT}/vo.json`, JSON.stringify({ lines: LINES, durations, voice: 'elevenlabs:' + VOICE }, null, 2))
