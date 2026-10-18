import { useCurrentFrame, useVideoConfig, spring, interpolate, Easing } from 'remotion'
import { FONTS, roles, type Theme } from '../tokens'
import { Fit } from '../lib/fit'
import { TightFit } from './TightFit'

/**
 * HeroMetric — ONE enormous figure, the signature of the reference "benchmark"
 * graphics ($0.019 / 594 / 2-3×). A giant gradient-filled value springs up,
 * an ALL-CAPS label sits beneath it, and an optional caption supports it. This
 * is the "one hero number per slide" rule that makes data slides land hard.
 *
 * Placed on the LEFT third by the scene (the right side carries supporting
 * content or the continuous backdrop), echoing the reference composition.
 */
export const HeroMetric: React.FC<{
  value: string
  label?: string
  caption?: string
  tone?: 'hero' | 'neutral' | 'warn'
  theme: Theme
  /** Widest the figure may render — long values scale DOWN to fit, never clip. */
  maxWidth?: number
}> = ({ value, label, caption, tone = 'hero', theme, maxWidth = 1560 }) => {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  const r = roles(theme)
  const color = tone === 'neutral' ? r.neutral : tone === 'warn' ? r.warn : r.hero

  // Fit-to-width: a short "2-3×" still lands at the full 320px, but a long
  // "$176,204.18" shrinks until it fits — the number must NEVER clip at the
  // frame edge. Measured on the real rendered text in the real font (the old
  // fitText reading could be taken before the font loaded). A value that is a
  // phrase ("Help 1,000 people become millionaires") may take two lines, so it
  // stays big instead of shrinking to one thin line.
  const rise = spring({ frame: f - 6, fps, config: { damping: 18, stiffness: 120, mass: 1 } })
  const labelP = interpolate(f, [14, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  const capP = interpolate(f, [22, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })

  // The figure gets a warm-to-bright vertical gradient fill (clipped to text),
  // exactly like the reference's "2-3×" and "$0.019".
  const fill = `linear-gradient(180deg, ${color} 0%, ${lighten(color, 0.35)} 100%)`

  return (
    // width 100% (capped at maxWidth): every line below fits inside this width.
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%', maxWidth }}>
      {/* small kicker label ABOVE the number ("YOU'RE OVERPAYING BY") */}
      {caption ? (
        <div style={{ width: '100%', opacity: capP, transform: `translateY(${(1 - capP) * 10}px)`, marginBottom: 8 }}>
          {/* lineHeight 1.1 = Archivo's own "normal", written out so <Fit> can count lines. */}
          <Fit max={40} min={22} lines={2} style={{ fontFamily: FONTS.display, fontWeight: 800, lineHeight: 1.1, letterSpacing: 1, color: theme.textMuted, textTransform: 'uppercase' }}>
            {caption}
          </Fit>
        </div>
      ) : null}

      {/* THE NUMBER — enormous, gradient-filled, springy entrance. At most two
          lines and 300px tall, so caption + number + label always fit the frame. */}
      <div style={{ width: '100%', opacity: Math.min(1, rise * 1.3), transform: `translateY(${(1 - rise) * 36}px)` }}>
        <TightFit text={value} max={320} min={90} lines={2} maxHeight={300} lineHeight={0.9} style={{
          fontFamily: FONTS.display, fontWeight: 900,
          letterSpacing: '-0.03em',
          backgroundImage: fill, WebkitBackgroundClip: 'text', backgroundClip: 'text',
          WebkitTextFillColor: 'transparent', color: 'transparent',
          filter: `drop-shadow(0 0 60px ${hexA(color, 0.45)})`,
        }} />
      </div>

      {/* label UNDER the number ("on every coding task tested") */}
      {label ? (
        <div style={{ width: '100%', opacity: labelP, transform: `translateY(${(1 - labelP) * 12}px)`, marginTop: 10 }}>
          <TightFit text={label} max={54} min={30} lines={3} lineHeight={1.05} style={{ fontFamily: FONTS.display, fontWeight: 800, color: theme.textPrimary }} />
        </div>
      ) : null}
    </div>
  )
}

function hexA(hex: string, a: number): string {
  const h = hex.replace('#', '')
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const r = parseInt(n.slice(0, 2), 16) || 0
  const g = parseInt(n.slice(2, 4), 16) || 0
  const b = parseInt(n.slice(4, 6), 16) || 0
  return `rgba(${r},${g},${b},${a})`
}

function lighten(hex: string, amt: number): string {
  const h = hex.replace('#', '')
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const r = Math.min(255, Math.round((parseInt(n.slice(0, 2), 16) || 0) + 255 * amt))
  const g = Math.min(255, Math.round((parseInt(n.slice(2, 4), 16) || 0) + 255 * amt))
  const b = Math.min(255, Math.round((parseInt(n.slice(4, 6), 16) || 0) + 255 * amt))
  return `rgb(${r},${g},${b})`
}
