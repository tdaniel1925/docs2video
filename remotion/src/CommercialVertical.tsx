import React from 'react'
import {
  AbsoluteFill, Sequence, Audio, Img, staticFile, useCurrentFrame, useVideoConfig,
  interpolate, spring, Easing,
} from 'remotion'

/* ============================================================================
 * JORDYN — VERTICAL video template. ONE component, driven by a `vert` prop that
 * points at public/vert-<id>/ (scenes f-0..f-N, vo-0..vo-N, music, logo,
 * data.json with {vo[], label, tagIntro, captions[]}). Flat-editorial style,
 * intro + corner logo + end. Used for the 9 industry films (~85s, 10 beats),
 * the 10 funnel-pain films (~40s, 6 beats), and the Apex cut.
 *
 * A `theme` prop swaps the palette and end-card copy. 'jordyn' is the warm
 * cream/terracotta system the site uses and is the default, so every film built
 * before themes existed renders byte-identically. 'apex' is the navy/red/white
 * of reachtheapex.net, for the torn-paper Apex cut — those colours are sampled
 * from the RENDERED page, not from its CSS, which still carries dead Bootstrap
 * rules (#2b4c7e navy, #c2914a gold) that never actually paint.
 * ==========================================================================*/

const FPS = 30
const FONT = 'Archivo, Inter, system-ui, sans-serif'
const EASE = { expoOut: Easing.bezier(0.16, 1, 0.3, 1), backOut: Easing.bezier(0.34, 1.56, 0.64, 1) }
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))

type Theme = {
  paper: string; ink: string; soft: string; accent: string
  blob1: string; blob2: string; blob3: string
  card: string; cardBorder: string; cardShadow: string; logoShadow: string
  endTagA: string; endTagB: string; endUrl: string; endSub: string
  /** Optional second logo on the end card (e.g. the Apex mark under Jordyn's). */
  endLogo?: string
}

export const THEMES: Record<string, Theme> = {
  jordyn: {
    paper: '#faf9f5', ink: '#3f3a33', soft: '#7a6d5c', accent: '#c4623f',
    blob1: '#8faa7233', blob2: '#c4623f22', blob3: '#c78a2a22',
    card: 'rgba(250,249,245,0.93)', cardBorder: 'rgba(200,150,110,0.2)',
    cardShadow: '0 20px 56px rgba(150,110,80,0.22)',
    logoShadow: 'drop-shadow(0 8px 22px rgba(150,90,60,0.28))',
    endTagA: 'Not a tool you operate. ', endTagB: 'An assistant that works.',
    endUrl: 'jordyn.app', endSub: 'free for 3 days',
  },
  apex: {
    paper: '#f5f7fb', ink: '#1e3a72', soft: '#5a6b8a', accent: '#cc2027',
    blob1: '#1e3a7226', blob2: '#cc202719', blob3: '#1e3a7214',
    card: 'rgba(255,255,255,0.94)', cardBorder: 'rgba(30,58,114,0.18)',
    cardShadow: '0 20px 56px rgba(20,40,80,0.20)',
    logoShadow: 'drop-shadow(0 8px 22px rgba(20,40,80,0.26))',
    endTagA: 'Any AI can check your email. ', endTagB: 'Jordyn runs it.',
    endUrl: 'reachtheapex.net', endSub: 'Apex rep pricing — $129/mo',
    endLogo: 'apex-logo.png',
  },
}

const ThemeCtx = React.createContext<Theme>(THEMES.jordyn)
const useT = () => React.useContext(ThemeCtx)

type Caption = { kicker?: string; head?: string; sub?: string; accent?: string; small?: boolean; logoHead?: string; finale?: boolean }
type VData = { vo: number[]; label: string; tagIntro: string; captions: Caption[] }
export type VertProps = { vert: string; theme?: string }

const grainSVG = encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(#n)' opacity='0.5'/></svg>`)
const Grain: React.FC = () => <AbsoluteFill style={{ pointerEvents: 'none', backgroundImage: `url("data:image/svg+xml,${grainSVG}")`, mixBlendMode: 'multiply', opacity: 0.04 }} />

const S = (sec: number) => Math.round(sec * FPS)

const useData = (vert: string): VData | null => {
  const [d, setD] = React.useState<VData | null>(null)
  React.useEffect(() => { let c = false; fetch(staticFile(`vert-${vert}/data.json`)).then((r) => r.json()).then((j) => { if (!c) setD(j) }).catch(() => {}); return () => { c = true } }, [vert])
  return d
}

const Scene: React.FC<{ vert: string; i: number; push?: number; focusX?: number; focusY?: number }> =
({ vert, i, push = 0.06, focusX = 50, focusY = 50 }) => {
  const t = useT()
  const f = useCurrentFrame(); const { durationInFrames } = useVideoConfig()
  const p = interpolate(f, [0, durationInFrames], [0, 1], { extrapolateRight: 'clamp', easing: EASE.expoOut })
  const scale = 1.03 + p * push, tx = (50 - focusX) * p * 0.1, ty = (50 - focusY) * p * 0.1
  const drift = Math.sin(f * 0.04) * 3
  return (
    <AbsoluteFill style={{ background: t.paper, overflow: 'hidden' }}>
      <Img src={staticFile(`vert-${vert}/f-${i}.png`)} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale}) translate(${tx}%, ${ty + drift * 0.05}%)` }} />
    </AbsoluteFill>
  )
}

const Card: React.FC<{ children: React.ReactNode; at?: number; align?: 'center' | 'flex-start' }> = ({ children, at = 4, align = 'center' }) => {
  const t = useT()
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const s = spring({ frame: f - at, fps, config: { damping: 16, stiffness: 130 } })
  return <div style={{ display: 'flex', flexDirection: 'column', alignItems: align, gap: 10, background: t.card, borderRadius: 24, padding: '30px 50px', boxShadow: t.cardShadow, border: `1px solid ${t.cardBorder}`, transform: `translateY(${(1 - s) * 28}px)`, opacity: clamp(s), backdropFilter: 'blur(6px)', maxWidth: 1350 }}>{children}</div>
}
const Kicker: React.FC<{ children: React.ReactNode }> = ({ children }) => { const t = useT(); return <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 22, letterSpacing: '0.2em', color: t.accent, textTransform: 'uppercase' }}>{children}</div> }
const Head: React.FC<{ children: React.ReactNode; size?: number }> = ({ children, size = 58 }) => { const t = useT(); return <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: size, lineHeight: 1.05, color: t.ink, textAlign: 'center', letterSpacing: '-0.025em' }}>{children}</div> }
const Sub: React.FC<{ children: React.ReactNode; accent?: string }> = ({ children }) => { const t = useT(); return <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 30, color: t.soft, textAlign: 'center' }}>{children}</div> }

const CaptionCard: React.FC<{ c: Caption; vert: string }> = ({ c, vert }) => {
  const t = useT()
  if (c.finale) return null
  if (c.logoHead) return (
    <Card at={8}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Img src={staticFile(`vert-${vert}/logo.png`)} style={{ height: 52 }} />
        <Head size={50}>{c.logoHead}</Head>
      </div>
      {c.sub && <Sub>{c.sub}</Sub>}
    </Card>
  )
  return (
    <Card at={6} align="center">
      {c.kicker && <Kicker>{c.kicker}</Kicker>}
      {c.head && <Head size={c.small ? 44 : 56}>{c.head}</Head>}
      {c.sub && <Sub>{c.accent && c.sub.includes(c.accent) ? <>{c.sub.replace(c.accent, '')}<span style={{ color: t.accent, fontWeight: 800 }}>{c.accent}</span></> : c.sub}</Sub>}
    </Card>
  )
}

/* ---- intro / end / corner (on-brand, no per-vertical asset needed) ---- */
const Blobs: React.FC = () => {
  const t = useT()
  const f = useCurrentFrame(); const d = Math.sin(f * 0.02) * 14, d2 = Math.cos(f * 0.016) * 18
  return (<AbsoluteFill style={{ background: t.paper, overflow: 'hidden' }}><div style={{ position: 'absolute', width: 820, height: 820, borderRadius: '50%', background: t.blob1, filter: 'blur(60px)', top: -240 + d, left: -150 + d2 }} /><div style={{ position: 'absolute', width: 760, height: 760, borderRadius: '50%', background: t.blob2, filter: 'blur(70px)', bottom: -240 - d, right: -130 - d2 }} /><div style={{ position: 'absolute', width: 560, height: 560, borderRadius: '50%', background: t.blob3, filter: 'blur(60px)', bottom: -160 + d2, left: 280 }} /></AbsoluteFill>)
}

const INTRO = S(3.0), END = S(4.5), INTRO_XF = S(0.5), END_XF = S(0.5)

const IntroScreen: React.FC<{ vert: string; tag: string }> = ({ vert, tag }) => {
  const t = useT()
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const s = spring({ frame: f - 4, fps, config: { damping: 13, stiffness: 130 } })
  const bar = interpolate(f, [20, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut })
  const tt = interpolate(f, [28, 48], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut })
  const out = interpolate(f, [INTRO - INTRO_XF, INTRO], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 24, opacity: out }}>
      <Blobs /><Grain />
      <Img src={staticFile(`vert-${vert}/logo.png`)} style={{ height: 140, transform: `translateY(${(1 - s) * 36}px) scale(${0.82 + clamp(s) * 0.18})`, opacity: clamp(s), filter: t.logoShadow }} />
      <div style={{ width: interpolate(bar, [0, 1], [0, 440]), height: 3, background: `linear-gradient(90deg, transparent, ${t.accent}, transparent)` }} />
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 40, color: t.ink, opacity: tt, transform: `translateY(${(1 - tt) * 16}px)`, textAlign: 'center', maxWidth: 1200 }}>{tag}</div>
    </AbsoluteFill>
  )
}
const EndScreen: React.FC<{ vert: string }> = ({ vert }) => {
  const t = useT()
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const s = spring({ frame: f - 4, fps, config: { damping: 14, stiffness: 140 } })
  const tag = interpolate(f, [18, 38], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut })
  const url = interpolate(f, [32, 52], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut })
  // The paper backdrop is OPAQUE from frame 0 (no fade-through of the prior scene);
  // only the content (logo/tag/url) animates in. This kills the end-card flash.
  //
  // The content sits in its OWN stack div rather than being laid out directly by
  // the AbsoluteFill. Previously the logo, tagline, URL, CTA line and second logo
  // were direct flex children of the AbsoluteFill alongside <Blobs/> and <Grain/>,
  // and the bottom three silently stopped painting partway through the card — at
  // opacity 1, measured, so it was never a fade. Every film shipped so far lost
  // its URL and call-to-action for the last couple of seconds because of it.
  // Giving the content one plain container of its own keeps it away from whatever
  // the absolutely-positioned siblings were doing to the flex line.
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <Blobs /><Grain />
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
        <Img src={staticFile(`vert-${vert}/logo.png`)} style={{ height: 120, transform: `translateY(${(1 - s) * 30}px) scale(${0.86 + clamp(s) * 0.14})`, opacity: clamp(s), filter: t.logoShadow }} />
        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 36, color: t.ink, opacity: tag, transform: `translateY(${(1 - tag) * 14}px)`, textAlign: 'center' }}>{t.endTagA}<span style={{ color: t.accent }}>{t.endTagB}</span></div>
        <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 48, color: t.accent, opacity: url }}>{t.endUrl}</div>
        <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 28, color: t.soft, opacity: url }}>{t.endSub}</div>
        {t.endLogo && <Img src={staticFile(`vert-${vert}/${t.endLogo}`)} style={{ height: 58, marginTop: 10, opacity: url }} />}
      </div>
    </AbsoluteFill>
  )
}
const CornerLogo: React.FC<{ vert: string; total: number }> = ({ vert, total }) => {
  const t = useT()
  const f = useCurrentFrame()
  const inO = interpolate(f, [INTRO - INTRO_XF, INTRO + S(0.4)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const outO = interpolate(f, [total - END - S(0.2), total - END + END_XF], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (<div style={{ position: 'absolute', top: 38, right: 44, opacity: Math.min(inO, outO) * 0.9, pointerEvents: 'none' }}><div style={{ background: t.card, borderRadius: 12, padding: '9px 16px', boxShadow: t.cardShadow, backdropFilter: 'blur(4px)' }}><Img src={staticFile(`vert-${vert}/logo.png`)} style={{ height: 30, display: 'block' }} /></div></div>)
}

const Dissolve: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => {
  const f = useCurrentFrame(); const xf = S(0.4)
  const inO = interpolate(f, [0, xf], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const outO = interpolate(f, [dur - xf, dur], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return <AbsoluteFill style={{ opacity: Math.min(inO, outO) }}>{children}</AbsoluteFill>
}

// per-scene focus variety
const FOCUS = [{ fy: 44 }, { fx: 44 }, { push: 0.09 }, {}, {}, { fx: 56 }, {}, { fx: 56 }, {}, { fy: 42, push: 0.05 }]
const PAD = 0.8, XF = 0.4

export const CommercialVertical: React.FC<VertProps> = ({ vert, theme }) => {
  const t = THEMES[theme ?? 'jordyn'] ?? THEMES.jordyn
  const data = useData(vert)
  const { durationInFrames } = useVideoConfig()
  const vo = data?.vo || new Array(10).fill(7)
  const caps = data?.captions || new Array(10).fill({})
  const segD = vo.map((d) => (d || 7) + PAD)
  const bodyStart = INTRO - INTRO_XF
  let cursor = 0
  const starts = segD.map((d) => { const from = S(cursor); cursor += d - XF; return bodyStart + from })
  // Anchor the end screen to the ACTUAL composition end (from calculateMetadata),
  // not a self-computed total — so async data-load can never shift/clip it.
  const total = durationInFrames
  const endStart = total - END
  return (
    <ThemeCtx.Provider value={t}>
      <AbsoluteFill style={{ background: t.paper }}>
        <Audio src={staticFile(`vert-${vert}/music.mp3`)} volume={0.34} />
        <Sequence from={0} durationInFrames={INTRO}><IntroScreen vert={vert} tag={data?.tagIntro || ''} /></Sequence>
        {segD.map((d, i) => {
          const fo = FOCUS[i] || {}; const durF = S(d)
          return (
            <Sequence key={i} from={starts[i]} durationInFrames={durF + 2}>
              <Dissolve dur={durF}>
                <AbsoluteFill>
                  <Scene vert={vert} i={i} push={(fo as any).push} focusX={(fo as any).fx} focusY={(fo as any).fy} />
                  <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 92 }}>
                    <CaptionCard c={caps[i] || {}} vert={vert} />
                  </AbsoluteFill>
                </AbsoluteFill>
              </Dissolve>
              <Grain />
              <Sequence from={Math.round(0.2 * FPS)}><Audio src={staticFile(`vert-${vert}/vo-${i}.mp3`)} volume={1} /></Sequence>
            </Sequence>
          )
        })}
        <Sequence from={endStart} durationInFrames={END}><EndScreen vert={vert} /></Sequence>
        <CornerLogo vert={vert} total={total} />
      </AbsoluteFill>
    </ThemeCtx.Provider>
  )
}
