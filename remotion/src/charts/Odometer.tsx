import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion'
import { loadFont as loadMont } from '@remotion/google-fonts/Montserrat'
import { EASE } from '../motion/MotionKit'

const { fontFamily: MONT } = loadMont()
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

// Per-em width factors for the Odometer's OWN layout (must match the render below):
// each DIGIT cell is a fixed `size * 0.62`; separators/affixes render at natural
// text width. These let us compute the odometer's TRUE rendered width so auto-fit
// never clips (fitText measures plain kerning, which is narrower than the cells).
const OD_DIGIT = 0.62, OD_SEP = 0.30, OD_DOLLAR = 0.56, OD_PCT = 0.66, OD_CHAR = 0.58

/** True rendered width of the odometer for a given font `size` + value/affixes. */
export function odometerWidth(size: number, value: number, prefix = '', suffix = '', decimals?: number): number {
  const dp = decimals ?? (Number.isInteger(value) ? 0 : (value * 100 % 1 === 0 && value % 1 !== 0 ? 2 : 1))
  const shown = value.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })
  let w = 0
  for (const ch of shown) w += (ch === ',' || ch === '.') ? OD_SEP : OD_DIGIT
  const affix = (s: string) => { let a = 0; for (const ch of s) a += ch === '$' ? OD_DOLLAR : ch === '%' ? OD_PCT : OD_CHAR; return a }
  return (w + affix(prefix) + affix(suffix)) * size
}

/** Largest font size whose odometer fits `maxWidth`, capped at `cap`. */
export function fitOdometerSize(value: number, prefix = '', suffix = '', maxWidth = 400, cap = 130, decimals?: number): number {
  const unit = odometerWidth(1, value, prefix, suffix, decimals)   // width per 1px of size
  const fit = unit > 0 ? maxWidth / unit : cap
  return Math.max(24, Math.min(cap, Math.floor(fit)))
}

/**
 * Odometer — classy number reveal. Each digit lives on a vertical strip (0-9)
 * that ROLLS to its final value and settles, like a mechanical counter / the
 * odometer flip you asked for. Digits settle left-to-right with a slight stagger,
 * then a subtle overshoot-settle. Far more premium than a plain count-up fade.
 */
export const Odometer: React.FC<{
  value: number; at?: number; size?: number; color?: string; prefix?: string; suffix?: string; align?: 'center' | 'left'; decimals?: number
}> = ({ value, at = 0, size = 150, color = '#f6f3ea', prefix = '', suffix = '', align = 'center', decimals }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const local = frame - at
  // keep decimals if the value isn't a whole number (rates like 5.5%, 56.75)
  const dp = decimals ?? (Number.isInteger(value) ? 0 : (value * 100 % 1 === 0 && value % 1 !== 0 ? 2 : 1))
  const digits = value.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp }).split('') // commas + decimal point
  // The digit "cell" is taller than the glyph so ascenders/descenders never clip.
  const cellH = size * 1.34
  const rowH = cellH                         // each 0-9 row occupies one cell
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', fontFamily: MONT, fontWeight: 800, fontSize: size, color, letterSpacing: '-0.01em', lineHeight: 1, justifyContent: align === 'center' ? 'center' : 'flex-start', textShadow: '0 3px 26px rgba(0,0,0,0.5)' }}>
      {prefix && <span style={{ opacity: clamp(local / 6, 0, 1), display: 'inline-flex', alignItems: 'center', height: cellH }}>{prefix}</span>}
      {digits.map((ch, i) => {
        if (ch === ',' || ch === '.') return <span key={i} style={{ opacity: clamp((local - i * 2) / 6, 0, 1), display: 'inline-flex', alignItems: 'center', height: cellH }}>{ch}</span>
        const target = parseInt(ch, 10)
        const s = spring({ frame: local - i * 2.2, fps, config: { damping: 14, stiffness: 90, mass: 1 } })
        const turns = 2
        const rolled = (turns * 10 + target) * s
        const offset = (rolled % 10)
        return (
          <span key={i} style={{ display: 'inline-block', height: cellH, width: size * 0.62, overflow: 'hidden', position: 'relative' }}>
            <span style={{ position: 'absolute', top: 0, left: 0, right: 0, transform: `translateY(${-offset * rowH}px)` }}>
              {Array.from({ length: 11 }, (_, d) => (
                <span key={d} style={{ display: 'flex', height: rowH, alignItems: 'center', justifyContent: 'center' }}>{d % 10}</span>
              ))}
            </span>
          </span>
        )
      })}
      {suffix && <span style={{ opacity: clamp((local - digits.length * 2) / 6, 0, 1), display: 'inline-flex', alignItems: 'center', height: cellH }}>{suffix}</span>}
    </div>
  )
}
