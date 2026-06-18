import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { SceneBackground } from '../SceneBackground'
import { FONTS, TYPE, type Theme } from '../tokens'
import { settleProgress } from '../helpers'
import { sceneText } from '../contrast'

/** Animated donut: a single percentage ring that draws in, with a center value. */
export const DonutScene: React.FC<{
  title: string
  percent: number       // 0..100
  centerLabel: string
  accentIndex: number
  theme: Theme
  bgImage?: string
  durationInFrames: number
}> = ({ title, percent, centerLabel, accentIndex, theme, bgImage, durationInFrames }) => {
  const frame = useCurrentFrame()
  const titleP = settleProgress(frame, 0)
  const ring = settleProgress(frame, 10)
  const txt = sceneText(theme, !!bgImage)
  const color = theme.accents[accentIndex % theme.accents.length]

  const R = 200, C = 2 * Math.PI * R
  const shown = (percent / 100) * ring
  const dash = C * shown

  return (
    <AbsoluteFill>
      <SceneBackground theme={theme} image={bgImage} durationInFrames={durationInFrames} />
      <AbsoluteFill style={{ flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ opacity: titleP, transform: `translateY(${(1 - titleP) * 20}px)`, fontFamily: FONTS.display, fontWeight: 800, fontSize: TYPE.title, color: txt.primary, marginBottom: 56, textAlign: 'center' }}>
          {title}
        </div>
        <div style={{ position: 'relative', width: 480, height: 480 }}>
          <svg width={480} height={480} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={240} cy={240} r={R} fill="none" stroke={theme.glassEdge} strokeWidth={28} />
            <circle cx={240} cy={240} r={R} fill="none" stroke={color} strokeWidth={28} strokeLinecap="round" strokeDasharray={`${dash} ${C}`} style={{ filter: `drop-shadow(0 0 16px ${color})` }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: 120, color: txt.primary }}>{Math.round(percent * ring)}%</div>
            <div style={{ fontFamily: FONTS.body, fontWeight: 600, fontSize: TYPE.subhead, color: txt.muted, marginTop: 4 }}>{centerLabel}</div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
