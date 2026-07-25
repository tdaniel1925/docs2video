// Rachel narration for the Momentum insurance sample deck → embedded base64.
import { config } from 'dotenv'
config({ path: '.env.local', quiet: true })
import { createHash } from 'crypto'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'

const KEY = process.env.ELEVENLABS_API_KEY
const VOICE = '21m00Tcm4TlvDq8ikWAM' // Rachel
const CACHE = 'remotion/.momentum-vo-cache'
mkdirSync(CACHE, { recursive: true })

const LINES = [
  `Thank you for your time today. This is your personalized illustration, explained — what it protects, what it costs, and how it grows. Every number you're about to see comes straight from your own illustration. Let's walk through it together.`,
  `It starts with a decision at forty. This plan was built around you — locked in at your current age and your preferred non-tobacco rating, while both are working in your favor.`,
  `Here's what it does for your family. From the moment coverage begins, they have one hundred seventy-six thousand, two hundred four dollars of protection standing behind them — in force from day one.`,
  `And the cost? Ten thousand dollars a year, for twenty years. Break that down and it's about eight hundred thirty-three dollars a month — roughly twenty-seven dollars a day. About the price of a coffee and lunch. And here's the best part: after twenty years the payments stop. The coverage doesn't have to.`,
  `Now — where does that money go? Your cash value is tied to the S and P five hundred. You're not directly in the market, so the downside is protected. But you keep the upside potential, without the gut-punch losses.`,
  `This next part surprises almost everyone. Built right into your plan, at no extra cost, are living benefits. If you ever face a qualifying critical, chronic, or terminal illness, you can access a portion of your benefit while you're still alive — when you need it most.`,
  `Two ages worth remembering. Sixty-seven: if something happens before then, your family receives the full benefit — that part is contractual. And one hundred thirty-one: that's how far your coverage is illustrated to run under plan assumptions.`,
  `Ready to make this real? Call Trent Daniel today, at nine three six... six four one... seven one three zero. Or email, t daniel, at botmakers dot A I. Thank you for your time — we look forward to serving you.`,
]

async function tts(text) {
  const h = createHash('md5').update(text).digest('hex')
  const f = `${CACHE}/${h}.mp3`
  if (existsSync(f)) return readFileSync(f)
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_64`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, model_id: 'eleven_turbo_v2_5', voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
  })
  if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${(await r.text()).slice(0, 150)}`)
  const buf = Buffer.from(await r.arrayBuffer())
  writeFileSync(f, buf)
  return buf
}

const clips = []
for (const [i, line] of LINES.entries()) {
  const buf = await tts(line)
  clips.push(buf.toString('base64'))
  console.log(`vo ${i + 1}/${LINES.length}: ${(buf.length / 1024).toFixed(0)}KB`)
}

const file = 'remotion/out/_autoguru/html/insurance-momentum.html'
const html = readFileSync(file, 'utf8')
const out = html.replace(/const VO=\/\*VO\*\/\[[^\n]*\];/, `const VO=/*VO*/${JSON.stringify(clips)};`)
if (out === html) throw new Error('VO marker not found')
writeFileSync(file, out)
console.log('embedded', clips.length, 'clips →', file, `(${(out.length / 1048576).toFixed(1)}MB)`)
