import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { SceneBackground } from '../SceneBackground'
import { FONTS, TYPE, type Theme } from '../tokens'
import { FitText } from '../FitText'
import { settleProgress } from '../helpers'
import { sceneText } from '../contrast'
import type { z } from 'zod'
import type { closingSchema } from '../schema'

export const ClosingScene: React.FC<{ data: z.infer<typeof closingSchema>; brandName: string; theme: Theme; bgImage?: string; durationInFrames: number }> = ({ data, brandName, theme, bgImage, durationInFrames }) => {
  const frame = useCurrentFrame()
  const ti = settleProgress(frame, 2)
  const btn = settleProgress(frame, 14)
  const co = settleProgress(frame, 24)
  const txt = sceneText(theme, !!bgImage)
  const [, gold] = theme.accents // accent[1] = the "gold"/CTA color

  return (
    <AbsoluteFill>
      <SceneBackground theme={theme} image={bgImage} durationInFrames={durationInFrames} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: 160 }}>
        <div style={{ opacity: ti, transform: `translateY(${(1 - ti) * 24}px)` }}>
          <FitText text={data.title} idealSize={Math.round(TYPE.hero * 0.78)} maxWidth={1500} fontFamily={FONTS.display} fontWeight={800} color={txt.primary} textAlign="center" />
        </div>

        {/* CTA "button" — solid accent pill, always high-contrast text on it. */}
        <div
          style={{
            opacity: btn,
            transform: `translateY(${(1 - btn) * 22}px) scale(${0.96 + btn * 0.04})`,
            marginTop: 48,
            background: gold,
            color: '#0B0F17',
            fontFamily: FONTS.body,
            fontWeight: 800,
            fontSize: TYPE.body,
            letterSpacing: 0.5,
            padding: '24px 56px',
            borderRadius: 14,
            boxShadow: `0 16px 60px ${gold}55`,
          }}
        >
          {data.cta}
        </div>

        {data.contact ? (
          <div style={{ opacity: co, fontFamily: FONTS.body, fontWeight: 500, fontSize: TYPE.subhead, color: txt.primary, marginTop: 36, letterSpacing: 1 }}>
            {data.contact}
          </div>
        ) : null}
        <div style={{ opacity: co * 0.85, fontFamily: FONTS.body, fontWeight: 700, fontSize: TYPE.label, color: txt.muted, marginTop: 18, letterSpacing: 2, textTransform: 'uppercase' }}>
          {brandName}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
