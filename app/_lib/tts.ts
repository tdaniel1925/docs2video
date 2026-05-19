import { GoogleGenAI } from '@google/genai'

let genaiClient: GoogleGenAI | null = null

function getClient(): GoogleGenAI {
  if (!genaiClient) {
    genaiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
  }
  return genaiClient
}

/**
 * Convert raw PCM audio (24kHz, 16-bit, mono) to WAV buffer.
 * Gemini TTS returns raw PCM — FFmpeg needs a proper container.
 */
function pcmToWav(pcmData: Buffer, sampleRate = 24000, channels = 1, bitsPerSample = 16): Buffer {
  const byteRate = sampleRate * channels * (bitsPerSample / 8)
  const blockAlign = channels * (bitsPerSample / 8)
  const dataSize = pcmData.length
  const headerSize = 44
  const buffer = Buffer.alloc(headerSize + dataSize)

  // RIFF header
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)

  // fmt chunk
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16) // chunk size
  buffer.writeUInt16LE(1, 20) // PCM format
  buffer.writeUInt16LE(channels, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(byteRate, 28)
  buffer.writeUInt16LE(blockAlign, 32)
  buffer.writeUInt16LE(bitsPerSample, 34)

  // data chunk
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)
  pcmData.copy(buffer, headerSize)

  return buffer
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

  const client = getClient()

  // Retry up to 3 times with backoff
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await client.models.generateContent({
        model: 'gemini-3.1-flash-tts-preview',
        contents: [{ parts: [{ text: text.slice(0, 8000) }] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceId },
            },
          },
        } as any,
      })

      const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data
      if (!audioData) {
        throw new Error('Gemini TTS returned no audio data')
      }

      const pcmBuffer = Buffer.from(audioData, 'base64')

      // Verify we got actual audio
      if (pcmBuffer.length < 100) {
        throw new Error(`TTS returned suspiciously small audio: ${pcmBuffer.length} bytes`)
      }

      // Convert raw PCM to WAV so FFmpeg can handle it
      const wavBuffer = pcmToWav(pcmBuffer)
      console.log(`[tts] Generated ${(wavBuffer.length / 1024).toFixed(0)}KB WAV for "${text.slice(0, 40)}..."`)
      return wavBuffer
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
 * Generate a minimal valid WAV silence buffer.
 */
function generateSilence(): Buffer {
  // 1 second of silence at 24kHz, 16-bit mono
  const sampleRate = 24000
  const duration = 1 // seconds
  const pcmData = Buffer.alloc(sampleRate * 2 * duration) // 16-bit = 2 bytes per sample
  return pcmToWav(pcmData, sampleRate)
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
