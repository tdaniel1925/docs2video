import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock OpenAI before importing
const mockCreate = vi.fn()

vi.mock('openai', () => {
  return {
    default: class {
      audio = {
        speech: {
          create: mockCreate,
        },
      }
    },
  }
})

// Import after mock setup
const { synthesizeAllScenes, synthesizeSpeech } = await import('../app/_lib/tts')

function makeFakeResponse(size: number = 500) {
  const buf = new ArrayBuffer(size)
  const view = new Uint8Array(buf)
  for (let i = 0; i < size; i++) view[i] = 0xFF
  return {
    arrayBuffer: () => Promise.resolve(buf),
  }
}

describe('TTS failure handling', () => {
  /*
   * THIS FILE TESTS THE FALLBACK ENGINE, and it has to say so.
   *
   * OpenAI is the fallback; ElevenLabs is the primary, reached through a bare
   * `fetch` that nothing here stubs. These tests only ever entered the OpenAI
   * retry loop because a developer machine has no ElevenLabs key — which made
   * the whole primary path untested, and meant that on CI, or on anyone's
   * machine with the key set, this file called the real ElevenLabs API and
   * billed for every run.
   *
   * The key is now cleared deliberately rather than by luck, so what these
   * tests cover is a decision instead of an accident. The primary path has
   * its own file: tts-primary-voice.test.ts.
   */
  const realKey = process.env.ELEVENLABS_API_KEY

  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.STRICT_MODE
    delete process.env.ELEVENLABS_API_KEY
  })

  afterEach(() => {
    if (realKey === undefined) delete process.env.ELEVENLABS_API_KEY
    else process.env.ELEVENLABS_API_KEY = realKey
  })

  it('synthesizeSpeech throws after 3 failed retries instead of returning silence', async () => {
    mockCreate.mockRejectedValue(new Error('OpenAI rate limit'))

    await expect(
      synthesizeSpeech('This is a test narration.', 'nova')
    ).rejects.toThrow(/TTS failed \(ElevenLabs \+ OpenAI\).*OpenAI rate limit/)

    // Should have attempted 3 times
    expect(mockCreate).toHaveBeenCalledTimes(3)
  })

  it('synthesizeAllScenes returns array of buffers when all scenes succeed', async () => {
    mockCreate.mockImplementation(() => Promise.resolve(makeFakeResponse(500)))

    const scenes = [
      { narration: 'Scene one narration.' },
      { narration: 'Scene two narration.' },
      { narration: 'Scene three narration.' },
    ]

    const result = await synthesizeAllScenes(scenes, 'nova')

    expect(result).toHaveLength(3)
    for (const buf of result) {
      expect(buf).toBeInstanceOf(Buffer)
      expect(buf.length).toBe(500)
    }
  })

  it('synthesizeAllScenes throws with scene number when one scene fails after retries', async () => {
    // Scene 1 succeeds, Scene 2 fails all 3 retries, Scene 3 succeeds
    let callCount = 0
    mockCreate.mockImplementation(({ input }: { input: string }) => {
      callCount++
      if (input === 'Scene two narration.') {
        return Promise.reject(new Error('API timeout'))
      }
      return Promise.resolve(makeFakeResponse(500))
    })

    const scenes = [
      { narration: 'Scene one narration.' },
      { narration: 'Scene two narration.' },
      { narration: 'Scene three narration.' },
    ]

    await expect(
      synthesizeAllScenes(scenes, 'nova')
    ).rejects.toThrow(/TTS synthesis failed for 1 scene\(s\).*Scene 2/)
  })

  it('synthesizeAllScenes handles empty narration scene without error', async () => {
    // First call: for empty scene "..." silence generation
    // Second call: for actual narration
    mockCreate.mockImplementation(() => Promise.resolve(makeFakeResponse(300)))

    const scenes = [
      { narration: 'First scene narration.' },
      { narration: '' },
      { narration: 'Third scene narration.' },
    ]

    const result = await synthesizeAllScenes(scenes, 'nova')

    expect(result).toHaveLength(3)
    // All should be valid buffers
    for (const buf of result) {
      expect(buf).toBeInstanceOf(Buffer)
    }
  })

  it('synthesizeAllScenes lists all failed scenes in error message', async () => {
    mockCreate.mockImplementation(({ input }: { input: string }) => {
      if (input === 'Scene one narration.') {
        return Promise.reject(new Error('Rate limited'))
      }
      if (input === 'Scene three narration.') {
        return Promise.reject(new Error('Server error'))
      }
      return Promise.resolve(makeFakeResponse(500))
    })

    const scenes = [
      { narration: 'Scene one narration.' },
      { narration: 'Scene two narration.' },
      { narration: 'Scene three narration.' },
    ]

    await expect(
      synthesizeAllScenes(scenes, 'nova')
    ).rejects.toThrow(/TTS synthesis failed for 2 scene\(s\).*Scene 1.*Scene 3/)
  })
})
