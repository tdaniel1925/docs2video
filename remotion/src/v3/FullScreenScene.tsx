import { AbsoluteFill, Img, staticFile, useCurrentFrame, interpolate, Easing } from 'remotion'
import { FONTS, TYPE, type Theme } from '../tokens'
import { KineticText } from '../KineticText'
import { FilmOverlay } from '../FilmOverlay'
import { CinematicGrade } from './CinematicGrade'
import { LowerThird } from './LowerThird'
import { HeroMetric } from './HeroMetric'
import { settleProgress } from '../helpers'

export type Placement = 'bottom' | 'left' | 'right' | 'center' | 'top'

/**
 * Full-bleed image scene with VARIED, well-placed text. The placement rotates
 * per scene (bottom / left / right / center / top) so a video never feels
 * one-dimensional. A directional gradient guarantees the text is always on a
 * dark base (readable), and kinetic text + directional Ken Burns add life.
 */
export const FullScreenScene: React.FC<{
  /** Optional: if image-gen failed the scene renders on the theme ground. */
  image?: string
  placement: Placement
  eyebrow?: string
  title: string
  body?: string
  accentWordIndex?: number
  theme: Theme
  durationInFrames: number
  /** Ken Burns direction bias toward where the subject likely is. */
  kenBurns?: 'in' | 'left' | 'right'
  /** Optional key metric(s) → cinematic lower-third callouts. `metrics` (array)
   *  shows up to 3; `metric` (single) kept for back-compat. */
  metric?: { label: string; value: string }
  metrics?: { label: string; value: string }[]
  /** One enormous hero figure (reference "$0.019 / 594 / 2-3×" look). When set,
   *  it REPLACES the centered title block with a left-anchored giant number. */
  heroMetric?: { value: string; label?: string; caption?: string; tone?: 'hero' | 'neutral' | 'warn' }
  /** Fluid looks: don't paint an opaque ground or per-scene image — let the
   *  ONE continuous shared backdrop (mesh or single image) behind the Series
   *  show through, so every scene reads as the same world. */
  transparentBg?: boolean
}> = ({ image, placement, eyebrow, title, body, accentWordIndex, theme, durationInFrames, kenBurns = 'in', metric, metrics, heroMetric, transparentBg }) => {
  const frame = useCurrentFrame()
  // Speed-ramped Ken Burns: ease-in-out so the camera ACCELERATES through the
  // middle and settles — cinematic motion is about acceleration, not linear drift.
  const tLinear = interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateRight: 'clamp' })
  const t = interpolate(tLinear, [0, 1], [0, 1], { easing: Easing.inOut(Easing.cubic) })
  const accent = theme.accents[1] ?? theme.accents[0]

  // Ken Burns — slower + more confident (subtle = premium).
  const scale = 1.06 + t * 0.07
  const panX = kenBurns === 'left' ? interpolate(t, [0, 1], [1.2, -1.2]) : kenBurns === 'right' ? interpolate(t, [0, 1], [-1.2, 1.2]) : 0

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
    top: { justifyContent: 'flex-start', alignItems: 'center', textAlign: 'center', padding: '150px 200px 0' },
    left: { justifyContent: 'center', alignItems: 'flex-start', textAlign: 'left', padding: '0 130px' },
    right: { justifyContent: 'center', alignItems: 'flex-end', textAlign: 'right', padding: '0 130px' },
    center: { justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '0 220px' },
  }
  const textAlign: 'left' | 'right' | 'center' = placement === 'right' ? 'right' : (placement === 'left') ? 'left' : 'center'
  const maxW = placement === 'center' || placement === 'bottom' || placement === 'top' ? 1500 : 1000
  // Reveals cascade ~0.3-1.2s in so they land just AFTER the narration opens
  // (VO-synced feel), not the instant the cut happens.
  const ebP = settleProgress(frame, 8)
  const bodyP = settleProgress(frame, 34)

  return (
    <AbsoluteFill style={{ backgroundColor: transparentBg ? 'transparent' : theme.ink, overflow: 'hidden' }}>
      {transparentBg ? (
        // Fluid look: the shared backdrop (behind the Series) provides the world.
        // Just lay the readability gradient so text stays legible everywhere.
        null
      ) : image ? (
        <AbsoluteFill style={{ transform: `scale(${scale}) translateX(${panX}%)` }}>
          <Img src={staticFile(image)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </AbsoluteFill>
      ) : (
        // No image (gen failed): a subtle accent gradient on the theme ground so
        // the scene still reads cinematic rather than flat black.
        <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 35%, ${theme.inkSoft} 0%, ${theme.ink} 75%)` }} />
      )}
      {/* Cinematic grade turns a flat photo into a film frame (brand-tinted).
          Skip on transparent scenes so we don't double-darken the shared backdrop. */}
      {transparentBg ? null : <CinematicGrade accent={theme.accents[0]} intensity={1.4} />}
      <AbsoluteFill style={{ background: grad[placement] }} />

      {heroMetric ? (
        // HERO-NUMBER layout: one enormous figure anchored left (reference look).
        // The eyebrow still rides on top; an optional title sits above as a kicker.
        <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', padding: '0 130px' }}>
          {eyebrow ? (
            <div style={{ opacity: ebP, transform: `translateY(${(1 - ebP) * 14}px)`, fontFamily: FONTS.body, fontWeight: 800, letterSpacing: 8, fontSize: TYPE.label, color: accent, textTransform: 'uppercase', marginBottom: 20, textShadow: '0 2px 12px rgba(0,0,0,0.6)' }}>
              {eyebrow}
            </div>
          ) : null}
          <HeroMetric value={heroMetric.value} label={heroMetric.label || title} caption={heroMetric.caption} tone={heroMetric.tone} theme={theme} />
        </AbsoluteFill>
      ) : (
        <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', ...align[placement] }}>
          {/* Inner block: textAlign applies to ALL children so eyebrow/title/body
              stack and align together (fixes "block centered but lines not centered"). */}
          <div style={{ maxWidth: maxW, textAlign, display: 'flex', flexDirection: 'column', alignItems: textAlign === 'center' ? 'center' : textAlign === 'right' ? 'flex-end' : 'flex-start' }}>
            {eyebrow ? (
              <div style={{ opacity: ebP, transform: `translateY(${(1 - ebP) * 14}px)`, fontFamily: FONTS.body, fontWeight: 800, letterSpacing: 8, fontSize: TYPE.label, color: accent, textTransform: 'uppercase', marginBottom: 24, textAlign, textShadow: '0 2px 12px rgba(0,0,0,0.6)' }}>
                {eyebrow}
              </div>
            ) : null}
            <KineticText text={title} startFrame={14} fontFamily={FONTS.display} fontWeight={900} fontSize={placement === 'center' ? TYPE.hero * 0.82 : TYPE.hero * 0.66} color="#FFFFFF" accentColor={accent} accentWordIndex={accentWordIndex} align={textAlign} lineHeight={0.98} />
            {body ? (
              <div style={{ opacity: bodyP, transform: `translateY(${(1 - bodyP) * 14}px)`, fontFamily: FONTS.body, fontWeight: 500, fontSize: TYPE.subhead, color: '#FFFFFF', marginTop: 30, maxWidth: 980, textAlign, textShadow: '0 2px 14px rgba(0,0,0,0.6)' }}>
                {body}
              </div>
            ) : null}
          </div>
        </AbsoluteFill>
      )}

      {/* Cinematic data callouts — key numbers over the film image (up to 3).
          Suppressed when a hero figure owns the frame (avoids a number-on-number clash). */}
      {heroMetric ? null : (() => {
        const mList = (metrics && metrics.length ? metrics : metric ? [metric] : [])
        return mList.length ? <LowerThird metrics={mList} theme={theme} durationInFrames={durationInFrames} /> : null
      })()}

      <FilmOverlay accent={accent} letterbox grain={0.07} />
    </AbsoluteFill>
  )
}
