import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, spring, interpolate, Easing } from 'remotion'
import { loadFont as loadSans } from '@remotion/google-fonts/SourceSans3'
import type { GPalette } from './Glass'

const { fontFamily: SANS } = loadSans()
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const hexA = (h: string, a: number) => { const n = (h || '#000').replace('#', ''); return `rgba(${parseInt(n.slice(0,2),16)},${parseInt(n.slice(2,4),16)},${parseInt(n.slice(4,6),16)},${a})` }

/**
 * LogoReveal — cinematic OPEN. The logo emerges from darkness with a light-bloom
 * sweep, a subtle scale-settle, and a glow that blooms then calms. A thin accent
 * line draws under it. This is the "Hollywood" title card.
 */
export const LogoReveal: React.FC<{ logo: string; palette: GPalette; localFrame: number; tagline?: string }> =
({ logo, palette, localFrame: lf, tagline }) => {
  const { fps } = useVideoConfig()
  const rise = spring({ frame: lf, fps, config: { damping: 20, stiffness: 60 } })
  const bloom = clamp(lf / 18, 0, 1) * clamp(1 - (lf - 26) / 30, 0, 1)   // glow blooms then settles
  const sweep = clamp((lf - 8) / 26, 0, 1)
  const lineGrow = clamp((lf - 22) / 16, 0, 1)
  const tag = spring({ frame: lf - 30, fps, config: { damping: 18, stiffness: 90 } })
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
      {/* radial glow behind logo */}
      <AbsoluteFill style={{ background: `radial-gradient(700px 500px at 50% 44%, ${hexA(palette.accent, 0.12 + bloom * 0.22)}, transparent 60%)` }} />
      <div style={{ position: 'relative', opacity: clamp(lf / 10, 0, 1), transform: `scale(${0.86 + rise * 0.14}) translateY(${(1 - rise) * 18}px)` }}>
        <Img src={staticFile(logo)} style={{ width: 640, filter: `drop-shadow(0 8px 40px ${hexA(palette.accent, 0.3 + bloom * 0.3)})` }} />
        {/* light sweep across the logo on entrance */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, bottom: 0, width: 260, left: `${-30 + sweep * 130}%`, background: `linear-gradient(105deg, transparent, ${hexA('#ffffff', 0.35)}, transparent)`, transform: 'skewX(-14deg)', opacity: sweep > 0 && sweep < 1 ? 1 : 0, mixBlendMode: 'screen' }} />
        </div>
      </div>
      <div style={{ width: 260 * lineGrow, height: 2, marginTop: 40, background: `linear-gradient(90deg, transparent, ${palette.accent}, transparent)`, boxShadow: `0 0 16px ${hexA(palette.accent, 0.6)}` }} />
      {tagline && <div style={{ marginTop: 26, fontFamily: SANS, fontWeight: 600, fontSize: 30, letterSpacing: '0.14em', color: palette.muted, opacity: tag, textShadow: '0 2px 10px rgba(0,0,0,0.6)' }}>{tagline}</div>}
    </AbsoluteFill>
  )
}

/**
 * LogoClose — the SIGN-OFF. Logo + contact/CTA info, calm push-in, accent glow.
 */
export const LogoClose: React.FC<{ logo?: string; company?: string; palette: GPalette; localFrame: number; cta?: string; contact?: string; total?: number }> =
({ logo, company, palette, localFrame: lf, cta, contact, total }) => {
  const { fps } = useVideoConfig()
  const s = spring({ frame: lf, fps, config: { damping: 20, stiffness: 70 } })
  const ctaS = spring({ frame: lf - 26, fps, config: { damping: 18, stiffness: 100 } })
  // CLOSING = the strongest moment. It GROWS slowly and HOLDS to the last frame —
  // NEVER shrinks or fades away (a call-to-action should end at full presence).
  // A continuous, un-clamped-on-the-right push-in keeps growing the whole scene.
  const push = 1 + interpolate(lf, [0, 200], [0, 0.10], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.quad) })
  // entrance only lifts opacity IN — it never drops (Math.max floors it at full).
  const appear = Math.max(s, lf > 20 ? 1 : s)
  // a gentle accent bloom that swells toward the end so the finish feels intentional.
  const bloom = interpolate(lf, [0, 90], [0.12, 0.22], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', textAlign: 'center' }}>
      <AbsoluteFill style={{ background: `radial-gradient(760px 640px at 50% 46%, ${hexA(palette.accent, bloom)}, transparent 62%)` }} />
      <div style={{ transform: `scale(${push})`, opacity: appear }}>
        {logo
          ? <Img src={staticFile(logo)} style={{ width: 520, transform: `scale(${0.9 + s * 0.1})`, filter: `drop-shadow(0 8px 36px ${hexA(palette.accent, 0.35)})` }} />
          : company && <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: 100, letterSpacing: '0.04em', color: palette.text, textShadow: '0 4px 30px rgba(0,0,0,0.6)' }}>{company}</div>}
        {cta && <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 42, letterSpacing: '0.1em', color: palette.accent, marginTop: 42, opacity: ctaS }}>{cta}</div>}
        {contact && <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 27, letterSpacing: '0.18em', color: palette.text, marginTop: 20, opacity: ctaS }}>{contact}</div>}
      </div>
    </AbsoluteFill>
  )
}
