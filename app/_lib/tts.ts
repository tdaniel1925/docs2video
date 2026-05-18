import { GoogleGenAI } from '@google/genai'

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

/**
 * Map our voice IDs to Gemini TTS voice names.
 * Gemini supports: Zephyr, Puck, Charon, Kore, Fenrir, Leda, Orus, Aoede
 * See: https://ai.google.dev/gemini-api/docs/text-to-speech
 */
const VOICE_MAP: Record<string, string> = {
  nova: 'Kore',       // Female, friendly and warm
  shimmer: 'Leda',    // Female, gentle
  onyx: 'Charon',     // Male, deep and authoritative
  echo: 'Puck',       // Male, warm and conversational
  alloy: 'Zephyr',    // Neutral, professional
  fable: 'Orus',      // Male, expressive
}

export async function synthesizeSpeech(
  text: string,
  voiceId: string
): Promise<Buffer> {
  // Guard against empty/whitespace narration
  if (!text?.trim()) {
    console.log('[tts] Empty narration text, generating silence')
    return generateSilence()
  }

  const geminiVoice = VOICE_MAP[voiceId] || 'Kore'

  // Retry up to 3 times with backoff
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await genai.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: [{
          role: 'user',
          parts: [{ text: text.slice(0, 5000) }],
        }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: geminiVoice,
              },
            },
          },
        } as any,
      })

      // Extract audio data from response
      const parts = response.candidates?.[0]?.content?.parts ?? []
      for (const part of parts) {
        if (part.inlineData?.mimeType?.startsWith('audio/')) {
          const pcmBuffer = Buffer.from(part.inlineData.data!, 'base64')
          if (pcmBuffer.length < 100) {
            throw new Error(`TTS returned suspiciously small audio: ${pcmBuffer.length} bytes`)
          }
          // Gemini returns raw PCM (L16, 24kHz, mono) — encode to MP3 for smaller transfer
          return pcmToMp3(pcmBuffer, 24000)
        }
      }

      throw new Error('No audio data in Gemini response')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[tts] Attempt ${attempt}/3 failed for text "${text.slice(0, 50)}...": ${msg}`)
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 1000 * attempt))
      } else {
        console.error(`[tts] All 3 attempts failed, generating silence`)
        return generateSilence()
      }
    }
  }

  return generateSilence()
}

/**
 * Encode raw PCM (16-bit signed, mono) to MP3 using lamejs.
 * Falls back to WAV if encoding fails.
 */
function pcmToMp3(pcmData: Buffer, sampleRate: number): Buffer {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const lamejs = require('lamejs')
    const mp3enc = new lamejs.Mp3Encoder(1, sampleRate, 128) // mono, 128kbps

    // Convert Buffer to Int16Array
    const samples = new Int16Array(pcmData.buffer, pcmData.byteOffset, pcmData.length / 2)

    const mp3Chunks: Buffer[] = []
    const blockSize = 1152
    for (let i = 0; i < samples.length; i += blockSize) {
      const chunk = samples.subarray(i, i + blockSize)
      const mp3buf = mp3enc.encodeBuffer(chunk)
      if (mp3buf.length > 0) mp3Chunks.push(Buffer.from(mp3buf))
    }
    const final = mp3enc.flush()
    if (final.length > 0) mp3Chunks.push(Buffer.from(final))

    const mp3Buffer = Buffer.concat(mp3Chunks)
    console.log(`[tts] PCM ${pcmData.length} bytes → MP3 ${mp3Buffer.length} bytes (${Math.round(mp3Buffer.length / pcmData.length * 100)}%)`)
    return mp3Buffer
  } catch (err) {
    console.error('[tts] MP3 encoding failed, falling back to WAV:', err)
    return wrapPcmInWav(pcmData, sampleRate, 1, 16)
  }
}

/**
 * Wrap raw PCM data in a WAV header (fallback if MP3 encoding fails).
 */
function wrapPcmInWav(pcmData: Buffer, sampleRate: number, channels: number, bitsPerSample: number): Buffer {
  const byteRate = sampleRate * channels * (bitsPerSample / 8)
  const blockAlign = channels * (bitsPerSample / 8)
  const dataSize = pcmData.length
  const headerSize = 44
  const header = Buffer.alloc(headerSize)

  // RIFF header
  header.write('RIFF', 0)
  header.writeUInt32LE(dataSize + headerSize - 8, 4)
  header.write('WAVE', 8)

  // fmt subchunk
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)          // subchunk size
  header.writeUInt16LE(1, 20)           // PCM format
  header.writeUInt16LE(channels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitsPerSample, 34)

  // data subchunk
  header.write('data', 36)
  header.writeUInt32LE(dataSize, 40)

  return Buffer.concat([header, pcmData])
}

/**
 * Generate a minimal valid MP3 silence as last-resort fallback.
 */
function generateSilence(): Buffer {
  // Minimal valid MP3 frame header repeated for ~2 seconds of silence
  const frame = Buffer.alloc(417)
  frame[0] = 0xFF
  frame[1] = 0xFB
  frame[2] = 0x90
  frame[3] = 0x00
  const frames: Buffer[] = []
  for (let i = 0; i < 76; i++) frames.push(Buffer.from(frame))
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
