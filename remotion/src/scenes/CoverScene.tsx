import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { SceneBackground } from '../SceneBackground'
import { FONTS, TYPE, type Theme } from '../tokens'
import { FitText } from '../FitText'
import { settleProgress } from '../helpers'
import { sceneText } from '../contrast'
import type { z } from 'zod'
import type { coverSchema } from '../schema'

export const CoverScene: React.FC<{ data: z.infer<typeof coverSchema>; brandName: string; theme: Theme; bgImage?: string; durationInFrames: number }> = ({ data, brandName, theme, bgImage, durationInFrames }) => {
  const frame = useCurrentFrame()
  const eb = settleProgress(frame, 0)
  const ti = settleProgress(frame, 6)
  const su = settleProgress(frame, 14)
  const txt = sceneText(theme, !!bgImage)

  return (
    <AbsoluteFill>
      <SceneBackground theme={theme} image={bgImage} durationInFrames={durationInFrames} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: 160 }}>
        <div style={{ opacity: eb, transform: `translateY(${(1 - eb) * 20}px)`, fontFamily: FONTS.body, fontWeight: 700, letterSpacing: 6, fontSize: TYPE.label, color: theme.accents[2], textTransform: 'uppercase', marginBottom: 28 }}>
          {data.eyebrow}
        </div>
        <div style={{ opacity: ti, transform: `translateY(${(1 - ti) * 28}px)` }}>
          <FitText text={data.title} idealSize={TYPE.hero} maxWidth={1500} fontFamily={FONTS.display} fontWeight={800} color={txt.primary} textAlign="center" />
        </div>
        <div style={{ opacity: su, transform: `translateY(${(1 - su) * 20}px)`, fontFamily: FONTS.body, fontWeight: 400, fontSize: TYPE.subhead, color: txt.muted, marginTop: 32, maxWidth: 1100 }}>
          {data.subtitle}
        </div>
        <div style={{ opacity: su * 0.85, fontFamily: FONTS.body, fontWeight: 700, fontSize: TYPE.label, color: theme.accents[1], marginTop: 56, letterSpacing: 2 }}>
          {brandName}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
