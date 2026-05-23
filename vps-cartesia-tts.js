// VPS patch: Switch TTS from OpenAI to Cartesia Sonic for better voice quality
// Cartesia voices: https://cartesia.ai/voices
const fs = require('fs')
let code = fs.readFileSync('/tmp/server.js', 'utf8')

// Add Cartesia API key
if (!code.includes('CARTESIA_API_KEY')) {
  code = code.replace(
    "const OPENAI_API_KEY = process.env.OPENAI_API_KEY",
    "const OPENAI_API_KEY = process.env.OPENAI_API_KEY\nconst CARTESIA_API_KEY = 'sk_car_q3LXCVpW5FNKZ21owjNV94'"
  )
  console.log('1. Added Cartesia API key')
}

// Add Cartesia TTS function
const cartesiaFunc = `
// Cartesia TTS — natural-sounding voices with emotion control
async function cartesiaTTS(text, voiceId, speed = 'normal') {
  const CARTESIA_VOICES = {
    'nova': '79a125e8-cd45-4c13-8a67-188112f4dd22',    // Friendly female narrator
    'shimmer': 'a0e99841-438c-4a64-b679-ae501e7d6091',  // Warm female
    'onyx': '41534e16-2966-4c6b-9670-111411def906',     // Deep male narrator
    'echo': '726d5ae5-055f-4c3d-8355-d9677de68571',     // Conversational male
    'alloy': 'f9836c6e-a0bd-460e-9d3c-f7299fa60f94',    // Neutral narrator
    'fable': 'c45bc5ec-dc68-4feb-8829-6e6b2748095d',    // Storyteller
    'ash': '87748186-691e-4e9d-a995-98ccefb1c7f4',      // Professional male
    'coral': '00a77add-48d5-4ef6-8157-71e5580b7a4f',    // Engaging female
  }
  const cVoiceId = CARTESIA_VOICES[voiceId] || CARTESIA_VOICES['nova']

  const res = await fetch('https://api.cartesia.ai/tts/bytes', {
    method: 'POST',
    headers: {
      'Cartesia-Version': '2024-06-10',
      'X-API-Key': CARTESIA_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model_id: 'sonic-2',
      transcript: text,
      voice: { id: cVoiceId },
      output_format: { container: 'mp3', bit_rate: 192000, sample_rate: 44100 },
      speed: speed,
    }),
    signal: AbortSignal.timeout(30000),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => 'unknown')
    throw new Error(\`Cartesia TTS failed (\${res.status}): \${errText.slice(0, 200)}\`)
  }

  return Buffer.from(await res.arrayBuffer())
}
`

if (!code.includes('cartesiaTTS')) {
  // Add the function before the first app.post
  code = code.replace(
    "// Auth middleware",
    cartesiaFunc + "\n// Auth middleware"
  )
  console.log('2. Added cartesiaTTS function')
}

// Replace OpenAI TTS calls with Cartesia
// Solo narrator
const oldSoloTTS = `            const resp = await openai.audio.speech.create({
              model: 'tts-1-hd', voice: voiceId || 'nova',
              input: scene.narration.slice(0, 4096), response_format: 'mp3', speed: 1.0,
            })
            buffers.push(Buffer.from(await resp.arrayBuffer()))`

const newSoloTTS = `            const audioBuf = await cartesiaTTS(scene.narration.slice(0, 4096), voiceId || 'nova')
            buffers.push(audioBuf)`

if (code.includes(oldSoloTTS)) {
  code = code.replace(oldSoloTTS, newSoloTTS)
  console.log('3. Replaced solo TTS with Cartesia')
} else {
  console.log('3. WARNING: Could not find solo TTS block')
}

// Podcast TTS — replace gpt-4o-mini-tts with Cartesia
const oldPodcastTTS = `              const resp = await openai.audio.speech.create({
                model: 'gpt-4o-mini-tts', voice: line.voice || 'coral',
                input: line.text.slice(0, 2000),
                instructions: line.instructions || 'Speak naturally.',
                response_format: 'mp3', speed: 1.0,
              })
              dClips.push(Buffer.from(await resp.arrayBuffer()))`

const newPodcastTTS = `              const audioBuf = await cartesiaTTS(line.text.slice(0, 4096), line.voice || 'coral')
              dClips.push(audioBuf)`

if (code.includes(oldPodcastTTS)) {
  code = code.replace(oldPodcastTTS, newPodcastTTS)
  console.log('4. Replaced podcast TTS with Cartesia')
} else {
  console.log('4. WARNING: Could not find podcast TTS block')
}

// Also replace the fallback solo TTS in podcast error handler
const oldFallbackTTS = `              const resp = await openai.audio.speech.create({
                model: 'tts-1-hd', voice: voiceId || 'nova',
                input: scene.narration.slice(0, 4096), response_format: 'mp3', speed: 1.0,
              })
              buffers.push(Buffer.from(await resp.arrayBuffer()))`

const newFallbackTTS = `              const audioBuf = await cartesiaTTS(scene.narration.slice(0, 4096), voiceId || 'nova')
              buffers.push(audioBuf)`

if (code.includes(oldFallbackTTS)) {
  code = code.replace(oldFallbackTTS, newFallbackTTS)
  console.log('5. Replaced fallback TTS with Cartesia')
} else {
  console.log('5. WARNING: Could not find fallback TTS block')
}

fs.writeFileSync('/tmp/server.js', code, 'utf8')
console.log('Done! Deploy: docker cp /tmp/server.js docs2video-service:/app/server.js && docker restart docs2video-service')
