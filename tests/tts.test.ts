import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { splitAtSentenceBoundary } from '../app/_lib/tts'

/*
 * THE APP VOICE CHAIN (app/_lib/tts.ts), since 2026-10-19:
 *   fal (ElevenLabs voices) → ElevenLabs direct, both in the picked voice.
 * OpenAI is gone (its account ran out of credits). Every test stubs `fetch`,
 * so no run reaches a real voice API or bills anyone. fal itself is tested in
 * fal-tts.test.ts; voice choice in voice-choice-and-header-scrub.test.ts.
 *
 * (Replaces tts-failures.test.ts and tts-primary-voice.test.ts, which tested
 * the OpenAI fallback.)
 */

/** A believable mp3 body (MPEG frame sync), big enough for isRealAudio. */
const mp3 = (bytes = 2048) => new Uint8Array(bytes).fill(0xff)

type Seen = { url: string; text: string }
let seen: Seen[] = []
function stubFetch(answer: (url: string, text: string) => Response | Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: { body?: string }) => {
    let text = ''
    try { text = JSON.parse(String(init?.body ?? '{}')).text ?? '' } catch { /* not JSON */ }
    seen.push({ url: String(url), text })
    return answer(String(url), text)
  }))
}

async function load() {
  vi.resetModules()
  return import('../app/_lib/tts')
}

beforeEach(() => {
  seen = []
  delete process.env.STRICT_MODE
  vi.stubEnv('FAL_KEY', '')
  vi.stubEnv('ELEVENLABS_API_KEY', 'test-key-not-real')
  vi.stubEnv('ELEVENLABS_VOICE_ID', '')
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('synthesizeSpeech', () => {
  it('ElevenLabs direct speaks when fal is off, and nothing else is called', async () => {
    stubFetch(() => new Response(mp3(3000), { status: 200 }))
    const { synthesizeSpeech } = await load()
    const out = await synthesizeSpeech('Hello there.', 'nova')
    expect(out.length).toBe(3000)
    expect(seen).toHaveLength(1)
    expect(seen[0].url).toContain('api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM')
  })

  it('fal first when FAL_KEY is set; ElevenLabs never called when fal answers', async () => {
    vi.stubEnv('FAL_KEY', 'test-fal')
    stubFetch((url) => url.startsWith('https://fal.run/')
      ? new Response(JSON.stringify({ audio: { url: 'https://cdn.fal.test/v.mp3' } }), { status: 200 })
      : new Response(mp3(2500), { status: 200 }))
    const { synthesizeSpeech } = await load()
    expect((await synthesizeSpeech('Hello there.', 'nova')).length).toBe(2500)
    expect(seen.some((s) => s.url.includes('elevenlabs.io'))).toBe(false)
  })

  it('a too-small body is not a voice — it fails rather than ship silence', async () => {
    stubFetch(() => new Response(new Uint8Array(10), { status: 200 }))
    const { synthesizeSpeech } = await load()
    await expect(synthesizeSpeech('Hello there.', 'nova')).rejects.toThrow(/TTS failed \(fal \+ ElevenLabs\).*not real audio/)
  })

  it('a network failure is retried once, then reported', async () => {
    stubFetch(() => { throw new Error('ECONNRESET') })
    const { synthesizeSpeech } = await load()
    await expect(synthesizeSpeech('Hello there.', 'nova')).rejects.toThrow(/ECONNRESET/)
    expect(seen).toHaveLength(2)
  })

  it('a refusal (402 unpaid) fails at once with the reason, never silence', async () => {
    stubFetch(() => new Response('payment_required', { status: 402 }))
    const { synthesizeSpeech } = await load()
    await expect(synthesizeSpeech('Hello there.', 'nova')).rejects.toThrow(/ElevenLabs 402: payment_required/)
    expect(seen).toHaveLength(1)
  })

  it('no voice service configured → throws, calls nothing', async () => {
    vi.stubEnv('ELEVENLABS_API_KEY', '')
    stubFetch(() => new Response(mp3(), { status: 200 }))
    const { synthesizeSpeech } = await load()
    await expect(synthesizeSpeech('Hello there.', 'nova')).rejects.toThrow(/TTS failed/)
    expect(seen).toHaveLength(0)
  })

  it('splits and concatenates text over 4096 chars in non-strict mode', async () => {
    stubFetch(() => new Response(mp3(1500), { status: 200 }))
    const { synthesizeSpeech } = await load()
    const longText = 'This is a test sentence that is moderately long. '.repeat(100)
    expect(longText.length).toBeGreaterThan(4096)
    const out = await synthesizeSpeech(longText, 'nova')
    expect(seen.length).toBeGreaterThan(1)
    expect(out.length).toBe(seen.length * 1500)
  })

  it('throws for text over 4096 chars in strict mode', async () => {
    const { synthesizeSpeech } = await load()
    await expect(synthesizeSpeech('This is a test sentence that is moderately long. '.repeat(100), 'nova', { strict: true }))
      .rejects.toThrow(/TTS text exceeds 4096 char limit/)
  })

  it('empty text → a real silent mp3, made locally (no voice call)', async () => {
    stubFetch(() => new Response(mp3(), { status: 200 }))
    const { synthesizeSpeech } = await load()
    const { isRealAudio } = await import('../app/_lib/fal-tts')
    const out = await synthesizeSpeech('', 'nova')
    expect(isRealAudio(out)).toBe(true)
    expect(seen).toHaveLength(0)
  })
})

describe('synthesizeAllScenes', () => {
  it('returns one buffer per scene; an empty scene gets silence', async () => {
    stubFetch(() => new Response(mp3(1800), { status: 200 }))
    const { synthesizeAllScenes } = await load()
    const out = await synthesizeAllScenes([{ narration: 'One.' }, { narration: '' }, { narration: 'Three.' }], 'nova')
    expect(out).toHaveLength(3)
    expect(out[0].length).toBe(1800)
    expect(out[1].length).toBeGreaterThan(1000)
    expect(seen).toHaveLength(2)
  })

  it('lists every failed scene by number', async () => {
    stubFetch((_url, text) => /one|three/i.test(text) ? new Response('Server error', { status: 400 }) : new Response(mp3(), { status: 200 }))
    const { synthesizeAllScenes } = await load()
    await expect(synthesizeAllScenes([{ narration: 'Scene one.' }, { narration: 'Scene two.' }, { narration: 'Scene three.' }], 'nova'))
      .rejects.toThrow(/TTS synthesis failed for 2 scene\(s\).*Scene 1.*Scene 3/)
  })
})

describe('splitAtSentenceBoundary', () => {
  it('correctly splits at sentence boundaries', () => {
    const chunks = splitAtSentenceBoundary('First sentence. Second sentence. Third sentence. Fourth sentence.', 40)
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(40)
    const combined = chunks.join(' ')
    for (const s of ['First sentence.', 'Second sentence.', 'Third sentence.', 'Fourth sentence.']) expect(combined).toContain(s)
  })

  it('handles text without sentence-ending punctuation', () => {
    const text = 'This is a long block of text without any sentence ending punctuation and it just keeps going on and on'
    expect(splitAtSentenceBoundary(text, 50)).toEqual([text])
  })

  it('handles single sentence under maxLen', () => {
    expect(splitAtSentenceBoundary('Short sentence.', 4000)).toEqual(['Short sentence.'])
  })
})
