import { AbsoluteFill, useCurrentFrame } from 'remotion'

const hexA = (h: string, a: number) => { const n = (h || '#000').replace('#', ''); return `rgba(${parseInt(n.slice(0, 2), 16)},${parseInt(n.slice(2, 4), 16)},${parseInt(n.slice(4, 6), 16)},${a})` }

/**
 * LOOKS — curated, genuinely-distinct visual systems. Each is a matched set of
 * background style + palette + type feel. The Director picks ONE per video by
 * name; charts and text inherit its palette so everything coheres. This replaces
 * the single navy/orange orb that made every video look templated.
 *
 * Add a look = add an entry here. Keep them visually far apart.
 */
export type LookName = 'ledger' | 'bokeh' | 'datamesh' | 'paper' | 'sweep' | 'noir'
export type Look = {
  name: LookName
  palette: { bg: string; accent: string; accent2: string; text: string; muted: string }
  display: string   // display font family loaded by the composition
  Background: React.FC<{ frame: number; palette: Look['palette'] }>
}

// --- Backgrounds: each is deterministic (frame-driven), no orb repetition. ---

// LEDGER — deep green field, fine accountant grid, faint brass rule lines.
const LedgerBG: React.FC<{ frame: number; palette: Look['palette'] }> = ({ frame, palette }) => {
  const drift = (frame * 0.15) % 46
  return (
    <AbsoluteFill style={{ background: `radial-gradient(1400px 900px at 50% 8%, ${palette.accent2}, ${palette.bg})` }}>
      <svg width="1920" height="1080" style={{ position: 'absolute', inset: 0, opacity: 0.14 }}>
        {Array.from({ length: 24 }, (_, i) => <line key={'h' + i} x1={0} y1={i * 46 + drift} x2={1920} y2={i * 46 + drift} stroke={palette.accent} strokeWidth={1} />)}
        {Array.from({ length: 42 }, (_, i) => <line key={'v' + i} x1={i * 46} y1={0} x2={i * 46} y2={1080} stroke={palette.accent} strokeWidth={0.6} />)}
      </svg>
      <AbsoluteFill style={{ background: 'radial-gradient(130% 120% at 50% 45%, transparent 55%, rgba(0,0,0,0.6))' }} />
    </AbsoluteFill>
  )
}

// BOKEH — warm defocused light circles drifting up, editorial and soft.
const BokehBG: React.FC<{ frame: number; palette: Look['palette'] }> = ({ frame, palette }) => {
  const blobs = Array.from({ length: 9 }, (_, i) => {
    const seed = i * 97.13
    const x = ((seed * 1.7) % 100)
    const y = (100 - ((frame * 0.25 + seed * 3) % 130))
    const r = 90 + (i % 4) * 70
    const op = 0.08 + (i % 3) * 0.05
    return { x, y, r, op, c: i % 2 ? palette.accent : palette.accent2 }
  })
  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, ${palette.bg}, ${palette.accent2})` }}>
      {blobs.map((b, i) => <div key={i} style={{ position: 'absolute', left: `${b.x}%`, top: `${b.y}%`, width: b.r, height: b.r, borderRadius: '50%', background: b.c, opacity: b.op, filter: 'blur(40px)', transform: 'translate(-50%,-50%)' }} />)}
      <AbsoluteFill style={{ background: 'radial-gradient(120% 120% at 50% 50%, transparent 50%, rgba(0,0,0,0.5))' }} />
    </AbsoluteFill>
  )
}

// DATAMESH — cool technical field that MOVES and BREATHES: nodes drift slowly,
// connections form/break as they pass, a slow gradient sweep shifts the light,
// and a layer of floating dust particles rises so the frame is never static.
const DatameshBG: React.FC<{ frame: number; palette: Look['palette'] }> = ({ frame, palette }) => {
  // nodes DRIFT (not fixed) — each on its own slow sinusoidal path, wrapped.
  const nodes = Array.from({ length: 26 }, (_, i) => {
    const s = i * 61.7
    const bx = (s * 1.3) % 100, by = (s * 2.1) % 100
    const x = (bx + Math.sin(frame * 0.006 + i * 0.9) * 6 + 100) % 100
    const y = (by + Math.cos(frame * 0.005 + i * 1.3) * 5 + 100) % 100
    return { x, y, p: 0.5 + 0.5 * Math.sin(frame * 0.05 + i) }
  })
  // rising dust particles — a soft parallax layer that makes the air feel alive.
  const dust = Array.from({ length: 28 }, (_, i) => {
    const seed = i * 37.3
    const x = (seed * 1.7) % 100
    const y = (100 - ((frame * 0.14 + seed * 2.4) % 118))
    const r = 1.4 + (i % 4) * 1.1
    const op = 0.08 + (i % 3) * 0.05
    return { x, y, r, op }
  })
  // slow gradient sweep — the "light" moves across the frame over time.
  const gx = 50 + Math.sin(frame * 0.008) * 26, gy = 34 + Math.cos(frame * 0.006) * 16
  return (
    <AbsoluteFill style={{ background: `radial-gradient(1300px 1050px at ${gx}% ${gy}%, ${palette.accent2}, ${palette.bg})` }}>
      {/* second, counter-drifting glow so the field shifts, not just pulses */}
      <AbsoluteFill style={{ background: `radial-gradient(900px 900px at ${100 - gx}% ${80 - gy}%, ${hexA(palette.accent, 0.10)}, transparent 60%)` }} />
      <svg width="1920" height="1080" style={{ position: 'absolute', inset: 0, opacity: 0.42 }}>
        {nodes.map((n, i) => nodes.slice(i + 1).map((m, j) => { const d = Math.hypot(n.x - m.x, n.y - m.y); return d < 24 ? <line key={i + '-' + j} x1={n.x * 19.2} y1={n.y * 10.8} x2={m.x * 19.2} y2={m.y * 10.8} stroke={palette.accent} strokeWidth={0.6} strokeOpacity={0.32 * (1 - d / 24)} /> : null }))}
        {nodes.map((n, i) => <circle key={i} cx={n.x * 19.2} cy={n.y * 10.8} r={2.5 + n.p * 2} fill={palette.accent} fillOpacity={0.45 + n.p * 0.4} />)}
        {dust.map((p, i) => <circle key={'d' + i} cx={p.x * 19.2} cy={p.y * 10.8} r={p.r} fill={palette.accent} fillOpacity={p.op} />)}
      </svg>
      <AbsoluteFill style={{ background: 'radial-gradient(130% 120% at 50% 50%, transparent 55%, rgba(0,0,0,0.55))' }} />
    </AbsoluteFill>
  )
}

// PAPER — cream printed-report: ruled ledger lines, twin margin rule, header/
// footer hairlines, corner registration marks, warm paper grain + ink vignette.
const PaperBG: React.FC<{ frame: number; palette: Look['palette'] }> = ({ frame, palette }) => {
  const drift = (frame * 0.08) % 54
  const ink = palette.text, red = palette.accent
  return (
    <AbsoluteFill style={{ background: palette.bg }}>
      {/* warm paper tint */}
      <AbsoluteFill style={{ background: `radial-gradient(1500px 1100px at 50% 24%, ${palette.accent2}55, transparent 62%)` }} />
      <svg width="1920" height="1080" style={{ position: 'absolute', inset: 0 }}>
        {/* faint ruled ledger lines (like a paper form) */}
        {Array.from({ length: 20 }, (_, i) => <line key={i} x1={150} y1={90 + i * 54 + drift} x2={1770} y2={90 + i * 54 + drift} stroke={ink} strokeOpacity={0.05} strokeWidth={1} />)}
        {/* twin red margin rule on the left */}
        <line x1={150} y1={0} x2={150} y2={1080} stroke={red} strokeOpacity={0.5} strokeWidth={2} />
        <line x1={158} y1={0} x2={158} y2={1080} stroke={red} strokeOpacity={0.28} strokeWidth={1} />
        {/* header + footer hairlines */}
        <line x1={150} y1={70} x2={1770} y2={70} stroke={ink} strokeOpacity={0.35} strokeWidth={1.5} />
        <line x1={150} y1={1012} x2={1770} y2={1012} stroke={ink} strokeOpacity={0.22} strokeWidth={1.5} />
        {/* corner registration marks */}
        {[[150, 70], [1770, 70], [1770, 1012], [150, 1012]].map(([x, y], i) => (
          <g key={i} stroke={ink} strokeOpacity={0.3} strokeWidth={1.5}>
            <line x1={x - 12} y1={y} x2={x + 12} y2={y} /><line x1={x} y1={y - 12} x2={x} y2={y + 12} />
          </g>
        ))}
      </svg>
      {/* ink vignette so edges feel like a printed page, not a flat fill */}
      <AbsoluteFill style={{ background: 'radial-gradient(120% 125% at 50% 42%, transparent 52%, rgba(60,45,20,0.22))' }} />
    </AbsoluteFill>
  )
}

// SWEEP — bold moving gradient field, modern and confident.
const SweepBG: React.FC<{ frame: number; palette: Look['palette'] }> = ({ frame, palette }) => {
  const a = (frame * 0.4) % 360
  return (
    <AbsoluteFill style={{ background: `linear-gradient(${a}deg, ${palette.bg}, ${palette.accent2} 60%, ${palette.bg})` }}>
      <AbsoluteFill style={{ background: `radial-gradient(900px 900px at ${50 + Math.sin(frame * 0.02) * 30}% ${50 + Math.cos(frame * 0.02) * 25}%, ${palette.accent}22, transparent 55%)` }} />
      <AbsoluteFill style={{ background: 'radial-gradient(130% 120% at 50% 50%, transparent 55%, rgba(0,0,0,0.5))' }} />
    </AbsoluteFill>
  )
}

// NOIR — near-black, single hard rim light, dramatic (luxury/legal).
const NoirBG: React.FC<{ frame: number; palette: Look['palette'] }> = ({ frame, palette }) => (
  <AbsoluteFill style={{ background: palette.bg }}>
    <AbsoluteFill style={{ background: `radial-gradient(700px 1200px at ${20 + Math.sin(frame * 0.015) * 6}% 50%, ${palette.accent2}, transparent 60%)` }} />
    <AbsoluteFill style={{ background: `radial-gradient(500px 500px at 82% 30%, ${palette.accent}18, transparent 60%)` }} />
    <AbsoluteFill style={{ background: 'radial-gradient(120% 120% at 50% 50%, transparent 45%, rgba(0,0,0,0.75))' }} />
  </AbsoluteFill>
)

export const LOOKS: Record<LookName, Omit<Look, 'name'>> = {
  ledger:   { palette: { bg: '#0c2118', accent: '#c9a24a', accent2: '#123a29', text: '#f2efe2', muted: '#8ba694' }, display: 'PlayfairDisplay', Background: LedgerBG },
  bokeh:    { palette: { bg: '#241a12', accent: '#e8b06a', accent2: '#3a2a1c', text: '#f7f0e6', muted: '#b8a48f' }, display: 'Fraunces', Background: BokehBG },
  datamesh: { palette: { bg: '#0a1622', accent: '#4fd1e8', accent2: '#12304a', text: '#eef6fb', muted: '#7f9db3' }, display: 'SpaceGrotesk', Background: DatameshBG },
  paper:    { palette: { bg: '#f2ece0', accent: '#b5432f', accent2: '#d8cdb8', text: '#241d14', muted: '#6b5f4c' }, display: 'Fraunces', Background: PaperBG },
  sweep:    { palette: { bg: '#160f2e', accent: '#f06f9c', accent2: '#2a1c52', text: '#f6f0fb', muted: '#a596c4' }, display: 'SpaceGrotesk', Background: SweepBG },
  noir:     { palette: { bg: '#0a0a0d', accent: '#c8a15a', accent2: '#1a1a22', text: '#f2efe8', muted: '#8f8a80' }, display: 'PlayfairDisplay', Background: NoirBG },
}
