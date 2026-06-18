import { AbsoluteFill, useCurrentFrame, spring, useVideoConfig } from 'remotion'
import { FONTS, TYPE, type Theme } from '../../tokens'
import { settleProgress } from '../../helpers'
import { StatCounter } from './StatCounter'

/**
 * One dominant metric, hero-scale and centered. The number counts up; a glowing
 * ring/halo settles behind it; eyebrow above, supporting line below. Used when a
 * scene has a single headline figure (e.g. "$176,204 — Initial Death Benefit").
 */
export const HeroMetric: React.FC<{
  label: string            // eyebrow, e.g. "Initial Death Benefit"
  value: string            // "$176,204"
  support?: string         // optional line under the number
  theme: Theme
  accentIndex?: number
}> = ({ label, value, support, theme, accentIndex = 0 }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const accent = theme.accents[accentIndex] ?? theme.accents[0]

  const labelP = settleProgress(frame, 4)
  const pop = spring({ frame: frame - 8, fps, config: { damping: 14, stiffness: 120, mass: 0.8 } })
  const supportP = settleProgress(frame, 40)
  const haloScale = 0.7 + pop * 0.5

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      {/* soft accent halo behind the number */}
      <div style={{
        position: 'absolute', width: 1100, height: 1100, borderRadius: '50%',
        background: `radial-gradient(circle, ${hexA(accent, theme.mode === 'dark' ? 0.20 : 0.12)} 0%, transparent 62%)`,
        transform: `scale(${haloScale})`, filter: 'blur(8px)',
      }} />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', zIndex: 1 }}>
        <div style={{
          opacity: labelP, transform: `translateY(${(1 - labelP) * 14}px)`,
          fontFamily: FONTS.body, fontWeight: 800, letterSpacing: 8, fontSize: TYPE.label,
          color: accent, textTransform: 'uppercase', marginBottom: 28,
        }}>
          {label}
        </div>

        <div style={{ transform: `scale(${0.92 + pop * 0.08})`, opacity: Math.min(1, pop * 1.4) }}>
          <StatCounter value={value} theme={theme} color={theme.textPrimary} fontSize={TYPE.hero * 0.92} startFrame={8} durationFrames={Math.round(1.3 * fps)} />
        </div>

        {support ? (
          <div style={{
            opacity: supportP, transform: `translateY(${(1 - supportP) * 14}px)`,
            fontFamily: FONTS.body, fontWeight: 500, fontSize: TYPE.subhead,
            color: theme.textMuted, marginTop: 34, maxWidth: 1100,
          }}>
            {support}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  )
}

function hexA(hex: string, a: number) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}
