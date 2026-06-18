import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { SceneBackground } from '../SceneBackground'
import { FONTS, TYPE, MOTION, type Theme } from '../tokens'
import { settleProgress } from '../helpers'
import { sceneText } from '../contrast'
import { Icon } from '../Icon'
import type { Pillar } from '../schema'

export const PillarsScene: React.FC<{ title: string; pillars: Pillar[]; theme: Theme; bgImage?: string; durationInFrames: number }> = ({ title, pillars, theme, bgImage, durationInFrames }) => {
  const frame = useCurrentFrame()
  const titleP = settleProgress(frame, 0)
  const txt = sceneText(theme, !!bgImage)

  return (
    <AbsoluteFill>
      <SceneBackground theme={theme} image={bgImage} durationInFrames={durationInFrames} />
      <AbsoluteFill style={{ flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '80px 120px' }}>
        <div style={{ opacity: titleP, transform: `translateY(${(1 - titleP) * 20}px)`, fontFamily: FONTS.display, fontWeight: 800, fontSize: TYPE.title, color: txt.primary, marginBottom: 64, textAlign: 'center' }}>
          {title}
        </div>
        <div style={{ display: 'flex', gap: 40, width: '100%', maxWidth: 1640, justifyContent: 'center' }}>
          {pillars.map((p, i) => {
            const prog = settleProgress(frame, 10 + i * MOTION.staggerFrames)
            const color = theme.accents[p.accentIndex]
            return (
              <div key={i} style={{ flex: 1, opacity: prog, transform: `translateY(${(1 - prog) * 60}px)`, background: theme.glass, border: `1px solid ${theme.glassEdge}`, borderRadius: 24, padding: '44px 36px', position: 'relative', overflow: 'hidden', backdropFilter: 'blur(12px)' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: color, boxShadow: `0 0 ${24 * prog}px ${color}`, opacity: prog }} />
                <div style={{ width: 88, height: 88, borderRadius: '50%', border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 28, boxShadow: `0 0 ${20 * prog}px ${color}55` }}>
                  <Icon name={p.icon} color={color} size={42} />
                </div>
                <div style={{ fontFamily: FONTS.body, fontWeight: 700, letterSpacing: 4, fontSize: TYPE.label, color, textTransform: 'uppercase', marginBottom: 14 }}>{p.label}</div>
                <div style={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: TYPE.cardTitle, color: theme.textPrimary, lineHeight: 1.1, marginBottom: 12 }}>{p.title}</div>
                <div style={{ fontFamily: FONTS.body, fontStyle: 'italic', fontSize: TYPE.subhead, color: theme.textMuted, lineHeight: 1.35 }}>{p.subhead}</div>
              </div>
            )
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
