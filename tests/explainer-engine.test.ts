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
    const at = route.indexOf('if (await explainerEngineFor(user.id)) {')
    expect(at).toBeGreaterThan(0)
    expect(at).toBeLessThan(route.indexOf("if (videoStyle === 'kit' && kitEngineOn())"))
    expect(at).toBeGreaterThan(route.indexOf('const deducted = await deductCredits('))
  })
  it('falls back to the previous engine, with a note, when it cannot start — no video is lost', () => {
    expect(route).toContain("render_note: 'Made with the previous engine — the new explainer engine could not start. Regenerate to try it again.'")
  })
})
