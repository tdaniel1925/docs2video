// Restylez launch video — Sarah (nova) narration, one MP3 per beat + durations.
import { config } from 'dotenv'
config({ path: '../.env.local', quiet: true })
import { writeFileSync, mkdirSync } from 'fs'
import { execFileSync } from 'child_process'

const KEY = process.env.OPENAI_API_KEY
const OUT = 'public/restylez'
mkdirSync(OUT, { recursive: true })

// No "..." (TTS choke). Canva named once. Numbers spoken as words.
const LINES = [
  `Still dragging boxes around at midnight?`,
  `Meet Restylez. The first AI graphic designer in a box. Agency quality. Agency speed. Not agency prices.`,
  `Premium work, for your business, or for your clients.`,
  `Show it one design. Get every format back in that exact look. The deck, the cards, the posts, the postcard.`,
  `New night, new words. Nothing else moves.`,
  `Or keep your words, and give them a whole new look.`,
  `Whole decks from a document or a topic. Charts stay charts. Numbers stay exact.`,
  `Real, editable PowerPoint. Hand it a template pack, and it picks the slides you need.`,
  `Agencies charge hundreds a month. A freelancer, fifteen hundred a deck. Here, a deck is thirty five. A flyer, ten. And Canva? Trash.`,
  `Every size, print ready. With brochures, booklets and magazines on the way.`,
  `Restylez. The premium spot for everything graphic design.`,
]

const durations = []
for (let i = 0; i < LINES.length; i++) {
  const r = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice: 'nova', input: LINES[i], speed: 1.08, response_format: 'mp3',
      instructions: 'Energetic, upbeat, confident launch-ad read. Fast but crisp. Playful, never corporate. Slight smile in the voice.' }),
  })
  if (!r.ok) throw new Error(`TTS ${i + 1}: ${r.status} ${await r.text()}`)
  const f = `${OUT}/vo-${i + 1}.mp3`
  writeFileSync(f, Buffer.from(await r.arrayBuffer()))
  const d = parseFloat(execFileSync('ffprobe', ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString())
  durations.push(+d.toFixed(2)); console.log(i + 1, d.toFixed(2), LINES[i].slice(0, 40))
}
writeFileSync(`${OUT}/vo.json`, JSON.stringify({ lines: LINES, durations }, null, 2))
