import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { PremiumBackground } from '../PremiumBackground'
import { FONTS, TYPE, type Theme } from '../tokens'
import { settleProgress } from '../helpers'
import { ProgressChip, CountUp, Headline, DiagonalPhoto } from '../primitives'

/** A bold full-bleed statement: oversized ghost number behind a big headline,
 *  plus a supporting count-up stat band. Photo strip on the left. */
export const BigStatementScene: React.FC<{
  index: number
  total: number
  ghostNumber: string
  title: string
  accentWordIndex?: number
  statValue: number
  statSuffix?: string
  statLabel: string
  footer: string
  image: string
  theme: Theme
  durationInFrames: number
}> = ({ index, total, ghostNumber, title, accentWordIndex, statValue, statSuffix, statLabel, footer, image, theme, durationInFrames }) => {
  const frame = useCurrentFrame()
  const accent = theme.accents[0]
  const ghostP = settleProgress(frame, 0)
  const statP = settleProgress(frame, 22)

  return (
    <AbsoluteFill>
      <PremiumBackground theme={theme} />
      <DiagonalPhoto image={image} accent={accent} side="left" durationInFrames={durationInFrames} />

      {/* oversized ghost number */}
      <div style={{ position: 'absolute', right: 40, top: -40, fontFamily: FONTS.display, fontWeight: 800, fontSize: 760, lineHeight: 1, color: theme.glassEdge, opacity: 0.5 * ghostP }}>
        {ghostNumber}
      </div>

      <AbsoluteFill style={{ padding: '64px 80px 64px 46%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <ProgressChip index={index} total={total} theme={theme} />
        <div style={{ marginTop: 26 }}>
          <Headline text={title} accentWordIndex={accentWordIndex} startFrame={6} fontSize={TYPE.hero * 0.62} color={theme.textPrimary} accentColor={accent} />
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 20, marginTop: 44, opacity: statP }}>
          <CountUp value={statValue} suffix={statSuffix} startFrame={24} fontSize={140} color={accent} glow={accent} />
          <div style={{ fontFamily: FONTS.body, fontWeight: 600, fontSize: TYPE.body, color: theme.textMuted, maxWidth: 360 }}>{statLabel}</div>
        </div>
        <div style={{ marginTop: 'auto', paddingTop: 40, fontFamily: FONTS.body, fontWeight: 700, letterSpacing: 6, fontSize: TYPE.label, color: theme.textMuted, textTransform: 'uppercase', opacity: settleProgress(frame, 30) }}>
          {footer}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
