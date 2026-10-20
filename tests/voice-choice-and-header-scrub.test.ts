import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import { createRequire } from 'module'
import path from 'path'

// Two customer-facing bugs found while building the free preview:
//
// 1. VOICE CHOICE IGNORED. Only the Slide Deck look spoke in the voice picked
//    on step 3. Aurora / Cinematic / Infographic / Editorial / Explainer
//    (render-service ttsToBuffer) and interactive presentations (app tts.ts)
//    always tried ElevenLabs "Rachel" first, so the pick was only heard when
//    ElevenLabs was down.
// 2. COMPLIANCE LEAK. The Editorial / Explainer header printed the document's
//    raw title ("QoL Max Accumulator+ III Index Universal Life Insurance"),
//    and V3's footer chips printed raw metric labels, past the product scrub.
//
// No paid calls: fal, ElevenLabs (fetch) and Claude are all fakes here.
// (Since 2026-10-19 OpenAI speaks nothing: fal first, then ElevenLabs direct,
// both in the picked voice.)

const ROOT = path.join(__dirname, '..')
const require_ = createRequire(import.meta.url)

// ── Fakes ──────────────────────────────────────────────────────────────────
const fake = vi.hoisted(() => ({
  claudeReply: '[]',
}))

vi.mock('@anthropic-ai/sdk', () => {
  class Anthropic {
    messages = { create: async () => ({ content: [{ type: 'text', text: fake.claudeReply }] }) }
  }
  return { default: Anthropic }
})

/** A fake mp3: MPEG frame-sync bytes, big enough to pass isRealAudio. */
const MP3 = () => new Uint8Array(2048).fill(0xff)

const calls: { url: string; body: string }[] = []
beforeEach(() => {
  calls.length = 0
  vi.stubEnv('FAL_KEY', '') // fal-first is tested in fal-tts.test.ts; here: the ElevenLabs fallback
  vi.stubEnv('ELEVENLABS_VOICE_ID', '')
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: { body?: string }) => {
    calls.push({ url: String(url), body: String(init?.body ?? '') })
    return new Response(MP3(), { status: 200 })
  }))
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

const ELEVEN_IDS: Record<string, string> = {
  nova: '21m00Tcm4TlvDq8ikWAM',    // Rachel
  shimmer: 'EXAVITQu4vr4xnSDxMaL', // Sarah
  onyx: 'nPczCjzI2devNBz1zQrb',    // Brian
  echo: 'iP95p4xoKVk53GoZ742B',    // Chris
  alloy: 'SAz9YHcvj6GT2YYXdXww',   // River
  fable: 'JBFqnCBsd6RMkjVDRZzb',   // George
}

// ── 1a. App voice (interactive presentations + anything using tts.ts) ──────
describe('app tts.ts speaks in the chosen voice', () => {
  async function loadTts() {
    vi.stubEnv('ELEVENLABS_API_KEY', 'test-key')   // ElevenLabs IS available
    vi.resetModules()
    return import('../app/_lib/tts')
  }

  for (const [voice, id] of Object.entries(ELEVEN_IDS)) {
    it(`"${voice}" is spoken by its own ElevenLabs voice when fal is off`, async () => {
      const { synthesizeSpeech } = await loadTts()
      await synthesizeSpeech('Your plan, explained.', voice)
      expect(calls).toHaveLength(1)
      expect(calls[0].url).toContain(`/text-to-speech/${id}`)
    })
  }

  it('an unknown or missing voice id falls back to Sarah (Rachel)', async () => {
    const { synthesizeSpeech } = await loadTts()
    await synthesizeSpeech('Hello there.', '')
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toContain(ELEVEN_IDS.nova)
  })

  it('with fal on, fal speaks the picked voice first and nothing else is called', async () => {
    vi.stubEnv('FAL_KEY', 'test-fal')
    const { synthesizeSpeech } = await loadTts()
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: { body?: string }) => {
      calls.push({ url: String(url), body: String(init?.body ?? '') })
      if (String(url).startsWith('https://fal.run/')) return new Response(JSON.stringify({ audio: { url: 'https://cdn.fal.test/a.mp3' } }), { status: 200 })
      return new Response(MP3(), { status: 200 })
    }))
    await synthesizeSpeech('Hello there.', 'onyx')
    expect(calls.map((c) => c.url)).toEqual(['https://fal.run/fal-ai/elevenlabs/tts/turbo-v2.5', 'https://cdn.fal.test/a.mp3'])
    expect(JSON.parse(calls[0].body).voice).toBe('Brian')
  })

  it('never calls OpenAI, even when every voice service fails', async () => {
    const { synthesizeSpeech } = await loadTts()
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push({ url: String(url), body: '' })
      return new Response('payment_required', { status: 402 })
    }))
    await expect(synthesizeSpeech('Hello there.', 'echo')).rejects.toThrow(/TTS failed \(fal \+ ElevenLabs\)/)
    expect(calls.some((c) => c.url.includes('openai'))).toBe(false)
  })
})

// ── 1b. Render service voice (Aurora / Cinematic / Infographic / Editorial) ─
describe('render-service ttsToBuffer speaks in the chosen voice', () => {
  const src = readFileSync(path.join(ROOT, 'render-service/server.js'), 'utf8').replace(/\r\n/g, '\n')
  const fnSrc = (name: string) => {
    const i = src.indexOf(`async function ${name}(`)
    if (i < 0) return `/* ${name} missing */`
    return src.slice(i, src.indexOf('\n}\n', i) + 2)
  }
  const realFal = require_(path.join(ROOT, 'render-service/fal-tts.js'))

  function build(o: { fal: 'ok' | 'down' | 'off'; eleven: 'ok' | 'down' | 'off' }) {
    const heard: { engine: string; voice: string }[] = []
    const falMod = {
      ...realFal,
      falSpeak: async (_t: string, opts: { voiceId?: string }) => {
        heard.push({ engine: 'fal', voice: realFal.falVoiceFor(opts.voiceId) })
        if (o.fal === 'down') throw new Error('fal down')
        return { audio: Buffer.from(MP3()) }
      },
    }
    const fakeRequire = (m: string) => (m === './fal-tts' ? falMod : (() => { throw new Error(`unexpected require ${m}`) })())
    const fakeFetch = async (url: string) => {
      heard.push({ engine: 'elevenlabs', voice: String(url).split('/text-to-speech/')[1]?.split('?')[0] ?? '' })
      return o.eleven === 'down' ? new Response('nope', { status: 402 }) : new Response(MP3(), { status: 200 })
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tts: any = new Function('speakable', 'require', 'ELEVEN_API_KEY', 'ELEVEN_MODEL', 'process', 'fetch',
      `${fnSrc('elevenSpeak')}\n${fnSrc('ttsToBuffer')}\nreturn ttsToBuffer`,
    )((t: string) => t, fakeRequire, o.eleven === 'off' ? undefined : 'key', 'eleven_turbo_v2_5', { env: { FAL_KEY: o.fal === 'off' ? '' : 'key' } }, fakeFetch)
    return { tts, heard }
  }

  for (const [voice, id] of Object.entries(ELEVEN_IDS)) {
    it(`"${voice}" is spoken by fal in its mapped voice, and by the same voice on ElevenLabs when fal is down`, async () => {
      const up = build({ fal: 'ok', eleven: 'ok' })
      await up.tts('Your plan, explained.', voice)
      expect(up.heard).toEqual([{ engine: 'fal', voice: realFal.FAL_VOICE_MAP[voice] }])
      const down = build({ fal: 'down', eleven: 'ok' })
      await down.tts('Your plan, explained.', voice)
      expect(down.heard).toEqual([{ engine: 'fal', voice: realFal.FAL_VOICE_MAP[voice] }, { engine: 'elevenlabs', voice: id }])
    })
  }

  it('nothing picked or an unknown id → Sarah (Rachel)', async () => {
    for (const v of [undefined, 'not-a-voice']) {
      const { tts, heard } = build({ fal: 'off', eleven: 'ok' })
      await tts('Hello.', v)
      expect(heard).toEqual([{ engine: 'elevenlabs', voice: ELEVEN_IDS.nova }])
    }
  })

  it('both services down → a clear error naming both, never OpenAI', async () => {
    const { tts, heard } = build({ fal: 'down', eleven: 'down' })
    await expect(tts('Hello.', 'nova')).rejects.toThrow(/TTS failed \(fal \+ ElevenLabs\)/)
    expect(heard.map((h) => h.engine)).toEqual(['fal', 'elevenlabs', 'elevenlabs'])
  }, 10_000)

  it('no voice service configured → a clear error', async () => {
    const { tts } = build({ fal: 'off', eleven: 'off' })
    await expect(tts('Hello.', 'nova')).rejects.toThrow(/no voice service configured/)
  })

  it('both render routes hand the voice id to the recorder', () => {
    for (const route of ["'/render-v3'", "'/render-editorial'"]) {
      const start = src.indexOf(`app.post(${route}`)
      expect(start).toBeGreaterThan(0)
      const body = src.slice(start, src.indexOf('\napp.', start + 10))
      expect(body).toMatch(/const \{[^}]*\bvoiceId\b[^}]*\} = req\.body/)
      expect(body).toMatch(/v3Tts\([^)]*, voiceId, /)
    }
    // …and the recorder hands it to ttsToBuffer.
    expect(fnSrc('v3Tts')).toContain('ttsToBuffer(text, voiceId)')
  })
})

// ── 1c. The payload builders carry the voice id ───────────────────────────
describe('payload builders carry the chosen voice', () => {
  it('buildV3Payload (Aurora / Cinematic / Infographic)', async () => {
    const { buildV3Payload } = await import('../app/_lib/v3-render')
    const p = buildV3Payload({ videoId: 'v', userId: 'u', voiceId: 'fable', scenes: [{ title: 'A', narration: 'a' }], brand: null, classification: null, videoStyle: 'aurora' })
    expect(p.voiceId).toBe('fable')
  })
  it('buildEditorialPayload (Editorial / Explainer)', async () => {
    fake.claudeReply = '[]'
    const { buildEditorialPayload } = await import('../app/_lib/editorial-render')
    const p = await buildEditorialPayload({ videoId: 'v', userId: 'u', voiceId: 'shimmer', scenes: [{ title: 'A', narration: 'a' }], brand: null, extracted: {}, variant: 'explainer' })
    expect(p.voiceId).toBe('shimmer')
  })
  it('generate-video hands voiceId to both builders', () => {
    const route = readFileSync(path.join(ROOT, 'app/api/generate-video/route.ts'), 'utf8')
    expect(route).toMatch(/buildEditorialPayload\(\{\s*videoId, userId: user\.id, voiceId,/)
    expect(route).toMatch(/buildV3Payload\(\{\s*videoId, userId: user\.id, voiceId,/)
  })
})

// ── 2. Headers / footers are scrubbed ──────────────────────────────────────
const PRODUCT_TITLE = 'QoL Max Accumulator+ III Index Universal Life Insurance'
const extracted = {
  title: PRODUCT_TITLE,
  carrier: 'Transamerica',
  policyType: 'Indexed Universal Life',
  classification: { documentType: 'life insurance illustration', category: 'insurance' },
  keyMetrics: [
    { label: 'QoL Max Accumulator+ Death Benefit', value: '$500,000', highlight: true },
    { label: 'Transamerica Cash Value at 65', value: '$176,204' },
    { label: 'Annual Premium', value: '$6,000' },
  ],
}
const LEAK = /qol|accumulator|transamerica|index universal life/i
const agentBrand = { name: 'Guardian Wealth Partners', profile_type: 'company', primary_color: '#123456' }

describe('Editorial / Explainer headers are scrubbed', () => {
  async function build(variant: 'editorial' | 'explainer' | 'time', brandName?: string | null) {
    // Claude was shown the raw metric labels, so it can put the name back.
    fake.claudeReply = JSON.stringify([
      { archetype: 'cover', kicker: 'QoL Max Accumulator+ III', title: 'Your QoL Max Accumulator+ plan', dek: 'Prepared by Guardian Wealth Partners', narration: 'Here is your plan.' },
      { archetype: 'stat', kicker: 'The numbers', title: 'What Transamerica illustrates', metrics: [{ label: 'QoL Max Accumulator+ Death Benefit', value: '$500,000' }], narration: 'Your benefit is $500,000.' },
      { archetype: 'chart', kicker: 'Breakdown', title: 'Where it goes', chart: { kind: 'bar', segments: [{ label: 'Transamerica fees', value: 10 }, { label: 'Cash value', value: 90 }] }, narration: 'Most of it builds value.' },
      { archetype: 'decision', kicker: 'Next step', title: 'Talk to Pat', dek: 'Guardian Wealth Partners · 555-123-4567', narration: 'Call Pat.' },
    ])
    const { buildEditorialPayload } = await import('../app/_lib/editorial-render')
    return buildEditorialPayload({
      videoId: 'v', userId: 'u', voiceId: 'nova',
      scenes: [{ title: 'Your plan', narration: 'Here is your plan.' }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      brand: agentBrand as any, brandName, extracted, variant,
      contactLine: 'Guardian Wealth Partners · 555-123-4567',
      recipient: 'Sam Lee',
    })
  }

  for (const variant of ['editorial', 'explainer', 'time'] as const) {
    it(`${variant}: running title has no product name (the reported leak)`, async () => {
      const p = await build(variant, null) // no brand name → masthead falls back to the title too
      expect(p.runningTitle).not.toMatch(LEAK)
      expect(p.masthead).not.toMatch(LEAK)
      expect(p.runningTitle).toBeTruthy()
    })
  }

  it('every on-screen word Claude wrote is scrubbed; figures, client and agent stay', async () => {
    const p = await build('explainer', 'Guardian Wealth Partners')
    const words = JSON.stringify(p.scenes)
    expect(words).not.toMatch(LEAK)
    expect(words).toContain('$500,000')                                   // figures kept
    expect(p.masthead).toBe('GUARDIAN WEALTH PARTNERS')                   // agent's own name kept (it contains "guardian", a blocklisted carrier)
    expect(p.contactLine).toBe('Guardian Wealth Partners · 555-123-4567') // agent's contact kept
    expect(p.scenes.at(-1)!.dek).toBe('Guardian Wealth Partners · 555-123-4567')
    expect(p.recipient).toBe('Sam Lee')                                    // client's name kept
  })

  it('an ordinary (non-insurance) document is left exactly as written', async () => {
    fake.claudeReply = '[]'
    const { buildEditorialPayload } = await import('../app/_lib/editorial-render')
    const p = await buildEditorialPayload({
      videoId: 'v', userId: 'u', voiceId: 'nova', scenes: [{ title: 'Acme Roadmap', narration: 'Our Acme roadmap.' }],
      brand: null, extracted: { title: 'Acme Quarterly Roadmap' },
    })
    expect(p.runningTitle).toBe('Acme Quarterly Roadmap')
    expect(p.scenes[0].title).toBe('Acme Roadmap')
  })
})

describe('V3 frame (DesignFrame footer / Infographic) is scrubbed', () => {
  it('footer chips, borrowed metric labels and hero label carry no product name', async () => {
    const { buildV3Payload } = await import('../app/_lib/v3-render')
    for (const videoStyle of ['aurora', 'cinematic', 'infographic']) {
      const p = buildV3Payload({
        videoId: 'v', userId: 'u', voiceId: 'nova',
        scenes: [
          { title: 'Your plan', narration: 'Hi.' },
          { title: 'Middle', narration: 'The numbers.' },
          { title: 'Middle two', narration: 'More.', slideData: { bullets: ['QoL Max Accumulator+ grows with the index'] } },
          { title: 'Thanks', narration: 'Bye.' },
        ],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        brand: agentBrand as any,
        classification: extracted.classification,
        keyMetrics: extracted.keyMetrics,
        extracted,
        videoStyle,
      })
      const onScreen = JSON.stringify({ frame: p.frame, scenes: p.scenes })
      expect(onScreen).not.toMatch(LEAK)
      expect(onScreen).toContain('$500,000')                // figures kept
      expect(p.frame?.eyebrow).toBe('Guardian Wealth Partners') // agent's own name kept
      expect(p.frame?.footer?.length).toBeGreaterThan(0)
    }
  })

  it('a compliance-exempt caller (regulated: false) is left alone', async () => {
    const { buildV3Payload } = await import('../app/_lib/v3-render')
    const p = buildV3Payload({
      videoId: 'v', userId: 'u', voiceId: 'nova', scenes: [{ title: 'A', narration: 'a' }, { title: 'B', narration: 'b' }, { title: 'C', narration: 'c' }],
      brand: null, classification: extracted.classification, keyMetrics: extracted.keyMetrics, extracted, regulated: false,
    })
    expect(p.frame?.footer?.[0]).toBe('QoL Max Accumulator+ Death Benefit')
  })

  it('generate-video gives the V3 builder the document so it can scrub', () => {
    const route = readFileSync(path.join(ROOT, 'app/api/generate-video/route.ts'), 'utf8')
    const call = route.slice(route.indexOf('const v3Payload = buildV3Payload({'))
    expect(call.slice(0, 1200)).toMatch(/extracted: policyData/)
  })
})
