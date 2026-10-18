import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig, spring, interpolate, Easing } from 'remotion'
import { staticFile } from '../lib/asset'
import { FONTS, TYPE, type Theme } from '../tokens'
import { settleProgress } from '../helpers'
import { KineticText } from '../KineticText'
import { CinematicGrade } from './CinematicGrade'
import { FilmOverlay } from '../FilmOverlay'
import { parseMetric, renderMetric } from '../components/infographic/format'
import { FitBox } from '../lib/fit'

/**
 * "PowerPoint-on-cinematic" layout: a dark frosted-glass panel on the LEFT holds
 * the title + bullet points (each with its number when present); the cinematic
 * image fills the RIGHT. Premium explainer look — readable structured content
 * without losing the imagery. Used for scenes that have bullets/metrics.
 */
export type SlideBullet = { text: string; value?: string }

/** Longest word (in letters) that may be the coloured "accent" word. */
const ACCENT_MAX_CHARS = 13

/**
 * Which title word gets the accent colour. Same choice KineticText makes on
 * its own (a word with a number, else the longest word) — except it skips
 * words longer than ACCENT_MAX_CHARS. The accent word settles at 112% size, so
 * a word long enough to fill the line would stick out past the panel's edge.
 * -1 = no accent (every word too long).
 */
function panelAccent(title: string): number {
  const words = title.split(' ')
  const ok = (w: string) => w.length <= ACCENT_MAX_CHARS
  const num = words.findIndex((w) => /[\d$%]/.test(w))
  if (num >= 0 && ok(words[num])) return num
  let best = -1, bestLen = 0
  words.forEach((w, i) => { const l = w.replace(/[^a-z0-9]/gi, '').length; if (ok(w) && l > bestLen) { bestLen = l; best = i } })
  if (best >= 0) return best
  return words.length && ok(words[words.length - 1]) ? words.length - 1 : -1
}

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

      {/* The glass panel with title + bullets. It hugs its content as before,
          but lives in a fixed 900px-tall box (between the letterbox bars): if
          the content is taller or wider than that, the WHOLE panel scales
          down together (FitBox) and its lines re-wrap — nothing is cut off.
          The slide-in motion sits on the box, outside FitBox, so the fit is
          measured on the still panel and doesn't change frame to frame. */}
      <AbsoluteFill style={{ flexDirection: 'column', justifyContent: 'center', padding: '0 0 0 110px' }}>
        <div style={{
          width: 1000, maxWidth: '56%', height: 900, flexShrink: 0,
          opacity: Math.min(1, panelP * 1.4), transform: `translateX(${panelX}px)`,
        }}>
          <FitBox valign="center" minScale={0.6}>
            <div style={{
              width: '100%',
              background: 'rgba(8,12,20,0.58)', backdropFilter: 'blur(14px)',
              border: '1px solid rgba(255,255,255,0.10)', borderRadius: 12,
              padding: veryDense ? '40px 56px' : '60px 64px', display: 'flex', flexDirection: 'column',
              // The words' and bullets' rise-in motion stays inside the panel's
              // own padding; clipping it vertically keeps that motion from
              // counting as extra height while the fit is measured. Sideways
              // stays visible so a too-wide word is still measured (and shrunk).
              overflowX: 'visible', overflowY: 'clip',
            }}>
              {eyebrow ? (
                <div style={{ opacity: ebP, fontFamily: FONTS.body, fontWeight: 800, letterSpacing: 7, fontSize: TYPE.label * 0.95, color: accent, textTransform: 'uppercase', marginBottom: 18, overflowWrap: 'anywhere' }}>
                  {eyebrow}
                </div>
              ) : null}

              {/* A single word wider than the panel (a URL, a giant compound)
                  breaks onto the next line rather than shrinking the whole panel
                  to fit it. Words that fit are never broken. */}
              <div style={{ overflowWrap: 'anywhere' }}>
                <KineticText text={title} startFrame={10} fontFamily={FONTS.display} fontWeight={900} fontSize={TYPE.title * titleScale} color="#FFFFFF" accentColor={accent} accentWordIndex={accentWordIndex ?? panelAccent(title)} align="left" lineHeight={1.06} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: bulletGap, marginTop: listTop }}>
                {list.map((b, i) => {
                  const start = 24 + i * Math.round(0.18 * fps)
                  const rise = spring({ frame: frame - start, fps, config: { damping: 16, stiffness: 120, mass: 0.8 } })
                  const countP = interpolate(frame, [start, start + Math.round(1.0 * fps)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
                  const parsed = b.value ? parseMetric(b.value) : null
                  return (
                    <div key={i} style={{ opacity: Math.min(1, rise * 1.5), transform: `translateY(${(1 - rise) * 18}px)`, display: 'flex', alignItems: 'baseline', gap: 20 }}>
                      <div style={{ width: 12, height: 12, borderRadius: 3, background: accent, flexShrink: 0, transform: 'translateY(-3px)', boxShadow: `0 0 10px ${accent}` }} />
                      <div style={{ fontFamily: FONTS.body, fontWeight: 500, fontSize: TYPE.body * bodyScale, color: '#EAF1FB', lineHeight: 1.32, flex: 1, overflowWrap: 'anywhere', minWidth: 0 }}>
                        {b.text}
                        {parsed ? (
                          // The value keeps to one line when it fits, and wraps
                          // inside the panel when it's a long phrase. Its space is
                          // held by the FINAL value (invisible), with the counting
                          // number drawn on top — so the layout doesn't move.
                          <span style={{ display: 'inline-block', position: 'relative', maxWidth: '100%', marginLeft: 12, fontFamily: FONTS.display, fontWeight: 900, color: accent, fontVariantNumeric: 'tabular-nums' }}>
                            <span style={{ visibility: 'hidden' }}>{renderMetric(parsed, 1)}</span>
                            <span style={{ position: 'absolute', left: 0, top: 0, width: '100%' }}>{renderMetric(parsed, countP)}</span>
                          </span>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </FitBox>
        </div>
      </AbsoluteFill>

      <FilmOverlay accent={accent} letterbox grain={0.07} />
    </AbsoluteFill>
  )
}
