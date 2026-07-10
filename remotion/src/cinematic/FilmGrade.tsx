import { AbsoluteFill, useCurrentFrame } from 'remotion'

/**
 * FilmGrade — a single consistent finish layered over EVERY scene so distinct
 * Gemini backdrops feel like one film stock: a gentle teal-shadow / warm-highlight
 * grade, soft grain, edge vignette, and a faint top light. Cheap, huge cohesion.
 * Deterministic (frame-seeded) so renders are reproducible.
 */
const grainSVG = encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'>
    <filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter>
    <rect width='100%' height='100%' filter='url(#n)' opacity='0.5'/>
  </svg>`
)

export const FilmGrade: React.FC<{ accent?: string; intensity?: number }> = ({ accent = '#c8a15a', intensity = 1 }) => {
  const frame = useCurrentFrame()
  // grain shifts each frame so it shimmers like real film grain (not a static dot pattern)
  const gx = (frame * 7) % 160, gy = (frame * 13) % 160
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {/* color grade: lift shadows slightly cool, warm the highlights */}
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(20,30,45,0.10), rgba(0,0,0,0) 40%, rgba(30,20,8,0.10))', mixBlendMode: 'soft-light', opacity: 0.9 * intensity }} />
      {/* faint accent bloom top-center (the "key light") */}
      <AbsoluteFill style={{ background: `radial-gradient(1200px 500px at 50% -8%, ${accent}14, transparent 70%)`, mixBlendMode: 'screen', opacity: 0.5 * intensity }} />
      {/* cinematic vignette */}
      <AbsoluteFill style={{ background: 'radial-gradient(130% 130% at 50% 46%, transparent 55%, rgba(0,0,0,0.42))', opacity: intensity }} />
      {/* moving film grain */}
      <AbsoluteFill style={{ backgroundImage: `url("data:image/svg+xml,${grainSVG}")`, backgroundPosition: `${gx}px ${gy}px`, mixBlendMode: 'overlay', opacity: 0.05 * intensity }} />
    </AbsoluteFill>
  )
}
