import { describe, it, expect, afterEach, vi } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

vi.mock('../app/_lib/admin', () => ({ isAdminDB: async (id: string) => id === 'admin-user' }))
import { explainerMode, explainerEngineFor, sceneFor, elevenVoiceFor, ELEVENLABS_VOICE, DEFAULT_LOOK } from '../app/_lib/explainer-engine'

/* THE EXPLAINER ENGINE: Docs2Video's approved scenes, designed and filmed on the render worker (founder, 2026-10-17). */
const ROOT = join(__dirname, '..')
const read = (f: string) => readFileSync(join(ROOT, f), 'utf8')
const RENDER = { RENDER_BUCKET: 'b', RENDER_SUBNETS: 's1,s2', RENDER_SECURITY_GROUP: 'sg', RENDER_AWS_ACCESS_KEY_ID: 'k', RENDER_AWS_SECRET_ACCESS_KEY: 's' }

afterEach(() => { vi.unstubAllEnvs() })

describe('who gets it', () => {
  it('nobody until it is switched on, admins while it is proved, everyone when on', async () => {
    for (const [k, v] of Object.entries(RENDER)) vi.stubEnv(k, v)
    vi.stubEnv('EXPLAINER_ENGINE', '')
    expect(explainerMode()).toBe('off')
    expect(await explainerEngineFor('admin-user')).toBe(false)
    vi.stubEnv('EXPLAINER_ENGINE', 'admins')
    expect(await explainerEngineFor('admin-user')).toBe(true)
    expect(await explainerEngineFor('customer')).toBe(false)
    vi.stubEnv('EXPLAINER_ENGINE', 'on')
    expect(await explainerEngineFor('customer')).toBe(true)
  })
  it('never without the render worker’s settings', async () => {
    vi.stubEnv('EXPLAINER_ENGINE', 'on')
    vi.stubEnv('RENDER_BUCKET', '')
    expect(await explainerEngineFor('customer')).toBe(false)
  })
})

describe('the scenes it is sent', () => {
  it('say on screen what the story step approved — numbers first, then points — and the narration as written', () => {
    const s = sceneFor('content', { title: 'Your premium', narration: '  Here is   the good news.  ', slideData: { headline: 'Your premium went down', stats: [{ label: 'a month', value: '$84.50' }], bullets: ['Non-smoker rate'] } })
    expect(s).toEqual({ role: 'content', title: 'Your premium went down', bullets: ['$84.50 a month', 'Non-smoker rate'], narration: 'Here is the good news.' })
  })
  it('the closing carries the contact lines the user chose to show', () => {
    expect(sceneFor('closing', { title: 'Thank you', narration: 'Call me.' }, ['(214) 555-0142', 'harbor.com']).bullets).toEqual(['(214) 555-0142', 'harbor.com'])
  })
  it('every Docs2Video voice is the ElevenLabs voice fal already speaks it with', () => {
    expect(Object.keys(ELEVENLABS_VOICE).sort()).toEqual(['alloy', 'echo', 'fable', 'nova', 'onyx', 'shimmer'])
    expect(elevenVoiceFor('onyx')).toBe(ELEVENLABS_VOICE.onyx)
    expect(elevenVoiceFor('nonsense')).toBe(ELEVENLABS_VOICE.nova)
  })
  it('with no picture of their own, starts from a designed look worn in their brand', () => {
    expect(read('app/_lib/explainer-engine.ts')).toContain("own ? Promise.resolve(own) : fetched(`${site}${DEFAULT_LOOK}`)")
    expect(read(`public${DEFAULT_LOOK}`).length).toBeGreaterThan(1000)
  })
})

describe('the route', () => {
  const route = read('app/api/generate-video/route.ts')
  it('sends a switched-on user’s video to the explainer before any older engine', () => {
    /* Drawn slides keep their own pipeline (the engine cannot draw them) */
    const at = route.indexOf('if (!isDrawn && await explainerEngineFor(user.id)) {')
    expect(at).toBeGreaterThan(0)
    expect(at).toBeLessThan(route.indexOf("if (videoStyle === 'kit' && kitEngineOn())"))
    expect(at).toBeGreaterThan(route.indexOf('const deducted = await deductCredits('))
  })
  it('falls back to the previous engine, with a note, when it cannot start — no video is lost', () => {
    expect(route).toContain("render_note: 'Made with the previous engine — the new explainer engine could not start. Regenerate to try it again.'")
  })
})

describe('what an explainer costs', () => {
  it('is priced by its size, and the cheapest credit still makes money', async () => {
    const { explainerCredits, EXPLAINER_BASE_CREDITS } = await import('../app/_lib/explainer-price')
    expect(explainerCredits(7, 350)).toBe(1400 + 7 * 320 + 350 * 3)
    /* Cost model: $1.40 once + $0.32 a scene + $0.40 a minute (150 words). At the cheapest credit ($0.0025) at least 55% stays. */
    for (const [scenes, words] of [[5, 150], [7, 350], [14, 1000], [30, 3500]]) {
      const cost = 1.4 + 0.32 * scenes + 0.4 * (words / 150)
      const revenue = explainerCredits(scenes, words) * 0.0025
      expect((revenue - cost) / revenue, `${scenes} scenes`).toBeGreaterThan(0.55)
    }
    expect(EXPLAINER_BASE_CREDITS).toBeGreaterThan(0)
  })
  it('the quote and the charge use it once every video is an explainer, from the saved story', async () => {
    for (const [k, v] of Object.entries(RENDER)) vi.stubEnv(k, v)
    vi.stubEnv('EXPLAINER_ENGINE', 'on')
    const { videoPriceInputs, videoCreditCost } = await import('../app/_lib/price-quote')
    const scenes = [{ narration: 'one two three' }, { narration: 'four five' }]
    const inputs = videoPriceInputs({ output_type: 'video', draft_data: { scenes, detailLevel: 'standard' } })
    expect(inputs).toMatchObject({ scenes: 2, words: 5 })
    expect(videoCreditCost(inputs, 'someone')).toBe(1400 + 2 * 320 + 5 * 3)
    /* No saved story (an API call): the most the length allows. */
    expect(videoPriceInputs({ output_type: 'video', draft_data: { detailLevel: 'quick' } })).toMatchObject({ scenes: 8, words: 400 })
    vi.stubEnv('EXPLAINER_ENGINE', 'admins')
    expect(videoCreditCost(inputs, 'someone')).toBe(1000)
  })
  it('a story bigger than the one priced is refused, and a fallback gives back the difference', () => {
    const route = read('app/api/generate-video/route.ts')
    expect(route).toContain("if (sent.scenes > priceInputs.scenes || sent.words > priceInputs.words) {")
    expect(route).toContain("await refundCredits(user.id, deductedCost - oldPrice, 'explainer-start', videoId)")
    expect(route).toContain("await admin.from('videos').update({ deducted_cost: oldPrice })")
  })
})
