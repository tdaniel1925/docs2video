import { describe, it, expect, vi, beforeEach } from 'vitest'
import { splitAtSentenceBoundary } from '../app/_lib/tts'

// Mock OpenAI before importing synthesizeSpeech
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
const { synthesizeSpeech } = await import('../app/_lib/tts')

function makeFakeResponse(size: number = 500) {
  const buf = new ArrayBuffer(size)
  const view = new Uint8Array(buf)
  // Fill with non-zero bytes so it passes the >100 byte check
  for (let i = 0; i < size; i++) view[i] = 0xFF
  return {
    arrayBuffer: () => Promise.resolve(buf),
  }
}

describe('tts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset env
    delete process.env.STRICT_MODE
  })

  it('calls OpenAI once for text under 4000 chars', async () => {
    mockCreate.mockResolvedValueOnce(makeFakeResponse(500))

    const text = 'Hello, this is a short narration.'
    const result = await synthesizeSpeech(text, 'nova')

    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(result).toBeInstanceOf(Buffer)
    expect(result.length).toBe(500)
  })

  it('splits and concatenates text over 4096 chars in non-strict mode', async () => {
    // Create text longer than 4096 chars with sentence boundaries
    const sentence = 'This is a test sentence that is moderately long. '
    const longText = sentence.repeat(100) // ~5000 chars

    expect(longText.length).toBeGreaterThan(4096)

    // Each chunk call should succeed
    mockCreate.mockImplementation(() => Promise.resolve(makeFakeResponse(200)))

    const result = await synthesizeSpeech(longText, 'nova')

    // Should have been called multiple times (once per chunk)
    expect(mockCreate.mock.calls.length).toBeGreaterThan(1)
    expect(result).toBeInstanceOf(Buffer)
    // Result should be concatenation of all chunk buffers
    expect(result.length).toBe(mockCreate.mock.calls.length * 200)
  })

  it('throws error for text over 4096 chars in strict mode', async () => {
    const sentence = 'This is a test sentence that is moderately long. '
    const longText = sentence.repeat(100)

    await expect(
      synthesizeSpeech(longText, 'nova', { strict: true })
    ).rejects.toThrow(/TTS text exceeds 4096 char limit/)
  })

  it('returns silence for empty text', async () => {
    // For empty text, it tries to generate silence via OpenAI
    mockCreate.mockResolvedValueOnce(makeFakeResponse(300))

    const result = await synthesizeSpeech('', 'nova')

    expect(result).toBeInstanceOf(Buffer)
    // The silence generation calls OpenAI with '...'
    expect(mockCreate).toHaveBeenCalledTimes(1)
    const callArgs = mockCreate.mock.calls[0][0]
    expect(callArgs.input).toBe('...')
  })
})

describe('splitAtSentenceBoundary', () => {
  it('correctly splits at sentence boundaries', () => {
    const text = 'First sentence. Second sentence. Third sentence. Fourth sentence.'
    const chunks = splitAtSentenceBoundary(text, 40)

    // Each chunk should be under maxLen
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(40)
    }

    // Recombined text should contain all sentences
    const combined = chunks.join(' ')
    expect(combined).toContain('First sentence.')
    expect(combined).toContain('Second sentence.')
    expect(combined).toContain('Third sentence.')
    expect(combined).toContain('Fourth sentence.')
  })

  it('handles text without sentence-ending punctuation', () => {
    const text = 'This is a long block of text without any sentence ending punctuation and it just keeps going on and on'
    const chunks = splitAtSentenceBoundary(text, 50)

    // Should return the whole text as a single chunk since there are no sentence boundaries
    expect(chunks.length).toBe(1)
    expect(chunks[0]).toBe(text)
  })

  it('handles single sentence under maxLen', () => {
    const text = 'Short sentence.'
    const chunks = splitAtSentenceBoundary(text, 4000)
    expect(chunks).toEqual(['Short sentence.'])
  })
})
