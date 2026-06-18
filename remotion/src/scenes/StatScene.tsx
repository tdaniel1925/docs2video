import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { SceneBackground } from '../SceneBackground'
import { FONTS, TYPE, type Theme } from '../tokens'
import { settleProgress } from '../helpers'
import { sceneText } from '../contrast'
import type { z } from 'zod'
import type { statSchema } from '../schema'

export const StatScene: React.FC<{ data: z.infer<typeof statSchema>; theme: Theme; bgImage?: string; durationInFrames: number }> = ({ data, theme, bgImage, durationInFrames }) => {
  const frame = useCurrentFrame()
  const valP = settleProgress(frame, 4)
  const labP = settleProgress(frame, 16)
  const color = theme.accents[data.accentIndex]
  const txt = sceneText(theme, !!bgImage)

  return (
    <AbsoluteFill>
      <SceneBackground theme={theme} image={bgImage} durationInFrames={durationInFrames} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ opacity: valP, transform: `scale(${0.85 + valP * 0.15})`, fontFamily: FONTS.display, fontWeight: 800, fontSize: 260, lineHeight: 1, color: txt.primary, textShadow: `0 0 ${60 * valP}px ${color}88` }}>
          {data.value}
        </div>
        <div style={{ opacity: labP, transform: `translateY(${(1 - labP) * 16}px)`, fontFamily: FONTS.body, fontWeight: 700, fontSize: TYPE.body, color, letterSpacing: 3, textTransform: 'uppercase', marginTop: 16 }}>
          {data.label}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
