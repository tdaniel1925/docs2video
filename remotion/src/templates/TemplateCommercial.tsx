import React from 'react'
import { AbsoluteFill, Img, Audio, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion'
import { staticFile, setAssetBase } from '../lib/asset'
import { z } from 'zod'
import { loadFont as loadSpaceGrotesk } from '@remotion/google-fonts/SpaceGrotesk'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import { loadFont as loadJetBrains } from '@remotion/google-fonts/JetBrainsMono'
import { loadFont as loadFraunces } from '@remotion/google-fonts/Fraunces'
import { loadFont as loadArchivoBlack } from '@remotion/google-fonts/ArchivoBlack'
import { loadFont as loadBaloo } from '@remotion/google-fonts/Baloo2'
import { loadFont as loadPlayfair } from '@remotion/google-fonts/PlayfairDisplay'
import { CountUp, StreakWipe, Bokeh, Alive, sustained, SettleSweep, LogoBug } from '../lib/pizzazz'
import { makeMusicDuck, type VoWindow } from '../lib/audio'
import { MusicBed } from '../lib/musicbed'
import { Intro, type IntroStyle } from '../lib/intros'
// motion techniques (built-but-previously-unused) — wired per style for variety
import { ParticleField, ShatterWord, PhysicsWord } from '../lib/dynamics'
import { WeightyEntry, EmergeFromDepth } from '../lib/cinematography'
// Every word here is written by the director model (or typed by the customer),
// so no slot can trust its length. <Fit> shrinks a run of text until it fits
// its box; <FitBox> shrinks a whole group (a grid of cards) to fit its area.
import { Fit, FitBox } from '../lib/fit'

const { fontFamily: GROTESK } = loadSpaceGrotesk()
const { fontFamily: INTER } = loadInter()
const { fontFamily: MONO } = loadJetBrains()
const { fontFamily: FRAUNCES } = loadFraunces()
const { fontFamily: ARCHIVO } = loadArchivoBlack()
const { fontFamily: BALOO } = loadBaloo()
const { fontFamily: PLAYFAIR } = loadPlayfair()
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
// join headline segments (pre + hot + post) with exactly one space where two
// non-empty segments meet — the director sometimes omits the trailing/leading
// space, which rendered as "Your data issitting idle". These add a space only
// when the boundary lacks one, so intentional punctuation ("$5," + "M") is safe.
const preSp = (pre = '', hot = '') => (pre && hot && !/\s$/.test(pre) && !/^[\s.,!?;:)]/.test(hot) ? pre + ' ' : pre)
const postSp = (post = '', hot = '') => (post && hot && !/^\s/.test(post) && !/[\s(]$/.test(hot) ? ' ' + post : post)
const FPS = 30
const s = (sec: number) => Math.round(sec * FPS)

type Figure = { value: number; prefix?: string; suffix?: string; decimals?: number }
// The number a CountUp lands on, formatted exactly the way CountUp formats it.
const finalFigure = (x: Figure) => {
  const dec = x.decimals ?? (Number.isInteger(x.value) ? 0 : 2)
  return `${x.prefix || ''}${x.value.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })}${x.suffix || ''}`
}
// A count-up number whose box is always as wide as its FINAL value (an
// invisible copy sits underneath). So the size <Fit> picks for it never
// changes while the digits count up, and the number never grows past its box.
const Counter: React.FC<{ x: Figure; startAt: number; dur: number }> = ({ x, startAt, dur }) => (
  <span style={{ display: 'inline-grid', justifyItems: 'center', verticalAlign: 'top' }}>
    <span aria-hidden style={{ gridArea: '1 / 1', visibility: 'hidden' }}>{finalFigure(x)}</span>
    <span style={{ gridArea: '1 / 1' }}><CountUp to={x.value} prefix={x.prefix || ''} suffix={x.suffix || ''} decimals={x.decimals} startAt={startAt} dur={dur} /></span>
  </span>
)
// Split a list into rows of at most `max`, as evenly as possible (5 → 3 + 2).
const rowsOf = <T,>(xs: T[], max: number): T[][] => {
  const n = Math.max(1, Math.ceil(xs.length / max)); const per = Math.ceil(xs.length / n)
  return Array.from({ length: n }, (_, i) => xs.slice(i * per, (i + 1) * per)).filter((r) => r.length)
}
// Where a beat's cards / numbers may sit. Kept clear of the headline that
// overlays the bottom of stats and grid beats (it never rises above ~810px —
// see Head's `lines`), and centred like before, so a normal-sized group lands
// exactly where it always did. Only an oversized group shrinks (as a whole).
// Holds PLAIN text only — never a <Fit> (a Fit inside a FitBox chases the
// scale frame to frame). Its contents keep fixed widths so nothing inside
// depends on the scale.
const ContentArea: React.FC<{ hasHead: boolean; children: React.ReactNode }> = ({ hasHead, children }) => {
  const m = hasHead ? 280 : 130
  return (
    <div style={{ position: 'absolute', left: 80, right: 80, top: m, bottom: m }}>
      <FitBox valign="center" minScale={0.6}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>{children}</div>
      </FitBox>
    </div>
  )
}

/* ============================================================================
 * TemplateCommercial — the SPEC-DRIVEN engine. ONE composition renders ANY of the
 * styles we built, for ANY brand, from props: a `styleId` picks the visual
 * language (fonts / intro / motion feel / display treatment), `brand` gives the
 * palette + logo, and `beats[]` (a rich kind-vocabulary) drives the content.
 * The director outputs this props JSON; the VPS renders it.
 * ==========================================================================*/

// ---- STYLE PRESETS = MOTION PROFILES. A style is NOT just fonts+colors — it
// carries a MOVEMENT signature: how shots move (kb zoom + glitch), how text
// reveals (fade/wipe/slam), how energetic the SFX are, and the cut feel. Two
// styles with the same font can feel totally different because they MOVE
// differently. This is what makes each video feel bespoke, not a recolor. ----
type TextReveal = 'fade' | 'wipe' | 'slam'      // headline entrance
type SfxProfile = 'none' | 'soft' | 'punchy' | 'aggressive'
type CutFeel = 'smooth' | 'snap' | 'hard'
type StyleId =
  | 'fintech' | 'luxury' | 'tech' | 'upbeat' | 'emerald' | 'redblueprint' | 'data' | 'playful' | 'casino' | 'clean'
  | 'glitchcore' | 'cinematic' | 'noir' | 'retro' | 'vibrant' | 'editorial' | 'brutalist' | 'aurora' | 'sport' | 'corporate' | 'neon' | 'organic'
type StylePreset = {
  display: string; body: string; mono: string; intro: IntroStyle; upper: boolean; heavy: boolean
  // MOTION signature:
  kb: number          // Ken Burns zoom intensity on shots (1.0 = none, 1.2 = strong)
  glitch: boolean     // jitter + flicker on shots (energetic/edgy)
  reveal: TextReveal  // how headlines enter
  sfx: SfxProfile     // transition/impact sound design
  cut: CutFeel        // wipe/streak character between beats
  cam: boolean        // continuous handheld camera drift on shots
  grain: number       // 0..1 film grain / texture overlay
}
// derived ambient particle kind per style — 'data' for tech/glitch, 'ember' for
// warm/energetic, 'dust' for soft/cinematic, 'none' for clean/minimal.
const particleKind = (st: StylePreset): 'dust' | 'ember' | 'data' | 'none' => {
  if (st.sfx === 'none') return 'none'
  if (st.glitch) return 'data'
  if (st.grain >= 0.12 || st.cam) return 'dust'
  if (st.sfx === 'aggressive' || st.upper) return 'ember'
  return 'dust'
}
// for glitch/aggressive styles, the hero headline gets a dramatic SHATTER or
// PHYSICS entrance instead of a plain reveal.
const heroTreatment = (st: StylePreset): 'shatter' | 'physics' | 'none' => {
  if (st.glitch && st.sfx === 'aggressive') return 'shatter'
  if (st.reveal === 'slam' && st.sfx === 'aggressive') return 'physics'
  return 'none'
}
const STYLES: Record<StyleId, StylePreset> = {
  // — the original 10, now with motion —
  fintech:      { display: GROTESK, body: INTER, mono: MONO, intro: 'terminal',  upper: false, heavy: true,  kb: 1.10, glitch: false, reveal: 'wipe', sfx: 'punchy',     cut: 'snap',   cam: false, grain: 0.05 },
  luxury:       { display: FRAUNCES, body: INTER, mono: MONO, intro: 'signature', upper: false, heavy: false, kb: 1.06, glitch: false, reveal: 'fade', sfx: 'soft',       cut: 'smooth', cam: true,  grain: 0.12 },
  tech:         { display: GROTESK, body: INTER, mono: MONO, intro: 'assembly',  upper: false, heavy: true,  kb: 1.12, glitch: true,  reveal: 'wipe', sfx: 'punchy',     cut: 'snap',   cam: false, grain: 0.06 },
  upbeat:       { display: ARCHIVO, body: INTER, mono: MONO, intro: 'ignition',  upper: true,  heavy: true,  kb: 1.14, glitch: false, reveal: 'slam', sfx: 'punchy',     cut: 'snap',   cam: false, grain: 0.04 },
  emerald:      { display: GROTESK, body: INTER, mono: MONO, intro: 'terminal',  upper: false, heavy: true,  kb: 1.10, glitch: false, reveal: 'wipe', sfx: 'soft',       cut: 'smooth', cam: true,  grain: 0.06 },
  redblueprint: { display: GROTESK, body: INTER, mono: MONO, intro: 'assembly',  upper: false, heavy: true,  kb: 1.14, glitch: true,  reveal: 'slam', sfx: 'aggressive', cut: 'hard',   cam: false, grain: 0.08 },
  data:         { display: GROTESK, body: INTER, mono: MONO, intro: 'terminal',  upper: false, heavy: true,  kb: 1.08, glitch: false, reveal: 'wipe', sfx: 'punchy',     cut: 'snap',   cam: false, grain: 0.04 },
  playful:      { display: BALOO,   body: INTER, mono: MONO, intro: 'pop',       upper: false, heavy: true,  kb: 1.16, glitch: false, reveal: 'slam', sfx: 'punchy',     cut: 'snap',   cam: false, grain: 0.03 },
  casino:       { display: ARCHIVO, body: PLAYFAIR, mono: MONO, intro: 'ignition', upper: true, heavy: true, kb: 1.16, glitch: true,  reveal: 'slam', sfx: 'aggressive', cut: 'hard',   cam: false, grain: 0.05 },
  clean:        { display: GROTESK, body: INTER, mono: MONO, intro: 'signature', upper: false, heavy: false, kb: 1.04, glitch: false, reveal: 'fade', sfx: 'none',       cut: 'smooth', cam: false, grain: 0.02 },
  // — new styles, distinct MOTION signatures —
  glitchcore:   { display: MONO,    body: MONO,  mono: MONO, intro: 'terminal',  upper: true,  heavy: true,  kb: 1.18, glitch: true,  reveal: 'slam', sfx: 'aggressive', cut: 'hard',   cam: false, grain: 0.14 },
  cinematic:    { display: FRAUNCES, body: INTER, mono: MONO, intro: 'signature', upper: false, heavy: false, kb: 1.20, glitch: false, reveal: 'fade', sfx: 'soft',       cut: 'smooth', cam: true,  grain: 0.16 },
  noir:         { display: FRAUNCES, body: INTER, mono: MONO, intro: 'signature', upper: false, heavy: false, kb: 1.10, glitch: false, reveal: 'fade', sfx: 'soft',       cut: 'smooth', cam: true,  grain: 0.20 },
  retro:        { display: ARCHIVO, body: INTER, mono: MONO, intro: 'pop',       upper: true,  heavy: true,  kb: 1.12, glitch: true,  reveal: 'wipe', sfx: 'punchy',     cut: 'snap',   cam: false, grain: 0.22 },
  vibrant:      { display: BALOO,   body: INTER, mono: MONO, intro: 'ignition',  upper: true,  heavy: true,  kb: 1.16, glitch: false, reveal: 'slam', sfx: 'punchy',     cut: 'snap',   cam: false, grain: 0.03 },
  editorial:    { display: PLAYFAIR, body: INTER, mono: MONO, intro: 'signature', upper: false, heavy: false, kb: 1.05, glitch: false, reveal: 'wipe', sfx: 'soft',       cut: 'smooth', cam: false, grain: 0.08 },
  brutalist:    { display: ARCHIVO, body: MONO,  mono: MONO, intro: 'assembly',  upper: true,  heavy: true,  kb: 1.02, glitch: false, reveal: 'slam', sfx: 'aggressive', cut: 'hard',   cam: false, grain: 0.10 },
  aurora:       { display: GROTESK, body: INTER, mono: MONO, intro: 'ignition',  upper: false, heavy: true,  kb: 1.14, glitch: false, reveal: 'fade', sfx: 'soft',       cut: 'smooth', cam: true,  grain: 0.05 },
  sport:        { display: ARCHIVO, body: INTER, mono: MONO, intro: 'ignition',  upper: true,  heavy: true,  kb: 1.18, glitch: true,  reveal: 'slam', sfx: 'aggressive', cut: 'hard',   cam: false, grain: 0.06 },
  corporate:    { display: GROTESK, body: INTER, mono: MONO, intro: 'assembly',  upper: false, heavy: true,  kb: 1.08, glitch: false, reveal: 'wipe', sfx: 'punchy',     cut: 'snap',   cam: false, grain: 0.04 },
  neon:         { display: ARCHIVO, body: INTER, mono: MONO, intro: 'ignition',  upper: true,  heavy: true,  kb: 1.16, glitch: true,  reveal: 'slam', sfx: 'aggressive', cut: 'hard',   cam: false, grain: 0.07 },
  organic:      { display: FRAUNCES, body: INTER, mono: MONO, intro: 'signature', upper: false, heavy: false, kb: 1.10, glitch: false, reveal: 'fade', sfx: 'soft',       cut: 'smooth', cam: true,  grain: 0.10 },
}
const STYLE_IDS = Object.keys(STYLES) as StyleId[]

// ---- PROPS SCHEMA ----
export const commercialSchema = z.object({
  assetBase: z.string().optional(),   // set by the Lambda render script; empty = local files
  styleId: z.enum(['fintech', 'luxury', 'tech', 'upbeat', 'emerald', 'redblueprint', 'data', 'playful', 'casino', 'clean', 'glitchcore', 'cinematic', 'noir', 'retro', 'vibrant', 'editorial', 'brutalist', 'aurora', 'sport', 'corporate', 'neon', 'organic']),
  brand: z.object({
    bg: z.string(), bg2: z.string(), panel: z.string(),
    accent: z.string(), accentHi: z.string(), accent2: z.string().optional(),
    cream: z.string(), mute: z.string(), white: z.string(),
  }),
  logo: z.string().optional(),                 // logo image path (in assetDir), else wordmark text
  wordmark: z.object({ pre: z.string(), post: z.string() }).optional(),
  logoLetter: z.string().optional(),
  assetDir: z.string(),
  music: z.object({ file: z.string(), frames: z.number() }),
  introFrames: z.number().default(90),
  duck: z.object({ loud: z.number(), duck: z.number() }).default({ loud: 0.2, duck: 0.08 }),
  bug: z.boolean().default(true),
  beats: z.array(z.object({
    dur: z.number(), vo: z.string().optional(),
    kind: z.enum(['shot', 'meet', 'stats', 'grid', 'chat', 'quote', 'split', 'cta', 'brand', 'showcase', 'bignumber', 'steps']),
    // optional LAYOUT variant for a beat kind — lets the director vary the
    // COMPOSITION (not just color/copy) so two videos don't share the same
    // spatial skeleton. Ignored by kinds that don't define variants.
    variant: z.number().int().min(0).max(3).optional(),
    img: z.string().optional(), dim: z.number().optional(),
    shot: z.string().optional(),   // (showcase) real site screenshot path in assetDir
    kicker: z.string().optional(), pre: z.string().optional(), hot: z.string().optional(), post: z.string().optional(), sub: z.string().optional(),
    size: z.number().optional(),
    stats: z.array(z.object({ value: z.number(), prefix: z.string().optional(), suffix: z.string().optional(), label: z.string(), decimals: z.number().optional() })).optional(),
    items: z.array(z.object({ icon: z.string().optional(), title: z.string(), desc: z.string().optional() })).optional(),
    chat: z.object({ q: z.string(), a: z.string() }).optional(),
    split: z.object({ leftLabel: z.string(), leftSub: z.string(), rightLabel: z.string(), rightSub: z.string(), both: z.string().optional() }).optional(),
    cta: z.object({ headline: z.string(), button: z.string(), url: z.string() }).optional(),
    big: z.object({ value: z.number(), prefix: z.string().optional(), suffix: z.string().optional(), label: z.string(), decimals: z.number().optional() }).optional(),  // (bignumber) one giant animated stat
    steps: z.array(z.object({ title: z.string(), desc: z.string().optional() })).optional(),  // (steps) how-it-works timeline
  })),
})
export type CommercialProps = z.infer<typeof commercialSchema>

export function commercialDuration(p: CommercialProps): number {
  let t = p.introFrames
  for (const b of p.beats) t += s(b.dur)
  return t + 6
}

// ================= shared pieces (read style + brand) =======================
const Ctx = React.createContext<{ p: CommercialProps; st: StylePreset }>(null as any)
const use = () => React.useContext(Ctx)

// Ambient — per-style particle field layered behind text beats (data motes for
// tech/glitch, warm embers for energetic, soft dust for cinematic). Adds
// perpetual life so no beat sits static. Renders nothing for 'clean' styles.
const Ambient: React.FC = () => {
  const { p, st } = use(); const kind = particleKind(st)
  if (kind === 'none') return null
  return <ParticleField color={p.brand.accent} count={kind === 'data' ? 32 : 26} speed={st.glitch ? 1.4 : 0.8} kind={kind} />
}

// Enter — per-style ENTRANCE choreography for a beat's main content. Elements
// don't just fade: on punchy/aggressive styles they FLY in with weight +
// overshoot + a lagging shadow (WeightyEntry); on smooth/cinematic styles they
// EMERGE from depth. `from` sets the fly direction. This is what makes elements
// genuinely move ON screen instead of appearing.
const Enter: React.FC<{ at?: number; from?: 'bottom' | 'top' | 'left' | 'right' | 'scale'; children: React.ReactNode }> =
({ at = 2, from = 'bottom', children }) => {
  const { st } = use()
  if (st.cut === 'hard' || st.reveal === 'slam') return <WeightyEntry at={at} from={from} shadow distance={90}>{children}</WeightyEntry>
  if (st.cut === 'snap') return <WeightyEntry at={at} from={from} shadow={false} distance={50}>{children}</WeightyEntry>
  return <EmergeFromDepth dur={16}>{children}</EmergeFromDepth>   // smooth/soft → rise from depth
}

// `maxWidth`: the most room the brand name may take. A long name (the
// director copies it from the site) wraps to two lines, then shrinks.
const Wordmark: React.FC<{ size?: number; maxWidth?: number }> = ({ size = 90, maxWidth = 1760 }) => {
  const { p, st } = use(); const b = p.brand
  // A tall logo is kept inside a square — at `width` alone it could run off the frame.
  if (p.logo) return <Img src={staticFile(`${p.assetDir}/${p.logo}`)} style={{ width: size * 4.5, maxWidth, height: 'auto', maxHeight: size * 4.5, objectFit: 'contain', display: 'block', filter: `drop-shadow(0 0 20px ${b.accent}44)` }} />
  const wm = p.wordmark || { pre: 'Brand', post: '' }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, maxWidth }}>
      {p.logoLetter && <div style={{ width: size, height: size, flexShrink: 0, borderRadius: size * 0.19, background: `linear-gradient(135deg, ${b.accentHi}, ${b.accent})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: st.display, fontWeight: 700, fontSize: size * 0.6, color: b.bg }}>{p.logoLetter}</div>}
      <div style={{ flex: '0 1 auto', minWidth: 0 }}>
        <Fit max={size * 0.8} min={Math.round(size * 0.35)} lines={2} style={{ fontFamily: st.display, fontWeight: st.heavy ? 700 : 500, letterSpacing: '-0.01em', color: b.white, textTransform: st.upper ? 'uppercase' : 'none' }}>{wm.pre}<span style={{ color: b.accent }}>{wm.post}</span></Fit>
      </div>
    </div>
  )
}

// Shot — a still image made cinematic by the style's MOTION profile: variable
// Ken Burns zoom (kb), optional glitch jitter/flicker (edgy styles), continuous
// handheld camera drift (cam), and film grain. Ported + generalized from the
// hand-built SmartScale Shot (which was the good, alive one).
const Shot: React.FC<{ src: string; dur: number; dim?: number; focus?: string }> = ({ src, dur, dim = 1, focus = '50% 45%' }) => {
  const { p, st } = use(); const frame = useCurrentFrame(); const b = p.brand
  const prog = interpolate(frame, [0, dur], [0, 1], { extrapolateRight: 'clamp' })
  const sc = 1.05 + (st.kb - 1) * prog                                  // Ken Burns per style
  // glitch: subtle sinusoidal jitter + occasional hard kick + flicker
  const jit = st.glitch ? (Math.sin(frame * 2.1) * 2 + (frame % 7 < 1 ? 6 : 0)) : 0
  // camera drift: slow perpetual handheld sway
  const camX = st.cam ? Math.sin(frame * 0.05) * 0.8 : 0
  const camY = st.cam ? Math.cos(frame * 0.037) * 0.6 : 0
  const bright = (st.glitch ? 0.72 : 0.84) * dim
  const sat = st.glitch ? 1.16 : 1.05
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: b.bg }}>
      <Img src={staticFile(`${p.assetDir}/${src}`)} style={{ width: '114%', height: '114%', position: 'absolute', left: '-7%', top: '-7%', objectFit: 'cover', objectPosition: focus, transform: `scale(${sc}) translate(${(-1.2 * prog) + camX + jit / 40}%, ${(0.6 * prog) + camY}%)`, filter: `brightness(${bright}) contrast(1.14) saturate(${sat})` }} />
      {/* glitch RGB-split flash on the hard-kick frames */}
      {st.glitch && frame % 7 < 1 && <Img src={staticFile(`${p.assetDir}/${src}`)} style={{ width: '114%', height: '114%', position: 'absolute', left: '-6.6%', top: '-7%', objectFit: 'cover', objectPosition: focus, transform: `scale(${sc})`, filter: 'brightness(0.9) saturate(3)', mixBlendMode: 'screen', opacity: 0.35 }} />}
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${b.bg}88, transparent 28%, transparent 55%, ${b.bg}f2)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(70% 70% at 78% 18%, ${b.accent}16, transparent 45%)`, mixBlendMode: 'screen' }} />
      {/* film grain / texture per style */}
      {st.grain > 0.02 && <AbsoluteFill style={{ opacity: st.grain, backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%222%22/></filter><rect width=%22120%22 height=%22120%22 filter=%22url(%23n)%22/></svg>")', mixBlendMode: 'overlay' }} />}
    </AbsoluteFill>
  )
}

// SHOWCASE — a REAL site screenshot inside a clean browser frame, floating on a
// branded backdrop with a slow cinematic push. Used sparingly (director-gated) to
// show the actual product. Falls back to nothing if src missing.
const ShowcaseBeat: React.FC<{ hold: number; src?: string; kicker?: string; hot?: string; sub?: string }> = ({ hold, src, kicker, hot, sub }) => {
  const { p, st } = use(); const frame = useCurrentFrame(); const { fps } = useVideoConfig(); const b = p.brand
  const rise = spring({ frame: frame - 4, fps, config: { damping: 16, stiffness: 90 } })
  const push = interpolate(frame, [0, hold], [1.0, 1.05], { extrapolateRight: 'clamp' })
  const o = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 30%, ${b.bg2}, ${b.bg})` }}>
      <Bokeh color={b.accent} count={4} big /><Ambient />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', paddingBottom: (kicker || hot) ? 130 : 0 }}>
        <div style={{ width: 1180, transform: `translateY(${(1 - clamp(rise, 0, 1)) * 60}px) scale(${(0.86 + clamp(rise, 0, 1) * 0.14) * push})`, opacity: o, borderRadius: 14, overflow: 'hidden', boxShadow: `0 40px 120px rgba(0,0,0,0.6), 0 0 0 1px ${b.accent}33` }}>
          {/* browser chrome */}
          <div style={{ height: 40, background: b.panel, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 8, borderBottom: `1px solid ${b.mute}22` }}>
            <div style={{ width: 11, height: 11, borderRadius: 6, background: '#ff5f57' }} />
            <div style={{ width: 11, height: 11, borderRadius: 6, background: '#febc2e' }} />
            <div style={{ width: 11, height: 11, borderRadius: 6, background: '#28c840' }} />
            <div style={{ flex: 1, marginLeft: 12, height: 22, borderRadius: 6, background: b.bg2, opacity: 0.6 }} />
          </div>
          {/* a tall (full-page) screenshot is cropped from the top rather than run off the frame */}
          {src ? <Img src={staticFile(`${p.assetDir}/${src}`)} style={{ width: '100%', display: 'block', maxHeight: 760, objectFit: 'cover', objectPosition: 'top' }} /> : <div style={{ width: '100%', height: 620, background: b.panel }} />}
        </div>
      </AbsoluteFill>
      {(kicker || hot) && <Head kicker={kicker} hot={hot} sub={sub} hold={hold} size={44} lines={2} />}
      <SettleSweep color={b.accent} hold={hold} />
    </AbsoluteFill>
  )
}

// `lines`: most lines the headline may take before it shrinks. Shot beats (the
// headline IS the picture's caption) allow 3; beats that overlay a headline
// under cards/numbers allow 1, so it can never climb into them.
const Head: React.FC<{ kicker?: string; pre?: string; hot?: string; post?: string; sub?: string; hold: number; size?: number; lines?: number }> =
({ kicker, pre = '', hot = '', post = '', sub, hold, size = 64, lines = 3 }) => {
  const { p, st } = use(); const frame = useCurrentFrame(); const { fps } = useVideoConfig(); const b = p.brand
  const o = interpolate(frame, [0, 8, hold - 10, hold], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const rule = clamp((frame - 8) / 14, 0, 1)
  // TEXT REVEAL per style: 'fade' (soft), 'wipe' (clip-path sweep), 'slam' (spring overshoot down)
  let y = 0, extra: React.CSSProperties = {}
  if (st.reveal === 'fade') { y = interpolate(frame, [0, 14], [16, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) }) }
  else if (st.reveal === 'wipe') { const w = interpolate(frame, [2, 16], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) }); extra = { clipPath: `inset(0 ${100 - w}% 0 0)` } }
  else { const sl = spring({ frame: frame - 1, fps, config: { damping: 11, stiffness: 200 } }); y = (1 - clamp(sl, 0, 1)) * -40 }
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 150 }}>
      <div style={{ opacity: o, transform: `translateY(${y}px)`, textAlign: 'center', maxWidth: 1500 }}>
        {kicker && <Fit max={20} min={14} lines={lines > 1 ? 2 : 1} style={{ fontFamily: st.mono, fontWeight: 600, letterSpacing: '0.28em', textTransform: 'uppercase', color: b.accent, marginBottom: 18 }}>{st.glitch ? '// ' : ''}{kicker}</Fit>}
        <Fit max={size} min={Math.round(size * 0.45)} lines={lines} style={{ fontFamily: st.display, fontWeight: st.heavy ? 700 : 500, color: b.cream, lineHeight: st.upper ? 1.0 : 1.14, paddingBottom: '0.04em', letterSpacing: '-0.01em', textTransform: st.upper ? 'uppercase' : 'none', textShadow: '0 4px 30px rgba(0,0,0,0.9)', ...extra }}>
          {preSp(pre, hot)}{hot && <span style={{ color: b.accentHi, textShadow: `0 0 22px ${b.accent}55` }}>{hot}</span>}{postSp(post, hot)}
        </Fit>
        {sub && <Fit max={size * 0.4} min={16} lines={2} style={{ fontFamily: st.body, fontWeight: 500, color: b.mute, marginTop: 14 }}>{sub}</Fit>}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 22 }}><div style={{ width: 130 * rule, height: 2, background: `linear-gradient(90deg, transparent, ${b.accent}, transparent)`, boxShadow: `0 0 12px ${b.accent}` }} /></div>
      </div>
    </AbsoluteFill>
  )
}

// ---- beat renderers ----
const MeetBeat: React.FC<{ hold: number; sub?: string }> = ({ hold, sub }) => {
  const { p } = use(); const frame = useCurrentFrame(); const { fps } = useVideoConfig(); const b = p.brand
  const pop = spring({ frame: frame - 2, fps, config: { damping: 14, stiffness: 140 } })
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 42%, ${b.bg2}, ${b.bg})` }}>
      <Bokeh color={b.accent} count={6} big /><Ambient />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 18 }}>
        <div style={{ transform: `scale(${0.72 + clamp(pop, 0, 1) * 0.28})` }}><Wordmark size={100} maxWidth={1760} /></div>
        {sub && <div style={{ width: '100%', maxWidth: 1500, opacity: clamp((frame - 14) / 8, 0, 1) }}><Fit max={34} min={18} lines={2} style={{ fontFamily: use().st.body, fontWeight: 500, color: b.mute, textAlign: 'center' }}>{sub}</Fit></div>}
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

const StatsBeat: React.FC<{ hold: number; stats: NonNullable<CommercialProps['beats'][number]['stats']>; kicker?: string; pre?: string; hot?: string }> =
({ hold, stats, kicker, pre, hot }) => {
  const { p, st } = use(); const frame = useCurrentFrame(); const b = p.brand
  // Figures sit in rows of up to 4 (split evenly, decided here — never by how
  // wide the frame is). A number never wraps and its box is always its FINAL
  // width (so nothing moves while it counts up); a label wraps past 520px.
  // Plain text only: if the whole group is wider than the frame or taller than
  // the room above the headline, ContentArea shrinks it as one, so the figures
  // stay the same size as each other. A normal row is untouched.
  const rows = rowsOf(stats.map((sc, i) => ({ sc, i })), 4)
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 30%, ${b.bg2}, ${b.bg})` }}>
      <Bokeh color={b.accent} count={5} big /><Ambient />
      <ContentArea hasHead={!!(kicker || pre || hot)}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40 }}>
          {rows.map((row, r) => (
            <div key={r} style={{ display: 'flex', gap: 76 }}>
              {row.map(({ sc, i }) => {
                const at = 6 + i * 8
                const pop = spring({ frame: frame - at, fps: FPS, config: { damping: 12, stiffness: 190 } })
                return (
                  <div key={i} style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', transform: `scale(${clamp(pop, 0, 1)})` }}>
                    <div style={{ fontFamily: st.display, fontWeight: 700, fontSize: 128, color: i % 2 ? (b.accent2 || b.accentHi) : b.accentHi, lineHeight: 1.15, paddingBottom: '0.04em', textShadow: `0 0 30px ${b.accent}44`, whiteSpace: 'nowrap' }}>
                      <Counter x={sc} startAt={at} dur={22} />
                    </div>
                    <div style={{ fontFamily: st.body, fontWeight: 600, fontSize: 24, color: b.mute, letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 6, maxWidth: 520, overflowWrap: 'anywhere' }}>{sc.label}</div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </ContentArea>
      <Head kicker={kicker} pre={pre} hot={hot} hold={hold} size={46} lines={1} />
      <SettleSweep color={b.accent} hold={hold} />
    </AbsoluteFill>
  )
}

const GridBeat: React.FC<{ hold: number; items: NonNullable<CommercialProps['beats'][number]['items']>; kicker?: string; hot?: string }> =
({ hold, items, kicker, hot }) => {
  const { p, st } = use(); const frame = useCurrentFrame(); const b = p.brand
  // Card width by column count. Wordy cards (well past the director's 4-word
  // titles / 8-word lines) get wider cards, so they wrap into fewer lines and
  // the group needs far less shrinking. Normal cards keep the 560 they always had.
  const cols = items.length > 6 ? 3 : items.length > 3 ? 2 : 1
  const wordy = items.some((it) => (it.title || '').length > 32 || (it.desc || '').length > 60)
  // (Widths leave >= 75px each side of the area, so a card flying in from the
  // side never pokes past it and nudges the group's shrink mid-entrance.)
  const cardW = cols === 3 ? 440 : cols === 2 ? (wordy ? 700 : 560) : (wordy ? 1100 : 560)
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 36%, ${b.bg2}, ${b.bg})` }}>
      <Bokeh color={b.accent} count={5} big /><Ambient />
      <Alive intensity={0.5}>
        {/* Cards are a fixed width (plain text: it wraps at spaces, and a word too
            long for the card breaks inside the card rather than poke out). A
            list too tall for the area above the headline shrinks as a group. */}
        <ContentArea hasHead={!!(kicker || hot)}>
          {/* 1 column up to 3 cards, 2 up to 6, 3 beyond that */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, auto)`, gap: 22 }}>
            {items.map((it, i) => {
              const at = sustained(i, items.length, hold, 8)
              const pop = spring({ frame: frame - at, fps: FPS, config: { damping: 12, stiffness: 190 } })
              const flies = st.cut === 'hard' || st.cut === 'snap'   // energetic styles: cards FLY in from alternating sides
              const card = (
                <div style={{ transform: flies ? undefined : `scale(${clamp(pop, 0, 1)})`, background: b.panel, border: `1px solid ${b.accent}44`, borderRadius: 16, padding: '24px 40px', display: 'flex', alignItems: 'center', gap: 20, width: cardW }}>
                  {it.icon && <div style={{ fontSize: 50, flex: '0 0 auto', maxWidth: 110, overflowWrap: 'anywhere' }}>{it.icon}</div>}
                  <div style={{ flex: '0 1 auto', minWidth: 0, overflowWrap: 'anywhere' }}>
                    <div style={{ fontFamily: st.display, fontWeight: 700, fontSize: 38, color: b.white }}>{it.title}</div>
                    {it.desc && <div style={{ fontFamily: st.body, fontWeight: 500, fontSize: 22, color: b.mute, marginTop: 4 }}>{it.desc}</div>}
                  </div>
                </div>
              )
              return <div key={i}>{flies ? <WeightyEntry at={at} from={i % 2 ? 'right' : 'left'} shadow={st.cut === 'hard'} distance={70}>{card}</WeightyEntry> : card}</div>
            })}
          </div>
        </ContentArea>
      </Alive>
      {(kicker || hot) && <Head kicker={kicker} hot={hot} hold={hold} size={44} lines={1} />}
      <SettleSweep color={b.accent} hold={hold} />
    </AbsoluteFill>
  )
}

// The words in a chat bubble type out letter by letter. A short message grows
// its bubble as it types (as always). A long one (more than a line) gets the
// full-width bubble from the start and is sized for its FINAL text, so the
// letters never change size mid-sentence; `lines` caps how tall each bubble
// can get, so the two bubbles always fit the frame together.
const Typed: React.FC<{ text: string; shown: number; cursor: boolean; lines: number; lh: number }> = ({ text, shown, cursor, lines, lh }) => {
  const { p, st } = use(); const b = p.brand
  const style: React.CSSProperties = { fontFamily: st.body, fontWeight: 500, color: b.cream, lineHeight: lh }
  const typed = <>{text.slice(0, shown)}{cursor ? '▋' : ''}</>
  return text.length > 50
    ? <Fit max={30} min={18} lines={lines} sizeFor={text + '▋'} style={style}>{typed}</Fit>
    : <Fit max={30} min={18} lines={lines} style={style}>{typed}</Fit>
}
const ChatBeat: React.FC<{ hold: number; chat: { q: string; a: string } }> = ({ hold, chat }) => {
  const { p, st } = use(); const frame = useCurrentFrame(); const b = p.brand
  const qS = Math.floor(clamp((frame - 6) / 20, 0, 1) * chat.q.length)
  const aS = Math.floor(clamp((frame - 34) / 40, 0, 1) * chat.a.length)
  const bubbleW = (t: string): React.CSSProperties => (t.length > 50 ? { width: 880 } : { maxWidth: 880 })
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 40%, ${b.bg2}, ${b.bg})` }}>
      <Ambient />
      {/* center the conversation in a fixed-height band (padding top/bottom keeps it
          clear of the top corner logo + never lets a tall two-bubble column ride
          off the top of the frame — the chat-beat overflow bug). */}
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 18, padding: '150px 90px 90px' }}>
        <div style={{ fontFamily: st.mono, fontSize: 19, letterSpacing: '0.24em', textTransform: 'uppercase', color: b.accent, marginBottom: 8 }}>{'// Ask anything'}</div>
        {/* question bubble flies in from the right */}
        <div style={{ alignSelf: 'flex-end', maxWidth: '78%' }}><Enter at={2} from="right">
          <div style={{ background: b.panel, border: `1px solid ${b.mute}44`, borderRadius: 14, padding: '20px 26px', ...bubbleW(chat.q) }}>
            <Typed text={chat.q} shown={qS} cursor={qS < chat.q.length && frame < 30} lines={4} lh={1.3} />
          </div>
        </Enter></div>
        {/* answer bubble flies in from the left when it's time to reply */}
        {frame > 32 && (
          <div style={{ alignSelf: 'flex-start', maxWidth: '78%' }}><Enter at={34} from="left">
            <div style={{ background: b.panel, border: `1px solid ${b.accent}44`, borderRadius: 14, padding: '20px 26px', ...bubbleW(chat.a), boxShadow: `0 0 26px ${b.accent}18` }}>
              <Typed text={chat.a} shown={aS} cursor={aS < chat.a.length} lines={7} lh={1.35} />
            </div>
          </Enter></div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

const QuoteBeat: React.FC<{ hold: number; pre?: string; hot?: string; post?: string; sub?: string; size?: number }> = ({ hold, pre, hot, post, size = 78 }) => {
  const { p, st } = use(); const b = p.brand; const frame = useCurrentFrame()
  const hero = heroTreatment(st)
  // aggressive/glitch styles: the hot phrase gets a dramatic SHATTER or PHYSICS
  // entrance — a genuinely different motion than the fade/wipe styles.
  if (hero !== 'none' && hot) {
    const line: React.CSSProperties = { fontFamily: st.display, fontWeight: st.heavy ? 700 : 600, color: b.cream, textAlign: 'center', textTransform: st.upper ? 'uppercase' : 'none' }
    const shatterAt = Math.max(10, hold - 34)
    // The hot word is sized from its plain text (`sizeFor`), never from the
    // flying letters, so its size can't change mid-animation. A shattering
    // word never wraps (one line); a dropping word may take two.
    const hotWord: React.CSSProperties = { fontFamily: st.display, fontWeight: 800, textTransform: 'uppercase', lineHeight: 1.1, textAlign: 'center' }
    return (
      <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 42%, ${b.bg2}, ${b.bg})` }}>
        <Bokeh color={b.accent} count={5} big /><Ambient />
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', padding: '0 140px', gap: 10 }}>
          {pre && <Fit max={size * 0.72} min={Math.round(size * 0.35)} lines={2} style={line}>{pre.trim()}</Fit>}
          {/* once it shatters the letters fly off the frame ON PURPOSE (the exit) */}
          <div style={{ width: '100%' }} data-overflow-ok={hero === 'shatter' && frame >= shatterAt ? 'the hot word shatters apart as the beat exits' : undefined}>
            {hero === 'shatter'
              ? <Fit max={size * 1.05} min={Math.round(size * 0.4)} lines={1} sizeFor={hot} style={hotWord}><ShatterWord text={hot} color={b.accentHi} size="1em" center shatterAt={shatterAt} font={st.display} /></Fit>
              : <Fit max={size * 1.05} min={Math.round(size * 0.4)} lines={2} sizeFor={hot} style={hotWord}><PhysicsWord text={hot} color={b.accentHi} size="1em" at={2} font={st.display} /></Fit>}
          </div>
          {post && <Fit max={size * 0.72} min={Math.round(size * 0.35)} lines={2} style={line}>{post.trim()}</Fit>}
        </AbsoluteFill>
      </AbsoluteFill>
    )
  }
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 42%, ${b.bg2}, ${b.bg})` }}>
      <Bokeh color={b.accent} count={5} big /><Ambient />
      <Alive intensity={0.5}><AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 140px' }}>
        <Fit max={size} min={Math.round(size * 0.4)} lines={4} style={{ fontFamily: st.display, fontWeight: st.heavy ? 700 : 600, color: b.cream, textAlign: 'center', lineHeight: 1.12, paddingBottom: '0.04em', textTransform: st.upper ? 'uppercase' : 'none' }}>
          {preSp(pre, hot)}{hot && <span style={{ color: b.accentHi }}>{hot}</span>}{postSp(post, hot)}
        </Fit>
      </AbsoluteFill></Alive>
    </AbsoluteFill>
  )
}

// SplitBeat — a two-sided comparison. THREE layout variants so two videos don't
// share the same "two centered halves" skeleton:
//   0 = classic LEFT | RIGHT (vertical divider)
//   1 = stacked TOP / BOTTOM (horizontal divider)
//   2 = diagonal OFFSET (left label upper-left, right label lower-right)
// All share the same overflow-safe text sizing (the "ANOTHER MID NIGHT" fix).
const SplitBeat: React.FC<{ hold: number; variant?: number; split: NonNullable<CommercialProps['beats'][number]['split']> }> = ({ hold, variant = 0, split }) => {
  const { p, st } = use(); const frame = useCurrentFrame(); const b = p.brand
  const aIn = interpolate(frame, [4, 18], [-100, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  const bIn = interpolate(frame, [10, 24], [100, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  const bothO = split.both ? interpolate(frame, [hold - 40, hold - 28], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 0
  const longest = (s: string) => (s || '').split(/\s+/).reduce((m, w) => Math.max(m, w.length), 0)
  // a comparison cell. The label's starting size still steps down for long
  // words (the look it has always had); <Fit> then guarantees it: it shrinks
  // until the label fits its half in at most `labelLines` lines, and the small
  // line above it in two. (Was: word-break mid-word + no height limit, so a
  // long label ran off the top of its half in the stacked layout.)
  const Cell = ({ label, sub, color, tx, ty, align = 'center', labelLines = 3 }: any) => {
    const maxWord = longest(label)
    const fs = maxWord >= 9 ? 62 : maxWord >= 7 ? 76 : 90
    return (
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: align === 'center' ? 'center' : align === 'left' ? 'flex-start' : 'flex-end', transform: `translate(${tx || 0}px, ${ty || 0}px)`, gap: 8, boxSizing: 'border-box' }}>
        <Fit max={24} min={14} lines={2} style={{ fontFamily: st.body, fontWeight: 800, letterSpacing: '0.3em', color, textTransform: 'uppercase', textAlign: align }}>{sub}</Fit>
        <Fit max={fs} min={30} lines={labelLines} style={{ fontFamily: st.display, fontWeight: 700, lineHeight: 1.02, color: b.white, textTransform: 'uppercase', textShadow: `0 0 34px ${color}55`, textAlign: align }}>{label}</Fit>
      </div>
    )
  }
  // the unifying line that fades in at the end (`width` = its room).
  const Both = ({ size, width, lines }: { size: number; width: number; lines: number }) => (
    <div style={{ width: '100%', maxWidth: width, opacity: bothO }}>
      <Fit max={size} min={28} lines={lines} style={{ fontFamily: st.display, fontWeight: 700, color: b.white, textTransform: 'uppercase', textAlign: 'center' }}>{split.both}</Fit>
    </div>
  )
  const bg = `linear-gradient(135deg, ${b.bg}, ${b.bg2})`
  const cA = b.accentHi, cB = b.accent2 || b.accentHi

  if (variant === 1) {
    // TOP / BOTTOM stacked with a horizontal divider
    return (
      <AbsoluteFill style={{ background: bg, flexDirection: 'column' }}>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', padding: '0 8% 30px' }}><Cell label={split.leftLabel} sub={split.leftSub} color={cA} ty={aIn} labelLines={2} /></div>
        <div style={{ height: 3, width: '54%', alignSelf: 'center', background: `linear-gradient(90deg, transparent, ${b.accent}, transparent)`, boxShadow: `0 0 20px ${b.accent}` }} />
        <div style={{ flex: 1, minHeight: 0, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '30px 8% 0' }}><Cell label={split.rightLabel} sub={split.rightSub} color={cB} ty={bIn} labelLines={2} /></div>
        {split.both && <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 60 }}><Both size={54} width={1500} lines={1} /></AbsoluteFill>}
      </AbsoluteFill>
    )
  }
  if (variant === 2) {
    // DIAGONAL OFFSET — upper-left vs lower-right, with a diagonal rule.
    // NOTE: the upper-left cell starts at top:24% (NOT 16%) so it clears the
    // persistent corner LogoBug (top:46 left:58, ~130px tall) — otherwise the
    // sublabel runs UNDER the logo (the jordyn.app collision bug).
    return (
      <AbsoluteFill style={{ background: bg, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '24%', left: '7%', width: 780 }}><Cell label={split.leftLabel} sub={split.leftSub} color={cA} tx={aIn} align="left" labelLines={2} /></div>
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: 900, height: 3, background: `linear-gradient(90deg, transparent, ${b.accent}, transparent)`, transform: 'translate(-50%,-50%) rotate(24deg)', boxShadow: `0 0 20px ${b.accent}` }} />
        <div style={{ position: 'absolute', bottom: '18%', right: '7%', width: 780 }}><Cell label={split.rightLabel} sub={split.rightSub} color={cB} tx={bIn} align="right" labelLines={2} /></div>
        {split.both && <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}><Both size={54} width={1500} lines={1} /></AbsoluteFill>}
      </AbsoluteFill>
    )
  }
  // variant 0 — classic LEFT | RIGHT
  return (
    <AbsoluteFill style={{ background: bg }}>
      <AbsoluteFill style={{ flexDirection: 'row' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '0 5%' }}><Cell label={split.leftLabel} sub={split.leftSub} color={cA} tx={aIn} /></div>
        <div style={{ width: 3, height: '54%', alignSelf: 'center', background: `linear-gradient(180deg, transparent, ${b.accent}, transparent)`, boxShadow: `0 0 20px ${b.accent}` }} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '0 5%' }}><Cell label={split.rightLabel} sub={split.rightSub} color={cB} tx={bIn} /></div>
      </AbsoluteFill>
      {split.both && <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 90 }}><Both size={60} width={1500} lines={2} /></AbsoluteFill>}
    </AbsoluteFill>
  )
}

// CTABeat — THREE layout variants so the closer isn't always logo-over-button-
// over-url stacked-center:
//   0 = classic CENTERED stack
//   1 = LEFT-anchored editorial (logo + headline hard-left, button below)
//   2 = SPLIT panel (accent panel holds the CTA on one side, brand on the other)
const CTABeat: React.FC<{ hold: number; variant?: number; cta: { headline: string; button: string; url: string } }> = ({ hold, variant = 0, cta }) => {
  const { p, st } = use(); const frame = useCurrentFrame(); const { fps } = useVideoConfig(); const b = p.brand
  const up = spring({ frame: frame - 2, fps, config: { damping: 15, stiffness: 130 } })
  const line = interpolate(frame, [22, 36], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const btn = spring({ frame: frame - 40, fps, config: { damping: 12, stiffness: 180 } })
  const url = interpolate(frame, [58, 70], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const pulse = 1 + Math.sin(frame * 0.12) * 0.02
  const upper = st.upper ? 'uppercase' : 'none'
  // The button label, the web address / phone line and the headline each shrink
  // to fit their room (was: the button never wrapped and the address had no
  // limit, so a long label or URL ran past the panel and off the frame).
  const buttonBox: React.CSSProperties = { background: `linear-gradient(180deg, ${b.accentHi}, ${b.accent})`, color: b.bg, fontFamily: st.display, fontWeight: 700, fontSize: 32, padding: '20px 54px', borderRadius: 12, boxShadow: `0 0 30px ${b.accent}66`, textTransform: upper }
  const ButtonText = () => <Fit max={32} min={18} lines={2} style={{ textAlign: 'center' }}>{cta.button}</Fit>
  const Url = ({ align = 'left' }: { align?: 'left' | 'center' }) => (
    <Fit max={26} min={16} lines={2} style={{ fontFamily: st.mono, fontWeight: 500, color: b.mute, letterSpacing: '0.08em', textAlign: align }}>{cta.url}</Fit>
  )
  const Button = () => (
    <div style={{ opacity: clamp(btn, 0, 1), transform: `scale(${(0.7 + clamp(btn, 0, 1) * 0.3) * pulse})`, transformOrigin: 'left center', display: 'inline-block', maxWidth: '100%' }}>
      <div style={{ ...buttonBox, maxWidth: 1000, boxSizing: 'border-box' }}><ButtonText /></div>
    </div>
  )

  if (variant === 1) {
    // LEFT-anchored editorial
    return (
      <AbsoluteFill style={{ background: `radial-gradient(130% 120% at 30% 40%, ${b.bg2}, ${b.bg})` }}>
        <Bokeh color={b.accent} count={5} big /><Ambient />
        <div style={{ position: 'absolute', left: 130, top: '50%', transform: 'translateY(-50%)', maxWidth: 1200 }}>
          <div style={{ transform: `scale(${0.8 + clamp(up, 0, 1) * 0.2})`, transformOrigin: 'left center' }}><Wordmark size={92} maxWidth={1200} /></div>
          <div style={{ width: 300 * line, height: 3, background: `linear-gradient(90deg, ${b.accent}, transparent)`, margin: '26px 0', boxShadow: `0 0 14px ${b.accent}` }} />
          <Fit max={76} min={34} lines={3} style={{ fontFamily: st.display, fontWeight: st.heavy ? 700 : 600, color: b.cream, opacity: clamp(line, 0, 1), textTransform: upper, lineHeight: 1.02 }}>{cta.headline}</Fit>
          <div style={{ marginTop: 34 }}><Button /></div>
          <div style={{ marginTop: 26, opacity: url }}><Url /></div>
        </div>
      </AbsoluteFill>
    )
  }
  if (variant === 2) {
    // SPLIT panel — brand left on bg, CTA on an accent panel right
    return (
      <AbsoluteFill style={{ background: b.bg, flexDirection: 'row' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ transform: `scale(${0.8 + clamp(up, 0, 1) * 0.2})` }}><Wordmark size={110} maxWidth={1000} /></div>
        </div>
        <div style={{ width: 760, background: `linear-gradient(160deg, ${b.bg2}, ${b.bg})`, borderLeft: `4px solid ${b.accent}`, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 70px', boxSizing: 'border-box' }}>
          <Fit max={60} min={28} lines={4} style={{ fontFamily: st.display, fontWeight: st.heavy ? 700 : 600, color: b.cream, opacity: clamp(line, 0, 1), textTransform: upper, lineHeight: 1.05 }}>{cta.headline}</Fit>
          <div style={{ marginTop: 34 }}><Button /></div>
          <div style={{ marginTop: 26, opacity: url }}><Url /></div>
        </div>
      </AbsoluteFill>
    )
  }
  // variant 0 — classic centered stack
  return (
    <AbsoluteFill style={{ background: `radial-gradient(130% 120% at 50% 42%, ${b.bg2}, ${b.bg})` }}>
      <Bokeh color={b.accent} count={6} big /><Ambient />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
        <div style={{ transform: `scale(${0.74 + clamp(up, 0, 1) * 0.26})` }}><Wordmark size={104} maxWidth={1760} /></div>
        <div style={{ width: 380 * line, height: 2, background: `linear-gradient(90deg, transparent, ${b.accent}, transparent)`, marginTop: 28, boxShadow: `0 0 14px ${b.accent}` }} />
        <div style={{ width: '100%', maxWidth: 1500, marginTop: 26, opacity: clamp(line, 0, 1) }}>
          <Fit max={52} min={26} lines={2} style={{ fontFamily: st.display, fontWeight: st.heavy ? 700 : 600, color: b.cream, textAlign: 'center', textTransform: upper }}>{cta.headline}</Fit>
        </div>
        <div style={{ marginTop: 34, opacity: clamp(btn, 0, 1), transform: `scale(${(0.7 + clamp(btn, 0, 1) * 0.3) * pulse})`, maxWidth: 1000 }}>
          <div style={buttonBox}><ButtonText /></div>
        </div>
        <div style={{ width: '100%', maxWidth: 1500, marginTop: 24, opacity: url }}><Url align="center" /></div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

// BIG NUMBER — one GIANT animated stat, full-frame. High-impact single-fact beat.
const BigNumberBeat: React.FC<{ hold: number; big: NonNullable<CommercialProps['beats'][number]['big']>; kicker?: string; sub?: string }> = ({ hold, big, kicker, sub }) => {
  const { p, st } = use(); const b = p.brand; const frame = useCurrentFrame()
  const rule = clamp((frame - 12) / 14, 0, 1)
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 45%, ${b.bg2}, ${b.bg})` }}>
      <Bokeh color={b.accent} count={5} big /><Ambient />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
        {/* the giant number shrinks (sized by its FINAL value) to fit the frame
            width; the lines around it wrap, then shrink */}
        {kicker && <div style={{ width: '100%', maxWidth: 1500, marginBottom: 10, opacity: clamp((frame - 4) / 8, 0, 1) }}><Fit max={22} min={14} lines={2} style={{ fontFamily: st.mono, fontWeight: 600, letterSpacing: '0.26em', textTransform: 'uppercase', color: b.accent, textAlign: 'center' }}>{st.glitch ? '// ' : ''}{kicker}</Fit></div>}
        <div style={{ width: '100%', maxWidth: 1760 }}>
          <Fit max={300} min={90} lines={1} style={{ fontFamily: st.display, fontWeight: 800, color: b.accentHi, lineHeight: 1.0, paddingBottom: '0.03em', textShadow: `0 0 60px ${b.accent}55`, textAlign: 'center' }}>
            <Counter x={big} startAt={4} dur={26} />
          </Fit>
        </div>
        <div style={{ width: '100%', maxWidth: 1600, marginTop: 4 }}><Fit max={40} min={20} lines={2} style={{ fontFamily: st.body, fontWeight: 700, color: b.cream, letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: 'center' }}>{big.label}</Fit></div>
        {sub && <div style={{ width: '100%', maxWidth: 1500, marginTop: 14 }}><Fit max={26} min={16} lines={2} style={{ fontFamily: st.body, fontWeight: 500, color: b.mute, textAlign: 'center' }}>{sub}</Fit></div>}
        <div style={{ width: 160 * rule, height: 3, background: `linear-gradient(90deg, transparent, ${b.accent}, transparent)`, boxShadow: `0 0 14px ${b.accent}`, marginTop: 24 }} />
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

// STEPS — a "how it works" horizontal timeline: numbered steps that light up in
// sequence, connected by a progress line. Great for process/onboarding beats.
const StepsBeat: React.FC<{ hold: number; steps: NonNullable<CommercialProps['beats'][number]['steps']>; kicker?: string; hot?: string }> = ({ hold, steps, kicker, hot }) => {
  const { p, st } = use(); const b = p.brand; const frame = useCurrentFrame()
  const n = Math.min(steps.length, 4)
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 36%, ${b.bg2}, ${b.bg})` }}>
      <Bokeh color={b.accent} count={4} big /><Ambient />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, position: 'relative' }}>
          {steps.slice(0, 4).map((sp, i) => {
            const at = 8 + i * 14
            const on = clamp((frame - at) / 10, 0, 1)
            const lineW = i < n - 1 ? clamp((frame - at - 6) / 12, 0, 1) : 0
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ width: 300, textAlign: 'center', opacity: on, transform: `translateY(${(1 - on) * 20}px)` }}>
                  <div style={{ width: 74, height: 74, borderRadius: 40, margin: '0 auto 16px', background: `linear-gradient(135deg, ${b.accentHi}, ${b.accent})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: st.display, fontWeight: 800, fontSize: 36, color: b.bg, boxShadow: `0 0 26px ${b.accent}55` }}>{i + 1}</div>
                  {/* each step's column is a fixed 300px: its title and line shrink inside it */}
                  <Fit max={30} min={16} lines={2} style={{ fontFamily: st.display, fontWeight: 700, color: b.white }}>{sp.title}</Fit>
                  {sp.desc && <div style={{ marginTop: 6, padding: '0 20px' }}><Fit max={20} min={14} lines={3} style={{ fontFamily: st.body, fontWeight: 500, color: b.mute }}>{sp.desc}</Fit></div>}
                </div>
                {i < n - 1 && <div style={{ width: 70, height: 3, marginTop: -60, background: b.mute + '33', position: 'relative' }}><div style={{ position: 'absolute', inset: 0, width: `${lineW * 100}%`, background: b.accent, boxShadow: `0 0 10px ${b.accent}` }} /></div>}
              </div>
            )
          })}
        </div>
      </AbsoluteFill>
      {(kicker || hot) && <Head kicker={kicker} hot={hot} hold={hold} size={44} lines={1} />}
      <SettleSweep color={b.accent} hold={hold} />
    </AbsoluteFill>
  )
}

const renderBeat = (be: CommercialProps['beats'][number], hold: number) => {
  switch (be.kind) {
    case 'shot': return <><Shot src={be.img || 'chaos.png'} dur={hold} dim={be.dim} /><Head kicker={be.kicker} pre={be.pre} hot={be.hot} post={be.post} sub={be.sub} hold={hold} size={be.size} /></>
    case 'meet': return <MeetBeat hold={hold} sub={be.sub} />
    case 'stats': return <StatsBeat hold={hold} stats={be.stats || []} kicker={be.kicker} pre={be.pre} hot={be.hot} />
    case 'grid': return <GridBeat hold={hold} items={be.items || []} kicker={be.kicker} hot={be.hot} />
    case 'chat': return <ChatBeat hold={hold} chat={be.chat || { q: '', a: '' }} />
    case 'quote': return <QuoteBeat hold={hold} pre={be.pre} hot={be.hot} post={be.post} sub={be.sub} size={be.size} />
    case 'split': return <SplitBeat hold={hold} variant={be.variant || 0} split={be.split || { leftLabel: '', leftSub: '', rightLabel: '', rightSub: '' }} />
    case 'brand': return <MeetBeat hold={hold} sub={be.sub} />
    case 'showcase': return <ShowcaseBeat hold={hold} src={be.shot} kicker={be.kicker} hot={be.hot} sub={be.sub} />
    case 'bignumber': return be.big ? <BigNumberBeat hold={hold} big={be.big} kicker={be.kicker} sub={be.sub} /> : <QuoteBeat hold={hold} pre={be.pre} hot={be.hot} sub={be.sub} />
    case 'steps': return (be.steps && be.steps.length) ? <StepsBeat hold={hold} steps={be.steps} kicker={be.kicker} hot={be.hot} /> : <GridBeat hold={hold} items={be.items || []} kicker={be.kicker} hot={be.hot} />
    case 'cta': return <CTABeat hold={hold} variant={be.variant || 0} cta={be.cta || { headline: '', button: '', url: '' }} />
  }
}

export const TemplateCommercial: React.FC<CommercialProps> = (p) => {
  setAssetBase(p.assetBase)
  const st = STYLES[p.styleId as StyleId]
  const b = p.brand
  const INTRO = p.introFrames
  const starts: number[] = []; { let t = INTRO; for (const be of p.beats) { starts.push(t); t += s(be.dur) } }
  const total = commercialDuration(p)
  const durs = p.beats.map((be) => s(be.dur))
  const voWin = p.beats.map((be, i) => be.vo ? { start: starts[i], end: starts[i] + durs[i] } : null).filter(Boolean) as VoWindow[]
  const musicDuck = makeMusicDuck(voWin, total, { loud: p.duck.loud, duck: p.duck.duck, ramp: 18, fadeInEnd: 14, fadeOutStart: total - 20, fadeOutEnd: total - 4 })
  return (
    <Ctx.Provider value={{ p, st }}>
      <AbsoluteFill style={{ background: b.bg }}>
        <Sequence from={0} durationInFrames={INTRO + 2}>
          <Intro style={st.intro} dur={INTRO} tokens={{ bg: b.bg, bg2: b.bg2, accent: b.accent, accentHi: b.accentHi }} render={<Wordmark size={120} />} />
        </Sequence>
        {p.beats.map((be, i) => (
          <Sequence key={i} from={starts[i]} durationInFrames={durs[i] + 6}>
            {renderBeat(be, durs[i])}
            {/* the corner mark stays a corner mark: a tall logo is held to 150px, a long name to 560px */}
            {p.bug && i > 0 && i < p.beats.length - 1 && (p.logo ? <LogoBug src={`${p.assetDir}/${p.logo}`} width={150} maxHeight={150} /> : <LogoBug name={(p.wordmark?.pre || '') + (p.wordmark?.post || '')} color={b.white} fontFamily={st.display} maxWidth={560} />)}
            {i > 0 && <StreakWipe color={b.accent} dir={i % 2 ? 1 : -1} dur={12} />}
          </Sequence>
        ))}
        <MusicBed src={`${p.assetDir}/${p.music.file}`} musicFrames={p.music.frames} volume={musicDuck} />
        {p.beats.map((be, i) => be.vo ? (
          <Sequence key={'vo' + i} from={starts[i]}><Audio src={staticFile(`${p.assetDir}/${be.vo}.mp3`)} volume={1.0} /></Sequence>
        ) : null)}
        {/* SFX LAYER — the sound design that makes it feel produced, not flat. A
            whoosh on each beat transition + an impact on the brand/hero reveal +
            a riser into the CTA. Character/volume driven by the style's sfx
            profile. (This is what the director's output was missing entirely.) */}
        {st.sfx !== 'none' && <>
          {(() => {
            const V = st.sfx === 'aggressive' ? 1 : st.sfx === 'punchy' ? 0.72 : 0.42   // volume scale
            const whoosh = st.sfx === 'soft' ? 'sfx/whoosh-short.wav' : 'sfx/whoosh.wav'
            const impact = st.sfx === 'aggressive' ? 'sfx/impact.wav' : st.sfx === 'soft' ? 'sfx/impact-soft.wav' : 'sfx/impact.wav'
            const ctaIdx = p.beats.findIndex((x) => x.kind === 'cta')
            const brandIdx = p.beats.findIndex((x) => x.kind === 'meet' || x.kind === 'brand')
            return <>
              {/* whoosh on every transition into a beat (skip the first) */}
              {starts.slice(1).map((stt, i) => (
                <Sequence key={'sfxw' + i} from={stt - 4} durationInFrames={18}><Audio src={staticFile(whoosh)} volume={0.28 * V} /></Sequence>
              ))}
              {/* impact on the brand reveal */}
              {brandIdx >= 0 && <Sequence from={starts[brandIdx]} durationInFrames={30}><Audio src={staticFile(impact)} volume={0.5 * V} /></Sequence>}
              {/* riser building into the CTA */}
              {ctaIdx >= 0 && <Sequence from={Math.max(0, starts[ctaIdx] - 40)} durationInFrames={44}><Audio src={staticFile(st.sfx === 'soft' ? 'sfx/riser-elegant.mp3' : 'sfx/riser.wav')} volume={0.34 * V} /></Sequence>}
              {/* impact punctuating the CTA landing */}
              {ctaIdx >= 0 && <Sequence from={starts[ctaIdx]} durationInFrames={30}><Audio src={staticFile(impact)} volume={0.55 * V} /></Sequence>}
            </>
          })()}
        </>}
      </AbsoluteFill>
    </Ctx.Provider>
  )
}
