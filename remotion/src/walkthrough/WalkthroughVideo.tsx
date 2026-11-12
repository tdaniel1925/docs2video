import React from 'react'
import { AbsoluteFill, Audio, Img, Sequence, useCurrentFrame, interpolate, spring, Easing, type CalculateMetadataFunction } from 'remotion'
import { loadFont as loadSpaceGrotesk } from '@remotion/google-fonts/SpaceGrotesk'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import { setAssetBase, staticFile } from '../lib/asset'
import { MusicBed } from '../lib/musicbed'
import { Fit } from '../lib/fit'
import { kitFont } from '../kit/fonts'
import type { FontId } from '../kit/spec'

/* ============================================================================
 * WALK-THROUGH (videoStyle 'walkthrough') — the client's own document is the
 * picture. Each scene: one real page (names already blurred by the render
 * service, render-service/walkthrough.js), the camera glides to the lines the
 * voice is about, a gold box draws round them on a spoken word, then the page
 * slides left and a card lifts the figure out (count-up, range, before/after,
 * short list, one sentence). Opening card ("Prepared for …") and closing card.
 * Every figure is drawn in code (exact, readable); all words sit in <Fit>.
 * ==========================================================================*/
const { fontFamily: DISPLAY } = loadSpaceGrotesk()
const { fontFamily: BODY } = loadInter()
export const WALK_FPS = 30
const FPS = WALK_FPS
const s = (sec: number) => Math.round(sec * FPS)
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const ease = Easing.inOut(Easing.cubic)
const out = Easing.out(Easing.cubic)
const GOLD = '#ddb166'
/**
 * THE VIDEO'S COLOURS AND TYPE — the user's own look (the look screen) or one
 * made from their brand, already through the kit's contrast guard in the app
 * (app/_lib/walkthrough.ts walkthroughTheme). Set once per render, like the
 * asset base. The defaults are only for a render with no theme.
 */
export type WalkTheme = { bg: string; glow: string; text: string; muted: string; accentInk: string; accentBig: string; onAccent: string; surface: string; surfaceLine: string; headFont?: FontId; bodyFont?: FontId }
const DEFAULT_THEME: WalkTheme = { bg: '#121110', glow: '#2a241b', text: '#f3eee6', muted: '#a69e92', accentInk: GOLD, accentBig: GOLD, onAccent: '#121110', surface: '#1c1a17', surfaceLine: '#36312a' }
let C = { ...DEFAULT_THEME, head: DISPLAY, body: BODY }
function setTheme(theme?: Partial<WalkTheme> | null, accent?: string) {
  const th = { ...DEFAULT_THEME, ...(theme || {}) }
  // An older render with only an accent: the accent if it reads on the dark page.
  if (!theme && accent) { const a = readableAccent(accent); th.accentInk = a; th.accentBig = a }
  C = { ...th, head: th.headFont ? kitFont(th.headFont) : DISPLAY, body: th.bodyFont ? kitFont(th.bodyFont) : BODY }
}
/** The box is drawn ON the white PDF page: the accent, darkened until it shows there (3:1). */
const rgbOf = (h: string) => { const n = parseInt(String(h).replace('#', '').padEnd(6, '0').slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
const mixHex = (a: string, b: string, k: number) => { const x = rgbOf(a), y = rgbOf(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join('') }
const lumOf = (h: string) => { const c = rgbOf(h).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4) }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] }
const contrastWhite = (h: string) => 1.05 / (lumOf(h) + 0.05)
const rgba = (h: string, a: number) => `rgba(${rgbOf(h).join(',')},${a})`
function onWhite(hex: string): string {
  let c = hex
  for (let i = 0; i < 12 && contrastWhite(c) < 3; i++) c = mixHex(c, '#000000', 0.15)
  return c
}
const LEAD = s(0.35), GAP = s(0.7), TAIL = s(1.4), XF = s(0.5)

export type WBox = { x: number; y: number; w: number; h: number }
export type WCard =
  | { type: 'figure'; eyebrow?: string; value: string; unit?: string; note?: string }
  | { type: 'range'; eyebrow?: string; low: string; high: string; note?: string }
  | { type: 'compare'; eyebrow?: string; a: { label: string; value: string; sub?: string }; b: { label: string; value: string; sub?: string } }
  | { type: 'chips'; eyebrow?: string; title?: string; items: string[] }
  | { type: 'statement'; eyebrow?: string; text: string }
export type WScene = {
  kind: 'cover' | 'page' | 'close'
  vo?: string; voSec?: number; words?: { w: string; start: number; end: number }[]
  page?: number; ring?: WBox | null; card?: WCard | null; ringWord?: string | null; cardWord?: string | null
}
export type WalkthroughProps = {
  pages: { n: number; src: string; w: number; h: number }[]
  scenes: WScene[]
  cover: { eyebrow?: string; title: string; prepared?: string; from?: string }
  closing: { eyebrow?: string; title: string; line?: string; contact?: string[] }
  /** The video's colours and type (app/_lib/walkthrough.ts walkthroughTheme). */
  theme?: WalkTheme
  /** Older renders: one accent colour only. */
  accent?: string
  music?: string
  assetBase?: string
  assetDir?: string
  /** set by calculateMetadata */
  timeline?: { starts: number[]; lens: number[]; total: number }
}

// ---- timing --------------------------------------------------------------
export function walkTimeline(scenes: WScene[]) {
  const starts: number[] = [], lens: number[] = []
  let t = 0
  scenes.forEach((sc, i) => {
    const vo = Math.max(1.2, Number(sc.voSec) || 0)
    const len = LEAD + s(vo) + (i === scenes.length - 1 ? TAIL : GAP)
    starts.push(t); lens.push(len); t += len
  })
  return { starts, lens, total: Math.max(30, t) }
}
const normW = (w: string) => String(w || '').toLowerCase().replace(/[^a-z0-9-]/g, '')
/** Frame (from the scene start) where `word` is said, else `frac` of the voice. */
function cueAt(sc: WScene, word: string | null | undefined, frac: number): number {
  const vo = Number(sc.voSec) || 2
  const want = normW(word || '')
  if (want && sc.words?.length) {
    const hit = sc.words.find((w) => normW(w.w) === want) || sc.words.find((w) => normW(w.w).startsWith(want))
    if (hit) return LEAD + s(hit.start)
  }
  return LEAD + s(vo * frac)
}

// ---- money and numbers: count from 0 to the printed value, same format ----
function parseFigure(v: string): { pre: string; n: number; dec: number; post: string } | null {
  const m = String(v).match(/^([^\d-]*)(-?\d[\d,]*)(\.\d+)?(.*)$/)
  if (!m) return null
  const n = parseFloat((m[2] + (m[3] || '')).replace(/,/g, ''))
  if (!isFinite(n)) return null
  return { pre: m[1], n, dec: m[3] ? m[3].length - 1 : 0, post: m[4] }
}
const fmt = (f: NonNullable<ReturnType<typeof parseFigure>>, x: number, commas: boolean) =>
  f.pre + (commas ? x.toLocaleString('en-US', { minimumFractionDigits: f.dec, maximumFractionDigits: f.dec }) : x.toFixed(f.dec)) + f.post
function counted(v: string, p: number): string {
  const f = parseFigure(v)
  if (!f) return v
  const commas = /\d,\d/.test(v) || (f.pre.includes('$') && Math.abs(f.n) >= 1000)
  return fmt(f, f.n * p, commas)
}
const numberOf = (v: string) => parseFigure(v)?.n ?? null

function readableAccent(hex?: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim())
  if (!m) return GOLD
  const n = parseInt(m[1], 16), ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) })
  const lum = 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
  return (lum + 0.05) / (0.0078 + 0.05) >= 4.5 ? `#${m[1]}` : GOLD // vs C.bg ≈ #121110
}

// ============================================================================
// Card parts — local frames are the page scene's own
// ============================================================================
const Ctx = React.createContext<{ accent: string; cardAt: number }>({ accent: GOLD, cardAt: 0 })
const grow = (f: number, at: number, dur = s(1.1)) => interpolate(f, [at, at + dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: out })

const Eyebrow: React.FC<{ text?: string }> = ({ text }) => {
  if (!text) return null
  return <Fit max={21} min={16} lines={1} style={{ fontFamily: C.body, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: C.accentInk, marginBottom: 14 }}>{text}</Fit>
}
const Reveal: React.FC<{ at: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ at, children, style }) => {
  const f = useCurrentFrame()
  const p = interpolate(f, [at, at + s(0.5)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: out })
  return <div style={{ opacity: p, transform: `translateY(${(1 - p) * 14}px)`, ...style }}>{children}</div>
}
const Big: React.FC<{ value: string; at: number; max?: number }> = ({ value, at, max = 100 }) => {
  const f = useCurrentFrame()
  return <Fit max={max} min={40} lines={1} sizeFor={value} style={{ fontFamily: C.head, fontWeight: 700, lineHeight: 1.2, paddingBottom: 4, color: C.text, fontVariantNumeric: 'tabular-nums', letterSpacing: '-.02em' }}>{counted(value, grow(f, at))}</Fit>
}
const Note: React.FC<{ text?: string; at: number }> = ({ text, at }) => (text ? <Reveal at={at} style={{ marginTop: 18 }}><Fit max={25} min={17} lines={3} style={{ fontFamily: C.body, color: C.muted, lineHeight: 1.4 }}>{text}</Fit></Reveal> : null)

const FigureCard: React.FC<{ c: Extract<WCard, { type: 'figure' }> }> = ({ c }) => {
  const { cardAt } = React.useContext(Ctx)
  return (
    <>
      <Eyebrow text={c.eyebrow} />
      <Big value={c.value} at={cardAt} />
      {c.unit ? <Reveal at={cardAt + s(0.6)}><Fit max={30} min={18} lines={1} style={{ fontFamily: C.body, color: C.muted }}>{c.unit}</Fit></Reveal> : null}
      <Note text={c.note} at={cardAt + s(1.2)} />
    </>
  )
}
const RangeCard: React.FC<{ c: Extract<WCard, { type: 'range' }> }> = ({ c }) => {
  const f = useCurrentFrame()
  const { accent, cardAt } = React.useContext(Ctx)
  const lo = numberOf(c.low), hi = numberOf(c.high)
  const pLo = grow(f, cardAt, s(0.8)), pHi = grow(f, cardAt + s(0.7), s(1.3))
  const top = hi && hi > 0 ? hi * 1.25 : 1
  const left = lo != null && hi ? (lo / top) * 100 : 10
  const width = lo != null && hi ? ((hi - lo) / top) * 100 * pHi : 70 * pHi
  return (
    <>
      <Eyebrow text={c.eyebrow} />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, minWidth: 0 }}>
        <div style={{ flex: 1, minWidth: 0, opacity: pLo }}><Fit max={56} min={30} lines={1} sizeFor={c.low} style={{ fontFamily: C.head, fontWeight: 700, color: C.text, lineHeight: 1.2, paddingBottom: 4 }}>{counted(c.low, pLo)}</Fit></div>
        <div style={{ fontFamily: C.body, fontSize: 30, color: C.muted, opacity: pHi > 0 ? 1 : 0 }}>to</div>
        <div style={{ flex: 1, minWidth: 0, opacity: pHi > 0 ? 1 : 0 }}><Fit max={56} min={30} lines={1} sizeFor={c.high} style={{ fontFamily: C.head, fontWeight: 700, color: C.text, lineHeight: 1.2, paddingBottom: 4 }}>{counted(c.high, Math.max(pHi, 0.0001))}</Fit></div>
      </div>
      <div style={{ position: 'relative', height: 18, borderRadius: 9, background: '#2b2823', marginTop: 24, opacity: pLo }}>
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${left}%`, width: `${Math.max(0.8, width)}%`, borderRadius: 9, background: `repeating-linear-gradient(135deg, ${accent} 0 14px, ${accent}cc 14px 28px)` }} />
      </div>
      <Note text={c.note} at={cardAt + s(1.6)} />
    </>
  )
}
const CompareCard: React.FC<{ c: Extract<WCard, { type: 'compare' }> }> = ({ c }) => {
  const f = useCurrentFrame()
  const { accent, cardAt } = React.useContext(Ctx)
  const a = numberOf(c.a.value), b = numberOf(c.b.value)
  const max = Math.max(a || 0, b || 0) || 1
  const pA = grow(f, cardAt, s(0.9)), pB = grow(f, cardAt + s(0.9), s(1.2))
  const Col: React.FC<{ side: { label: string; value: string; sub?: string }; n: number | null; p: number; dim?: boolean }> = ({ side, n, p, dim }) => (
    <div style={{ flex: 1, minWidth: 0, opacity: p > 0 ? 1 : 0 }}>
      <Fit max={20} min={15} lines={1} style={{ fontFamily: C.body, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: dim ? C.muted : C.accentInk }}>{side.label}</Fit>
      <div style={{ height: 190, display: 'flex', alignItems: 'flex-end', marginTop: 12 }}>
        <div style={{ width: 104, height: `${n != null ? Math.max(3, (n / max) * 100 * p) : 60 * p}%`, borderRadius: 8, background: dim ? C.muted : accent }} />
      </div>
      <div style={{ marginTop: 12 }}><Fit max={44} min={24} lines={1} sizeFor={side.value} style={{ fontFamily: C.head, fontWeight: 700, color: C.text, lineHeight: 1.2, paddingBottom: 4, fontVariantNumeric: 'tabular-nums' }}>{counted(side.value, Math.max(p, 0.0001))}</Fit></div>
      {side.sub ? <Fit max={22} min={15} lines={2} style={{ fontFamily: C.body, color: C.muted, marginTop: 4 }}>{side.sub}</Fit> : null}
    </div>
  )
  return (
    <>
      <Eyebrow text={c.eyebrow} />
      <div style={{ display: 'flex', gap: 30 }}>
        <Col side={c.a} n={a} p={pA} />
        <Col side={c.b} n={b} p={pB} dim />
      </div>
    </>
  )
}
const ChipsCard: React.FC<{ c: Extract<WCard, { type: 'chips' }> }> = ({ c }) => {
  const { accent, cardAt } = React.useContext(Ctx)
  return (
    <>
      <Eyebrow text={c.eyebrow} />
      {c.title ? <Fit max={50} min={28} lines={2} style={{ fontFamily: C.head, fontWeight: 700, color: C.text, lineHeight: 1.15 }}>{c.title}</Fit> : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
        {c.items.map((it, i) => (
          <Reveal key={i} at={cardAt + s(0.5 + i * 0.6)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 18px', borderRadius: 10, background: rgba(C.text, 0.04), border: `1px solid ${accent}66` }}>
              <div style={{ width: 10, height: 10, borderRadius: 5, background: accent, flex: 'none' }} />
              <div style={{ flex: 1, minWidth: 0 }}><Fit max={28} min={18} lines={1} style={{ fontFamily: C.body, fontWeight: 600, color: C.text }}>{it}</Fit></div>
            </div>
          </Reveal>
        ))}
      </div>
    </>
  )
}
const StatementCard: React.FC<{ c: Extract<WCard, { type: 'statement' }> }> = ({ c }) => (
  <>
    <Eyebrow text={c.eyebrow} />
    <Fit max={48} min={26} lines={4} style={{ fontFamily: C.head, fontWeight: 700, color: C.text, lineHeight: 1.2 }}>{c.text}</Fit>
  </>
)
const CardBody: React.FC<{ card: WCard }> = ({ card }) => {
  switch (card.type) {
    case 'figure': return <FigureCard c={card} />
    case 'range': return <RangeCard c={card} />
    case 'compare': return <CompareCard c={card} />
    case 'chips': return <ChipsCard c={card} />
    case 'statement': return <StatementCard c={card} />
  }
}

// ============================================================================
// One page with its camera
// ============================================================================
const fitScale = (b: WBox, w: number, h: number, cap: number) => Math.min(w / b.w, h / b.h, cap)
/** What the camera frames before the card: the box with room round it, inside the page. */
function focusFor(ring: WBox | null | undefined, pw: number, ph: number): WBox {
  if (!ring) return { x: 0, y: 0, w: pw, h: Math.round(pw * 0.5) }
  const w = Math.min(pw, Math.max(Math.min(ring.w, 1800) + 240, 1150)), h = Math.min(ph, Math.max(ring.h + 260, 460))
  const x = clamp(ring.x + Math.min(ring.w, 1800) / 2 - w / 2, 0, pw - w), y = clamp(ring.y + ring.h / 2 - h / 2, 0, ph - h)
  return { x, y, w, h }
}

const PageScene: React.FC<{ sc: WScene; page: { src: string; w: number; h: number }; accent: string }> = ({ sc, page, accent }) => {
  const f = useCurrentFrame()
  const ring = sc.ring || null
  const focus = focusFor(ring, page.w, page.h)
  const ringAt = ring ? cueAt(sc, sc.ringWord, 0.18) : 1e9
  const cardAt = sc.card ? Math.max(ring ? ringAt + s(0.5) : 0, cueAt(sc, sc.cardWord, 0.35)) : 1e9
  // A box round a whole-width paragraph would pull the camera back until the
  // page can't be read: the camera never goes wider than this, and frames the
  // START of a long line (where it is read from) beside the card.
  const near = ring ? { ...ring, w: Math.min(ring.w, 1250) } : null
  const target = near || focus
  const sA = Math.max(0.8, fitScale(focus, 1640, 780, 1.6))
  const tB = near ? { x: near.x - 140, y: near.y - 180, w: Math.max(near.w + 280, 760), h: near.h + 360 } : focus
  const sB = Math.max(0.72, fitScale(tB, 960, 780, 1.45))
  const intro = interpolate(f, [0, s(1.1)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: out })
  const toCard = sc.card ? interpolate(f, [cardAt - s(0.2), cardAt + s(0.9)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease }) : 0
  const drift = 1 + 0.02 * (f / s(10)) // never still
  const scale = interpolate(toCard, [0, 1], [sA * (0.86 + 0.14 * intro), sB]) * drift
  const fx = interpolate(toCard, [0, 1], [focus.x + focus.w / 2, target.x + target.w / 2])
  const fy = interpolate(toCard, [0, 1], [focus.y + focus.h / 2, target.y + target.h / 2])
  const cx = interpolate(toCard, [0, 1], [960, 545]), cy = 560
  const ringP = ring ? clamp(spring({ frame: f - ringAt, fps: FPS, config: { damping: 16, stiffness: 120 } }), 0, 1) : 0
  const dim = ring ? interpolate(f, [ringAt, ringAt + s(0.6)], [0, 0.42], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 0
  const cardP = sc.card ? clamp(spring({ frame: f - cardAt, fps: FPS, config: { damping: 18, stiffness: 110 } }), 0, 1) : 0
  const pad = 14 / scale
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: page.w, height: page.h, transformOrigin: '0 0', transform: `translate(${cx - fx * scale}px, ${cy - fy * scale}px) scale(${scale})`, boxShadow: '0 40px 120px rgba(0,0,0,.6)', background: '#fff' }}>
        <Img src={staticFile(page.src)} style={{ width: page.w, height: page.h, display: 'block' }} />
        {ring ? (
          <>
            <div style={{ position: 'absolute', left: ring.x - pad, top: ring.y - pad, width: ring.w + pad * 2, height: ring.h + pad * 2, borderRadius: 8 / scale, boxShadow: `0 0 0 9000px ${rgba(C.bg, dim)}`, opacity: ringP > 0.01 ? 1 : 0 }} />
            <div style={{ position: 'absolute', left: ring.x - pad, top: ring.y - pad, width: ring.w + pad * 2, height: ring.h + pad * 2, borderRadius: 8 / scale, border: `${4 / scale}px solid ${onWhite(accent)}`, boxShadow: `0 0 ${24 / scale}px ${onWhite(accent)}88`, opacity: ringP, transform: `scale(${1.08 - 0.08 * ringP})` }} />
          </>
        ) : null}
      </div>
      {sc.card ? (
        <div style={{ position: 'absolute', right: 70, top: 0, bottom: 0, width: 760, display: 'flex', alignItems: 'center', opacity: cardP, transform: `translateX(${(1 - cardP) * 80}px)` }}>
          <div style={{ width: '100%', maxHeight: 900, overflow: 'hidden', background: C.surface, border: `1px solid ${C.surfaceLine}`, borderRadius: 10, padding: '44px 48px', boxShadow: '0 30px 90px rgba(0,0,0,.55)' }}>
            <Ctx.Provider value={{ accent, cardAt }}><CardBody card={sc.card} /></Ctx.Provider>
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  )
}

// ============================================================================
// Opening and closing cards
// ============================================================================
const useRise = () => {
  const f = useCurrentFrame()
  return (at: number) => { const p = interpolate(f, [at, at + s(0.7)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: out }); return { opacity: p, transform: `translateY(${(1 - p) * 18}px)` } }
}
const Cover: React.FC<{ c: WalkthroughProps['cover']; accent: string; firstPage?: { src: string; w: number; h: number } }> = ({ c, accent, firstPage }) => {
  const r = useRise(); const f = useCurrentFrame()
  return (
    <AbsoluteFill>
      {firstPage ? (
        <div style={{ position: 'absolute', right: -120, top: 120 - f * 0.25, width: 760, transform: 'rotate(4deg)', opacity: 0.16, filter: 'blur(1.5px)' }}>
          <Img src={staticFile(firstPage.src)} style={{ width: 760, display: 'block', borderRadius: 6 }} />
        </div>
      ) : null}
      <AbsoluteFill style={{ padding: '0 150px', justifyContent: 'center' }}>
        <div style={{ ...r(s(0.2)), width: 1100 }}><Fit max={24} min={18} lines={1} style={{ fontFamily: C.body, fontWeight: 700, letterSpacing: '.22em', textTransform: 'uppercase', color: C.accentInk }}>{c.eyebrow || 'Your document, explained'}</Fit></div>
        <div style={{ ...r(s(0.5)), width: 1100, marginTop: 18 }}><Fit max={96} min={48} lines={3} style={{ fontFamily: C.head, fontWeight: 700, lineHeight: 1.08, color: C.text }}>{c.title}</Fit></div>
        <div style={{ ...r(s(1.0)), display: 'flex', gap: 16, alignItems: 'center', marginTop: 34, width: 1300, minWidth: 0 }}>
          {c.prepared ? <span style={{ fontFamily: C.head, fontWeight: 700, fontSize: 32, color: C.onAccent, background: accent, borderRadius: 10, padding: '10px 22px', whiteSpace: 'nowrap', maxWidth: 760, overflow: 'hidden', textOverflow: 'ellipsis' }}>Prepared for {c.prepared}</span> : null}
          {c.from ? <div style={{ flex: 1, minWidth: 0 }}><Fit max={28} min={18} lines={1} style={{ fontFamily: C.body, color: C.muted }}>{`from ${c.from}`}</Fit></div> : null}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
const Closing: React.FC<{ c: WalkthroughProps['closing'] }> = ({ c }) => {
  const r = useRise()
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 160px' }}>
      {c.eyebrow ? <div style={{ ...r(s(0.2)), width: 1400 }}><Fit max={24} min={18} lines={1} style={{ fontFamily: C.body, fontWeight: 700, letterSpacing: '.22em', textTransform: 'uppercase', color: C.accentInk, textAlign: 'center' }}>{c.eyebrow}</Fit></div> : null}
      <div style={{ ...r(s(0.5)), width: 1400, marginTop: 18 }}><Fit max={84} min={44} lines={2} style={{ fontFamily: C.head, fontWeight: 700, lineHeight: 1.1, color: C.text, textAlign: 'center' }}>{c.title}</Fit></div>
      {c.line ? <div style={{ ...r(s(0.9)), width: 1300, marginTop: 24 }}><Fit max={34} min={20} lines={2} style={{ fontFamily: C.body, color: C.muted, textAlign: 'center' }}>{c.line}</Fit></div> : null}
      {(c.contact || []).length ? (
        <div style={{ ...r(s(1.3)), display: 'flex', gap: 28, marginTop: 34, justifyContent: 'center', flexWrap: 'wrap', width: 1500 }}>
          {(c.contact || []).slice(0, 3).map((x, i) => <span key={i} style={{ fontFamily: C.body, fontWeight: 600, fontSize: 28, color: C.text, padding: '10px 18px', border: `1px solid ${C.surfaceLine}`, borderRadius: 10, maxWidth: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x}</span>)}
        </div>
      ) : null}
    </AbsoluteFill>
  )
}

// ============================================================================
// The film
// ============================================================================
const Backdrop: React.FC = () => {
  const f = useCurrentFrame()
  const x = 50 + 12 * Math.sin(f / 140), y = 40 + 8 * Math.cos(f / 170)
  return <AbsoluteFill style={{ background: `radial-gradient(ellipse 55% 45% at ${x}% ${y}%, ${rgba(C.glow, 0.55)}, transparent 70%), ${C.bg}` }} />
}

const BED = 0.15, UNDER = 0.04, RAMP = s(0.6)
const smooth = (t: number) => t * t * (3 - 2 * t)

export const WalkthroughVideo: React.FC<WalkthroughProps> = (props) => {
  setAssetBase(props.assetBase)
  setTheme(props.theme, props.accent)
  const accent = C.accentBig
  const tl = props.timeline || walkTimeline(props.scenes)
  const pageOf = (n?: number) => props.pages.find((p) => p.n === n) || props.pages[0]
  const voice = props.scenes.map((sc, i) => [tl.starts[i] + LEAD, tl.starts[i] + LEAD + s(Number(sc.voSec) || 0)] as const)
  const duck = (f: number) => {
    let v = 0
    for (const [a, b] of voice) v = Math.max(v, Math.min(smooth(clamp((f - (a - RAMP)) / RAMP, 0, 1)), smooth(clamp((b + s(1.2) - f) / RAMP, 0, 1))))
    return BED - (BED - UNDER) * v
  }
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Backdrop />
      {props.scenes.map((sc, i) => {
        const from = tl.starts[i], len = tl.lens[i] + (i < props.scenes.length - 1 ? XF : 0)
        return (
          <Sequence key={i} from={from} durationInFrames={len}>
            <Fade len={len} first={i === 0} last={i === props.scenes.length - 1}>
              {sc.kind === 'cover' ? <Cover c={props.cover} accent={accent} firstPage={props.pages[0]} />
                : sc.kind === 'close' ? <Closing c={props.closing} />
                : <PageScene sc={sc} page={pageOf(sc.page)} accent={accent} />}
            </Fade>
            {sc.vo ? <Sequence from={LEAD}><Audio src={staticFile(sc.vo)} /></Sequence> : null}
          </Sequence>
        )
      })}
      <Progress total={tl.total} accent={accent} />
      {props.music ? <MusicBed src={props.music} musicFrames={0} volume={duck} /> : null}
    </AbsoluteFill>
  )
}
const Fade: React.FC<{ len: number; first: boolean; last: boolean; children: React.ReactNode }> = ({ len, first, last, children }) => {
  const f = useCurrentFrame()
  const op = interpolate(f, [0, XF, len - XF, len], [first ? 1 : 0, 1, 1, last ? 1 : 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return <AbsoluteFill style={{ opacity: op }}>{children}</AbsoluteFill>
}
const Progress: React.FC<{ total: number; accent: string }> = ({ total, accent }) => {
  const f = useCurrentFrame()
  return <div style={{ position: 'absolute', left: 0, bottom: 0, height: 4, width: `${clamp(f / total, 0, 1) * 100}%`, background: accent, opacity: 0.8 }} />
}

export const walkthroughMetadata: CalculateMetadataFunction<WalkthroughProps> = async ({ props }) => {
  setAssetBase(props?.assetBase)
  const scenes = Array.isArray(props?.scenes) ? props.scenes : []
  const timeline = walkTimeline(scenes)
  return { fps: FPS, width: 1920, height: 1080, durationInFrames: timeline.total, props: { ...props, timeline } }
}
