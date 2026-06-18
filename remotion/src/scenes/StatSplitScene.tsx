import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { PremiumBackground } from '../PremiumBackground'
import { FONTS, TYPE, MOTION, type Theme } from '../tokens'
import { settleProgress } from '../helpers'
import { ProgressChip, GlassCard, CountUp, IconBadge, DiagonalPhoto, Headline } from '../primitives'
import { Icon } from '../Icon'

export type SplitStat = { icon: 'spark' | 'shield' | 'chart'; label: string; value: number; suffix?: string }
export type SplitBullet = { icon: 'spark' | 'shield' | 'chart'; text: string }

/**
 * Premium composed layout (the "Who We Serve" caliber): progress chip,
 * mixed-weight headline, two count-up stat cards, a diagonal Ken-Burns photo
 * panel on the right, an icon bullet list, and a footer — all animated.
 */
export const StatSplitScene: React.FC<{
  index: number
  total: number
  eyebrowWordAccent?: number
  title: string
  stats: SplitStat[]          // 2
  bullets: SplitBullet[]      // up to 3
  footer: string
  image: string
  theme: Theme
  durationInFrames: number
}> = ({ index, total, eyebrowWordAccent, title, stats, bullets, footer, image, theme, durationInFrames }) => {
  const frame = useCurrentFrame()
  const accent = theme.accents[0]

  return (
    <AbsoluteFill>
      <PremiumBackground theme={theme} />
      <DiagonalPhoto image={image} accent={accent} side="right" durationInFrames={durationInFrames} />

      {/* Left content column */}
      <AbsoluteFill style={{ padding: '64px 72px', display: 'flex', flexDirection: 'column' }}>
        <ProgressChip index={index} total={total} theme={theme} />

        <div style={{ marginTop: 28, maxWidth: 1180 }}>
          <Headline text={title} accentWordIndex={eyebrowWordAccent} startFrame={6} fontSize={TYPE.hero * 0.74} color={theme.textPrimary} accentColor={accent} />
        </div>

        {/* Stat cards */}
        <div style={{ display: 'flex', gap: 28, marginTop: 48, maxWidth: 760 }}>
          {stats.map((s, i) => {
            const prog = settleProgress(frame, 18 + i * MOTION.staggerFrames)
            const col = theme.accents[i % theme.accents.length]
            return (
              <GlassCard key={i} theme={theme} accent={col} prog={prog} style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                  <IconBadge accent={col} size={56} prog={prog}><Icon name={s.icon} color={col} size={28} /></IconBadge>
                  <div style={{ fontFamily: FONTS.body, fontWeight: 600, fontSize: TYPE.subhead, color: theme.textMuted }}>{s.label}</div>
                </div>
                <CountUp value={s.value} suffix={s.suffix} startFrame={20 + i * MOTION.staggerFrames} fontSize={92} color={theme.textPrimary} glow={col} />
              </GlassCard>
            )
          })}
        </div>

        <div style={{ flex: 1 }} />
        <div style={{ fontFamily: FONTS.body, fontWeight: 700, letterSpacing: 6, fontSize: TYPE.label, color: theme.textMuted, textTransform: 'uppercase', opacity: settleProgress(frame, 30) }}>
          {footer}
        </div>
      </AbsoluteFill>

      {/* Right bullet list (over the photo's scrim) */}
      <div style={{ position: 'absolute', right: 72, top: '36%', width: 460, display: 'flex', flexDirection: 'column', gap: 26 }}>
        {bullets.map((b, i) => {
          const prog = settleProgress(frame, 24 + i * MOTION.staggerFrames)
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 18, opacity: prog, transform: `translateX(${(1 - prog) * 30}px)` }}>
              <IconBadge accent={accent} size={56} prog={prog}><Icon name={b.icon} color={accent} size={26} /></IconBadge>
              <div style={{ fontFamily: FONTS.body, fontWeight: 500, fontSize: TYPE.subhead, color: '#FFFFFF', lineHeight: 1.25 }}>{b.text}</div>
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}
