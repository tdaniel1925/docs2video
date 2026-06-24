import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, spring, interpolate, Easing } from 'remotion'
import { FONTS, TYPE, type Theme } from '../tokens'
import { settleProgress } from '../helpers'
import { KineticText } from '../KineticText'
import { CinematicGrade } from './CinematicGrade'
import { FilmOverlay } from '../FilmOverlay'
import { parseMetric, renderMetric } from '../components/infographic/format'

/**
 * "PowerPoint-on-cinematic" layout: a dark frosted-glass panel on the LEFT holds
 * the title + bullet points (each with its number when present); the cinematic
 * image fills the RIGHT. Premium explainer look — readable structured content
 * without losing the imagery. Used for scenes that have bullets/metrics.
 */
export type SlideBullet = { text: string; value?: string }

export const SlidePanelScene: React.FC<{
  image?: string
  eyebrow?: string
  title: string
  bullets: SlideBullet[]
  accentWordIndex?: number
  theme: Theme
  durationInFrames: number
  /** Fluid look: skip per-scene image + opaque ground; the shared backdrop
   *  behind the Series shows through on the right of the glass panel. */
  transparentBg?: boolean
}> = ({ image, eyebrow, title, bullets, accentWordIndex, theme, durationInFrames, transparentBg }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const accent = theme.accents[1] ?? theme.accents[0]

  // Ken Burns — clearly visible: a stronger zoom + a slow horizontal drift so
  // the exposed right side of the image actually MOVES (6% was imperceptible
  // behind the panel). Linear t for steady, noticeable motion.
  const tLin = interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateRight: 'clamp' })
  const scale = 1.08 + tLin * 0.14
  const panX = interpolate(tLin, [0, 1], [2.5, -2.5])

  // Panel slides in from the left.
  const panelP = spring({ frame: frame - 4, fps, config: { damping: 18, stiffness: 90, mass: 1 } })
  const panelX = (1 - panelP) * -80

  const ebP = settleProgress(frame, 8)
  const list = (bullets || []).filter((b) => b && b.text).slice(0, 4)

  // Adaptive sizing so long content never overflows the panel/frame (audit:
  // letters spilled out of the box). Shrink the title + bullets as the bullet
  // COUNT and the LONGEST bullet grow. Conservative floors keep it readable.
  const longest = list.reduce((n, b) => Math.max(n, (b.text || '').length + (b.value ? 8 : 0)), 0)
  const dense = list.length >= 4 || longest > 90
  const veryDense = (list.length >= 4 && longest > 80) || longest > 130
  const titleScale = veryDense ? 0.74 : dense ? 0.84 : 0.92
  const bodyScale = veryDense ? 0.66 : dense ? 0.74 : 0.82
  const bulletGap = veryDense ? 14 : dense ? 18 : 24
  const listTop = veryDense ? 26 : dense ? 32 : 40

  return (
    <AbsoluteFill style={{ backgroundColor: transparentBg ? 'transparent' : theme.ink, overflow: 'hidden' }}>
      {/* Right: cinematic image, graded. (Skipped in fluid mode — the shared
          backdrop behind the Series provides the imagery.) */}
      {transparentBg ? null : image ? (
        <AbsoluteFill style={{ transform: `scale(${scale}) translateX(${panX}%)` }}>
          <Img src={staticFile(image)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </AbsoluteFill>
      ) : (
        <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 70% 40%, ${theme.inkSoft} 0%, ${theme.ink} 75%)` }} />
      )}
      {transparentBg ? null : <CinematicGrade accent={theme.accents[0]} intensity={1.5} />}
      {/* Left-side darkening so the panel always reads. */}
      <AbsoluteFill style={{ background: 'linear-gradient(90deg, rgba(4,7,12,0.92) 0%, rgba(4,7,12,0.72) 38%, transparent 62%)' }} />

      {/* The glass panel with title + bullets. */}
      <AbsoluteFill style={{ flexDirection: 'column', justifyContent: 'center', padding: '0 0 0 110px' }}>
        <div style={{
          width: 1000, maxWidth: '56%', maxHeight: 900, overflow: 'hidden',
          opacity: Math.min(1, panelP * 1.4), transform: `translateX(${panelX}px)`,
          background: 'rgba(8,12,20,0.58)', backdropFilter: 'blur(14px)',
          border: '1px solid rgba(255,255,255,0.10)', borderRadius: 12,
          padding: veryDense ? '40px 56px' : '60px 64px', display: 'flex', flexDirection: 'column',
        }}>
          {eyebrow ? (
            <div style={{ opacity: ebP, fontFamily: FONTS.body, fontWeight: 800, letterSpacing: 7, fontSize: TYPE.label * 0.95, color: accent, textTransform: 'uppercase', marginBottom: 18 }}>
              {eyebrow}
            </div>
          ) : null}

          <KineticText text={title} startFrame={10} fontFamily={FONTS.display} fontWeight={900} fontSize={TYPE.title * titleScale} color="#FFFFFF" accentColor={accent} accentWordIndex={accentWordIndex} align="left" lineHeight={1.06} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: bulletGap, marginTop: listTop }}>
            {list.map((b, i) => {
              const start = 24 + i * Math.round(0.18 * fps)
              const rise = spring({ frame: frame - start, fps, config: { damping: 16, stiffness: 120, mass: 0.8 } })
              const countP = interpolate(frame, [start, start + Math.round(1.0 * fps)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
              return (
                <div key={i} style={{ opacity: Math.min(1, rise * 1.5), transform: `translateY(${(1 - rise) * 18}px)`, display: 'flex', alignItems: 'baseline', gap: 20 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: accent, flexShrink: 0, transform: 'translateY(-3px)', boxShadow: `0 0 10px ${accent}` }} />
                  <div style={{ fontFamily: FONTS.body, fontWeight: 500, fontSize: TYPE.body * bodyScale, color: '#EAF1FB', lineHeight: 1.32, flex: 1, overflowWrap: 'break-word', minWidth: 0 }}>
                    {b.text}
                    {b.value ? (
                      <span style={{ fontFamily: FONTS.display, fontWeight: 900, color: accent, marginLeft: 12, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {renderMetric(parseMetric(b.value), countP)}
                      </span>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </AbsoluteFill>

      <FilmOverlay accent={accent} letterbox grain={0.07} />
    </AbsoluteFill>
  )
}
