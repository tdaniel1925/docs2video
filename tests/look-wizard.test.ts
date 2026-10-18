// THE LOOK SCREEN (look wizard v2) — the rules behind it.
//   palette extraction (a busy photo, a Bootstrap-default page), the contrast
//   guard on extreme looks, nudges + undo, the daily cap + cache, a failed read
//   falling back to the brand, look copies staying apart (old videos never
//   change), free fonts only, music, Drawn slides reading the look, step 3's cards.
import { describe, it, expect, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { clusterPixels, pickPalette, rgbToLab, isFrameworkDefault, hexToRgb, deltaE, chroma } from '../app/_lib/look-palette'
import {
  canUndo, commit, guardNotes, keepVideoLook, lookFromBrand, nudge, NUDGES, readBrandLooks, readsWell, snapshotLook,
  startHistory, undo, withSavedLook, headWeightFor, READY_STYLES,
} from '../app/_lib/look-wizard'
import { checkRead, fontFromName, isVideoLink, readReference, REFERENCE_READS_PER_DAY, type ReadDeps } from '../app/_lib/look-reference'
import { picturePixels } from '../app/_lib/look-reference-deps'
import { contrast, FONT_IDS, guardLook, KIT_LOOKS, musicFileFor, sanitizeLook, type Look } from '../remotion/src/kit/spec'
import { resolveKitLook } from '../app/_lib/kit-engine'
import { drawnLookFrom, drawnSlidePrompt } from '../app/_lib/drawn-slides'
import { lookCards, CREATE_LOOK_CARD } from '../app/(dashboard)/create/_components/make/looks'
import type { Brand } from '../app/_lib/types'

const FIX = path.join(__dirname, 'fixtures', 'look')
const lab = (hex: string) => rgbToLab(hexToRgb(hex))

/** A web page made of Bootstrap's default colours + one real brand colour (red). */
async function bootstrapPage(withBrand = true): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800">
    <rect width="1280" height="800" fill="#ffffff"/>
    <rect width="1280" height="90" fill="#0d6efd"/>
    <rect x="80" y="160" width="700" height="40" fill="#212529"/>
    <rect x="80" y="230" width="900" height="16" fill="#6c757d"/><rect x="80" y="260" width="860" height="16" fill="#6c757d"/>
    <rect x="80" y="320" width="220" height="60" rx="6" fill="#0d6efd"/>
    <rect x="320" y="320" width="220" height="60" rx="6" fill="#198754"/>
    ${withBrand ? '<rect x="900" y="130" width="300" height="300" fill="#c8102e"/>' : ''}
    <rect x="0" y="700" width="1280" height="100" fill="#f8f9fa"/>
  </svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}

describe('palette extraction (colours measured in code)', () => {
  it('a busy photo gives ONE strong accent and calm neutrals, never five greys', async () => {
    const px = await picturePixels(fs.readFileSync(path.join(FIX, 'busy-photo.jpg')))
    const p = pickPalette(clusterPixels(px))
    expect(chroma(lab(p.accent))).toBeGreaterThan(22)                      // a real colour
    expect(chroma(lab(p.bg))).toBeLessThanOrEqual(13)                       // a calm page
    expect(contrast(p.text, p.bg)).toBeGreaterThanOrEqual(7)
    expect(new Set([p.bg, p.glow, p.accent, p.text]).size).toBe(4)
    expect(p.alternatives.length).toBeGreaterThan(0)                        // "Try other colours from it"
    // the same picture always gives the same colours
    expect(pickPalette(clusterPixels(px)).accent).toBe(p.accent)
  })

  it('a Bootstrap-default page: the real brand red wins, the framework blue/green are set aside', async () => {
    const p = pickPalette(clusterPixels(await picturePixels(await bootstrapPage(true))))
    expect(deltaE(lab(p.accent), lab('#c8102e'))).toBeLessThan(12)
    expect(isFrameworkDefault(lab(p.accent))).toBe(false)
    expect(p.skippedDefaults.some((h) => deltaE(lab(h), lab('#0d6efd')) < 10)).toBe(true)
    expect(p.light).toBe(true)
  })

  it('a page with ONLY framework colours still gets a usable look (nothing is blocked)', async () => {
    const p = pickPalette(clusterPixels(await picturePixels(await bootstrapPage(false))))
    expect(p.accent).toMatch(/^#[0-9a-f]{6}$/)
    expect(readsWell({ ...KIT_LOOKS.editorial, colors: { bg: p.bg, glow: p.glow, accent: p.accent, text: p.text } })).toBe(true)
  })

  it('near-duplicate colours are merged', () => {
    const px: number[] = []
    for (let i = 0; i < 500; i++) px.push(20, 30, 60)
    for (let i = 0; i < 500; i++) px.push(22, 31, 62)
    for (let i = 0; i < 300; i++) px.push(220, 180, 90)
    const c = clusterPixels(px, 6)
    expect(c.length).toBe(2)
  })
})

describe('the quality guard on extreme looks (always on)', () => {
  const extreme: Record<string, Look['colors']> = {
    'pale on pale': { bg: '#f4f1ec', glow: '#efeae2', accent: '#f1e7c8', text: '#ece7df' },
    neon: { bg: '#000000', glow: '#ff00ff', accent: '#39ff14', text: '#ffffff' },
    'black on black': { bg: '#000000', glow: '#050505', accent: '#0a0a0a', text: '#020202' },
  }
  for (const [name, colors] of Object.entries(extreme)) {
    it(`${name}: every word ends up readable, and the fix is SAID`, () => {
      const look: Look = { ...KIT_LOOKS['animated-slides'], id: 'custom', colors }
      expect(readsWell(look)).toBe(true)
      const { fixes } = guardNotes(look)
      expect(fixes.length).toBeGreaterThan(0)
      const t = guardLook(look).tokens
      expect(contrast(t.text, t.bg)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(t.text, t.glow)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(t.accentBig, t.bg)).toBeGreaterThanOrEqual(3)
    })
  }
  it('the ready looks need no fixes (the guard is quiet when nothing is wrong)', () => {
    for (const s of READY_STYLES) expect(guardNotes(s.look).fixes, s.name).toEqual([])
  })
})

describe('nudges and undo', () => {
  const base = KIT_LOOKS['animated-slides']
  it('each nudge changes the look and keeps it readable', () => {
    for (const n of NUDGES) {
      const next = nudge(base, n.id)
      expect(JSON.stringify(next.colors) !== JSON.stringify(base.colors) || next.feel !== base.feel, n.id).toBe(true)
      expect(readsWell(next), n.id).toBe(true)
    }
    expect(nudge(base, 'bolder').feel).toBe('energetic')
    expect(nudge(base, 'calmer').feel).toBe('calm')
  })
  it('undo walks back one step at a time; a no-op is not a step', () => {
    let h = startHistory(base)
    expect(canUndo(h)).toBe(false)
    h = commit(h, base)
    expect(canUndo(h)).toBe(false)
    const warm = nudge(base, 'warmer')
    h = commit(h, warm)
    h = commit(h, nudge(warm, 'bolder'))
    h = undo(h)
    expect(h.present).toEqual(warm)
    h = undo(h)
    expect(h.present).toEqual(base)
    expect(undo(h)).toBe(h)
  })
})

// ── the reference read with pretend outside services ─────────────────────────
function fakeDeps(over: Partial<ReadDeps> = {}) {
  const store = new Map<string, Awaited<ReturnType<ReadDeps['cacheGet']>>>()
  let count = 0
  const calls = { vision: 0, count: 0, pixels: 0, screenshot: 0 }
  const deps: ReadDeps = {
    cacheGet: async (k) => store.get(k) ?? null,
    cachePut: async (k, v) => { store.set(k, v) },
    countRead: async () => { calls.count++; count++; return count > REFERENCE_READS_PER_DAY ? 'over' : 'allowed' },
    pixels: async (pic) => { calls.pixels++; return picturePixels(pic) },
    thumb: async (pic) => pic,
    vision: async () => { calls.vision++; return { json: { mood: 'calm', closestFontFamily: 'Fraunces', density: 'airy', energy: 'low' }, costUsd: 0.0004 } },
    pdfFirstPage: async () => bootstrapPage(true),
    screenshot: async () => { calls.screenshot++; return bootstrapPage(true) },
    isPublic: async (u) => !/localhost|127\.0\.0\.1|169\.254/.test(u),
    ...over,
  }
  return { deps, calls, store }
}

describe('reading a reference ("Something I like")', () => {
  it('reads a picture: measured colours + a free font labelled closest match + the feel', async () => {
    const { deps } = fakeDeps()
    const r = await readReference({ kind: 'image', bytes: await bootstrapPage(true) }, deps)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.look.headFont).toBe('fraunces')
    expect(r.fontLabel).toMatch(/closest match/)
    expect(r.look.feel).toBe('calm')
    expect(r.cached).toBe(false)
    expect(r.costUsd).toBeLessThan(0.01)
  })

  it('the same file again is cached: free, not counted, no AI call', async () => {
    const { deps, calls } = fakeDeps()
    const bytes = await bootstrapPage(true)
    await readReference({ kind: 'image', bytes }, deps)
    const again = await readReference({ kind: 'image', bytes: Buffer.from(bytes) }, deps)
    expect(again.ok && again.cached).toBe(true)
    expect(calls.vision).toBe(1)
    expect(calls.count).toBe(1)
  })

  it(`the ${REFERENCE_READS_PER_DAY + 1}st new read in a day is refused, and falls back to the brand`, async () => {
    const { deps } = fakeDeps()
    for (let i = 0; i < REFERENCE_READS_PER_DAY; i++) {
      const png = await sharp({ create: { width: 40, height: 40, channels: 3, background: { r: i * 9, g: 80, b: 120 } } }).png().toBuffer()
      expect((await readReference({ kind: 'image', bytes: png }, deps)).ok).toBe(true)
    }
    const r = await readReference({ kind: 'image', bytes: await bootstrapPage(false) }, deps)
    expect(r).toMatchObject({ ok: false, fallback: 'brand', code: 'cap' })
  })

  it('the counter failing CLOSES the door (no AI call) and falls back to the brand', async () => {
    const { deps, calls } = fakeDeps({ countRead: async () => 'error' })
    const r = await readReference({ kind: 'image', bytes: await bootstrapPage(true) }, deps)
    expect(r).toMatchObject({ ok: false, fallback: 'brand', code: 'resting' })
    expect(calls.vision).toBe(0)
  })

  it('an unreadable picture falls back to the brand with a plain message', async () => {
    const { deps } = fakeDeps()
    const r = await readReference({ kind: 'image', bytes: Buffer.from('not a picture at all') }, deps)
    expect(r).toMatchObject({ ok: false, fallback: 'brand', code: 'unreadable' })
    if (!r.ok) expect(r.message).toMatch(/brand/)
  })

  it('a broken PDF falls back too', async () => {
    const { deps } = fakeDeps({ pdfFirstPage: async () => { throw new Error('convert 500') } })
    expect(await readReference({ kind: 'pdf', bytes: Buffer.from('%PDF-1.4 junk') }, deps)).toMatchObject({ ok: false, fallback: 'brand' })
  })

  it('the vision step failing still gives the measured colours (defaults for feel/font)', async () => {
    const { deps } = fakeDeps({ vision: async () => { throw new Error('timeout') } })
    const r = await readReference({ kind: 'image', bytes: await bootstrapPage(true) }, deps)
    expect(r.ok).toBe(true)
    if (r.ok) expect(FONT_IDS).toContain(r.look.headFont)
  })

  it('video links are refused politely (screenshot instead) and never counted', async () => {
    const { deps, calls } = fakeDeps()
    for (const u of ['https://www.youtube.com/watch?v=x', 'youtu.be/abc', 'https://vimeo.com/1', 'https://x.com/a.mp4']) {
      expect(isVideoLink(u)).toBe(true)
      expect(await readReference({ kind: 'website', url: u }, deps)).toMatchObject({ ok: false, code: 'video_link' })
    }
    expect(calls.count).toBe(0)
  })

  it('private addresses are never fetched or counted', async () => {
    const { deps, calls } = fakeDeps()
    const r = await readReference({ kind: 'website', url: 'http://169.254.169.254/latest' }, deps)
    expect(r).toMatchObject({ ok: false, code: 'bad_address' })
    expect(calls.screenshot + calls.count).toBe(0)
  })

  it('a website: its screenshot is read, and its own font maps to the closest free one', async () => {
    const { deps } = fakeDeps({ siteFonts: async () => ['inherit', 'Helvetica Neue', 'Arial'] })
    const r = await readReference({ kind: 'website', url: 'example.com' }, deps)
    expect(r.ok).toBe(true)
    if (r.ok) { expect(r.look.headFont).toBe('inter'); expect(r.source).toBe('website') }
  })
})

describe('free fonts only (whitelist)', () => {
  it('any font name maps onto the free list, never used as-is', () => {
    for (const n of ['Comic Sans MS', 'Helvetica Neue', 'Gotham', 'Brush Script', 'a condensed grotesk', '', null, 42]) {
      const f = fontFromName(n)
      expect(FONT_IDS).toContain(f.id)
      expect(f.exact).toBe(false)
    }
    expect(fontFromName('Helvetica Neue').id).toBe('inter')
    expect(fontFromName('Playfair Display').id).toBe('playfair')
  })
  it('an odd vision answer is reduced to the fixed shape', () => {
    const r = checkRead({ mood: 'furious', closestFontFamily: '<script>', density: 7, energy: 'HIGH', extra: 'x' })
    expect(r).toEqual({ mood: 'premium', density: 'balanced', energy: 'medium', font: expect.any(String), fontExact: false })
    expect(FONT_IDS).toContain(r.font)
  })
  it('a saved look can only carry free fonts', () => {
    const l = sanitizeLook({ id: 'custom', headFont: 'Papyrus', bodyFont: '../../etc', colors: { bg: '#123456' } })
    expect(FONT_IDS).toContain(l.headFont)
    expect(FONT_IDS).toContain(l.bodyFont)
  })
  it('serif headlines use their best weight', () => {
    expect(headWeightFor('fraunces')).toBe(600)
    expect(headWeightFor('montserrat')).toBe(800)
  })
})

describe('look copies stay apart (old videos never change)', () => {
  const brandWith = (look: Look): Brand => ({ id: 'b1', name: 'Reed Insurance', brand_guide_data: withSavedLook({ phone: '555' }, look) } as unknown as Brand)

  it('the draft keeps its own COPY; editing the brand look later does not reach it', () => {
    const brandLookV1 = { ...lookFromBrand({ name: 'Reed', primary_color: '#1d3358', accent_color: '#d8b25a' }), name: 'Reed v1' }
    const draftCopy = snapshotLook(brandLookV1)
    brandLookV1.colors.accent = '#ff0000'                       // the original object is edited…
    expect(draftCopy.colors.accent).not.toBe('#ff0000')          // …the copy is not
    const brand = brandWith({ ...brandLookV1, colors: { ...brandLookV1.colors, accent: '#00ff00' } })
    const used = resolveKitLook({ kitLook: 'custom', kitLookCustom: draftCopy, brand })
    expect(used.colors.accent).toBe(draftCopy.colors.accent)
  })

  it('"Your look" with no copy yet reads the brand’s saved look', () => {
    const saved = { ...KIT_LOOKS.editorial, id: 'custom', name: 'Paper', colors: { ...KIT_LOOKS.editorial.colors, accent: '#7a1f3d' } }
    const used = resolveKitLook({ kitLook: 'custom', brand: brandWith(saved) })
    expect(used.colors.accent).toBe('#7a1f3d')
  })

  it('a ready look picked on step 3 is never overridden by an old copy on the draft', () => {
    const stale = { ...KIT_LOOKS.bright, id: 'custom', colors: { ...KIT_LOOKS.bright.colors, accent: '#123456' } }
    expect(resolveKitLook({ kitLook: 'editorial', kitLookCustom: stale }).colors).toEqual(KIT_LOOKS.editorial.colors)
  })

  it('saving on the brand keeps every other guide field, and names are kept in a short list', () => {
    let g: Record<string, unknown> = { phone: '555', email: 'a@b.c' }
    for (let i = 0; i < 12; i++) g = withSavedLook(g, { ...KIT_LOOKS.bright, name: `Look ${i}` })
    expect(g.phone).toBe('555')
    const { current, saved } = readBrandLooks(g)
    expect(current?.name).toBe('Look 11')
    expect(saved.length).toBe(8)
  })

  it('the brand form can never wipe a saved look (the server keeps the stored one)', () => {
    const stored = withSavedLook({ phone: '1' }, KIT_LOOKS.bright)
    const fromForm = { phone: '2', video_look: null }
    const out = keepVideoLook(fromForm, stored)!
    expect(out.phone).toBe('2')
    expect((out.video_look as Look).colors.accent).toBe(KIT_LOOKS.bright.colors.accent.toLowerCase())
    expect(keepVideoLook(null, {})).toBeNull()
  })
})

describe('music, Drawn slides and step 3', () => {
  it('music: the user’s own track wins; "No music" means none; Match follows the feel', () => {
    expect(musicFileFor({ feel: 'calm', music: 'none' }, 'kit-1/music.mp3')).toBe('kit-1/music.mp3')
    expect(musicFileFor({ feel: 'calm', music: 'none' }, 'music/bed-warm-128.wav')).toBeNull()
    expect(musicFileFor({ feel: 'energetic' }, 'music/bed-corporate-128.wav')).toBe('music/bed-uplifting-128.wav')
    expect(musicFileFor({ feel: 'calm', music: 'pulse' })).toBe('music/bed-corporate-128.wav')
    expect(sanitizeLook({ ...KIT_LOOKS.bright, music: 'piano' }).music).toBe('piano')
    expect(sanitizeLook({ ...KIT_LOOKS.bright, music: 'loud' }).music).toBeUndefined()
  })

  it('Drawn slides get the look’s colours and feel in the drawing instructions', () => {
    const look = drawnLookFrom({ colors: { bg: '#0f1f18', glow: '#1d3a2c', accent: '#9fd27a', text: '#f2f5ee' }, feel: 'calm' })!
    const p = drawnSlidePrompt({ style: '3d', text: { role: 'content', headline: 'Hi', numbers: [], bullets: [] } as never, colors: { primary: '#111111', secondary: '#222222' }, look })
    expect(p).toContain('#9fd27a')
    expect(p).toMatch(/calm/)
    expect(p).not.toContain('#111111')
    expect(drawnLookFrom({ colors: { bg: 'red' } })).toBeNull()
  })

  it('step 3: "Your look" first when there is one; "Create your own look" next to the ready looks', () => {
    const cards = lookCards('video', { kit: true, yourLook: { name: 'Reed', colors: KIT_LOOKS.bright.colors } })
    expect(cards[0].id).toBe('custom')
    const ids = cards.map((c) => c.id)
    expect(ids).toContain(CREATE_LOOK_CARD)
    expect(ids.indexOf(CREATE_LOOK_CARD)).toBeLessThan(ids.indexOf('drawn'))
    expect(lookCards('video', { kit: true }).map((c) => c.id)).not.toContain('custom')
    expect(lookCards('video', { kit: false }).map((c) => c.id)).not.toContain(CREATE_LOOK_CARD)
  })
})

vi.setConfig({ testTimeout: 60_000 })
