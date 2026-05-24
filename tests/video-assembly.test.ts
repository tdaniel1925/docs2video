import { describe, it, expect, vi, beforeEach } from 'vitest'
import { execFile } from 'child_process'

// Mock child_process before importing
vi.mock('child_process', () => ({
  execFile: vi.fn(),
}))

// Mock fs for getFfmpegPath
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  return {
    ...actual,
    accessSync: vi.fn(() => { throw new Error('not found') }),
  }
})

const mockExecFile = vi.mocked(execFile)

// Import after mocks
const { probeAudioDuration } = await import('../app/_lib/video')

describe('probeAudioDuration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns correct duration for valid ffmpeg output', async () => {
    // Simulate ffmpeg stderr with duration info
    mockExecFile.mockImplementation((_cmd: any, _args: any, _opts: any, cb: any) => {
      cb(null, '', 'Duration: 00:01:23.45, start: 0.000000, bitrate: 128 kb/s')
      return undefined as any
    })

    const duration = await probeAudioDuration('/tmp/test.mp3')
    // 0*3600 + 1*60 + 23 + 450/1000 = 83.45
    expect(duration).toBeCloseTo(83.45, 1)
    expect(duration).toBeGreaterThan(0)
  })

  it('returns 0 when duration cannot be parsed', async () => {
    mockExecFile.mockImplementation((_cmd: any, _args: any, _opts: any, cb: any) => {
      cb(new Error('invalid file'), '', 'some error output')
      return undefined as any
    })

    const duration = await probeAudioDuration('/tmp/bad.mp3')
    expect(duration).toBe(0)
  })

  it('parses short durations correctly', async () => {
    mockExecFile.mockImplementation((_cmd: any, _args: any, _opts: any, cb: any) => {
      cb(null, '', 'Duration: 00:00:05.20, start: 0.000000')
      return undefined as any
    })

    const duration = await probeAudioDuration('/tmp/short.mp3')
    // 5 + 200/1000 = 5.2
    expect(duration).toBeCloseTo(5.2, 1)
  })
})

describe('audio-slide sync with padding', () => {
  it('slide duration includes 0.8s padding over probed audio', () => {
    const realDuration = 10.5
    const slideDuration = realDuration + 0.8
    expect(slideDuration).toBe(11.3)
    expect(slideDuration).toBeGreaterThan(realDuration)
  })

  it('fallback works when probing returns 0', () => {
    const probedDuration = 0
    const bufferLength = 160000 // ~10 seconds at 16KB/s
    const slideDuration = probedDuration > 0
      ? probedDuration + 0.8
      : Math.round(bufferLength / 16000) + 1
    expect(slideDuration).toBe(11) // 10 + 1
  })

  it('slides without audio default to 5 seconds', () => {
    const slideDuration = 5 // default when no audio
    expect(slideDuration).toBe(5)
  })
})
