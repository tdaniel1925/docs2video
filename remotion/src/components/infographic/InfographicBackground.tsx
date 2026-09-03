import { AbsoluteFill, Img, useCurrentFrame, interpolate } from 'remotion'
import { staticFile } from '../../lib/asset'
import { type Theme } from '../../tokens'
import { Particles } from '../../v3/Particles'
import { drift } from '../../helpers'

/**
 * The shared backdrop for every Living-Infographic scene: the theme ground, a
 * faint engineering grid, a slow accent vignette, and drifting particles. This
 * replaces the Gemini photo of the cinematic theme — here the DATA is the
 * subject, so the background is quiet, deep, and motion-rich without competing.
 */
export const InfographicBackground: React.FC<{ theme: Theme; grid?: boolean; particles?: boolean; image?: string }> = ({
  theme, grid = true, particles = true, image,
}) => {
  const frame = useCurrentFrame()
  const gridColor = theme.mode === 'dark' ? 'rgba(255,255,255,0.045)' : 'rgba(20,40,80,0.05)'
  const glow = drift(frame, 300, 6)
  // Slow ambient drift on the bg image so it feels alive, not a static wallpaper.
  const imgScale = 1.05 + interpolate(frame % 600, [0, 600], [0, 0.04])
  return (
    <AbsoluteFill style={{ backgroundColor: theme.ink, overflow: 'hidden' }}>
      {/* Optional ambient image, HEAVILY darkened so charts/text stay legible. */}
      {image ? (
        <>
          <AbsoluteFill style={{ transform: `scale(${imgScale})` }}>
            <Img src={staticFile(image)} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.32 }} />
          </AbsoluteFill>
          {/* Darkening veil — keeps the data readable on top of the photo. */}
          <AbsoluteFill style={{ background: `linear-gradient(180deg, ${hexA(theme.ink, 0.78)} 0%, ${hexA(theme.ink, 0.88)} 100%)` }} />
        </>
      ) : null}
      {/* deep radial to give the flat ground dimension (lighter when an image is present) */}
      <AbsoluteFill style={{ background: `radial-gradient(130% 120% at 50% 30%, ${hexA(theme.inkSoft, image ? 0.5 : 1)} 0%, ${hexA(theme.ink, image ? 0.4 : 1)} 70%)` }} />
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
