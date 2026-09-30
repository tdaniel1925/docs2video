import { useCurrentFrame, useVideoConfig, spring } from 'remotion'
import { loadFont as loadMont } from '@remotion/google-fonts/Montserrat'
import { loadFont as loadSans } from '@remotion/google-fonts/SourceSans3'
import { EASE } from '../motion/MotionKit'
import { Fit } from '../lib/fit'

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
// The number and label shrink to the width they're given (lib/fit): the size is
// set by the FINAL value, so it doesn't grow while counting. Parent must have a
// bounded width.
export const CountUp: React.FC<{ value: number; prefix?: string; suffix?: string; label?: string; at?: number; palette: Palette; size?: number; color?: string }> =
({ value, prefix = '', suffix = '', label, at = 0, palette, size = 150, color }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const p = EASE.expoOut(clamp((frame - at) / (1.6 * fps), 0, 1))
  const shown = Math.round(value * p)
  const s = spring({ frame: frame - at, fps, config: { damping: 15, stiffness: 140 } })
  return (
    <div style={{ width: '100%', textAlign: 'center', opacity: s, transform: `translateY(${(1 - s) * 24}px)` }}>
      <Fit max={size} min={Math.round(size * 0.3)} lines={1} sizeFor={`${prefix}${Math.round(value).toLocaleString('en-US')}${suffix}`}
        style={{ fontFamily: MONT, fontWeight: 800, color: color || palette.text, letterSpacing: '-0.01em', textShadow: '0 3px 26px rgba(0,0,0,0.6)', lineHeight: 1.1 }}>
        {prefix}{shown.toLocaleString('en-US')}{suffix}
      </Fit>
      {label && (
        <Fit max={Math.round(size * 0.22)} min={14} lines={2}
          style={{ fontFamily: SANS, fontWeight: 700, letterSpacing: '0.22em', color: legibleOn(palette.accent, palette.bg, palette), marginTop: 18, textShadow: '0 2px 12px rgba(0,0,0,0.5)', lineHeight: 1.2 }}>
          {label.toUpperCase()}
        </Fit>
      )}
    </div>
  )
}

// The IUL growth line chart: policy cash value climbing, S&P reference line, and
// the flat 0% floor. Lines DRAW progressively left-to-right; a marker rides the
// leading edge; the highlighted year annotation pops when the draw reaches it.
//
// Every WORD is HTML laid out in bounded boxes (the series names in a legend
// under the plot, the axis label, the callout), so a long name wraps or shrinks
// instead of running off the chart. `width` sets the chart's width (default
// 1360, the original size); the plot scales to it, text keeps a readable size.
export type Series = { name: string; color: string; points: [number, number][]; dashed?: boolean; width?: number; area?: boolean }
export const LineChart: React.FC<{
  series: Series[]; xMax: number; yMax: number; palette: Palette; at?: number; drawFrames?: number
  xTicks?: number[]; xLabel?: string; annotate?: { x: number; y: number; label: string; value: string }
  width?: number
}> = ({ series, xMax, yMax, palette, at = 0, drawFrames = 70, xTicks = [], xLabel, annotate, width = 1360 }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const W = Math.round(width), H = Math.round(width * 620 / 1360)
  // text + padding scale for a smaller chart, but never below 75% (readable)
  const k = clamp(W / 1360, 0.75, 1)
  const PADL = 40 * k, PADB = 60 * k, PADT = 30 * k, PADR = 40 * k
  const iw = W - PADL - PADR, ih = H - PADT - PADB
  const sx = (x: number) => PADL + (x / (xMax || 1)) * iw
  const sy = (y: number) => PADT + ih - (clamp(y, 0, yMax) / (yMax || 1)) * ih
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
  const annPop = annotate ? spring({ frame: frame - at - (annotate.x / (xMax || 1)) * drawFrames, fps, config: { damping: 14, stiffness: 150 } }) : 0
  const tickSize = Math.round(26 * k)
  const legendSize = Math.round(24 * k)

  return (
    <div style={{ width: W, opacity: enter, transform: `translateY(${(1 - enter) * 30}px)` }}>
      <div style={{ position: 'relative', width: W, height: H }}>
        <svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
          {/* subtle grid baseline */}
          <line x1={PADL} y1={sy(0)} x2={W - PADR} y2={sy(0)} stroke={palette.text} strokeOpacity={0.25} strokeWidth={2} />
          {xTicks.map((t) => (
            <g key={t}>
              <line x1={sx(t)} y1={sy(0)} x2={sx(t)} y2={sy(0) + 10} stroke={palette.text} strokeOpacity={0.4} strokeWidth={2} />
              <text x={sx(t)} y={sy(0) + 14 + tickSize} fill={palette.text} fillOpacity={0.7} fontFamily={SANS} fontWeight={700} fontSize={tickSize} textAnchor="middle">{t}</text>
            </g>
          ))}
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
              </g>
            )
          })}
          {/* annotation callout — to the RIGHT of the point (flipped left near the
              right edge), vertically centred on it and kept inside the plot. It is
              drawn INSIDE the chart (a foreignObject), since it is part of it. */}
          {annotate && annReached && (() => {
            const { bx, boxW, by, boxH } = calloutBox(annX, annY, PADL, PADT, iw, ih, k)
            const flip = bx < annX
            return (
              <g style={{ opacity: annPop }}>
                <circle cx={annX} cy={annY} r={11} fill={palette.text} stroke={palette.accent} strokeWidth={4} />
                <line x1={annX} y1={annY} x2={flip ? bx + boxW : bx} y2={by + boxH / 2} stroke={palette.accent} strokeWidth={3} />
                <foreignObject x={bx} y={by} width={boxW} height={boxH}>
                  <div style={{ width: boxW, height: boxH, boxSizing: 'border-box', padding: `${Math.round(10 * k)}px ${Math.round(14 * k)}px`, borderRadius: 10, background: palette.text, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: Math.round(4 * k), textAlign: 'center' }}>
                    <Fit max={Math.round(22 * k)} min={14} lines={2} style={{ fontFamily: SANS, fontWeight: 800, letterSpacing: '0.09em', color: palette.bg, lineHeight: 1.15 }}>{annotate.label.toUpperCase()}</Fit>
                    <Fit max={Math.round(50 * k)} min={18} lines={1} style={{ fontFamily: MONT, fontWeight: 800, color: palette.bg, lineHeight: 1.1 }}>{annotate.value}</Fit>
                  </div>
                </foreignObject>
              </g>
            )
          })()}
        </svg>
      </div>
      {xLabel && (
        <Fit max={legendSize} min={14} lines={2} style={{ fontFamily: SANS, fontWeight: 800, letterSpacing: '0.25em', color: palette.accent, textAlign: 'center', lineHeight: 1.2, marginTop: Math.round(6 * k) }}>{xLabel}</Fit>
      )}
      {/* legend — the series names (these used to hang off the line ends, where
          a long name ran past the chart) */}
      {series.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: Math.round(34 * k), rowGap: Math.round(8 * k), marginTop: Math.round(14 * k), width: W }}>
          {series.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: Math.round(10 * k), maxWidth: '100%', minWidth: 0, opacity: clamp((draw - 0.9) * 10, 0, 1) }}>
              <div style={{ width: Math.round(30 * k), height: 0, borderTop: `${Math.max(3, Math.round(5 * k))}px ${s.dashed ? 'dotted' : 'solid'} ${s.color}`, flexShrink: 0 }} />
              <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: legendSize, lineHeight: 1.2, color: palette.text, opacity: 0.85, minWidth: 0, overflowWrap: 'anywhere' }}>{s.name}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Where the line chart's callout box sits: right of the point (left of it near the right edge), inside the plot. */
function calloutBox(annX: number, annY: number, PADL: number, PADT: number, iw: number, ih: number, k: number) {
  const boxW = Math.min(Math.round(330 * k), Math.round(iw * 0.45)), boxH = Math.round(128 * k), gap = Math.round(46 * k)
  const flip = annX > PADL + iw * 0.6
  const bx = clamp(flip ? annX - gap - boxW : annX + gap, PADL, PADL + iw - boxW)
  const by = clamp(annY - boxH / 2, PADT, Math.max(PADT, PADT + ih - boxH))
  return { bx, boxW, by, boxH }
}

// A grouped bar comparison (e.g. premium paid vs. illustrated value). Bars grow up.
// Each bar is a column of its own: its value above, its name below, both shrunk
// to the column's width (lib/fit), so neighbours never overlap and nothing runs
// off the ends. `width` / `height` size the chart (default: the original size).
export const BarPair: React.FC<{ bars: { label: string; value: number; color: string }[]; yMax: number; palette: Palette; at?: number; unit?: string; width?: number; height?: number }> =
({ bars, yMax, palette, at = 0, unit = '$', width, height = 560 }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const n = Math.max(1, bars.length)
  const natural = n * 320            // 200px bar + 120px of air, per bar
  const W = Math.round(width ?? natural)
  const colW = W / n
  const BW = Math.min(200, Math.round(colW * 0.72))
  const k = clamp(colW / 320, 0.7, 1)
  const valueSize = Math.round(40 * k), labelSize = Math.round(28 * k)
  const valueRow = Math.round(valueSize * 1.2 + 14)
  return (
    <div style={{ display: 'flex', width: W, alignItems: 'flex-start' }}>
      {bars.map((b, i) => {
        const gp = EASE.expoOut(clamp((frame - at - i * 6) / (1.2 * fps), 0, 1))
        const bh = clamp((b.value / (yMax || 1)) * height, 0, height) * gp
        const shown = Math.round(b.value * gp)
        return (
          <div key={i} style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: `0 ${Math.round(8 * k)}px`, boxSizing: 'border-box' }}>
            <div style={{ height: height + valueRow, width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' }}>
              <Fit max={valueSize} min={14} lines={1} sizeFor={`${unit}${Math.round(b.value).toLocaleString('en-US')}`}
                style={{ fontFamily: MONT, fontWeight: 800, color: palette.text, textAlign: 'center', lineHeight: 1.2, marginBottom: 14 }}>
                {unit}{shown.toLocaleString('en-US')}
              </Fit>
              <div style={{ width: BW, height: bh, borderRadius: 8, background: b.color, flexShrink: 0 }} />
            </div>
            <Fit max={labelSize} min={14} lines={2} style={{ fontFamily: SANS, fontWeight: 700, color: palette.text, opacity: 0.85, textAlign: 'center', lineHeight: 1.15, marginTop: Math.round(16 * k) }}>{b.label}</Fit>
          </div>
        )
      })}
    </div>
  )
}
