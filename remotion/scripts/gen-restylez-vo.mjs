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
  `You bought the template. Now you have to design?`,
  `Nope. Meet Restylez.`,
  `Paste any design you own. Get everything back in that exact look. The deck, the flyer, the cards, the posts.`,
  `Same style, different content. Your event, your words, nothing else moves.`,
  `Same content, different style. Keep every word, borrow a whole new look.`,
  `Decks are the headline act. Bring a document, a PowerPoint, or just a topic. Every slide comes back the right kind. Charts stay charts. Numbers stay exact.`,
  `And the PowerPoint stays editable. Hand it a multi-slide template pack, and it picks the six you need.`,
  `Every size. Print ready. Straight to the printer.`,
  `Type your website. Your logo and colors land on everything.`,
  `A flyer for ten bucks. A whole deck for thirty five. Your first piece is free.`,
  `Restylez. Any design. Every format you need.`,
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
