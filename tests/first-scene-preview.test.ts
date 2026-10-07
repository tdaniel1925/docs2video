import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import {
  FREE_PREVIEWS_PER_DAY, CAP_WINDOW_SECS, capDecision, previewCapKey, previewsLeft, previewsLeftLabel, utcDay,
  narrationSample, pickPreviewScenes, stillEngineFor, voiceForPreview, lookNote, editorialPreviewScenes,
} from '../app/_lib/first-scene-preview'
import { audioCacheKey, stillCacheKey } from '../app/_lib/first-scene-preview-keys'

// The free first-scene preview on step 3: 3 a day per account (admins
// unlimited), never charges credits, cached so a repeat costs us nothing.

const ROOT = path.join(__dirname, '..')
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8')

describe('the daily cap', () => {
  it('is three a day', () => {
    expect(FREE_PREVIEWS_PER_DAY).toBe(3)
  })

  it('allows the first three and refuses the fourth', () => {
    expect(capDecision({ usedToday: 0, isAdmin: false })).toEqual({ allowed: true, remainingAfter: 2 })
    expect(capDecision({ usedToday: 1, isAdmin: false })).toEqual({ allowed: true, remainingAfter: 1 })
    expect(capDecision({ usedToday: 2, isAdmin: false })).toEqual({ allowed: true, remainingAfter: 0 })
    expect(capDecision({ usedToday: 3, isAdmin: false })).toEqual({ allowed: false, remainingAfter: 0 })
    // the counter keeps climbing on refused presses; still refused, never negative
    expect(capDecision({ usedToday: 7, isAdmin: false })).toEqual({ allowed: false, remainingAfter: 0 })
    expect(previewsLeft(9, false)).toBe(0)
  })

  it('never limits admins', () => {
    expect(capDecision({ usedToday: 50, isAdmin: true })).toEqual({ allowed: true, remainingAfter: null })
    expect(previewsLeft(50, true)).toBeNull()
  })

  it('starts again at midnight UTC — the day is in the counter key', () => {
    const u = '0e28a48c-978c-4bf0-93c3-6769229c85cc'
    const lateTonight = new Date('2026-10-07T23:59:59.999Z')
    const justAfterMidnight = new Date('2026-10-08T00:00:00.000Z')
    const thisMorning = new Date('2026-10-07T00:00:00.000Z')
    expect(previewCapKey(u, lateTonight)).toBe(previewCapKey(u, thisMorning))
    expect(previewCapKey(u, lateTonight)).not.toBe(previewCapKey(u, justAfterMidnight))
    expect(utcDay(justAfterMidnight)).toBe('2026-10-08')
    // A local-time offset doesn't move the day: 8pm in New York on the 7th is the 8th in UTC.
    expect(utcDay(new Date('2026-10-07T20:00:00-04:00'))).toBe('2026-10-08')
    // the row must outlive its own day, or a slow day would reset mid-day
    expect(CAP_WINDOW_SECS).toBeGreaterThan(24 * 60 * 60)
  })

  it('keeps each account separate', () => {
    const d = new Date('2026-10-07T12:00:00Z')
    expect(previewCapKey('a', d)).not.toBe(previewCapKey('b', d))
  })

  it('labels the count in plain words', () => {
    expect(previewsLeftLabel(3)).toBe('3 free previews left today')
    expect(previewsLeftLabel(1)).toBe('1 free preview left today')
    expect(previewsLeftLabel(0)).toBe('No free previews left today')
  })
})

describe('never charges credits', () => {
  const files = [
    'app/api/preview-first-scene/route.ts',
    'app/_lib/first-scene-preview-server.ts',
    'app/_lib/first-scene-preview.ts',
    'app/(dashboard)/create/_components/make/FirstScenePreview.tsx',
  ]
  for (const f of files) {
    it(`${f} has no path to the credit code`, () => {
      const src = read(f)
      expect(src).not.toMatch(/_lib\/(credits|credit-charge|video-billing|price-quote)['/]/)
      expect(src).not.toMatch(/\b(deductCredits|checkCredits|spendCredits|refund\w*Charge)\b/)
    })
  }

  it('the check above can fail (planted import)', () => {
    const planted = "import { deductCredits } from '../../_lib/credits'"
    expect(planted).toMatch(/_lib\/(credits|credit-charge|video-billing|price-quote)['/]/)
  })

  it('the route counts against the cap atomically and fails closed', () => {
    const src = read('app/api/preview-first-scene/route.ts')
    expect(src).toContain("rpc('rate_limit_hit'")
    expect(src).toMatch(/Fail CLOSED/)
    expect(src).toMatch(/\.eq\('user_id', user\.id\)/) // owner only
  })
})

describe('cache keys', () => {
  it('the same words in the same voice give the same file', () => {
    expect(audioCacheKey('Hello there.', 'elevenlabs', 'nova')).toBe(audioCacheKey('Hello there.  ', 'elevenlabs', 'nova'))
  })
  it('a different voice, engine or text gives a different file', () => {
    const base = audioCacheKey('Hello there.', 'elevenlabs', 'nova')
    expect(audioCacheKey('Hello there.', 'openai', 'onyx')).not.toBe(base)
    expect(audioCacheKey('Hello there.', 'openai', 'nova')).not.toBe(base)
    expect(audioCacheKey('Hello you.', 'elevenlabs', 'nova')).not.toBe(base)
  })
  it('a still key ignores key order but not content or look', () => {
    const a = stillCacheKey('v3', { look: 'aurora', request: { a: 1, b: [1, 2] } })
    expect(stillCacheKey('v3', { request: { b: [1, 2], a: 1 }, look: 'aurora' })).toBe(a)
    expect(stillCacheKey('v3', { look: 'cinematic', request: { a: 1, b: [1, 2] } })).not.toBe(a)
    expect(stillCacheKey('v3', { look: 'aurora', request: { a: 1, b: [2, 1] } })).not.toBe(a)
    expect(stillCacheKey('directed', { look: 'aurora', request: { a: 1, b: [1, 2] } })).not.toBe(a)
    expect(a).toMatch(/^[a-f0-9]{40}$/) // what /preview-still accepts
  })
})

describe('which scene and how much of it', () => {
  const scenes = [
    { _role: 'cover', title: 'Cover', narration: 'Thank you for your time today.' },
    { title: 'Empty', narration: '   ' },
    { title: 'First', narration: 'The real first scene.' },
    { title: 'Second', narration: 'Another.' },
    { _role: 'closing', title: 'Bye', narration: 'Thanks for watching.' },
  ]
  it('previews the first content scene with words, never the cover', () => {
    const p = pickPreviewScenes(scenes)!
    expect(p.content.title).toBe('First')
    expect(p.next?.title).toBe('Second')
    expect(p.cover?.title).toBe('Cover')
    expect(p.closing?.title).toBe('Bye')
  })
  it('has nothing to preview before the story is written', () => {
    expect(pickPreviewScenes([])).toBeNull()
    expect(pickPreviewScenes([{ _role: 'cover', narration: 'Hi.' }])).toBeNull()
    expect(pickPreviewScenes(undefined)).toBeNull()
  })
  it('reads about ten seconds: whole sentences, at most ~26 words', () => {
    const t = 'Here is the first sentence of the scene. Here is a second one that adds a little more. And a third sentence that would push this well past ten seconds of talking for sure.'
    const out = narrationSample(t)
    expect(out).toBe('Here is the first sentence of the scene. Here is a second one that adds a little more.')
    expect(out.split(' ').length).toBeLessThanOrEqual(26)
  })
  it('cuts one very long sentence at a pause and ends it cleanly', () => {
    const t = 'Let’s talk about something you might have set aside because it looked overwhelming, that thick illustration full of numbers and charts and pages that nobody ever really explained to you properly at all'
    const out = narrationSample(t)
    expect(out.split(' ').length).toBeLessThanOrEqual(26)
    expect(out.endsWith('overwhelming.')).toBe(true)
  })
})

describe('which renderer and which voice', () => {
  it('uses each look’s real renderer', () => {
    expect(stillEngineFor('video', 'slides')).toBe('directed')
    expect(stillEngineFor('video', 'aurora')).toBe('v3')
    expect(stillEngineFor('video', 'cinematic')).toBe('v3')
    expect(stillEngineFor('video', 'infographic')).toBe('v3')
    expect(stillEngineFor('video', 'editorial')).toBe('editorial')
    expect(stillEngineFor('video', 'explainer')).toBe('editorial')
    expect(stillEngineFor('interactive', 'heritage')).toBe('html')
    expect(stillEngineFor('deck', 'midnight')).toBe('html')
    expect(stillEngineFor('pptx', 'heritage')).toBeNull()
  })
  it('says what the free picture leaves out', () => {
    expect(lookNote('video', 'cinematic')).toMatch(/photo/)
    expect(lookNote('video', 'infographic')).toMatch(/background picture/)
    expect(lookNote('video', 'slides')).toBeNull()
    expect(lookNote('video', 'aurora')).toBeNull()
  })
  it('sounds like the finished video', () => {
    // Slide Deck look: Sarah → ElevenLabs; any other pick → that OpenAI voice.
    expect(voiceForPreview('video', 'slides', 'nova')).toEqual({ engine: 'elevenlabs', voice: 'nova', note: null })
    expect(voiceForPreview('video', 'slides', 'onyx')).toEqual({ engine: 'openai', voice: 'onyx', note: null })
    // Every other narrated look now uses the pick too (they used to always be
    // Sarah, with a note saying so) — and there is no note any more.
    for (const look of ['aurora', 'cinematic', 'infographic', 'editorial', 'explainer']) {
      expect(voiceForPreview('video', look, 'onyx')).toEqual({ engine: 'openai', voice: 'onyx', note: null })
      expect(voiceForPreview('video', look, 'nova')).toEqual({ engine: 'elevenlabs', voice: 'nova', note: null })
    }
    expect(voiceForPreview('interactive', 'heritage', 'echo')).toEqual({ engine: 'openai', voice: 'echo', note: null })
    // A slide deck has no voice; an unknown voice id falls back to Sarah.
    expect(voiceForPreview('deck', 'heritage', 'nova')).toBeNull()
    expect(voiceForPreview('video', 'slides', 'nonsense')!.voice).toBe('nova')
  })
})

describe('editorial page without the AI layout call', () => {
  it('numbers become a stat page, points a list, otherwise a paragraph', () => {
    const base = { title: 'Doc' }
    const stat = editorialPreviewScenes({ ...base, content: { title: 'T', narration: 'n', slideData: { stats: [{ label: 'Cover', value: '$500,000' }] } } })
    expect(stat.map((p) => p.archetype)).toEqual(['cover', 'stat', 'decision'])
    expect(stat[1].metrics).toEqual([{ label: 'Cover', value: '$500,000' }])
    const list = editorialPreviewScenes({ ...base, content: { title: 'T', narration: 'n', slideData: { bullets: ['a', 'b'] } } })
    expect(list[1].archetype).toBe('list')
    const lede = editorialPreviewScenes({ ...base, content: { title: 'T', narration: 'The words.' } })
    expect(lede[1]).toMatchObject({ archetype: 'lede', body: 'The words.' })
  })
})

describe('the preview plan (real builders, compliance)', async () => {
  const { buildPreviewPlan } = await import('../app/_lib/first-scene-preview-server')
  const draft = {
    extractedData: { title: 'QoL Max Accumulator+ III Index Universal Life Insurance', industry: 'insurance' },
    scenes: [
      { _role: 'cover', _auto: true, title: 'Cover', narration: 'Thank you for your time today.', _autoNarration: 'Thank you for your time today.' },
      { title: 'Your Death Benefit', narration: 'Your death benefit protects your family.', slideData: { headline: 'Your Death Benefit', stats: [{ label: 'Death benefit', value: '$500,000' }] } },
      { title: 'Next', narration: 'More words here.' },
      { _role: 'closing', title: 'Thanks', narration: 'Thanks for watching.' },
    ],
  }
  for (const [output, look] of [['video', 'slides'], ['video', 'aurora'], ['video', 'editorial'], ['interactive', 'heritage']] as const) {
    it(`${output}/${look}: never shows the product name of a regulated illustration`, () => {
      const plan = buildPreviewPlan({ output, look, draft, brand: null, rowTitle: 'QoL Max Accumulator+ III' })!
      expect(plan).toBeTruthy()
      expect(JSON.stringify(plan.request)).not.toMatch(/Accumulator/i)
      expect(plan.narration).toBe('Your death benefit protects your family.')
    })
  }
  it('the check above can fail: an unregulated document keeps its title', () => {
    const plain = { extractedData: { title: 'Acme Accumulator Garden Guide' }, scenes: [{ title: 'Roses', narration: 'Roses like sun.' }, { title: 'Water', narration: 'Water them weekly.' }] }
    const plan = buildPreviewPlan({ output: 'video', look: 'editorial', draft: plain, brand: null })!
    expect(JSON.stringify(plan.request)).toMatch(/Accumulator/)
  })
  it('V3 looks preview the first content scene where it really sits', () => {
    // An untouched cover is not a scene in the V3 video, so content is scene 0.
    const plan = buildPreviewPlan({ output: 'video', look: 'aurora', draft, brand: null })!
    expect((plan.request as { sceneIndex: number }).sceneIndex).toBe(0)
    const edited = { ...draft, scenes: [{ ...draft.scenes[0], narration: 'My own opening words.' }, ...draft.scenes.slice(1)] }
    const plan2 = buildPreviewPlan({ output: 'video', look: 'aurora', draft: edited, brand: null })!
    expect((plan2.request as { sceneIndex: number }).sceneIndex).toBe(1)
  })
  it('different looks never share a picture', () => {
    const a = buildPreviewPlan({ output: 'video', look: 'aurora', draft, brand: null })!
    const c = buildPreviewPlan({ output: 'video', look: 'cinematic', draft, brand: null })!
    expect(a.key).not.toBe(c.key)
  })
})
