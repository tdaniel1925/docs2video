import React from 'react'
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion'

/* ============================================================================
 * PAPER-CHART DEMO v2 — the RIGHT way to put readable numbers/charts on paper.
 *
 * Lesson from v1: I placed text blind over a FLUX paper image and it landed on
 * dark torn areas (unreadable). Fix: DON'T trust where the AI put the paper.
 * Instead draw a CONTROLLED cream paper panel in code (torn clip-path edges +
 * paper grain) at a KNOWN position, and put the chart + numbers INSIDE it. The
 * FLUX image is only a background texture. Everything readable is on a panel I
 * control, so contrast is guaranteed.
 * ==========================================================================*/

const FPS = 30
const NAVY = '#1e3a70'
const RED = '#c0272d'
const GREEN = '#2f7d4f'
const INK = '#23324a'
const CREAM = '#f4efe4'
const FONT = 'Archivo, Inter, system-ui, sans-serif'
export const PAPER_CHART_FRAMES = 8 * FPS

const SERIES = [33200, 33850, 33100, 34600, 35200, 34400, 36100, 35600, 37200, 38050, 37400, 38900, 39650, 38800, 40120, 41200]
const MINV = Math.min(...SERIES) - 400
const MAXV = Math.max(...SERIES) + 400

// the CODE-DRAWN paper panel — a known rectangle we control.
const PANEL = { x: 210, y: 150, w: 1500, h: 760 }
// chart plot box, INSIDE the panel with margins for labels
const PLOT = { x: PANEL.x + 90, y: PANEL.y + 250, w: PANEL.w - 400, h: PANEL.h - 360 }
const px = (i: number) => PLOT.x + (i / (SERIES.length - 1)) * PLOT.w
const py = (v: number) => PLOT.y + PLOT.h - ((v - MINV) / (MAXV - MINV)) * PLOT.h

// torn-paper edge clip-path (irregular, hand-torn look) for the panel
const TORN = 'polygon(1% 3%, 6% 1%, 12% 4%, 18% 1%, 25% 3%, 32% 0%, 39% 3%, 46% 1%, 53% 4%, 60% 1%, 67% 3%, 74% 0%, 81% 3%, 88% 1%, 95% 3%, 99% 1%, 100% 6%, 99% 12%, 100% 20%, 99% 30%, 100% 42%, 99% 55%, 100% 68%, 99% 80%, 100% 90%, 99% 96%, 94% 99%, 86% 97%, 78% 100%, 70% 97%, 62% 100%, 54% 97%, 46% 100%, 38% 97%, 30% 100%, 22% 97%, 14% 100%, 7% 98%, 2% 99%, 0% 94%, 1% 85%, 0% 74%, 1% 62%, 0% 50%, 1% 38%, 0% 26%, 1% 15%, 0% 8%)'

const grainSVG = encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(#n)' opacity='0.5'/></svg>`)
const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.05 }) => { const f = useCurrentFrame(); return <AbsoluteFill style={{ pointerEvents: 'none', backgroundImage: `url("data:image/svg+xml,${grainSVG}")`, backgroundPosition: `${(f * 4) % 180}px ${(f * 6) % 180}px`, mixBlendMode: 'multiply', opacity }} /> }

export const PaperChartDemo: React.FC = () => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const panelS = spring({ frame: f - 2, fps, config: { damping: 16, stiffness: 120 } })

  const draw = interpolate(f, [24, 158], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.4, 0, 0.2, 1) })
  const shownCount = 1 + draw * (SERIES.length - 1)
  let d = `M ${px(0)} ${py(SERIES[0])}`
  const whole = Math.floor(shownCount)
  for (let i = 1; i <= Math.min(whole, SERIES.length - 1); i++) d += ` L ${px(i)} ${py(SERIES[i])}`
  let tipX = px(Math.min(whole, SERIES.length - 1)), tipY = py(SERIES[Math.min(whole, SERIES.length - 1)])
  if (whole < SERIES.length - 1) { const frac = shownCount - whole; tipX = px(whole) + (px(whole + 1) - px(whole)) * frac; tipY = py(SERIES[whole]) + (py(SERIES[whole + 1]) - py(SERIES[whole])) * frac; d += ` L ${tipX} ${tipY}` }

  const idxF = draw * (SERIES.length - 1)
  const lo = Math.floor(idxF), hi = Math.min(lo + 1, SERIES.length - 1)
  const liveVal = Math.round(SERIES[lo] + (SERIES[hi] - SERIES[lo]) * (idxF - lo))
  const prevVal = Math.round(SERIES[Math.max(0, lo - 1)])
  const rising = liveVal >= prevVal
  const delta = liveVal - SERIES[0]
  const pct = (delta / SERIES[0]) * 100

  return (
    <AbsoluteFill style={{ background: NAVY }}>
      {/* FLUX paper = TEXTURE ONLY, darkened so the code panel pops */}
      <Img src={staticFile('paper-chart/bg.png')} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.75) saturate(1.05)' }} />
      <AbsoluteFill style={{ background: 'rgba(20,32,60,0.35)' }} />

      {/* CODE-DRAWN CREAM PAPER PANEL — known position, torn edge, drop shadow.
          Everything readable lives on THIS, so contrast is guaranteed. */}
      <div style={{
        position: 'absolute', left: PANEL.x, top: PANEL.y, width: PANEL.w, height: PANEL.h,
        transform: `translateY(${(1 - panelS) * 30}px) rotate(-0.6deg)`, opacity: Math.min(1, panelS),
      }}>
        {/* soft paper drop shadow (a slightly larger dark torn shape behind) */}
        <div style={{ position: 'absolute', inset: -8, background: 'rgba(0,0,0,0.35)', clipPath: TORN, filter: 'blur(10px)' }} />
        {/* the cream paper itself */}
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(160deg, ${CREAM}, #ece5d6)`, clipPath: TORN, overflow: 'hidden' }}>
          <Grain opacity={0.08} />
        </div>
        {/* content sits absolutely, coordinates relative to the whole frame via SVG below */}
      </div>

      {/* AXES (drawn to the panel-relative plot box) */}
      <div style={{ position: 'absolute', left: PLOT.x, top: PLOT.y + PLOT.h + 4, width: PLOT.w, height: 4, background: NAVY, opacity: 0.4, borderRadius: 2 }} />
      <div style={{ position: 'absolute', left: PLOT.x - 6, top: PLOT.y, width: 4, height: PLOT.h, background: NAVY, opacity: 0.25, borderRadius: 2 }} />

      {/* CHART LINE — crisp SVG, clipped to reveal with the draw */}
      <AbsoluteFill>
        <svg width="100%" height="100%" viewBox="0 0 1920 1080" style={{ position: 'absolute' }}>
          <defs>
            <linearGradient id="fill2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={rising ? GREEN : RED} stopOpacity="0.26" />
              <stop offset="100%" stopColor={rising ? GREEN : RED} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${d} L ${tipX} ${PLOT.y + PLOT.h} L ${px(0)} ${PLOT.y + PLOT.h} Z`} fill="url(#fill2)" />
          <path d={d} fill="none" stroke={rising ? GREEN : RED} strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.2))' }} />
          <circle cx={tipX} cy={tipY} r={12} fill="#fff" stroke={rising ? GREEN : RED} strokeWidth={6} />
        </svg>
      </AbsoluteFill>

      {/* TITLE tag — navy, top-left INSIDE the panel */}
      <div style={{ position: 'absolute', left: PANEL.x + 70, top: PANEL.y + 60, background: NAVY, padding: '12px 26px', boxShadow: '0 8px 20px rgba(0,0,0,0.35)', transform: 'rotate(-1deg)' }}>
        <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 30, color: '#fff', letterSpacing: '0.03em' }}>DOW JONES · ILLUSTRATIVE</div>
      </div>

      {/* THE LIVE NUMBER — INSIDE the cream panel (dark ink on cream = readable) */}
      <div style={{ position: 'absolute', right: 1920 - (PANEL.x + PANEL.w) + 90, top: PANEL.y + 55, textAlign: 'right' }}>
        <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 118, lineHeight: 0.9, color: INK, letterSpacing: '-0.03em' }}>
          {liveVal.toLocaleString('en-US')}
        </div>
        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 42, color: rising ? GREEN : RED, marginTop: 6 }}>
          {rising ? '▲' : '▼'} {delta >= 0 ? '+' : ''}{delta.toLocaleString('en-US')} ({pct >= 0 ? '+' : ''}{pct.toFixed(1)}%)
        </div>
      </div>
    </AbsoluteFill>
  )
}
