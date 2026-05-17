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
  const geminiVoice = VOICE_MAP[voiceId] || 'Kore'

  // Retry up to 3 times with backoff
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await genai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{
          role: 'user',
          parts: [{ text: `Read this text aloud in a natural, professional tone. Speak clearly and at a measured pace suitable for a presentation narration:\n\n${text.slice(0, 5000)}` }],
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
          const buffer = Buffer.from(part.inlineData.data!, 'base64')
          if (buffer.length < 100) {
            throw new Error(`TTS returned suspiciously small audio: ${buffer.length} bytes`)
          }
          return buffer
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
