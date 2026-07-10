import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion'
import { loadFont as loadMont } from '@remotion/google-fonts/Montserrat'
import { loadFont as loadSans } from '@remotion/google-fonts/SourceSans3'
import { EASE } from '../motion/MotionKit'

const { fontFamily: MONT } = loadMont()
const { fontFamily: SANS } = loadSans()
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export type Palette = { bg: string; accent: string; accent2: string; text: string }

// --- Contrast guard: never let dark text land on a dark background. ---
// Relative luminance (WCAG-ish) of a hex color, 0 (black) .. 1 (white).
export const lum = (hex: string): number => {
  const m = String(hex || '').match(/[0-9a-fA-F]{6}/); const n = m ? m[0] : ''; if (n.length < 6) return 0.5
  const c = [0, 2, 4].map((i) => { let v = parseInt(n.slice(i, i + 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.4361 * c[2]
}
const contrast = (a: string, b: string) => { const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x); return (l1 + 0.05) / (l2 + 0.05) }
// Return `fg` if it reads on `bg` (contrast ≥ 3.5), else the palette's guaranteed
// legible text color, else white/near-black — whichever wins. Small UI text must
// always clear this; it's the fix for "dark label on dark background".
export const legibleOn = (fg: string, bg: string, palette: Palette): string => {
  if (contrast(fg, bg) >= 3.5) return fg
  if (contrast(palette.text, bg) >= 3.5) return palette.text
  return lum(bg) < 0.4 ? '#f6f3ea' : '#12161f'
}

// A count-up money/number figure that eases to its value and lands on a beat.
export const CountUp: React.FC<{ value: number; prefix?: string; suffix?: string; label?: string; at?: number; palette: Palette; size?: number; color?: string }> =
({ value, prefix = '', suffix = '', label, at = 0, palette, size = 150, color }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const p = EASE.expoOut(clamp((frame - at) / (1.6 * fps), 0, 1))
  const shown = Math.round(value * p)
  const s = spring({ frame: frame - at, fps, config: { damping: 15, stiffness: 140 } })
  return (
    <div style={{ textAlign: 'center', opacity: s, transform: `translateY(${(1 - s) * 24}px)` }}>
      <div style={{ fontFamily: MONT, fontWeight: 800, fontSize: size, color: color || palette.text, letterSpacing: '-0.01em', textShadow: '0 3px 26px rgba(0,0,0,0.6)', lineHeight: 1 }}>
        {prefix}{shown.toLocaleString('en-US')}{suffix}
      </div>
      {label && <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: size * 0.22, letterSpacing: '0.22em', color: legibleOn(palette.accent, palette.bg, palette), marginTop: 18, textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}>{label.toUpperCase()}</div>}
    </div>
  )
}

// The IUL growth line chart: policy cash value climbing, S&P reference line, and
// the flat 0% floor. Lines DRAW progressively left-to-right; a marker rides the
// leading edge; the highlighted year annotation pops when the draw reaches it.
export type Series = { name: string; color: string; points: [number, number][]; dashed?: boolean; width?: number; area?: boolean }
export const LineChart: React.FC<{
  series: Series[]; xMax: number; yMax: number; palette: Palette; at?: number; drawFrames?: number
  xTicks?: number[]; xLabel?: string; annotate?: { x: number; y: number; label: string; value: string }
}> = ({ series, xMax, yMax, palette, at = 0, drawFrames = 70, xTicks = [], xLabel, annotate }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const W = 1360, H = 620, PADL = 40, PADB = 70, PADT = 30, PADR = 40
  const iw = W - PADL - PADR, ih = H - PADT - PADB
  const sx = (x: number) => PADL + (x / xMax) * iw
  const sy = (y: number) => PADT + ih - (y / yMax) * ih
  const draw = clamp((frame - at) / drawFrames, 0, 1) // 0..1 progress along x
  const enter = spring({ frame: frame - at, fps, config: { damping: 18, stiffness: 120 } })

  // build a partial polyline up to `draw` fraction of xMax (interpolating the
  // last segment so the line grows smoothly, not point-by-point).
  const partial = (pts: [number, number][]) => {
    const xCut = draw * xMax
    const out: [number, number][] = []
    for (let i = 0; i < pts.length; i++) {
      const [px, py] = pts[i]
      if (px <= xCut) { out.push([px, py]); continue }
      const [ax, ay] = pts[i - 1] ?? pts[i]
      if (px > xCut && ax <= xCut) { const t = (xCut - ax) / (px - ax || 1); out.push([xCut, ay + (py - ay) * t]) }
      break
    }
    return out
  }
  const path = (pts: [number, number][]) => pts.map((p, i) => `${i ? 'L' : 'M'} ${sx(p[0])} ${sy(p[1])}`).join(' ')
  const annX = annotate ? sx(annotate.x) : 0, annY = annotate ? sy(annotate.y) : 0
  const annReached = annotate ? draw * xMax >= annotate.x - 0.01 : false
  const annPop = annotate ? spring({ frame: frame - at - (annotate.x / xMax) * drawFrames, fps, config: { damping: 14, stiffness: 150 } }) : 0

  return (
    <div style={{ opacity: enter, transform: `translateY(${(1 - enter) * 30}px)` }}>
      <svg width={W} height={H} style={{ overflow: 'visible' }}>
        {/* subtle grid baseline */}
        <line x1={PADL} y1={sy(0)} x2={W - PADR} y2={sy(0)} stroke={palette.text} strokeOpacity={0.25} strokeWidth={2} />
        {xTicks.map((t) => (
          <g key={t}>
            <line x1={sx(t)} y1={sy(0)} x2={sx(t)} y2={sy(0) + 10} stroke={palette.text} strokeOpacity={0.4} strokeWidth={2} />
            <text x={sx(t)} y={sy(0) + 40} fill={palette.text} fillOpacity={0.7} fontFamily={SANS} fontWeight={700} fontSize={26} textAnchor="middle">{t}</text>
          </g>
        ))}
        {xLabel && <text x={PADL + iw / 2} y={H + 6} fill={palette.accent} fontFamily={SANS} fontWeight={800} fontSize={24} letterSpacing={6} textAnchor="middle">{xLabel}</text>}

        {series.map((s, i) => {
          const pts = partial(s.points)
          if (pts.length < 1) return null
          const d = path(pts)
          const last = pts[pts.length - 1]
          return (
            <g key={i}>
              {s.area && pts.length > 1 && (
                <path d={`${d} L ${sx(last[0])} ${sy(0)} L ${sx(pts[0][0])} ${sy(0)} Z`} fill={s.color} fillOpacity={0.14} />
              )}
              <path d={d} fill="none" stroke={s.color} strokeWidth={s.width ?? 6} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={s.dashed ? '2 14' : undefined} />
              {/* leading marker */}
              {draw < 1 && <circle cx={sx(last[0])} cy={sy(last[1])} r={9} fill={s.color} />}
              {/* end-of-line label — skip when an annotation callout sits at this
                  same end point (it would overlap); the floor line labels inline. */}
              {draw >= 0.98 && !(annotate && Math.abs(last[0] - annotate.x) < 0.01 && !s.dashed) &&
                <text x={sx(last[0]) + 14} y={sy(last[1]) + 8} fill={s.color} fontFamily={SANS} fontWeight={800} fontSize={26}>{s.name}</text>}
            </g>
          )
        })}

        {/* annotation callout — placed to the RIGHT of the point and vertically
            centered on it, so it never collides with the scene title above the
            chart. If the point is far right, flip the box to the left. */}
        {annotate && annReached && (() => {
          const flip = annX > PADL + iw * 0.6
          const boxW = 330, boxH = 128, gap = 46
          const bx = flip ? annX - gap - boxW : annX + gap
          const by = clamp(annY - boxH / 2, PADT, PADT + ih - boxH)
          return (
            <g style={{ opacity: annPop }}>
              <circle cx={annX} cy={annY} r={11} fill={palette.text} stroke={palette.accent} strokeWidth={4} />
              <line x1={annX} y1={annY} x2={flip ? bx + boxW : bx} y2={by + boxH / 2} stroke={palette.accent} strokeWidth={3} />
              <g transform={`translate(${bx}, ${by})`}>
                <rect x={0} y={0} width={boxW} height={boxH} rx={10} fill={palette.text} />
                <text x={boxW / 2} y={42} fill={palette.bg} fontFamily={SANS} fontWeight={800} fontSize={22} letterSpacing={2} textAnchor="middle">{annotate.label.toUpperCase()}</text>
                <text x={boxW / 2} y={98} fill={palette.bg} fontFamily={MONT} fontWeight={800} fontSize={50} textAnchor="middle">{annotate.value}</text>
              </g>
            </g>
          )
        })()}
      </svg>
    </div>
  )
}

// A grouped bar comparison (e.g. premium paid vs. illustrated value). Bars grow up.
export const BarPair: React.FC<{ bars: { label: string; value: number; color: string }[]; yMax: number; palette: Palette; at?: number; unit?: string }> =
({ bars, yMax, palette, at = 0, unit = '$' }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const H = 560, BW = 200, GAP = 120
  const totalW = bars.length * BW + (bars.length - 1) * GAP
  return (
    <svg width={totalW} height={H + 90} style={{ overflow: 'visible' }}>
      {bars.map((b, i) => {
        const gp = EASE.expoOut(clamp((frame - at - i * 6) / (1.2 * fps), 0, 1))
        const bh = (b.value / yMax) * H * gp
        const x = i * (BW + GAP)
        const shown = Math.round(b.value * gp)
        return (
          <g key={i}>
            <rect x={x} y={H - bh} width={BW} height={bh} rx={8} fill={b.color} />
            <text x={x + BW / 2} y={H - bh - 22} fill={palette.text} fontFamily={MONT} fontWeight={800} fontSize={40} textAnchor="middle">{unit}{shown.toLocaleString('en-US')}</text>
            <text x={x + BW / 2} y={H + 44} fill={palette.text} fillOpacity={0.85} fontFamily={SANS} fontWeight={700} fontSize={28} textAnchor="middle">{b.label}</text>
          </g>
        )
      })}
    </svg>
  )
}
