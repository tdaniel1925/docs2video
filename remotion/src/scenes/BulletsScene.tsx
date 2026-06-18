import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { SceneBackground } from '../SceneBackground'
import { FONTS, TYPE, MOTION, type Theme } from '../tokens'
import { settleProgress } from '../helpers'
import { sceneText } from '../contrast'
import type { z } from 'zod'
import type { bulletsSchema } from '../schema'

export const BulletsScene: React.FC<{ data: z.infer<typeof bulletsSchema>; theme: Theme; bgImage?: string; durationInFrames: number }> = ({ data, theme, bgImage, durationInFrames }) => {
  const frame = useCurrentFrame()
  const titleP = settleProgress(frame, 0)
  const txt = sceneText(theme, !!bgImage)

  return (
    <AbsoluteFill>
      <SceneBackground theme={theme} image={bgImage} durationInFrames={durationInFrames} />
      <AbsoluteFill style={{ flexDirection: 'column', justifyContent: 'center', padding: '120px 200px' }}>
        <div style={{ opacity: titleP, transform: `translateY(${(1 - titleP) * 20}px)`, fontFamily: FONTS.display, fontWeight: 800, fontSize: TYPE.title, color: txt.primary, marginBottom: 56 }}>
          {data.title}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
          {data.items.map((item, i) => {
            const prog = settleProgress(frame, 12 + i * MOTION.staggerFrames)
            const color = theme.accents[i % theme.accents.length]
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 28, opacity: prog, transform: `translateX(${(1 - prog) * -40}px)` }}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', background: color, boxShadow: `0 0 ${18 * prog}px ${color}`, flexShrink: 0 }} />
                <div style={{ fontFamily: FONTS.body, fontWeight: 500, fontSize: TYPE.body, color: txt.primary }}>{item}</div>
              </div>
            )
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
