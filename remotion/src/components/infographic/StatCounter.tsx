import { useCurrentFrame, interpolate, Easing } from 'remotion'
import { FONTS, type Theme } from '../../tokens'
import { Fit } from '../../lib/fit'
import { parseMetric, renderMetric } from './format'

/**
 * The atomic animated number. Parses a value like "$176,204" or "$10,000.00/year",
 * ticks the numeric part from 0 → target with an ease-out, and keeps the prefix
 * ("$") and suffix ("/year") fixed. A non-numeric value (e.g. "3 Included" with
 * no leading number, or "S&P 500") renders statically. Frame-accurate / pure.
 *
 * It fills its parent's width and shrinks to fit it (see lib/fit.tsx): the
 * value comes from the document, and "100% High Cap Rate Acct (S&P 500 Index)"
 * once arrived where "$10,000" was expected and ran off the frame. The size is
 * set by the FINAL value, so it doesn't change size while counting up. The
 * PARENT must have a bounded width.
 */
export const StatCounter: React.FC<{
  value: string
  theme: Theme
  color?: string
  fontSize?: number
  startFrame?: number
  durationFrames?: number
  weight?: number
  /** Most lines before it shrinks instead of wrapping. Numbers read best on one; words may take two. */
  lines?: number
}> = ({ value, theme, color, fontSize = 96, startFrame = 0, durationFrames = 34, weight = 900, lines = 2 }) => {
  const frame = useCurrentFrame()
  const parsed = parseMetric(value)
  // Ease-out count: fast then settling, like a real odometer landing.
  const p = interpolate(frame, [startFrame, startFrame + durationFrames], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic),
  })
  const display = renderMetric(parsed, p)
  return (
    <Fit
      max={fontSize}
      min={Math.round(fontSize * 0.45)}
      lines={lines}
      sizeFor={renderMetric(parsed, 1)}
      style={{
        fontFamily: FONTS.display,
        fontWeight: weight,
        lineHeight: 1.05,
        color: color ?? theme.accents[0],
        fontVariantNumeric: 'tabular-nums',           // digits don't jitter width while counting
        letterSpacing: -1,
      }}
    >
      {display}
    </Fit>
  )
}
