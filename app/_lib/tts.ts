import OpenAI from 'openai'
import { normalizeVoice, ttsOrder, type OpenAIVoice } from './voice-choice'
import { falSpeak } from './fal-tts'

const TTS_MAX_CHARS = 4096

// Voice engine order: fal.ai FIRST (fal-tts.ts — the same ElevenLabs voices,
// the customer's pick mapped by FAL_VOICE_MAP), then the old pair below
// (voice-choice.ts ttsOrder — the same rule every look uses):
//  - Sarah (nova) or nothing picked: ElevenLabs Rachel first (a warm female
//    voice, matches the female-default rule), OpenAI Sarah as the fallback.
//  - any other voice picked: that OpenAI voice first, ElevenLabs as the
//    fallback. Before this, ElevenLabs always went first, so the voice the
//    customer picked was only heard when ElevenLabs happened to be down.
// Either provider failing never kills a render — we try the other.
const ELEVEN_API_KEY = process.env.ELEVENLABS_API_KEY
const ELEVEN_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM' // Rachel
const ELEVEN_MODEL = process.env.ELEVENLABS_MODEL || 'eleven_turbo_v2_5'

let client: OpenAI | null = null

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  }
  return client
}

/**
 * Normalize text so TTS SPEAKS symbols instead of mangling them — ElevenLabs
 * reads a literal "$176,204" badly. Convert money/percent before synthesis.
 */
export function speakable(text: string): string {
  if (!text) return text
  let t = String(text)
  // Pipe separators (contact globs like "555 | a@b.com | site.com") → commas.
  t = t.replace(/\s*\|\s*/g, ', ')
  // Emails → "name at domain dot tld" (before URL handling — emails contain domains).
  t = t.replace(/\b([a-z0-9._%+-]+)@([a-z0-9.-]+)\.([a-z]{2,})\b/gi, (_m, u: string, d: string, tld: string) =>
    `${u.replace(/\./g, ' dot ')} at ${d.replace(/\./g, ' dot ')} dot ${tld}`)
  // Bare domains/URLs → "domain dot tld" (common TLDs only, so normal sentences
  // with periods are never touched).
  t = t.replace(/\b(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|io|ai|co|app|us|info|biz))\b/gi,
    (_m, dom: string) => dom.replace(/\./g, ' dot '))
  // Phone numbers → digit groups spoken one at a time ("9 3 6, 6 4 1, 7 1 3 0").
  t = t.replace(/(?:\+?1[\s.-]?)?\(?\b(\d{3})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})\b/g, (_m, a: string, b: string, c: string) =>
    `${a.split('').join(' ')}, ${b.split('').join(' ')}, ${c.split('').join(' ')}`)
  t = t.replace(/\$\s?([\d,]+(?:\.\d+)?)\s?(k|m|b|thousand|million|billion)?/gi, (_m, num: string, unit?: string) => {
    const n = num.replace(/,/g, '')
    const u = (unit || '').toLowerCase()
    const word = u === 'k' || u === 'thousand' ? ' thousand'
      : u === 'm' || u === 'million' ? ' million'
      : u === 'b' || u === 'billion' ? ' billion' : ''
    return `${n}${word} dollars`
  })
  t = t.replace(/(\d(?:[\d,.]*\d)?)\s?%/g, '$1 percent')
  t = t.replace(/\$/g, ' dollars ')
  // Ensure a space after an injected "dollars"/"percent" when the source ran the
  // next token right up against the number ("$X at" → "...dollars at", not
  // "dollarsat"; "$X&" → "dollars &"). Do this BEFORE the & → "and" rewrite.
  t = t.replace(/\b(dollars|percent)(?=[^\s.,!?])/gi, '$1 ')
  t = t.replace(/\s?&\s?/g, ' and ')
  t = t.replace(/\s+/g, ' ').trim()
  // Trailing punctuation so the engine doesn't clip the last word.
  if (t && !/[.!?]$/.test(t)) t += '.'
  return t
}

/** ElevenLabs TTS → mp3 Buffer. Throws on any error so the caller can fall back. */
async function elevenSpeak(text: string): Promise<Buffer> {
  if (!ELEVEN_API_KEY) throw new Error('ELEVENLABS_API_KEY not set')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE_ID}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': ELEVEN_API_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: ELEVEN_MODEL, voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
      signal: controller.signal as any,
    })
    if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`)
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 100) throw new Error(`ElevenLabs returned tiny audio: ${buf.length} bytes`)
    return buf
  } finally {
    clearTimeout(timeout)
  }
}

export async function synthesizeSpeech(
  text: string,
  voiceId: string,
  options: { strict?: boolean } = {}
): Promise<Buffer> {
  // Guard against empty/whitespace narration
  if (!text?.trim()) {
    console.log('[tts] Empty narration text, generating brief silence')
    return generateBriefSilence()
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

  // Normalize money/percent/symbols + add a trailing pause so any engine speaks
  // it correctly and doesn't clip the last word.
  text = speakable(text)

  const voice = normalizeVoice(voiceId)
  let lastError: Error | null = null
  // PRIMARY (2026-10-09): fal.ai — the same ElevenLabs voices, in the voice the
  // customer picked (fal-tts.ts FAL_VOICE_MAP). Retries + a real-audio check
  // live in falSpeak; any failure drops to the old chain below.
  if (process.env.FAL_KEY) {
    try {
      return (await falSpeak(text, { voiceId: voice })).audio
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      console.warn(`[tts] fal voice failed (${lastError.message}) — trying ElevenLabs/OpenAI`)
    }
  }
  for (const provider of ttsOrder(voice)) {
    if (provider === 'elevenlabs') {
      if (!ELEVEN_API_KEY) continue
      try {
        return await elevenSpeak(text)
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        console.warn(`[tts] ElevenLabs failed (${lastError.message}) — trying the other voice service`)
      }
    } else {
      try {
        return await openaiSpeak(text, voice)
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        console.warn(`[tts] OpenAI voice "${voice}" failed (${lastError.message}) — trying the other voice service`)
      }
    }
  }

  // Both providers failed — throw instead of silently substituting silence.
  throw new Error(`TTS failed (fal + ElevenLabs + OpenAI). Last error: ${lastError?.message || 'Unknown error'}`)
}

/** OpenAI TTS-HD in the given voice — up to 3 tries with backoff, 30s each. */
async function openaiSpeak(text: string, voice: OpenAIVoice): Promise<Buffer> {
  const openai = getClient()
  let lastError: Error | null = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30000) // 30s timeout

      const response = await openai.audio.speech.create(
        {
          model: 'tts-1-hd',
          voice,
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
      lastError = err instanceof Error ? err : new Error(String(err))
      console.error(`[tts] Attempt ${attempt}/3 failed for text "${text.slice(0, 50)}...": ${lastError.message}`)
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 1000 * attempt))
      }
    }
  }

  throw lastError || new Error('OpenAI TTS failed')
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
 * Generate brief silence for intentionally empty narration scenes.
 * Uses OpenAI TTS with "..." to produce a valid short audio clip.
 * NOT used as error fallback — TTS errors should propagate.
 */
async function generateBriefSilence(): Promise<Buffer> {
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
      console.log(`[tts] Generated brief silence (${buf.length} bytes)`)
      return buf
    }
  } catch {
    console.warn('[tts] Could not generate brief silence via TTS')
  }

  // Return empty buffer — FFmpeg can handle zero-length audio segments
  return Buffer.alloc(0)
}

export async function synthesizeAllScenes(
  scenes: Array<{ narration: string }>,
  voiceId: string
): Promise<Buffer[]> {
  const buffers: Buffer[] = []
  const failures: { sceneIndex: number; error: string }[] = []

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i]
    try {
      if (!scene.narration?.trim()) {
        // Intentionally empty narration — generate brief silence
        try {
          const openai = getClient()
          const response = await openai.audio.speech.create({
            model: 'tts-1',
            voice: 'alloy',
            input: '...',
            response_format: 'mp3',
            speed: 1.0,
          })
          buffers.push(Buffer.from(await response.arrayBuffer()))
        } catch {
          // If even "..." fails, push a minimal valid buffer
          // But log it — this shouldn't happen often
          console.warn(`[tts] Could not generate silence for empty scene ${i + 1}`)
          buffers.push(Buffer.alloc(0)) // Will be handled by FFmpeg
        }
        continue
      }
      const buf = await synthesizeSpeech(scene.narration, voiceId)
      buffers.push(buf)
    } catch (err: any) {
      failures.push({ sceneIndex: i + 1, error: err.message })
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `TTS synthesis failed for ${failures.length} scene(s): ${failures.map(f => `Scene ${f.sceneIndex}: ${f.error}`).join('; ')}`
    )
  }

  return buffers
}
