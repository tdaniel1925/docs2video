/**
 * Generate voice sample MP3 files for the wizard voice picker.
 * Run: node scripts/generate-voice-samples.js
 * Requires FAL_KEY in .env.local (solo samples); the podcast sample still uses OPENAI_API_KEY
 */
const fs = require('fs')
const path = require('path')

// Load env from .env.local
const envPath = path.join(__dirname, '..', '.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) process.env[match[1].trim()] = match[2].trim()
}

const OpenAI = require('openai')
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const SAMPLE_TEXT = "Welcome to your personalized video overview. We've analyzed your content and created a presentation highlighting the key insights that matter most to your audience."

const VOICES = ['nova', 'shimmer', 'onyx', 'echo', 'alloy', 'fable']
const OUT_DIR = path.join(__dirname, '..', 'public', 'samples')

// Solo samples (step 3 voice picker plays /samples/solo-<id>.mp3). Since
// 2026-10-09 every voice is spoken by fal.ai (render-service/fal-tts.js —
// the same voice map + loudness the finished videos use), so the sample is
// what the customer will hear. --force regenerates existing files.
async function generateSoloSamples() {
  const { falSpeak } = require('../render-service/fal-tts.js')
  const { speakable } = require('../render-service/slides.js')
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const force = process.argv.includes('--force')
  for (const voice of VOICES) {
    const outFile = path.join(OUT_DIR, `solo-${voice}.mp3`)
    if (fs.existsSync(outFile) && !force) {
      console.log(`Skip ${voice} (exists — pass --force to remake)`)
      continue
    }
    console.log(`Generating ${voice}...`)
    const r = await falSpeak(speakable(SAMPLE_TEXT), { voiceId: voice })
    fs.writeFileSync(outFile, r.audio)
    console.log(`  Saved ${outFile} (${(r.audio.length / 1024).toFixed(0)}KB, fal voice ${r.voice}, ${r.ms}ms)`)
  }
}

async function generatePodcastSample() {
  const outFile = path.join(OUT_DIR, 'podcast-sample.mp3')
  if (fs.existsSync(outFile)) {
    console.log('Skip podcast (exists)')
    return
  }

  const lines = [
    { voice: 'coral', text: "So let's talk about what makes this company stand out in their market." },
    { voice: 'ash', text: "Yeah, what really caught my attention was their approach to customer retention. The numbers are impressive." },
    { voice: 'coral', text: "Exactly. A ninety-four percent retention rate tells you they're doing something right." },
  ]

  const clips = []
  for (let i = 0; i < lines.length; i++) {
    console.log(`Podcast line ${i + 1}/${lines.length} (${lines[i].voice})...`)
    const resp = await openai.audio.speech.create({
      model: 'tts-1-hd',
      voice: lines[i].voice,
      input: lines[i].text,
      response_format: 'mp3',
      speed: 1.0,
    })
    clips.push(Buffer.from(await resp.arrayBuffer()))
  }

  // Simple concatenation (MP3 frames are self-contained)
  const combined = Buffer.concat(clips)
  fs.writeFileSync(outFile, combined)
  console.log(`  Saved ${outFile} (${(combined.length / 1024).toFixed(0)}KB)`)
}

async function main() {
  console.log('Generating voice samples...')
  await generateSoloSamples()
  await generatePodcastSample()
  console.log('Done!')
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
