import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { createRequire } from 'module'
import path from 'path'
import sharp from 'sharp'
import * as ts from '../app/_lib/slide-spellcheck'
import { drawnSlidePrompt, drawnSlideText } from '../app/_lib/drawn-slides'

// "DRAWN SLIDES" SPELL-CHECK — after a slide is drawn, Gemini 2.5 Flash reads
// it back and code compares it with the intended words; a dropped / wrong word
// or number, or words squeezed together ("toyou"), triggers ONE redraw, and
// the better picture is kept. A read-back that fails accepts the slide.
// The render service (JS) and the free preview (TS) carry mirror copies —
// every case here runs through BOTH.

const root = path.resolve(__dirname, '..')
const req = createRequire(path.join(root, 'package.json'))
const js = req(path.join(root, 'render-service', 'slide-spellcheck.js'))
const impls = [['render service (JS)', js], ['free preview (TS)', ts]] as const

const BULLET = 'Pays your family if something happens to you'
const EXPECTED = ['What your plan gives you', '$500,000', 'Coverage amount', '$142', 'Monthly premium', 'Age 65', 'Covered until', BULLET]
const lines = (...t: string[]) => ({ lines: t.map((text) => ({ text, box: null })) })
const GOOD = lines('What your plan gives you', '$500,000', '$142', 'Age 65', 'Coverage amount', 'Monthly premium', 'Covered until', BULLET)

afterEach(() => { vi.unstubAllGlobals(); delete process.env.GEMINI_API_KEY; delete process.env.FAL_KEY })

describe('the intended words', () => {
  it('are read back out of the drawn-slide prompt (the render service only gets prompts)', () => {
    const text = drawnSlideText({ slideData: { headline: 'What your plan gives you', stats: [{ value: '$500000', label: 'Coverage amount' }], bullets: [BULLET] } }, 'content')
    const prompt = drawnSlidePrompt({ style: '3d', text, colors: { primary: '#123456', secondary: '#654321' } })
    for (const [, m] of impls) expect(m.expectedFromPrompt(prompt)).toEqual(['What your plan gives you', '$500,000', 'Coverage amount', BULLET])
    const cover = drawnSlidePrompt({ style: 'classic', text: drawnSlideText({ title: 'Your plan' }, 'cover', { recipient: 'The Rivera Family' }), colors: { primary: '#000', secondary: '#fff' } })
    for (const [, m] of impls) expect(m.expectedFromPrompt(cover)).toEqual(['Your plan', 'Prepared for The Rivera Family'])
  })
})

describe.each(impls)('the forgiving compare — %s', (_name, m) => {
  it('passes the right words, forgiving case, punctuation, spacing, $ and commas', () => {
    expect(m.compareSlideText(EXPECTED, GOOD)).toEqual({ ok: true, problems: [] })
    const loose = lines('WHAT YOUR PLAN GIVES YOU!', '500000', '$ 142', 'age 65', 'coverage  amount', 'Monthly premium.', 'Covered until', 'Pays your family, if something happens to you.')
    expect(m.compareSlideText(EXPECTED, loose).ok).toBe(true)
    expect(m.compareSlideText(['Questions? Let’s talk'], ["Questions? Let's talk"]).ok).toBe(true)
  })

  it('flags a dropped word (test image 1: "…happens to" without "you")', () => {
    const r = m.compareSlideText(EXPECTED, lines('What your plan gives you', '$500,000', '$142', 'Age 65', 'Coverage amount', 'Monthly premium', 'Covered until', 'Pays your family if something happens to'))
    expect(r.ok).toBe(false)
    expect(r.problems).toEqual([`missing "you" (in "${BULLET}")`])
  })

  it('flags a wrong number', () => {
    const r = m.compareSlideText(['$500,000'], lines('$50,000'))
    expect(r.problems).toEqual(['missing "500000" (in "$500,000")'])
  })

  it('flags words written joined in the read-back ("toyou")', () => {
    const r = m.compareSlideText([BULLET], lines('Pays your family if something happens toyou'))
    expect(r.problems).toEqual([`words run together: "to you" drawn as "toyou" (in "${BULLET}")`])
  })

  it('parses the vision answer (lines + boxes), and refuses an empty one', () => {
    const ans = { candidates: [{ content: { parts: [{ text: '```json\n{"lines":[{"text":"Hi there","box_2d":[1,2,3,4]},"Bare"]}\n```' }] } }] }
    expect(m.parseVisionAnswer(ans)).toEqual({ lines: [{ text: 'Hi there', box: [1, 2, 3, 4] }, { text: 'Bare', box: null }] })
    expect(() => m.parseVisionAnswer({ candidates: [] })).toThrow(/no text/)
  })
})

// A synthetic line of "letters" (dark blocks): letter gaps 3px, word gaps
// 16px, on a 40px-tall line — the same proportions measured on the real test
// slides. `squeezeAt` closes one word gap down to a letter gap ("toyou").
async function syntheticLine(letters: number[], squeezeAt = -1) {
  const W = 1920, H = 1080, top = 500, h = 40, lw = 22
  let x = 300
  const rects: string[] = []
  letters.forEach((n, wi) => {
    for (let i = 0; i < n; i++) { rects.push(`<rect x="${x}" y="${top}" width="${lw}" height="${h}" fill="#1f2937"/>`); x += lw + 3 }
    x += wi === squeezeAt ? 0 : 13
  })
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#f8fafc"/>${rects.join('')}</svg>`
  const png = await sharp(Buffer.from(svg)).png().toBuffer()
  return { png, box: [(top / H) * 1000, (300 / W) * 1000, ((top + h) / H) * 1000, (x / W) * 1000] }
}

describe.each(impls)('squeezed words, measured in the pixels — %s', (_name, m) => {
  const text = 'Pays your family if'
  it('a line with normal word gaps passes', async () => {
    const { png, box } = await syntheticLine([4, 4, 6, 2])
    expect(await m.findSqueezedLines(png, { lines: [{ text, box }] }, [text], sharp)).toEqual([])
  })
  it('a line with two words squeezed together is flagged', async () => {
    const { png, box } = await syntheticLine([4, 4, 6, 2], 2)
    expect(await m.findSqueezedLines(png, { lines: [{ text, box }] }, [text], sharp)).toEqual([`words run together: "${text}" is drawn as 3 words, not 4`])
  })
  it('only lines of the intended text are measured; a line with no box is skipped', async () => {
    const { png, box } = await syntheticLine([4, 4, 6, 2], 2)
    expect(await m.findSqueezedLines(png, { lines: [{ text, box }] }, ['Something else entirely'], sharp)).toEqual([])
    expect(await m.findSqueezedLines(png, { lines: [{ text, box: null }] }, [text], sharp)).toEqual([])
  })
})

// The two saved test slides with the REAL Gemini Flash read-backs (2026-10-09,
// boxes included). The pictures live in .shots/ (not in git), so this runs
// only where they exist.
const RAW = path.join(root, '.shots/drawn-look/raw')
const REAL = {
  '3d-data-low-ref-6.png': [['What your plan gives you', [94, 66, 190, 760]], ['$500,000', [450, 101, 520, 302]], ['$142', [450, 401, 520, 512]], ['Age 65', [450, 711, 520, 875]], ['Coverage amount', [538, 101, 576, 292]], ['Monthly premium', [538, 401, 576, 583]], ['Covered until', [538, 711, 576, 850]], [BULLET, [742, 292, 790, 890]]],
  'classic-data-low-4.png': [['What your plan gives you', [120, 65, 217, 813]], ['$500,000', [440, 86, 537, 319]], ['$142', [440, 387, 537, 540]], ['Age 65', [440, 686, 537, 880]], ['Coverage amount', [560, 89, 603, 287]], ['Monthly premium', [490, 389, 603, 590]], ['Covered until', [609, 689, 652, 850]], [BULLET, [775, 139, 837, 899]]],
} as Record<string, [string, number[]][]>
describe.skipIf(!existsSync(path.join(RAW, '3d-data-low-ref-6.png')))('the saved test slides (real read-backs)', () => {
  it.each(impls)('%s: flags "toyou" on image 6, passes image 4 (same words, normal gaps)', async (_n, m) => {
    for (const [file, want] of [['3d-data-low-ref-6.png', false], ['classic-data-low-4.png', true]] as const) {
      const png = readFileSync(path.join(RAW, file))
      const seen = { lines: REAL[file].map(([text, box]) => ({ text, box })) }
      const r = await m.checkSlide(png, EXPECTED, { read: async () => seen, sharp })
      expect(r?.ok, file).toBe(want)
      if (!want) expect(r!.problems).toEqual([`words run together: "${BULLET}" is drawn as 7 words, not 8`])
    }
  })
})

// ── Draw → check → redraw once → keep the better one ───────────────────────

const pic = (n: number) => Buffer.from(`picture-${n}`)

describe.each(impls)('redraw rules — %s', (_name, m) => {
  const run = (checks: ({ ok: boolean; problems: string[] } | null)[], opts: { canRedraw?: () => boolean; drawFails?: boolean } = {}) => {
    const draws: number[] = []
    const looked: string[] = []
    const res = m.drawChecked({
      expected: EXPECTED,
      draw: async (attempt: 1 | 2) => { draws.push(attempt); if (attempt === 2 && opts.drawFails) throw new Error('fal down'); return pic(attempt) },
      check: async (png: Buffer) => { looked.push(png.toString()); return checks.shift() ?? null },
      canRedraw: opts.canRedraw,
      log: () => {},
    })
    return res.then((r: { buf: Buffer | null; redrawn: boolean; problems: string[]; checked: boolean }) => ({ ...r, buf: r.buf?.toString(), draws, looked }))
  }
  const bad = (...p: string[]) => ({ ok: false, problems: p })
  const good = { ok: true, problems: [] }

  it('a clean slide is kept, no redraw', async () => {
    expect(await run([good])).toMatchObject({ buf: 'picture-1', redrawn: false, draws: [1], looked: ['picture-1'] })
  })
  it('a missing word → redraw once; the clean redraw is kept', async () => {
    expect(await run([bad('missing "you"'), good])).toMatchObject({ buf: 'picture-2', redrawn: true, draws: [1, 2], problems: [] })
  })
  it('words run together → redraw once', async () => {
    expect(await run([bad('words run together: "to you"'), good])).toMatchObject({ buf: 'picture-2', draws: [1, 2] })
  })
  it('the vision call fails → the slide is accepted, no redraw', async () => {
    expect(await run([null])).toMatchObject({ buf: 'picture-1', redrawn: false, checked: false, draws: [1] })
  })
  it('still wrong after the redraw → keep the one with fewer problems', async () => {
    expect(await run([bad('a'), bad('a', 'b')])).toMatchObject({ buf: 'picture-1', problems: ['a'], draws: [1, 2] })
    expect(await run([bad('a', 'b'), bad('c')])).toMatchObject({ buf: 'picture-2', problems: ['c'], redrawn: true })
  })
  it('the redraw itself fails → the first picture is kept (never fails the video)', async () => {
    expect(await run([bad('a')], { drawFails: true })).toMatchObject({ buf: 'picture-1', problems: ['a'] })
  })
  it('no time left (free preview) → no redraw', async () => {
    expect(await run([bad('a')], { canRedraw: () => false })).toMatchObject({ buf: 'picture-1', draws: [1] })
  })
})

describe.each(impls)('the read-back call — %s', (_name, m) => {
  it('a vision HTTP error or timeout → null (accept the slide)', async () => {
    process.env.GEMINI_API_KEY = 'test'
    const png = (await syntheticLine([3, 3])).png
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":{"message":"quota"}}', { status: 429 })))
    expect(await m.checkSlide(png, ['x y'], { log: () => {}, sharp })).toBeNull()
    vi.stubGlobal('fetch', vi.fn(async () => { throw new DOMException('timed out', 'TimeoutError') }))
    expect(await m.checkSlide(png, ['x y'], { log: () => {}, sharp })).toBeNull()
    delete process.env.GEMINI_API_KEY
    expect(await m.checkSlide(png, ['x y'], { log: () => {}, sharp })).toBeNull()
  })
  it('calls Gemini 2.5 Flash with thinking off and reads the answer', async () => {
    process.env.GEMINI_API_KEY = 'test'
    const png = (await syntheticLine([3, 3])).png
    const calls: { url: string; body: { generationConfig: Record<string, unknown> } }[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: { body: string }) => {
      calls.push({ url, body: JSON.parse(init.body) })
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"lines":[{"text":"Pays your family","box_2d":null}]}' }] } }] }), { status: 200 })
    }))
    const r = await m.checkSlide(png, ['Pays your family if'], { log: () => {}, sharp })
    expect(r).toMatchObject({ ok: false, problems: ['missing "if" (in "Pays your family if")'] })
    expect(calls[0].url).toMatch(/gemini-2\.5-flash:generateContent$/)
    expect(calls[0].body.generationConfig).toMatchObject({ temperature: 0, thinkingConfig: { thinkingBudget: 0 } })
  })
})

describe('wired in', () => {
  const read = (p: string) => readFileSync(path.join(root, p), 'utf8')
  it('render service /generate: every fal slide is spell-checked; the redraw drops the style reference', () => {
    const src = read('render-service/server.js')
    const fn = src.slice(src.indexOf('async function drawCheckedWithFal(idx)'), src.indexOf('async function generateOneSlide(idx)'))
    expect(fn).toMatch(/expected: expectedFromPrompt\(slidePrompts\[idx\]\)/)
    expect(fn).toMatch(/draw: \(attempt\) => drawOneWithFal\(idx, \{ noRef: attempt === 2 \}\)/)
    expect(src).toMatch(/refImage: opts\.noRef \|\| process\.env\.DRAWN_SLIDE_REF === 'off' \? null : falStyleRef/)
    // The module ships in the image (a missing file = MODULE_NOT_FOUND at runtime).
    expect(read('render-service/Dockerfile')).toMatch(/COPY slide-spellcheck\.js \.\//)
    expect(read('render-service/build-context.sh')).toMatch(/need_file slide-spellcheck\.js/)
  })

  it('free preview: a misspelt first draw is redrawn and the clean one stored', async () => {
    process.env.FAL_KEY = 'test'
    process.env.GEMINI_API_KEY = 'test'
    const { drawPreviewStill } = await import('../app/_lib/first-scene-preview-server')
    const p1 = await sharp({ create: { width: 64, height: 36, channels: 3, background: '#f00' } }).png().toBuffer()
    const p2 = await sharp({ create: { width: 64, height: 36, channels: 3, background: '#00f' } }).png().toBuffer()
    let falDraws = 0, reads = 0
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const u = String(url)
      if (u.includes('fal.run')) { falDraws++; return new Response(JSON.stringify({ images: [{ url: `https://cdn/${falDraws}.png` }] }), { status: 200 }) }
      if (u.startsWith('https://cdn/')) return new Response(new Uint8Array(u.endsWith('1.png') ? p1 : p2), { status: 200 })
      if (u.includes('gemini-2.5-flash')) {
        reads++
        const text = reads === 1 ? 'Pays your family if something happens to' : BULLET
        return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ lines: [{ text }] }) }] } }] }), { status: 200 })
      }
      return new Response('{}', { status: 404 })
    }))
    let stored: Buffer | null = null
    const admin = { storage: { from: () => ({
      upload: async (_p: string, b: Buffer) => { stored = b; return { error: null } },
      getPublicUrl: (p: string) => ({ data: { publicUrl: `https://store/${p}` } }),
    }) } }
    const prompt = drawnSlidePrompt({ style: '3d', text: { role: 'content', headline: '', numbers: [], bullets: [BULLET] }, colors: { primary: '#000', secondary: '#fff' } })
    const url = await drawPreviewStill(admin as never, 'u/still.png', { engine: 'drawn', key: 'k', request: { prompt } } as never)
    expect(url).toBe('https://store/u/still.png')
    expect(falDraws).toBe(2)
    expect(reads).toBe(2)
    const { data } = await sharp(stored!).raw().toBuffer({ resolveWithObject: true })
    expect([data[0], data[1], data[2]]).toEqual([0, 0, 255]) // the blue redraw, not the red first try
  })
})
