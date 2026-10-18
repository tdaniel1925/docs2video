import { AbsoluteFill, Img, staticFile, useVideoConfig, spring, interpolate, Easing } from 'remotion'
import { loadFont as loadSans } from '@remotion/google-fonts/SourceSans3'
import type { GPalette } from './Glass'
import { Fit } from '../lib/fit'

const { fontFamily: SANS } = loadSans()
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const hexA = (h: string, a: number) => { const n = (h || '#000').replace('#', ''); return `rgba(${parseInt(n.slice(0,2),16)},${parseInt(n.slice(2,4),16)},${parseInt(n.slice(4,6),16)},${a})` }

/**
 * LogoReveal — cinematic OPEN. The logo emerges from darkness with a light-bloom
 * sweep, a subtle scale-settle, and a glow that blooms then calms. A thin accent
 * line draws under it. This is the "Hollywood" title card.
 *
 * The logo is capped in height as well as width (a tall logo used to push the
 * words off the bottom), and the tagline and client name sit in a fixed-width
 * column, wrapping to two lines and shrinking to fit (lib/fit).
 */
export const LogoReveal: React.FC<{ logo: string; palette: GPalette; localFrame: number; tagline?: string; recipient?: string }> =
({ logo, palette, localFrame: lf, tagline, recipient }) => {
  const { fps } = useVideoConfig()
  const rise = spring({ frame: lf, fps, config: { damping: 20, stiffness: 60 } })
  const bloom = clamp(lf / 18, 0, 1) * clamp(1 - (lf - 26) / 30, 0, 1)   // glow blooms then settles
  const sweep = clamp((lf - 8) / 26, 0, 1)
  const lineGrow = clamp((lf - 22) / 16, 0, 1)
  const tag = spring({ frame: lf - 30, fps, config: { damping: 18, stiffness: 90 } })
  const rcp = spring({ frame: lf - 40, fps, config: { damping: 18, stiffness: 90 } })
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
      {/* radial glow behind logo */}
      <AbsoluteFill style={{ background: `radial-gradient(700px 500px at 50% 44%, ${hexA(palette.accent, 0.12 + bloom * 0.22)}, transparent 60%)` }} />
      <div style={{ position: 'relative', opacity: clamp(lf / 10, 0, 1), transform: `scale(${0.86 + rise * 0.14}) translateY(${(1 - rise) * 18}px)` }}>
        <Img src={staticFile(logo)} style={{ display: 'block', width: 640, maxHeight: 420, objectFit: 'contain', filter: `drop-shadow(0 8px 40px ${hexA(palette.accent, 0.3 + bloom * 0.3)})` }} />
        {/* light sweep across the logo on entrance */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, bottom: 0, width: 260, left: `${-30 + sweep * 130}%`, background: `linear-gradient(105deg, transparent, ${hexA('#ffffff', 0.35)}, transparent)`, transform: 'skewX(-14deg)', opacity: sweep > 0 && sweep < 1 ? 1 : 0, mixBlendMode: 'screen' }} />
        </div>
      </div>
      <div style={{ width: 260 * lineGrow, height: 2, marginTop: 40, background: `linear-gradient(90deg, transparent, ${palette.accent}, transparent)`, boxShadow: `0 0 16px ${hexA(palette.accent, 0.6)}` }} />
      {tagline && (
        <div style={{ marginTop: 26, width: 1400, maxWidth: '90%', textAlign: 'center', opacity: tag }}>
          <Fit max={30} min={16} lines={2} style={{ fontFamily: SANS, fontWeight: 600, letterSpacing: '0.14em', color: palette.muted, textShadow: '0 2px 10px rgba(0,0,0,0.6)', lineHeight: 1.25 }}>{tagline}</Fit>
        </div>
      )}
      {/* "Prepared for [Client]" — the personalized cover line. Always shown on
          an explainer with a named recipient, under the logo + tagline. */}
      {recipient && (
        <div style={{ marginTop: 34, width: 1400, maxWidth: '90%', opacity: rcp, textAlign: 'center' }}>
          <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 17, letterSpacing: '0.28em', textTransform: 'uppercase', color: palette.accent }}>Prepared for</div>
          <Fit max={34} min={18} lines={2} style={{ fontFamily: SANS, fontWeight: 800, letterSpacing: '0.01em', color: palette.text, marginTop: 8, textShadow: '0 2px 12px rgba(0,0,0,0.6)', lineHeight: 1.2 }}>{recipient}</Fit>
        </div>
      )}
    </AbsoluteFill>
  )
}

export type Presenter = { name?: string; role?: string; photo?: string }

/**
 * LogoClose — the SIGN-OFF. Presenter headshot (if provided) OR logo/company,
 * plus contact/CTA info, calm push-in, accent glow. When a presenter photo is
 * present it takes precedence — people present as themselves, not a company
 * (matches the V3 ClosingCard treatment: circular portrait, accent ring, glow).
 *
 * Everything sits in a 1500px column that slowly grows 10% (the push-in), so
 * even at its biggest it stays inside the frame. Each line — name, role,
 * company, call to action, contact — wraps to two lines and shrinks to fit
 * (lib/fit); a long email or web address can't run off the edge.
 */
export const LogoClose: React.FC<{ logo?: string; company?: string; palette: GPalette; localFrame: number; cta?: string; contact?: string; total?: number; presenter?: Presenter }> =
({ logo, company, palette, localFrame: lf, cta, contact, presenter }) => {
  const { fps } = useVideoConfig()
  const s = spring({ frame: lf, fps, config: { damping: 20, stiffness: 70 } })
  const ctaS = spring({ frame: lf - 26, fps, config: { damping: 18, stiffness: 100 } })
  const push = 1 + interpolate(lf, [0, 200], [0, 0.10], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.quad) })
  const appear = Math.max(s, lf > 20 ? 1 : s)
  const bloom = interpolate(lf, [0, 90], [0.12, 0.22], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const acc = palette.accent
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', textAlign: 'center' }}>
      <AbsoluteFill style={{ background: `radial-gradient(760px 640px at 50% 46%, ${hexA(acc, bloom)}, transparent 62%)` }} />
      <div style={{ transform: `scale(${push})`, opacity: appear, display: 'flex', flexDirection: 'column', alignItems: 'center', width: 1500, maxWidth: '82%' }}>
        {presenter?.photo ? (
          // presenter headshot — circular portrait with accent ring + glow, name/role below
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%' }}>
            <Img src={staticFile(presenter.photo)} style={{ width: 176, height: 176, borderRadius: '50%', objectFit: 'cover', border: `5px solid ${palette.text}`, outline: `2px solid ${acc}`, boxShadow: `0 0 34px ${hexA(acc, 0.5)}` }} />
            {presenter.name && <Fit max={60} min={28} lines={2} style={{ fontFamily: SANS, fontWeight: 900, letterSpacing: '0.01em', color: palette.text, textShadow: '0 4px 30px rgba(0,0,0,0.6)', lineHeight: 1.1 }}>{presenter.name}</Fit>}
            {(presenter.role || company) && <Fit max={26} min={15} lines={2} style={{ fontFamily: SANS, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: acc, lineHeight: 1.2 }}>{presenter.role || company}</Fit>}
          </div>
        ) : logo
          ? <Img src={staticFile(logo)} style={{ display: 'block', width: 520, maxHeight: 360, objectFit: 'contain', transform: `scale(${0.9 + s * 0.1})`, filter: `drop-shadow(0 8px 36px ${hexA(acc, 0.35)})` }} />
          : company && <Fit max={100} min={40} lines={2} style={{ fontFamily: SANS, fontWeight: 900, letterSpacing: '0.04em', color: palette.text, textShadow: '0 4px 30px rgba(0,0,0,0.6)', lineHeight: 1.08 }}>{company}</Fit>}
        {cta && <Fit max={42} min={22} lines={2} style={{ fontFamily: SANS, fontWeight: 800, letterSpacing: '0.1em', color: acc, marginTop: 42, opacity: ctaS, lineHeight: 1.2 }}>{cta}</Fit>}
        {contact && <Fit max={27} min={16} lines={2} style={{ fontFamily: SANS, fontWeight: 700, letterSpacing: '0.18em', color: palette.text, marginTop: 20, opacity: ctaS, lineHeight: 1.3 }}>{contact}</Fit>}
      </div>
    </AbsoluteFill>
  )
}
