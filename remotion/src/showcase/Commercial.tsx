import React from 'react'
import {
  AbsoluteFill, Audio, Img, Sequence, OffthreadVideo, staticFile,
  useCurrentFrame, interpolate, spring, Easing,
} from 'remotion'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import plan from '../../public/commercials/jordyn-edge/plan.json'

/**
 * THE COMMERCIAL RENDERER — one plan in, one film out.
 *
 * Nothing here is specific to a business. It reads plan.json (written by
 * scripts/make-commercial.mjs) and renders whatever is in it: the footage the
 * model generated, the voice it spoke, the music it scored, and the on-screen
 * lines as REAL TYPE.
 *
 * THAT LAST PART IS THE WHOLE ARCHITECTURE. Generated video cannot spell —
 * left to itself it writes "Cdnsanr Pruerhe" on a flyer. So the video model
 * is never asked to draw a word, the shot prompts forbid readable surfaces,
 * and every legible character in the finished film is type rendered at 1080p.
 *
 * It also means a second language, or a different price, is a re-render
 * rather than a reshoot.
 */

const { fontFamily: F } = loadInter()
export const COMMERCIAL_FPS = 30
const FPS = COMMERCIAL_FPS
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

const INK = '#14161a'
const ACCENT = '#ffc93c'
const WHITE = '#ffffff'

type Beat = { line: string; accent: string; vo: string; clip: string | null; scene?: string | null; voFile: string | null; figure?: string | null }
const PLAN = plan as unknown as { name: string; style?: string; url?: string | null; beats: Beat[]; music: string | null }
const ASSET = (n: string) => staticFile(`commercials/${PLAN.name}/${n}`)

const ease = (frame: number, at: number) =>
  clamp(spring({ frame: frame - at, fps: FPS, config: { damping: 18, stiffness: 130, mass: 0.9 } }), 0, 1.12)

/**
 * HOW LONG EACH BEAT RUNS.
 *
 * The voice decides. A beat holds its own line plus a short breath, so the
 * cut never lands on top of a word — and the film's total length falls out of
 * the script rather than being a number anyone chose.
 */
const VO_SECONDS: number[] = (plan as unknown as { voDurations?: number[] }).voDurations
  ?? PLAN.beats.map(() => 5.2)

/**
 * THE CAMERA. A different move per beat, cycling — eight shots that all push
 * in is what makes generated footage read as cheap, and the clips already
 * carry their own motion, so this is the second layer on top.
 */
const MOVES: { scale: number; push: number; x: number; y: number }[] = [
  { scale: 1.04, push: 0.06, x: 0, y: 0 },
  { scale: 1.12, push: -0.06, x: 0, y: 0 },
  { scale: 1.06, push: 0.05, x: -40, y: 0 },
  { scale: 1.05, push: 0.07, x: 40, y: 0 },
  { scale: 1.10, push: -0.05, x: 0, y: -30 },
  { scale: 1.04, push: 0.06, x: 0, y: 30 },
]

const Shot: React.FC<{ src: string; hold: number; i: number }> = ({ src, hold, i }) => {
  const frame = useCurrentFrame()
  const mv = MOVES[i % MOVES.length]
  const t = interpolate(frame, [0, Math.max(1, hold)], [0, 1], {
    extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad),
  })
  /* a short fade each end so a cut never strobes */
  const inOut = Math.min(clamp(frame / 7, 0, 1), clamp((hold - frame) / 7, 0, 1))
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: INK }}>
      <AbsoluteFill style={{
        transform: `scale(${mv.scale + mv.push * t}) translate(${mv.x}px, ${mv.y}px)`,
        opacity: inOut,
      }}>
        <OffthreadVideo src={src} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

/**
 * THE LINE, WITH ITS ACCENT.
 *
 * The plan names 1-3 words to colour, and they are guaranteed to appear in
 * the line verbatim — so the split is a plain search rather than anything
 * clever, and a miss simply renders the line in one colour.
 */
const Line: React.FC<{ line: string; accent: string; last?: boolean; figure?: string | null }> = ({ line, accent, last = false, figure }) => {
  /* the figure is already set large above; saying it twice reads as an error */
  if (figure && line.includes(figure)) line = line.replace(figure, '').replace(/s{2,}/g, ' ').replace(/[,s]+$/, '').replace(/^[,s]+/, '').trim()
  const frame = useCurrentFrame()
  /* EDGE lands the line oversized and settles it in four frames; the warm
     films drift it up over twelve. Same information, opposite attitude. */
  const p = EDGE
    ? clamp(spring({ frame: frame - 3, fps: FPS, config: { damping: 11, stiffness: 260, mass: 0.6 } }), 0, 1.14)
    : ease(frame, 8)
  const k = clamp(p, 0, 1)
  const at = accent ? line.toLowerCase().indexOf(accent.toLowerCase()) : -1
  const parts = at >= 0
    ? [line.slice(0, at), line.slice(at, at + accent.length), line.slice(at + accent.length)]
    : [line, '', '']
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0,
      ...(last ? { top: '50%', transform: 'translateY(-50%)' } : { bottom: 96 }),
      zIndex: 30, textAlign: 'center', padding: '0 140px',
      fontWeight: 900, fontSize: last ? 88 : 62, lineHeight: 1.08, letterSpacing: '-0.03em',
      color: EDGE ? '#f2ede3' : PAPER ? '#4a3f35' : WHITE,
      opacity: clamp(p * 1.8, 0, 1),
      textShadow: EDGE ? '0 6px 40px rgba(0,0,0,0.9)' : PAPER ? 'none' : '0 4px 34px rgba(0,0,0,0.7)',
    }}>
      <span style={{ display: 'inline-block', transform: EDGE ? `scale(${1.3 - 0.3 * k})` : `translateY(${(1 - k) * 22}px)` }}>
        {parts[0]}<span style={{ color: EDGE ? '#d1502f' : PAPER ? '#c4623f' : ACCENT }}>{parts[1]}</span>{parts[2]}
      </span>
    </div>
  )
}


const Figure: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame()
  const p = clamp(spring({ frame: frame - 10, fps: FPS, config: { damping: 14, stiffness: 150, mass: 0.8 } }), 0, 1.12)
  const k = clamp(p, 0, 1)
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 178, zIndex: 31,
      textAlign: 'center',
      fontWeight: 900, fontSize: 132, letterSpacing: '-0.04em',
      /* deep teal, the trust colour of the palette these scenes are drawn in */
      color: '#2f5d62',
      lineHeight: 1.2, paddingBottom: 6,
      opacity: clamp(p * 2, 0, 1),
      transform: `scale(${0.82 + 0.18 * k})`,
    }}>{text}</div>
  )
}

/** A wash under the type. Readability, and it settles the lower frame. */
const PAPER = PLAN.style === 'paper'
/** The hard cut. Same craft, opposite temperature — see the note below. */
const EDGE = PLAN.style === 'edge'

const Foot: React.FC<{ full?: boolean }> = ({ full = false }) => (
  <div style={{
    position: 'absolute', left: 0, right: 0, bottom: 0,
    height: full ? '100%' : 470, zIndex: 20,
    ...(EDGE ? { display: 'none' } : {}),
    background: PAPER
      ? (full
        ? 'rgba(250,249,245,0.88)'
        : 'linear-gradient(0deg, rgba(250,249,245,0.97) 0%, rgba(250,249,245,0.80) 40%, transparent 100%)')
      : (full
        ? 'rgba(20,22,26,0.72)'
        : 'linear-gradient(0deg, rgba(20,22,26,0.94) 0%, rgba(20,22,26,0.72) 46%, transparent 100%)'),
  }} />
)

/* ── the cut ─────────────────────────────────────────────────────────────── */

const HOLD = VO_SECONDS.map((s) => Math.round((s + (EDGE ? 0.12 : 0.45)) * FPS))
const STARTS: number[] = []
{ let t = 0; for (const h of HOLD) { STARTS.push(t); t += h } }
export const COMMERCIAL_FRAMES = STARTS[STARTS.length - 1] + HOLD[HOLD.length - 1] + 12

export const Commercial: React.FC = () => (
  <AbsoluteFill style={{ background: EDGE ? '#1a1714' : PAPER ? '#faf9f5' : INK, fontFamily: F }}>
    {PLAN.beats.map((b, i) => (
      <Sequence key={i} from={STARTS[i]} durationInFrames={HOLD[i]}>
        {b.scene
          ? (EDGE
            /* no wipe: a hard cut is the whole point */
            ? <PaperScene src={ASSET(b.scene)} hold={HOLD[i]} i={i} />
            : <PaperWipe hold={HOLD[i]}><PaperScene src={ASSET(b.scene)} hold={HOLD[i]} i={i} /></PaperWipe>)
          : b.clip ? <Shot src={ASSET(b.clip)} hold={HOLD[i]} i={i} /> : null}
        <Foot full={i === PLAN.beats.length - 1} />
        {b.figure && <Figure text={b.figure} />}
        <Line line={b.line} accent={b.accent} figure={b.figure} last={i === PLAN.beats.length - 1} />
      </Sequence>
    ))}

    {PAPER && !EDGE && <Grain />}

    {PLAN.music && (
      <Sequence from={0}>
        <Audio src={ASSET(PLAN.music)} volume={0.26} />
      </Sequence>
    )}

    {PLAN.beats.map((b, i) => b.voFile ? (
      <Sequence key={'vo' + i} from={STARTS[i] + 4}>
        <Audio src={ASSET(b.voFile)} volume={1} />
      </Sequence>
    ) : null)}
  </AbsoluteFill>
)

/**
 * A PAPER SCENE — a still, animated.
 *
 * Cut paper does not pan, so the motion is added rather than filmed: a slow
 * Ken-Burns drift and a gentle breathing float, which is what gives a flat
 * collage life without pretending the paper moves. The still is also 3-10x
 * cheaper than a clip and holds a crisper torn edge than any video model
 * would render.
 */
/**
 * PAPER GRAIN — a faint fibre texture over everything.
 *
 * The cohesion trick: eight scenes generated separately still read as one
 * material when the same grain drifts across all of them.
 */
const GRAIN = encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(#n)' opacity='0.5'/></svg>`
)

export const Grain: React.FC = () => {
  const f = useCurrentFrame()
  return (
    <AbsoluteFill style={{
      pointerEvents: 'none',
      backgroundImage: `url("data:image/svg+xml,${GRAIN}")`,
      backgroundPosition: `${(f * 5) % 180}px ${(f * 9) % 180}px`,
      mixBlendMode: 'multiply', opacity: 0.06, zIndex: 40,
    }} />
  )
}

/**
 * A PAPER SCENE — a still, made alive.
 *
 * Cut paper does not pan, so the motion is DESIGNED rather than filmed: a
 * slow Ken-Burns, a gentle breathing float, and a quarter-degree rock. The
 * rock is the part that sells it — flat art that tilts a fraction reads as a
 * sheet resting on other sheets rather than as a picture.
 *
 * Ported from CommercialJordynPaper.tsx, which had already solved this.
 */
export const PaperScene: React.FC<{ src: string; hold: number; i: number }> = ({ src, hold, i }) => {
  const f = useCurrentFrame()
  const p = interpolate(f, [0, Math.max(1, hold)], [0, 1], {
    extrapolateRight: 'clamp', easing: Easing.bezier(0.16, 1, 0.3, 1),
  })
  /* a different focus per scene so the push never repeats */
  const focusX = [50, 38, 62, 45, 55, 40, 60, 50][i % 8]
  const focusY = [50, 45, 55, 50, 42, 58, 48, 52][i % 8]
  /* faster push, alternating direction, so two shots never move alike */
  const scale = EDGE ? (i % 2 ? 1.16 - p * 0.12 : 1.02 + p * 0.14) : 1.04 + p * 0.08
  const tx = (50 - focusX) * p * 0.12
  const ty = (50 - focusY) * p * 0.12
  /* the edge cut barely breathes — a float is a calm gesture */
  const floatY = EDGE ? 0 : Math.sin(f * 0.05) * 5
  const floatR = EDGE ? 0 : Math.sin(f * 0.035) * 0.25
  return (
    <AbsoluteFill style={{ background: EDGE ? '#1a1714' : '#faf9f5', overflow: 'hidden' }}>
      <Img src={src} style={{
        width: '100%', height: '100%', objectFit: 'cover',
        transform: `scale(${scale}) translate(${tx}%, ${ty + floatY * 0.1}%) rotate(${floatR}deg)`,
      }} />
      {/* a soft warm vignette to seat the paper in the frame */}
      <AbsoluteFill style={{ boxShadow: EDGE ? 'inset 0 0 260px rgba(0,0,0,0.55)' : 'inset 0 0 220px rgba(150,120,80,0.18)' }} />
    </AbsoluteFill>
  )
}

/**
 * THE PAPER WIPE — a sheet pulled off the pile.
 *
 * The outgoing scene slides AND tilts away, revealing the next underneath.
 * A cross-fade would work for film; this is the move that says paper.
 */
export const PaperWipe: React.FC<{ hold: number; children: React.ReactNode }> = ({ hold, children }) => {
  const f = useCurrentFrame()
  const xf = 12
  const ease = Easing.bezier(0.16, 1, 0.3, 1)
  const inP = interpolate(f, [0, xf], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease })
  const outP = interpolate(f, [hold - xf, hold], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease })
  return (
    <AbsoluteFill style={{
      transform: `translateX(${(1 - inP) * 8 - outP * 12}%) rotate(${(1 - inP) * 2.5 - outP * 4}deg)`,
      opacity: Math.min(inP, 1 - outP),
      transformOrigin: 'center',
    }}>{children}</AbsoluteFill>
  )
}
