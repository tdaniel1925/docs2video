import React from 'react'
import {
  AbsoluteFill, Audio, Img, Sequence, OffthreadVideo, staticFile,
  useCurrentFrame, interpolate, Easing, spring,
} from 'remotion'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import { MusicBed } from '../lib/musicbed'
import plan from '../../public/commercials/jordyn-drawn/plan.json'

/**
 * JORDYN — THE DRAWN CUT. 45 seconds, every frame illustrated.
 *
 * WHY THIS REPLACES THE STOCK VERSION. That cut drew 41 shots from 23 stock
 * clips, and 18 of them were the SAME CLIP PLAYING AGAIN — some three times.
 * The verdict was "the same damn video clips over and over", and the numbers
 * agree. Here there are 24 drawings for 24 picture shots: reuse is impossible
 * by construction, not by discipline.
 *
 * EVERYTHING MOVES. The one thing that worked in the last cut was the way the
 * custom drawings moved, and there were only three of them. Every drawing in
 * this film is animated by image-to-video off its own approved still, so the
 * whole piece has that quality rather than three moments of it.
 *
 * THE ONE EXCEPTION IS THE MONEY. The payback shot is typed, not drawn —
 * an image model cannot be trusted with a digit, and "$499, paid back in five
 * days" is the frame the film is selling on.
 */

const { fontFamily: F } = loadInter()
export const JD_FPS = 30
const FPS = JD_FPS
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/* jordyn.app's own tokens. */
const CREAM = '#faf9f5'
const CREAM_D = '#f0eee6'
const INK = '#3d3929'
const INK_SOFT = '#6b6759'
const CLAY = '#c96442'
const SAGE = '#7d8c6f'

type Shot = {
  id: string; kind: string; build: string | null; hold: number; key: boolean
  line: string | null; accent: string | null; see: string | null
  src: string | null; poster: string | null
  vo: string | null; voFile: string | null; voSecs: number | null
}
const PLAN = plan as unknown as { name: string; music: string | null; shots: Shot[] }
const ASSET = (n: string) => staticFile(`commercials/jordyn-drawn/${n}`)

/**
 * TIMING — spread a long line ACROSS its shots, never hold one longer.
 *
 * The first cut of this stretched whatever shot carried a line until the
 * audio fitted. A 7.4-second sentence therefore held ONE drawing for 7.7
 * seconds, and the 45-second film came out at 78 — the exact slideshow
 * problem this whole rebuild exists to kill. Ten shots were doing it.
 *
 * A line of narration belongs to a GROUP: the shot that speaks it plus the
 * silent shots after it, which are separate drawings. If the group is shorter
 * than the audio, every shot in it grows proportionally, so a long line means
 * MORE PICTURES rather than a longer stare at one. A line with no following
 * shots is the only case that can still stretch a single frame, and those are
 * the held key frames, where holding is the point.
 */
function layout() {
  const holds = PLAN.shots.map((s) => s.hold)
  for (let i = 0; i < PLAN.shots.length; i++) {
    const s = PLAN.shots[i]
    if (!s.voSecs) continue
    /* the group: this shot, plus every silent shot before the next line */
    let end = i + 1
    while (end < PLAN.shots.length && !PLAN.shots[end].vo) end++
    const span = holds.slice(i, end).reduce((a, b) => a + b, 0)
    const need = s.voSecs + 0.3
    if (span >= need) continue
    const k = need / span
    for (let j = i; j < end; j++) holds[j] *= k
  }
  const starts: number[] = []
  let t = 0
  for (const h of holds) { starts.push(Math.round(t * FPS)); t += h }
  return { starts, frames: holds.map((h) => Math.max(1, Math.round(h * FPS))), total: Math.round(t * FPS) }
}

/**
 * THE PICTURE.
 *
 * Every shot is a five-second animated clip playing for one to three seconds
 * of it, so each one is entered at a different point — otherwise twenty-four
 * clips all start from their own first frame and the film has a visible
 * rhythm of everything beginning at once.
 *
 * The code push is small here and gets smaller on an animated clip, because
 * the drawing already moves. Stacking a code move on a model move fights it.
 */
const Picture: React.FC<{ shot: Shot; hold: number; i: number }> = ({ shot, hold, i }) => {
  const frame = useCurrentFrame()
  const moving = Boolean(shot.src?.endsWith('.mp4'))
  const t = interpolate(frame, [0, Math.max(1, hold)], [0, 1], { extrapolateRight: 'clamp', easing: Easing.linear })
  /* alternating direction so consecutive shots never drift the same way */
  const dir = i % 2 === 0 ? 1 : -1
  const push = moving ? 0.02 : 0.06
  const scale = 1.03 + dir * push * t

  /* a short dissolve: long enough not to strobe, short enough that a 1.0s
     shot is still a cut rather than a fade */
  const fade = Math.min(clamp(frame / 4, 0, 1), clamp((hold - frame) / 4, 0, 1))
  const src = shot.src ?? shot.poster
  if (!src) return null

  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: CREAM }}>
      <AbsoluteFill style={{ transform: `scale(${scale})`, opacity: fade }}>
        {src.endsWith('.mp4')
          ? <OffthreadVideo src={ASSET(src)} muted
              /* enter each clip at a different point — see the note above */
              startFrom={Math.round(((i * 0.37) % 2.2) * FPS)}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <Img src={ASSET(src)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

const Line: React.FC<{ line: string; accent: string | null; hold: number }> = ({ line, accent, hold }) => {
  const frame = useCurrentFrame()
  const k = clamp(spring({ frame, fps: FPS, config: { damping: 26, stiffness: 150, mass: 0.7 } }), 0, 1)
  const out = clamp((hold - frame) / 5, 0, 1)
  const at = accent ? line.indexOf(accent) : -1
  const parts = at >= 0 ? [line.slice(0, at), accent as string, line.slice(at + (accent as string).length)] : [line, '', '']
  return (
    <div style={{
      position: 'absolute', left: 92, right: 92, bottom: 88, zIndex: 30,
      fontFamily: F, fontWeight: 700, fontSize: 64, lineHeight: 1.14,
      letterSpacing: '-0.025em', color: INK, opacity: Math.min(k, out),
    }}>
      <span style={{ display: 'inline-block', transform: `translateY(${(1 - k) * 14}px)` }}>
        {parts[0]}<span style={{ color: CLAY }}>{parts[1]}</span>{parts[2]}
      </span>
    </div>
  )
}

/** Keeps type readable over a drawing without crushing the artwork. */
const Wash: React.FC = () => (
  <div style={{
    position: 'absolute', left: 0, right: 0, bottom: 0, height: 380, zIndex: 20,
    background: `linear-gradient(0deg, ${CREAM} 0%, rgba(250,249,245,0.80) 46%, transparent 100%)`,
  }} />
)

/**
 * THE MONEY SHOT — the one frame that is typed rather than drawn.
 * $499 against five days ticking off. Exact, legible, brand-correct.
 */
const Payback: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const k = clamp(spring({ frame, fps: FPS, config: { damping: 22, stiffness: 160, mass: 0.7 } }), 0, 1)
  const days = Math.min(5, Math.floor(interpolate(frame, [hold * 0.28, hold * 0.76], [0, 5.9],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })))
  return (
    <AbsoluteFill style={{ background: CREAM, alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ opacity: k, transform: `translateY(${(1 - k) * 18}px)`, textAlign: 'center' }}>
        <div style={{
          fontFamily: F, fontWeight: 800, fontSize: 200, color: CLAY,
          letterSpacing: '-0.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums',
        }}>$499</div>
        <div style={{ fontFamily: F, fontWeight: 600, fontSize: 29, color: INK_SOFT, marginTop: 12 }}>
          a month &middot; about $16 a day
        </div>
      </div>
      <div style={{ display: 'flex', gap: 15, marginTop: 50 }}>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} style={{
            width: 72, height: 72, borderRadius: 8,
            background: i < days ? SAGE : CREAM_D,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: F, fontWeight: 800, fontSize: 33,
            color: i < days ? CREAM : INK_SOFT + '55',
          }}>{i + 1}</div>
        ))}
      </div>
      <div style={{ fontFamily: F, fontWeight: 800, fontSize: 52, color: INK, marginTop: 32, letterSpacing: '-0.025em' }}>
        Paid back in <span style={{ color: SAGE }}>five days</span>
      </div>
    </AbsoluteFill>
  )
}

const Logo: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const k = clamp(spring({ frame, fps: FPS, config: { damping: 24, stiffness: 120, mass: 0.9 } }), 0, 1)
  const out = clamp((hold - frame) / 6, 0, 1)
  return (
    <AbsoluteFill style={{ background: CREAM, alignItems: 'center', justifyContent: 'center' }}>
      <Img src={ASSET('logo.png')} style={{
        width: 600, opacity: Math.min(k, out),
        transform: `translateY(${(1 - k) * 12}px) scale(${0.95 + k * 0.05})`,
      }} />
    </AbsoluteFill>
  )
}

/** The ask. Held longest of anything — this is the frame a viewer acts on. */
const CTA: React.FC = () => {
  const frame = useCurrentFrame()
  const s = (d: number) => clamp(spring({ frame: frame - d, fps: FPS, config: { damping: 24, stiffness: 140, mass: 0.8 } }), 0, 1)
  return (
    <AbsoluteFill style={{ background: CREAM, alignItems: 'center', justifyContent: 'center' }}>
      <Img src={ASSET('logo.png')} style={{ width: 470, opacity: s(0), transform: `translateY(${(1 - s(0)) * 12}px)` }} />
      <div style={{ marginTop: 38, display: 'flex', gap: 20, alignItems: 'center', opacity: s(7) }}>
        <span style={{ fontFamily: F, fontWeight: 800, fontSize: 60, color: INK, letterSpacing: '-0.03em' }}>$499</span>
        <span style={{ fontFamily: F, fontWeight: 600, fontSize: 33, color: INK_SOFT }}>a month</span>
        <span style={{ width: 2, height: 42, background: CREAM_D }} />
        <span style={{ fontFamily: F, fontWeight: 700, fontSize: 39, color: SAGE }}>14 days free</span>
      </div>
      <div style={{
        marginTop: 44, fontFamily: F, fontWeight: 800, fontSize: 90, color: CLAY,
        letterSpacing: '-0.035em', opacity: s(15), transform: `translateY(${(1 - s(15)) * 16}px)`,
      }}>jordyn.app</div>
    </AbsoluteFill>
  )
}

const { starts, frames, total } = layout()
export const JD_FRAMES = total

export const JordynDrawn: React.FC = () => {
  /* music under the voice, hushed almost to silence on the trust beat */
  const duck = (f: number) => {
    const inF = clamp(f / (1.0 * FPS), 0, 1)
    const outF = clamp((total - f) / (1.8 * FPS), 0, 1)
    let speaking = false
    let hush = false
    PLAN.shots.forEach((s, i) => {
      if (s.voSecs && f >= starts[i] && f < starts[i] + s.voSecs * FPS) speaking = true
      if (s.id === 'trust' && f >= starts[i] && f < starts[i] + frames[i]) hush = true
    })
    return Math.min(inF, outF) * (hush ? 0.05 : speaking ? 0.14 : 0.27)
  }

  return (
    <AbsoluteFill style={{ background: CREAM, fontFamily: F }}>
      {PLAN.shots.map((s, i) => (
        <Sequence key={s.id} from={starts[i]} durationInFrames={frames[i]}>
          {s.kind === 'logo' ? <Logo hold={frames[i]} />
            : s.kind === 'cta' ? <CTA />
              : s.kind === 'built' ? <Payback hold={frames[i]} />
                : <Picture shot={s} hold={frames[i]} i={i} />}
          {s.line && <Wash />}
          {s.line && <Line line={s.line} accent={s.accent} hold={frames[i]} />}
        </Sequence>
      ))}

      {PLAN.shots.map((s, i) => (
        s.voFile ? <Sequence key={`v${s.id}`} from={starts[i]}><Audio src={ASSET(s.voFile)} /></Sequence> : null
      ))}

      {PLAN.music && (
        <Sequence from={0} durationInFrames={total}>
          <MusicBed src={`commercials/jordyn-drawn/${PLAN.music}`} musicFrames={Math.round(55 * FPS)} volume={duck} />
        </Sequence>
      )}
    </AbsoluteFill>
  )
}
