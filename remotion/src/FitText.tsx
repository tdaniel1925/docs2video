import { fitText } from '@remotion/layout-utils'
import { MIN_VIDEO_FONT } from './tokens'

/**
 * Renders text as large as possible to fill `maxWidth`, but capped at `idealSize`
 * and never below MIN_VIDEO_FONT — so titles are always readable on video and
 * never overflow their box. Deterministic (measured at render time).
 */
export const FitText: React.FC<{
  text: string
  idealSize: number
  maxWidth: number
  fontFamily: string
  fontWeight: number | string
  color: string
  style?: React.CSSProperties
  textAlign?: 'left' | 'center' | 'right'
}> = ({ text, idealSize, maxWidth, fontFamily, fontWeight, color, style, textAlign }) => {
  const { fontSize } = fitText({ text, withinWidth: maxWidth, fontFamily, fontWeight })
  const size = Math.max(MIN_VIDEO_FONT, Math.min(idealSize, fontSize))
  return (
    <div style={{ fontFamily, fontWeight, fontSize: size, color, textAlign, maxWidth, lineHeight: 1.05, ...style }}>
      {text}
    </div>
  )
}
