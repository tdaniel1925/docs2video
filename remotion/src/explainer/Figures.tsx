import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion'

/**
 * Rigged SVG figures + objects for the animated explainer. Each character is
 * built from separate paths (head, torso, arms) so parts animate independently
 * — the "puppet" layer the director choreographs.
 *
 * Palette: Docs2Video blue/orange on friendly flat-illustration bodies.
 */

const BLUE = '#2d6a9f'
const BLUE_L = '#4a9fe0'
const ORANGE = '#f5a623'
const SKIN = '#f2c9a0'
const SKIN2 = '#c98a5e'
const CREAM = '#f4f7fb'

// ── a person: skin tone + shirt color parameterizable, arms rig-driven ──
export const Person: React.FC<{
  skin?: string; shirt?: string;
  /** -1 (down) .. 1 (up) per arm — the director sets these to point/wave/handoff */
  leftArm?: number; rightArm?: number;
  /** head tilt in degrees */
  headTilt?: number;
  /** simple bob for "alive" idle */
  idle?: number;
  scale?: number;
}> = ({ skin = SKIN, shirt = BLUE, leftArm = -0.6, rightArm = -0.6, headTilt = 0, idle = 0, scale = 1 }) => {
  const bob = Math.sin(idle) * 3
  const la = interpolate(leftArm, [-1, 1], [40, -150])   // shoulder angle
  const ra = interpolate(rightArm, [-1, 1], [-40, 150])
  return (
    <svg width={220 * scale} height={340 * scale} viewBox="0 0 220 340" style={{ overflow: 'visible' }}>
      <g transform={`translate(0 ${bob})`}>
        {/* legs */}
        <rect x="92" y="230" width="16" height="80" rx="8" fill="#2a3a4a" />
        <rect x="112" y="230" width="16" height="80" rx="8" fill="#33475c" />
        {/* torso */}
        <path d="M70 150 Q110 130 150 150 L156 240 Q110 258 64 240 Z" fill={shirt} />
        {/* left arm (rigged at shoulder) */}
        <g transform={`translate(74 162) rotate(${la})`}>
          <rect x="-13" y="0" width="26" height="90" rx="13" fill={shirt} />
          <circle cx="0" cy="94" r="15" fill={skin} />
        </g>
        {/* right arm (rigged at shoulder) */}
        <g transform={`translate(146 162) rotate(${ra})`}>
          <rect x="-13" y="0" width="26" height="90" rx="13" fill={shirt} />
          <circle cx="0" cy="94" r="15" fill={skin} />
        </g>
        {/* neck + head */}
        <g transform={`translate(110 118) rotate(${headTilt})`}>
          <rect x="-9" y="-6" width="18" height="24" fill={skin} />
          <circle cx="0" cy="-34" r="40" fill={skin} />
          {/* hair */}
          <path d="M-40 -40 Q0 -92 40 -40 Q30 -60 0 -62 Q-30 -60 -40 -40 Z" fill="#3a2a1e" />
          {/* eyes + smile */}
          <circle cx="-14" cy="-36" r="4.5" fill="#1a1a1a" />
          <circle cx="14" cy="-36" r="4.5" fill="#1a1a1a" />
          <path d="M-14 -20 Q0 -8 14 -20" stroke="#1a1a1a" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  )
}

// ── objects the characters interact with ──

// A document that can "transform": show it, then it grows a play button.
export const DocObject: React.FC<{ morph?: number; scale?: number }> = ({ morph = 0, scale = 1 }) => {
  // morph 0 = plain doc, 1 = video frame with play button
  const w = interpolate(morph, [0, 1], [120, 200])
  const h = interpolate(morph, [0, 1], [150, 130])
  const docLines = 1 - morph
  const playOp = interpolate(morph, [0.4, 1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <svg width={w * scale} height={h * scale} viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
      <rect x="4" y="4" width={w - 8} height={h - 8} rx="12" fill={interpolate(morph, [0, 1], [0.5, 0.5]) > 0 ? CREAM : CREAM} stroke={BLUE} strokeWidth="4" />
      <rect x="4" y="4" width={w - 8} height={h - 8} rx="12" fill="#101722" opacity={morph} />
      {/* doc text lines fade out */}
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x="22" y={30 + i * 22} width={(w - 60) * (i % 2 ? 0.7 : 1)} height="8" rx="4" fill={BLUE_L} opacity={docLines * 0.7} />
      ))}
      {/* play button fades in */}
      <g opacity={playOp} transform={`translate(${w / 2} ${h / 2})`}>
        <circle r="34" fill={ORANGE} />
        <path d="M-11 -16 L20 0 L-11 16 Z" fill="#fff" />
      </g>
    </svg>
  )
}

// A growing bar chart (for the "results/tracking" beat)
export const ChartObject: React.FC<{ grow?: number; scale?: number }> = ({ grow = 0, scale = 1 }) => {
  const bars = [0.5, 0.72, 0.6, 0.9, 1.0]
  return (
    <svg width={280 * scale} height={200 * scale} viewBox="0 0 280 200" style={{ overflow: 'visible' }}>
      <line x1="30" y1="180" x2="270" y2="180" stroke={BLUE} strokeWidth="4" />
      {bars.map((b, i) => {
        const g = interpolate(grow, [i * 0.12, i * 0.12 + 0.4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
        const h = b * 150 * g
        return <rect key={i} x={44 + i * 46} y={180 - h} width="32" height={h} rx="5" fill={i === 4 ? ORANGE : BLUE_L} />
      })}
    </svg>
  )
}

// A checkmark that draws itself
export const CheckObject: React.FC<{ draw?: number; scale?: number }> = ({ draw = 0, scale = 1 }) => (
  <svg width={160 * scale} height={160 * scale} viewBox="0 0 160 160" style={{ overflow: 'visible' }}>
    <circle cx="80" cy="80" r="70" fill="none" stroke={BLUE_L} strokeWidth="8" strokeDasharray="440" strokeDashoffset={440 * (1 - Math.min(1, draw * 1.3))} transform="rotate(-90 80 80)" />
    <path d="M48 82 L72 106 L114 56" fill="none" stroke={ORANGE} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="120" strokeDashoffset={120 * (1 - Math.max(0, (draw - 0.5) * 2))} />
  </svg>
)

// A floating envelope/send icon
export const SendObject: React.FC<{ scale?: number }> = ({ scale = 1 }) => (
  <svg width={160 * scale} height={120 * scale} viewBox="0 0 160 120" style={{ overflow: 'visible' }}>
    <rect x="8" y="16" width="144" height="90" rx="10" fill={CREAM} stroke={BLUE} strokeWidth="4" />
    <path d="M8 22 L80 66 L152 22" fill="none" stroke={BLUE} strokeWidth="4" />
    <path d="M120 8 L150 8 L150 38" fill="none" stroke={ORANGE} strokeWidth="6" strokeLinecap="round" />
    <path d="M150 8 L118 40" stroke={ORANGE} strokeWidth="6" strokeLinecap="round" />
  </svg>
)
