/**
 * FAL TTS — the PRIMARY narration voice on the website side (2026-10-09).
 *
 * OpenAI TTS ran out of credits and ElevenLabs-direct answered
 * "payment_required" on the same day. fal.ai sells the SAME ElevenLabs voices
 * (turbo v2.5, the model we already used) on the fal bill, so app/_lib/tts.ts
 * now tries fal first, then ElevenLabs direct, then OpenAI.
 *
 * Plain fetch to fal's synchronous endpoint (fal.run) — no client package.
 * fal can answer 200 with no usable result (its queue even reports COMPLETED
 * on validation failures), so a call only counts when the JSON carries an
 * audio URL AND that URL downloads to real audio bytes (>1 KB, mp3/wav).
 *
 * COST: $0.05 per 1,000 characters (fal pricing, turbo-v2.5).
 * Mirrors render-service/fal-tts.js — keep the two in step (a test checks the
 * voice maps match).
 */
import { OPENAI_VOICES } from './voice-choice'

export const FAL_TTS_MODEL = process.env.FAL_TTS_MODEL || 'fal-ai/elevenlabs/tts/turbo-v2.5'
const FAL_BASE = 'https://fal.run'

/**
 * Wizard voice id (VOICE_OPTIONS — OpenAI-named for history) → the ElevenLabs
 * voice fal speaks it with. nova ("Sarah", the female default) = Rachel, the
 * exact voice production narration already used.
 */
export const FAL_VOICE_MAP: Record<(typeof OPENAI_VOICES)[number], string> = {
  nova: 'Rachel',    // Sarah — friendly female default
  shimmer: 'Sarah',  // Emily — warm, gentle female
  onyx: 'Brian',     // James — deep, authoritative male
  echo: 'Chris',     // Michael — warm, conversational male
  alloy: 'River',    // Alex — balanced, neutral
  fable: 'George',   // Oliver — British, expressive male
}

export function falVoiceFor(voiceId: unknown): string {
  return (typeof voiceId === 'string' && (FAL_VOICE_MAP as Record<string, string>)[voiceId]) || FAL_VOICE_MAP.nova
}

/** True when the bytes are a real mp3 (ID3 tag or MPEG frame sync) or a WAV. */
export function isRealAudio(buf: Buffer | null | undefined): boolean {
  if (!buf || buf.length < 1024) return false
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return true
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return true
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WAVE') return true
  return false
}

export type FalWord = { w: string; start: number; end: number }

type Alignment = { characters?: string[]; character_start_times_seconds?: number[]; character_end_times_seconds?: number[] }

/** fal's timestamps (a list of character-alignment chunks) → words with start/end seconds. */
export function wordsFromFalTimestamps(ts: unknown): FalWord[] {
  const list: Alignment[] = Array.isArray(ts) ? ts : ts && typeof ts === 'object' ? [ts as Alignment] : []
  const words: FalWord[] = []
  let offset = 0
  let lastEnd = 0
  for (const chunk of list) {
    const c = chunk?.characters, s = chunk?.character_start_times_seconds, e = chunk?.character_end_times_seconds
    if (!Array.isArray(c) || !Array.isArray(s) || !Array.isArray(e) || !c.length) continue
    if (words.length && (s[0] ?? 0) + offset < lastEnd - 0.05) offset = lastEnd
    let cur = '', st = -1, en = lastEnd
    const flush = () => { if (cur.trim()) words.push({ w: cur.trim(), start: st < 0 ? en : st, end: en }); cur = ''; st = -1 }
    for (let i = 0; i < c.length; i++) {
      const ch = c[i]
      if (/\s/.test(ch)) { flush(); en = (e[i] ?? en - offset) + offset; continue }
      if (st < 0) st = (s[i] ?? 0) + offset
      cur += ch
      en = (e[i] ?? en - offset) + offset
    }
    flush()
    lastEnd = en
  }
  return words
}

class FalError extends Error {
  constructor(message: string, public status?: number) { super(message) }
}

function retryable(err: unknown): boolean {
  const st = (err as FalError)?.status
  if (st === 429 || (st !== undefined && st >= 500 && st < 600)) return true
  if (st !== undefined && st >= 400 && st < 500) return false // bad key / validation — fall back now
  return true
}

export type FalSpeakOptions = {
  voiceId?: string
  timestamps?: boolean
  settings?: { stability?: number; similarity_boost?: number; style?: number; speed?: number }
  attempts?: number
  timeoutMs?: number
  backoffMs?: number
  fetchImpl?: typeof fetch
}

/**
 * Speak already-speakable() text with fal. Throws on ANY doubt (no key, HTTP
 * error, no audio URL, bytes that aren't audio) so the caller falls back.
 */
export async function falSpeak(text: string, opts: FalSpeakOptions = {}): Promise<{ audio: Buffer; words: FalWord[] | null; voice: string; ms: number }> {
  const key = process.env.FAL_KEY
  if (!key) throw new Error('FAL_KEY is not set')
  const spoken = String(text || '').trim()
  if (!spoken) throw new Error('fal TTS: empty text')
  const doFetch = opts.fetchImpl || fetch
  const attempts = Math.max(1, opts.attempts ?? 3)
  const backoff = opts.backoffMs ?? 1000
  const timeoutMs = opts.timeoutMs ?? 45000
  const voice = falVoiceFor(opts.voiceId)
  const s = opts.settings || {}
  const body = {
    text: spoken,
    voice,
    stability: s.stability ?? 0.5,
    similarity_boost: s.similarity_boost ?? 0.75,
    ...(s.style != null ? { style: s.style } : {}),
    ...(s.speed != null ? { speed: s.speed } : {}),
    ...(opts.timestamps ? { timestamps: true } : {}),
  }
  const t0 = Date.now()
  let lastErr: unknown = null
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await doFetch(`${FAL_BASE}/${FAL_TTS_MODEL}`, {
        method: 'POST',
        headers: { authorization: `Key ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      })
      const json = (await res.json().catch(() => ({}))) as { audio?: { url?: string }; timestamps?: unknown; detail?: unknown; error?: unknown }
      if (!res.ok) {
        const why = json?.detail ?? json?.error ?? ''
        throw new FalError(`fal TTS ${res.status}: ${(typeof why === 'string' ? why : JSON.stringify(why)).slice(0, 200)}`, res.status)
      }
      const url = json?.audio?.url
      if (!url) throw new FalError('fal TTS: answered OK but no audio URL (treating as a failure)')
      const dl = await doFetch(url, { signal: AbortSignal.timeout(30000) })
      if (!dl.ok) throw new FalError(`fal TTS audio download ${dl.status}`)
      const audio = Buffer.from(await dl.arrayBuffer())
      if (!isRealAudio(audio)) throw new FalError(`fal TTS: result is not real audio (${audio.length} bytes)`)
      const words = opts.timestamps && json.timestamps ? wordsFromFalTimestamps(json.timestamps) : []
      return { audio, words: words.length ? words : null, voice, ms: Date.now() - t0 }
    } catch (err) {
      lastErr = err
      if (attempt < attempts && retryable(err)) {
        console.warn(`[fal-tts] attempt ${attempt}/${attempts} failed (${err instanceof Error ? err.message : err}) — retrying`)
        await new Promise((r) => setTimeout(r, backoff * 2 ** (attempt - 1)))
        continue
      }
      break
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('fal TTS failed')
}
