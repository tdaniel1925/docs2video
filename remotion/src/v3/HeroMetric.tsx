import { useCurrentFrame, useVideoConfig, spring, interpolate, Easing } from 'remotion'
import { fitText } from '@remotion/layout-utils'
import { FONTS, roles, type Theme } from '../tokens'

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
  // frame edge. 0.97 leaves breathing room for the -0.03em tracking.
  const { fontSize: fitted } = fitText({ text: value, withinWidth: maxWidth, fontFamily: FONTS.display, fontWeight: 900 })
  const valueSize = Math.min(320, fitted * 0.97)

  const rise = spring({ frame: f - 6, fps, config: { damping: 18, stiffness: 120, mass: 1 } })
  const labelP = interpolate(f, [14, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  const capP = interpolate(f, [22, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })

  // The figure gets a warm-to-bright vertical gradient fill (clipped to text),
  // exactly like the reference's "2-3×" and "$0.019".
  const fill = `linear-gradient(180deg, ${color} 0%, ${lighten(color, 0.35)} 100%)`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', maxWidth }}>
      {/* small kicker label ABOVE the number ("YOU'RE OVERPAYING BY") */}
      {caption ? (
        <div style={{ opacity: capP, transform: `translateY(${(1 - capP) * 10}px)`, fontFamily: FONTS.display, fontWeight: 800, fontSize: 40, letterSpacing: 1, color: theme.textMuted, textTransform: 'uppercase', marginBottom: 8 }}>
          {caption}
        </div>
      ) : null}

      {/* THE NUMBER — enormous, gradient-filled, springy entrance. */}
      <div style={{
        opacity: Math.min(1, rise * 1.3),
        transform: `translateY(${(1 - rise) * 36}px)`,
        fontFamily: FONTS.display, fontWeight: 900,
        fontSize: valueSize, lineHeight: 0.9, letterSpacing: '-0.03em',
        whiteSpace: 'nowrap',
        backgroundImage: fill, WebkitBackgroundClip: 'text', backgroundClip: 'text',
        WebkitTextFillColor: 'transparent', color: 'transparent',
        filter: `drop-shadow(0 0 60px ${hexA(color, 0.45)})`,
      }}>
        {value}
      </div>

      {/* label UNDER the number ("on every coding task tested") */}
      {label ? (
        <div style={{ opacity: labelP, transform: `translateY(${(1 - labelP) * 12}px)`, fontFamily: FONTS.display, fontWeight: 800, fontSize: 54, color: theme.textPrimary, marginTop: 10, lineHeight: 1.05 }}>
          {label}
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
