import { useCurrentFrame, useVideoConfig, spring, interpolate, Easing } from 'remotion'
import { FONTS, type Theme } from '../tokens'
import { parseMetric, renderMetric } from '../components/infographic/format'

/**
 * Cinematic lower-third callout: a sleek bar slides in from the left carrying a
 * key number over the film image, holds, then slides out. This grafts the data
 * value of an infographic onto the cinematic look — the viewer gets the figure
 * AND the film. The number counts up; an accent rule anchors it.
 *
 * Timed to appear ~1.2s in (after the title lands) and leave before the cut.
 */
export const LowerThird: React.FC<{
  label: string
  value: string
  theme: Theme
  durationInFrames: number
}> = ({ label, value, theme, durationInFrames }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const inAt = Math.round(1.2 * fps)
  const outAt = durationInFrames - Math.round(0.9 * fps)
  const accent = theme.accents[1] ?? theme.accents[0]

  const sIn = spring({ frame: frame - inAt, fps, config: { damping: 16, stiffness: 120, mass: 0.9 } })
  const outP = interpolate(frame, [outAt, outAt + Math.round(0.5 * fps)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.cubic) })
  const x = (1 - sIn) * -120 + outP * -120
  const opacity = Math.min(1, sIn * 1.4) * (1 - outP)

  // Count the number up as the bar settles.
  const countP = interpolate(frame, [inAt, inAt + Math.round(1.1 * fps)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  const display = renderMetric(parseMetric(value), countP)

  return (
    <div style={{
      position: 'absolute', left: 120, bottom: 150, zIndex: 4,
      transform: `translateX(${x}px)`, opacity,
      display: 'flex', alignItems: 'stretch', gap: 18,
    }}>
      {/* accent rule */}
      <div style={{ width: 6, borderRadius: 3, background: accent, boxShadow: `0 0 16px ${accent}` }} />
      <div style={{
        background: 'rgba(8,12,20,0.62)', backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10,
        padding: '18px 28px', display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        <div style={{ fontFamily: FONTS.body, fontWeight: 800, letterSpacing: 4, fontSize: 22, color: accent, textTransform: 'uppercase' }}>
          {label}
        </div>
        <div style={{ fontFamily: FONTS.display, fontWeight: 900, fontSize: 76, lineHeight: 1, color: '#FFFFFF', fontVariantNumeric: 'tabular-nums', letterSpacing: -1, whiteSpace: 'nowrap' }}>
          {display}
        </div>
      </div>
    </div>
  )
}
