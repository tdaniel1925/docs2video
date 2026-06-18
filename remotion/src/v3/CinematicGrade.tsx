import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { drift } from '../helpers'

/**
 * Cinematic grading layer placed OVER the background image to turn a flat,
 * stock-looking photo into a film frame: brand-tinted color grade, lifted-shadow
 * + warm-highlight contrast, soft bloom, vignette, and subtle drifting light.
 * `accent` tints the shadows toward the brand color.
 */
export const CinematicGrade: React.FC<{ accent: string; warm?: string; intensity?: number }> = ({ accent, warm = '#FF8A3D', intensity = 1 }) => {
  const frame = useCurrentFrame()
  const bx = 30 + drift(frame, 360, 5)
  const by = 28 + drift(frame, 420, 4)

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {/* Brand-tinted shadows (multiply) — pushes the dark areas toward the brand color */}
      <AbsoluteFill style={{ background: accent, opacity: 0.16 * intensity, mixBlendMode: 'multiply' }} />
      {/* Warm highlight wash (screen) — filmic warmth in the brights */}
      <AbsoluteFill style={{ background: `radial-gradient(70% 70% at ${bx}% ${by}%, ${warm}, transparent 70%)`, opacity: 0.10 * intensity, mixBlendMode: 'screen' }} />
      {/* Contrast S-curve emulation: darken edges, lift center slightly */}
      <AbsoluteFill style={{ background: 'radial-gradient(135% 135% at 50% 45%, rgba(255,255,255,0.05) 0%, transparent 35%, rgba(0,0,0,0.5) 100%)' }} />
      {/* Soft bloom on brights */}
      <AbsoluteFill style={{ background: `radial-gradient(40% 40% at ${bx}% ${by}%, rgba(255,255,255,0.10), transparent 70%)`, mixBlendMode: 'screen', filter: 'blur(20px)', opacity: 0.6 * intensity }} />
    </AbsoluteFill>
  )
}
