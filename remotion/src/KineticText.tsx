import { useCurrentFrame, useVideoConfig, spring } from 'remotion'
import { TEXT_SHADOW } from './tokens'
import { Fit } from './lib/fit'

/**
 * Word-by-word kinetic reveal that PERFORMS: each word springs up (with a slight
 * overshoot) + un-blurs + fades in, staggered. The accent word gets an extra
 * scale-punch just after it lands so it pops on its beat. Reads as produced
 * motion graphics, not a fade-in.
 *
 * `fit` (optional): keep the headline inside its box. `fontSize` becomes the
 * size it would LIKE to be; a long headline (or one very long word) shrinks
 * until it fits the parent's width and `fit.lines`. The PARENT must have a
 * bounded width. Without `fit` it behaves exactly as before.
 */
export type KineticFit = {
  /** Most lines before it shrinks instead of wrapping again. */
  lines?: number
  /** Smallest it should normally go (it still goes smaller rather than overflow — QA warns). */
  min?: number
  /** Hard height limit in px. */
  maxHeight?: number
}

export const KineticText: React.FC<{
  text: string
  startFrame: number
  perWordFrames?: number
  fontFamily: string
  fontWeight: number | string
  fontSize: number
  color: string
  accentColor?: string
  accentWordIndex?: number
  align?: 'left' | 'center' | 'right'
  lineHeight?: number
  fit?: KineticFit
}> = ({ text, startFrame, perWordFrames = 2.5, fontFamily, fontWeight, fontSize, color, accentColor, accentWordIndex, align = 'left', lineHeight = 1.05, fit }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const words = text.split(' ')
  // Auto-pick an emphasis word when the caller didn't specify one, so EVERY
  // headline gets color emphasis (item 1). Prefer a word with a number/$/%;
  // else the longest meaningful word; else the last word.
  let accentIdx = accentWordIndex
  if (accentIdx == null && accentColor && words.length) {
    const numIdx = words.findIndex((w) => /[\d$%]/.test(w))
    if (numIdx >= 0) accentIdx = numIdx
    else {
      let best = -1, bestLen = 0
      words.forEach((w, i) => { const l = w.replace(/[^a-z0-9]/gi, '').length; if (l > bestLen) { bestLen = l; best = i } })
      accentIdx = best >= 0 ? best : words.length - 1
    }
  }
  const typeStyle: React.CSSProperties = { fontFamily, fontWeight, lineHeight, letterSpacing: '-0.01em', textAlign: align }
  const body = (
    <div style={{ ...typeStyle, fontSize: fit ? '1em' : fontSize, textShadow: TEXT_SHADOW }}>
      {words.map((w, i) => {
        const delay = startFrame + i * perWordFrames
        // Spring with overshoot for the rise (snappy, alive) ...
        const s = spring({ frame: frame - delay, fps, config: { damping: 13, stiffness: 150, mass: 0.7 } })
        // ... and a separate fade/un-blur (clamped, no overshoot on opacity).
        const p = Math.max(0, Math.min(1, s))
        const isAccent = accentIdx === i && !!accentColor
        // Accent word: an extra scale-punch that peaks ~6 frames after it lands.
        const punch = isAccent ? spring({ frame: frame - (delay + 6), fps, config: { damping: 9, stiffness: 200, mass: 0.6 } }) : 0
        const punchScale = isAccent ? 1 + 0.12 * Math.max(0, punch) * (1 - Math.max(0, (punch - 1) * 2)) : 1
        // Outer span owns LAYOUT (fixed width via the word), inner span owns the
        // scale-punch — so the punch never changes spacing or collides with the
        // next word. translateY (rise) is safe on the outer; scale on the inner.
        // Explicit per-word right margin guarantees the space between words
        // (flex `gap` was rendering as zero at this size). Last word: no margin.
        const isLast = i === words.length - 1
        // inline-block word + a literal non-breaking space text node after it.
        // A real   between inline-blocks always renders a gap (no flex/gap
        // quirk, no zero-width spacer span ambiguity).
        return (
          <span key={i}>
            <span style={{
              display: 'inline-block', opacity: p,
              transform: `translateY(${(1 - s) * 26}px) scale(${punchScale})`,
              transformOrigin: 'center bottom',
              filter: `blur(${(1 - p) * 6}px)`, color: isAccent ? accentColor : color, marginRight: isLast ? 0 : '0.3em',
            }}>
              {w}
            </span>
            {!isLast ? ' ' : ''}
          </span>
        )
      })}
    </div>
  )
  if (!fit) return body
  // Sized against a still copy of the words, not the moving ones: the rise and
  // the accent punch are transforms, and measuring them mid-flight would give a
  // different size on every frame. Each gap is measured as an en space + a space
  // (a little WIDER than the 0.3em margin + space it renders as), so the real
  // headline always wraps into no more lines than the copy that was measured.
  // The copy is set at a roomy line-height: at a tight one the letters poke past
  // the last line and read as "too tall" at every size. (The visible headline
  // keeps its own line-height; a maxHeight is converted to match.)
  // No letter-spacing on the copy: a negative "em" spacing there would be
  // worked out at the largest size and make the copy too narrow.
  const measureLH = Math.max(lineHeight, 1.3)
  return (
    <Fit max={fontSize} min={fit.min} lines={fit.lines}
      maxHeight={fit.maxHeight != null ? (fit.maxHeight * measureLH) / lineHeight : undefined}
      sizeFor={words.join('  ')} style={{ fontFamily, fontWeight, textAlign: align, lineHeight: measureLH }}>
      {body}
    </Fit>
  )
}
