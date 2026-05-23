const fs = require('fs')
let code = fs.readFileSync('/tmp/server.js', 'utf8')

const cartesiaStart = 'async function cartesiaTTS(text, voiceId'
const openaiFunc = 'async function openaiTTS(text, voiceId) {\n  const voiceMap = { nova: "nova", shimmer: "shimmer", onyx: "onyx", echo: "echo", alloy: "alloy", fable: "fable", ash: "nova", coral: "shimmer" }\n  const oaiVoice = voiceMap[voiceId] || "nova"\n  const OpenAI = (await import("openai")).default\n  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })\n  const mp3 = await openai.audio.speech.create({ model: "tts-1", voice: oaiVoice, input: text })\n  return Buffer.from(await mp3.arrayBuffer())\n}\n\nasync function cartesiaTTS(text, voiceId'

if (code.includes('async function openaiTTS')) {
  console.log('SKIP: openaiTTS already exists')
} else {
  code = code.replace(cartesiaStart, openaiFunc)
  console.log('Added openaiTTS function')
}

const old = '            console.error(`[${videoId}] TTS failed clip ${i + 1}:`, e.message)\n            buffers.push(Buffer.alloc(0))'
const rep = '            console.log(`[${videoId}] Cartesia failed clip ${i + 1}: ${e.message}, trying OpenAI...`)\n            try {\n              const fb = await openaiTTS(scene.narration.slice(0, 4096), voiceId || "nova")\n              buffers.push(fb)\n              console.log(`[${videoId}] OpenAI fallback OK clip ${i + 1}`)\n            } catch (e2) {\n              console.error(`[${videoId}] All TTS failed clip ${i + 1}:`, e2.message)\n              buffers.push(Buffer.alloc(0))\n            }'

if (code.includes(old)) {
  code = code.replace(old, rep)
  console.log('Added OpenAI fallback to solo TTS')
} else {
  console.log('ERROR: Could not find TTS failure pattern')
}

fs.writeFileSync('/tmp/server.js', code)
