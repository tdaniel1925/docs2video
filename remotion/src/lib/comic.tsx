import React from 'react'
import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion'
import { staticFile } from './asset'

/* ============================================================================
 * COMIC ENGINE — turns still comic panels into a MOTION COMIC. Works for BOTH
 * stylized-ink and photoreal art (the art style lives in the images; the engine
 * is identical). Families:
 *   · Panel        — one image in a comic frame (ink border), with a living push
 *   · PanelReveal  — panels appear one-by-one (slam / slide / draw)
 *   · SpeechBubble / CaptionBox — narration in comic style
 *   · Burst        — POW/BAM jagged burst shape with a word
 *   · MotionLines / SpeedStreaks — action emphasis
 *   · Halftone     — the dot-screen overlay that binds everything as "comic"
 *   · InkFlash     — a hard white ink-flash transition between pages
 * All pure + frame-driven. Compose freely.
 * ==========================================================================*/

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

// ---- Panel: an image inside a bold comic frame, with a subtle "living" push
// so the panel breathes (Ken-Burns + tiny warp) — a comic panel that's alive.
export const Panel: React.FC<{
  src: string; dur: number; focus?: string; border?: number; borderColor?: string
  push?: number; drift?: [number, number]; skew?: number; style?: React.CSSProperties
}> = ({ src, dur, focus = '50% 45%', border = 8, borderColor = '#0a0a0a', push = 0.1, drift = [-1, 0.6], skew = 0, style }) => {
  const frame = useCurrentFrame()
  const p = interpolate(frame, [0, dur], [0, 1], { extrapolateRight: 'clamp' })
  const sc = 1.03 + push * p
  const dx = drift[0] * p, dy = drift[1] * p
  return (
    <div style={{ position: 'relative', overflow: 'hidden', background: '#000', border: `${border}px solid ${borderColor}`, borderRadius: 4, boxShadow: '0 10px 30px rgba(0,0,0,0.5)', transform: skew ? `rotate(${skew}deg)` : undefined, ...style }}>
      <Img src={staticFile(src)} style={{ width: '110%', height: '110%', position: 'absolute', left: '-5%', top: '-5%', objectFit: 'cover', objectPosition: focus, transform: `scale(${sc}) translate(${dx}%, ${dy}%)` }} />
    </div>
  )
}

// ---- PanelReveal: how a panel enters. slam=scale-in with impact, slide=from a
// direction, draw=clip-wipe (like it's being inked in).
type RevealKind = 'slam' | 'slideL' | 'slideR' | 'slideU' | 'slideD' | 'draw' | 'pop'
export const PanelReveal: React.FC<{ at: number; kind?: RevealKind; children: React.ReactNode }> =
({ at, kind = 'slam', children }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const f = frame - at
  if (f < 0) return null
  const s = spring({ frame: f, fps, config: { damping: 12, stiffness: 180 } })
  const p = clamp(s, 0, 1)
  let transform = '', clip = '', opacity = clamp(f / 3, 0, 1)
  switch (kind) {
    case 'slam': transform = `scale(${0.6 + p * 0.4})`; break
    case 'pop': { const b = spring({ frame: f, fps, config: { damping: 8, stiffness: 220 } }); transform = `scale(${clamp(b, 0, 1.1)})`; break }
    case 'slideL': transform = `translateX(${(1 - p) * -120}%)`; break
    case 'slideR': transform = `translateX(${(1 - p) * 120}%)`; break
    case 'slideU': transform = `translateY(${(1 - p) * -120}%)`; break
    case 'slideD': transform = `translateY(${(1 - p) * 120}%)`; break
    case 'draw': clip = `inset(0 ${100 - interpolate(f, [0, 12], [0, 100], { extrapolateRight: 'clamp' })}% 0 0)`; opacity = 1; break
  }
  return <div style={{ transform, clipPath: clip || undefined, opacity, width: '100%', height: '100%' }}>{children}</div>
}

// ---- SpeechBubble: rounded comic bubble with a tail. Types on or pops in.
export const SpeechBubble: React.FC<{
  text: string; at?: number; x: number; y: number; w?: number; tail?: 'bl' | 'br' | 'tl' | 'tr' | 'none'
  color?: string; ink?: string; font: string; size?: number; type?: boolean
}> = ({ text, at = 0, x, y, w = 380, tail = 'bl', color = '#fff', ink = '#0a0a0a', font, size = 30, type = false }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const pop = spring({ frame: frame - at, fps, config: { damping: 11, stiffness: 220 } })
  const shown = type ? Math.floor(clamp((frame - at) / 20, 0, 1) * text.length) : text.length
  if (frame < at) return null
  const tailPos: Record<string, React.CSSProperties> = {
    bl: { bottom: -18, left: 40, borderWidth: '20px 16px 0 0', borderColor: `${color} transparent transparent transparent` },
    br: { bottom: -18, right: 40, borderWidth: '20px 0 0 16px', borderColor: `${color} transparent transparent transparent` },
    tl: { top: -18, left: 40, borderWidth: '0 16px 20px 0', borderColor: `transparent transparent ${color} transparent` },
    tr: { top: -18, right: 40, borderWidth: '0 0 20px 16px', borderColor: `transparent transparent ${color} transparent` },
    none: { display: 'none' },
  }
  return (
    <div style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, width: w, transform: `translate(-50%,-50%) scale(${clamp(pop, 0, 1.05)})`, transformOrigin: 'center' }}>
      <div style={{ position: 'relative', background: color, border: `4px solid ${ink}`, borderRadius: 24, padding: '18px 26px', boxShadow: '4px 4px 0 rgba(0,0,0,0.25)' }}>
        <div style={{ fontFamily: font, fontWeight: 700, fontSize: size, color: ink, lineHeight: 1.15, textAlign: 'center' }}>{text.slice(0, shown)}</div>
        <div style={{ position: 'absolute', width: 0, height: 0, borderStyle: 'solid', ...tailPos[tail] }} />
      </div>
    </div>
  )
}

// ---- CaptionBox: the rectangular narrator box (yellow, top-corner) — "MEANWHILE..."
export const CaptionBox: React.FC<{ text: string; at?: number; x?: number; y?: number; font: string; color?: string; ink?: string; size?: number }> =
({ text, at = 0, x = 8, y = 8, font, color = '#f5d76e', ink = '#0a0a0a', size = 26 }) => {
  const frame = useCurrentFrame()
  const o = interpolate(frame - at, [0, 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const sl = interpolate(frame - at, [0, 10], [-30, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  if (frame < at) return null
  return (
    <div style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, maxWidth: 620, opacity: o, transform: `translateX(${sl}px)`, background: color, border: `3px solid ${ink}`, padding: '12px 20px', boxShadow: '3px 3px 0 rgba(0,0,0,0.3)' }}>
      <div style={{ fontFamily: font, fontWeight: 800, fontSize: size, color: ink, letterSpacing: '0.01em', textTransform: 'uppercase' }}>{text}</div>
    </div>
  )
}

// ---- Burst: a jagged POW/BAM starburst with a word inside. Slams in + shakes.
// SIZED to fit the word (long words → wider star) with generous padding so the
// text is always big + readable inside the star, with an outline stroke.
export const Burst: React.FC<{ word: string; at?: number; x?: number; y?: number; color?: string; ink?: string; font: string; size?: number }> =
({ word, at = 0, x = 50, y = 50, color = '#ffcf33', ink = '#e0392f', font, size }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const f = frame - at
  const pop = spring({ frame: f, fps, config: { damping: 7, stiffness: 240 } })
  const shake = f < 10 ? Math.sin(f * 2.5) * (1 - f / 10) * 6 : 0
  if (frame < at) return null
  // BIG readable font; the star's flat center spans ~62% of its width, so the
  // star only needs to be ~1.6x the text width. Font stays large.
  const chars = word.length
  const fontSize = size ?? clamp(900 / Math.max(chars, 4), 60, 120)
  const textW = chars * fontSize * 0.6
  const w = textW / 0.62 + 60       // star flat-center holds the text, small margin
  const h = w * 0.9
  // jagged starburst via clip-path polygon
  const pts = 'polygon(50% 0%,60% 18%,82% 12%,72% 33%,98% 38%,76% 50%,92% 70%,66% 64%,69% 92%,50% 72%,31% 92%,34% 64%,8% 70%,24% 50%,2% 38%,28% 33%,18% 12%,40% 18%)'
  return (
    <div style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, transform: `translate(-50%,-50%) translateX(${shake}px) scale(${clamp(pop, 0, 1.1)}) rotate(-5deg)`, filter: `drop-shadow(0 8px 0 rgba(0,0,0,0.25))` }}>
      {/* ink outline star behind (slightly bigger) for a bold comic edge */}
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: w + 14, height: h + 14, background: ink, clipPath: pts, transform: 'translate(-50%,-50%)' }} />
      <div style={{ position: 'relative', width: w, height: h, background: color, clipPath: pts, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: font, fontWeight: 800, fontSize, color: ink, textTransform: 'uppercase', transform: 'rotate(5deg)', letterSpacing: '0.01em', WebkitTextStroke: `1px ${ink}`, whiteSpace: 'nowrap', textShadow: `2px 2px 0 rgba(255,255,255,0.5)` }}>{word}</div>
      </div>
    </div>
  )
}

// ---- MotionLines: radial speed lines from a focal point (action emphasis).
export const MotionLines: React.FC<{ at?: number; color?: string; focal?: [number, number]; count?: number }> =
({ at = 0, color = '#0a0a0a', focal = [50, 50], count = 40 }) => {
  const frame = useCurrentFrame()
  const o = interpolate(frame - at, [0, 5, 20], [0, 0.6, 0.25], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  if (frame < at) return null
  const lines = Array.from({ length: count }, (_, i) => {
    const ang = (i / count) * 360 + (frame * 0.3)
    return <div key={i} style={{ position: 'absolute', left: `${focal[0]}%`, top: `${focal[1]}%`, width: '80%', height: 3, background: `linear-gradient(90deg, transparent 55%, ${color})`, transformOrigin: 'left center', transform: `rotate(${ang}deg)` }} />
  })
  return <AbsoluteFill style={{ opacity: o, pointerEvents: 'none', overflow: 'hidden', maskImage: 'radial-gradient(circle at 50% 50%, transparent 30%, black 60%)', WebkitMaskImage: 'radial-gradient(circle at 50% 50%, transparent 30%, black 60%)' }}>{lines}</AbsoluteFill>
}

// ---- Halftone: the dot-screen overlay that makes ANYTHING read as comic.
export const Halftone: React.FC<{ opacity?: number; size?: number; color?: string }> = ({ opacity = 0.12, size = 6, color = '#0a0a0a' }) => (
  <AbsoluteFill style={{ pointerEvents: 'none', opacity, mixBlendMode: 'multiply', backgroundImage: `radial-gradient(${color} 22%, transparent 23%)`, backgroundSize: `${size}px ${size}px` }} />
)

// ---- InkFlash: a hard white flash between pages (comic page-turn beat).
export const InkFlash: React.FC<{ at: number; color?: string }> = ({ at, color = '#ffffff' }) => {
  const frame = useCurrentFrame()
  const o = interpolate(frame, [at - 2, at, at + 5], [0, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  if (o <= 0) return null
  return <AbsoluteFill style={{ background: color, opacity: o, pointerEvents: 'none', zIndex: 100 }} />
}

// ---- ComicPage: a background "paper" for a page (off-white with a subtle grain).
export const ComicPage: React.FC<{ bg?: string; children: React.ReactNode }> = ({ bg = '#e8e2d4', children }) => (
  <AbsoluteFill style={{ background: bg }}>
    {children}
    <Halftone opacity={0.06} size={5} />
  </AbsoluteFill>
)
