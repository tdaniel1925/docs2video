import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { createRequire } from 'module'
import path from 'path'

/*
 * EVERYTHING ON FAL (2026-10-19). The OpenAI account ran out of credits, so
 * every production call to OpenAI was broken. Voices now come from fal
 * (ElevenLabs voices) then ElevenLabs direct; pictures from gpt-image-2.5 on
 * fal; text and vision from Claude. These tests cover the new adapters (fetch
 * stubbed — nothing is billed) and guard that no OpenAI call comes back.
 */
const ROOT = path.join(__dirname, '..')
const require_ = createRequire(import.meta.url)

const png = (bytes = 2048) => { const b = new Uint8Array(bytes); b.set([0x89, 0x50, 0x4e, 0x47]); return b }

type Call = { url: string; body: Record<string, unknown> }
let calls: Call[] = []
function stubFetch(answer: (url: string) => Response | Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: { body?: string }) => {
    let body: Record<string, unknown> = {}
    try { body = JSON.parse(String(init?.body ?? '{}')) } catch { /* not JSON */ }
    calls.push({ url: String(url), body })
    return answer(String(url))
  }))
}
const falOk = (url: string) => url.startsWith('https://fal.run/')
  ? new Response(JSON.stringify({ images: [{ url: 'https://cdn.fal.test/i.png' }] }), { status: 200 })
  : new Response(png(), { status: 200 })

beforeEach(() => {
  calls = []
  vi.stubEnv('FAL_KEY', 'test-fal')
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('app fal-image.ts (gpt-image-2.5 on fal)', () => {
  it('no picture to work from → text-to-image, the size and quality asked for', async () => {
    stubFetch(falOk)
    const { falImage } = await import('../app/_lib/fal-image')
    const out = await falImage('A calm blue background.', { width: 1536, height: 1024, quality: 'high' })
    expect(out.length).toBe(2048)
    expect(calls[0].url).toBe('https://fal.run/openai/gpt-image-2.5/flare/text-to-image')
    expect(calls[0].body).toMatchObject({ prompt: 'A calm blue background.', image_size: { width: 1536, height: 1024 }, quality: 'high', num_images: 1 })
    expect(calls[0].body.image_urls).toBeUndefined()
  })

  it('pictures to work from → the edit endpoint, sent as data URLs, with the mask and a transparent background', async () => {
    stubFetch(falOk)
    const { falImage } = await import('../app/_lib/fal-image')
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])
    await falImage('Add lettuce.', { images: [jpeg], mask: Buffer.from(png(300)), background: 'transparent', outputFormat: 'png' })
    expect(calls[0].url).toBe('https://fal.run/openai/gpt-image-2.5/flare/edit')
    expect((calls[0].body.image_urls as string[])[0]).toMatch(/^data:image\/jpeg;base64,/)
    expect(String(calls[0].body.mask_url)).toMatch(/^data:image\/png;base64,/)
    expect(calls[0].body).toMatchObject({ background: 'transparent', output_format: 'png' })
  })

  it('OK with no image, or bytes that are not a picture, is a failure', async () => {
    const { falImage } = await import('../app/_lib/fal-image')
    stubFetch(() => new Response(JSON.stringify({ status: 'COMPLETED' }), { status: 200 }))
    await expect(falImage('x', { attempts: 1 })).rejects.toThrow(/no image URL/)
    stubFetch((url) => url.startsWith('https://fal.run/') ? falOk(url) : new Response('{"detail":"nope"}'.repeat(40), { status: 200 }))
    await expect(falImage('x', { attempts: 1 })).rejects.toThrow(/not a picture/)
  })

  it('a refusal (4xx) fails at once; a 5xx is retried', async () => {
    const { falImage } = await import('../app/_lib/fal-image')
    stubFetch(() => new Response(JSON.stringify({ detail: 'bad prompt' }), { status: 422 }))
    await expect(falImage('x', { attempts: 3, backoffMs: 1 })).rejects.toThrow(/fal image 422: bad prompt/)
    expect(calls).toHaveLength(1)
    calls = []
    let n = 0
    stubFetch((url) => (url.startsWith('https://fal.run/') && n++ === 0 ? new Response('{}', { status: 503 }) : falOk(url)))
    await expect(falImage('x', { attempts: 2, backoffMs: 1 })).resolves.toBeInstanceOf(Buffer)
  })

  it('no FAL_KEY → throws before calling anything', async () => {
    vi.stubEnv('FAL_KEY', '')
    stubFetch(falOk)
    const { falImage } = await import('../app/_lib/fal-image')
    await expect(falImage('x')).rejects.toThrow(/FAL_KEY/)
    expect(calls).toHaveLength(0)
  })

  it('sizes and cost', async () => {
    const { falSizeFrom, falImageCostCents } = await import('../app/_lib/fal-image')
    expect(falSizeFrom('1536x1024')).toEqual({ width: 1536, height: 1024 })
    expect(falSizeFrom('auto')).toEqual({ width: 1024, height: 1024 })
    expect(falImageCostCents(1920, 1088, 'high')).toBeCloseTo(3.7, 1)
    expect(falImageCostCents(1024, 1024, 'low')).toBeLessThan(0.2)
  })
})

describe('ElevenLabs-direct fallback speaks the picked voice', () => {
  it('app and render service use the same six voice ids', async () => {
    const app = await import('../app/_lib/fal-tts')
    const svc = require_(path.join(ROOT, 'render-service/fal-tts.js'))
    expect(svc.ELEVEN_VOICE_IDS).toEqual(app.ELEVEN_VOICE_IDS)
    for (const v of ['nova', 'shimmer', 'onyx', 'echo', 'alloy', 'fable', 'nonsense', undefined]) {
      expect(svc.elevenVoiceIdFor(v)).toBe(app.elevenVoiceIdFor(v))
    }
    for (const name of Object.values(app.FAL_VOICE_MAP)) expect(app.ELEVEN_VOICE_IDS[name], name).toMatch(/^[A-Za-z0-9]{20}$/)
  })

  it('ELEVENLABS_VOICE_ID overrides the default voice only', async () => {
    vi.stubEnv('ELEVENLABS_VOICE_ID', 'customDefaultVoice00')
    const { elevenVoiceIdFor } = await import('../app/_lib/fal-tts')
    expect(elevenVoiceIdFor('nova')).toBe('customDefaultVoice00')
    expect(elevenVoiceIdFor('onyx')).toBe('nPczCjzI2devNBz1zQrb')
  })

  it('slides.js (Slide Deck / Kit) falls back to ElevenLabs with timings in the picked voice', () => {
    const src = readFileSync(path.join(ROOT, 'render-service/slides.js'), 'utf8')
    expect(src).toMatch(/async function elevenTimed\(text, outPath, voiceId\)/)
    expect(src).toMatch(/text-to-speech\/\$\{elevenVoiceIdFor\(voiceId\)\}\/with-timestamps/)
    expect(src).toMatch(/return await elevenTimed\(text, outPath, voiceId\)/)
  })
})

describe('the free preview voice', () => {
  it('is the same chain as the finished video, in the picked voice', async () => {
    const { voiceForPreview } = await import('../app/_lib/first-scene-preview')
    expect(voiceForPreview('video', 'aurora', 'fable')).toEqual({ engine: 'elevenlabs', voice: 'fable', note: null })
    const src = readFileSync(path.join(ROOT, 'app/_lib/first-scene-preview-server.ts'), 'utf8')
    const fn = src.slice(src.indexOf('export async function synthesizePreviewVoice'), src.indexOf('// ── Storage'))
    expect(fn).toMatch(/return synthesizeSpeech\(text, pick\.voice\)/)
  })
})

describe('claude-text.ts', () => {
  it('takes the JSON object out of a reply, fences and chatter removed', async () => {
    const { jsonObjectText } = await import('../app/_lib/claude-text')
    expect(JSON.parse(jsonObjectText('```json\n{"a":1}\n```'))).toEqual({ a: 1 })
    expect(JSON.parse(jsonObjectText('Here you go: {"b":{"c":2}} enjoy'))).toEqual({ b: { c: 2 } })
    expect(jsonObjectText('no json here')).toBe('{}')
  })
})

describe('the render service style preview', () => {
  it('reads the style with Claude vision and draws on fal', () => {
    const src = readFileSync(path.join(ROOT, 'render-service/server.js'), 'utf8')
    const route = src.slice(src.indexOf("app.post('/style-preview'"), src.indexOf("app.post('/style-preview'") + 3000)
    expect(route).toMatch(/type: 'image', source: \{ type: 'base64', media_type: mediaType/)
    expect(route).toMatch(/drawWithFal\(prompt, \{ quality: 'high' \}\)/)
  })
})

// ── The guard ───────────────────────────────────────────────────────────────
describe('no production code calls OpenAI', () => {
  const files: string[] = []
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (/\.(ts|tsx|js|mjs|cjs)$/.test(e.name)) files.push(p)
    }
  }
  walk(path.join(ROOT, 'app'))
  for (const d of ['lib', 'components']) if (existsSync(path.join(ROOT, d))) walk(path.join(ROOT, d))
  // The render service: the files the Docker image ships (render-v3-deploy/ is
  // an old, undeployed folder and is not in the image).
  for (const f of readdirSync(path.join(ROOT, 'render-service'))) if (/\.js$/.test(f)) files.push(path.join(ROOT, 'render-service', f))
  if (existsSync(path.join(ROOT, 'middleware.ts'))) files.push(path.join(ROOT, 'middleware.ts'))

  /** Comments out, so history can stay in them. */
  const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1')

  it('no import of the openai package, no api.openai.com, no OPENAI_API_KEY', () => {
    const bad: string[] = []
    for (const f of files) {
      let src = ''
      try { src = code(readFileSync(f, 'utf8')) } catch { continue }
      const rel = path.relative(ROOT, f).split(path.sep).join('/')
      if (/from ['"]openai['"]|require\(['"]openai['"]\)|import\(['"]openai['"]\)/.test(src)) bad.push(`${rel}: imports openai`)
      if (/api\.openai\.com/.test(src)) bad.push(`${rel}: calls api.openai.com`)
      if (/OPENAI_API_KEY/.test(src)) bad.push(`${rel}: reads OPENAI_API_KEY`)
    }
    expect(bad).toEqual([])
  })

  it('the openai package is no longer a dependency', () => {
    for (const pkg of ['package.json', 'render-service/package.json']) {
      const j = JSON.parse(readFileSync(path.join(ROOT, pkg), 'utf8'))
      expect({ ...j.dependencies, ...j.devDependencies }.openai, pkg).toBeUndefined()
    }
  })

  it('OPENAI_API_KEY is not required to go live; FAL_KEY is', async () => {
    const { REQUIRED_GO_LIVE_ENV } = await import('../app/_lib/env')
    expect(REQUIRED_GO_LIVE_ENV as readonly string[]).not.toContain('OPENAI_API_KEY')
    expect(REQUIRED_GO_LIVE_ENV as readonly string[]).toContain('FAL_KEY')
  })
})
