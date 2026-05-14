import OpenAI from 'openai'

let client: OpenAI | null = null

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  }
  return client
}

export async function synthesizeSpeech(
  text: string,
  voiceId: string
): Promise<Buffer> {
  const openai = getClient()

  // Retry up to 3 times with backoff
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await openai.audio.speech.create({
        model: 'tts-1-hd',
        voice: voiceId as 'alloy' | 'echo' | 'fable' | 'nova' | 'onyx' | 'shimmer',
        input: text,
        response_format: 'mp3',
        speed: 0.95,
      })

      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // Verify we got actual audio (MP3 files start with ID3 or 0xFF 0xFB)
      if (buffer.length < 100) {
        throw new Error(`TTS returned suspiciously small audio: ${buffer.length} bytes`)
      }

      return buffer
    } catch (err) {
      console.error(`[tts] Attempt ${attempt}/3 failed for text "${text.slice(0, 50)}...":`, err instanceof Error ? err.message : err)
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 1000 * attempt)) // 1s, 2s backoff
      } else {
        // Generate a short silence as fallback so video assembly doesn't break
        console.error(`[tts] All 3 attempts failed, generating silence for this scene`)
        // 1 second of silence as MP3 (minimal valid MP3 frame)
        return generateSilence()
      }
    }
  }

  return generateSilence() // TypeScript safety
}

// Generate a minimal silent MP3 buffer (~1 second)
function generateSilence(): Buffer {
  // Minimal MP3 frame: MPEG1 Layer3 128kbps 44100Hz stereo
  // This is a valid but silent MP3 frame repeated a few times
  const frame = Buffer.from('fffb9004000000000000000000000000000000000000000000000000000000000000000000000000', 'hex')
  const frames: Buffer[] = []
  for (let i = 0; i < 38; i++) frames.push(frame) // ~1 second
  return Buffer.concat(frames)
}

export async function synthesizeAllScenes(
  scenes: { narration: string }[],
  voiceId: string
): Promise<Buffer[]> {
  const audioBuffers: Buffer[] = []
  for (const scene of scenes) {
    const audio = await synthesizeSpeech(scene.narration, voiceId)
    audioBuffers.push(audio)
  }
  return audioBuffers
}
