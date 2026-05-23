import OpenAI from 'openai'

const TTS_MAX_CHARS = 4096

let client: OpenAI | null = null

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  }
  return client
}

export async function synthesizeSpeech(
  text: string,
  voiceId: string,
  options: { strict?: boolean } = {}
): Promise<Buffer> {
  // Guard against empty/whitespace narration
  if (!text?.trim()) {
    console.log('[tts] Empty narration text, generating silence')
    return generateSilence(text)
  }

  const strict = options.strict ?? process.env.STRICT_MODE === 'true'

  if (text.length > TTS_MAX_CHARS) {
    if (strict) {
      throw new Error(
        `TTS text exceeds ${TTS_MAX_CHARS} char limit (${text.length} chars). Split into multiple scenes before calling synthesizeSpeech.`
      )
    }
    // Non-strict: split at sentence boundary, synthesize each chunk, concatenate
    return await synthesizeLongText(text, voiceId)
  }

  const openai = getClient()

  // Retry up to 3 times with backoff + 30s timeout per attempt
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30000) // 30s timeout

      const response = await openai.audio.speech.create(
        {
          model: 'tts-1-hd',
          voice: voiceId as 'alloy' | 'echo' | 'fable' | 'nova' | 'onyx' | 'shimmer',
          input: text,
          response_format: 'mp3',
          speed: 0.95,
        },
        { signal: controller.signal as any }
      )

      clearTimeout(timeout)

      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // Verify we got actual audio
      if (buffer.length < 100) {
        throw new Error(`TTS returned suspiciously small audio: ${buffer.length} bytes`)
      }

      return buffer
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[tts] Attempt ${attempt}/3 failed for text "${text.slice(0, 50)}...": ${msg}`)
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 1000 * attempt))
      } else {
        console.error(`[tts] All 3 attempts failed, generating silence`)
        return generateSilence(text)
      }
    }
  }

  return generateSilence(text)
}

async function synthesizeLongText(text: string, voiceId: string): Promise<Buffer> {
  const chunks = splitAtSentenceBoundary(text, TTS_MAX_CHARS - 100)
  console.log(`[tts] Long text (${text.length} chars) split into ${chunks.length} chunks`)
  const buffers: Buffer[] = []
  for (const chunk of chunks) {
    const buf = await synthesizeSpeech(chunk, voiceId, { strict: false })
    buffers.push(buf)
  }
  return Buffer.concat(buffers)
}

export function splitAtSentenceBoundary(text: string, maxLen: number): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]
  const chunks: string[] = []
  let current = ''
  for (const sentence of sentences) {
    if ((current + sentence).length > maxLen) {
      if (current) chunks.push(current.trim())
      current = sentence
    } else {
      current += sentence
    }
  }
  if (current) chunks.push(current.trim())
  return chunks
}

/**
 * Generate a valid silent MP3 using OpenAI TTS with a pause.
 * Falls back to a minimal valid MP3 if that also fails.
 */
async function generateSilence(originalText: string): Promise<Buffer> {
  // Try generating a very short TTS clip with just "..." as a pause
  try {
    const openai = getClient()
    const response = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'alloy',
      input: '...',
      response_format: 'mp3',
      speed: 1.0,
    })
    const buf = Buffer.from(await response.arrayBuffer())
    if (buf.length > 100) {
      console.log(`[tts] Generated pause audio as fallback (${buf.length} bytes)`)
      return buf
    }
  } catch {
    console.error('[tts] Fallback pause generation also failed')
  }

  // Last resort: return a minimal valid MP3 file header
  const silence = Buffer.alloc(417)
  silence[0] = 0xFF
  silence[1] = 0xFB
  silence[2] = 0x90
  silence[3] = 0x00
  const frames: Buffer[] = []
  for (let i = 0; i < 76; i++) frames.push(Buffer.from(silence))
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
