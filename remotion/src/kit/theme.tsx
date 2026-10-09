import React, { createContext, useContext, useMemo } from 'react'
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from 'remotion'
import { staticFile } from '../lib/asset'
import { Fit } from '../lib/fit'
import { kitFont } from './fonts'
import { FEEL, guardLook, isPlatformName, rgba, mix, type KitBrand, type Look, type LookTokens } from './spec'

// =============================================================================
// THEME — one look, read by every scene.
//
// KitTheme puts the guarded look (spec.ts guardLook: contrast fixed) into a
// React context. Scenes never pick a colour or a font themselves: they ask
// useKit() for `t` (colours), `head`/`body` (fonts) and `speed` (from the
// feel). That is what lets the coming look wizard restyle every scene by
// changing settings, never code.
// =============================================================================

export type KitTheme = {
  look: Look
  t: LookTokens
  head: string
  body: string
  headWeight: number
  /** Motion speed: 0.8 calm, 1 premium, 1.3 energetic. */
  speed: number
  brand: KitBrand
  recipient?: string
  upper: boolean
}

const Ctx = createContext<KitTheme | null>(null)

export const KitThemeProvider: React.FC<{ look: Look; brand: KitBrand; recipient?: string; children: React.ReactNode }> = ({ look, brand, recipient, children }) => {
  const value = useMemo<KitTheme>(() => {
    const g = guardLook(look)
    return {
      look: g.look, t: g.tokens,
      head: kitFont(g.look.headFont), body: kitFont(g.look.bodyFont),
      headWeight: g.look.headWeight ?? 800,
      speed: FEEL[g.look.feel].speed,
      brand: { ...brand, name: isPlatformName(brand?.name) ? undefined : brand?.name },
      recipient: isPlatformName(recipient) ? undefined : recipient,
      upper: g.look.upperLabels !== false,
    }
  }, [look, brand, recipient])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useKit(): KitTheme {
  const v = useContext(Ctx)
  if (!v) throw new Error('Kit scene rendered outside KitThemeProvider')
  return v
}

// ── THE GRID ─────────────────────────────────────────────────────────────────
// Every scene lays out inside the same 16:9 frame: a chrome band on top (logo,
// "Prepared for"), the content box, and a thin footer band (progress line).
export const GRID = {
  side: 120,
  top: 150,
  bottom: 118,
  get width() { return 1920 - this.side * 2 },
  get height() { return 1080 - this.top - this.bottom },
} as const

/** Minimum readable text sizes (px at 1080p), per role. Fit never goes below these without QA saying so. */
export const MIN_TEXT = { hero: 96, headline: 56, heading: 44, body: 32, label: 22, small: 20 } as const

// ── BACKGROUND ───────────────────────────────────────────────────────────────
// Always moving, never busy: big soft shapes drift slowly so even a long hold
// on one scene is never a frozen picture.

export const KitBackground: React.FC<{ seed?: number }> = ({ seed = 0 }) => {
  const frame = useCurrentFrame() + seed * 37
  const { t, look } = useKit()
  const s = look.background
  const drift = (a: number, b: number) => Math.sin(frame * a + b)
  if (s === 'paper') {
    return (
      <AbsoluteFill style={{ background: t.bg }}>
        <AbsoluteFill style={{ background: `radial-gradient(1200px 820px at ${50 + drift(0.004, 1) * 8}% ${40 + drift(0.003, 2) * 6}%, ${rgba('#ffffff', t.dark ? 0.04 : 0.55)}, transparent 70%)` }} />
        <AbsoluteFill style={{ background: `radial-gradient(900px 700px at ${82 + drift(0.005, 3) * 5}% ${88 + drift(0.004, 0) * 4}%, ${rgba(t.glow, 0.7)}, transparent 70%)` }} />
        <PaperGrain />
        <AbsoluteFill style={{ boxShadow: `inset 0 0 220px ${rgba(mix(t.bg, '#5a4630', 0.6), 0.22)}` }} />
      </AbsoluteFill>
    )
  }
  if (s === 'solid') {
    return (
      <AbsoluteFill style={{ background: t.bg }}>
        <AbsoluteFill style={{ background: `radial-gradient(1400px 900px at ${50 + drift(0.003, 0) * 10}% ${45 + drift(0.004, 1) * 6}%, ${rgba(t.dark ? '#ffffff' : t.glow, t.dark ? 0.035 : 0.5)}, transparent 72%)` }} />
        <AbsoluteFill style={{ boxShadow: `inset 0 0 260px ${rgba('#000000', t.dark ? 0.45 : 0.06)}` }} />
      </AbsoluteFill>
    )
  }
  if (s === 'gradient') {
    const ang = 135 + drift(0.002, 0) * 10
    return (
      <AbsoluteFill style={{ background: `linear-gradient(${ang}deg, ${t.bg} 0%, ${mix(t.bg, t.glow, 0.55)} 100%)` }}>
        <AbsoluteFill style={{ background: `radial-gradient(1000px 760px at ${78 + drift(0.004, 2) * 9}% ${22 + drift(0.005, 1) * 8}%, ${rgba(t.glow, t.dark ? 0.45 : 0.85)}, transparent 68%)` }} />
        <AbsoluteFill style={{ background: `radial-gradient(800px 640px at ${12 + drift(0.005, 4) * 7}% ${86 + drift(0.004, 3) * 5}%, ${rgba(t.accent, t.dark ? 0.16 : 0.1)}, transparent 70%)` }} />
        <AbsoluteFill style={{ boxShadow: `inset 0 0 240px ${rgba('#000000', t.dark ? 0.5 : 0.05)}` }} />
      </AbsoluteFill>
    )
  }
  // glow (default): a deep page with two slow light pools.
  return (
    <AbsoluteFill style={{ background: t.bg }}>
      <AbsoluteFill style={{ background: `radial-gradient(1150px 860px at ${30 + drift(0.0042, 0) * 12}% ${30 + drift(0.0035, 1) * 10}%, ${rgba(t.glow, 0.85)}, transparent 66%)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(900px 720px at ${76 + drift(0.0038, 2) * 10}% ${72 + drift(0.0047, 3) * 9}%, ${rgba(t.accent, t.dark ? 0.13 : 0.08)}, transparent 66%)` }} />
      <AbsoluteFill style={{ boxShadow: `inset 0 0 280px ${rgba('#000000', t.dark ? 0.55 : 0.06)}` }} />
    </AbsoluteFill>
  )
}

// Fibre-like paper grain, code-drawn (SVG noise) — no image file.
const PaperGrain: React.FC = () => (
  <AbsoluteFill style={{ opacity: 0.32, mixBlendMode: 'multiply' }}>
    <svg width="1920" height="1080" style={{ position: 'absolute', inset: 0 }}>
      <filter id="kit-paper"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /><feComponentTransfer><feFuncA type="table" tableValues="0 0.18" /></feComponentTransfer></filter>
      <rect width="100%" height="100%" filter="url(#kit-paper)" />
    </svg>
  </AbsoluteFill>
)

// ── LOGO ─────────────────────────────────────────────────────────────────────
// REAL uploaded logos only — never drawn. The look's logo mode decides:
//  auto  — the light version on a dark page / the dark version on a light
//          page (from the brand's logo kit); when we can't tell a version
//          reads, it sits on a white card.
//  plate — always on a white card.
//  text  — the brand name as words.
// No logo → the name as words. No name → nothing (never our platform's name).

export function pickLogo(brand: KitBrand, dark: boolean, mode: Look['logoMode']): { src?: string; plate: boolean } {
  const L = brand.logo || {}
  if (mode === 'text') return { plate: false }
  if (mode === 'plate') return { src: L.dark || L.any || L.light, plate: true }
  if (dark && L.light) return { src: L.light, plate: false }
  if (!dark && L.dark) return { src: L.dark, plate: false }
  const any = L.any || L.light || L.dark
  return any ? { src: any, plate: true } : { plate: false }
}

export const KitLogo: React.FC<{ height: number; maxWidth: number; align?: 'left' | 'center' | 'right'; nameSize?: number }> = ({ height, maxWidth, align = 'left', nameSize }) => {
  const { brand, t, look, head } = useKit()
  const pick = pickLogo(brand, t.dark, look.logoMode)
  const justify = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start'
  if (pick.src) {
    const img = <Img src={staticFile(pick.src)} style={{ height, maxWidth: pick.plate ? maxWidth - 36 : maxWidth, objectFit: 'contain', display: 'block' }} />
    return (
      <div style={{ display: 'flex', justifyContent: justify, width: maxWidth }}>
        {pick.plate
          ? <div style={{ background: '#ffffff', padding: '12px 18px', borderRadius: t.radius, boxShadow: `0 6px 24px ${rgba('#000000', 0.18)}` }}>{img}</div>
          : img}
      </div>
    )
  }
  if (!brand.name) return null
  return (
    <div style={{ width: maxWidth }}>
      <Fit max={nameSize ?? Math.round(height * 0.62)} min={18} lines={2} style={{ fontFamily: head, fontWeight: 700, color: t.text, letterSpacing: '0.02em', lineHeight: 1.15, textAlign: align }}>{brand.name}</Fit>
    </div>
  )
}

// ── CHROME ───────────────────────────────────────────────────────────────────
// The frame around content scenes: logo top-left, "Prepared for" top-right,
// and a thin progress line along the bottom that keeps moving the whole video.

export const KitChrome: React.FC<{ globalFrame: number; total: number; showTag: boolean }> = ({ globalFrame, total, showTag }) => {
  const { t, recipient, body, upper } = useKit()
  const frame = useCurrentFrame()
  const inO = interpolate(frame, [0, 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const prog = Math.max(0, Math.min(1, globalFrame / Math.max(1, total)))
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: GRID.side, top: 46, opacity: inO }}>
        <KitLogo height={52} maxWidth={420} nameSize={30} />
      </div>
      {showTag && recipient ? (
        <div style={{ position: 'absolute', right: GRID.side, top: 50, width: 520, textAlign: 'right', opacity: inO }}>
          <div style={{ fontFamily: body, fontWeight: 700, fontSize: 18, letterSpacing: upper ? '0.22em' : '0.04em', textTransform: upper ? 'uppercase' : 'none', color: t.accentInk }}>Prepared for</div>
          <Fit max={28} min={18} lines={2} style={{ fontFamily: body, fontWeight: 700, color: t.text, lineHeight: 1.2, marginTop: 4, textAlign: 'right' }}>{recipient}</Fit>
        </div>
      ) : null}
      <div style={{ position: 'absolute', left: GRID.side, right: GRID.side, bottom: 58, height: 3, background: t.surfaceLine, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${prog * 100}%`, height: '100%', background: t.accentBig, opacity: 0.85 }} />
      </div>
    </AbsoluteFill>
  )
}
