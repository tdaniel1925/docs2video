import { useCurrentFrame, interpolate, Img, staticFile } from 'remotion'
import { FONTS, TYPE, type Theme } from './tokens'
import { settleProgress } from './helpers'

/** Animated number that counts up to a target. Keeps any suffix like "+" or "%". */
export const CountUp: React.FC<{
  value: number
  suffix?: string
  prefix?: string
  startFrame: number
  fontFamily?: string
  fontWeight?: number | string
  fontSize: number
  color: string
  glow?: string
}> = ({ value, suffix = '', prefix = '', startFrame, fontFamily = FONTS.display, fontWeight = 800, fontSize, color, glow }) => {
  const frame = useCurrentFrame()
  const p = settleProgress(frame, startFrame)
  const shown = Math.round(value * p)
  return (
    <span style={{ fontFamily, fontWeight, fontSize, color, lineHeight: 1, textShadow: glow ? `0 0 ${30 * p}px ${glow}` : undefined }}>
      {prefix}{shown.toLocaleString()}{suffix}
    </span>
  )
}

/** Progress chip like "4 OF 8". */
export const ProgressChip: React.FC<{ index: number; total: number; theme: Theme; startFrame?: number }> = ({ index, total, theme, startFrame = 0 }) => {
  const frame = useCurrentFrame()
  const p = settleProgress(frame, startFrame)
  return (
    <div style={{ opacity: p, transform: `translateX(${(1 - p) * -20}px)`, display: 'inline-flex', alignItems: 'center', gap: 12, fontFamily: FONTS.body, fontWeight: 800, fontSize: TYPE.label, letterSpacing: 3, color: theme.textPrimary }}>
      <span style={{ width: 6, height: 26, background: theme.accents[0], borderRadius: 2, boxShadow: `0 0 16px ${theme.accents[0]}` }} />
      <span style={{ color: theme.accents[0] }}>{String(index).padStart(2, '0')}</span>
      <span style={{ color: theme.textMuted }}>OF {String(total).padStart(2, '0')}</span>
    </div>
  )
}

/** Frosted glass card with a soft accent glow + animated rise. */
export const GlassCard: React.FC<{ theme: Theme; accent: string; prog: number; style?: React.CSSProperties; children: React.ReactNode }> = ({ theme, accent, prog, style, children }) => (
  <div style={{
    opacity: prog, transform: `translateY(${(1 - prog) * 50}px)`,
    background: theme.glass, border: `1px solid ${theme.glassEdge}`,
    borderRadius: 22, padding: '34px 30px', backdropFilter: 'blur(14px)',
    boxShadow: `0 24px 70px rgba(0,0,0,0.35), inset 0 0 ${40 * prog}px ${accent}14`,
    position: 'relative', overflow: 'hidden', ...style,
  }}>
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent, opacity: prog, boxShadow: `0 0 ${18 * prog}px ${accent}` }} />
    {children}
  </div>
)

/** Circular line-icon badge with accent ring + glow. */
export const IconBadge: React.FC<{ accent: string; size?: number; prog?: number; children: React.ReactNode }> = ({ accent, size = 72, prog = 1, children }) => (
  <div style={{ width: size, height: size, borderRadius: '50%', border: `2px solid ${accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 0 ${18 * prog}px ${accent}55`, background: `${accent}14` }}>
    {children}
  </div>
)

/** Mixed-weight headline: words reveal kinetically; the accent word is colored. */
export const Headline: React.FC<{
  text: string
  accentWordIndex?: number
  startFrame: number
  fontSize: number
  color: string
  accentColor: string
  fontFamily?: string
}> = ({ text, accentWordIndex, startFrame, fontSize, color, accentColor, fontFamily = FONTS.display }) => {
  const frame = useCurrentFrame()
  const words = text.split(' ')
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: `0 ${fontSize * 0.22}px`, fontFamily, fontWeight: 800, fontSize, lineHeight: 1.0 }}>
      {words.map((w, i) => {
        const p = settleProgress(frame, startFrame + i * 3)
        const isAccent = i === accentWordIndex
        return (
          <span key={i} style={{ display: 'inline-block', opacity: p, transform: `translateY(${(1 - p) * 22}px)`, filter: `blur(${(1 - p) * 5}px)`, color: isAccent ? accentColor : color, fontStyle: isAccent ? 'italic' : 'normal' }}>
            {w}
          </span>
        )
      })}
    </div>
  )
}

/** Diagonal photo panel (Ken Burns) clipped to one side with an accent-tinted scrim. */
export const DiagonalPhoto: React.FC<{ image: string; accent: string; side: 'right' | 'left'; durationInFrames: number }> = ({ image, accent, side, durationInFrames }) => {
  const frame = useCurrentFrame()
  const t = interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateRight: 'clamp' })
  const scale = 1.08 + t * 0.08
  const reveal = settleProgress(frame, 4)
  // Diagonal clip: photo occupies ~42% on the chosen side, cut on a slant.
  const clip = side === 'right'
    ? `polygon(${100 - 42 * reveal}% 0, 100% 0, 100% 100%, ${100 - 36 * reveal}% 100%)`
    : `polygon(0 0, ${42 * reveal}% 0, ${36 * reveal}% 100%, 0 100%)`
  return (
    <div style={{ position: 'absolute', inset: 0, clipPath: clip }}>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${scale})` }}>
        <Img src={staticFile(image)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(${side === 'right' ? 270 : 90}deg, transparent 30%, ${accent}33 80%, ${accent}66 100%)`, mixBlendMode: 'multiply' }} />
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(${side === 'right' ? 270 : 90}deg, rgba(0,0,0,0.65) 0%, transparent 45%)` }} />
    </div>
  )
}
