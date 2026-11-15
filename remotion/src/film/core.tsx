import React from 'react'
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame } from 'remotion'
import type { Theme } from './theme'

/* ── time ────────────────────────────────────────────────────────────────── */
export const FPS = 30
export type Timing = { FPS: number; HANDLE: number; VO_IN: number; total: number; totalFrames: number; shots: { name: string; from: number; dur: number }[]; cues: Record<string, number> }
export type ShotProps = { t: number; d: number; c: (k: string) => number }
export const CL = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k
export const inOut = Easing.inOut(Easing.cubic)
export const ease = (t: number, a: number, b: number, v0: number, v1: number, e: (x: number) => number = Easing.out(Easing.cubic)) => interpolate(t, [a, b], [v0, v1], { ...CL, easing: e })
export const pop = (t: number, at: number, damping = 15, stiffness = 150) => (t < at ? 0 : spring({ frame: (t - at) * FPS, fps: FPS, config: { damping, stiffness, mass: 0.7 } }))
export const kf = (t: number, keys: [number, number][], e: (x: number) => number = inOut) => {
  if (t <= keys[0][0]) return keys[0][1]
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) return lerp(keys[i - 1][1], keys[i][1], e((t - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0])))
  return keys[keys.length - 1][1]
}
export const rnd = (seed: number) => { const x = Math.sin(seed * 9301.7 + 49297.3) * 233280; return x - Math.floor(x) }

/* ── context ─────────────────────────────────────────────────────────────── */
export const ThemeCtx = React.createContext<Theme>(null as unknown as Theme)
export const useTheme = () => React.useContext(ThemeCtx)
/** The current shot's start in cut seconds (spoken-word times are in cut seconds). */
export const StartCtx = React.createContext(0)

/* ── the camera (CSS 3D) ─────────────────────────────────────────────────── */
export type Cam = { x: number; y: number; z: number; rx: number; ry: number; focus: number; dof?: number }
const CamCtx = React.createContext<Cam>({ x: 0, y: 0, z: 0, rx: 0, ry: 0, focus: 0 })
export const Stage: React.FC<{ cam: Cam; children: React.ReactNode }> = ({ cam, children }) => (
  <CamCtx.Provider value={cam}>
    <AbsoluteFill style={{ perspective: 1200, perspectiveOrigin: '50% 50%' }}>
      <div style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transform: `translateZ(1200px) rotateX(${cam.rx}deg) rotateY(${cam.ry}deg) translate3d(${-cam.x}px, ${-cam.y}px, ${cam.z - 1200}px)` }}>{children}</div>
    </AbsoluteFill>
  </CamCtx.Provider>
)
/** A thing in the world. With depth of field on (dark looks), it softens away from the focus plane. Keep things small: no plane bigger than the frame. */
export const Obj: React.FC<{ x?: number; y?: number; z?: number; w: number; h: number; rx?: number; ry?: number; rz?: number; sharp?: boolean; opacity?: number; style?: React.CSSProperties; children?: React.ReactNode }> = ({ x = 0, y = 0, z = 0, w, h, rx = 0, ry = 0, rz = 0, sharp, opacity = 1, style, children }) => {
  const cam = React.useContext(CamCtx)
  const th = useTheme()
  const eff = z + cam.z
  const blur = sharp || !th.dof ? 0 : Math.min(12, Math.abs(eff - cam.focus) / (cam.dof ?? 120))
  const pass = eff > 980 ? Math.max(0, 1 - (eff - 980) / 160) : 1
  if (pass <= 0 || opacity <= 0.001) return null
  return <div style={{ position: 'absolute', left: 960 - w / 2, top: 540 - h / 2, width: w, height: h, transform: `translate3d(${x}px, ${y}px, ${z}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`, filter: blur > 0.4 ? `blur(${blur.toFixed(1)}px)` : undefined, opacity: opacity * pass }}><div style={{ width: '100%', height: '100%', ...style }}>{children}</div></div>
}

/* ── how things arrive, per look ─────────────────────────────────────────── */
export const enter = (th: Theme, t: number, at: number, dist = 40): React.CSSProperties => {
  const k = ease(t, at, at + (th.entrance === 'wipe' ? 0.5 : 0.6), 0, 1, Easing.out(Easing.cubic))
  if (th.entrance === 'blur') return { opacity: k, filter: k < 0.99 ? `blur(${(1 - k) * 12}px)` : undefined, transform: `translateY(${(1 - k) * dist * 0.4}px)` }
  if (th.entrance === 'slide') { const s = pop(t, at, 14, 170); return { opacity: Math.min(1, s * 1.4), transform: `translateX(${(1 - s) * -dist * 1.6}px)` } }
  if (th.entrance === 'wipe') return { opacity: k > 0 ? 1 : 0, clipPath: `inset(0 ${(1 - k) * 100}% 0 0)` }
  const s = pop(t, at, 16, 140)
  return { opacity: Math.min(1, s * 1.4), transform: `translateY(${(1 - s) * dist}px)` }
}

/* ── type ────────────────────────────────────────────────────────────────── */
export const Label: React.FC<{ children: React.ReactNode; size?: number; color?: string; style?: React.CSSProperties }> = ({ children, size = 20, color, style }) => {
  const th = useTheme()
  return <span style={{ fontFamily: th.label, fontWeight: th.labelWeight, fontSize: size, letterSpacing: th.labelTrack, textTransform: th.label === th.head || th.labelTrack.startsWith('.0') ? 'none' : 'uppercase', color: color ?? th.muted, whiteSpace: 'nowrap', ...style }}>{th.id === 'swiss' ? `/ ${children}` : children}</span>
}
export const Head: React.FC<{ children: React.ReactNode; size: number; color?: string; italic?: boolean; style?: React.CSSProperties }> = ({ children, size, color, italic, style }) => {
  const th = useTheme()
  const s = th.headUpper ? size * (th.upperScale ?? 1) : size
  return <span style={{ fontFamily: th.head, fontWeight: th.headWeight, fontSize: s, lineHeight: th.headUpper ? 0.95 : 1.04, letterSpacing: th.headTrack, textTransform: th.headUpper ? 'uppercase' : 'none', fontStyle: italic && th.headItalic ? 'italic' : 'normal', color: color ?? th.ink, ...style }}>{children}</span>
}
export const Body: React.FC<{ children: React.ReactNode; size?: number; color?: string; weight?: number; style?: React.CSSProperties }> = ({ children, size = 30, color, weight = 500, style }) => {
  const th = useTheme()
  return <span style={{ fontFamily: th.body, fontWeight: weight, fontSize: size, lineHeight: 1.3, color: color ?? th.ink, ...style }}>{children}</span>
}
/** A big figure, drawn the look's way: layered metal (never gradient-clipped text: it paints a solid box in the video renderer), plain ink, or accent. */
export const Numeral: React.FC<{ children: React.ReactNode; size: number; t: number; style?: React.CSSProperties }> = ({ children, size, t, style }) => {
  const th = useTheme()
  const font: React.CSSProperties = { fontFamily: th.head, fontWeight: th.headWeight, fontSize: th.headUpper ? size * (th.upperScale ?? 1) : size, lineHeight: 1, letterSpacing: th.headUpper ? '0.01em' : '-0.02em', whiteSpace: 'nowrap', fontVariantNumeric: 'lining-nums tabular-nums' }
  if (th.numeral !== 'metal') {
    const color = th.numeral === 'accent' ? th.accent : th.ink
    return <span style={{ ...font, color, textShadow: th.dark ? `0 0 30px ${th.accent}55` : 'none', ...style }}>{children}</span>
  }
  const sw = ((t * 22) % 160) - 30
  const layer: React.CSSProperties = { position: 'absolute', left: 0, top: 0 }
  const m = (g: string): React.CSSProperties => ({ WebkitMaskImage: g, maskImage: g })
  return (
    <span style={{ position: 'relative', display: 'inline-block', width: 'fit-content', alignSelf: 'center', ...font, ...style }}>
      <span style={{ color: th.accent, textShadow: `0 0 26px ${th.accent}55, 0 6px 18px rgba(0,0,0,.5)` }}>{children}</span>
      <span aria-hidden style={{ ...layer, color: '#7a5420', ...m('linear-gradient(180deg, rgba(0,0,0,0) 45%, rgba(0,0,0,.8) 100%)') }}>{children}</span>
      <span aria-hidden style={{ ...layer, color: '#f5e2b4', opacity: 0.55, ...m('linear-gradient(180deg, rgba(0,0,0,.9) 0%, rgba(0,0,0,0) 55%)') }}>{children}</span>
      <span aria-hidden style={{ ...layer, color: '#fff6e2', ...m(`linear-gradient(100deg, rgba(0,0,0,0) ${sw - 9}%, rgba(0,0,0,1) ${sw}%, rgba(0,0,0,0) ${sw + 9}%)`) }}>{children}</span>
    </span>
  )
}
/** Words that land as they are spoken (tokens shown, each with the cut time of the word it rides on). */
export const Spoken: React.FC<{ t: number; tokens: [string, number][]; render: (s: string) => React.ReactNode; gap?: number; style?: React.CSSProperties }> = ({ t, tokens, render, gap = 22, style }) => {
  const th = useTheme()
  const start = React.useContext(StartCtx)
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: `0 ${gap}px`, ...style }}>
      {tokens.map(([w, at], i) => <span key={i} style={{ display: 'inline-block', ...enter(th, t, at - start - 0.12, 26) }}>{render(w)}</span>)}
    </div>
  )
}

/* ── cards ───────────────────────────────────────────────────────────────── */
export const Card: React.FC<{ children?: React.ReactNode; style?: React.CSSProperties; strong?: boolean }> = ({ children, style, strong }) => {
  const th = useTheme()
  const base: React.CSSProperties = { width: '100%', height: '100%', boxSizing: 'border-box', borderRadius: th.radius, position: 'relative' }
  const looks: Record<Theme['card'], React.CSSProperties> = {
    glass: { background: strong ? `linear-gradient(160deg, ${th.accent}33, rgba(255,255,255,.05))` : 'linear-gradient(160deg, rgba(255,255,255,.12), rgba(255,255,255,.03) 55%, rgba(255,255,255,.07))', border: `1px solid ${strong ? th.accent + '88' : th.line}`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.2), 0 30px 80px rgba(0,0,0,.5)' },
    paper: { background: strong ? th.accent : th.cardBg, border: `1px solid ${strong ? th.accent : th.line}`, boxShadow: '0 2px 4px rgba(40,30,10,.05), 0 30px 70px -30px rgba(40,30,10,.35)' },
    flat: { background: strong ? th.accent : th.cardBg, borderTop: `${th.id === 'swiss' ? 2 : 6}px solid ${strong ? th.accent2 : th.accent}` },
    frame: { background: th.cardBg, border: `1px solid ${th.line}`, outline: `1px solid ${th.line}`, outlineOffset: -10, boxShadow: '0 24px 60px -30px rgba(28,42,68,.35)' },
    rule: { background: 'transparent', borderTop: `1px solid ${th.line}`, borderBottom: `1px solid ${th.line}` },
  }
  return <div style={{ ...base, ...looks[th.card], ...style }}>{children}</div>
}

/* ── the world behind everything ─────────────────────────────────────────── */
export const World: React.FC<{ t: number }> = ({ t }) => {
  const th = useTheme()
  const drift = (a: number, b: number) => `${a + 3 * Math.sin(t * 0.2)}% ${b + 2 * Math.cos(t * 0.17)}%`
  if (th.world === 'space') return (
    <AbsoluteFill style={{ background: `radial-gradient(1300px 900px at ${drift(50, 42)}, ${th.bg2}, ${th.bg} 70%)` }}>
      <AbsoluteFill style={{ background: `radial-gradient(900px 600px at ${drift(30, 30)}, ${th.accent}22, rgba(0,0,0,0) 65%)` }} />
    </AbsoluteFill>
  )
  if (th.world === 'paper') return (
    <AbsoluteFill style={{ background: th.bg }}>
      <AbsoluteFill style={{ background: `radial-gradient(1100px 800px at ${drift(22, 18)}, ${th.bg2}, rgba(0,0,0,0) 62%)` }} />
    </AbsoluteFill>
  )
  if (th.world === 'grid') {
    const off = (t * 8) % 80
    return (
      <AbsoluteFill style={{ background: th.bg }}>
        <AbsoluteFill style={{ backgroundImage: `linear-gradient(${th.line}66 1px, transparent 1px), linear-gradient(90deg, ${th.line}66 1px, transparent 1px)`, backgroundSize: '80px 80px', backgroundPosition: `${-off}px ${-off * 0.5}px`, opacity: th.id === 'swiss' ? 0.5 : 0.8 }} />
        <AbsoluteFill style={{ background: `radial-gradient(1100px 760px at ${drift(70, 30)}, ${th.bg2}, rgba(255,255,255,0) 60%)` }} />
      </AbsoluteFill>
    )
  }
  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, ${th.bg} 0%, ${th.bg} 45%, ${th.bg2} 100%)` }}>
      <AbsoluteFill style={{ background: `radial-gradient(1000px 700px at ${drift(80, 20)}, ${th.bg2}, rgba(0,0,0,0) 60%)` }} />
    </AbsoluteFill>
  )
}
/** Things that float in the world with the camera: dust in dark looks, soft shapes in bright ones. */
export const Atmos: React.FC<{ t: number; seed?: number }> = ({ t, seed = 1 }) => {
  const th = useTheme()
  const out: React.ReactNode[] = []
  for (let i = 0; i < th.dust; i++) {
    const r = 3 + rnd(seed + i + 7) * 5
    out.push(<Obj key={'d' + i} x={(rnd(seed + i) - 0.5) * 3200 + Math.sin(t * 0.3 + i) * 30} y={(rnd(seed + i + 50) - 0.5) * 1100 - t * (6 + rnd(seed + i + 9) * 10)} z={lerp(-2000, 600, rnd(seed + i + 99))} w={r * 2} h={r * 2} sharp style={{ borderRadius: r, background: 'radial-gradient(circle, rgba(255,226,180,.9), rgba(255,226,180,0) 70%)', opacity: 0.3 + 0.4 * Math.sin(t * 1.1 + i) ** 2 }} />)
  }
  if (th.ornament === 'blobs') for (let i = 0; i < 7; i++) {
    const s = 90 + rnd(seed + i + 3) * 220
    out.push(<Obj key={'b' + i} x={(rnd(seed + i + 11) - 0.5) * 2600} y={(rnd(seed + i + 21) - 0.5) * 1100 + Math.sin(t * 0.5 + i) * 26} z={lerp(-1400, -200, rnd(seed + i + 31))} rz={t * 8 + i * 40} w={s} h={s} sharp style={{ borderRadius: i % 2 ? s : s * 0.28, background: th.series.filter((c) => parseInt(c.slice(1, 3), 16) + parseInt(c.slice(3, 5), 16) + parseInt(c.slice(5, 7), 16) > 300)[i % 2] ?? th.accent, opacity: 0.22 }} />)
  }
  return <>{out}</>
}
export const Bokeh: React.FC<{ t: number; seed?: number }> = ({ t, seed = 3 }) => {
  const th = useTheme()
  if (!th.bokeh) return null
  const tint = th.accent
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'screen' }}>
      {Array.from({ length: th.bokeh }).map((_, i) => {
        const r = 60 + rnd(seed + i) * 120
        return <div key={i} style={{ position: 'absolute', left: rnd(seed + i + 20) * 1920 + Math.sin(t * 0.25 + i) * 40 - r, top: rnd(seed + i + 40) * 1080 + Math.cos(t * 0.2 + i) * 30 - r, width: r * 2, height: r * 2, borderRadius: r * 2, background: `radial-gradient(circle, ${tint}2a 0%, ${tint}1a 55%, ${tint}08 70%, ${tint}00 72%)` }} />
      })}
    </AbsoluteFill>
  )
}
export const Flare: React.FC<{ t: number; at: number; y?: number; x?: number }> = ({ t, at, y = 540, x = 960 }) => {
  const th = useTheme()
  if (!th.flare) return null
  const a = (t < at ? ease(t, at - 0.12, at, 0, 1) : 1 - ease(t, at, at + 1.1, 0, 1, Easing.out(Easing.quad))) * th.flare
  if (a <= 0.01) return null
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'screen', opacity: a }}>
      <div style={{ position: 'absolute', left: x - 1300, top: y - 3, width: 2600, height: 6, background: 'linear-gradient(90deg, rgba(120,170,255,0), rgba(140,190,255,.5) 35%, rgba(255,240,215,1) 50%, rgba(140,190,255,.5) 65%, rgba(120,170,255,0))' }} />
      <div style={{ position: 'absolute', left: x - 180, top: y - 180, width: 360, height: 360, borderRadius: 360, background: 'radial-gradient(circle, rgba(255,240,220,.6), rgba(255,200,140,.16) 40%, rgba(255,200,140,0) 70%)' }} />
    </AbsoluteFill>
  )
}
/** Fixed touches over the picture: a frame, corner rules, the index line, a skyline, a diagonal band (drawn behind, see Band). */
export const Ornament: React.FC<{ t: number; index: number; count: number; title?: string }> = ({ t, index, count, title }) => {
  const th = useTheme()
  if (th.ornament === 'frame') return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: 34, border: `1.5px solid ${th.line}` }} />
      <div style={{ position: 'absolute', inset: 46, border: `1px solid ${th.line}99` }} />
    </AbsoluteFill>
  )
  if (th.ornament === 'corners') return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {[[60, 60, 1, 1], [1860, 60, -1, 1], [60, 1020, 1, -1], [1860, 1020, -1, -1]].map(([x, y, sx, sy], i) => (
        <div key={i} style={{ position: 'absolute', left: sx > 0 ? x : x - 90, top: sy > 0 ? y : y - 90, width: 90, height: 90, borderLeft: sx > 0 ? `1px solid ${th.line}` : 'none', borderRight: sx < 0 ? `1px solid ${th.line}` : 'none', borderTop: sy > 0 ? `1px solid ${th.line}` : 'none', borderBottom: sy < 0 ? `1px solid ${th.line}` : 'none' }} />
      ))}
    </AbsoluteFill>
  )
  if (th.ornament === 'index') return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: 96, right: 96, top: 84, height: 1, background: th.ink }} />
      <div style={{ position: 'absolute', left: 96, top: 98, fontFamily: th.label, fontSize: 18, color: th.ink }}>{String(index + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}</div>
      <div style={{ position: 'absolute', right: 96, top: 98, fontFamily: th.label, fontSize: 18, color: th.muted }}>{title}</div>
      <div style={{ position: 'absolute', left: 96, top: 84, height: 3, width: `${((index + Math.min(1, t / 4)) / count) * 1728}px`, background: th.accent }} />
    </AbsoluteFill>
  )
  if (th.ornament === 'skyline' && false) return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {Array.from({ length: 22 }).map((_, i) => {
        const w = 60 + rnd(i + 5) * 80, h = 60 + rnd(i + 9) * 170, x = (i / 22) * 2000 - 40 - ((t * 6) % 90)
        return <div key={i} style={{ position: 'absolute', left: x, bottom: 132, width: w, height: h, background: '#060c17', opacity: 0.95 }}>
          {Array.from({ length: Math.floor(h / 26) * 2 }).map((__, j) => rnd(i * 31 + j) < 0.3 ? <div key={j} style={{ position: 'absolute', left: 10 + (j % 2) * (w / 2), top: 10 + Math.floor(j / 2) * 26, width: 8, height: 11, background: `rgba(255,${190 + Math.round(rnd(j) * 40)},120,.75)` }} /> : null)}
        </div>
      })}
    </AbsoluteFill>
  )
  return null
}
export const Band: React.FC<{ t: number }> = ({ t }) => {
  const th = useTheme()
  if (th.ornament === 'skyline') return (
    <AbsoluteFill style={{ pointerEvents: 'none', opacity: 0.85 }}>
      {Array.from({ length: 22 }).map((_, i) => {
        const w = 60 + rnd(i + 5) * 80, h = 50 + rnd(i + 9) * 150, x = (i / 22) * 2000 - 40 - ((t * 6) % 90)
        return <div key={i} style={{ position: 'absolute', left: x, bottom: 132, width: w, height: h, background: '#081120' }}>
          {Array.from({ length: Math.floor(h / 26) * 2 }).map((__, j) => rnd(i * 31 + j) < 0.3 ? <div key={j} style={{ position: 'absolute', left: 10 + (j % 2) * (w / 2), top: 10 + Math.floor(j / 2) * 26, width: 8, height: 11, background: `rgba(255,${190 + Math.round(rnd(j) * 40)},120,.6)` }} /> : null)}
        </div>
      })}
    </AbsoluteFill>
  )
  if (th.ornament !== 'band') return null
  /* a navy band low in the frame, under the content */
  return <div style={{ position: 'absolute', left: -400, top: 1000 - 8 * Math.sin(t * 0.3), width: 2800, height: 400, background: th.accent2, transform: 'rotate(-3deg)' }}><div style={{ position: 'absolute', left: 0, right: 0, top: -12, height: 12, background: th.accent }} /></div>
}
/** Grain, vignette, letterbox. */
export const Finish: React.FC = () => {
  const th = useTheme()
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {th.grain ? <svg width="1920" height="1080" style={{ position: 'absolute', inset: 0, opacity: th.grain, mixBlendMode: th.dark ? 'screen' : 'multiply', filter: 'grayscale(1)' }}><filter id={`fg${frame % 8}`}><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={frame % 8} stitchTiles="stitch" /></filter><rect width="1920" height="1080" filter={`url(#fg${frame % 8})`} /></svg> : null}
      <AbsoluteFill style={{ background: th.dark ? 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 52%, rgba(0,0,0,.5) 100%)' : 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 62%, rgba(60,45,20,.08) 100%)' }} />
      {th.letterbox ? <><div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 132, background: '#000' }} /><div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 132, background: '#000' }} /></> : null}
    </AbsoluteFill>
  )
}

/* ── icons, drawn ────────────────────────────────────────────────────────── */
export const Icon: React.FC<{ kind: 'house' | 'cap' | 'shield' | 'calendar' | 'check'; size?: number; color: string; draw?: number }> = ({ kind, size = 120, color, draw = 1 }) => {
  const d = { house: 'M10 52 L50 16 L90 52 M22 44 L22 86 L78 86 L78 44 M42 86 L42 62 L58 62 L58 86', cap: 'M8 40 L50 20 L92 40 L50 60 Z M26 50 L26 72 C 38 82, 62 82, 74 72 L74 50 M92 40 L92 64', shield: 'M50 10 L84 22 L84 48 C 84 70, 66 84, 50 90 C 34 84, 16 70, 16 48 L16 22 Z M34 50 L46 62 L68 38', calendar: 'M16 22 L84 22 L84 86 L16 86 Z M16 40 L84 40 M32 12 L32 30 M68 12 L68 30', check: 'M20 52 L42 72 L82 28' }[kind]
  return <svg width={size} height={size} viewBox="0 0 100 100"><path d={d} fill="none" stroke={color} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - draw} /></svg>
}
