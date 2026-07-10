import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion'
import { loadFont as loadSans } from '@remotion/google-fonts/SourceSans3'
import { EASE } from '../motion/MotionKit'

const { fontFamily: SANS } = loadSans()
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const hexA = (h: string, a: number) => { const n = (h || '#000').replace('#', ''); const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16); return `rgba(${r},${g},${b},${a})` }

export type GlassStyle = 'subtle' | 'vivid'
export type GPalette = { bg: string; accent: string; accent2: string; text: string; muted: string }

/**
 * GlassPanel — a frosted-glass card that gives data a premium home on top of the
 * cinematic photo. It ARRIVES (scale + blur-in) with a light-sweep across it.
 *   subtle: dark translucent, hairline highlight, soft glow — "keynote" restraint
 *   vivid:  brighter blur + accent-tinted glow + stronger edge — "fintech" flash
 * backdropFilter blur is honored by Chromium (Remotion's renderer).
 */
export const GlassPanel: React.FC<{
  at: number; style: GlassStyle; palette: GPalette; children: React.ReactNode
  width?: number | string; pad?: number
}> = ({ at, style, palette, children, width = 'auto', pad = 56 }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const s = spring({ frame: frame - at, fps, config: { damping: 18, stiffness: 120 } })
  const local = frame - at
  const blurIn = (1 - s) * 14
  // light-sweep position travels left→right once on entrance
  const sweep = clamp((local - 4) / 22, 0, 1)
  const vivid = style === 'vivid'
  const glassBg = vivid ? hexA(palette.bg, 0.28) : hexA(palette.bg, 0.42)
  const border = vivid ? hexA(palette.accent, 0.5) : hexA(palette.text, 0.22)
  const glow = vivid ? `0 0 60px ${hexA(palette.accent, 0.35)}, 0 30px 80px rgba(0,0,0,0.5)` : `0 24px 70px rgba(0,0,0,0.5)`
  return (
    <div style={{
      position: 'relative', width, padding: pad, borderRadius: 10,
      background: glassBg, backdropFilter: `blur(${vivid ? 22 : 16}px)`, WebkitBackdropFilter: `blur(${vivid ? 22 : 16}px)`,
      border: `1.5px solid ${border}`, boxShadow: glow,
      opacity: s, transform: `scale(${0.9 + s * 0.1}) translateY(${(1 - s) * 24}px)`, filter: `blur(${blurIn}px)`, overflow: 'hidden',
    }}>
      {/* top-edge highlight (the "glass" catch of light) */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, background: `linear-gradient(90deg, transparent, ${hexA(palette.text, vivid ? 0.6 : 0.4)}, transparent)` }} />
      {/* accent inner glow at top for vivid */}
      {vivid && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 120, background: `radial-gradient(120% 100% at 50% 0%, ${hexA(palette.accent, 0.18)}, transparent 70%)` }} />}
      {/* light sweep on entrance */}
      <div style={{ position: 'absolute', top: 0, bottom: 0, width: 220, left: `${-30 + sweep * 130}%`, background: `linear-gradient(105deg, transparent, ${hexA(palette.text, 0.14)}, transparent)`, opacity: sweep > 0 && sweep < 1 ? 1 : 0, transform: 'skewX(-14deg)' }} />
      <div style={{ position: 'relative' }}>{children}</div>
    </div>
  )
}

/**
 * PersistentFrame — the always-on broadcast chrome: logo (or company text) top-
 * left, a small recipient tag top-right, a thin footer rule + disclaimer. Gives
 * every scene consistent designed structure. Fades in once at the start.
 */
export const PersistentFrame: React.FC<{
  palette: GPalette; company?: string; logo?: string; recipient?: string; footer?: string; total: number
}> = ({ palette, company, logo, recipient, footer, total }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const inn = spring({ frame: frame - 8, fps, config: { damping: 20, stiffness: 90 } })
  const out = interpolate(frame, [total - 20, total - 6], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const op = Math.min(inn, out)
  const light = palette.text
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', opacity: op }}>
      {/* top gradient scrim so chrome reads over any photo */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 130, background: `linear-gradient(180deg, ${hexA(palette.bg, 0.6)}, transparent)` }} />
      {/* top-left: logo or company */}
      <div style={{ position: 'absolute', top: 42, left: 56, display: 'flex', alignItems: 'center', gap: 14 }}>
        {logo
          ? <Img src={staticFile(logo)} style={{ height: 46, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.6))' }} />
          : company && <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 26, letterSpacing: '0.16em', color: light, textTransform: 'uppercase', textShadow: '0 2px 8px rgba(0,0,0,0.7)' }}>{company}</span>}
      </div>
      {/* top-right: recipient tag */}
      {recipient && (
        <div style={{ position: 'absolute', top: 46, right: 56, textAlign: 'right' }}>
          <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 15, letterSpacing: '0.28em', color: hexA(palette.accent, 0.95), textShadow: '0 2px 8px rgba(0,0,0,0.7)' }}>PREPARED FOR</div>
          <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 20, letterSpacing: '0.06em', color: light, textShadow: '0 2px 8px rgba(0,0,0,0.7)' }}>{recipient}</div>
        </div>
      )}
      {/* footer rule + disclaimer */}
      <div style={{ position: 'absolute', bottom: 40, left: 56, right: 56, display: 'flex', alignItems: 'center', gap: 18 }}>
        <div style={{ flex: 1, height: 1, background: hexA(light, 0.18) }} />
        {footer && <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 13, letterSpacing: '0.16em', color: hexA(light, 0.55) }}>{footer.toUpperCase()}</div>}
      </div>
    </AbsoluteFill>
  )
}

/** LowerThird — a documentary-style caption anchored bottom-left with an accent bar. */
export const LowerThird: React.FC<{ text: string; sub?: string; at: number; palette: GPalette; size?: number }> =
({ text, sub, at, palette, size = 84 }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const s = spring({ frame: frame - at, fps, config: { damping: 18, stiffness: 130 } })
  const barGrow = clamp((frame - at) / 12, 0, 1)
  return (
    <div style={{ position: 'absolute', left: 90, bottom: 150, maxWidth: 1500 }}>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 26 }}>
        <div style={{ width: 6, borderRadius: 3, background: palette.accent, transform: `scaleY(${barGrow})`, transformOrigin: 'top', boxShadow: `0 0 20px ${hexA(palette.accent, 0.6)}` }} />
        <div style={{ opacity: s, transform: `translateX(${(1 - s) * 30}px)` }}>
          <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: size, lineHeight: 1.04, color: palette.text, letterSpacing: '0.005em', textShadow: '0 3px 24px rgba(0,0,0,0.7)' }}>{text}</div>
          {sub && <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: size * 0.42, color: palette.muted, marginTop: 12, textShadow: '0 2px 14px rgba(0,0,0,0.7)' }}>{sub}</div>}
        </div>
      </div>
    </div>
  )
}
