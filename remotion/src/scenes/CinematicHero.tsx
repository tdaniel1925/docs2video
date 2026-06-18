import { AbsoluteFill, Img, staticFile, useCurrentFrame, interpolate } from 'remotion'
import { FONTS, TYPE, type Theme } from '../tokens'
import { KineticText } from '../KineticText'
import { FilmOverlay } from '../FilmOverlay'
import { settleProgress } from '../helpers'

/**
 * Subject-aware cinematic hero. The Gemini image has the SUBJECT on `focalSide`;
 * a directional gradient panel + kinetic text occupy the OPPOSITE side so text
 * never covers the subject. Directional Ken Burns pushes toward the subject;
 * the text panel parallaxes at a different rate for depth. Film overlay on top.
 */
export const CinematicHero: React.FC<{
  image: string
  focalSide: 'left' | 'right' | 'center'
  eyebrow?: string
  title: string
  subtitle?: string
  accentWordIndex?: number
  theme: Theme
  durationInFrames: number
}> = ({ image, focalSide, eyebrow, title, subtitle, accentWordIndex, theme, durationInFrames }) => {
  const frame = useCurrentFrame()
  const t = interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateRight: 'clamp' })

  // Text goes opposite the subject.
  const textOnLeft = focalSide === 'right' || focalSide === 'center'
  const accent = theme.accents[1]

  // Directional Ken Burns: push in, drift toward the subject side.
  const scale = 1.08 + t * 0.1
  const panX = (focalSide === 'right' ? 1 : focalSide === 'left' ? -1 : 0) * interpolate(t, [0, 1], [-1.5, 1.5])

  // Text parallax: drifts slightly opposite the image for depth.
  const textParallax = interpolate(t, [0, 1], [0, textOnLeft ? -14 : 14])

  // Directional gradient scrim — darkest on the text side, clear over the subject.
  const grad =
    focalSide === 'center'
      ? 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.78) 100%)'
      : textOnLeft
        ? 'linear-gradient(90deg, rgba(0,0,0,0.86) 0%, rgba(0,0,0,0.55) 42%, rgba(0,0,0,0) 72%)'
        : 'linear-gradient(270deg, rgba(0,0,0,0.86) 0%, rgba(0,0,0,0.55) 42%, rgba(0,0,0,0) 72%)'

  const align: 'left' | 'right' | 'center' = focalSide === 'center' ? 'center' : textOnLeft ? 'left' : 'right'
  const ebP = settleProgress(frame, 2)
  const subP = settleProgress(frame, 26)

  return (
    <AbsoluteFill style={{ backgroundColor: theme.ink, overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `scale(${scale}) translateX(${panX}%)` }}>
        <Img src={staticFile(image)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: grad }} />

      {/* Text block in the clean zone */}
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: focalSide === 'center' ? 'center' : textOnLeft ? 'flex-start' : 'flex-end',
          padding: focalSide === 'center' ? '0 200px 150px' : '0 130px',
          textAlign: align,
        }}
      >
        <div style={{ maxWidth: focalSide === 'center' ? 1500 : 900, transform: `translateX(${textParallax}px)` }}>
          {eyebrow ? (
            <div style={{ opacity: ebP, transform: `translateY(${(1 - ebP) * 16}px)`, fontFamily: FONTS.body, fontWeight: 700, letterSpacing: 6, fontSize: TYPE.label, color: accent, textTransform: 'uppercase', marginBottom: 22 }}>
              {eyebrow}
            </div>
          ) : null}
          <KineticText text={title} startFrame={6} fontFamily={FONTS.display} fontWeight={800} fontSize={TYPE.hero * 0.82} color="#FFFFFF" accentColor={accent} accentWordIndex={accentWordIndex} align={align} />
          {subtitle ? (
            <div style={{ opacity: subP, transform: `translateY(${(1 - subP) * 16}px)`, fontFamily: FONTS.body, fontWeight: 400, fontSize: TYPE.subhead, color: 'rgba(255,255,255,0.82)', marginTop: 28, maxWidth: 760 }}>
              {subtitle}
            </div>
          ) : null}
        </div>
      </AbsoluteFill>

      <FilmOverlay accent={accent} letterbox grain={0.06} />
    </AbsoluteFill>
  )
}
