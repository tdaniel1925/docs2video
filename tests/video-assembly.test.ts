import { describe, it, expect, vi, beforeEach } from 'vitest'
import { execFile } from 'child_process'
import { readFileSync } from 'fs'
import { join } from 'path'
import { slideDurationFor, SLIDE_PADDING_S, SLIDE_NO_AUDIO_S } from '../app/_lib/video'

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

describe('how long a slide stays on screen', () => {
  /*
   * THIS BLOCK USED TO TEST NOTHING AT ALL.
   *
   * All three assertions were on variables the test declared itself:
   *   const slideDuration = realDuration + 0.8
   *   expect(slideDuration).toBe(11.3)
   * and one was the tautology expect(5).toBe(5). Nothing from app/_lib/video
   * was imported or called, so changing 0.8 to 0, or the 5-second default to
   * 0, left all three green while every video in the product went out of
   * sync with its narration.
   *
   * The rule now lives in slideDurationFor and these call it.
   */
  it('adds padding so the slide outlasts the narration', () => {
    /* Without it a slide cuts on the last syllable, which reads as a glitch
       rather than an edit. */
    expect(slideDurationFor(10.5, 160000)).toBeCloseTo(11.3, 5)
    expect(slideDurationFor(10.5, 160000)).toBeGreaterThan(10.5)
    expect(SLIDE_PADDING_S).toBeGreaterThan(0)
  })

  it('falls back to a buffer estimate when probing fails', () => {
    /* The probe REPLACED buffer-size guessing because guessing was
       unreliable, so this is a floor rather than a second opinion — hence
       the cruder +1 instead of the measured +0.8. */
    expect(slideDurationFor(0, 160000)).toBe(11)
    expect(slideDurationFor(0, 80000)).toBe(6)
  })

  it('gives a slide with no audio a fixed beat', () => {
    expect(slideDurationFor(0, undefined)).toBe(SLIDE_NO_AUDIO_S)
    expect(SLIDE_NO_AUDIO_S, 'a slide nobody can read is not a slide').toBeGreaterThanOrEqual(3)
  })

  it('never returns zero or a negative length', () => {
    /* A zero-length clip is a slide that never appears, and ffmpeg will
       happily build one. */
    for (const [probed, bytes] of [[0, 0], [0, 1], [0.001, 1], [-1, 1000], [0, undefined]] as [number, number | undefined][]) {
      expect(slideDurationFor(probed, bytes), `probed=${probed} bytes=${bytes}`).toBeGreaterThan(0)
    }
  })

  it('is the rule assembleVideo actually uses', () => {
    /*
     * The assertion that would have caught the original bug. Everything above
     * tests a function; this proves the function is WIRED IN, which is
     * precisely what the old block could not do.
     */
    const src = readFileSync(join(__dirname, '..', 'app/_lib/video.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
    expect(src, 'assembleVideo no longer calls the shared rule')
      .toMatch(/slideDuration = slideDurationFor\(realDuration, audioBuffers\[i\]\.length\)/)
    expect(src, 'the padding has been re-inlined')
      .not.toMatch(/realDuration \+ 0\.8/)
  })
})
