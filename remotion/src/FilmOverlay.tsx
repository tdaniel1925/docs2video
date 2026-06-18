import { AbsoluteFill, useCurrentFrame, interpolate, random } from 'remotion'
import { drift } from './helpers'

/**
 * Cinematic finishing layer: subtle film grain, an accent-colored light leak that
 * drifts, and optional cinemascope letterbox bars. Sits ABOVE everything.
 */
export const FilmOverlay: React.FC<{ accent: string; letterbox?: boolean; grain?: number }> = ({ accent, letterbox = true, grain = 0.06 }) => {
  const frame = useCurrentFrame()

  // Light leak — soft accent glow sweeping from a corner, slowly drifting.
  const lx = 88 + drift(frame, 240, 8)
  const ly = 14 + drift(frame, 300, 6)
  const leakOpacity = 0.10 + 0.05 * Math.abs(Math.sin(frame / 90))

  // Grain — a few re-seeded speckle layers (cheap, frame-varying).
  const seed = Math.floor(frame / 2)

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {/* light leak */}
      <AbsoluteFill style={{ background: `radial-gradient(45% 55% at ${lx}% ${ly}%, ${hexA(accent, leakOpacity)}, transparent 70%)`, mixBlendMode: 'screen' }} />
      {/* grain */}
      <AbsoluteFill style={{ opacity: grain, mixBlendMode: 'overlay', backgroundImage: grainGradient(seed), backgroundSize: '3px 3px' }} />
      {/* subtle edge vignette for focus */}
      <AbsoluteFill style={{ background: 'radial-gradient(130% 130% at 50% 50%, transparent 60%, rgba(0,0,0,0.45) 100%)' }} />
      {/* cinemascope bars */}
      {letterbox ? (
        <>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 90, background: '#000' }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 90, background: '#000' }} />
        </>
      ) : null}
    </AbsoluteFill>
  )
}

function grainGradient(seed: number): string {
  // tiny deterministic speckle using Remotion's seeded random
  const a = random(`g${seed}`) * 0.5
  const b = random(`h${seed}`) * 0.5
  return `radial-gradient(rgba(255,255,255,${a}) 0.5px, transparent 0.6px), radial-gradient(rgba(0,0,0,${b}) 0.5px, transparent 0.6px)`
}

function hexA(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

/** Fade-in helper for letterbox-aware scenes. */
export function sceneFade(frame: number, duration: number): number {
  return interpolate(frame, [0, 10, duration - 10, duration], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
}
