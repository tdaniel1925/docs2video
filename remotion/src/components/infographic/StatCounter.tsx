import { useCurrentFrame, interpolate, Easing } from 'remotion'
import { FONTS, type Theme } from '../../tokens'
import { parseMetric, renderMetric } from './format'

/**
 * The atomic animated number. Parses a value like "$176,204" or "$10,000.00/year",
 * ticks the numeric part from 0 → target with an ease-out, and keeps the prefix
 * ("$") and suffix ("/year") fixed. A non-numeric value (e.g. "3 Included" with
 * no leading number, or "S&P 500") renders statically. Frame-accurate / pure.
 */
export const StatCounter: React.FC<{
  value: string
  theme: Theme
  color?: string
  fontSize?: number
  startFrame?: number
  durationFrames?: number
  weight?: number
}> = ({ value, theme, color, fontSize = 96, startFrame = 0, durationFrames = 34, weight = 900 }) => {
  const frame = useCurrentFrame()
  const parsed = parseMetric(value)
  // Ease-out count: fast then settling, like a real odometer landing.
  const p = interpolate(frame, [startFrame, startFrame + durationFrames], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic),
  })
  const display = renderMetric(parsed, p)
  return (
    <span style={{
      fontFamily: FONTS.display,
      fontWeight: weight,
      fontSize,
      lineHeight: 1,
      color: color ?? theme.accents[0],
      fontVariantNumeric: 'tabular-nums',           // digits don't jitter width while counting
      letterSpacing: -1,
      whiteSpace: 'nowrap',
    }}>
      {display}
    </span>
  )
}
