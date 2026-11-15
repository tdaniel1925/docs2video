import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { applyEdits, checkEdited, numberChecks, pinStoryboard, screenFields, storyKey, type Storyboard } from '../app/_lib/storyboard'
import type { PlannerInput } from '../app/_lib/kit-planner'
import type { KitScene } from '../remotion/src/kit/spec'

/* THE STORYBOARD (step 5, film engine on): stills + the words on screen, editable; the video draws what it showed. */
const ROOT = join(__dirname, '..')
const read = (f: string) => readFileSync(join(ROOT, f), 'utf8').replace(/\r\n/g, '\n')

const NARR = 'If something happens to you, your family receives five hundred thousand dollars, paid tax-free.'
const input: PlannerInput = {
  regulated: false,
  beats: [
    { role: 'cover', title: 'Your plan', narration: 'Your plan.' },
    { role: 'content', title: 'What your family receives', narration: NARR, slideData: { stats: [{ label: 'Death benefit', value: '$500,000' }] } },
    { role: 'closing', title: 'Thank you', narration: 'Thank you for watching.' },
  ],
  keyMetrics: [{ label: 'Monthly premium', value: '$142' }],
}
const big: KitScene = { id: 2, type: 'bignumber', narration: NARR, label: 'Death benefit', figure: { value: 500000, prefix: '$' }, context: 'Paid to your family' }
const planned: KitScene[] = [
  { id: 1, type: 'title', narration: 'Your plan.', headline: 'Your plan' },
  { ...big, label: 'Planned again', context: undefined },
  { id: 3, type: 'cta', narration: 'Thank you for watching.', headline: 'Questions?', action: 'Book a call' },
]

describe('a scene’s identity', () => {
  it('is its spoken words, the same however they were spaced or written', () => {
    expect(storyKey(NARR)).toBe(storyKey(`  ${NARR.replace(/ /g, '  ')} `))
    expect(storyKey(NARR)).not.toBe(storyKey(NARR + ' And more.'))
  })
})

describe('the words on screen', () => {
  it('are offered as the fields this scene type has', () => {
    expect(screenFields(big).map((f) => [f.path, f.value])).toEqual([['label', 'Death benefit'], ['figure', '$500,000'], ['context', 'Paid to your family']])
  })
  it('change only those fields; a number is read back as a number', () => {
    const e = applyEdits(big, { label: 'Paid to your family', figure: '$142', narration: 'hijack', 'figure.value': '9' }) as Extract<KitScene, { type: 'bignumber' }>
    expect(e.label).toBe('Paid to your family')
    expect(e.figure).toEqual({ value: 142, prefix: '$' })
    expect(e.narration).toBe(NARR)
  })
  it('show whether each number is in the document', () => {
    expect(numberChecks(big, input)).toEqual([{ text: '$500,000', found: true }])
    expect(numberChecks(applyEdits(big, { figure: '$750,000' }), input)).toEqual([{ text: '$750,000', found: false }])
  })
  it('a number that is not in the document is refused, like the planner’s own scenes', () => {
    expect(checkEdited(applyEdits(big, { figure: '$750,000' }), 1, input).length).toBeGreaterThan(0)
    expect(checkEdited(applyEdits(big, { label: 'For your family' }), 1, input)).toEqual([])
  })
})

describe('making the video draws what the storyboard showed', () => {
  const board: Storyboard = { at: '', entries: [{ key: storyKey(NARR), scene: big, edits: { label: 'For your family' } }] }
  it('an unchanged scene is drawn as the storyboard showed it, with its edits; the cover and closing stay planned', () => {
    const r = pinStoryboard(planned, board, input)
    expect(r.pinned).toBe(1)
    expect(r.scenes[0]).toBe(planned[0])
    expect(r.scenes[2]).toBe(planned[2])
    expect((r.scenes[1] as Extract<KitScene, { type: 'bignumber' }>).label).toBe('For your family')
    expect(r.scenes[1].id).toBe(2)
  })
  it('a scene whose words changed is planned again', () => {
    const changed = planned.map((s, i) => (i === 1 ? { ...s, narration: NARR + ' Every year.' } : s))
    expect(pinStoryboard(changed, board, input).pinned).toBe(0)
  })
  it('a storyboard scene that no longer passes the checks is not used', () => {
    const bad: Storyboard = { at: '', entries: [{ key: storyKey(NARR), scene: big, edits: { figure: '$999,999' } }] }
    const r = pinStoryboard(planned, bad, input)
    expect(r.pinned).toBe(0)
    expect(r.scenes[1]).toBe(planned[1])
  })
})

describe('the wiring', () => {
  it('the route draws pinned scenes only with the film engine on', () => {
    const route = read('app/api/generate-video/route.ts')
    expect(route).toContain('const pin = filmOn ? pinStoryboard(planned.result.scenes, draft.storyboard as Storyboard | undefined, plannerInput) : { scenes: planned.result.scenes, pinned: 0 }')
    expect(route).toContain('title: videoTitle, scenes: pin.scenes, look,')
  })
  it('the storyboard and its frames are for the owner, with the film engine on; a frame is a still, drawn once', () => {
    for (const f of ['app/api/storyboard/route.ts', 'app/api/storyboard/frame/route.ts']) {
      const src = read(f)
      expect(src).toContain('filmEngineFor(user.id)')
      expect(src).toContain(".eq('user_id', user.id)")
    }
    const frame = read('app/api/storyboard/frame/route.ts')
    expect(frame).toContain('if (entry.frame?.sig === sig) return NextResponse.json({ url: entry.frame.url })')
    expect(frame).toContain('FRAMES_PER_DAY')
  })
  it('no previews, no motion or timing controls, no "show as" on the storyboard (owner)', () => {
    const ui = read('app/(dashboard)/create/_components/story/Storyboard.tsx')
    expect(ui).not.toMatch(/<video|Preview 5|Play (this|the)|landOn|Show (this scene )?as/i)
  })
})
