import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

/*
 * THE PICKED LOOK REACHES THE EXPLAINER ENGINE (fix, 2026-10-18). Before this,
 * every video went to the explainer engine with no picture of the look the
 * customer picked, so Animated slides, Editorial and Bright all came out the
 * same default look while the free preview showed the picked one.
 */
const stored = new Set<string>()
const rendered: string[] = []
vi.mock('../app/_lib/first-scene-preview-server', () => ({
  loadPreviewBrand: async () => null,
  buildPreviewPlan: (o: { look: string }) => ({ engine: 'kit', request: {}, key: `key-${o.look}`, narration: '', sceneTitle: '' }),
  previewStoragePath: (uid: string, kind: string, key: string) => `${uid}/previews/${kind}-${key}.png`,
  publicUrlFor: (_a: unknown, path: string) => `https://store.example/${path}`,
  alreadyStored: async (url: string) => stored.has(url),
  renderPreviewStill: async (o: { plan: { key: string } }) => { rendered.push(o.plan.key); return `https://store.example/rendered-${o.plan.key}.png` },
}))

const { explainerLookFor, pickedKitLook, READY_LOOK_SAMPLE } = await import('../app/_lib/explainer-look')
const base = { admin: {} as never, userId: 'u1', videoId: 'v1', siteUrl: 'https://docs2video.com' }
const draftFor = (kitLook: string) => ({ videoStyle: 'kit', kitLook })

beforeEach(() => { stored.clear(); rendered.length = 0 })

describe('the look the customer picked is what the engine designs from', () => {
  it('each ready look sends its OWN picture — three looks, three different references', async () => {
    const refs = await Promise.all(['animated-slides', 'editorial', 'bright'].map((k) => explainerLookFor({ ...base, draft: draftFor(k) })))
    expect(refs.map((r) => r.source)).toEqual(['look-sample', 'look-sample', 'look-sample'])
    expect(refs.map((r) => r.referenceUrl)).toEqual(['animated-slides', 'editorial', 'bright'].map((k) => `https://docs2video.com${READY_LOOK_SAMPLE[k]}`))
    expect(new Set(refs.map((r) => r.referenceUrl)).size).toBe(3)
  })

  it('their own free preview of the look wins — the video is designed from what they saw', async () => {
    stored.add('https://store.example/u1/previews/still-key-kit:editorial.png')
    const r = await explainerLookFor({ ...base, draft: draftFor('editorial') })
    expect(r).toEqual({ referenceUrl: 'https://store.example/u1/previews/still-key-kit:editorial.png', source: 'preview', look: 'editorial' })
  })

  it('their own picture wins over everything', async () => {
    const r = await explainerLookFor({ ...base, draft: draftFor('bright'), ownReferenceUrl: 'https://x/mine.png' })
    expect(r.source).toBe('own')
    expect(r.referenceUrl).toBe('https://x/mine.png')
  })

  it('"Your look" with no preview yet: its preview still is made now', async () => {
    const r = await explainerLookFor({ ...base, draft: draftFor('custom') })
    expect(rendered).toEqual(['key-kit:custom'])
    expect(r.source).toBe('rendered')
  })

  it('the brand look, an old look or no look: the engine’s default look', async () => {
    expect((await explainerLookFor({ ...base, draft: draftFor('brand') })).referenceUrl).toBeNull()
    expect((await explainerLookFor({ ...base, draft: { videoStyle: 'aurora' } })).source).toBe('default')
    expect(pickedKitLook({ videoStyle: 'slides' })).toBe('animated-slides')
    expect(pickedKitLook({ videoStyle: 'drawn' })).toBeNull()
  })
})

describe('the route', () => {
  const route = readFileSync(join(__dirname, '..', 'app/api/generate-video/route.ts'), 'utf8')
  const engine = readFileSync(join(__dirname, '..', 'app/_lib/explainer-engine.ts'), 'utf8')

  it('sends the picked look as the reference, matched faithfully', () => {
    /* a template has its own fixed design: no look is read for it (video-templates.ts) */
    expect(route).toMatch(/const picked = videoTemplateId\r?\n\s+\? \{ referenceUrl: null, source: 'template', look: videoTemplateId \}\r?\n\s+: await explainerLookFor\(\{/)
    expect(route).toMatch(/referenceUrl: picked\.referenceUrl,/)
    /* a picture of the look is matched as it is (no direction); only the bare default is pushed */
    expect(engine).toMatch(/direction: own \|\| template \? undefined : 'conservative'/)
  })

  it('Drawn slides keep their own pipeline — the explainer engine does not draw them', () => {
    expect(route).toMatch(/if \(!isDrawn && await explainerEngineFor\(user\.id\)\)/)
  })
})

describe('public video files are served, not sent to sign-in', () => {
  it('the proxy skips .mp4 and other media like it skips images', async () => {
    const src = readFileSync(join(__dirname, '..', 'proxy.ts'), 'utf8')
    const pattern = src.match(/matcher: \['(.*)'\]/)![1].replace(/\\\\/g, '\\')
    const matches = (p: string) => new RegExp(`^${pattern}$`).test(p)
    for (const p of ['/industry-demos/insurance.mp4', '/look-samples/heritage.mp4', '/home/hero.jpg', '/music/a.mp3']) expect(matches(p), p).toBe(false)
    for (const p of ['/dashboard', '/create/look', '/api/generate-video']) expect(matches(p), p).toBe(true)
  })
})
