import { useCurrentFrame } from 'remotion'
import { settleProgress } from './helpers'
import { TEXT_SHADOW } from './tokens'

/**
 * Word-by-word kinetic reveal: each word rises + un-blurs + fades in, staggered.
 * An optional `accentWord` (by index) is shown in the accent color.
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
}> = ({ text, startFrame, perWordFrames = 3, fontFamily, fontWeight, fontSize, color, accentColor, accentWordIndex, align = 'left', lineHeight = 1.05 }) => {
  const frame = useCurrentFrame()
  const words = text.split(' ')
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: `0 ${fontSize * 0.26}px`, justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start', fontFamily, fontWeight, fontSize, lineHeight, textShadow: TEXT_SHADOW, letterSpacing: '-0.01em' }}>
      {words.map((w, i) => {
        const p = settleProgress(frame, startFrame + i * perWordFrames)
        const isAccent = accentWordIndex === i && accentColor
        return (
          <span key={i} style={{ display: 'inline-block', opacity: p, transform: `translateY(${(1 - p) * 24}px)`, filter: `blur(${(1 - p) * 6}px)`, color: isAccent ? accentColor : color }}>
            {w}
          </span>
        )
      })}
    </div>
  )
}
