import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { SceneBackground } from '../SceneBackground'
import { FONTS, TYPE, type Theme } from '../tokens'
import { settleProgress } from '../helpers'
import { sceneText } from '../contrast'

export const ComparisonScene: React.FC<{
  title: string
  left: { label: string; value: string }
  right: { label: string; value: string }
  theme: Theme
  bgImage?: string
  durationInFrames: number
}> = ({ title, left, right, theme, bgImage, durationInFrames }) => {
  const frame = useCurrentFrame()
  const titleP = settleProgress(frame, 0)
  const lp = settleProgress(frame, 10)
  const rp = settleProgress(frame, 18)
  const txt = sceneText(theme, !!bgImage)
  const dim = theme.accents[0]
  const win = theme.accents[1]

  const Card: React.FC<{ d: { label: string; value: string }; prog: number; color: string; from: number }> = ({ d, prog, color, from }) => (
    <div style={{ flex: 1, opacity: prog, transform: `translateX(${(1 - prog) * from}px)`, background: theme.glass, border: `1px solid ${color}55`, borderRadius: 24, padding: '64px 48px', textAlign: 'center', backdropFilter: 'blur(12px)' }}>
      <div style={{ fontFamily: FONTS.body, fontWeight: 700, letterSpacing: 3, fontSize: TYPE.label, color, textTransform: 'uppercase', marginBottom: 24 }}>{d.label}</div>
      <div style={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: 140, color: txt.primary, textShadow: `0 0 ${30 * prog}px ${color}66` }}>{d.value}</div>
    </div>
  )

  return (
    <AbsoluteFill>
      <SceneBackground theme={theme} image={bgImage} durationInFrames={durationInFrames} />
      <AbsoluteFill style={{ flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '100px 160px' }}>
        <div style={{ opacity: titleP, transform: `translateY(${(1 - titleP) * 20}px)`, fontFamily: FONTS.display, fontWeight: 800, fontSize: TYPE.title, color: txt.primary, marginBottom: 64, textAlign: 'center' }}>
          {title}
        </div>
        <div style={{ display: 'flex', gap: 48, width: '100%', maxWidth: 1500, alignItems: 'center' }}>
          <Card d={left} prog={lp} color={dim} from={-50} />
          <div style={{ opacity: lp, fontFamily: FONTS.display, fontWeight: 800, fontSize: 56, color: txt.muted }}>vs</div>
          <Card d={right} prog={rp} color={win} from={50} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
