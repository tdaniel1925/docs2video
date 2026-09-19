import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * THE PRIMARY VOICE — which nothing tested.
 *
 * tts-failures.test.ts mocks the OpenAI SDK and asserts the retry loop. But
 * OpenAI is the FALLBACK. ElevenLabs is the primary engine and it is called
 * through a bare `fetch`, which that file never stubs — so the test only
 * reached the OpenAI path at all because ELEVENLABS_API_KEY happens to be
 * unset on a developer machine.
 *
 * Two consequences. ElevenLabs could break completely and those five tests
 * would stay green. And on CI, or any machine with the key set, that file
 * calls the real ElevenLabs API and bills for it.
 *
 * These stub `fetch` and set the key deliberately, so the primary path runs
 * in both directions: success, and the fall-through to OpenAI.
 */

const mockCreate = vi.fn()
vi.mock('openai', () => ({
  default: class {
    audio = { speech: { create: mockCreate } }
  },
}))

/** A believable mp3 body — big enough to clear the tiny-audio guard. */
const audio = (bytes = 40_000) => new Uint8Array(bytes).fill(0xff)

const realFetch = globalThis.fetch
const realKey = process.env.ELEVENLABS_API_KEY

describe('ElevenLabs is the primary voice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    /* Set explicitly. Relying on a developer machine's missing key is how the
       primary path came to be untested in the first place. */
    process.env.ELEVENLABS_API_KEY = 'test-key-not-real'
  })

  afterEach(() => {
    globalThis.fetch = realFetch
    if (realKey === undefined) delete process.env.ELEVENLABS_API_KEY
    else process.env.ELEVENLABS_API_KEY = realKey
  })

  it('uses ElevenLabs and never touches OpenAI when it works', async () => {
    const seen: string[] = []
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      seen.push(String(url))
      return new Response(audio(), { status: 200 })
    }) as unknown as typeof fetch

    const { synthesizeSpeech } = await import('../app/_lib/tts')
    const out = await synthesizeSpeech('Hello there.', 'nova')

    expect(seen[0], 'the primary engine was not called').toContain('api.elevenlabs.io')
    expect(mockCreate, 'OpenAI was called even though ElevenLabs succeeded').not.toHaveBeenCalled()
    expect(out.length).toBeGreaterThan(1000)
  })

  it('falls through to OpenAI when ElevenLabs refuses', async () => {
    /* The documented behaviour: a customer who has paid still gets a voice. */
    globalThis.fetch = vi.fn(async () =>
      new Response('rate limited', { status: 429 })) as unknown as typeof fetch
    mockCreate.mockResolvedValue({ arrayBuffer: async () => audio().buffer })

    const { synthesizeSpeech } = await import('../app/_lib/tts')
    const out = await synthesizeSpeech('Hello there.', 'nova')

    expect(mockCreate, 'the fallback never ran').toHaveBeenCalled()
    expect(out.length).toBeGreaterThan(1000)
  })

  it('falls through when ElevenLabs returns audio too small to be real', async () => {
    /*
     * The guard that matters most. A truncated or empty body is not an error
     * status — it is a 200 with a few bytes, and shipping it means a scene
     * with silence where the narration should be.
     */
    globalThis.fetch = vi.fn(async () =>
      new Response(new Uint8Array(10), { status: 200 })) as unknown as typeof fetch
    mockCreate.mockResolvedValue({ arrayBuffer: async () => audio().buffer })

    const { synthesizeSpeech } = await import('../app/_lib/tts')
    const out = await synthesizeSpeech('Hello there.', 'nova')

    expect(mockCreate, 'a near-empty response was accepted as a voice').toHaveBeenCalled()
    expect(out.length).toBeGreaterThan(1000)
  })

  it('falls through when the network itself fails', async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error('ECONNRESET') }) as unknown as typeof fetch
    mockCreate.mockResolvedValue({ arrayBuffer: async () => audio().buffer })

    const { synthesizeSpeech } = await import('../app/_lib/tts')
    await expect(synthesizeSpeech('Hello there.', 'nova')).resolves.toBeInstanceOf(Buffer)
    expect(mockCreate).toHaveBeenCalled()
  })

  it('throws rather than returning silence when BOTH engines fail', async () => {
    /*
     * The one outcome that must never be a quiet success. Silence in a paid
     * video is worse than an error, because nobody finds out until a customer
     * plays it.
     */
    globalThis.fetch = vi.fn(async () => { throw new Error('down') }) as unknown as typeof fetch
    mockCreate.mockRejectedValue(new Error('also down'))

    const { synthesizeSpeech } = await import('../app/_lib/tts')
    await expect(synthesizeSpeech('Hello there.', 'nova')).rejects.toThrow()
  })

  it('skips ElevenLabs entirely when no key is configured', async () => {
    delete process.env.ELEVENLABS_API_KEY
    const seen: string[] = []
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      seen.push(String(url))
      return new Response(audio(), { status: 200 })
    }) as unknown as typeof fetch
    mockCreate.mockResolvedValue({ arrayBuffer: async () => audio().buffer })

    const { synthesizeSpeech } = await import('../app/_lib/tts')
    await synthesizeSpeech('Hello there.', 'nova')

    expect(seen.some((u) => u.includes('elevenlabs')), 'called ElevenLabs with no key').toBe(false)
    expect(mockCreate).toHaveBeenCalled()
  })
})

describe('no test reaches a real voice API', () => {
  /*
   * WHY THIS IS HERE. tts-failures.test.ts passes only because a developer
   * machine has no ElevenLabs key. On CI, or anyone's machine with one set,
   * it calls the real API and bills for every run — a test suite that costs
   * money is a test suite people stop running.
   */
  it('the failure tests stub fetch, or set no key', async () => {
    const { readFileSync } = await import('fs')
    const { join } = await import('path')
    const src = readFileSync(join(__dirname, 'tts-failures.test.ts'), 'utf8')
    const stubsFetch = /globalThis\.fetch\s*=/.test(src)
    const clearsKey = /delete process\.env\.ELEVENLABS_API_KEY|ELEVENLABS_API_KEY\s*=\s*''/.test(src)
    expect(
      stubsFetch || clearsKey,
      'tts-failures.test.ts can call the real ElevenLabs API — stub fetch or clear the key',
    ).toBe(true)
  })
})
