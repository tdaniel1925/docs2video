import { useLayoutEffect, useRef } from 'react'
import { continueRender, delayRender } from 'remotion'

/**
 * FIT — words that can never leave their box.
 *
 * Every word in a video comes from a model reading somebody's document, so a
 * card built for "$10,000" gets handed "100% High Cap Rate Acct (S&P 500
 * Index)". A fixed font size then has two ways to fail: nowrap pushes the card
 * off the frame, and wrapping pushes it out the bottom. Both shipped.
 *
 * These two pieces measure the REAL rendered text, in the real font, every
 * frame, and shrink until it fits:
 *
 *   <Fit>     one run of text (a title, a value, a label, a bullet). Wraps at
 *             spaces; shrinks the font until it fits the width, the `lines`
 *             limit, and the box height if the box has one.
 *   <FitBox>  a group (a bullet list, a stack of cards) inside a box with a
 *             definite height. Scales the whole group down together, letting
 *             it re-wrap into the room that frees up.
 *
 * Neither ever overflows to stay readable: past `min` they keep shrinking
 * (down to FLOOR) and log D2V_FIT_SMALL, which the overflow QA reports as a
 * warning. A small line can be read; a line off the edge cannot.
 *
 * Measuring is DOM-based rather than @remotion/layout-utils, whose measureText
 * caches its first reading forever — taken before the web font loads, that
 * reading is the fallback font's and is never corrected. Here results are
 * cached only once fonts are loaded, and a render waits for fonts before the
 * frame is captured.
 *
 * Checked by `npm run qa:overflow` (scripts/overflow-qa.mjs).
 */

/** Absolute smallest a Fit will go. Below `min` it is logged, not refused. */
export const FLOOR = 14

// Fitted results, keyed on everything that changes the answer. Only filled
// once fonts are loaded, so a fallback-font measurement is never reused.
const cache = new Map<string, number>()
// Fit results also remember whether a word had to be broken to fit.
const fitCache = new Map<string, { size: number; wrap: string }>()

const fontsReady = () => typeof document === 'undefined' || !document.fonts || document.fonts.status === 'loaded'

/** Runs `fit` now, and again once web fonts finish loading — holding the frame until then. */
function useFitEffect(fit: () => void) {
  useLayoutEffect(() => {
    fit()
    if (!fontsReady()) {
      const handle = delayRender('Fit: waiting for fonts before measuring')
      document.fonts.ready.then(() => {
        fit()
        continueRender(handle)
      })
    }
  })
}

/**
 * How many lines the text actually occupies — counted from the rendered line
 * boxes, not estimated from height ÷ line-height (which misreads line-height
 * "normal": Archivo's is ~1.09em, not 1.2, so two real lines counted as one).
 */
function countLines(el: HTMLElement): number {
  const range = document.createRange()
  range.selectNodeContents(el)
  const tops: number[] = []
  for (const r of Array.from(range.getClientRects())) {
    if (r.width < 0.5 || r.height < 0.5) continue
    // Same line if the tops are within half a line of each other.
    if (!tops.some((t) => Math.abs(t - r.top) < r.height * 0.5)) tops.push(r.top)
  }
  return Math.max(1, tops.length)
}

function styleKey(el: HTMLElement): string {
  const cs = getComputedStyle(el)
  return [cs.fontFamily, cs.fontWeight, cs.fontStyle, cs.letterSpacing, cs.textTransform, cs.lineHeight, cs.whiteSpace].join('|')
}

/** Is `el`'s text inside its own box at its current font size? */
function textFits(el: HTMLElement, lines?: number): boolean {
  if (el.scrollWidth > el.clientWidth + 1) return false
  // With a tight line-height (headlines, big numerals: under ~1.2) the tall
  // glyphs hang a little past the line box, and Chrome counts that overhang in
  // scrollHeight. It is not overflow — treating it as overflow shrank a normal
  // "$176,204" from 169px to 125px. A whole extra line is always more than
  // this slack, so real overflow is still caught. A box with a hard max height
  // gets less (0.12em covers Archivo and Inter from line-height 1.04 up), so
  // text can't overrun a capped box by a third of a line.
  const capped = !!el.style.maxHeight && el.style.maxHeight !== 'none'
  const overhang = (capped ? 0.12 : 0.35) * parseFloat(getComputedStyle(el).fontSize)
  if (el.scrollHeight > el.clientHeight + 1 + overhang) return false
  if (lines && countLines(el) > lines) return false
  return true
}

// Each warning once per page: logged every frame, they flooded the console
// and crashed a long QA run (Remotion's console reader ran out of memory).
const warned = new Set<string>()
function warnSmall(what: string, size: number, min: number, text: string) {
  const key = `${what}|${Math.round(size)}|${text}`
  if (warned.has(key)) return
  warned.add(key)
  // Picked up by scripts/overflow-qa.mjs through the browser console.
  console.log('D2V_FIT_SMALL ' + JSON.stringify({ what, size: Math.round(size), min, text: text.slice(0, 80) }))
}

/**
 * Binary-searches the largest font size in [FLOOR, max] at which `measure`
 * fits, then applies it to `apply`. Long single words are allowed to break
 * only when even FLOOR can't hold them.
 */
function fitFont(measure: HTMLElement, apply: HTMLElement, max: number, min: number, lines?: number): number {
  // Size the visible element WITH the measuring copy at every step: the copy
  // inherits em-based styles (letter-spacing: 0.17em) as px worked out at the
  // parent's size, so measuring it at another size misjudged the width and let
  // a word run 217px off the frame.
  const set = (s: number) => {
    measure.style.fontSize = `${s}px`
    if (apply !== measure) apply.style.fontSize = `${s}px`
  }
  set(max)   // a known starting state, so the key below is the same every frame
  const key = [measure.textContent, max, lines ?? '', measure.clientWidth, measure.style.maxHeight, styleKey(measure)].join('¦')
  const hit = fitCache.get(key)
  if (hit) {
    set(hit.size)
    measure.style.overflowWrap = hit.wrap
    if (apply !== measure) apply.style.overflowWrap = hit.wrap
    return hit.size
  }

  measure.style.overflowWrap = 'normal'
  let size = max
  if (!textFits(measure, lines)) {
    let lo = FLOOR, hi = max
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2
      set(mid)
      if (textFits(measure, lines)) lo = mid
      else hi = mid
    }
    size = Math.floor(lo)
    set(size)
    // Even the floor can't hold one unbroken word: break inside it rather
    // than let it run off. Ugly beats missing.
    if (!textFits(measure, lines)) measure.style.overflowWrap = 'anywhere'
  }
  if (apply !== measure) {
    apply.style.fontSize = `${size}px`
    apply.style.overflowWrap = measure.style.overflowWrap
  }
  if (size < min) warnSmall('Fit', size, min, measure.textContent || '')
  if (fontsReady()) fitCache.set(key, { size, wrap: measure.style.overflowWrap || 'normal' })
  return size
}

export type FitProps = {
  children: React.ReactNode
  /** The size it would like to be, in px. */
  max: number
  /** The smallest it should normally go. It will still go smaller rather than overflow — and say so in QA. */
  min?: number
  /** Most lines before it shrinks instead of wrapping again. Omit for "as many as the box allows". */
  lines?: number
  /**
   * Size against this text instead of what is showing. For count-up numbers:
   * the size is set by the FINAL value, so it doesn't jitter while counting.
   */
  sizeFor?: string
  /** Hard height limit in px (otherwise the box's own height, if it has one, applies). */
  maxHeight?: number
  style?: React.CSSProperties
  /** Render as an inline-block span (for use inside a line of text). Default: block div. */
  inline?: boolean
}

/**
 * One run of text that shrinks to fit. Takes the full width of its parent, so
 * the PARENT must have a bounded width (in a flex row or grid cell that means
 * minWidth: 0 / minmax(0, 1fr) — otherwise the parent grows to the text).
 */
export const Fit: React.FC<FitProps> = ({ children, max, min = 0, lines, sizeFor, maxHeight, style, inline }) => {
  const ref = useRef<HTMLDivElement>(null)
  const ghost = useRef<HTMLSpanElement>(null)

  useFitEffect(() => {
    const el = ref.current
    if (!el) return
    const measureEl = sizeFor != null ? ghost.current : el
    if (!measureEl) return
    fitFont(measureEl, el, max, min, lines)
  })

  const base: React.CSSProperties = {
    display: inline ? 'inline-block' : 'block',
    width: '100%', minWidth: 0, maxWidth: '100%',
    boxSizing: 'border-box',
    whiteSpace: 'normal',
    overflowWrap: 'normal',
    wordBreak: 'normal',
    maxHeight,
    fontSize: max,
    position: 'relative',
  }
  const Tag = (inline ? 'span' : 'div') as 'div'
  return (
    <Tag ref={ref} style={{ ...base, ...style, fontSize: max }}>
      {children}
      {sizeFor != null ? (
        <span
          ref={ghost}
          aria-hidden
          style={{
            position: 'absolute', left: 0, top: 0, width: '100%', maxHeight,
            display: 'block', visibility: 'hidden', pointerEvents: 'none',
            whiteSpace: 'normal', overflowWrap: 'normal',
          }}
        >
          {sizeFor}
        </span>
      ) : null}
    </Tag>
  )
}

export type FitBoxProps = {
  children: React.ReactNode
  /** Smallest scale it should normally go (0–1). It still goes smaller rather than overflow — and says so in QA. */
  minScale?: number
  /** Where the shrunk group sits vertically in the box. Default top. (It always fills the width.) */
  valign?: 'start' | 'center' | 'end'
  style?: React.CSSProperties
}

const ORIGIN = { start: 0, center: 0.5, end: 1 } as const

/**
 * A group that scales down together to fit its box. The box is this element:
 * it fills its parent (width 100%, height 100%), so give the PARENT a definite
 * size — e.g. `flex: 1, minHeight: 0` in a flex column.
 *
 * The group is laid out at width box/scale and then scaled by `scale`, so as
 * it shrinks the lines get more room and re-wrap — it doesn't just get smaller.
 *
 * Put plain text inside a FitBox, not <Fit>: a Fit sizes itself to the width
 * the FitBox gave it last frame, the FitBox then rescales, and the two chase
 * each other from frame to frame — the text visibly changes size mid-scene.
 */
export const FitBox: React.FC<FitBoxProps> = ({ children, minScale = 0, valign = 'start', style }) => {
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)

  useFitEffect(() => {
    const box = outer.current, el = inner.current
    if (!box || !el) return
    const W = box.clientWidth, H = box.clientHeight
    if (!W || !H) return
    const key = ['box', el.textContent, el.childElementCount, W, H, styleKey(el)].join('¦')

    // Laid out at W/s wide, then scaled by s: it always fills the width exactly.
    const apply = (s: number) => {
      el.style.width = `${W / s}px`
      el.style.transform = `scale(${s})`
    }
    const fits = (s: number) => {
      apply(s)
      return el.scrollHeight * s <= H + 1 && el.scrollWidth <= W / s + 1
    }

    // A cached scale is re-checked, not trusted: the key can't see every
    // change inside the group, and a stale scale would let it spill.
    let s = cache.get(key)
    if (s != null && !fits(s)) s = undefined
    if (s == null) {
      s = 1
      if (!fits(1)) {
        let lo = FLOOR / 100, hi = 1
        for (let i = 0; i < 12; i++) {
          const mid = (lo + hi) / 2
          if (fits(mid)) lo = mid
          else hi = mid
        }
        s = lo
      }
      if (fontsReady()) cache.set(key, s)
    }
    apply(s)
    // Vertical placement inside the box after scaling.
    const used = el.scrollHeight * s
    el.style.top = `${(H - used) * ORIGIN[valign]}px`
    if (s < minScale) warnSmall('FitBox', s * 100, minScale * 100, el.textContent || '')
  })

  return (
    <div ref={outer} style={{ position: 'relative', width: '100%', height: '100%', minWidth: 0, minHeight: 0, ...style }}>
      <div ref={inner} style={{ position: 'absolute', left: 0, top: 0, transformOrigin: '0 0' }}>
        {children}
      </div>
    </div>
  )
}
