import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { SceneBackground } from '../SceneBackground'
import { FONTS, TYPE, MOTION, type Theme } from '../tokens'
import { settleProgress } from '../helpers'
import { sceneText } from '../contrast'

export type BarDatum = { label: string; value: number }

export const BarChartScene: React.FC<{
  title: string
  data: BarDatum[]
  unit?: string
  theme: Theme
  bgImage?: string
  durationInFrames: number
}> = ({ title, data, unit = '', theme, bgImage, durationInFrames }) => {
  const frame = useCurrentFrame()
  const titleP = settleProgress(frame, 0)
  const txt = sceneText(theme, !!bgImage)
  const max = Math.max(...data.map((d) => d.value), 1)

  return (
    <AbsoluteFill>
      <SceneBackground theme={theme} image={bgImage} durationInFrames={durationInFrames} />
      <AbsoluteFill style={{ flexDirection: 'column', justifyContent: 'center', padding: '120px 180px' }}>
        <div style={{ opacity: titleP, transform: `translateY(${(1 - titleP) * 20}px)`, fontFamily: FONTS.display, fontWeight: 800, fontSize: TYPE.title, color: txt.primary, marginBottom: 72 }}>
          {title}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 56, height: 480 }}>
          {data.map((d, i) => {
            const prog = settleProgress(frame, 12 + i * MOTION.staggerFrames)
            const color = theme.accents[i % theme.accents.length]
            const h = (d.value / max) * 100 * prog
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                <div style={{ opacity: prog, fontFamily: FONTS.display, fontWeight: 800, fontSize: TYPE.cardTitle, color: txt.primary, marginBottom: 16 }}>
                  {Math.round(d.value * prog).toLocaleString()}{unit}
                </div>
                <div style={{ width: '70%', height: `${h}%`, background: `linear-gradient(180deg, ${color}, ${color}99)`, borderRadius: '12px 12px 0 0', boxShadow: `0 0 ${40 * prog}px ${color}66` }} />
                <div style={{ fontFamily: FONTS.body, fontWeight: 600, fontSize: TYPE.label, color: txt.muted, marginTop: 22, textAlign: 'center' }}>{d.label}</div>
              </div>
            )
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
