import { AbsoluteFill, Audio, Img, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring, Easing, type CalculateMetadataFunction } from 'remotion'
import { staticFile, setAssetBase } from './lib/asset'
import React, { useMemo } from 'react'
import { useAudioData, visualizeAudio, getAudioDurationInSeconds } from '@remotion/media-utils'
import { fitText } from '@remotion/layout-utils'
import { loadFont as loadMont } from '@remotion/google-fonts/Montserrat'
import { loadFont as loadSans } from '@remotion/google-fonts/SourceSans3'
import { EASE } from './motion/MotionKit'
import { LineChart, BarPair, CountUp, legibleOn, type Series } from './charts/Charts'
import { FitOdometer } from './charts/Odometer'
import { Fit, FitBox } from './lib/fit'
import { LOOKS, type LookName } from './looks/Looks'
import { GlassPanel, PersistentFrame, LowerThird, type GlassStyle, type GPalette } from './cinematic/Glass'
import { FilmGrade } from './cinematic/FilmGrade'
import { LogoReveal, LogoClose } from './cinematic/LogoScenes'
import { SlideHeading, BulletList, DataCards, ScreenshotFrame, SCALE, type Bullet, type Card, type Pin } from './slides/Slides'
import { IconMotif, pickIcon } from './slides/IconMotif'
const SL = (n: number) => Math.round(n * SCALE)  // slide-scale helper (shares the global SCALE)
import { loadFont as loadPlayfair } from '@remotion/google-fonts/PlayfairDisplay'

loadPlayfair()

const { fontFamily: MONT } = loadMont()
const { fontFamily: SANS } = loadSans()

/**
 * DirectedVideo — the renderer for the text-to-commercial autopilot. It consumes
 * dir-plan.json (written by scripts/director/make-video.ts): the WRITER supplies
 * narration + on-screen copy, the DIRECTOR supplies per-scene visual source,
 * camera move, entrance, and one cohesive palette. Nothing here is hand-authored
 * per video — the plan drives everything. Reuses the proven beat-grid + living
 * Ken-Burns camera + fitText title machinery from the Valor/Apex commercials.
 */

const FPS = 30
const GAP = Math.round(0.35 * FPS)
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

// A chart spec the DIRECTOR can attach to a scene. Only REAL numbers from the
// source doc go here — no invented data.
export type ChartSpec =
  | { kind: 'line'; series: Series[]; xMax: number; yMax: number; xTicks?: number[]; xLabel?: string; annotate?: { x: number; y: number; label: string; value: string } }
  | { kind: 'bars'; bars: { label: string; value: number; color: string }[]; yMax: number; unit?: string }
  | { kind: 'figure'; value: number; prefix?: string; suffix?: string; label?: string }

export type FigureSpec = { value: number; prefix?: string; suffix?: string; label?: string; decimals?: number }

// A SLIDE BLOCK — the supporting content that sits under a scene's heading and
// reveals in sync with the voice. This is what turns a "headline + talking"
// scene into a real explainer slide. Each block/bullet carries an optional
// `cue` phrase; the Director resolves it to a frame from the word-timed VO.
export type BulletBlock = { type: 'bullets'; items: { text: string; highlight?: string; cue?: string; cueFrame?: number }[] }
export type CardsBlock = { type: 'cards'; vs?: boolean; cards: { label: string; value: string; sub?: string; accent?: boolean; cue?: string; cueFrame?: number }[] }
export type ChartBlock = { type: 'chart'; chart: ChartSpec }
export type FigureBlock = { type: 'figure'; figure: FigureSpec }
export type ShotBlock = { type: 'screenshot'; file: string; pins?: { x: number; y: number; label: string; cue?: string; cueFrame?: number }[] }
export type SlideBlock = BulletBlock | CardsBlock | ChartBlock | FigureBlock | ShotBlock

export type DirScene = {
  id: number; beat: string; narration: string; on_screen: string; intent?: string
  visual: { type: 'gemini' | 'kinetic' | 'chart' | 'figure' | 'slide'; prompt?: string; file?: string; chart?: ChartSpec; figure?: FigureSpec }
  // NEW: slide content. heading + kicker + supporting blocks laid out on the backdrop.
  layout?: { heading?: string; kicker?: string; align?: 'left' | 'center'; media?: 'right' | 'below' | 'full' }
  blocks?: SlideBlock[]
  backdrop?: string   // per-scene cinematic photo backdrop (rotates for variety)
  camera?: 'pushIn' | 'kenBurns' | 'pullBack' | 'static-alive'
  entrance?: 'rise' | 'wipe' | 'punchIn' | 'typewriter' | 'wordPan' | 'assemble'
  text_style?: 'big' | 'lower-third' | 'centered'
}
// Per-scene word timings, written by the Director from ElevenLabs timestamps.
// Loaded as dir-cap-{id}.json = { words:[{w,start,end}], durationSec }.
export type Caption = { words: { w: string; start: number; end: number }[]; durationSec: number }
export type DirChrome = { company?: string; logo?: string; recipient?: string; footer?: string; glass?: GlassStyle }
export type DirPresenter = { name?: string; role?: string; photo?: string; onCover?: boolean; onClosing?: boolean }
export type DirPlan = {
  title: string
  look?: LookName
  backdrops?: string[]   // pool of cinematic backdrops; scenes reference by rotation
  chrome?: DirChrome     // persistent frame: logo, recipient tag, footer, glass style
  presenter?: DirPresenter  // optional agent headshot for cover/closing (real person, not identity-neutral)
  intro?: { line1?: string; line2?: string; preparer?: string; recipient?: string }
  cta?: { line?: string; contact?: string }
  palette?: { bg: string; accent: string; accent2: string; text: string }   // legacy; look wins if present
  scenes: DirScene[]
}
export type DirectedProps = { assetBase?: string; plan: DirPlan; starts: number[]; total: number; intensity?: 'calm' | 'premium' | 'highenergy'; bpm?: number }

// SFX pack (synthesized, royalty-free). One <Audio> per hit at a given frame.
const Sfx: React.FC<{ name: string; at: number; total: number; volume?: number }> = ({ name, at, total, volume = 0.6 }) => {
  if (at < 0 || at >= total) return null
  return <Sequence from={at} durationInFrames={Math.min(90, total - at)}><Audio src={staticFile(`sfx/${name}.wav`)} volume={volume} /></Sequence>
}

// Camera path presets keyed by the director's move name → [from,to] focus/zoom.
const CAM: Record<string, { from: [number, number, number]; to: [number, number, number] }> = {
  pushIn: { from: [0.5, 0.45, 1.08], to: [0.5, 0.5, 1.34] },
  kenBurns: { from: [0.62, 0.4, 1.12], to: [0.38, 0.56, 1.36] },
  pullBack: { from: [0.5, 0.5, 1.42], to: [0.5, 0.48, 1.1] },
  'static-alive': { from: [0.5, 0.5, 1.06], to: [0.5, 0.5, 1.12] },
}

export const directedMetadata: CalculateMetadataFunction<DirectedProps> = async ({ props }) => {
  // The plan is passed via --props (dir-plan wrapped) OR fetched from public/.
  let plan = props?.plan
  if (!plan || !Array.isArray(plan.scenes) || plan.scenes.length === 0) {
    // No plan on props — try public/dir-plan.json. This is ABSENT during a bare
    // `remotion compositions` listing (and before the generator runs), so guard
    // every failure and fall back to safe placeholder metadata instead of
    // throwing (a throwing calculateMetadata breaks the whole composition list).
    try {
      const res = await fetch(staticFile('dir-plan.json'))
      if (res.ok) plan = (await res.json()) as DirPlan
    } catch { /* no plan file — use placeholder below */ }
  }
  if (!plan || !Array.isArray(plan.scenes) || plan.scenes.length === 0) {
    // placeholder: a valid, renderable-but-empty composition so listing/preview
    // never crash. A real render always passes a full plan via --props.
    return { durationInFrames: 30, props: { plan: { title: '', scenes: [] } as unknown as DirPlan, starts: [], total: 30, intensity: 'premium', bpm: 128 }, fps: FPS, width: 1920, height: 1080 }
  }
  // Scene starts snap to the beat grid so every cut lands ON a beat. We give each
  // scene enough beats to cover its VO, rounding UP to a whole beat.
  const bpm = 128, BEATF = (60 / bpm) * FPS
  const starts: number[] = []; let t = Math.round(BEATF)   // start on beat 1
  for (const sc of plan.scenes) {
    starts.push(Math.round(t))
    const dur = Math.round((await getAudioDurationInSeconds(staticFile(`dir-vo-${sc.id}.mp3`))) * FPS)
    const beatsNeeded = Math.max(2, Math.ceil((dur + GAP) / BEATF))   // whole beats
    t += beatsNeeded * BEATF
  }
  const total = Math.round(t + 4 * BEATF)
  return { durationInFrames: total, props: { plan, starts, total, intensity: 'premium', bpm }, fps: FPS, width: 1920, height: 1080 }
}

function useBeats(totalFrames: number) {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const audioData = useAudioData(staticFile('dir-music.mp3'))
  const beats = useMemo(() => {
    if (!audioData) return []
    const e: number[] = []
    for (let f = 0; f < totalFrames; f++) { const s = visualizeAudio({ fps, frame: f, audioData, numberOfSamples: 16 }); e.push(s[0] + s[1]) }
    const on: number[] = []
    for (let f = 2; f < e.length - 2; f++) { const lo = Math.max(0, f - 20), hi = Math.min(e.length, f + 20); const avg = e.slice(lo, hi).reduce((a, b) => a + b, 0) / (hi - lo); if (e[f] > avg * 1.3 && e[f] >= e[f - 1] && e[f] >= e[f + 1] && (on.length === 0 || f - on[on.length - 1] >= 8)) on.push(f) }
    if (on.length < 4) return on
    const votes = new Map<number, number>()
    for (let i = 1; i < on.length; i++) { const d = on[i] - on[i - 1]; for (let p = 12; p <= 30; p++) for (let m = 1; m <= 3; m++) if (Math.abs(d - p * m) <= 1) votes.set(p, (votes.get(p) || 0) + 1) }
    const period = [...votes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 15
    let ph = 0, best = -1; for (let p = 0; p < period; p++) { let sc = 0; for (let f = p; f < e.length; f += period) sc += e[f] || 0; if (sc > best) { best = sc; ph = p } }
    const g: number[] = []; for (let f = ph; f < totalFrames; f += period) g.push(f); return g
  }, [audioData, fps, totalFrames])
  if (!audioData) return { beats: [], spectrum: new Array(20).fill(0) }
  return { beats, spectrum: visualizeAudio({ fps, frame, audioData, numberOfSamples: 32 }).slice(0, 20) }
}
const snap = (f: number, b: number[]) => { for (const x of b) if (x >= f) return x; return f }

// Living Ken-Burns photo (from Valor) — eases from→to then keeps drifting.
const KBPhoto: React.FC<{ file: string; move: string; localFrame: number; dur: number; palette: DirPlan['palette'] }> =
({ file, move, localFrame, dur, palette }) => {
  const c = CAM[move] || CAM.pushIn
  const p = EASE.expoOut(clamp(localFrame / Math.max(1, dur), 0, 1))
  const drift = Math.max(0, localFrame - dur)
  const fx = c.from[0] + (c.to[0] - c.from[0]) * p + Math.sin(drift * 0.02) * 0.006
  const fy = c.from[1] + (c.to[1] - c.from[1]) * p + Math.cos(drift * 0.016) * 0.005
  const sc = c.from[2] + (c.to[2] - c.from[2]) * p + drift * 0.0004
  const W = 1920 * sc, H = 1080 * sc
  const tx = 1920 / 2 - fx * W, ty = 1080 / 2 - fy * H
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Img src={staticFile(file)} style={{ position: 'absolute', width: W, height: H, objectFit: 'cover', transform: `translate(${tx}px,${ty}px)`, transformOrigin: '0 0' }} />
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${hex(palette.bg, 0.4)}, ${hex(palette.bg, 0.25)} 45%, ${hex(palette.bg, 0.86)})` }} />
      <AbsoluteFill style={{ background: 'radial-gradient(130% 130% at 50% 42%, transparent 50%, rgba(0,0,0,0.6) 100%)' }} />
    </AbsoluteFill>
  )
}
function hex(h: string, a: number) { const n = h.replace('#', ''); const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16); return `rgba(${r},${g},${b},${a})` }

// Title with entrance chosen by the director. Kinetic backdrops get the big word.
// Short titles keep the one-line look (as big as fits, up to `size`); a title
// too long to read on one line gets up to three lines instead. Either way the
// REAL rendered text is measured and shrunk to fit (lib/fit), sized against the
// whole title so it doesn't change size while it types or assembles.
const Title: React.FC<{ text: string; at: number; size: number; color: string; beats: number[]; maxW: number; entrance: string }> =
({ text, at, size, color, beats, maxW, entrance }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig(); const start = snap(at, beats)
  // Only CHOOSES one line vs several — the fit itself is measured by <Fit>.
  const { fontSize: oneLine } = fitText({ text: text || ' ', withinWidth: maxW, fontFamily: MONT, fontWeight: 800 })
  const single = oneLine * 0.94 >= size * 0.5
  const max = single ? Math.max(24, Math.min(size, Math.floor(oneLine * 0.94))) : size
  const lines = single ? 1 : entrance === 'wipe' ? 2 : 3
  const s = spring({ frame: frame - start, fps, config: { damping: 16, stiffness: 150 } })
  const base = { fontFamily: MONT, fontWeight: 800, color, letterSpacing: '0.01em', lineHeight: 1.04, textShadow: '0 3px 26px rgba(0,0,0,0.6)', textAlign: 'center' } as const
  const local = frame - start
  const fit = (content: React.ReactNode, outer?: React.CSSProperties) => (
    <div style={{ width: '100%', maxWidth: maxW, ...outer }}>
      <Fit max={max} min={Math.round(size * 0.35)} lines={lines} sizeFor={text + (entrance === 'typewriter' ? '▍' : '')} style={base}>{content}</Fit>
    </div>
  )
  if (entrance === 'wipe') return fit(text, { clipPath: `inset(0 ${(1 - s) * 100}% 0 0)`, opacity: s > 0.02 ? 1 : 0 })
  if (entrance === 'punchIn') { const pop = spring({ frame: local, fps, config: { damping: 11, stiffness: 220 } }); return fit(text, { opacity: s, transform: `scale(${0.6 + pop * 0.4})` }) }
  if (entrance === 'typewriter') { const n = clamp(Math.floor(local / 1.6), 0, text.length); return fit(<>{text.slice(0, n)}<span style={{ opacity: Math.round(local / 6) % 2 ? 0.2 : 0.9 }}>▍</span></>) }
  // word-by-word and letter-by-letter entrances: inline pieces with real spaces,
  // so the title wraps between WORDS exactly like the plain text it is sized by.
  if (entrance === 'wordPan') { const words = text.split(' '); return fit(words.map((w, i) => { const ws = spring({ frame: local - i * 3, fps, config: { damping: 14, stiffness: 200 } }); return <React.Fragment key={i}><span style={{ display: 'inline-block', opacity: ws, transform: `translateX(${(1 - ws) * 40}px)` }}>{w}</span>{i < words.length - 1 ? ' ' : ''}</React.Fragment> })) }
  if (entrance === 'assemble') {
    let k = 0
    const words = text.split(' ')
    return fit(words.map((w, wi) => (
      <React.Fragment key={wi}>
        <span style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
          {w.split('').map((c) => { const i = k++; const cs = spring({ frame: local - i * 1.5, fps, config: { damping: 13, stiffness: 200 } }); return <span key={i} style={{ opacity: cs, transform: `translateY(${(1 - cs) * -30}px) rotate(${(1 - cs) * -8}deg)`, display: 'inline-block', whiteSpace: 'pre' }}>{c}</span> })}
        </span>
        {wi < words.length - 1 ? (k++, ' ') : ''}
      </React.Fragment>
    )))
  }
  return fit(text, { opacity: s, transform: `translateY(${(1 - s) * 26}px)` }) // rise
}

// Kinetic backdrop: animated gradient mesh in palette colors (no image needed).
const KineticBG: React.FC<{ palette: DirPlan['palette']; localFrame: number; pulse: number }> = ({ palette, localFrame, pulse }) => {
  const t = localFrame
  const x1 = 30 + Math.sin(t * 0.015) * 22, y1 = 28 + Math.cos(t * 0.012) * 18
  const x2 = 72 + Math.cos(t * 0.011) * 20, y2 = 66 + Math.sin(t * 0.014) * 16
  return (
    <AbsoluteFill style={{ background: palette.bg }}>
      <AbsoluteFill style={{ background: `radial-gradient(900px 900px at ${x1}% ${y1}%, ${hex(palette.accent, 0.4 + pulse * 0.15)}, transparent 55%)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(800px 800px at ${x2}% ${y2}%, ${hex(palette.accent2, 0.32)}, transparent 55%)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(140% 120% at 50% 120%, transparent 40%, ${hex(palette.bg, 0.9)} 100%)` }} />
    </AbsoluteFill>
  )
}

// Dispatches a ChartSpec to the right animated chart component, drawn at a
// fixed `width` (px) so every label inside is sized against a known box.
// `barsHeight` = the bar area's height (the bars grow into it).
const ChartVisual: React.FC<{ chart: ChartSpec; at: number; palette: DirPlan['palette']; width: number; barsHeight?: number }> = ({ chart, at, palette, width, barsHeight }) => {
  const P = palette!
  if (chart.kind === 'line') return <LineChart series={chart.series || []} xMax={chart.xMax} yMax={chart.yMax} palette={P} at={at} xTicks={chart.xTicks} xLabel={chart.xLabel} annotate={chart.annotate} width={width} />
  if (chart.kind === 'bars') return <BarPair bars={chart.bars || []} yMax={chart.yMax} palette={P} at={at} unit={chart.unit} width={width} height={barsHeight} />
  return <div style={{ width }}><CountUp value={Number((chart as any).value) || 0} prefix={(chart as any).prefix} suffix={(chart as any).suffix} label={(chart as any).label} at={at} palette={P} /></div>
}

// resolve chart color tokens (__ACCENT__ etc.) against the active palette.
function resolveTokens(chart: any, pal: { accent: string; accent2: string; muted: string }): any {
  if (!chart) return chart
  const map = (c: string) => c === '__ACCENT__' ? pal.accent : c === '__ACCENT2__' ? pal.accent2 : c === '__MUTED__' ? pal.muted : c
  const out = JSON.parse(JSON.stringify(chart))
  if (out.series) out.series.forEach((s: any) => { s.color = map(s.color) })
  if (out.bars) out.bars.forEach((b: any) => { b.color = map(b.color) })
  return out
}

// ---- SLIDE SCENE — the explainer layout: topic heading + supporting blocks
// (bullets / cards / chart / figure / screenshot) that reveal in sync with the
// voice. `sceneStart` is the scene's global start frame; block cueFrames are
// stored ABSOLUTE (scene-relative + start) by the Director, so we pass them
// straight through. Media (chart/figure/screenshot) sits to the RIGHT of the
// text on wide slides, or BELOW for a stacked look.
//
// NOTHING ON A SLIDE CAN LEAVE IT. Every layout is two parts: the heading (it
// fills the width and shrinks to fit at most 3 lines — lib/fit), then the rest
// of the slide inside a <FitBox> that owns all the room left below it. When the
// bullets / cards / panel are too tall for that room, the whole group shrinks
// together (re-wrapping into the width that frees up). At normal lengths it
// fits, and nothing changes size.
//  - Inside a FitBox, every <Fit> sits in a box of FIXED pixel width (a card, a
//    panel, a chart), never one that follows the FitBox's own width — so the
//    sizes it measures are the same on every frame.
//  - Each group ends with a little empty room: cards and panels slide in from
//    slightly below, and that motion must not read as "too tall". ----
const ENTRANCE_ROOM = SL(26)

const SlideScene: React.FC<{ sc: DirScene; sceneStart: number; palette: DirPlan['palette']; GP: GPalette; glassStyle: GlassStyle; MUTED: string }> =
({ sc, sceneStart, palette, GP, glassStyle, MUTED }) => {
  const P = palette!
  // cueFrames in the plan are SCENE-RELATIVE (frames from VO start). Offset them
  // to absolute here so block reveals land exactly on the spoken word.
  const off = (cf: number | undefined) => cf == null ? undefined : sceneStart + cf
  const blocks = (sc.blocks || []).map((b: any) => {
    if (b.type === 'bullets') return { ...b, items: (b.items || []).map((it: any) => ({ ...it, cueFrame: off(it.cueFrame) })) }
    if (b.type === 'cards') return { ...b, cards: (b.cards || []).map((c: any) => ({ ...c, cueFrame: off(c.cueFrame) })) }
    if (b.type === 'screenshot') return { ...b, pins: (b.pins || []).map((p: any) => ({ ...p, cueFrame: off(p.cueFrame) })) }
    return b
  })
  const align = sc.layout?.align || 'left'
  const media = sc.layout?.media || 'right'
  // classify blocks
  const bulletB = blocks.find((b) => b.type === 'bullets') as any
  const cardsB = blocks.find((b) => b.type === 'cards') as any
  const chartB = blocks.find((b) => b.type === 'chart' && b.chart) as any
  const figB = blocks.find((b) => b.type === 'figure' && b.figure) as any
  const shotB = blocks.find((b) => b.type === 'screenshot') as any
  const hStart = sceneStart + 6
  const alignItems = align === 'center' ? 'center' : 'flex-start'

  const Heading = sc.layout?.heading
    ? <SlideHeading kicker={sc.layout?.kicker} heading={sc.layout.heading} at={hStart} palette={GP} align={align} lines={shotB || (cardsB && bulletB) ? 2 : 3} />
    : null
  const Bullets = bulletB ? <BulletList items={bulletB.items as Bullet[]} sceneStart={sceneStart} palette={GP} size={SL(38)} /> : null
  const Cards = cardsB ? <DataCards cards={cardsB.cards as Card[]} sceneStart={sceneStart} palette={GP} vs={cardsB.vs} /> : null
  // COMPACT side-media (chart/figure) — these sit nicely beside bullets. Panel
  // widths are OUTER widths (GlassPanel is border-box: its width includes its padding).
  const besideBullets = !!bulletB && media !== 'below'
  const figW = SL(440)                                         // figure panel
  const chartPad = SL(44)
  const chartW = besideBullets ? SL(640) : 1360 + chartPad * 2  // a chart needs more room than a number
  const SideMedia = chartB ? (
    <GlassPanel at={sceneStart + 10} style={glassStyle} palette={GP} pad={chartPad} width={chartW}>
      <ChartVisual chart={resolveTokens(chartB.chart, { accent: P.accent, accent2: P.accent2, muted: MUTED })} at={sceneStart + 22} palette={{ ...P, muted: MUTED } as any} width={chartW - chartPad * 2} barsHeight={besideBullets ? 340 : 460} />
    </GlassPanel>
  ) : figB ? (() => {
    // The figure's number and label shrink to the panel's inside (lib/fit), so a
    // big value ($1,234,567,890) or a long label can't spill the glass box.
    const figPad = SL(52)
    const fg = figB.figure
    return (
      <GlassPanel at={sceneStart + 10} style={glassStyle} palette={GP} pad={figPad} width={figW}>
        <div style={{ textAlign: 'center', width: figW - figPad * 2 }}>
          {fg.label ? <Fit max={SL(26)} min={16} lines={3} style={{ fontFamily: MONT, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: P.accent, marginBottom: SL(18), lineHeight: 1.2 }}>{fg.label}</Fit> : null}
          <FitOdometer value={Number(fg.value) || 0} at={sceneStart + 18} max={SL(130)} min={SL(40)} color={P.text} prefix={fg.prefix} suffix={fg.suffix} decimals={fg.decimals} />
        </div>
      </GlassPanel>
    )
  })() : null

  // ---- LAYOUT DISPATCH — clean, overlap-proof cases. Padding is TIGHTER than
  // before (content uses more of the frame); gaps + zones scale with SCALE. ----

  // (A) SCREENSHOT slide — collision-proof by construction:
  //  A) the heading sits in a RESERVED, fixed-height band at the top (bigger band
  //     when bullets are present), so nothing can grow into it — and what's in
  //     the band shrinks together to fit it;
  //  B) the screenshot is SIZED to the guaranteed leftover space (height-first),
  //     with its width derived from that height so it can't overflow either axis;
  //  F) a hard SAFE_GAP separates the band from the shot, always.
  if (shotB) {
    const PAD_TOP = 128, PAD_BOTTOM = 74, SAFE_GAP = 46
    const nBullets = bulletB ? (bulletB.items?.length || 0) : 0
    // reserved header band: heading (~1 line) + one row per bullet. Scaled.
    const bandH = SL(200) + SL(52) * Math.min(nBullets, 3)
    // vertical room left for the screenshot after band + gap + paddings.
    const shotBoxH = 1080 - PAD_TOP - PAD_BOTTOM - bandH - SAFE_GAP
    // screenshot dims: fit the box height (chrome bar ~46 + image), then derive
    // width from the source 1600:1000 ratio, capped to the frame width.
    const chromeH = 46
    // (no minimum: a forced minimum pushed the shot down over the footer)
    const imgH = Math.max(200, shotBoxH - chromeH)
    const shotW = Math.min(1620, Math.round(imgH * (1600 / 1000)))
    return (
      <AbsoluteFill style={{ flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', padding: `${PAD_TOP}px 90px ${PAD_BOTTOM}px`, overflow: 'hidden' }}>
        {/* reserved header band — fixed height; heading/bullets live INSIDE it */}
        <div style={{ height: bandH, flexShrink: 0, width: '100%', maxWidth: 1740 }}>
          <FitBox valign="start" minScale={0.6}>
            <div style={{ width: 1740, margin: align === 'center' ? '0 auto' : 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems, gap: 14, paddingBottom: ENTRANCE_ROOM }}>
              {Heading}
              {Bullets && <div style={{ width: '100%', maxWidth: 1560 }}>{Bullets}</div>}
            </div>
          </FitBox>
        </div>
        {/* hard safe gap, then the screenshot sized to the remaining room */}
        <div style={{ height: SAFE_GAP, flexShrink: 0 }} />
        <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', width: '100%' }}>
          <ScreenshotFrame file={shotB.file} at={sceneStart + 10} palette={GP} pins={shotB.pins as Pin[]} sceneStart={sceneStart} width={shotW} imgHeight={imgH} />
        </div>
      </AbsoluteFill>
    )
  }

  // (B) CARDS slide: heading + optional bullets on top, cards as a centered
  // full-width row underneath. Cards never overlap bullets.
  // TOP PAD 150 (was 92): the persistent chrome owns the top ~130px (logo/name
  // top-left, "PREPARED FOR" top-right). Content starting at 92 rode UP into the
  // agent name — the overlap in the shipped slides. Start below the chrome, and
  // top-align so a tall heading grows DOWN into the empty middle, never up.
  if (cardsB) {
    return (
      <AbsoluteFill style={{ flexDirection: 'column', justifyContent: 'flex-start', alignItems, gap: Bullets ? SL(26) : SL(40), padding: '150px 84px 96px', overflow: 'hidden' }}>
        {Heading && <div style={{ width: '100%', maxWidth: 1760, flexShrink: 0 }}>{Heading}</div>}
        <div style={{ flex: '1 1 0', minHeight: 0, width: '100%' }}>
          <FitBox valign="start" minScale={0.6}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems, gap: SL(40), paddingBottom: ENTRANCE_ROOM }}>
              {Bullets && <div style={{ width: '100%', maxWidth: 1760 }}>{Bullets}</div>}
              <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>{Cards}</div>
            </div>
          </FitBox>
        </div>
      </AbsoluteFill>
    )
  }

  // (C) BULLETS slide with a compact SIDE element / ICON MOTIF filling the space.
  // The bullet column is WIDE and the icon lives in a large zone anchored toward
  // the RIGHT EDGE, sized to match the text, so the two columns feel balanced
  // (no floating gap). Icon grows with SCALE. The zone is exactly as wide as the
  // panel it holds (it used to be narrower, and the panel stuck out of it).
  const isIcon = !SideMedia && !!bulletB
  // Stacked BELOW the bullets the icon is pure decoration, so it is kept small:
  // at full size (520px) it either ran off the bottom or, now that the slide
  // shrinks to fit, made the words smaller. Beside the bullets it stays full size.
  const Media = SideMedia ?? (bulletB ? <IconMotif iconKey={pickIcon(sc.layout?.heading, sc.layout?.kicker, sc.beat, (bulletB.items || []).map((i: any) => i.text).join(' '))} at={sceneStart + 12} palette={GP} size={SL(!isIcon ? 340 : media === 'below' ? 200 : 400)} /> : null)
  const zoneW = isIcon ? SL(440) : chartB ? chartW : figW
  // the icon "breathes" (±2%): keep a hair of room so it never pokes past the row
  const iconRoom = isIcon ? 8 : 0
  const sideBySide = Media && bulletB && media !== 'below'
  if (sideBySide) {
    return (
      // TOP PAD 150 + top-align: clear the persistent chrome so the heading never
      // rides up into the agent name (see the cards-layout note).
      <AbsoluteFill style={{ flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: SL(40), padding: '150px 100px 110px', overflow: 'hidden' }}>
        {Heading && <div style={{ width: '100%', flexShrink: 0 }}>{Heading}</div>}
        <div style={{ flex: '1 1 0', minHeight: 0, width: '100%' }}>
          <FitBox valign="start" minScale={0.6}>
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: SL(56), paddingBottom: ENTRANCE_ROOM }}>
              {/* wide text column */}
              <div style={{ flex: '1 1 0', minWidth: 0 }}>{Bullets}</div>
              {/* icon anchored toward the right edge in a large zone, not floating */}
              <div style={{ flexShrink: 0, boxSizing: 'border-box', display: 'flex', justifyContent: isIcon ? 'flex-end' : 'center', alignItems: 'center', width: zoneW, paddingRight: iconRoom }}>{Media}</div>
            </div>
          </FitBox>
        </div>
      </AbsoluteFill>
    )
  }

  // (D) plain vertical stack (bullets below heading, or media below)
  // TOP PAD 150 + top-align: clear the persistent chrome (see the cards note) so
  // the heading can't collide with the agent name top-left.
  return (
    <AbsoluteFill style={{ flexDirection: 'column', justifyContent: 'flex-start', alignItems, gap: Bullets ? SL(30) : SL(40), padding: '150px 90px 110px', overflow: 'hidden' }}>
      {Heading && <div style={{ width: '100%', maxWidth: 1760, flexShrink: 0 }}>{Heading}</div>}
      {(Bullets || Media) && (
        <div style={{ flex: '1 1 0', minHeight: 0, width: '100%' }}>
          <FitBox valign="start" minScale={0.6}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems, gap: SL(40), paddingBottom: ENTRANCE_ROOM }}>
              {Bullets && <div style={{ width: '100%', maxWidth: 1760 }}>{Bullets}</div>}
              {Media && <div style={{ flexShrink: 0, padding: `0 ${iconRoom}px` }}>{Media}</div>}
            </div>
          </FitBox>
        </div>
      )}
    </AbsoluteFill>
  )
}

export const DirectedVideo: React.FC<DirectedProps> = ({ assetBase, plan, starts, total, intensity = 'premium', bpm = 128 }) => {
  setAssetBase(assetBase)
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  // LOOK drives the background STYLE; a brand palette (plan.palette, extracted
  // from the real site) overrides its COLORS so the video matches the brand.
  const look = LOOKS[(plan.look as LookName)] ?? LOOKS.ledger
  const brandPal = plan.palette as (typeof look.palette | undefined)
  const P = brandPal ?? { bg: look.palette.bg, accent: look.palette.accent, accent2: look.palette.accent2, text: look.palette.text }
  const MUTED = (brandPal as any)?.muted ?? look.palette.muted
  const GP: GPalette = { ...P, muted: MUTED }
  // the animated look-background renders in the brand palette when we have one
  const bgPalette = brandPal ? { ...look.palette, ...brandPal, muted: MUTED } : look.palette
  const glassStyle: GlassStyle = plan.chrome?.glass ?? 'vivid'
  const { spectrum } = useBeats(total)
  const S = starts
  // KNOWN beat grid from the driving bed's BPM — exact, no detection guesswork.
  const BEATF = (60 / bpm) * fps
  const beats = useMemo(() => { const g: number[] = []; for (let f = 0; f < total; f += BEATF) g.push(Math.round(f)); return g }, [total, BEATF])
  // intra-scene re-slam cadence: how often (in beats) the headline re-punches.
  // calm = never, premium = every 4 beats, highenergy = every 2.
  const reslamBeats = intensity === 'highenergy' ? 2 : intensity === 'premium' ? 4 : 0
  const idx = Math.max(0, S.filter((s) => frame >= s - 8).length - 1)
  const lastIdx = plan.scenes.length - 1
  // Interior scenes cross-fade at their next start; the LAST scene holds all the
  // way to `total` (no fade-out — otherwise the tail goes blank navy).
  const ends = [...S.slice(1), total]
  const endF = ends[idx] ?? total
  const sc = plan.scenes[idx]
  const localF = frame - (S[idx] ?? 0)
  const fadeAt = (e: number) => idx === lastIdx ? 1 : interpolate(frame, [e - 12, e], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.quad) })

  // ---- SCENE TRANSITIONS (the "smart way": applied to the single-scene render,
  // NOT a TransitionSeries refactor — timing stays on the beat grid). Each scene
  // ENTERS (first TDUR frames) and the outgoing one EXITS (last TDUR frames). The
  // TYPE is chosen by context: a WIPE when the audience section changes (kicker
  // differs), a SLIDE-push within a section, and a FADE for the cover/back. ----
  const TDUR = 14
  const prevScene = plan.scenes[idx - 1]
  const sectionOf = (x: any) => (x?.layout?.kicker || x?.beat || '').toString().toLowerCase()
  const sectionChanged = !!prevScene && sectionOf(prevScene) !== sectionOf(sc)
  const transType: 'fade' | 'slide' | 'wipe' =
    (sc?.beat === 'intro' || sc?.beat === 'cta' || prevScene?.beat === 'intro') ? 'fade'
    : sectionChanged ? 'wipe' : 'slide'
  // ENTER progress 0..1 over the scene's first TDUR frames (eased).
  const enterP = interpolate(localF, [0, TDUR], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  // EXIT progress 0..1 over the scene's last TDUR frames (0 until then).
  const exitP = idx === lastIdx ? 0 : interpolate(frame, [endF - TDUR, endF], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.cubic) })
  const transStyle: React.CSSProperties = (() => {
    // fade: pure opacity (uses fadeAt for exit to match the old feel)
    if (transType === 'fade') return { opacity: Math.min(enterP, fadeAt(endF)) }
    if (transType === 'slide') {
      // incoming slides up from +7%, outgoing drifts up and fades — a gentle push.
      const tin = (1 - enterP) * 7   // % of height
      const tout = exitP * -5
      return { opacity: Math.min(enterP < 1 ? 0.15 + enterP * 0.85 : 1, 1 - exitP), transform: `translateY(${tin + tout}vh)` }
    }
    // wipe: a diagonal reveal for section changes — incoming wipes in from the
    // right, outgoing wipes out to the left. Reads as a deliberate "new chapter".
    const inClip = `inset(0 ${(1 - enterP) * 100}% 0 0)`
    const outClip = exitP > 0 ? `inset(0 0 0 ${exitP * 100}%)` : undefined
    return { clipPath: exitP > 0 ? outClip : inClip, opacity: 1 }
  })()
  const bp = (() => { let l = -100; for (const x of beats) { if (x <= frame) l = x; else break } return Math.exp(-(frame - l) / 5) })()
  // intro (cover) and cta (back) are DEDICATED title/sign-off cards — never slides,
  // even if the writer attached blocks to them.
  const isCoverOrBack = sc?.beat === 'intro' || sc?.beat === 'cta'
  const isSlide = !isCoverOrBack && (sc?.visual?.type === 'slide' || (Array.isArray(sc?.blocks) && sc!.blocks!.length > 0))
  const isImg = !isSlide && sc?.visual?.type === 'gemini' && sc?.visual?.file
  const isChart = !isSlide && sc?.visual?.type === 'chart' && !!sc?.visual?.chart
  const isFigure = !isSlide && sc?.visual?.type === 'figure' && !!sc?.visual?.figure
  const isIntro = sc?.beat === 'intro'
  const isCta = sc?.beat === 'cta'
  const hasLogo = !!plan.chrome?.logo
  const lastBeat = idx === lastIdx
  // per-scene cinematic backdrop: explicit on the scene, else rotate the pool by
  // scene index so adjacent data scenes show different photos.
  const pool = plan.backdrops ?? []
  const sceneBackdrop = sc?.backdrop ?? (pool.length ? pool[idx % pool.length] : undefined)

  // Re-slam pulse: a tiny scale kick on each re-slam beat inside a scene, so the
  // headline "breathes" with the music instead of sitting frozen. Decays fast.
  const reslamPulse = (() => {
    if (!reslamBeats) return 0
    const sceneStart = S[idx] ?? 0
    // find the most recent re-slam beat within this scene (skip the entrance one)
    let last = -999
    for (let b = 0; b < beats.length; b++) { const bf = beats[b]; if (bf < sceneStart + Math.round(BEATF * reslamBeats)) continue; if (bf > frame) break; if ((Math.round((bf - sceneStart) / BEATF)) % reslamBeats === 0) last = bf }
    if (last < 0) return 0
    return Math.max(0, 1 - (frame - last) / 5)   // 0..1 decaying over ~5 frames
  })()
  const reslamScale = 1 + reslamPulse * (intensity === 'highenergy' ? 0.045 : 0.025)

  return (
    <AbsoluteFill style={{ background: P.bg }}>
      {/* driving bed — louder than a bg pad since the beat carries the cuts, but
          still ducked under VO. Fades in/out at the ends. */}
      {/* loop the composed bed so music NEVER cuts out mid-video (the bed is
          ~130s; longer videos need it to repeat). Fades in/out at the ends. */}
      <Audio loop src={staticFile('dir-music.mp3')} volume={(f) => { const fi = Math.min(30, total * 0.1); const fo = Math.max(fi + 1, total - Math.min(45, total * 0.15)); const fe = Math.max(fo + 1, total - 6); return interpolate(f, [0, fi, fo, fe], [0, 0.28, 0.28, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }} />
      {S.map((st, i) => <Sequence key={i} from={st}><Audio src={staticFile(`dir-vo-${plan.scenes[i].id}.mp3`)} /></Sequence>)}

      {/* SFX layer — TASTEFUL and VARIED. Quiet accents, not slaps. Not every
          scene gets a hit (restraint makes the ones that do land). No two
          consecutive scenes use the same sound. Silent when intensity='calm'. */}
      {intensity !== 'calm' && (plan as any).noSfx !== true && (() => {
        // base volume much lower than before (was 0.6) — accents, not slaps.
        const VOL = intensity === 'highenergy' ? 0.34 : 0.24
        const whooshCycle = ['whoosh-short', 'whoosh', 'whoosh-short']
        let wi = 0
        return S.map((st, i) => {
          const s2 = plan.scenes[i]
          const fig = s2?.visual?.type === 'figure'
          const chartFig = s2?.visual?.type === 'chart'
          const isLast = i === lastIdx
          const isIntroScene = s2?.beat === 'intro'
          // intro: no hit (calm open). figures/charts: soft impact when data lands.
          // other scenes: a quiet whoosh, but SKIP every 3rd for breathing room.
          let enter: string | null = null
          if (i === 0 || isIntroScene) enter = null
          else if (fig || chartFig) enter = 'impact-soft'
          else if (i % 3 !== 0) { enter = whooshCycle[wi % whooshCycle.length]; wi++ }
          return (
            <React.Fragment key={`sfx-${i}`}>
              {enter && <Sfx name={enter} at={st - 3} total={total} volume={enter === 'impact-soft' ? VOL * 0.9 : VOL} />}
              {/* the number landing on a figure/odometer gets one soft impact */}
              {fig && <Sfx name="impact-soft" at={st + Math.round(1.6 * fps)} total={total} volume={VOL} />}
              {/* the final CTA gets a single sub-drop — the one big moment */}
              {isLast && <Sfx name="subdrop" at={st + 6} total={total} volume={VOL * 1.3} />}
            </React.Fragment>
          )
        })
      })()}

      <AbsoluteFill style={transStyle}>
        {isImg
          ? <KBPhoto file={sc.visual.file!} move={sc.camera || 'pushIn'} localFrame={localF} dur={endF - (S[idx] ?? 0) - 14} palette={P} />
          : sceneBackdrop
            // per-scene cinematic photo backdrop (rotates), slow drift + HEAVY
            // dark grade so numbers/text read on top. Every data scene = film.
            ? (<AbsoluteFill style={{ overflow: 'hidden' }}>
                <Img src={staticFile(sceneBackdrop)} style={{ position: 'absolute', width: '116%', height: '116%', left: '-8%', top: '-8%', objectFit: 'cover', transform: `scale(${1 + localF * 0.0004}) translateX(${Math.sin((frame + idx * 40) * 0.006) * 12}px)`, filter: 'brightness(0.42) saturate(0.92) contrast(1.06)' }} />
                <AbsoluteFill style={{ background: `linear-gradient(180deg, ${hex(P.bg, 0.55)}, ${hex(P.bg, 0.4)} 45%, ${hex(P.bg, 0.8)})` }} />
                <AbsoluteFill style={{ background: 'radial-gradient(125% 125% at 50% 45%, transparent 45%, rgba(0,0,0,0.72))' }} />
              </AbsoluteFill>)
            : <look.Background frame={frame} palette={bgPalette} />}

        {/* COVER scene: cinematic LOGO REVEAL if a logo exists, else a proper
            title card — big brand name + tagline. Always a dedicated cover. */}
        {isIntro && (hasLogo ? (
          <LogoReveal logo={plan.chrome!.logo!} palette={GP} localFrame={localF} tagline={plan.intro?.line2} recipient={plan.intro?.recipient || plan.chrome?.recipient} />
        ) : (
          // Every line sits in the 1600px column and shrinks to fit (lib/fit):
          // the name to 2 lines, the tagline to 2, the client's name to 2 — so
          // even the longest company + client names stay on the cover.
          <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '0 160px', flexDirection: 'column', gap: 30 }}>
            <AbsoluteFill style={{ background: `radial-gradient(760px 520px at 50% 46%, ${hex(P.accent, 0.14)}, transparent 62%)` }} />
            {/* optional presenter headshot on the cover (real agent, opt-in) */}
            {plan.presenter?.photo && plan.presenter?.onCover && (
              <Img src={staticFile(plan.presenter.photo)} style={{ width: 168, height: 168, flexShrink: 0, borderRadius: '50%', objectFit: 'cover', border: `5px solid ${P.text}`, outline: `2px solid ${P.accent}`, boxShadow: `0 0 32px ${hex(P.accent, 0.5)}`, opacity: spring({ frame: localF, fps, config: { damping: 20, stiffness: 80 } }) }} />
            )}
            {(plan.chrome?.company || plan.intro?.line1) && (
              <div style={{ width: '100%', opacity: spring({ frame: localF, fps, config: { damping: 20, stiffness: 70 } }), transform: `scale(${0.9 + Math.min(1, spring({ frame: localF, fps, config: { damping: 20, stiffness: 70 } })) * 0.1})` }}>
                <Fit max={116} min={52} lines={2} style={{ fontFamily: SANS, fontWeight: 900, lineHeight: 1.02, letterSpacing: '0.01em', color: P.text, textShadow: '0 4px 30px rgba(0,0,0,0.6)' }}>{plan.chrome?.company || plan.intro?.line1}</Fit>
              </div>
            )}
            <div style={{ width: 260 * clamp((localF - 18) / 16, 0, 1), height: 3, flexShrink: 0, background: `linear-gradient(90deg, transparent, ${legibleOn(P.accent, P.bg, P)}, transparent)`, boxShadow: `0 0 16px ${hex(P.accent, 0.6)}` }} />
            {(plan.intro?.line2 || plan.intro?.line1) && (
              <div style={{ width: '100%', maxWidth: 1300, opacity: spring({ frame: localF - 20, fps, config: { damping: 18, stiffness: 100 } }) }}>
                <Fit max={36} min={18} lines={2} style={{ fontFamily: SANS, fontWeight: 600, letterSpacing: '0.06em', color: MUTED, lineHeight: 1.2 }}>{plan.intro?.line2 || plan.intro?.line1}</Fit>
              </div>
            )}
            {/* "Prepared for [Client]" — personalized cover line (photo/title cover). */}
            {(plan.intro?.recipient || plan.chrome?.recipient) && (
              <div style={{ marginTop: 18, width: '100%', maxWidth: 1300, opacity: spring({ frame: localF - 34, fps, config: { damping: 18, stiffness: 90 } }), textAlign: 'center' }}>
                <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 17, letterSpacing: '0.28em', textTransform: 'uppercase', color: P.accent }}>Prepared for</div>
                <Fit max={34} min={18} lines={2} style={{ fontFamily: SANS, fontWeight: 800, color: P.text, marginTop: 8, textShadow: '0 2px 12px rgba(0,0,0,0.6)', lineHeight: 1.2 }}>{plan.intro?.recipient || plan.chrome?.recipient}</Fit>
              </div>
            )}
          </AbsoluteFill>
        ))}

        {/* FIGURE scene: odometer number inside a GLASS panel on the photo bg
            (only for standalone figure scenes; slides handle their own figures) */}
        {isFigure && !isIntro && !isSlide && (() => {
          // the big number and its label shrink to the panel's inside (lib/fit)
          const fg = sc.visual.figure!
          const panelW = 1100
          return (
          <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: '0 100px' }}>
            <GlassPanel at={(S[idx] ?? 0) + 8} style={glassStyle} palette={GP} pad={72} width={panelW}>
              <div style={{ textAlign: 'center', width: panelW - 72 * 2 }}>
                {(fg.label || sc.on_screen) ? <Fit max={34} min={18} lines={2} style={{ fontFamily: 'Montserrat', fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase', color: P.accent, marginBottom: 22, lineHeight: 1.2, opacity: spring({ frame: localF, fps, config: { damping: 16, stiffness: 150 } }) }}>{fg.label || sc.on_screen}</Fit> : null}
                <FitOdometer value={Number(fg.value) || 0} at={(S[idx] ?? 0) + 14} max={150} min={48} color={P.text} prefix={fg.prefix} suffix={fg.suffix} decimals={fg.decimals} />
              </div>
            </GlassPanel>
          </AbsoluteFill>
          )
        })()}

        {/* SLIDE scene: topic heading + supporting blocks (bullets/cards/chart/
            figure/screenshot) that reveal in sync with the voice. This is the
            explainer-deck layout — the whole point of the slide system. */}
        {isSlide && !isIntro && !isCta && (
          <SlideScene sc={sc} sceneStart={S[idx] ?? 0} palette={P} GP={GP} glassStyle={glassStyle} MUTED={MUTED} />
        )}

        {/* CHART scene: title top, animated chart center-stage on the look bg.
            (intro/figure/slide scenes are rendered above; skip the text dispatch here.) */}
        {sc && !isIntro && !isFigure && !isSlide && (isChart ? (
          // CHART inside a glass panel (title lives inside the glass header)
          // Fixed-width panel (the chart's own width); the title wraps to 2 lines
          // and shrinks to it, and the whole panel shrinks if it's too tall.
          <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: '130px 90px 120px' }}>
            <FitBox valign="center" minScale={0.6}>
              <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 24 }}>
                <GlassPanel at={(S[idx] ?? 0) + 8} style={glassStyle} palette={GP} pad={50} width={1360 + 50 * 2}>
                  {sc.on_screen ? <Fit max={32} min={18} lines={2} style={{ fontFamily: 'Montserrat', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: P.accent, marginBottom: 20, textAlign: 'center', lineHeight: 1.2 }}>{sc.on_screen}</Fit> : null}
                  <ChartVisual chart={resolveTokens(sc.visual.chart!, { accent: P.accent, accent2: P.accent2, muted: MUTED })} at={(S[idx] ?? 0) + 20} palette={{ ...P, muted: MUTED } as any} width={1360} barsHeight={460} />
                </GlassPanel>
              </div>
            </FitBox>
          </AbsoluteFill>
        ) : isCta ? (
          // CTA sign-off (BACK slide): the LOGO CLOSE — logo if present, else the
          // company name — with the CTA line + contact info. Always a clean
          // sign-off card, never bullets. Contact obeys the "final scene only,
          // verbatim from source" rule (comes from plan.cta.contact/footer).
          <LogoClose logo={plan.chrome?.logo} company={plan.chrome?.company} palette={GP} localFrame={localF} total={total} presenter={plan.presenter?.onClosing !== false ? plan.presenter : undefined} cta={plan.cta?.line || sc.on_screen} contact={plan.cta?.contact || plan.chrome?.footer?.split('·').filter((p: string) => /@|\.com|\d{3}|book|call|visit/i.test(p))[0]?.trim()} />
        ) : isImg ? (
          // IMAGE scene stays CLEAN (restraint) — just a lower-third caption.
          <LowerThird text={sc.on_screen} at={(S[idx] ?? 0) + 12} palette={GP} size={82} />
        ) : (
          // KINETIC text scene: centered headline (hook/context)
          <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '0 130px', flexDirection: 'column', gap: 24, transform: `scale(${reslamScale})` }}>
            <Title text={sc.on_screen} at={(S[idx] ?? 0) + 8} size={sc.on_screen.length > 18 ? 120 : 168} color={P.text} beats={beats} maxW={1620} entrance={sc.entrance || 'rise'} />
          </AbsoluteFill>
        ))}
      </AbsoluteFill>

      {/* (EQ bars removed — the persistent footer rule owns the bottom now.) */}

      {/* FILM GRADE + GRAIN — one consistent finish over every scene so the
          distinct backdrops feel like one film stock. Above content, below chrome. */}
      <FilmGrade accent={P.accent} intensity={0.9} />

      {/* cut flash — a subtle white pop on each scene boundary, paired with the
          whoosh/impact SFX. Skipped on WIPE transitions (a clean reveal doesn't
          want a flash on top) and softened since transitions now carry the cut. */}
      {transType !== 'wipe' && (() => { const c = S[idx] ?? 0; const fl = clamp(1 - (frame - c) / 5, 0, 1) * (frame >= c ? 1 : 0); const strength = intensity === 'highenergy' ? 0.12 : intensity === 'calm' ? 0.04 : 0.07; return <AbsoluteFill style={{ background: '#fff', opacity: fl * strength, pointerEvents: 'none' }} /> })()}

      {/* PERSISTENT CHROME — logo top-left, recipient tag, footer. NOT on the
          intro or cta (both are full-frame logo moments with their own layout). */}
      {plan.chrome && !isIntro && !(isCta && hasLogo) && (
        <PersistentFrame palette={GP} company={plan.chrome.company} logo={plan.chrome.logo} recipient={plan.chrome.recipient} footer={plan.chrome.footer} total={total} />
      )}
    </AbsoluteFill>
  )
}
