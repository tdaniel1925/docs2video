import { AbsoluteFill, useCurrentFrame, random } from 'remotion'

/**
 * Floating particle + light-streak layer for cinematic depth. Deterministic
 * (seeded), drifts slowly upward. Sits between the background and content.
 */
export const Particles: React.FC<{ accent: string; count?: number }> = ({ accent, count = 40 }) => {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {Array.from({ length: count }).map((_, i) => {
        const x = random(`px${i}`) * 100
        const baseY = random(`py${i}`) * 100
        const size = 1.5 + random(`ps${i}`) * 4
        const speed = 0.02 + random(`pv${i}`) * 0.05
        const y = (baseY - frame * speed) % 110
        const yy = y < 0 ? y + 110 : y
        const tw = 0.3 + 0.7 * Math.abs(Math.sin((frame + i * 20) / 40))
        return (
          <div key={i} style={{
            position: 'absolute', left: `${x}%`, top: `${yy}%`,
            width: size, height: size, borderRadius: '50%',
            background: accent, opacity: 0.12 * tw,
            boxShadow: `0 0 ${size * 3}px ${accent}`,
          }} />
        )
      })}
    </AbsoluteFill>
  )
}
