import { Fit, type FitProps } from '../lib/fit'

/**
 * <Fit> for display type set TIGHTER than the font's own height (line-height
 * below ~1.3 — the big numbers and headlines here use 0.9–1.06).
 *
 * Why: at a tight line-height the letters' own box pokes a few pixels past the
 * last line, and <Fit> reads that as "too tall" at every size — so a "$100.00"
 * that should be 320px shrank to 18px. Here the size is worked out on an
 * invisible copy of the text set at a roomy line-height (same lines, same
 * width), and the visible text keeps the tight line-height. `maxHeight` is in
 * the VISIBLE line-height and is converted for the measuring copy.
 *
 * Letter-spacing goes on the visible text only. A negative "em" spacing on
 * the measuring copy would be worked out at the LARGEST size and make the copy
 * narrower than the real text (a word ran 217px off the frame that way);
 * without it the copy is a little wider, so the fit errs on the safe side.
 *
 * `text` is what the size is set by (for a count-up: the FINAL value);
 * `children` is what shows (defaults to `text`).
 */
const MEASURE_LH = 1.3

export const TightFit: React.FC<Omit<FitProps, 'sizeFor' | 'children'> & {
  text: string
  children?: React.ReactNode
  /** The visible line-height (unitless). */
  lineHeight: number
}> = ({ text, children, lineHeight, maxHeight, style, ...rest }) => {
  const measureLH = Math.max(lineHeight, MEASURE_LH)
  const { letterSpacing, ...measureStyle } = style || {}
  return (
    <Fit
      {...rest}
      sizeFor={text}
      maxHeight={maxHeight != null ? (maxHeight * measureLH) / lineHeight : undefined}
      style={{ ...measureStyle, lineHeight: measureLH }}
    >
      <div style={{ lineHeight, letterSpacing }}>{children ?? text}</div>
    </Fit>
  )
}
