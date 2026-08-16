import JSZip from 'jszip'

/**
 * SPLIT AN UPLOADED DECK INTO SEPARATE SLIDES — the heart of the "restyle my
 * deck" feature.
 *
 * The single-design path merges an uploaded document into one blob of text. A
 * deck restyle must NOT do that: it has to keep each slide apart, in order, so
 * we can redraw slide 1 as slide 1, slide 2 as slide 2, and so on. This module
 * does only that splitting — pure, testable, no network. The PDF path (which
 * needs Claude) hands its per-slide JSON here to be normalised the same way, so
 * both formats produce one shape.
 *
 * We also surface what a person needs to be told BEFORE they spend credits:
 *   - how many slides we found,
 *   - whether the deck was longer than the cap (so nothing is silently dropped),
 *   - which slides are image-only (almost no text) and therefore can't be
 *     restyled from their words.
 */

export type DeckSlide = {
  /** 1-based position in the deck. */
  n: number
  /** The slide's title line (first line of its text). */
  heading: string
  /** The remaining lines, one bullet each. */
  bullets: string[]
  /** True when the slide has almost no text (a picture/chart slide). */
  imageOnly: boolean
}

export type DeckSplit = {
  slides: DeckSlide[]
  /** Slides found before the cap was applied (== slides.length unless capped). */
  found: number
  /** True if the deck had more slides than MAX_DECK_SLIDES and was trimmed. */
  truncated: boolean
  /** The 1-based numbers of slides that look image-only (flag to the user). */
  imageOnlySlides: number[]
}

/** A deck of 40+ slides is 40+ image generations; cap and tell the user. */
export const MAX_DECK_SLIDES = 40

/** Below this many characters of real text, a slide is treated as image-only. */
const MIN_TEXT_CHARS = 8

/**
 * Turn a list of raw per-slide texts into the normalised, capped, flagged shape.
 * Both PPTX and PDF paths funnel through here so the result is identical.
 */
export function buildDeckSplit(rawSlides: string[]): DeckSplit {
  const found = rawSlides.length
  const kept = rawSlides.slice(0, MAX_DECK_SLIDES)

  const slides: DeckSlide[] = kept.map((raw, i) => {
    const lines = raw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    const heading = lines[0] ?? ''
    const bullets = lines.slice(1)
    const textLen = raw.replace(/\s+/g, '').length
    return { n: i + 1, heading, bullets, imageOnly: textLen < MIN_TEXT_CHARS }
  })

  return {
    slides,
    found,
    truncated: found > MAX_DECK_SLIDES,
    imageOnlySlides: slides.filter((s) => s.imageOnly).map((s) => s.n),
  }
}

/**
 * PPTX → per-slide raw texts, INCLUDING empty slides (so an image-only slide is
 * still counted and flagged, not silently dropped the way the shared
 * extractPptxText does). Same zip/xml approach as office-text.ts.
 */
export async function extractPptxSlides(buffer: Buffer): Promise<string[]> {
  const zip = await JSZip.loadAsync(buffer)
  const slideFiles = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)\.xml/)![1], 10)
      const nb = parseInt(b.match(/slide(\d+)\.xml/)![1], 10)
      return na - nb
    })
  if (slideFiles.length === 0) throw new Error('Not a valid PPTX (no slides found)')
  const out: string[] = []
  for (const f of slideFiles) {
    const xml = await zip.file(f)!.async('string')
    out.push(stripSlideXml(xml))
  }
  return out
}

/** Same text-stripping as office-text.ts, kept local so this module stands alone. */
function stripSlideXml(xml: string): string {
  return xml
    .replace(/<\/a:p>|<a:br\/?>/g, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * The other input shape: the shared extractPptxText() already emits blocks like
 * "Slide 1:\n…\n\nSlide 2:\n…". Split that back into per-slide texts so callers
 * holding that string (not the buffer) can still get a per-slide list. Empty
 * blocks are preserved as '' so slide numbering stays honest.
 */
export function splitLabelledSlideText(labelled: string): string[] {
  if (!labelled.trim()) return []
  // Split on the "Slide N:" markers, keeping what follows each one.
  const parts = labelled.split(/\n?\s*Slide\s+\d+:\s*/g).map((p) => p.trim())
  // The first element is whatever preceded "Slide 1:" (usually empty) — drop it.
  return parts.slice(1)
}
