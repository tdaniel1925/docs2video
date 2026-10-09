// =============================================================================
// FAL TTS — the PRIMARY narration voice for every render path (2026-10-09).
//
// Why: OpenAI TTS ran out of credits and ElevenLabs-direct answered
// "payment_required" on the same day, so every narrated video was silent or
// failing. fal.ai resells the SAME ElevenLabs voices (turbo v2.5 — the model
// we already used) on the fal bill, and it returns per-character timings, so
// the Slide Deck / Kit word sync keeps exact timings instead of estimates.
//
// Order everywhere now: fal (this file) → ElevenLabs direct → OpenAI.
//
// Plain fetch to fal's synchronous endpoint (fal.run) — no client package.
// fal can answer 200 with no usable result (its queue even reports COMPLETED
// on validation failures), so a call only counts when the JSON carries an
// audio URL AND that URL downloads to real audio bytes (>1 KB, mp3/wav magic).
//
// COST: $0.05 per 1,000 characters (fal pricing page, turbo-v2.5).
// The app side mirrors this in app/_lib/fal-tts.ts — keep the two in step.
// =============================================================================

const FAL_BASE = 'https://fal.run'
const FAL_TTS_MODEL = process.env.FAL_TTS_MODEL || 'fal-ai/elevenlabs/tts/turbo-v2.5'

/**
 * Wizard voice id (the six VOICE_OPTIONS ids, OpenAI-named for history) → the
 * ElevenLabs voice fal speaks it with.
 *  nova   "Sarah"   (female, default) → Rachel — the exact voice production
 *                                        narration already used (ElevenLabs
 *                                        primary since 2026-06-25)
 *  shimmer "Emily"  (female, warm/gentle)  → Sarah (soft young female)
 *  onyx   "James"   (male, deep/authoritative) → Brian (deep narration male)
 *  echo   "Michael" (male, warm conversational) → Chris (casual conversational male)
 *  alloy  "Alex"    (neutral, balanced)    → River (neutral, calm)
 *  fable  "Oliver"  (male, British expressive) → George (warm British male)
 */
const FAL_VOICE_MAP = {
  nova: 'Rachel',
  shimmer: 'Sarah',
  onyx: 'Brian',
  echo: 'Chris',
  alloy: 'River',
  fable: 'George',
}

/** fal voice for a wizard voice id; anything unknown/missing → Rachel (the female default). */
function falVoiceFor(voiceId) {
  return (typeof voiceId === 'string' && FAL_VOICE_MAP[voiceId]) || FAL_VOICE_MAP.nova
}

const falKey = () => process.env.FAL_KEY || ''

/** True when the bytes are a real mp3 (ID3 tag or MPEG frame sync) or a WAV. */
function isRealAudio(buf) {
  if (!buf || buf.length < 1024) return false
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return true // "ID3"
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return true            // MPEG frame sync
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WAVE') return true
  return false
}

/** Characters + start/end seconds → [{ w, start, end }] (same rule slides.js uses for ElevenLabs). */
function charsToWords(chars, starts, ends) {
  const words = []; let cur = '', s = -1, e = 0
  const flush = () => { if (cur.trim()) words.push({ w: cur.trim(), start: s < 0 ? e : s, end: e }); cur = ''; s = -1 }
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]
    if (/\s/.test(c)) { flush(); e = ends[i] ?? e; continue }
    if (s < 0) s = starts[i] ?? e
    cur += c; e = ends[i] ?? e
  }
  flush(); return words
}

/**
 * fal's `timestamps` is a LIST of alignment chunks ({characters,
 * character_start_times_seconds, character_end_times_seconds}). One chunk for
 * normal clips; if a long clip comes back in several and a chunk restarts at
 * 0, it is shifted to follow the previous one so times only ever go forward.
 */
function wordsFromFalTimestamps(ts) {
  const list = Array.isArray(ts) ? ts : ts && typeof ts === 'object' ? [ts] : []
  const chars = [], starts = [], ends = []
  let offset = 0, lastEnd = 0
  for (const chunk of list) {
    const c = chunk && (chunk.characters || chunk.chars)
    const s = chunk && chunk.character_start_times_seconds
    const e = chunk && chunk.character_end_times_seconds
    if (!Array.isArray(c) || !Array.isArray(s) || !Array.isArray(e) || !c.length) continue
    if (chars.length && (s[0] ?? 0) + offset < lastEnd - 0.05) offset = lastEnd
    for (let i = 0; i < c.length; i++) {
      chars.push(c[i]); starts.push((s[i] ?? 0) + offset); ends.push((e[i] ?? 0) + offset)
    }
    lastEnd = ends[ends.length - 1] ?? lastEnd
    // a chunk boundary is a word boundary
    chars.push(' '); starts.push(lastEnd); ends.push(lastEnd)
  }
  return charsToWords(chars, starts, ends)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * LOUDNESS. fal's ElevenLabs voices do not come out at one level — measured
 * 2026-10-09: Rachel −23.5 LUFS, Brian −21.9, Sarah −15.5. The mixes expect
 * narration around −16 LUFS (kit.js normalizeVoice, present-export.js), so
 * every fal clip is brought to −16 LUFS / −1.5 dBTP here, once, in memory
 * (same filter as kit.js normalizeVoice, so a kit clip normalised twice stays
 * put). Mono 44.1 kHz mp3 like ElevenLabs-direct. Duration is unchanged, so
 * the word timings still line up. If ffmpeg is missing or fails, the original
 * clip is kept — a quieter voice beats no voice.
 */
const TARGET_LUFS = -16
function loudnorm(buf) {
  return new Promise((resolve) => {
    let child
    try {
      child = require('child_process').spawn('ffmpeg', ['-v', 'error', '-i', 'pipe:0', '-af', `loudnorm=I=${TARGET_LUFS}:TP=-1.5:LRA=11`, '-ar', '44100', '-ac', '1', '-b:a', '160k', '-f', 'mp3', 'pipe:1'], { stdio: ['pipe', 'pipe', 'pipe'] })
    } catch (e) { console.warn(`[fal-tts] loudness not normalised (${e.message})`); return resolve(buf) }
    const out = []; let err = ''
    const timer = setTimeout(() => { try { child.kill('SIGKILL') } catch {} }, 30000)
    child.stdout.on('data', (d) => out.push(d))
    child.stderr.on('data', (d) => { err += d })
    child.on('error', (e) => { clearTimeout(timer); console.warn(`[fal-tts] loudness not normalised (${e.message})`); resolve(buf) })
    child.on('close', (code) => {
      clearTimeout(timer)
      const res = Buffer.concat(out)
      if (code === 0 && isRealAudio(res)) resolve(res)
      else { console.warn(`[fal-tts] loudness not normalised (ffmpeg ${code}: ${err.slice(0, 120)})`); resolve(buf) }
    })
    child.stdin.on('error', () => {})
    child.stdin.end(buf)
  })
}

/** Errors worth another try: rate limits, fal/server hiccups, timeouts, network, missing audio. */
function retryable(err) {
  const st = err && err.status
  if (st === 429 || (st >= 500 && st < 600)) return true
  if (st >= 400 && st < 500) return false // bad key / validation — another try won't help, fall back now
  return true
}

/**
 * Speak `text` with fal. Text should already be speakable() — this does not
 * rewrite it. Throws on ANY doubt so the caller falls back.
 *
 * @param {string} text
 * @param {{ voiceId?: string, timestamps?: boolean, settings?: object,
 *           attempts?: number, timeoutMs?: number, fetchImpl?: Function, backoffMs?: number,
 *           normalize?: boolean }} [opts]   normalize (default on): bring the clip to -16 LUFS
 * @returns {Promise<{ audio: Buffer, words: Array<{w:string,start:number,end:number}>|null, voice: string, model: string, ms: number }>}
 */
async function falSpeak(text, opts = {}) {
  const key = falKey()
  if (!key) throw new Error('FAL_KEY is not set')
  const spoken = String(text || '').trim()
  if (!spoken) throw new Error('fal TTS: empty text')
  const doFetch = opts.fetchImpl || fetch
  const attempts = Math.max(1, opts.attempts || 3)
  const backoff = opts.backoffMs ?? 1000
  const timeoutMs = opts.timeoutMs || 45000
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
  let lastErr = null
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await doFetch(`${FAL_BASE}/${FAL_TTS_MODEL}`, {
        method: 'POST',
        headers: { authorization: `Key ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        const why = json && (json.detail ?? json.error ?? json.message)
        const err = new Error(`fal TTS ${res.status}: ${String(typeof why === 'string' ? why : JSON.stringify(why || '')).slice(0, 200)}`)
        err.status = res.status
        throw err
      }
      const url = json && json.audio && json.audio.url
      if (!url) throw new Error('fal TTS: answered OK but no audio URL (treating as a failure)')
      const dl = await doFetch(url, { signal: AbortSignal.timeout(30000) })
      if (!dl.ok) { const err = new Error(`fal TTS audio download ${dl.status}`); throw err }
      const audio = Buffer.from(await dl.arrayBuffer())
      if (!isRealAudio(audio)) throw new Error(`fal TTS: result is not real audio (${audio.length} bytes)`)
      const finalAudio = opts.normalize === false ? audio : await loudnorm(audio)
      let words = null
      if (opts.timestamps && json.timestamps) {
        const w = wordsFromFalTimestamps(json.timestamps)
        words = w.length ? w : null
      }
      return { audio: finalAudio, words, voice, model: FAL_TTS_MODEL, ms: Date.now() - t0 }
    } catch (err) {
      lastErr = err
      if (attempt < attempts && retryable(err)) {
        console.warn(`[fal-tts] attempt ${attempt}/${attempts} failed (${err && err.message}) — retrying`)
        await sleep(backoff * 2 ** (attempt - 1))
        continue
      }
      break
    }
  }
  throw lastErr || new Error('fal TTS failed')
}

module.exports = { falSpeak, falVoiceFor, FAL_VOICE_MAP, FAL_TTS_MODEL, isRealAudio, wordsFromFalTimestamps, charsToWords, loudnorm, TARGET_LUFS }
