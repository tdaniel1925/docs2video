import { useCurrentFrame, useVideoConfig, spring } from 'remotion'
import { TEXT_SHADOW } from './tokens'

/**
 * Word-by-word kinetic reveal that PERFORMS: each word springs up (with a slight
 * overshoot) + un-blurs + fades in, staggered. The accent word gets an extra
 * scale-punch just after it lands so it pops on its beat. Reads as produced
 * motion graphics, not a fade-in.
 */
export const KineticText: React.FC<{
  text: string
  startFrame: number
  perWordFrames?: number
  fontFamily: string
  fontWeight: number | string
  fontSize: number
  color: string
  accentColor?: string
  accentWordIndex?: number
  align?: 'left' | 'center' | 'right'
  lineHeight?: number
}> = ({ text, startFrame, perWordFrames = 2.5, fontFamily, fontWeight, fontSize, color, accentColor, accentWordIndex, align = 'left', lineHeight = 1.05 }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const words = text.split(' ')
  return (
    <div style={{ fontFamily, fontWeight, fontSize, lineHeight, textShadow: TEXT_SHADOW, letterSpacing: '-0.01em', textAlign: align }}>
      {words.map((w, i) => {
        const delay = startFrame + i * perWordFrames
        // Spring with overshoot for the rise (snappy, alive) ...
        const s = spring({ frame: frame - delay, fps, config: { damping: 13, stiffness: 150, mass: 0.7 } })
        // ... and a separate fade/un-blur (clamped, no overshoot on opacity).
        const p = Math.max(0, Math.min(1, s))
        const isAccent = accentWordIndex === i && !!accentColor
        // Accent word: an extra scale-punch that peaks ~6 frames after it lands.
        const punch = isAccent ? spring({ frame: frame - (delay + 6), fps, config: { damping: 9, stiffness: 200, mass: 0.6 } }) : 0
        const punchScale = isAccent ? 1 + 0.12 * Math.max(0, punch) * (1 - Math.max(0, (punch - 1) * 2)) : 1
        // Outer span owns LAYOUT (fixed width via the word), inner span owns the
        // scale-punch — so the punch never changes spacing or collides with the
        // next word. translateY (rise) is safe on the outer; scale on the inner.
        // Explicit per-word right margin guarantees the space between words
        // (flex `gap` was rendering as zero at this size). Last word: no margin.
        const isLast = i === words.length - 1
        // inline-block word + a literal non-breaking space text node after it.
        // A real   between inline-blocks always renders a gap (no flex/gap
        // quirk, no zero-width spacer span ambiguity).
        return (
          <span key={i}>
            <span style={{
              display: 'inline-block', opacity: p,
              transform: `translateY(${(1 - s) * 26}px) scale(${punchScale})`,
              transformOrigin: 'center bottom',
              filter: `blur(${(1 - p) * 6}px)`, color: isAccent ? accentColor : color, marginRight: isLast ? 0 : '0.3em',
            }}>
              {w}
            </span>
            {!isLast ? ' ' : ''}
          </span>
        )
      })}
    </div>
  )
}
