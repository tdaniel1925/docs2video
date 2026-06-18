import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { PremiumBackground } from '../../PremiumBackground'
import { FONTS, TYPE, MOTION, TEXT_SHADOW, type Theme } from '../../tokens'
import { KineticText } from '../../KineticText'
import { CountUp } from '../../primitives'
import { Particles } from '../Particles'
import { settleProgress } from '../../helpers'

export type Metric = { icon: string; value: number; prefix?: string; suffix?: string; label: string; sublabel?: string }

/** "Complex becomes Clear" — a row of glass metric cards with count-up numbers,
 *  icon, label + sublabel. Headline on the left, cards on the right. */
export const MetricScene: React.FC<{
  eyebrow?: string
  title: string
  accentWordIndex?: number
  metrics: Metric[]
  theme: Theme
  durationInFrames: number
}> = ({ eyebrow, title, accentWordIndex, metrics, theme, durationInFrames: _d }) => {
  const frame = useCurrentFrame()
  const accent = theme.accents[0]
  const ebP = settleProgress(frame, 2)
  // Card text follows the theme mode: dark text on light themes, white on dark
  // (the glass cards sit on the theme ground, so they take its lightness).
  const cardText = theme.mode === 'light' ? '#0E1A2B' : '#FFFFFF'
  const cardMuted = theme.mode === 'light' ? 'rgba(14,26,43,0.6)' : theme.textMuted

  return (
    <AbsoluteFill>
      <PremiumBackground theme={theme} />
      <Particles accent={accent} count={34} />
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '80px 110px' }}>
        {eyebrow ? <div style={{ opacity: ebP, fontFamily: FONTS.body, fontWeight: 800, letterSpacing: 8, fontSize: TYPE.label, color: accent, textTransform: 'uppercase', marginBottom: 18, textShadow: TEXT_SHADOW }}>{eyebrow}</div> : null}
        <div style={{ marginBottom: 56, maxWidth: 1100 }}>
          <KineticText text={title} startFrame={6} fontFamily={FONTS.display} fontWeight={900} fontSize={TYPE.hero * 0.46} color={cardText} accentColor={accent} accentWordIndex={accentWordIndex} align="left" lineHeight={0.98} />
        </div>
        <div style={{ display: 'flex', gap: 28 }}>
          {metrics.map((m, i) => {
            const p = settleProgress(frame, 16 + i * MOTION.staggerFrames)
            const col = theme.accents[i % theme.accents.length]
            return (
              <div key={i} style={{ flex: 1, opacity: p, transform: `translateY(${(1 - p) * 50}px)`, background: theme.glass, border: `1px solid ${theme.glassEdge}`, backdropFilter: 'blur(20px)', borderRadius: 20, padding: '36px 28px', boxShadow: `0 24px 70px rgba(0,0,0,0.4), 0 0 ${30 * p}px ${col}22`, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: col, opacity: p, boxShadow: `0 0 16px ${col}` }} />
                <div style={{ fontSize: 44, marginBottom: 16 }}>{m.icon}</div>
                <div>
                  <CountUp value={m.value} prefix={m.prefix} suffix={m.suffix} startFrame={18 + i * MOTION.staggerFrames} fontSize={64} color={cardText} glow={col} />
                </div>
                <div style={{ fontFamily: FONTS.body, fontWeight: 700, fontSize: TYPE.subhead, color: col, marginTop: 14 }}>{m.label}</div>
                {m.sublabel ? <div style={{ fontFamily: FONTS.body, fontWeight: 400, fontSize: TYPE.label, color: cardMuted, marginTop: 6 }}>{m.sublabel}</div> : null}
              </div>
            )
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
