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

  it('drops the writer’s beat label from scene titles', async () => {
    const { cleanSceneTitle } = await import('../app/_lib/text-format')
    expect(cleanSceneTitle('Opening: Coverage Still Working')).toBe('Coverage Still Working')
    expect(cleanSceneTitle('Opening — Your Story Is a Good One')).toBe('Your Story Is a Good One')
    expect(cleanSceneTitle('Opening')).toBe('Opening')
    expect(cleanSceneTitle('Opening Doors for Your Family')).toBe('Opening Doors for Your Family')
  })

  it('names the video for its cover, never a scene labelled "Opening:"', () => {
    expect(route).toMatch(/const videoTitle = named\(coverName\) \|\| named\(\(policyData as any\)\?\.title\) \|\| named\(firstSceneName\)/)
    expect(route).toMatch(/illustration\|document\|source\|presentation\|summary\|policy\|untitled/)
    expect(route).toMatch(/replace\(\/\^\(opening\|intro\(duction\)\?\|closing\)/)
  })
})
