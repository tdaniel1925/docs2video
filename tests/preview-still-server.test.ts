import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { createRequire } from 'module'
import path from 'path'

// The render service's free-preview still + the progress words customers read
// while a video renders. server.js can't be imported in a test (it starts a
// web server), so its PURE HELPERS block — which reads nothing outside itself —
// is cut out of the real file and run here. What is tested is what ships.

const ROOT = path.join(__dirname, '..')
const src = readFileSync(path.join(ROOT, 'render-service/server.js'), 'utf8')
const begin = src.indexOf('// ==== PURE HELPERS (BEGIN) ====')
const end = src.indexOf('// ==== PURE HELPERS (END) ====')
const NAMES = ['sceneAtFrame', 'startsFromDurations', 'renderProgressWords', 'makeRenderProgress', 'slidesStepWords', 'v3OutScene', 'previewDirectedJob', 'previewV3Job', 'previewEditorialJob', 'PREVIEW_SCENE_FRAMES', 'PREVIEW_SHOT_AT', 'PREVIEW_V3_LEAD_IN']
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const H: any = new Function(`${src.slice(begin, end)}\nreturn { ${NAMES.join(', ')} }`)()
const require_ = createRequire(import.meta.url)
const slides = require_(path.join(ROOT, 'render-service/slides.js'))

describe('the block is really there and self-contained', () => {
  it('found both markers', () => {
    expect(begin).toBeGreaterThan(0)
    expect(end).toBeGreaterThan(begin)
  })
  it('uses nothing from outside the block', () => {
    const block = src.slice(begin, end)
    expect(block).not.toMatch(/\brequire\(/)
    expect(block).not.toMatch(/\b(sb|supabase|process\.env|REMOTION_DIR|app)\./)
  })
  it('the real routes use it', () => {
    expect(src.match(/makeRenderProgress\(\{/g)!.length).toBeGreaterThanOrEqual(5) // v3, commercial x2, slides, directed, editorial
    expect(src).toContain('v3OutScene(s, i, scenes.length')
    expect(src).not.toContain('Rendering — frame ${done.toLocaleString()}')
  })
})

describe('progress words', () => {
  const starts = H.startsFromDurations([100, 200, 300], 105) // [105, 205, 405]

  it('maps a frame to the scene on screen', () => {
    expect(starts).toEqual([105, 205, 405])
    expect(H.sceneAtFrame(0, starts)).toBe(0)   // the title card counts as the start of scene 1
    expect(H.sceneAtFrame(204, starts)).toBe(0)
    expect(H.sceneAtFrame(205, starts)).toBe(1)
    expect(H.sceneAtFrame(10_000, starts)).toBe(2)
  })

  it('says which scene is being drawn', () => {
    expect(H.renderProgressWords({ done: 250, total: 705, starts })).toBe('Drawing scene 2 of 3')
    expect(H.renderProgressWords({ done: 705, total: 705, starts })).toBe('Drawing scene 3 of 3')
    expect(H.renderProgressWords({ done: 10, total: 100, starts: undefined })).toBe('Drawing your video — 10% done')
    expect(H.renderProgressWords({ done: 100, total: 100, starts: undefined })).toBe('Drawing your video — 99% done')
    expect(H.renderProgressWords({ done: 1, total: 1, starts, phase: 'encoding' })).toBe('Putting it together')
  })

  it('moves the bar and the words from Remotion’s output, at most every 1.5 s', () => {
    const writes: [number, string][] = []
    let t = 0
    const p = H.makeRenderProgress({ from: 72, to: 89, starts, report: (pct: number, w: string) => writes.push([pct, w]), now: () => t })
    p('Rendered 50/705')
    t += 500; p('Rendered 260/705')   // too soon: skipped
    t += 1500; p('Rendered 260/705')
    t += 1500; p('Encoded 100/705')    // encoding while still drawing: not "putting it together"
    t += 1500; p('Rendered frames 705/705')
    t += 1500; p('Encoded 705/705')
    expect(writes).toEqual([
      [73, 'Drawing scene 1 of 3'],
      [78, 'Drawing scene 2 of 3'],
      [89, 'Drawing scene 3 of 3'],
      [89, 'Putting it together'],
    ])
  })

  it('never moves the bar backwards and ignores junk', () => {
    const writes: number[] = []
    let t = 0
    const p = H.makeRenderProgress({ from: 50, to: 89, report: (pct: number) => writes.push(pct), now: () => (t += 2000) })
    p('Rendered 80/100'); p('Rendered 10/100'); p('lambda: 3 asset files (1.2 MB)'); p('Rendered 120/100')
    expect(writes.every((x, i) => i === 0 || x >= writes[i - 1])).toBe(true)
    expect(Math.max(...writes)).toBeLessThanOrEqual(89)
  })

  it('turns the slide pipeline’s log into plain words', () => {
    expect(H.slidesStepWords('comprehending pdf (48210 chars)...')).toBe('Reading your document')
    expect(H.slidesStepWords('writing slide deck...')).toBe('Writing your slides')
    expect(H.slidesStepWords('using your script (9 scenes)...')).toBe('Recording the voice')
    expect(H.slidesStepWords('⚖ regulated content detected — compliance mode ON')).toBeNull()
  })
})

const SCENES = [
  { role: 'cover', title: 'Your plan', narration: 'Thank you for your time today.', slideData: { headline: 'Your plan' } },
  { role: 'content', title: 'Three things to know', narration: 'First, the cover. Second, the cost. Third, the cash value.', slideData: { headline: 'Three things to know', bullets: ['The cover', 'The cost', 'The cash value'] } },
  { role: 'closing', title: 'Thank you', narration: 'Thanks for watching.', slideData: { headline: 'Thank you' } },
]

describe('the Slide Deck still', () => {
  const job = H.previewDirectedJob({ scenes: SCENES, preparer: 'Acme Advisors' }, slides)

  it('draws the DirectedVideo composition as a still, with no sound to load', () => {
    expect(job.comp).toBe('DirectedVideo')
    expect(job.props.still).toBe(true)
    expect(job.props.plan.noSfx).toBe(true)
    expect(job.props.starts).toHaveLength(job.props.plan.scenes.length)
  })

  it('photographs the first content slide after its points have arrived', () => {
    const { starts, plan, total } = job.props
    const content = plan.scenes.findIndex((s: { beat: string }) => s.beat !== 'intro' && s.beat !== 'cta')
    expect(plan.scenes[content].layout.heading).toBe('Three things to know')
    expect(job.frame).toBeGreaterThan(starts[content])
    expect(job.frame).toBeLessThan(content + 1 < starts.length ? starts[content + 1] - 14 : total)
    const bullets = plan.scenes[content].blocks.find((b: { type: string }) => b.type === 'bullets')
    expect(bullets.items).toHaveLength(3)
    for (const it of bullets.items) expect(starts[content] + it.cueFrame).toBeLessThan(job.frame - 20)
  })

  it('builds the deck with the real render’s own planner (user’s heading kept)', () => {
    const w = slides.planFromSuppliedScenes(SCENES)
    expect(job.props.plan.scenes.map((s: { layout: { heading: string } }) => s.layout.heading)).toEqual(w.scenes.map((s: { layout: { heading: string } }) => s.layout.heading))
    expect(job.props.plan.chrome.company).toBe('Acme Advisors')
  })
})

describe('the Aurora / Cinematic / Infographic still', () => {
  const payload = {
    theme: 'aurora', brandName: 'Acme',
    scenes: [
      { title: 'Opening', narration: 'a' },
      { title: 'The numbers', narration: 'b', metrics: [{ label: 'Cover', value: '$500,000' }], bullets: ['Paid monthly'] },
      { title: 'Thanks', narration: 'c' },
    ],
  }
  const v3Theme = () => ({ name: 'test' })

  it('lays scenes out exactly like the real render (shared v3OutScene)', () => {
    const job = H.previewV3Job({ payload, sceneIndex: 1 }, { v3Theme })
    expect(job.comp).toBe('V3Video')
    expect(job.props.__preview).toBe(true)
    expect(job.props.look).toBe('aurora')
    expect(job.props.scenes[1].bullets).toEqual([{ text: 'Cover', value: '$500,000' }, { text: 'Paid monthly' }])
    expect(job.props.scenes[2].closing).toBeTruthy()
    expect(job.props.scenes.some((s: { audio?: string; image?: string }) => s.audio || s.image)).toBe(false)
    // title card (105) + scene 1 (240) + 4 s into the content scene
    expect(job.frame).toBe(H.PREVIEW_V3_LEAD_IN + H.PREVIEW_SCENE_FRAMES + H.PREVIEW_SHOT_AT)
  })

  it('infographic: its own composition and no title card', () => {
    const job = H.previewV3Job({ payload: { ...payload, theme: 'infographic' }, sceneIndex: 0 }, { v3Theme })
    expect(job.comp).toBe('InfographicVideo')
    expect(job.frame).toBe(H.PREVIEW_SHOT_AT)
  })

  it('the real render and the preview share one scene builder', () => {
    const s = { title: 'X', narration: 'n', metrics: [{ label: 'A', value: '1' }] }
    const real = H.v3OutScene(s, 1, 3, { isInfo: false, audioName: 'r3-1.mp3', imgName: 'r3-1.png', haveImg: true, durationInFrames: 99 })
    const prev = H.v3OutScene(s, 1, 3, { isInfo: false, haveImg: false, durationInFrames: 99 })
    expect(real).toMatchObject({ audio: 'r3-1.mp3', image: 'r3-1.png' })
    const { audio: _a, image: _i, ...rest } = real
    void _a; void _i
    expect(prev).toEqual(rest)
  })
})

describe('the Editorial / Explainer still', () => {
  it('photographs the first page that is not the cover', () => {
    const job = H.previewEditorialJob({ masthead: 'ACME', variant: 'explainer', scenes: [
      { archetype: 'cover', title: 'C', narration: 'c' },
      { archetype: 'stat', title: 'S', metrics: [{ label: 'a', value: '1' }], narration: 's' },
      { archetype: 'decision', title: 'D', narration: 'd' },
    ] })
    expect(job.comp).toBe('EditorialVideo')
    expect(job.props.__preview).toBe(true)
    expect(job.props.variant).toBe('explainer')
    expect(job.frame).toBe(H.PREVIEW_SCENE_FRAMES + H.PREVIEW_SHOT_AT)
  })
})
