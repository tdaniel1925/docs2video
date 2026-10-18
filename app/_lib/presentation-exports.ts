// Shared native-text export builders for presentations (owner route +
// public share-page deck download). Real editable PPTX + vector PDF from
// scenes + template tokens — no screenshots, no Chromium.
import { templateTokens, type PresentationScene } from './presentation'

const hexNoHash = (h: string) => (h.startsWith('#') ? h.slice(1) : h)
const hexToRgb = (h: string): [number, number, number] => {
  const s = hexNoHash(h)
  return [parseInt(s.slice(0, 2), 16) / 255, parseInt(s.slice(2, 4), 16) / 255, parseInt(s.slice(4, 6), 16) / 255]
}

/** Slide BODY lines from structured slideData (stats + bullets), falling back
 *  to the narration only when a scene has no structured content. Same rule as
 *  the HTML player: narration is for the ears, slideData for the eyes. */
const bodyLines = (s: PresentationScene): { text: string; bullet: boolean }[] => {
  const sd = s.slideData ?? {}
  const out: { text: string; bullet: boolean }[] = []
  for (const st of (sd.stats ?? []).slice(0, 6)) {
    if (st?.value) out.push({ text: st.label ? `${st.label}:  ${st.value}` : st.value, bullet: false })
  }
  for (const b of (sd.bullets ?? []).slice(0, 6)) {
    if (b) out.push({ text: b, bullet: true })
  }
  if (!out.length && sd.cta) out.push({ text: sd.cta, bullet: false })
  if (!out.length) out.push({ text: clip(String(s.narration ?? ''), 300), bullet: false })
  return out
}

/** Shortened at a word boundary with "…" — never mid-word. */
function clip(text: string, max: number): string {
  const s = text.replace(/\s+/g, ' ').trim()
  if (s.length <= max) return s
  const cut = s.slice(0, max)
  const sp = cut.lastIndexOf(' ')
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:—–-]+$/, '') + '…'
}

// ─────────────────────────────────────────────────────────────────────────────
// TEXT THAT FITS ITS BOX — PowerPoint
//
// A PowerPoint text box does not grow or shrink its text by itself: text that
// is too long runs straight out of the bottom of the box, over whatever is
// below it. "Shrink text on overflow" (pptxgenjs fit:'shrink') only takes
// effect when PowerPoint recalculates the box — a freshly opened file, Google
// Slides and Keynote show the overflow. So the size is worked out HERE, from
// the real width of every letter, before the file is written.
//
// Glyph widths (1/1000 of the font size) for printable ASCII 32–126, measured
// from the real fonts in Chromium. Kerning only ever pulls letters closer, so
// adding these up can only over-estimate. Anything outside ASCII (curly quotes,
// ®, é, emoji) is charged the font's WIDEST letter — again, only over.
// scripts/deck-overflow-check.mjs re-checks every text box against a real
// browser layout of the same text, font, width and line spacing.
// ─────────────────────────────────────────────────────────────────────────────

const GLYPHS = {
  'Georgia-Bold': [254,377,510,704,641,880,800,270,447,447,482,704,329,379,329,472,702,490,627,625,650,600,648,555,677,648,368,368,704,704,704,549,967,759,758,716,834,722,672,808,914,446,596,817,686,1024,840,820,702,820,798,649,685,834,763,1127,809,732,690,447,472,447,704,704,500,596,646,532,664,572,394,577,680,354,347,632,345,1016,690,636,658,649,521,513,398,677,567,864,588,563,526,500,388,500,704],
  Calibri: [227,326,401,499,507,715,683,221,304,304,499,499,250,307,253,387,507,507,507,507,507,507,507,507,507,507,268,268,499,499,499,464,895,579,544,534,616,489,460,631,624,252,319,520,421,855,646,663,517,673,543,460,488,642,568,890,520,488,469,307,387,307,499,499,292,480,526,423,526,498,306,471,526,230,240,455,230,799,526,528,526,526,349,392,335,526,452,715,434,453,396,315,461,315,499],
  Arial: [278,278,355,557,557,890,667,191,334,334,390,584,278,334,278,278,557,557,557,557,557,557,557,557,557,557,278,278,584,584,584,557,1016,667,667,723,723,667,611,778,723,278,500,667,557,834,723,778,667,778,723,667,611,723,667,944,667,667,611,278,278,278,470,557,334,557,557,500,557,557,278,557,557,223,223,500,223,834,557,557,557,557,334,500,278,557,500,723,500,500,500,334,260,334,584],
  'Arial-Bold': [278,334,475,557,557,890,723,238,334,334,390,584,278,334,278,278,557,557,557,557,557,557,557,557,557,557,334,334,584,584,584,611,976,723,723,723,723,667,611,778,723,278,557,723,611,834,723,778,667,778,723,667,611,723,667,944,667,667,611,334,278,334,584,557,334,557,611,557,611,557,334,611,611,278,278,557,278,890,611,611,611,611,390,557,334,611,557,778,557,557,500,390,280,390,584],
} as const
export type BoxFace = keyof typeof GLYPHS
const WIDEST: Record<BoxFace, number> = Object.fromEntries(
  Object.entries(GLYPHS).map(([k, v]) => [k, Math.max(...v)])) as Record<BoxFace, number>

/** PowerPoint's single line spacing is about 1.2x the font size (Calibri's own
 *  is 1.22 — use that, the most generous of the four). */
const LINE = 1.22
/** PowerPoint's default text-box margins (inches): 0.1 left/right, 0.05 top/bottom. */
const INSET_X = 0.1, INSET_Y = 0.05

function textWidth(s: string, face: BoxFace, pt: number): number {
  const t = GLYPHS[face]
  let w = 0
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0
    w += c >= 32 && c < 127 ? t[c - 32] : WIDEST[face]
  }
  return (w * pt) / 1000
}

/** How many lines a paragraph wraps to: greedy at spaces, like PowerPoint. A
 *  word wider than the whole line is broken letter by letter (PowerPoint does
 *  the same) — `broke` says it happened, so a size where it doesn't can win. */
function wrapCount(text: string, face: BoxFace, pt: number, lineW: number): { lines: number; broke: boolean } {
  const space = textWidth(' ', face, pt)
  let lines = 1, cur = 0, broke = false
  for (const word of String(text ?? '').split(/\s+/).filter(Boolean)) {
    const w = textWidth(word, face, pt)
    if (w <= lineW) {
      if (cur === 0) cur = w
      else if (cur + space + w <= lineW) cur += space + w
      else { lines++; cur = w }
      continue
    }
    // Wider than a whole line (a URL, an email, one giant word). It starts on
    // a fresh line and breaks where a renderer would: after a hyphen when a
    // piece up to one fits, otherwise at the last letter that fits.
    broke = true
    if (cur > 0) { lines++; cur = 0 }
    for (const piece of word.split(/(?<=[-‐-—/])/)) {
      const pw = textWidth(piece, face, pt)
      if (cur + pw <= lineW) { cur += pw; continue }
      if (cur > 0 && pw <= lineW) { lines++; cur = pw; continue }
      for (const ch of piece) {
        const cw = textWidth(ch, face, pt)
        if (cur + cw > lineW && cur > 0) { lines++; cur = 0 }
        cur += cw
      }
    }
  }
  return { lines, broke }
}

export type FitPara = string | { text: string; indentPt?: number }

/**
 * The biggest font size (points) at which these paragraphs fit a w x h inch box.
 *
 * Tries every half point from `max` down. Down to `min` it only accepts a size
 * where no word has to be broken mid-word; below that it takes the first size
 * that fits at all, down to `floor`. It never returns a size that overflows —
 * if even `floor` does not fit (absurd content), it keeps going down to 4pt.
 */
export function fitFontSize(
  paras: FitPara[] | string,
  box: { w: number; h: number },
  o: { face: BoxFace; max: number; min: number; floor?: number; lineSpacing?: number; paraAfterPt?: number },
): number {
  const list = (Array.isArray(paras) ? paras : [paras]).map((p) => (typeof p === 'string' ? { text: p } : p))
  const availW = (box.w - 2 * INSET_X) * 72
  // 4% held back: the arithmetic is close to PowerPoint's, not identical.
  const availH = (box.h - 2 * INSET_Y) * 72 * 0.96
  const ls = o.lineSpacing ?? 1
  const measure = (pt: number) => {
    let h = 0, broke = false
    for (const p of list) {
      const r = wrapCount(p.text, o.face, pt, availW - (p.indentPt ?? 0))
      h += r.lines * pt * LINE * ls + (o.paraAfterPt ?? 0)
      broke ||= r.broke
    }
    return { fits: h <= availH, broke }
  }
  for (let pt = o.max; pt >= o.min; pt -= 0.5) {
    const r = measure(pt)
    if (r.fits && !r.broke) return pt
  }
  for (let pt = o.max; pt >= 4; pt -= 0.5) {
    if (measure(pt).fits) return pt
  }
  return 4
}

export async function buildDeckPptx(title: string, scenes: PresentationScene[], templateId: string, accent?: string): Promise<Buffer> {
  const tok = templateTokens(templateId, accent)
  const PptxGenJS = (await import('pptxgenjs')).default
  const pptx = new PptxGenJS()
  pptx.defineLayout({ name: 'WIDE', width: 13.33, height: 7.5 })
  pptx.layout = 'WIDE'
  pptx.title = title
  scenes.forEach((s, i) => {
    const slide = pptx.addSlide()
    slide.background = { color: hexNoHash(tok.paper) }
    slide.addShape('rect', { x: 0.9, y: 1.05, w: 0.55, h: 0.045, fill: { color: hexNoHash(tok.accent) } })
    const head = s.slideData?.headline || s.title || (i === 0 ? title : `Section ${i}`)
    const headBox = { w: 11.5, h: 1.3 }
    slide.addText(head, {
      x: 0.9, y: 1.2, ...headBox, bold: true,
      fontSize: fitFontSize(head, headBox, { face: 'Georgia-Bold', max: i === 0 ? 40 : 30, min: 18 }),
      color: hexNoHash(tok.ink), fontFace: 'Georgia',
    })
    const lines = bodyLines(s)
    const bodyBox = { w: 10.5, h: 3.8 }
    // Calibri named outright: it is what PowerPoint used here anyway (the
    // theme default), and the fit above has to know the font it is fitting.
    const bodyPt = fitFontSize(lines.map((l) => ({ text: l.text, indentPt: l.bullet ? 14 : 0 })), bodyBox,
      { face: 'Calibri', max: 16, min: 10, lineSpacing: 1.3 })
    slide.addText(lines.map((l) => ({
      text: l.text,
      options: { bullet: l.bullet ? { characterCode: '25C6', indent: 14 } : false as const, breakLine: true },
    })), {
      x: 0.9, y: 2.7, ...bodyBox, fontSize: bodyPt, fontFace: 'Calibri', color: hexNoHash(tok.soft),
      lineSpacingMultiple: 1.3, valign: 'top',
    })
    slide.addText(`${i + 1} / ${scenes.length}`, {
      x: 12.0, y: 6.95, w: 1.0, h: 0.35, fontSize: 10, color: hexNoHash(tok.soft), align: 'right',
    })
    slide.addNotes(s.narration || '')
  })
  return (await pptx.write({ outputType: 'nodebuffer' })) as Buffer
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF
//
// Drawn with pdf-lib's built-in fonts, which carry their exact letter widths —
// so every line is wrapped by its REAL width (the old wrap counted characters,
// 46 to a heading line, which is how "WWWW" and "iiii" came out so different),
// and the sizes are chosen so everything fits the page. The old version also
// dropped whatever did not fit: the heading was cut to two lines and body
// lines past the bottom margin simply were not drawn. Now nothing is dropped;
// the text gets smaller instead.
// ─────────────────────────────────────────────────────────────────────────────

type PdfFont = { widthOfTextAtSize: (t: string, s: number) => number; encodeText: (t: string) => unknown }

/** The built-in PDF fonts can only draw the Windows-1252 letters; anything else
 *  (≈, →, a non-breaking hyphen, an emoji) used to throw and fail the WHOLE
 *  download. Common symbols get a plain stand-in; anything else becomes "?". */
const PDF_STANDINS: Record<string, string> = {
  '‑': '-', '‐': '-', '‒': '-', '−': '-', '≈': '~', '→': '->', '←': '<-',
  '≥': '>=', '≤': '<=', '≠': '!=', '✓': 'v', '✔': 'v', '◆': '•', '●': '•',
  ' ': ' ', ' ': ' ', ' ': ' ', '​': '',
}
function pdfSafe(s: string, font: PdfFont): string {
  let out = ''
  for (const ch of String(s ?? '')) {
    const c = PDF_STANDINS[ch] ?? ch
    try { font.encodeText(c); out += c } catch { out += '?' }
  }
  return out
}

/** Lines of `text` no wider than `maxW` at `size`, by the font's real widths.
 *  A word wider than a whole line is split by letter (`broke`). */
function pdfWrap(text: string, font: PdfFont, size: number, maxW: number): { lines: string[]; broke: boolean } {
  const lines: string[] = []
  let cur = '', broke = false
  const fits = (t: string) => font.widthOfTextAtSize(t, size) <= maxW
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = cur ? `${cur} ${word}` : word
    if (fits(next)) { cur = next; continue }
    if (cur) { lines.push(cur); cur = '' }
    if (fits(word)) { cur = word; continue }
    broke = true
    let piece = ''
    for (const ch of word) {
      if (fits(piece + ch)) piece += ch
      else { if (piece) lines.push(piece); piece = ch }
    }
    cur = piece
  }
  if (cur) lines.push(cur)
  return { lines: lines.length ? lines : [''], broke }
}

/** Biggest size (from max down, half-points) whose wrapped height fits `maxH`;
 *  prefers sizes with no mid-word break down to `min`. Never overflows. */
function pdfFit(paras: { text: string; prefix?: string }[], font: PdfFont, maxW: number, maxH: number,
  o: { max: number; min: number; lead: number; gap: number }) {
  const at = (size: number) => {
    let h = 0, broke = false
    const out = paras.map((p) => {
      const r = pdfWrap(p.text, font, size, maxW - (p.prefix ? font.widthOfTextAtSize(p.prefix, size) : 0))
      broke ||= r.broke
      h += r.lines.length * size * o.lead
      return r.lines
    })
    h += Math.max(0, paras.length - 1) * size * o.gap
    return { size, lines: out, h, broke }
  }
  for (let s = o.max; s >= o.min; s -= 0.5) { const r = at(s); if (r.h <= maxH && !r.broke) return r }
  for (let s = o.max; s >= 3; s -= 0.5) { const r = at(s); if (r.h <= maxH) return r }
  return at(3)
}

export async function buildDeckPdf(title: string, scenes: PresentationScene[], templateId: string, accent?: string): Promise<Uint8Array> {
  const tok = templateTokens(templateId, accent)
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const doc = await PDFDocument.create()
  const serif = await doc.embedFont(StandardFonts.TimesRomanBold)
  const sans = await doc.embedFont(StandardFonts.Helvetica)
  const W = 960, H = 540, X = 64
  const [pr, pg, pb] = hexToRgb(tok.paper)
  const [ir, ig, ib] = hexToRgb(tok.ink)
  const [ar, ag, ab] = hexToRgb(tok.accent)
  const [sr, sg, sb] = hexToRgb(tok.soft)
  const soft = rgb(sr, sg, sb)
  scenes.forEach((s, i) => {
    const page = doc.addPage([W, H])
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(pr, pg, pb) })
    page.drawRectangle({ x: X, y: H - 96, width: 44, height: 3.5, color: rgb(ar, ag, ab) })

    // Heading: up to ~3 lines in the band under the accent bar.
    const heading = pdfSafe(s.slideData?.headline || s.title || (i === 0 ? title : `Section ${i}`), serif)
    const hMax = i === 0 ? 34 : 27
    const head = pdfFit([{ text: heading }], serif, W - 2 * X, 3 * hMax * 1.2, { max: hMax, min: 16, lead: 1.2, gap: 0 })
    let y = H - 140
    for (const line of head.lines[0]) {
      page.drawText(line, { x: X, y, size: head.size, font: serif, color: rgb(ir, ig, ib) })
      y -= head.size * 1.2
    }

    // Body: everything, sized to the room left between the heading and the footer.
    const top = Math.min(H - 225, y - 14)
    const bottom = 56
    const paras = bodyLines(s).map((l) => ({ text: pdfSafe(l.text, sans), prefix: l.bullet ? '•  ' : undefined }))
    const body = pdfFit(paras, sans, W - 2 * X, top - bottom, { max: 13, min: 9, lead: 20 / 13, gap: 6 / 13 })
    y = top
    body.lines.forEach((lines, pi) => {
      const prefix = paras[pi].prefix
      const indent = prefix ? sans.widthOfTextAtSize(prefix, body.size) : 0
      lines.forEach((line, li) => {
        // The baseline sits a line-height below the top of its slot.
        const base = y - body.size
        if (prefix && li === 0) page.drawText(prefix, { x: X, y: base, size: body.size, font: sans, color: soft })
        page.drawText(line, { x: X + indent, y: base, size: body.size, font: sans, color: soft })
        y -= body.size * (20 / 13)
      })
      y -= body.size * (6 / 13)
    })

    // Footer: the deck title on the left, the page number on the right — the
    // title shrinks (then wraps) so it never runs into the number.
    const num = `${i + 1} / ${scenes.length}`
    const numW = sans.widthOfTextAtSize(num, 9)
    page.drawText(num, { x: W - X - numW, y: 26, size: 9, font: sans, color: soft })
    const foot = pdfFit([{ text: pdfSafe(title, sans) }], sans, W - 2 * X - numW - 24, 30, { max: 9, min: 6, lead: 1.2, gap: 0 })
    let fy = 26 + (foot.lines[0].length - 1) * foot.size * 1.2
    for (const line of foot.lines[0]) {
      page.drawText(line, { x: X, y: fy, size: foot.size, font: sans, color: soft })
      fy -= foot.size * 1.2
    }
  })
  return doc.save()
}
