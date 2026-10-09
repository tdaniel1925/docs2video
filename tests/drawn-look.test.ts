import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { createRequire } from 'module'
import path from 'path'
import sharp from 'sharp'
import { VIDEO_LOOKS, lookCards, isVideoLook } from '../app/(dashboard)/create/_components/make/looks'
import {
  buildDrawnSlides, drawnSlideText, drawnSlidePrompt, formatFigures, drawStyleOf,
  DRAW_STYLES, DEFAULT_DRAW_STYLE, MAX_BULLETS,
} from '../app/_lib/drawn-slides'
import { complianceScrubberFor, complianceLeaks } from '../app/_lib/compliance'
import { CREDIT_COSTS } from '../app/_lib/credits'
import { quoteOutput } from '../app/_lib/price-quote'
import { COPIED_FIELDS } from '../app/api/videos/draft/duplicate/copy-draft'
import { stillEngineFor, VIDEO_PREVIEW_LOOKS, lookNote } from '../app/_lib/first-scene-preview'
import { buildPreviewPlan } from '../app/_lib/first-scene-preview-server'
import { drawSlide } from '../app/_lib/slide-engine'

// "DRAWN SLIDES" — the AI draws every slide as one finished picture
// (gpt-image on fal, Gemini as the fallback), in one of three drawing styles.
// These guard the parts that would fail quietly: the look being offered, its
// price, the style reaching the renderer, the compliance scrub on every drawn
// word, and fal falling back instead of failing the video.

const root = path.resolve(__dirname, '..')
const read = (p: string) => readFileSync(path.join(root, p), 'utf8')
const req = createRequire(path.join(root, 'package.json'))

describe('the look is offered', () => {
  it('is a video look with the NEW tag, picked from data (looks.ts)', () => {
    const l = VIDEO_LOOKS.find((x) => x.id === 'drawn')
    expect(l?.name).toBe('Drawn slides')
    expect(isVideoLook('drawn')).toBe(true)
    const card = lookCards('video').find((c) => c.id === 'drawn')!
    expect(card.tag).toBe('NEW')
    expect(card.thumb).toEqual({ kind: 'img', src: '/style-samples/drawn-cover.png' })
    expect(card.samples).toEqual(['cover', 'data', 'closing'].map((k) => `/style-samples/drawn-${k}.png`))
    // Not offered for presentations.
    expect(lookCards('interactive').some((c) => c.id === 'drawn')).toBe(false)
  })

  it('has its sample pictures and one per drawing style, all 960x540', async () => {
    const names = ['cover', 'data', 'closing', ...DRAW_STYLES.map((s) => s.id)]
    for (const n of names) {
      const f = path.join(root, 'public', 'style-samples', `drawn-${n}.png`)
      expect(existsSync(f), f).toBe(true)
      const m = await sharp(f).metadata()
      expect([m.width, m.height], n).toEqual([960, 540])
    }
  })

  it('three drawing styles, 3D infographic first and the default', () => {
    expect(DRAW_STYLES.map((s) => s.name)).toEqual(['3D infographic', 'Illustrated', 'Classic'])
    expect(DEFAULT_DRAW_STYLE).toBe('3d')
    expect(drawStyleOf('nonsense')).toBe('3d')
    expect(drawStyleOf('classic')).toBe('classic')
  })

  it('step 3 shows the style chips only for this look, and saves + sends the style', () => {
    const page = read('app/(dashboard)/create/theme/page.tsx')
    expect(page).toMatch(/videoLook === 'drawn' \? \(\s*<div className="cf-row cf-draw-styles">/)
    expect(page).toMatch(/aria-label="Drawing style"/)
    // Saved on the draft AND sent to generate-video.
    expect(page.match(/\.\.\.\(videoLook === 'drawn' \? \{ drawStyle \} : \{\}\)/g)?.length).toBe(2)
    expect(page).toMatch(/if \(isDrawStyle\(d\.drawStyle\)\) setDrawStyle\(d\.drawStyle\)/)
  })
})

describe('price — the normal video price (measured cost is far below it)', () => {
  const row = (videoStyle: string) => ({ output_type: 'video', detail_level: 'standard', draft_data: { detailLevel: 'standard', videoStyle, drawStyle: 'classic' } })
  it('quotes exactly what any other look costs, from credits.ts', () => {
    const free = { video: false, presentation: false }
    const drawn = quoteOutput(row('drawn'), 'video', 'u1', free)
    expect(drawn.total).toBe(CREDIT_COSTS.videoStandard)
    expect(drawn.total).toBe(quoteOutput(row('slides'), 'video', 'u1', free).total)
  })
  it('credits.ts records the measured numbers next to the price', () => {
    const src = read('app/_lib/credits.ts')
    expect(src).toMatch(/"DRAWN SLIDES" LOOK/)
    expect(src).toMatch(/~0\.29c a slide/)
  })
})

describe('the style reaches the renderer', () => {
  const gv = read('app/api/generate-video/route.ts')
  it('generate-video reads the look and style from the body, else the saved draft', () => {
    expect(gv).toMatch(/\(body as any\)\.videoStyle \|\| \(typeof draft\.videoStyle === 'string' \? draft\.videoStyle : ''\) \|\| \(await getSetting\('video_style'\)\)/)
    expect(gv).toMatch(/drawStyleOf\(\(body as any\)\.drawStyle \?\? draft\.drawStyle\)/)
  })
  it('a drawn video goes to the classic /generate route with imageEngine fal + the style', () => {
    expect(gv).toMatch(/slidePrompts: drawn \? drawn\.prompts : allSlidePrompts/)
    expect(gv).toMatch(/imageEngine: 'fal',\s*drawStyle: drawn\.style/)
    // …and never into the Remotion engines or the parked v2 pipeline.
    expect(gv).toMatch(/if \(!drawn && \(useV3 \|\| videoStyle === 'slides' \|\| explicitV3\)\)/)
    expect(gv).toMatch(/if \(useV2 && !drawn\)/)
  })
  it('duplicate, the public API and the preview carry it too', () => {
    expect(COPIED_FIELDS as readonly string[]).toContain('drawStyle')
    expect(read('app/api/v1/videos/route.ts')).toMatch(/drawStyle: body\.drawStyle \|\| undefined/)
    expect(read('app/api/preview-first-scene/route.ts')).toMatch(/drawStyle: body\.drawStyle/)
  })
  it('the render service ships fal-image.js (a missing module crash-loops the box)', () => {
    expect(read('render-service/Dockerfile')).toMatch(/COPY fal-image\.js \.\//)
    expect(read('render-service/build-context.sh')).toMatch(/need_file fal-image\.js/)
  })
})

describe('words on a drawn slide', () => {
  it('formats money with $ and commas, leaves years and ages alone', () => {
    expect(formatFigures('$500000')).toBe('$500,000')
    expect(formatFigures('$1234.50 a year')).toBe('$1,234.50 a year')
    expect(formatFigures('1250000 people')).toBe('1,250,000 people')
    expect(formatFigures('$500,000')).toBe('$500,000')
    expect(formatFigures('Since 2026, to age 65')).toBe('Since 2026, to age 65')
  })

  it('short headline, at most 4 points, never contact details, no dangling cut', () => {
    const t = drawnSlideText({
      title: 'x',
      slideData: {
        headline: 'A very long headline that keeps on going well past the limit',
        stats: [{ label: 'Coverage', value: '$500000' }, { label: 'Premium', value: '$142' }],
        bullets: ['Call us at 555-123-4567', 'Pays your family if something happens to you and the kids', 'Two', 'Three', 'Four'],
      },
    }, 'content')
    expect(t.headline.split(' ').length).toBeLessThanOrEqual(8)
    expect(t.numbers[0].value).toBe('$500,000')
    expect(t.numbers.length + t.bullets.length).toBeLessThanOrEqual(MAX_BULLETS)
    expect(t.bullets.join(' ')).not.toMatch(/555/)
    for (const b of t.bullets) expect(b).not.toMatch(/\b(and|the|to|if)$/i)
  })

  it('the compliance scrub runs on EVERY drawn word of a regulated document', () => {
    const extracted = { title: 'Mutual of Omaha Income Advantage IUL', carrier: 'Mutual of Omaha', policyType: 'life insurance', classification: { documentType: 'insurance illustration' } }
    const scrub = complianceScrubberFor(extracted)
    expect(scrub).not.toBeNull()
    const plan = buildDrawnSlides({
      style: '3d',
      cover: { title: 'Your Mutual of Omaha plan', slideData: { headline: 'Your Mutual of Omaha plan' } },
      scenes: [{ title: 'Income Advantage benefits', slideData: { headline: 'Income Advantage benefits', bullets: ['Transamerica beats Prudential'], stats: [{ label: 'IUL death benefit', value: '$500000' }] } }],
      closing: { title: 'Thank you', slideData: { headline: 'Thank you', cta: 'Ask about Nationwide' } },
      colors: { primary: '#123456', secondary: '#abcdef' },
      scrub,
      recipient: 'The Rivera Family',
    })
    expect(complianceLeaks(plan.texts)).toEqual([])
    expect(complianceLeaks(plan.prompts)).toEqual([])
    // Figures and the client's name stay.
    expect(plan.prompts[1]).toContain('$500,000')
    expect(plan.prompts[0]).toContain('Prepared for The Rivera Family')
    // The check can fail: without the scrubber the names are there.
    const raw = buildDrawnSlides({ style: '3d', cover: { title: 'Your Mutual of Omaha plan' }, scenes: [], closing: {}, colors: { primary: '#1', secondary: '#2' } })
    expect(complianceLeaks(raw.prompts)).toContain('mutual of omaha')
  })

  it('every prompt is 16:9, uses the chosen style, and forbids logos/names/contact', () => {
    for (const st of DRAW_STYLES) {
      const p = drawnSlidePrompt({ style: st.id, text: { role: 'content', headline: 'Hi', numbers: [], bullets: ['One'] }, colors: { primary: '#111111', secondary: '#222222' } })
      expect(p).toMatch(/16:9/)
      expect(p).toContain(st.prompt)
      expect(p).toMatch(/Do NOT draw any logo, brand mark, company name/)
      expect(p).toMatch(/phone number, email address or website/)
      expect(p).toContain('HEADLINE: "Hi"')
    }
  })
})

describe('fal first, Gemini when fal fails', () => {
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.FAL_KEY })

  it('render service: a fal answer with no picture is a failure, not a success', async () => {
    const { drawWithFal } = req(path.join(root, 'render-service', 'fal-image.js'))
    process.env.FAL_KEY = 'test'
    // fal's queue can say COMPLETED with nothing in it — 200 without an image must throw.
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ status: 'COMPLETED', images: [] }), { status: 200 })))
    await expect(drawWithFal('x')).rejects.toThrow(/without an image/)
    delete process.env.FAL_KEY
    await expect(drawWithFal('x')).rejects.toThrow(/FAL_KEY/)
  })

  it('render service: a fal picture of the wrong shape is refused', async () => {
    const { drawWithFal } = req(path.join(root, 'render-service', 'fal-image.js'))
    process.env.FAL_KEY = 'test'
    const square = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#fff' } }).png().toBuffer()
    vi.stubGlobal('fetch', vi.fn(async (url: string) => String(url).includes('fal.run')
      ? new Response(JSON.stringify({ images: [{ url: 'https://cdn/x.png' }] }), { status: 200 })
      : new Response(new Uint8Array(square), { status: 200 })))
    await expect(drawWithFal('x')).rejects.toThrow(/wrong shape/)
  })

  it('render service /generate: a slide fal cannot draw drops through to the Gemini loop', () => {
    const src = read('render-service/server.js')
    const fn = src.slice(src.indexOf('async function generateOneSlide(idx)'), src.indexOf("model: 'gemini-3-pro-image-preview',\n            contents: [{ role: 'user', parts }]"))
    expect(fn).toMatch(/if \(useFal\) \{\s*const drawn = await drawCheckedWithFal\(idx\)\s*if \(drawn\) return drawn\s*\}/)
    // drawOneWithFal returns null (never throws) after its tries, so Gemini runs
    // (the spell-check wrapper hands a null first draw straight back).
    const one = src.slice(src.indexOf('async function drawOneWithFal(idx, opts = {})'), src.indexOf('async function drawCheckedWithFal(idx)'))
    expect(one).toMatch(/falling back to Gemini`\)\s*return null/)
    expect(src).toMatch(/return res\.buf\n/)
    expect(src).toMatch(/const useFal = req\.body\.imageEngine === 'fal'/)
  })

  it('preview (app side): fal fails → Gemini draws it', async () => {
    process.env.FAL_KEY = 'test'
    const png = await sharp({ create: { width: 32, height: 18, channels: 3, background: '#0f0' } }).png().toBuffer()
    const calls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push(String(url))
      if (String(url).includes('fal.run')) return new Response('{"detail":"down"}', { status: 500 })
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { data: png.toString('base64') } }] } }] }), { status: 200 })
    }))
    const out = await drawSlide('prompt', null, { quality: 'low' })
    expect(out.equals(png)).toBe(true)
    expect(calls[0]).toMatch(/fal\.run/)
    expect(calls[1]).toMatch(/generativelanguage/)
  })
})

describe('free preview', () => {
  it('has a preview: one real picture of the first content scene', () => {
    expect(VIDEO_PREVIEW_LOOKS).toContain('drawn')
    expect(stillEngineFor('video', 'drawn')).toBe('drawn')
    expect(lookNote('video', 'drawn')).toMatch(/drawn fresh/)
    const draft = {
      drawStyle: 'illustrated',
      scenes: [
        { _role: 'cover', title: 'Cover', narration: 'Hi', slideData: { headline: 'Cover' } },
        { title: 'What you get', narration: 'It pays five hundred thousand dollars.', slideData: { headline: 'What you get', stats: [{ label: 'Coverage', value: '$500000' }] } },
      ],
    }
    const plan = buildPreviewPlan({ output: 'video', look: 'drawn', draft, brand: null })!
    expect(plan.engine).toBe('drawn')
    expect(plan.request.style).toBe('illustrated')
    expect(String(plan.request.prompt)).toContain('"$500,000"')
    // The style on screen wins over the saved one, and changes the cached picture.
    const plan3d = buildPreviewPlan({ output: 'video', look: 'drawn', draft, brand: null, drawStyle: '3d' })!
    expect(plan3d.request.style).toBe('3d')
    expect(plan3d.key).not.toBe(plan.key)
  })
})
