import { AbsoluteFill, Img, staticFile, useCurrentFrame, interpolate } from 'remotion'
import { FONTS, TYPE, TEXT_SHADOW, type Theme } from '../../tokens'
import { KineticText } from '../../KineticText'
import { CinematicGrade } from '../CinematicGrade'
import { FilmOverlay } from '../../FilmOverlay'
import { Particles } from '../Particles'
import { settleProgress } from '../../helpers'

/** Cinematic full-bleed scene with floating chat-bubble messages drifting in
 *  (e.g. "Can you explain page 43?"). Headline lower-left. */
export const MessagesScene: React.FC<{
  image: string
  eyebrow?: string
  title: string
  accentWordIndex?: number
  messages: string[]
  theme: Theme
  durationInFrames: number
}> = ({ image, eyebrow, title, accentWordIndex, messages, theme, durationInFrames }) => {
  const frame = useCurrentFrame()
  const t = interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateRight: 'clamp' })
  const scale = 1.06 + t * 0.06
  const accent = theme.accents[0]
  const ebP = settleProgress(frame, 2)

  // Bubble anchor positions (right side, around the subject).
  const spots = [{ top: '16%', right: '8%' }, { top: '34%', right: '20%' }, { top: '52%', right: '6%' }]

  return (
    <AbsoluteFill style={{ backgroundColor: theme.ink, overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `scale(${scale})` }}>
        <Img src={staticFile(image)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </AbsoluteFill>
      <CinematicGrade accent={accent} intensity={1.4} />
      <AbsoluteFill style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.45) 45%, rgba(0,0,0,0.15) 100%)' }} />
      <Particles accent={accent} count={30} />

      {/* Floating message bubbles */}
      {messages.slice(0, 3).map((m, i) => {
        const p = settleProgress(frame, 16 + i * 10)
        const float = Math.sin((frame + i * 30) / 50) * 8
        return (
          <div key={i} style={{
            position: 'absolute', ...spots[i], maxWidth: 420,
            opacity: p, transform: `translateY(${(1 - p) * 30 + float}px)`,
            background: theme.glass, border: `1px solid ${theme.glassEdge}`, backdropFilter: 'blur(20px)',
            borderRadius: 18, padding: '20px 26px',
            fontFamily: FONTS.body, fontWeight: 600, fontSize: TYPE.subhead, color: '#FFFFFF',
            boxShadow: `0 16px 50px rgba(0,0,0,0.4), 0 0 ${20 * p}px ${accent}22`,
          }}>
            {m}
          </div>
        )
      })}

      {/* Headline lower-left */}
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'flex-start', padding: '0 130px 130px' }}>
        {eyebrow ? <div style={{ opacity: ebP, fontFamily: FONTS.body, fontWeight: 800, letterSpacing: 8, fontSize: TYPE.label, color: accent, textTransform: 'uppercase', marginBottom: 22, textShadow: TEXT_SHADOW }}>{eyebrow}</div> : null}
        <div style={{ maxWidth: 1000 }}>
          <KineticText text={title} startFrame={6} fontFamily={FONTS.display} fontWeight={900} fontSize={TYPE.hero * 0.62} color="#FFFFFF" accentColor={accent} accentWordIndex={accentWordIndex} align="left" lineHeight={0.98} />
        </div>
      </AbsoluteFill>

      <FilmOverlay accent={accent} letterbox grain={0.07} />
    </AbsoluteFill>
  )
}
