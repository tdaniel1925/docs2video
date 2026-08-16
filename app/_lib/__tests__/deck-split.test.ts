import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import {
  buildDeckSplit,
  extractPptxSlides,
  splitLabelledSlideText,
  MAX_DECK_SLIDES,
} from '../deck-split'

// =============================================================================
// A deck restyle lives or dies on one thing: keeping slides SEPARATE and in
// ORDER. If the splitter merges them (the single-design path's job) or loses an
// image-only slide, the user pays for a deck that doesn't match theirs. These
// pin: right count, right order, headings/bullets parsed, image-only slides
// flagged not dropped, and the cap honoured.
//
// Proven to FAIL first: buildDeckSplit was fed [] and the "3 slides" assertion
// went red; the empty-slide case flagged nothing until imageOnly detection
// existed. Both are wired to real behaviour now.
// =============================================================================

/** Build a minimal but REAL .pptx in memory with the given per-slide texts. */
async function makePptx(slideTexts: string[]): Promise<Buffer> {
  const zip = new JSZip()
  // Minimal content types + rels so JSZip produces a loadable archive. We only
  // read ppt/slides/slideN.xml back, so that's all that must be well-formed.
  zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>')
  slideTexts.forEach((text, i) => {
    // One paragraph per line, each line a text run — mirrors real PPTX shape.
    const paras = text
      ? text.split('\n').map((line) => `<a:p><a:r><a:t>${line}</a:t></a:r></a:p>`).join('')
      : '' // empty slide = image-only
    const xml = `<?xml version="1.0"?><p:sld xmlns:p="x" xmlns:a="y"><p:cSld><p:spTree>${paras}</p:spTree></p:cSld></p:sld>`
    zip.file(`ppt/slides/slide${i + 1}.xml`, xml)
  })
  const u8 = await zip.generateAsync({ type: 'uint8array' })
  return Buffer.from(u8)
}

describe('splitting a real .pptx into slides', () => {
  it('keeps every slide, in order, with headings and bullets', async () => {
    const buf = await makePptx([
      'Welcome\nOur mission\nWhat we do',
      'The Numbers\nRevenue up 18%\n2.4M users',
      '', // an image-only slide (a chart baked as a picture)
    ])
    const raw = await extractPptxSlides(buf)
    expect(raw).toHaveLength(3) // the empty slide is NOT dropped

    const split = buildDeckSplit(raw)
    expect(split.found).toBe(3)
    expect(split.slides).toHaveLength(3)
    // order preserved
    expect(split.slides.map((s) => s.n)).toEqual([1, 2, 3])
    // headings + bullets parsed
    expect(split.slides[0].heading).toBe('Welcome')
    expect(split.slides[0].bullets).toEqual(['Our mission', 'What we do'])
    expect(split.slides[1].heading).toBe('The Numbers')
    expect(split.slides[1].bullets).toContain('Revenue up 18%')
    // the empty slide is FLAGGED image-only, not silently blank
    expect(split.slides[2].imageOnly).toBe(true)
    expect(split.imageOnlySlides).toEqual([3])
    expect(split.truncated).toBe(false)
  })

  it('throws on a file with no slides (not a deck)', async () => {
    const zip = new JSZip()
    zip.file('hello.txt', 'not a deck')
    const buf = Buffer.from(await zip.generateAsync({ type: 'uint8array' }))
    await expect(extractPptxSlides(buf)).rejects.toThrow(/no slides/i)
  })
})

describe('the cap on very long decks', () => {
  it('trims to MAX_DECK_SLIDES and reports it was truncated', () => {
    const raw = Array.from({ length: MAX_DECK_SLIDES + 5 }, (_, i) => `Slide ${i + 1}\npoint`)
    const split = buildDeckSplit(raw)
    expect(split.found).toBe(MAX_DECK_SLIDES + 5)
    expect(split.slides).toHaveLength(MAX_DECK_SLIDES)
    expect(split.truncated).toBe(true)
  })
})

describe('splitting the shared "Slide N:" labelled text', () => {
  it('splits labelled blocks back into per-slide texts', () => {
    const labelled = 'Slide 1:\nWelcome\nMission\n\nSlide 2:\nNumbers\nRevenue up'
    const parts = splitLabelledSlideText(labelled)
    expect(parts).toHaveLength(2)
    expect(parts[0]).toContain('Welcome')
    expect(parts[1]).toContain('Numbers')
  })

  it('returns [] for empty input (nothing to restyle)', () => {
    expect(splitLabelledSlideText('')).toEqual([])
  })
})
