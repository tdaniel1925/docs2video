import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { type Theme } from '../../tokens'
import { Particles } from '../../v3/Particles'
import { drift } from '../../helpers'

/**
 * The shared backdrop for every Living-Infographic scene: the theme ground, a
 * faint engineering grid, a slow accent vignette, and drifting particles. This
 * replaces the Gemini photo of the cinematic theme — here the DATA is the
 * subject, so the background is quiet, deep, and motion-rich without competing.
 */
export const InfographicBackground: React.FC<{ theme: Theme; grid?: boolean; particles?: boolean }> = ({
  theme, grid = true, particles = true,
}) => {
  const frame = useCurrentFrame()
  const gridColor = theme.mode === 'dark' ? 'rgba(255,255,255,0.045)' : 'rgba(20,40,80,0.05)'
  const glow = drift(frame, 300, 6)
  return (
    <AbsoluteFill style={{ backgroundColor: theme.ink, overflow: 'hidden' }}>
      {/* deep radial to give the flat ground dimension */}
      <AbsoluteFill style={{ background: `radial-gradient(130% 120% at 50% 30%, ${theme.inkSoft} 0%, ${theme.ink} 70%)` }} />
      {grid ? (
        <AbsoluteFill style={{
          backgroundImage: `linear-gradient(${gridColor} 1px, transparent 1px), linear-gradient(90deg, ${gridColor} 1px, transparent 1px)`,
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(120% 100% at 50% 40%, black 35%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(120% 100% at 50% 40%, black 35%, transparent 80%)',
        }} />
      ) : null}
      {/* slow drifting accent vignette */}
      <AbsoluteFill style={{
        background: `radial-gradient(60% 60% at ${50 + glow}% ${35 + glow * 0.5}%, ${hexA(theme.accents[0], theme.mode === 'dark' ? 0.10 : 0.06)} 0%, transparent 60%)`,
      }} />
      {particles ? <Particles accent={theme.accents[0]} count={36} /> : null}
    </AbsoluteFill>
  )
}

function hexA(hex: string, a: number) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}
