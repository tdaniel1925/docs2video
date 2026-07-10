import { AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing, Img } from 'remotion'
import { loadFont as loadArchivo } from '@remotion/google-fonts/Archivo'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import { fitText } from '@remotion/layout-utils'
import { ShaderBackdrop } from './ShaderBackdrop'
// Scene3D (R3F) disabled — @react-three/fiber@8 needs React 18 internals that
// React 19 removed (ReactCurrentBatchConfig). Replaced with a CSS-3D
// perspective flythrough below, which needs no React-Three and looks equivalent
// for a single flat UI panel.

const { fontFamily: ARCHIVO } = loadArchivo()
const { fontFamily: INTER } = loadInter()

/**
 * CinematicHeroShowcase — the flagship "how far can it go" render. Three beats,
 * each showing a frontier technique so you can feel the ceiling:
 *   A) shader fluid backdrop + type that assembles per-character
 *   B) a UI screenshot flying through REAL 3D space, camera dollying in
 *   C) a big finish with the logo, lens-flare glow, and settle
 * Brand blue/orange. 12s. Music/VO can be layered later; this proves the visuals.
 */

export const CINE_FRAMES = 360 // 12s @30
const CREAM = '#f4f7fb'
const BLUE = '#4a9fe0'
const ORANGE = '#f5a623'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

// Per-character assemble-in: letters fly in from scattered positions + rotation
const AssembleWord: React.FC<{ text: string; at: number; size: number; color?: string; y?: number }> = ({ text, at, size, color = CREAM, y = 0 }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const chars = text.split('')
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 0, transform: `translateY(${y}px)` }}>
      {chars.map((c, i) => {
        const s = spring({ frame: frame - (at + i * 2.2), fps, config: { damping: 12, stiffness: 140, mass: 0.7 } })
        const seed = (i * 97) % 11 - 5
        return (
          <span key={i} style={{
            fontFamily: ARCHIVO, fontWeight: 800, fontSize: size, color, letterSpacing: '-0.02em',
            display: 'inline-block', opacity: s,
            transform: `translate(${(1 - s) * seed * 30}px, ${(1 - s) * -120}px) rotate(${(1 - s) * seed * 12}deg) scale(${0.3 + s * 0.7})`,
            textShadow: color !== CREAM ? `0 0 40px ${color}66` : '0 4px 30px rgba(0,0,0,0.6)',
            whiteSpace: 'pre',
          }}>{c}</span>
        )
      })}
    </div>
  )
}

export const CinematicHeroShowcase: React.FC = () => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()

  // beat windows
  const A = { in: 0, out: 120 }     // type + shader
  const B = { in: 110, out: 250 }   // 3D UI flythrough
  const C = { in: 240, out: CINE_FRAMES } // logo finish

  const fade = (inF: number, outF: number) =>
    interpolate(frame, [inF, inF + 14, outF - 14, outF], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) })

  // continuous slow zoom on the whole frame (never static)
  const megaZoom = 1 + interpolate(frame, [0, CINE_FRAMES], [0, 0.06])

  return (
    <AbsoluteFill style={{ background: '#05080d' }}>
      {/* GPU shader backdrop — always alive, tinted brand blue */}
      <AbsoluteFill style={{ transform: `scale(${megaZoom})` }}>
        <ShaderBackdrop c1="#060b14" c2="#123a52" c3={BLUE} />
      </AbsoluteFill>

      {/* BEAT A — assembling type over the fluid */}
      {frame < A.out + 20 && (
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', opacity: fade(A.in, A.out) }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: INTER, fontWeight: 700, fontSize: 30, letterSpacing: '0.4em', color: ORANGE, marginBottom: 30, opacity: interpolate(frame, [8, 26], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }) }}>DOCS2VIDEO</div>
            <AssembleWord text="DOCUMENTS" at={14} size={150} />
            <div style={{ height: 12 }} />
            <AssembleWord text="THAT MOVE" at={40} size={150} color={BLUE} />
          </div>
        </AbsoluteFill>
      )}

      {/* BEAT B — UI screenshot flying through CSS-3D perspective space */}
      {frame >= B.in - 10 && frame < B.out + 10 && (() => {
        const t = Math.max(0, frame - B.in)
        const p = Easing.inOut(Easing.cubic)(interpolate(t, [0, 1.6 * fps], [0, 1], { extrapolateRight: 'clamp' }))
        // camera reveal: panel starts far, steeply angled, off to the side;
        // flies IN and levels out. Real perspective via translateZ + rotateY.
        const tz = interpolate(p, [0, 1], [-1400, -120])   // depth
        const ry = interpolate(p, [0, 1], [42, -7])         // yaw
        const rx = interpolate(p, [0, 1], [14, 3])          // pitch
        const tx = interpolate(p, [0, 1], [-380, 40])       // slide across
        const op = interpolate(t, [0, 0.4 * fps], [0, 1], { extrapolateRight: 'clamp' })
        // continuous drift once settled
        const dy = Math.sin(t * 0.045) * 10
        const glow = clamp(Math.sin(t * 0.06) * 0.5 + 0.5, 0, 1)
        return (
          <AbsoluteFill style={{ opacity: fade(B.in, B.out), perspective: 1600, perspectiveOrigin: '50% 42%' }}>
            <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', transformStyle: 'preserve-3d' }}>
              <div style={{
                width: 1180, transformStyle: 'preserve-3d',
                transform: `translateX(${tx}px) translateY(${dy}px) translateZ(${tz}px) rotateY(${ry}deg) rotateX(${rx}deg)`,
                opacity: op, borderRadius: 16, overflow: 'hidden',
                boxShadow: `0 60px 140px rgba(0,0,0,0.7), 0 0 ${40 + glow * 60}px ${BLUE}44`,
                border: `1px solid ${BLUE}44`,
              }}>
                <Img src={staticFile('ui-2.png')} style={{ width: '100%', display: 'block' }} />
              </div>
            </AbsoluteFill>
            {/* animated cursor moving to the Approve button + click ring */}
            {(() => {
              const cp = clamp(interpolate(t, [0.7 * fps, 1.5 * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }), 0, 1)
              const cx = interpolate(cp, [0, 1], [64, 30])  // % across
              const cy = interpolate(cp, [0, 1], [40, 70])  // % down
              const click = clamp(1 - (t - 1.5 * fps) / 8, 0, 1) * (t > 1.5 * fps ? 1 : 0)
              return op > 0.9 ? (
                <div style={{ position: 'absolute', left: `${cx}%`, top: `${cy}%`, zIndex: 5 }}>
                  <div style={{ position: 'absolute', width: 60, height: 60, borderRadius: 40, border: `3px solid ${ORANGE}`, transform: `translate(-30px,-30px) scale(${1 + (1 - click) * 1.4})`, opacity: click * 0.9 }} />
                  <svg width="30" height="34" viewBox="0 0 24 27" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}><path d="M1 1 L1 20 L6 15 L9 22 L12 21 L9 14 L16 14 Z" fill="#fff" stroke="#111" strokeWidth="1.2" /></svg>
                </div>
              ) : null
            })()}
            <div style={{ position: 'absolute', bottom: 110, width: '100%', textAlign: 'center' }}>
              <FitLine text="AI WRITES IT. YOU DIRECT IT." at={B.in + 20} size={68} color={CREAM} maxW={1500} />
            </div>
          </AbsoluteFill>
        )
      })()}

      {/* BEAT C — logo finish with lens flare */}
      {frame >= C.in - 10 && (() => {
        const t = frame - C.in
        const s = spring({ frame: t, fps, config: { damping: 16, stiffness: 90 } })
        const flare = clamp(Math.sin(t * 0.06) * 0.5 + 0.5, 0, 1)
        return (
          <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', opacity: fade(C.in, C.out) }}>
            {/* radial flare behind logo */}
            <AbsoluteFill style={{ background: `radial-gradient(600px 600px at 50% 46%, ${BLUE}${Math.round(20 + flare * 30).toString(16).padStart(2, '0')} 0%, transparent 60%)` }} />
            <div style={{ textAlign: 'center' }}>
              <Img src={staticFile('d2v-logo.png')} style={{ width: 780, opacity: s, transform: `scale(${0.8 + s * 0.2})`, filter: `drop-shadow(0 10px 50px ${BLUE}66)` }} />
              <div style={{ fontFamily: INTER, fontWeight: 700, fontSize: 26, letterSpacing: '0.24em', color: ORANGE, marginTop: 44, opacity: spring({ frame: t - 30, fps, config: { damping: 16, stiffness: 110 } }) }}>CINEMATIC · BY DESIGN</div>
            </div>
          </AbsoluteFill>
        )
      })()}

      {/* global grain + vignette overlay for cohesion */}
      <AbsoluteFill style={{ background: 'radial-gradient(130% 130% at 50% 45%, transparent 52%, rgba(0,0,0,0.6) 100%)', pointerEvents: 'none' }} />
    </AbsoluteFill>
  )
}

const FitLine: React.FC<{ text: string; at: number; size: number; color: string; maxW: number }> = ({ text, at, size, color, maxW }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const { fontSize: fit } = fitText({ text, withinWidth: maxW, fontFamily: ARCHIVO, fontWeight: 800 })
  const s = spring({ frame: frame - at, fps, config: { damping: 15, stiffness: 180 } })
  return <div style={{ fontFamily: ARCHIVO, fontWeight: 800, fontSize: Math.min(size, fit * 0.94), color, opacity: s, transform: `translateY(${(1 - s) * 24}px)`, letterSpacing: '-0.02em', textShadow: '0 3px 26px rgba(0,0,0,0.7)', whiteSpace: 'nowrap' }}>{text}</div>
}
