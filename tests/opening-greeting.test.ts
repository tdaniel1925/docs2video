import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { buildOpeningNarration } from '../app/_lib/personalize'

/*
 * Owner's live test, 2026-10-19: the opening said "David, thank you for letting
 * Darrell Wolfe share this illustration summary with you. Opening, coverage
 * still working." — a scene's title read aloud after the greeting. The video
 * was also named after that scene.
 */
const route = readFileSync(join(__dirname, '../app/api/generate-video/route.ts'), 'utf8')

describe('the spoken opening', () => {
  it('is the greeting alone when there is no intro line — no title read after it', () => {
    expect(route).toMatch(/const baseOpening = introLine \|\| \(greetedByName \? '' : `\$\{videoTitle\}\.`\)/)
    const said = buildOpeningNarration({ client: 'David Reese', agent: 'Darrell Wolfe', regulated: false, baseNarration: '' })
    expect(said).toBe('David, thank you for letting Darrell Wolfe share this summary with you.')
  })

  it('names the video for its cover, never a scene labelled "Opening:"', () => {
    expect(route).toMatch(/const videoTitle = coverName \|\| \(policyData as any\)\?\.title \|\| firstSceneName/)
    expect(route).toMatch(/replace\(\/\^\(opening\|intro\(duction\)\?\|closing\)/)
  })
})
