import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { SceneBackground } from '../SceneBackground'
import { FONTS, TYPE, MOTION, type Theme } from '../tokens'
import { settleProgress } from '../helpers'
import { sceneText } from '../contrast'

export type Kpi = { value: string; label: string }

export const KpiScene: React.FC<{
  title: string
  kpis: Kpi[]            // 2..4
  theme: Theme
  bgImage?: string
  durationInFrames: number
}> = ({ title, kpis, theme, bgImage, durationInFrames }) => {
  const frame = useCurrentFrame()
  const titleP = settleProgress(frame, 0)
  const txt = sceneText(theme, !!bgImage)

  return (
    <AbsoluteFill>
      <SceneBackground theme={theme} image={bgImage} durationInFrames={durationInFrames} />
      <AbsoluteFill style={{ flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '100px 140px' }}>
        <div style={{ opacity: titleP, transform: `translateY(${(1 - titleP) * 20}px)`, fontFamily: FONTS.display, fontWeight: 800, fontSize: TYPE.title, color: txt.primary, marginBottom: 72, textAlign: 'center' }}>
          {title}
        </div>
        <div style={{ display: 'flex', gap: 40, width: '100%', maxWidth: 1640, justifyContent: 'center' }}>
          {kpis.map((k, i) => {
            const prog = settleProgress(frame, 12 + i * MOTION.staggerFrames)
            const color = theme.accents[i % theme.accents.length]
            return (
              <div key={i} style={{ flex: 1, opacity: prog, transform: `translateY(${(1 - prog) * 50}px)`, background: theme.glass, border: `1px solid ${theme.glassEdge}`, borderRadius: 24, padding: '52px 32px', textAlign: 'center', backdropFilter: 'blur(12px)' }}>
                <div style={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: 96, color: txt.primary, textShadow: `0 0 ${28 * prog}px ${color}66`, lineHeight: 1 }}>{k.value}</div>
                <div style={{ fontFamily: FONTS.body, fontWeight: 600, fontSize: TYPE.subhead, color, marginTop: 18, letterSpacing: 1 }}>{k.label}</div>
              </div>
            )
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
