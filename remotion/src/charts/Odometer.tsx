import { useCurrentFrame, useVideoConfig, spring } from 'remotion'
import { loadFont as loadMont } from '@remotion/google-fonts/Montserrat'
import { Fit } from '../lib/fit'

const { fontFamily: MONT } = loadMont()
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

// Per-em width factors for the Odometer's OWN layout (must match the render below):
// each DIGIT cell is a fixed `size * 0.62`; separators/affixes render at natural
// text width. These let us compute the odometer's TRUE rendered width so auto-fit
// never clips (fitText measures plain kerning, which is narrower than the cells).
const OD_DIGIT = 0.62, OD_SEP = 0.30, OD_DOLLAR = 0.56, OD_PCT = 0.66, OD_CHAR = 0.58
/** Digit cell size, in em of the odometer's own font size. */
const CELL_W = 0.62, CELL_H = 1.34

/**
 * How many decimals to show when the caller doesn't say. Whole numbers: none.
 * Up to two written decimals: two (5.5 → "5.50", 6.35 → "6.35"). More: one.
 *
 * Read from the number as WRITTEN, not from arithmetic: 6.35 * 100 is
 * 634.999…, so the old arithmetic test showed a 6.35% rate as "6.4%".
 */
export function autoDecimals(value: number): number {
  if (!Number.isFinite(value) || Number.isInteger(value)) return 0
  const s = String(value)
  if (/e/i.test(s)) return 1
  const written = (s.split('.')[1] || '').length
  return written <= 2 ? 2 : 1
}

/** True rendered width of the odometer for a given font `size` + value/affixes. */
export function odometerWidth(size: number, value: number, prefix = '', suffix = '', decimals?: number): number {
  const dp = decimals ?? autoDecimals(value)
  const shown = value.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })
  let w = 0
  for (const ch of shown) w += (ch === ',' || ch === '.') ? OD_SEP : OD_DIGIT
  const affix = (s: string) => { let a = 0; for (const ch of s) a += ch === '$' ? OD_DOLLAR : ch === '%' ? OD_PCT : OD_CHAR; return a }
  return (w + affix(prefix) + affix(suffix)) * size
}

/** Largest font size whose odometer fits `maxWidth`, capped at `cap`. (An estimate — prefer <FitOdometer>, which measures.) */
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
 *
 * Every dimension is in em of the counter's own font size, so `size` scales the
 * whole thing — or pass size="1em" and let a parent (<FitOdometer>) size it.
 * Only the digit rows actually inside a cell's window are drawn: a settled digit
 * is exactly one row, so no hidden digit sits cut off in the page.
 */
export const Odometer: React.FC<{
  value: number; at?: number; size?: number | string; color?: string; prefix?: string; suffix?: string; align?: 'center' | 'left'; decimals?: number
}> = ({ value, at = 0, size = 150, color = '#f6f3ea', prefix = '', suffix = '', align = 'center', decimals }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const local = frame - at
  // keep decimals if the value isn't a whole number (rates like 5.5%, 56.75)
  const dp = decimals ?? autoDecimals(value)
  const digits = value.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp }).split('') // commas + decimal point
  // The digit "cell" is taller than the glyph so ascenders/descenders never clip.
  const cellH = `${CELL_H}em`
  const staticCh = (ch: string, i: number) => <span key={i} style={{ opacity: clamp((local - i * 2) / 6, 0, 1), display: 'inline-flex', alignItems: 'center', height: cellH }}>{ch}</span>
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', fontFamily: MONT, fontWeight: 800, fontSize: size, color, letterSpacing: '-0.01em', lineHeight: 1, whiteSpace: 'nowrap', verticalAlign: 'top', justifyContent: align === 'center' ? 'center' : 'flex-start', textShadow: '0 3px 26px rgba(0,0,0,0.5)' }}>
      {prefix && <span style={{ opacity: clamp(local / 6, 0, 1), display: 'inline-flex', alignItems: 'center', height: cellH }}>{prefix}</span>}
      {digits.map((ch, i) => {
        const target = parseInt(ch, 10)
        if (Number.isNaN(target)) return staticCh(ch, i)   // , . or a minus sign
        const s = spring({ frame: local - i * 2.2, fps, config: { damping: 14, stiffness: 90, mass: 1 } })
        const turns = 2
        const rolled = (turns * 10 + target) * s
        const offset = rolled % 10
        const lo = Math.floor(offset), frac = offset - lo
        // the one or two rows showing in the window right now
        const rows = frac < 0.02 ? [lo] : frac > 0.98 ? [lo + 1] : [lo, lo + 1]
        const rolling = rows.length > 1
        return (
          <span key={i}
            // Mid-roll, two digits share the window and are cut by it on purpose.
            data-overflow-ok={rolling ? 'odometer digit rolling through its window' : undefined}
            // The window clips UP/DOWN only (that is the roll). Sideways the glyph
            // may be a hair wider than its cell ("0", "4" in heavy weights); it
            // shows whole rather than having its edges shaved.
            style={{ display: 'inline-block', height: cellH, width: `${CELL_W}em`, overflowX: 'visible', overflowY: 'clip', position: 'relative' }}>
            {rows.map((d) => (
              // A heavy digit's letter box (~0.69em) is wider than its 0.62em cell,
              // so side-by-side digits' boxes overlapped. Tighter letter-spacing
              // trims the box (not the glyph); the nudge left keeps the glyph centred.
              <span key={d} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: cellH, display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '-0.08em', transform: `translate(-0.04em, ${(d - offset) * CELL_H}em)` }}>{d % 10}</span>
            ))}
          </span>
        )
      })}
      {suffix && <span style={{ opacity: clamp((local - digits.length * 2) / 6, 0, 1), display: 'inline-flex', alignItems: 'center', height: cellH }}>{suffix}</span>}
    </div>
  )
}

/**
 * An Odometer that is as big as `max` but never wider than its parent: the
 * REAL rendered counter is measured (lib/fit) and the font shrinks until it
 * fits. The parent must have a bounded width.
 */
export const FitOdometer: React.FC<{
  value: number; at?: number; max: number; min?: number; color?: string; prefix?: string; suffix?: string; decimals?: number; align?: 'center' | 'left'
}> = ({ value, at, max, min, color, prefix, suffix, decimals, align = 'center' }) => (
  <Fit max={max} min={min} style={{ lineHeight: 1, textAlign: align }}>
    <Odometer value={value} at={at} size="1em" color={color} prefix={prefix} suffix={suffix} decimals={decimals} align={align} />
  </Fit>
)
