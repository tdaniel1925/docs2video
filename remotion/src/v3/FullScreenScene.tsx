import { AbsoluteFill, Img, staticFile, useCurrentFrame, interpolate } from 'remotion'
import { FONTS, TYPE, type Theme } from '../tokens'
import { KineticText } from '../KineticText'
import { FilmOverlay } from '../FilmOverlay'
import { CinematicGrade } from './CinematicGrade'
import { settleProgress } from '../helpers'

export type Placement = 'bottom' | 'left' | 'right' | 'center' | 'top'

/**
 * Full-bleed image scene with VARIED, well-placed text. The placement rotates
 * per scene (bottom / left / right / center / top) so a video never feels
 * one-dimensional. A directional gradient guarantees the text is always on a
 * dark base (readable), and kinetic text + directional Ken Burns add life.
 */
export const FullScreenScene: React.FC<{
  image: string
  placement: Placement
  eyebrow?: string
  title: string
  body?: string
  accentWordIndex?: number
  theme: Theme
  durationInFrames: number
  /** Ken Burns direction bias toward where the subject likely is. */
  kenBurns?: 'in' | 'left' | 'right'
}> = ({ image, placement, eyebrow, title, body, accentWordIndex, theme, durationInFrames, kenBurns = 'in' }) => {
  const frame = useCurrentFrame()
  const t = interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateRight: 'clamp' })
  const accent = theme.accents[1] ?? theme.accents[0]

  // Ken Burns — slower + more confident (subtle = premium).
  const scale = 1.06 + t * 0.06
  const panX = kenBurns === 'left' ? interpolate(t, [0, 1], [1.0, -1.0]) : kenBurns === 'right' ? interpolate(t, [0, 1], [-1.0, 1.0]) : 0

  // Directional gradient based on placement (dark where the text is).
  const grad: Record<Placement, string> = {
    bottom: 'linear-gradient(0deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.40) 35%, transparent 65%)',
    top: 'linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.40) 35%, transparent 65%)',
    left: 'linear-gradient(90deg, rgba(0,0,0,0.86) 0%, rgba(0,0,0,0.45) 42%, transparent 72%)',
    right: 'linear-gradient(270deg, rgba(0,0,0,0.86) 0%, rgba(0,0,0,0.45) 42%, transparent 72%)',
    center: 'radial-gradient(120% 120% at 50% 50%, rgba(0,0,0,0.40) 0%, rgba(0,0,0,0.74) 100%)',
  }

  // Container alignment per placement. 'center' and 'bottom' are TRULY centered
  // horizontally (used for hero/main slides so they land hard); left/right/top
  // are for supporting variety.
  const align: Record<Placement, React.CSSProperties> = {
    bottom: { justifyContent: 'flex-end', alignItems: 'center', textAlign: 'center', padding: '0 200px 120px' },
    top: { justifyContent: 'flex-start', alignItems: 'center', textAlign: 'center', padding: '120px 200px 0' },
    left: { justifyContent: 'center', alignItems: 'flex-start', textAlign: 'left', padding: '0 130px' },
    right: { justifyContent: 'center', alignItems: 'flex-end', textAlign: 'right', padding: '0 130px' },
    center: { justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '0 220px' },
  }
  const textAlign: 'left' | 'right' | 'center' = placement === 'right' ? 'right' : (placement === 'left') ? 'left' : 'center'
  const maxW = placement === 'center' || placement === 'bottom' || placement === 'top' ? 1500 : 1000
  const ebP = settleProgress(frame, 2)
  const bodyP = settleProgress(frame, 22)

  return (
    <AbsoluteFill style={{ backgroundColor: theme.ink, overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `scale(${scale}) translateX(${panX}%)` }}>
        <Img src={staticFile(image)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </AbsoluteFill>
      {/* Cinematic grade turns a flat photo into a film frame (brand-tinted). */}
      <CinematicGrade accent={theme.accents[0]} intensity={1.4} />
      <AbsoluteFill style={{ background: grad[placement] }} />

      <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', ...align[placement] }}>
        {/* Inner block: textAlign applies to ALL children so eyebrow/title/body
            stack and align together (fixes "block centered but lines not centered"). */}
        <div style={{ maxWidth: maxW, textAlign, display: 'flex', flexDirection: 'column', alignItems: textAlign === 'center' ? 'center' : textAlign === 'right' ? 'flex-end' : 'flex-start' }}>
          {eyebrow ? (
            <div style={{ opacity: ebP, transform: `translateY(${(1 - ebP) * 14}px)`, fontFamily: FONTS.body, fontWeight: 800, letterSpacing: 8, fontSize: TYPE.label, color: accent, textTransform: 'uppercase', marginBottom: 24, textAlign, textShadow: '0 2px 12px rgba(0,0,0,0.6)' }}>
              {eyebrow}
            </div>
          ) : null}
          <KineticText text={title} startFrame={6} fontFamily={FONTS.display} fontWeight={900} fontSize={placement === 'center' ? TYPE.hero * 0.82 : TYPE.hero * 0.66} color="#FFFFFF" accentColor={accent} accentWordIndex={accentWordIndex} align={textAlign} lineHeight={0.98} />
          {body ? (
            <div style={{ opacity: bodyP, transform: `translateY(${(1 - bodyP) * 14}px)`, fontFamily: FONTS.body, fontWeight: 500, fontSize: TYPE.subhead, color: '#FFFFFF', marginTop: 30, maxWidth: 980, textAlign, textShadow: '0 2px 14px rgba(0,0,0,0.6)' }}>
              {body}
            </div>
          ) : null}
        </div>
      </AbsoluteFill>

      <FilmOverlay accent={accent} letterbox grain={0.07} />
    </AbsoluteFill>
  )
}
