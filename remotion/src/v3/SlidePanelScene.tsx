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
}> = ({ image, eyebrow, title, bullets, accentWordIndex, theme, durationInFrames }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const t = interpolate(interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateRight: 'clamp' }), [0, 1], [0, 1], { easing: Easing.inOut(Easing.cubic) })
  const accent = theme.accents[1] ?? theme.accents[0]

  // Image (right) with a gentle Ken Burns.
  const scale = 1.06 + t * 0.06

  // Panel slides in from the left.
  const panelP = spring({ frame: frame - 4, fps, config: { damping: 18, stiffness: 90, mass: 1 } })
  const panelX = (1 - panelP) * -80

  const ebP = settleProgress(frame, 8)
  const list = (bullets || []).filter((b) => b && b.text).slice(0, 4)

  return (
    <AbsoluteFill style={{ backgroundColor: theme.ink, overflow: 'hidden' }}>
      {/* Right: cinematic image, graded. */}
      {image ? (
        <AbsoluteFill style={{ transform: `scale(${scale})` }}>
          <Img src={staticFile(image)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </AbsoluteFill>
      ) : (
        <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 70% 40%, ${theme.inkSoft} 0%, ${theme.ink} 75%)` }} />
      )}
      <CinematicGrade accent={theme.accents[0]} intensity={1.5} />
      {/* Left-side darkening so the panel always reads. */}
      <AbsoluteFill style={{ background: 'linear-gradient(90deg, rgba(4,7,12,0.92) 0%, rgba(4,7,12,0.72) 38%, transparent 62%)' }} />

      {/* The glass panel with title + bullets. */}
      <AbsoluteFill style={{ flexDirection: 'column', justifyContent: 'center', padding: '0 0 0 120px' }}>
        <div style={{
          width: 880, maxWidth: '52%', opacity: Math.min(1, panelP * 1.4), transform: `translateX(${panelX}px)`,
          background: 'rgba(8,12,20,0.55)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.10)', borderRadius: 12,
          padding: '46px 52px', display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          {eyebrow ? (
            <div style={{ opacity: ebP, fontFamily: FONTS.body, fontWeight: 800, letterSpacing: 6, fontSize: TYPE.label * 0.8, color: accent, textTransform: 'uppercase', marginBottom: 4 }}>
              {eyebrow}
            </div>
          ) : null}

          <KineticText text={title} startFrame={10} fontFamily={FONTS.display} fontWeight={900} fontSize={TYPE.title * 0.7} color="#FFFFFF" accentColor={accent} accentWordIndex={accentWordIndex} align="left" lineHeight={1.02} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 22 }}>
            {list.map((b, i) => {
              const start = 24 + i * Math.round(0.18 * fps)
              const rise = spring({ frame: frame - start, fps, config: { damping: 16, stiffness: 120, mass: 0.8 } })
              const countP = interpolate(frame, [start, start + Math.round(1.0 * fps)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
              return (
                <div key={i} style={{ opacity: Math.min(1, rise * 1.5), transform: `translateY(${(1 - rise) * 18}px)`, display: 'flex', alignItems: 'baseline', gap: 16 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: accent, flexShrink: 0, transform: 'translateY(-2px)', boxShadow: `0 0 10px ${accent}` }} />
                  <div style={{ fontFamily: FONTS.body, fontWeight: 500, fontSize: TYPE.body * 0.6, color: '#EAF1FB', lineHeight: 1.3, flex: 1 }}>
                    {b.text}
                    {b.value ? (
                      <span style={{ fontFamily: FONTS.display, fontWeight: 900, color: accent, marginLeft: 10, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
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
