import { AbsoluteFill, useCurrentFrame } from 'remotion'
import type { Theme } from './tokens'
import { drift } from './helpers'

/**
 * Dark ground with subtly drifting accent mesh glows — colors come from the
 * supplied theme, so the whole background re-skins with the brand.
 */
export const ThemedBackground: React.FC<{ theme: Theme; glowOnly?: boolean }> = ({ theme, glowOnly }) => {
  const frame = useCurrentFrame()
  const [a1, a2, a3] = theme.accents
  const x1 = 20 + drift(frame, 300, 6), y1 = 25 + drift(frame, 360, 5)
  const x2 = 80 + drift(frame, 340, 6), y2 = 70 + drift(frame, 300, 5)
  const x3 = 55 + drift(frame, 420, 7), y3 = 30 + drift(frame, 380, 6)
  const glow = theme.mode === 'dark' ? 0.18 : 0.1
  const vignette = theme.mode === 'dark' ? 0.55 : 0.12

  return (
    <AbsoluteFill style={{ backgroundColor: glowOnly ? 'transparent' : theme.ink }}>
      <AbsoluteFill
        style={{
          background: [
            `radial-gradient(40% 40% at ${x1}% ${y1}%, ${hexA(a1, glow)}, transparent 70%)`,
            `radial-gradient(45% 45% at ${x2}% ${y2}%, ${hexA(a2, glow + 0.02)}, transparent 70%)`,
            `radial-gradient(50% 50% at ${x3}% ${y3}%, ${hexA(a3, glow)}, transparent 70%)`,
          ].join(','),
          filter: 'blur(8px)',
        }}
      />
      {glowOnly ? null : <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 45%, transparent 55%, rgba(0,0,0,${vignette}) 100%)` }} />}
    </AbsoluteFill>
  )
}

function hexA(hex: string, a: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}
