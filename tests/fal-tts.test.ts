import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import { createRequire } from 'module'
import path from 'path'

// fal.ai became the PRIMARY narration voice on 2026-10-09 (OpenAI TTS out of
// credits + ElevenLabs-direct "payment_required" the same day). These tests
// pin the parts that keep a video from going silent or wrong:
//  - a good fal reply → real audio (+ word timings for the slide sync)
//  - fal's "OK but no audio" (its queue even reports COMPLETED on validation
//    failures) is a FAILURE, never a silent clip
//  - fal timing out → the old voice services still speak
//  - every voice on step 3 maps to a fal voice, and Sarah is still Rachel
// No paid calls: every fetch here is a fake.

const ROOT = path.join(__dirname, '..')
const require_ = createRequire(import.meta.url)

/** A fake mp3: ID3 header + enough bytes to pass the >1 KB check. */
function fakeMp3(size = 4096): Uint8Array<ArrayBuffer> {
  const b = new Uint8Array(new ArrayBuffer(size))
  b[0] = 0x49; b[1] = 0x44; b[2] = 0x33
  return b
}

const TIMESTAMPS = [{
  characters: [' ', 'H', 'i', ' ', 't', 'h', 'e', 'r', 'e', '.'],
  character_start_times_seconds: [0, 0.05, 0.1, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5],
  character_end_times_seconds: [0.05, 0.1, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.6],
}]

type Reply = { status?: number; json?: unknown; body?: Uint8Array<ArrayBuffer>; throws?: Error }
/** fetch fake: first call = fal POST, second = audio download. */
function fakeFetch(post: Reply | Reply[], download: Reply = { body: fakeMp3() }) {
  const posts = Array.isArray(post) ? [...post] : null
  const calls: { url: string; body?: unknown }[] = []
  const fn = vi.fn(async (url: string, init?: { body?: string }) => {
    calls.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : undefined })
    const isPost = String(url).startsWith('https://fal.run/')
    const r = isPost ? (posts ? posts.shift() ?? posts[posts.length - 1] : (post as Reply)) : download
    if (!r) throw new Error('no fake reply left')
    if (r.throws) throw r.throws
    if (r.body) return new Response(r.body, { status: r.status ?? 200 })
    return new Response(JSON.stringify(r.json ?? {}), { status: r.status ?? 200, headers: { 'content-type': 'application/json' } })
  })
  return { fn: fn as unknown as typeof fetch, calls }
}

const OK = { json: { audio: { url: 'https://v3.fal.media/files/x/output.mp3' }, timestamps: TIMESTAMPS } }

beforeEach(() => { vi.stubEnv('FAL_KEY', 'test-fal-key') })
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

// ── App helper (app/_lib/fal-tts.ts) ────────────────────────────────────────
describe('app fal-tts', () => {
  it('success: posts to the ElevenLabs-on-fal model in the mapped voice and returns real audio + words', async () => {
    const { falSpeak, FAL_TTS_MODEL } = await import('../app/_lib/fal-tts')
    const f = fakeFetch(OK)
    const r = await falSpeak('Hi there.', { voiceId: 'nova', timestamps: true, fetchImpl: f.fn })
    expect(f.calls[0].url).toBe(`https://fal.run/${FAL_TTS_MODEL}`)
    expect(f.calls[0].body).toMatchObject({ text: 'Hi there.', voice: 'Rachel', timestamps: true })
    expect(r.audio.length).toBe(4096)
    expect(r.voice).toBe('Rachel')
    expect(r.words).toEqual([{ w: 'Hi', start: 0.05, end: 0.2 }, { w: 'there.', start: 0.25, end: 0.6 }])
  })

  it('OK-but-no-audio (the "COMPLETED" lie) is a failure, never a silent clip', async () => {
    const { falSpeak } = await import('../app/_lib/fal-tts')
    const f = fakeFetch({ json: { status: 'COMPLETED' } })
    await expect(falSpeak('Hi.', { fetchImpl: f.fn, backoffMs: 1 })).rejects.toThrow(/no audio URL/)
  })

  it('an audio URL that downloads something that is not audio is a failure', async () => {
    const { falSpeak } = await import('../app/_lib/fal-tts')
    const f = fakeFetch(OK, { body: new TextEncoder().encode('<html>error</html>'.repeat(100)) })
    await expect(falSpeak('Hi.', { fetchImpl: f.fn, backoffMs: 1 })).rejects.toThrow(/not real audio/)
  })

  it('a validation error (422) fails at once — no retries, straight to the fallback', async () => {
    const { falSpeak } = await import('../app/_lib/fal-tts')
    const f = fakeFetch({ status: 422, json: { detail: 'text is required' } })
    await expect(falSpeak('Hi.', { fetchImpl: f.fn, backoffMs: 1 })).rejects.toThrow(/422/)
    expect(f.calls).toHaveLength(1)
  })

  it('a rate limit (429) is retried and then succeeds', async () => {
    const { falSpeak } = await import('../app/_lib/fal-tts')
    const f = fakeFetch([{ status: 429, json: { detail: 'slow down' } }, OK])
    const r = await falSpeak('Hi.', { fetchImpl: f.fn, backoffMs: 1 })
    expect(r.audio.length).toBe(4096)
    expect(f.calls.filter((c) => c.url.startsWith('https://fal.run/'))).toHaveLength(2)
  })

  it('no FAL_KEY → throws so the caller falls back', async () => {
    vi.stubEnv('FAL_KEY', '')
    const { falSpeak } = await import('../app/_lib/fal-tts')
    await expect(falSpeak('Hi.')).rejects.toThrow(/FAL_KEY/)
  })
})

// ── App tts.ts: fal first, old chain behind it ──────────────────────────────
describe('app synthesizeSpeech puts fal first', () => {
  async function load() {
    vi.resetModules()
    vi.stubEnv('ELEVENLABS_API_KEY', 'test-eleven')
    return import('../app/_lib/tts')
  }

  it('fal answers → fal audio, ElevenLabs never called', async () => {
    const f = fakeFetch(OK)
    vi.stubGlobal('fetch', f.fn)
    const { synthesizeSpeech } = await load()
    const buf = await synthesizeSpeech('Your plan, explained.', 'onyx')
    expect(buf.length).toBe(4096)
    expect(f.calls[0].body).toMatchObject({ voice: 'Brian' })
    expect(f.calls.some((c) => c.url.includes('elevenlabs.io'))).toBe(false)
  })

  it('fal times out on every try → ElevenLabs still speaks', async () => {
    const calls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push(String(url))
      if (String(url).startsWith('https://fal.run/')) { const e = new Error('The operation was aborted due to timeout'); e.name = 'TimeoutError'; throw e }
      return new Response(fakeMp3(800), { status: 200 }) // ElevenLabs direct
    }))
    // real backoff (1s + 2s) — fal's own retries before the fallback
    const { synthesizeSpeech } = await load()
    const buf = await synthesizeSpeech('Hello.', 'nova')
    expect(buf.length).toBe(800)
    expect(calls.filter((u) => u.startsWith('https://fal.run/'))).toHaveLength(3) // retried with backoff
    expect(calls.some((u) => u.includes('api.elevenlabs.io'))).toBe(true)
  })

  it('fal says COMPLETED with no audio → falls back instead of shipping silence', async () => {
    const calls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push(String(url))
      if (String(url).startsWith('https://fal.run/')) return new Response(JSON.stringify({ status: 'COMPLETED' }), { status: 200 })
      return new Response(fakeMp3(900), { status: 200 })
    }))
    const { synthesizeSpeech } = await load()
    expect((await synthesizeSpeech('Hello.', 'nova')).length).toBe(900)
    expect(calls.some((u) => u.includes('api.elevenlabs.io'))).toBe(true)
  })
})

// ── Voice mapping ───────────────────────────────────────────────────────────
describe('every step-3 voice has a fal voice', () => {
  it('covers every VOICE_OPTIONS id, Sarah (nova, the default) = Rachel, unknown → Rachel', async () => {
    const { VOICE_OPTIONS } = await import('../app/_lib/types')
    const { FAL_VOICE_MAP, falVoiceFor } = await import('../app/_lib/fal-tts')
    expect(VOICE_OPTIONS[0].id).toBe('nova')
    for (const v of VOICE_OPTIONS) expect(FAL_VOICE_MAP[v.id as keyof typeof FAL_VOICE_MAP], v.id).toBeTruthy()
    expect(falVoiceFor('nova')).toBe('Rachel')
    expect(falVoiceFor(undefined)).toBe('Rachel')
    expect(falVoiceFor('not-a-voice')).toBe('Rachel')
    // female stays female, male stays male
    const female = new Set(['Rachel', 'Sarah']); const male = new Set(['Brian', 'Chris', 'George'])
    for (const v of VOICE_OPTIONS) {
      if (v.gender === 'Female') expect(female.has(falVoiceFor(v.id)), v.id).toBe(true)
      if (v.gender === 'Male') expect(male.has(falVoiceFor(v.id)), v.id).toBe(true)
    }
  })

  it('the render service uses the SAME map as the website', async () => {
    const { FAL_VOICE_MAP } = await import('../app/_lib/fal-tts')
    const svc = require_(path.join(ROOT, 'render-service/fal-tts.js'))
    expect(svc.FAL_VOICE_MAP).toEqual(FAL_VOICE_MAP)
  })
})

// ── Render service helper + its callers ─────────────────────────────────────
describe('render-service fal-tts.js', () => {
  const svc = require_(path.join(ROOT, 'render-service/fal-tts.js'))

  it('success → audio + exact word timings', async () => {
    const f = fakeFetch(OK)
    const r = await svc.falSpeak('Hi there.', { voiceId: 'fable', timestamps: true, fetchImpl: f.fn, normalize: false })
    expect(f.calls[0].body).toMatchObject({ voice: 'George', timestamps: true })
    expect(r.audio.length).toBe(4096)
    expect(r.words).toEqual([{ w: 'Hi', start: 0.05, end: 0.2 }, { w: 'there.', start: 0.25, end: 0.6 }])
  })

  it('COMPLETED-without-audio and timeouts throw (after retries) so the caller falls back', async () => {
    await expect(svc.falSpeak('Hi.', { fetchImpl: fakeFetch({ json: { status: 'COMPLETED' } }).fn, backoffMs: 1, normalize: false })).rejects.toThrow(/no audio URL/)
    const t = Object.assign(new Error('timeout'), { name: 'TimeoutError' })
    const f = fakeFetch({ throws: t })
    await expect(svc.falSpeak('Hi.', { fetchImpl: f.fn, backoffMs: 1, normalize: false })).rejects.toThrow(/timeout/)
    expect(f.calls).toHaveLength(3)
  })

  it('timing chunks that restart at 0 are laid end to end; website + service agree', async () => {
    const chunk = (t0: number) => ({ characters: ['a', 'b', ' ', 'c'], character_start_times_seconds: [t0, t0 + 0.1, t0 + 0.2, t0 + 0.3], character_end_times_seconds: [t0 + 0.1, t0 + 0.2, t0 + 0.3, t0 + 0.4] })
    const ts = [chunk(0), chunk(0)]
    const words = svc.wordsFromFalTimestamps(ts)
    expect(words.map((w: { w: string }) => w.w)).toEqual(['ab', 'c', 'ab', 'c'])
    for (let i = 1; i < words.length; i++) expect(words[i].start).toBeGreaterThanOrEqual(words[i - 1].start)
    expect(words[2].start).toBeCloseTo(0.4, 5)
    const { wordsFromFalTimestamps } = await import('../app/_lib/fal-tts')
    const appWords = wordsFromFalTimestamps(ts)
    expect(appWords.map((w) => w.w)).toEqual(words.map((w: { w: string }) => w.w))
    appWords.forEach((w, i) => { expect(w.start).toBeCloseTo(words[i].start, 6); expect(w.end).toBeCloseTo(words[i].end, 6) })
    expect(wordsFromFalTimestamps(TIMESTAMPS)).toEqual(svc.wordsFromFalTimestamps(TIMESTAMPS))
  })

  it('isRealAudio: mp3 (ID3 / frame sync) and wav pass; tiny or text fails', () => {
    expect(svc.isRealAudio(Buffer.from(fakeMp3()))).toBe(true)
    const sync = Buffer.alloc(2048); sync[0] = 0xff; sync[1] = 0xfb
    expect(svc.isRealAudio(sync)).toBe(true)
    const wav = Buffer.alloc(2048); wav.write('RIFF', 0, 'ascii'); wav.write('WAVE', 8, 'ascii')
    expect(svc.isRealAudio(wav)).toBe(true)
    expect(svc.isRealAudio(Buffer.from(fakeMp3(500)))).toBe(false)
    expect(svc.isRealAudio(Buffer.from('{"detail":"error"}'.repeat(100)))).toBe(false)
  })

  it('slides.js ttsTimed (Slide Deck / Kit / commercials / fix-a-scene) tries fal first', () => {
    const src = readFileSync(path.join(ROOT, 'render-service/slides.js'), 'utf8')
    const body = src.slice(src.indexOf('async function ttsTimed('), src.indexOf('\n}\n', src.indexOf('async function ttsTimed(')))
    expect(body.indexOf('falTimed(')).toBeGreaterThan(0)
    expect(body.indexOf('falTimed(')).toBeLessThan(body.indexOf('elevenTimed('))
    expect(src).toMatch(/falSpeak\(spoken, \{ voiceId, timestamps: true/)
  })

  it('server.js ttsToBuffer (Aurora / Cinematic / Infographic / Editorial / Drawn) tries fal first, then the old chain', async () => {
    const src = readFileSync(path.join(ROOT, 'render-service/server.js'), 'utf8')
    const fnSrc = (name: string) => { const i = src.indexOf(`async function ${name}(`); return src.slice(i, src.indexOf('\n}\n', i) + 2) }
    const voicesLine = (src.match(/const OPENAI_TTS_VOICES = \[[^\]]*\]/) || [''])[0]
    const slides = require_(path.join(ROOT, 'render-service/slides.js'))
    const run = async (falWorks: boolean) => {
      const calls: string[] = []
      const fakeFal = { falSpeak: async (_t: string, o: { voiceId: string }) => { calls.push(`fal:${o.voiceId}`); if (!falWorks) throw new Error('fal down'); return { audio: Buffer.from(fakeMp3()) } } }
      const fakeRequire = (m: string) => (m === './fal-tts' ? fakeFal : m === './slides' ? slides : (() => { throw new Error(`unexpected require ${m}`) })())
      const elevenSpeak = async () => { calls.push('elevenlabs'); return Buffer.alloc(500) }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tts: any = new Function('speakable', 'elevenSpeak', 'require', 'ELEVEN_API_KEY', 'OPENAI_API_KEY',
        `${voicesLine}\n${fnSrc('ttsToBuffer')}\nreturn ttsToBuffer`)((t: string) => t, elevenSpeak, fakeRequire, 'key', 'key')
      const buf = await tts('Hello.', 'nova')
      return { calls, buf }
    }
    const ok = await run(true)
    expect(ok.calls).toEqual(['fal:nova'])
    expect(ok.buf.length).toBe(4096)
    const down = await run(false)
    expect(down.calls).toEqual(['fal:nova', 'elevenlabs'])
  })

  it('the Docker image and build context ship fal-tts.js (else the service crashes on start)', () => {
    expect(readFileSync(path.join(ROOT, 'render-service/Dockerfile'), 'utf8')).toMatch(/COPY fal-tts\.js/)
    const ctx = readFileSync(path.join(ROOT, 'render-service/build-context.sh'), 'utf8')
    expect(ctx).toMatch(/fal-image\.js fal-tts\.js/)
    expect(ctx).toMatch(/need_file fal-tts\.js/)
  })
})
