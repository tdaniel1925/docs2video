import React from 'react'
import { AbsoluteFill, Img, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion'
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

const Wordmark: React.FC<{ size?: number }> = ({ size = 90 }) => {
  const { p, st } = use(); const b = p.brand
  if (p.logo) return <Img src={staticFile(`${p.assetDir}/${p.logo}`)} style={{ width: size * 4.5, height: 'auto', display: 'block', filter: `drop-shadow(0 0 20px ${b.accent}44)` }} />
  const wm = p.wordmark || { pre: 'Brand', post: '' }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
      {p.logoLetter && <div style={{ width: size, height: size, borderRadius: size * 0.19, background: `linear-gradient(135deg, ${b.accentHi}, ${b.accent})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: st.display, fontWeight: 700, fontSize: size * 0.6, color: b.bg }}>{p.logoLetter}</div>}
      <div style={{ fontFamily: st.display, fontWeight: st.heavy ? 700 : 500, fontSize: size * 0.8, letterSpacing: '-0.01em', color: b.white, textTransform: st.upper ? 'uppercase' : 'none' }}>{wm.pre}<span style={{ color: b.accent }}>{wm.post}</span></div>
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
          {src ? <Img src={staticFile(`${p.assetDir}/${src}`)} style={{ width: '100%', display: 'block' }} /> : <div style={{ width: '100%', height: 620, background: b.panel }} />}
        </div>
      </AbsoluteFill>
      {(kicker || hot) && <Head kicker={kicker} hot={hot} sub={sub} hold={hold} size={44} />}
      <SettleSweep color={b.accent} hold={hold} />
    </AbsoluteFill>
  )
}

const Head: React.FC<{ kicker?: string; pre?: string; hot?: string; post?: string; sub?: string; hold: number; size?: number }> =
({ kicker, pre = '', hot = '', post = '', sub, hold, size = 64 }) => {
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
        {kicker && <div style={{ fontFamily: st.mono, fontWeight: 600, fontSize: 20, letterSpacing: '0.28em', textTransform: 'uppercase', color: b.accent, marginBottom: 18 }}>{st.glitch ? '// ' : ''}{kicker}</div>}
        <div style={{ fontFamily: st.display, fontWeight: st.heavy ? 700 : 500, fontSize: size, color: b.cream, lineHeight: st.upper ? 1.0 : 1.14, paddingBottom: '0.04em', letterSpacing: '-0.01em', textTransform: st.upper ? 'uppercase' : 'none', textShadow: '0 4px 30px rgba(0,0,0,0.9)', ...extra }}>
          {preSp(pre, hot)}{hot && <span style={{ color: b.accentHi, textShadow: `0 0 22px ${b.accent}55` }}>{hot}</span>}{postSp(post, hot)}
        </div>
        {sub && <div style={{ fontFamily: st.body, fontWeight: 500, fontSize: size * 0.4, color: b.mute, marginTop: 14 }}>{sub}</div>}
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
        <div style={{ transform: `scale(${0.72 + clamp(pop, 0, 1) * 0.28})` }}><Wordmark size={100} /></div>
        {sub && <div style={{ fontFamily: use().st.body, fontWeight: 500, fontSize: 34, color: b.mute, opacity: clamp((frame - 14) / 8, 0, 1) }}>{sub}</div>}
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

const StatsBeat: React.FC<{ hold: number; stats: NonNullable<CommercialProps['beats'][number]['stats']>; kicker?: string; pre?: string; hot?: string }> =
({ hold, stats, kicker, pre, hot }) => {
  const { p, st } = use(); const frame = useCurrentFrame(); const b = p.brand
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 30%, ${b.bg2}, ${b.bg})` }}>
      <Bokeh color={b.accent} count={5} big /><Ambient />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 76 }}>
          {stats.map((sc, i) => {
            const at = 6 + i * 8
            const pop = spring({ frame: frame - at, fps: FPS, config: { damping: 12, stiffness: 190 } })
            return (
              <div key={i} style={{ textAlign: 'center', transform: `scale(${clamp(pop, 0, 1)})` }}>
                <div style={{ fontFamily: st.display, fontWeight: 700, fontSize: 128, color: i % 2 ? (b.accent2 || b.accentHi) : b.accentHi, lineHeight: 1.15, paddingBottom: '0.04em', textShadow: `0 0 30px ${b.accent}44` }}>
                  <CountUp to={sc.value} prefix={sc.prefix || ''} suffix={sc.suffix || ''} decimals={sc.decimals} startAt={at} dur={22} />
                </div>
                <div style={{ fontFamily: st.body, fontWeight: 600, fontSize: 24, color: b.mute, letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 6 }}>{sc.label}</div>
              </div>
            )
          })}
        </div>
      </AbsoluteFill>
      <Head kicker={kicker} pre={pre} hot={hot} hold={hold} size={46} />
      <SettleSweep color={b.accent} hold={hold} />
    </AbsoluteFill>
  )
}

const GridBeat: React.FC<{ hold: number; items: NonNullable<CommercialProps['beats'][number]['items']>; kicker?: string; hot?: string }> =
({ hold, items, kicker, hot }) => {
  const { p, st } = use(); const frame = useCurrentFrame(); const b = p.brand
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 36%, ${b.bg2}, ${b.bg})` }}>
      <Bokeh color={b.accent} count={5} big /><Ambient />
      <Alive intensity={0.5}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ display: 'grid', gridTemplateColumns: items.length > 3 ? '1fr 1fr' : '1fr', gap: 22 }}>
            {items.map((it, i) => {
              const at = sustained(i, items.length, hold, 8)
              const pop = spring({ frame: frame - at, fps: FPS, config: { damping: 12, stiffness: 190 } })
              const flies = st.cut === 'hard' || st.cut === 'snap'   // energetic styles: cards FLY in from alternating sides
              const card = (
                <div style={{ transform: flies ? undefined : `scale(${clamp(pop, 0, 1)})`, background: b.panel, border: `1px solid ${b.accent}44`, borderRadius: 16, padding: '24px 40px', display: 'flex', alignItems: 'center', gap: 20, width: 560 }}>
                  {it.icon && <div style={{ fontSize: 50 }}>{it.icon}</div>}
                  <div>
                    <div style={{ fontFamily: st.display, fontWeight: 700, fontSize: 38, color: b.white }}>{it.title}</div>
                    {it.desc && <div style={{ fontFamily: st.body, fontWeight: 500, fontSize: 22, color: b.mute, marginTop: 4 }}>{it.desc}</div>}
                  </div>
                </div>
              )
              return <div key={i}>{flies ? <WeightyEntry at={at} from={i % 2 ? 'right' : 'left'} shadow={st.cut === 'hard'} distance={70}>{card}</WeightyEntry> : card}</div>
            })}
          </div>
        </AbsoluteFill>
      </Alive>
      {(kicker || hot) && <Head kicker={kicker} hot={hot} hold={hold} size={44} />}
      <SettleSweep color={b.accent} hold={hold} />
    </AbsoluteFill>
  )
}

const ChatBeat: React.FC<{ hold: number; chat: { q: string; a: string } }> = ({ hold, chat }) => {
  const { p, st } = use(); const frame = useCurrentFrame(); const b = p.brand
  const qS = Math.floor(clamp((frame - 6) / 20, 0, 1) * chat.q.length)
  const aS = Math.floor(clamp((frame - 34) / 40, 0, 1) * chat.a.length)
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 40%, ${b.bg2}, ${b.bg})` }}>
      <Ambient />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontFamily: st.mono, fontSize: 19, letterSpacing: '0.24em', textTransform: 'uppercase', color: b.accent, marginBottom: 12 }}>{'// Ask anything'}</div>
        {/* question bubble flies in from the right */}
        <div style={{ alignSelf: 'flex-end', marginRight: '18%' }}><Enter at={2} from="right">
          <div style={{ background: b.panel, border: `1px solid ${b.mute}44`, borderRadius: 14, padding: 24, width: 1000 }}>
            <div style={{ fontFamily: st.body, fontWeight: 500, fontSize: 30, color: b.cream }}>{chat.q.slice(0, qS)}{qS < chat.q.length && frame < 30 ? '▋' : ''}</div>
          </div>
        </Enter></div>
        {/* answer bubble flies in from the left when it's time to reply */}
        {frame > 32 && (
          <div style={{ alignSelf: 'flex-start', marginLeft: '18%' }}><Enter at={34} from="left">
            <div style={{ background: b.panel, border: `1px solid ${b.accent}44`, borderRadius: 14, padding: 24, width: 1000, boxShadow: `0 0 26px ${b.accent}18` }}>
              <div style={{ fontFamily: st.body, fontWeight: 500, fontSize: 30, color: b.cream, lineHeight: 1.35 }}>{chat.a.slice(0, aS)}{aS < chat.a.length ? '▋' : ''}</div>
            </div>
          </Enter></div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

const QuoteBeat: React.FC<{ hold: number; pre?: string; hot?: string; post?: string; sub?: string; size?: number }> = ({ hold, pre, hot, post, sub, size = 78 }) => {
  const { p, st } = use(); const b = p.brand
  const hero = heroTreatment(st)
  // aggressive/glitch styles: the hot phrase gets a dramatic SHATTER or PHYSICS
  // entrance — a genuinely different motion than the fade/wipe styles.
  if (hero !== 'none' && hot) {
    return (
      <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 42%, ${b.bg2}, ${b.bg})` }}>
        <Bokeh color={b.accent} count={5} big /><Ambient />
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', padding: '0 140px', gap: 10 }}>
          {pre && <div style={{ fontFamily: st.display, fontWeight: st.heavy ? 700 : 600, fontSize: size * 0.72, color: b.cream, textAlign: 'center', textTransform: st.upper ? 'uppercase' : 'none' }}>{pre.trim()}</div>}
          {hero === 'shatter'
            ? <ShatterWord text={hot} color={b.accentHi} size={size * 1.05} shatterAt={Math.max(10, hold - 34)} font={st.display} />
            : <PhysicsWord text={hot} color={b.accentHi} size={size * 1.05} at={2} font={st.display} />}
          {post && <div style={{ fontFamily: st.display, fontWeight: st.heavy ? 700 : 600, fontSize: size * 0.72, color: b.cream, textAlign: 'center', textTransform: st.upper ? 'uppercase' : 'none' }}>{post.trim()}</div>}
        </AbsoluteFill>
      </AbsoluteFill>
    )
  }
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 42%, ${b.bg2}, ${b.bg})` }}>
      <Bokeh color={b.accent} count={5} big /><Ambient />
      <Alive intensity={0.5}><AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 140px' }}>
        <div style={{ fontFamily: st.display, fontWeight: st.heavy ? 700 : 600, fontSize: size, color: b.cream, textAlign: 'center', lineHeight: 1.12, paddingBottom: '0.04em', textTransform: st.upper ? 'uppercase' : 'none' }}>
          {preSp(pre, hot)}{hot && <span style={{ color: b.accentHi }}>{hot}</span>}{postSp(post, hot)}
        </div>
      </AbsoluteFill></Alive>
    </AbsoluteFill>
  )
}

const SplitBeat: React.FC<{ hold: number; split: NonNullable<CommercialProps['beats'][number]['split']> }> = ({ hold, split }) => {
  const { p, st } = use(); const frame = useCurrentFrame(); const b = p.brand
  const lIn = interpolate(frame, [4, 18], [-100, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  const rIn = interpolate(frame, [10, 24], [100, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  const bothO = split.both ? interpolate(frame, [hold - 40, hold - 28], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 0
  const Side = ({ label, sub, color, tx }: any) => (
    <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', transform: `translateX(${tx}px)`, gap: 8, padding: '0 6%', boxSizing: 'border-box' }}>
      <div style={{ fontFamily: st.body, fontWeight: 800, fontSize: 24, letterSpacing: '0.3em', color, textTransform: 'uppercase', textAlign: 'center', maxWidth: '100%' }}>{sub}</div>
      {/* textAlign:center + maxWidth so a long headline WRAPS within its half and
          stays centered — without them, a wrapped multi-line headline left-aligns
          and reads as shoved to the frame edge (the "ANOTHER MID NIGHT" bug). */}
      <div style={{ fontFamily: st.display, fontWeight: 700, fontSize: 92, lineHeight: 1.0, color: b.white, textTransform: 'uppercase', textShadow: `0 0 34px ${color}55`, textAlign: 'center', maxWidth: '100%', wordBreak: 'break-word' }}>{label}</div>
    </div>
  )
  return (
    <AbsoluteFill style={{ background: `linear-gradient(135deg, ${b.bg}, ${b.bg2})` }}>
      <AbsoluteFill style={{ flexDirection: 'row' }}>
        <Side label={split.leftLabel} sub={split.leftSub} color={b.accentHi} tx={lIn} />
        <div style={{ width: 3, height: '54%', alignSelf: 'center', background: `linear-gradient(180deg, transparent, ${b.accent}, transparent)`, boxShadow: `0 0 20px ${b.accent}` }} />
        <Side label={split.rightLabel} sub={split.rightSub} color={b.accent2 || b.accentHi} tx={rIn} />
      </AbsoluteFill>
      {split.both && <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 90 }}>
        <div style={{ fontFamily: st.display, fontWeight: 700, fontSize: 60, color: b.white, textTransform: 'uppercase', opacity: bothO }}>{split.both}</div>
      </AbsoluteFill>}
    </AbsoluteFill>
  )
}

const CTABeat: React.FC<{ hold: number; cta: { headline: string; button: string; url: string } }> = ({ hold, cta }) => {
  const { p, st } = use(); const frame = useCurrentFrame(); const { fps } = useVideoConfig(); const b = p.brand
  const up = spring({ frame: frame - 2, fps, config: { damping: 15, stiffness: 130 } })
  const line = interpolate(frame, [22, 36], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const btn = spring({ frame: frame - 40, fps, config: { damping: 12, stiffness: 180 } })
  const url = interpolate(frame, [58, 70], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const pulse = 1 + Math.sin(frame * 0.12) * 0.02
  return (
    <AbsoluteFill style={{ background: `radial-gradient(130% 120% at 50% 42%, ${b.bg2}, ${b.bg})` }}>
      <Bokeh color={b.accent} count={6} big /><Ambient />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
        <div style={{ transform: `scale(${0.74 + clamp(up, 0, 1) * 0.26})` }}><Wordmark size={104} /></div>
        <div style={{ width: 380 * line, height: 2, background: `linear-gradient(90deg, transparent, ${b.accent}, transparent)`, marginTop: 28, boxShadow: `0 0 14px ${b.accent}` }} />
        <div style={{ fontFamily: st.display, fontWeight: st.heavy ? 700 : 600, fontSize: 52, color: b.cream, marginTop: 26, textAlign: 'center', opacity: clamp(line, 0, 1), textTransform: st.upper ? 'uppercase' : 'none' }}>{cta.headline}</div>
        <div style={{ marginTop: 34, opacity: clamp(btn, 0, 1), transform: `scale(${(0.7 + clamp(btn, 0, 1) * 0.3) * pulse})` }}>
          <div style={{ background: `linear-gradient(180deg, ${b.accentHi}, ${b.accent})`, color: b.bg, fontFamily: st.display, fontWeight: 700, fontSize: 32, padding: '20px 54px', borderRadius: 12, boxShadow: `0 0 30px ${b.accent}66`, textTransform: st.upper ? 'uppercase' : 'none' }}>{cta.button}</div>
        </div>
        <div style={{ fontFamily: st.mono, fontWeight: 500, fontSize: 26, color: b.mute, letterSpacing: '0.08em', marginTop: 24, opacity: url }}>{cta.url}</div>
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
        {kicker && <div style={{ fontFamily: st.mono, fontWeight: 600, fontSize: 22, letterSpacing: '0.26em', textTransform: 'uppercase', color: b.accent, marginBottom: 10, opacity: clamp((frame - 4) / 8, 0, 1) }}>{st.glitch ? '// ' : ''}{kicker}</div>}
        <div style={{ fontFamily: st.display, fontWeight: 800, fontSize: 300, color: b.accentHi, lineHeight: 1.0, paddingBottom: '0.03em', textShadow: `0 0 60px ${b.accent}55` }}>
          <CountUp to={big.value} prefix={big.prefix || ''} suffix={big.suffix || ''} decimals={big.decimals} startAt={4} dur={26} />
        </div>
        <div style={{ fontFamily: st.body, fontWeight: 700, fontSize: 40, color: b.cream, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 4 }}>{big.label}</div>
        {sub && <div style={{ fontFamily: st.body, fontWeight: 500, fontSize: 26, color: b.mute, marginTop: 14 }}>{sub}</div>}
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
                  <div style={{ fontFamily: st.display, fontWeight: 700, fontSize: 30, color: b.white }}>{sp.title}</div>
                  {sp.desc && <div style={{ fontFamily: st.body, fontWeight: 500, fontSize: 20, color: b.mute, marginTop: 6, padding: '0 20px' }}>{sp.desc}</div>}
                </div>
                {i < n - 1 && <div style={{ width: 70, height: 3, marginTop: -60, background: b.mute + '33', position: 'relative' }}><div style={{ position: 'absolute', inset: 0, width: `${lineW * 100}%`, background: b.accent, boxShadow: `0 0 10px ${b.accent}` }} /></div>}
              </div>
            )
          })}
        </div>
      </AbsoluteFill>
      {(kicker || hot) && <Head kicker={kicker} hot={hot} hold={hold} size={44} />}
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
    case 'split': return <SplitBeat hold={hold} split={be.split || { leftLabel: '', leftSub: '', rightLabel: '', rightSub: '' }} />
    case 'brand': return <MeetBeat hold={hold} sub={be.sub} />
    case 'showcase': return <ShowcaseBeat hold={hold} src={be.shot} kicker={be.kicker} hot={be.hot} sub={be.sub} />
    case 'bignumber': return be.big ? <BigNumberBeat hold={hold} big={be.big} kicker={be.kicker} sub={be.sub} /> : <QuoteBeat hold={hold} pre={be.pre} hot={be.hot} sub={be.sub} />
    case 'steps': return (be.steps && be.steps.length) ? <StepsBeat hold={hold} steps={be.steps} kicker={be.kicker} hot={be.hot} /> : <GridBeat hold={hold} items={be.items || []} kicker={be.kicker} hot={be.hot} />
    case 'cta': return <CTABeat hold={hold} cta={be.cta || { headline: '', button: '', url: '' }} />
  }
}

export const TemplateCommercial: React.FC<CommercialProps> = (p) => {
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
            {p.bug && i > 0 && i < p.beats.length - 1 && (p.logo ? <LogoBug src={`${p.assetDir}/${p.logo}`} width={150} /> : <LogoBug name={(p.wordmark?.pre || '') + (p.wordmark?.post || '')} color={b.white} fontFamily={st.display} />)}
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
