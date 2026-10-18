import { useCurrentFrame, spring, useVideoConfig } from 'remotion'
import { FONTS, TYPE, type Theme } from '../../tokens'
import { settleProgress } from '../../helpers'
import { Fit } from '../../lib/fit'
import { StatCounter } from './StatCounter'
import { Stage, type Reserve } from './Stage'

/**
 * One dominant metric, hero-scale and centered. The number counts up; a glowing
 * ring/halo settles behind it; eyebrow above, supporting line below. Used when a
 * scene has a single headline figure (e.g. "$176,204 — Initial Death Benefit").
 *
 * The column is a fixed width, so the number (a <Fit> inside StatCounter) and
 * the label/support lines shrink to it instead of running off the frame — the
 * value comes from the document and can be "100% High Cap Rate Acct (S&P 500
 * Index)" as easily as "$176,204".
 */
export const HeroMetric: React.FC<{
  label: string            // eyebrow, e.g. "Initial Death Benefit"
  value: string            // "$176,204"
  support?: string         // optional line under the number
  theme: Theme
  accentIndex?: number
  /** Space to keep clear at the top/bottom of the frame (eyebrow, logo). */
  reserve?: Reserve
}> = ({ label, value, support, theme, accentIndex = 0, reserve }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const accent = theme.accents[accentIndex] ?? theme.accents[0]

  const labelP = settleProgress(frame, 4)
  const pop = spring({ frame: frame - 8, fps, config: { damping: 14, stiffness: 120, mass: 0.8 } })
  const supportP = settleProgress(frame, 40)
  const haloScale = 0.7 + pop * 0.5

  return (
    <Stage
      width={1500} padX={150} reserve={reserve}
      backdrop={
        /* soft accent halo behind the number */
        <div style={{
          position: 'absolute', width: 1100, height: 1100, borderRadius: '50%',
          background: `radial-gradient(circle, ${hexA(accent, theme.mode === 'dark' ? 0.20 : 0.12)} 0%, transparent 62%)`,
          transform: `scale(${haloScale})`, filter: 'blur(8px)',
        }} />
      }
    >
      <div style={{
        width: '100%', opacity: labelP, transform: `translateY(${(1 - labelP) * 14}px)`, marginBottom: 28,
      }}>
        <Fit max={TYPE.label} min={18} lines={2} style={{
          fontFamily: FONTS.body, fontWeight: 800, letterSpacing: '0.285em', lineHeight: 1.25,
          color: accent, textTransform: 'uppercase', textAlign: 'center',
        }}>
          {label}
        </Fit>
      </div>

      <div style={{ width: '100%', textAlign: 'center', transform: `scale(${0.92 + pop * 0.08})`, opacity: Math.min(1, pop * 1.4) }}>
        <StatCounter value={value} theme={theme} color={theme.textPrimary} fontSize={TYPE.hero * 0.92} startFrame={8} durationFrames={Math.round(1.3 * fps)} />
      </div>

      {support ? (
        <div style={{
          width: '100%', maxWidth: 1100, marginTop: 34,
          opacity: supportP, transform: `translateY(${(1 - supportP) * 14}px)`,
        }}>
          <Fit max={TYPE.subhead} min={26} lines={3} style={{
            fontFamily: FONTS.body, fontWeight: 500, color: theme.textMuted, textAlign: 'center',
          }}>
            {support}
          </Fit>
        </div>
      ) : null}
    </Stage>
  )
}

function hexA(hex: string, a: number) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}
