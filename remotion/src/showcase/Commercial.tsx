import React from 'react'
import {
  AbsoluteFill, Audio, Sequence, OffthreadVideo, staticFile,
  useCurrentFrame, interpolate, spring, Easing,
} from 'remotion'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import plan from '../../public/commercials/jordyn-app/plan.json'

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

type Beat = { line: string; accent: string; vo: string; clip: string | null; voFile: string | null }
const PLAN = plan as { name: string; url: string | null; beats: Beat[]; music: string | null }
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
const Line: React.FC<{ line: string; accent: string; last?: boolean }> = ({ line, accent, last = false }) => {
  const frame = useCurrentFrame()
  const p = ease(frame, 8)
  const k = clamp(p, 0, 1)
  const at = accent ? line.indexOf(accent) : -1
  const parts = at >= 0
    ? [line.slice(0, at), accent, line.slice(at + accent.length)]
    : [line, '', '']
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0,
      ...(last ? { top: '50%', transform: 'translateY(-50%)' } : { bottom: 96 }),
      zIndex: 30, textAlign: 'center', padding: '0 140px',
      fontWeight: 900, fontSize: last ? 88 : 62, lineHeight: 1.08, letterSpacing: '-0.03em',
      color: WHITE,
      opacity: clamp(p * 1.8, 0, 1),
      textShadow: '0 4px 34px rgba(0,0,0,0.7)',
    }}>
      <span style={{ display: 'inline-block', transform: `translateY(${(1 - k) * 22}px)` }}>
        {parts[0]}<span style={{ color: ACCENT }}>{parts[1]}</span>{parts[2]}
      </span>
    </div>
  )
}

/** A wash under the type. Readability, and it settles the lower frame. */
const Foot: React.FC<{ full?: boolean }> = ({ full = false }) => (
  <div style={{
    position: 'absolute', left: 0, right: 0, bottom: 0,
    height: full ? '100%' : 470, zIndex: 20,
    background: full
      ? 'rgba(20,22,26,0.72)'
      : 'linear-gradient(0deg, rgba(20,22,26,0.94) 0%, rgba(20,22,26,0.72) 46%, transparent 100%)',
  }} />
)

/* ── the cut ─────────────────────────────────────────────────────────────── */

const HOLD = VO_SECONDS.map((s) => Math.round((s + 0.45) * FPS))
const STARTS: number[] = []
{ let t = 0; for (const h of HOLD) { STARTS.push(t); t += h } }
export const COMMERCIAL_FRAMES = STARTS[STARTS.length - 1] + HOLD[HOLD.length - 1] + 12

export const Commercial: React.FC = () => (
  <AbsoluteFill style={{ background: INK, fontFamily: F }}>
    {PLAN.beats.map((b, i) => (
      <Sequence key={i} from={STARTS[i]} durationInFrames={HOLD[i]}>
        {b.clip && <Shot src={ASSET(b.clip)} hold={HOLD[i]} i={i} />}
        <Foot full={i === PLAN.beats.length - 1} />
        <Line line={b.line} accent={b.accent} last={i === PLAN.beats.length - 1} />
      </Sequence>
    ))}

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
