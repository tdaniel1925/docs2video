import React from 'react'
import {
  AbsoluteFill, Audio, Img, Sequence, OffthreadVideo, staticFile,
  useCurrentFrame, interpolate, Easing, spring,
} from 'remotion'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import { MusicBed } from '../lib/musicbed'
import plan from '../../public/commercials/jordyn-film/plan.json'

/**
 * JORDYN — THE FILM.
 *
 * A separate renderer from Commercial.tsx rather than a fourth style branch in
 * it, for two reasons.
 *
 * THE CLIP HAS TO WIN. Commercial.tsx reads `b.scene ? <still> : b.clip` — and
 * because every beat in a generated plan has a still, the clips never render
 * at all. That is harmless there (no plan it plays has both) and fatal here,
 * where three shots were animated deliberately and are the reason the film is
 * worth making. Here the clip wins and the still is what falls back.
 *
 * THE CUTS ARE PRE-SOLVED. Commercial.tsx snaps starts to the nearest raw beat
 * at render time. This film's grid came back double-time (159 BPM for a track
 * generated at 84), so nearest-beat snapping would cut every 0.38s and shred a
 * calm piece. scripts/beat-snap.mjs already worked out the half-bar lines and
 * wrote them into the plan; this just uses them.
 *
 * The look is jordyn.app's own — cream ground, clay accent, warm ink. The last
 * film was told to match the site and used dark ink grounds instead, which is
 * most of why it "did not have the same look and feel".
 */

const { fontFamily: F } = loadInter()
export const JORDYN_FPS = 30
const FPS = JORDYN_FPS
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/* The site's palette, not an approximation of it. */
const CREAM = '#F8F8F8'
const INK = '#2B2320'
const CLAY = '#B5563A'

type Beat = {
  line: string; accent: string; vo: string
  scene: string | null; clip: string | null; voFile: string | null
}
type Plan = {
  name: string; music: string | null; beats: Beat[]
  voDurations: number[]
  /** Half-bar cut points in seconds, from scripts/beat-snap.mjs. */
  cuts?: number[]
  bpm?: number
}
const PLAN = plan as unknown as Plan
const ASSET = (n: string) => staticFile(`commercials/${PLAN.name}/${n}`)

/* ── the cut ──────────────────────────────────────────────────────────────
 *
 * The starts come from the plan, already snapped to half bars against the
 * real tempo. Falling back to voice length alone keeps a plan that predates
 * the snapper renderable rather than crashing.
 */
const CUTS: number[] = PLAN.cuts?.length
  ? PLAN.cuts.map((s) => Math.round(s * FPS))
  : (() => {
    const out: number[] = []
    let t = 0.6
    for (const d of PLAN.voDurations) { out.push(Math.round(t * FPS)); t += d + 0.35 }
    return out
  })()

/** The tail: the last beat runs its own narration out, plus a breath to rest on. */
const TAIL = Math.round((PLAN.voDurations[PLAN.voDurations.length - 1] + 1.6) * FPS)
const HOLD = CUTS.map((c, i) => (i + 1 < CUTS.length ? CUTS[i + 1] : c + TAIL) - c)
/**
 * THE LENGTH — computed from the plan, as it should be.
 *
 * This spent a while as a hardcoded literal while I chased a duration that
 * would not change. The cause was not this file: THREE imports in Root.tsx
 * were competing for the name JORDYN_FRAMES, and the last one declared won,
 * so this composition silently rendered CommercialJordyn's 1304 frames and
 * the film lost its final three beats — the turn and the landing. The imports
 * are aliased now.
 */
export const JORDYN_FRAMES = CUTS[CUTS.length - 1] + TAIL

/**
 * THE CAMERA — deliberately small.
 *
 * A slow push reads as film; a swooping move reads as AI. These are 4-8%
 * scale changes over the whole beat, which is barely perceptible frame to
 * frame and quite visible across a shot. They cycle so twelve shots do not
 * all drift the same way, which is what makes generated footage look cheap.
 *
 * The three animated beats get almost nothing on top — they already carry
 * their own motion, and stacking a code move on a model move fights it.
 */
const MOVES: { from: number; to: number; x: number; y: number }[] = [
  { from: 1.00, to: 1.06, x: 0, y: 0 },
  { from: 1.06, to: 1.00, x: 0, y: 0 },
  { from: 1.02, to: 1.07, x: -26, y: 0 },
  { from: 1.05, to: 1.00, x: 22, y: 0 },
  { from: 1.00, to: 1.05, x: 0, y: -18 },
  { from: 1.04, to: 1.00, x: 0, y: 16 },
]

const Shot: React.FC<{ beat: Beat; hold: number; i: number }> = ({ beat, hold, i }) => {
  const frame = useCurrentFrame()
  const moving = Boolean(beat.clip)
  const mv = MOVES[i % MOVES.length]
  const t = interpolate(frame, [0, Math.max(1, hold)], [0, 1], {
    extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad),
  })
  /* an animated clip gets a fraction of the move; a still gets all of it */
  const k = moving ? 0.25 : 1
  const scale = mv.from + (mv.to - mv.from) * t * k

  /*
   * A LONG DISSOLVE, NOT A CUT.
   *
   * The edge film hard-cut on purpose and it suited it. This one is calm and
   * unhurried, and a hard cut every few seconds fights that. 10 frames is a
   * third of a second — enough to feel like a dissolve, short enough that the
   * film never feels like it is waiting.
   */
  const fade = Math.min(clamp(frame / 10, 0, 1), clamp((hold - frame) / 10, 0, 1))

  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: CREAM }}>
      <AbsoluteFill style={{
        transform: `scale(${scale}) translate(${mv.x * t * k}px, ${mv.y * t * k}px)`,
        opacity: fade,
      }}>
        {beat.clip
          ? <OffthreadVideo src={ASSET(beat.clip)} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : beat.scene
            ? <Img src={ASSET(beat.scene)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : null}
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

/**
 * THE LINE.
 *
 * Drawn here and never in the image — image models cannot spell reliably, and
 * every film in this repo that let one try has gibberish somewhere in it.
 *
 * The accent words are guaranteed to appear in the line verbatim, so the split
 * is a plain search. A miss renders the line in one colour rather than
 * throwing: the accent is emphasis, not meaning.
 */
const Line: React.FC<{ line: string; accent: string }> = ({ line, accent }) => {
  const frame = useCurrentFrame()
  const k = clamp(spring({ frame, fps: FPS, config: { damping: 22, stiffness: 90, mass: 1.1 } }), 0, 1)

  const at = accent ? line.indexOf(accent) : -1
  const parts = at >= 0
    ? [line.slice(0, at), accent, line.slice(at + accent.length)]
    : [line, '', '']

  return (
    <div style={{
      position: 'absolute', left: 96, right: 96, bottom: 104, zIndex: 30,
      fontFamily: F, fontWeight: 600, fontSize: 74, lineHeight: 1.16,
      letterSpacing: '-0.021em', color: INK,
      opacity: k,
    }}>
      {/* rises a little as it fades in — settled rather than dropped in */}
      <span style={{ display: 'inline-block', transform: `translateY(${(1 - k) * 16}px)` }}>
        {parts[0]}<span style={{ color: CLAY }}>{parts[1]}</span>{parts[2]}
      </span>
    </div>
  )
}

/**
 * A WASH UNDER THE TYPE.
 *
 * The grounds are near-white and the type is warm ink, so contrast is the risk
 * here rather than darkness. A soft cream gradient keeps the line readable
 * wherever the illustration happens to be busy, without flattening the art —
 * the dark wash used on the paper films crushed them, because it was designed
 * for live footage.
 */
const Wash: React.FC<{ full?: boolean }> = ({ full = false }) => (
  <div style={{
    position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20,
    height: full ? '100%' : 420,
    background: full
      ? 'rgba(248,248,248,0.55)'
      : 'linear-gradient(0deg, rgba(248,248,248,0.94) 0%, rgba(248,248,248,0.70) 46%, transparent 100%)',
  }} />
)

/**
 * THE MUSIC SITS UNDER THE VOICE.
 *
 * Louder in the gaps, quieter under narration, and it opens and closes on a
 * fade so the film never starts or stops abruptly. The values are low because
 * this is an underscore — if you notice the music as music, it is too loud.
 */
const MUSIC_FRAMES = Math.round(80 * FPS)
const musicDuck = (f: number): number => {
  const inFade = clamp(f / (1.6 * FPS), 0, 1)
  const outFade = clamp((JORDYN_FRAMES - f) / (2.2 * FPS), 0, 1)
  /* under a line it drops; between lines it comes back up */
  const speaking = CUTS.some((c, i) => f >= c && f < c + Math.round(PLAN.voDurations[i] * FPS))
  return Math.min(inFade, outFade) * (speaking ? 0.10 : 0.19)
}

export const JordynFilm: React.FC = () => (
  <AbsoluteFill style={{ background: CREAM, fontFamily: F }}>
    {PLAN.beats.map((b, i) => (
      <Sequence key={i} from={CUTS[i]} durationInFrames={HOLD[i]}>
        {/* THE CLIP WINS — see the note at the top of this file. */}
        <Shot beat={b} hold={HOLD[i]} i={i} />
        <Wash full={i === PLAN.beats.length - 1} />
        <Line line={b.line} accent={b.accent} />
      </Sequence>
    ))}

    {/* Narration sits on its own beat's start, so a re-snap moves both together. */}
    {PLAN.beats.map((b, i) => (
      b.voFile ? <Sequence key={`vo${i}`} from={CUTS[i]}><Audio src={ASSET(b.voFile)} /></Sequence> : null
    ))}

    {/* MusicBed loops the track so it can never cut off mid-film — a bug that
        hit all nine videos in this repo once. */}
    {PLAN.music && (
      <Sequence from={0} durationInFrames={JORDYN_FRAMES}>
        <MusicBed
          src={`commercials/${PLAN.name}/${PLAN.music}`}
          musicFrames={MUSIC_FRAMES}
          volume={musicDuck}
        />
      </Sequence>
    )}
  </AbsoluteFill>
)
