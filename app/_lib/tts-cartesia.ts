import { synthesizeSpeech } from './tts'

// Same voice mapping the VPS uses (vps/server.js cartesiaTTS) so v2 narration
// sounds identical to v1: Cartesia sonic-2 first, OpenAI TTS as fallback.
const CARTESIA_VOICES: Record<string, string> = {
  nova: 'f9fc912e-52f0-448a-8bfa-47e9ca75f25a',     // Marilyn - smooth supportive female narrator
  shimmer: '58fbaf73-d7de-4e82-a6b3-118180e7057c',  // Janet - bright warm female
  onyx: '8d110413-2f14-44a2-8203-2104db4340e9',     // Darren - deep friendly baritone male
  echo: 'd46abd1d-2d02-43e8-819f-51fb652c1c61',     // Grant - reliable clear American male
  alloy: 'cc00e582-ed66-4004-8336-0175b85c85f6',    // Dana - balanced neutral female
  fable: 'ab109683-f31f-40d7-b264-9ec3e26fb85e',    // Russell - friendly deep mentor male
  ash: '820a3788-2b37-4d21-847a-b65d8a68c99a',      // Tyler - direct confident male
  coral: '829ccd10-f8b3-43cd-b8a0-4aeaa81f3b30',    // Linda - clear confident mature female
}

async function cartesiaTTS(text: string, voiceId: string): Promise<Buffer> {
  const apiKey = process.env.CARTESIA_API_KEY
  if (!apiKey) throw new Error('CARTESIA_API_KEY not set')
  const res = await fetch('https://api.cartesia.ai/tts/bytes', {
    method: 'POST',
    headers: {
      'Cartesia-Version': '2024-06-10',
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model_id: 'sonic-2',
      transcript: text,
      voice: { id: CARTESIA_VOICES[voiceId] || CARTESIA_VOICES.nova },
      output_format: { container: 'mp3', bit_rate: 192000, sample_rate: 44100 },
    }),
    signal: AbortSignal.timeout(60000),
  })
  if (!res.ok) throw new Error(`Cartesia TTS failed (HTTP ${res.status})`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 1000) throw new Error('Cartesia returned suspiciously small audio')
  return buf
}

/** Cartesia first (matches VPS voices), OpenAI fallback. */
export async function synthesizeNarration(text: string, voiceId: string): Promise<Buffer> {
  if (!text?.trim()) return synthesizeSpeech(text, voiceId) // brief-silence path
  try {
    return await cartesiaTTS(text, voiceId)
  } catch (err) {
    console.warn('[tts-cartesia] Falling back to OpenAI:', err instanceof Error ? err.message : err)
    return synthesizeSpeech(text, voiceId)
  }
}
