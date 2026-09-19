import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { isSceneEmpty, isSceneSuspiciouslyShort, cleanScenes } from '../app/api/generate-video/route'

describe('isSceneEmpty', () => {
  it('returns true for a truly empty scene (no narration, no slidePrompt)', () => {
    expect(isSceneEmpty({ narration: '', slidePrompt: '' })).toBe(true)
    expect(isSceneEmpty({ narration: '  ', slidePrompt: '  ' })).toBe(true)
    expect(isSceneEmpty({})).toBe(true)
  })

  it('returns false for a short hook with narration', () => {
    expect(isSceneEmpty({ narration: 'Your family deserves better.', slidePrompt: '' })).toBe(false)
  })

  it('returns false for a scene with empty narration but has slidePrompt', () => {
    expect(isSceneEmpty({ narration: '', slidePrompt: 'A family standing in front of a house' })).toBe(false)
  })

  it('returns false for a normal scene', () => {
    expect(isSceneEmpty({
      narration: 'This is a normal scene with plenty of narration content.',
      slidePrompt: 'Professional office setting',
    })).toBe(false)
  })
})

describe('isSceneSuspiciouslyShort', () => {
  it('flags a hook with very short narration', () => {
    expect(isSceneSuspiciouslyShort({ beat: 'hook', narration: 'Hey!' })).toBe(true)
  })

  it('does not flag a hook with adequate narration', () => {
    expect(isSceneSuspiciouslyShort({ beat: 'hook', narration: 'Your family deserves better.' })).toBe(false)
  })

  it('flags a disclaimer with short narration', () => {
    expect(isSceneSuspiciouslyShort({ beat: 'disclaimer', narration: 'Results may vary.' })).toBe(true)
  })

  it('does not flag a normal scene with adequate narration', () => {
    expect(isSceneSuspiciouslyShort({
      beat: 'context',
      narration: 'Here is some context that is long enough to pass the minimum threshold easily.',
    })).toBe(false)
  })

  it('uses default minimum of 30 for unknown beats', () => {
    expect(isSceneSuspiciouslyShort({ beat: 'unknown-beat', narration: 'Short.' })).toBe(true)
    expect(isSceneSuspiciouslyShort({ beat: 'unknown-beat', narration: 'This narration is long enough to pass.' })).toBe(false)
  })
})

describe('scene filtering pipeline', () => {
  it('removes only truly empty scenes and renumbers correctly', () => {
    const scenes = [
      { scene: 1, beat: 'hook', narration: 'Your family deserves better.', slidePrompt: 'Family scene' },
      { scene: 2, beat: 'context', narration: '', slidePrompt: '' },  // truly empty — should be removed
      { scene: 3, beat: 'stakes', narration: 'The stakes are high for everyone involved in this process.', slidePrompt: 'Dramatic visual' },
      { scene: 4, beat: 'evidence', narration: '', slidePrompt: 'Chart showing data trends' },  // no narration but has slidePrompt — keep
      { scene: 5, beat: 'action', narration: 'Call us today.', slidePrompt: 'Contact info' },
    ]

    const cleaned = cleanScenes(scenes)

    expect(cleaned).toHaveLength(4)
    expect(cleaned[0].scene).toBe(1)
    expect(cleaned[0].beat).toBe('hook')
    expect(cleaned[1].scene).toBe(2)
    expect(cleaned[1].beat).toBe('stakes')
    expect(cleaned[2].scene).toBe(3)
    expect(cleaned[2].beat).toBe('evidence')
    expect(cleaned[3].scene).toBe(4)
    expect(cleaned[3].beat).toBe('action')
  })

  it('preserves all scenes when none are empty', () => {
    const scenes = [
      { scene: 1, beat: 'hook', narration: 'Hello.', slidePrompt: '' },
      { scene: 2, beat: 'action', narration: 'Call now.', slidePrompt: '' },
    ]

    const cleaned = cleanScenes(scenes)

    expect(cleaned).toHaveLength(2)
  })
})

describe('the route uses the same pipeline this file tests', () => {
  /*
   * THE ASSERTION THAT WOULD HAVE CAUGHT THE ORIGINAL PROBLEM.
   *
   * The two tests above used to re-implement the filter-and-renumber chain in
   * their own bodies — `scenes.filter(...).map(...)` written out again — so
   * only the two predicates were ever real code. If the route stopped
   * filtering, or renumbered wrongly, both passed regardless.
   *
   * They now call cleanScenes. This proves the route does too.
   */
  const route = readFileSync(join(__dirname, '..', 'app/api/generate-video/route.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')

  it('calls cleanScenes on the generated scenes', () => {
    expect(route, 'the route no longer uses the shared pipeline')
      .toMatch(/scenes = cleanScenes\(scenes/)
  })

  it('does not keep its own copy of the chain', () => {
    expect(route, 'the filter-and-renumber has been re-inlined into the route')
      .not.toMatch(/\.filter\(\(s: any\) => !isSceneEmpty\(s\)\)/)
  })

  it('renumbers from one, with no gaps', () => {
    /* Scene numbers are how the renderer, the Fix-a-Scene editor and the
       slide plan refer to one another — a gap points every later reference at
       the wrong slide. */
    const out = cleanScenes([
      { scene: 7, narration: 'a', slidePrompt: '' },
      { scene: 9, narration: '', slidePrompt: '' },
      { scene: 11, narration: 'c', slidePrompt: '' },
    ])
    expect(out.map((s) => s.scene)).toEqual([1, 2])
  })

  it('leaves the input array alone', () => {
    /* It returns a new list; a caller holding the original must not see it
       mutated out from under them. */
    const input = [{ scene: 1, narration: 'a', slidePrompt: '' }, { scene: 2, narration: '', slidePrompt: '' }]
    cleanScenes(input)
    expect(input).toHaveLength(2)
    expect(input[0].scene).toBe(1)
  })

  it('handles an empty list without throwing', () => {
    expect(cleanScenes([])).toEqual([])
  })
})
