import { useCurrentFrame, useVideoConfig, spring, interpolate, Easing } from 'remotion'
import { FONTS, type Theme } from '../tokens'
import { parseMetric, renderMetric } from '../components/infographic/format'

export type LTMetric = { label: string; value: string }

/**
 * Cinematic lower-third callout block: a sleek glass panel slides in from the
 * left carrying the scene's KEY NUMBERS over the film image, holds, then slides
 * out. Shows up to 3 metrics (first one hero-size, rest smaller) so important
 * figures aren't dropped — e.g. $176,204 death benefit AND $10,000/yr premium.
 * Each value counts up; an accent rule anchors the block.
 *
 * Appears ~1.1s in (after the title lands), leaves before the cut.
 */
export const LowerThird: React.FC<{
  metrics: LTMetric[]
  theme: Theme
  durationInFrames: number
}> = ({ metrics, theme, durationInFrames }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const inAt = Math.round(1.1 * fps)
  const outAt = durationInFrames - Math.round(0.9 * fps)
  const accent = theme.accents[1] ?? theme.accents[0]

  const sIn = spring({ frame: frame - inAt, fps, config: { damping: 16, stiffness: 120, mass: 0.9 } })
  const outP = interpolate(frame, [outAt, outAt + Math.round(0.5 * fps)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.cubic) })
  const x = (1 - sIn) * -120 + outP * -120
  const opacity = Math.min(1, sIn * 1.4) * (1 - outP)

  // Valid metrics only; cap at 3 so the panel stays clean.
  const list = (metrics || []).filter((m) => m && m.value && m.label).slice(0, 3)
  if (list.length === 0) return null

  return (
    <div style={{
      position: 'absolute', left: 120, bottom: 130, zIndex: 4,
      transform: `translateX(${x}px)`, opacity,
      display: 'flex', alignItems: 'stretch', gap: 18,
    }}>
      {/* accent rule */}
      <div style={{ width: 6, borderRadius: 3, background: accent, boxShadow: `0 0 16px ${accent}` }} />
      <div style={{
        background: 'rgba(8,12,20,0.62)', backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10,
        padding: '20px 30px', display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        {list.map((m, i) => {
          // Each metric's count-up staggers slightly after the panel arrives.
          const start = inAt + 4 + i * Math.round(0.18 * fps)
          const countP = interpolate(frame, [start, start + Math.round(1.0 * fps)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
          const display = renderMetric(parseMetric(m.value), countP)
          const hero = i === 0
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ fontFamily: FONTS.body, fontWeight: 800, letterSpacing: 3, fontSize: hero ? 22 : 18, color: accent, textTransform: 'uppercase' }}>
                {m.label}
              </div>
              <div style={{ fontFamily: FONTS.display, fontWeight: 900, fontSize: hero ? 72 : 44, lineHeight: 1, color: '#FFFFFF', fontVariantNumeric: 'tabular-nums', letterSpacing: -1, whiteSpace: 'nowrap' }}>
                {display}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
