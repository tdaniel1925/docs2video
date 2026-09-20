/**
 * JORDYN — "the perfect employee" launch film. ElevenLabs narration.
 *
 * ONE MP3 PER BEAT, not one long file. The video is built to these durations,
 * so a line that needs rewriting costs one request and one number rather than
 * a re-record and a re-time of everything after it.
 *
 * THE READ. This is not the feature-tour script the first Jordyn video used.
 * It is one idea — every business owner wants the same impossible person, and
 * now they can have her — so the voice is warm and certain rather than bright
 * and salesy. Slower than the Restylez launch read (speed 0.98 against 1.08),
 * because the turn at "Her name is Jordyn" only lands if the lines around it
 * have room to breathe.
 *
 * Run from remotion/: node scripts/gen-jordyn2-vo.mjs
 */
import { config } from 'dotenv'
config({ path: '../.env.local', quiet: true })
import { writeFileSync, mkdirSync } from 'fs'
import { execFileSync } from 'child_process'

const KEY = process.env.ELEVENLABS_API_KEY
if (!KEY) throw new Error('no ELEVENLABS_API_KEY')
const VOICE = process.env.JORDYN_EL_VOICE || 'EXAVITQu4vr4xnSDxMaL' // Sarah
/*
 * ITS OWN FOLDER. public/jordyn2 already belongs to a different Jordyn film —
 * writing here shares a namespace with someone else's assets, and the only
 * reason nothing broke the first time is that the numbering happened to
 * differ. AudioBed reads from showcase/<id>/, so that is where these live.
 */
const OUT = 'public/showcase/jordyn-hire'
mkdirSync(OUT, { recursive: true })

/*
 * No ellipses — TTS chokes on them. Sentence fragments do the pausing instead,
 * which is also how the line would be read aloud.
 */
const LINES = [
  // THE WANT
  `Every business owner wants the same person.`,
  `Someone who answers before you ask. Who never drops a ball. Never forgets a name. Never leaves at five.`,
  `Nobody applies for that job. The ones who come close cost ninety thousand a year, and they are gone by spring.`,
  // THE TURN
  `So we built her instead. Her name is Jordyn.`,
  `She is not a chatbot. She is a digital employee, and she learns your business the way a great hire does.`,
  // THE PROOF
  `She reads every email overnight, so what needs you is waiting before your coffee.`,
  `She answers your phone. Callers book real appointments, mid call.`,
  `She writes, invoices, chases and files. In your voice, on your letterhead.`,
  `Tell her your industry and her brain installs in seconds. Insurance. Real estate. Law. Whatever you are.`,
  // NEW: she works inside the tools you already pay for
  `And she works inside the tools you already use. Slack. Notion. Salesforce. HubSpot. Five hundred more.`,
  // NEW: and you build what she does by talking
  `Want her to do something new? Just tell her. Say it out loud and the workflow builds itself.`,
  // THE CLOSE
  `She does not call in sick. She does not hand in her notice.`,
  `The perfect employee was always a fantasy. Now she starts tomorrow.`,
  `Jordyn. Your digital employee.`,
]

const durations = []
for (let i = 0; i < LINES.length; i++) {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: LINES[i],
      model_id: 'eleven_multilingual_v2',
      // Warm and certain. Higher stability than the Restylez read because this
      // one is a statement, not a pitch; lower style for the same reason.
      voice_settings: { stability: 0.55, similarity_boost: 0.85, style: 0.28, use_speaker_boost: true, speed: 0.98 },
    }),
  })
  if (!r.ok) throw new Error(`ElevenLabs line ${i + 1}: ${r.status} ${(await r.text()).slice(0, 200)}`)
  const file = `${OUT}/vo-${i + 1}.mp3`
  writeFileSync(file, Buffer.from(await r.arrayBuffer()))
  // The real length, measured — the video times itself to these, and a guess
  // here becomes a voice that runs over the next scene.
  const secs = Number(execFileSync('ffprobe', ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' }).trim())
  durations.push(Number(secs.toFixed(2)))
  console.log(`${i + 1}/${LINES.length}  ${secs.toFixed(2)}s  ${LINES[i].slice(0, 58)}`)
}

writeFileSync(`${OUT}/vo.json`, JSON.stringify({ lines: LINES, durations }, null, 2))
const total = durations.reduce((a, b) => a + b, 0)
console.log(`\nspoken total ${total.toFixed(1)}s — the film is 75s, so there is ${(75 - total).toFixed(1)}s of air for the beats to land`)
