import { AbsoluteFill, Audio, Img, Sequence, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion'
import { loadFont as loadMont } from '@remotion/google-fonts/Montserrat'
import { loadFont as loadSans } from '@remotion/google-fonts/SourceSans3'

const { fontFamily: MONT } = loadMont()
const { fontFamily: SANS } = loadSans()

/**
 * BeatHook — a punchy, beat-synced HOOK. Proves the "quick cuts + movement + SFX"
 * approach: the scene is chopped into sub-shots that CUT on an exact beat grid
 * (128 BPM → every 14.06 frames), every cut carries a hard movement, and SFX
 * hits (whoosh/impact/click/riser) land ON the cut frames. Two intensities:
 *   - 'premium'   : cut every 2 beats, dynamics (fast → HOLD → slam). Produced feel.
 *   - 'highenergy': cut every 1 beat (sub-second), relentless. Social-ad feel.
 */

const FPS = 30
const BPM = 128
const BEAT = (60 / BPM) * FPS          // 14.06 frames per beat
const NAVY = '#0b1a2e', GOLD = '#c9a227', CREAM = '#f6f3ea', ACC2 = '#2a4a74'
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export type HookProps = { intensity: 'premium' | 'highenergy'; image?: string }

// A single sub-shot: what to show + which movement + which SFX fires at its start.
type Shot = { beats: number; kind: 'word' | 'image' | 'stat' | 'logo'; text?: string; color?: string; move: Move; sfx: string; sub?: string }
type Move = 'punchIn' | 'whipL' | 'whipR' | 'slamUp' | 'slamDown' | 'zoomOut' | 'hold'

// The HOOK content (life-insurance ad). Same words both ways; only cut RATE differs.
const WORDS: { text: string; color: string; sub?: string }[] = [
  { text: 'YOUR', color: CREAM }, { text: 'FAMILY', color: GOLD }, { text: "DOESN'T WAIT", color: CREAM },
  { text: 'FOR', color: CREAM }, { text: 'SOMEDAY', color: GOLD, sub: 'Protect them now.' },
]

// Build the shot list from the word list at the chosen cut rate. premium = 2
// beats/word with a HOLD on the payoff; highenergy = 1 beat/word, no holds.
function buildShots(intensity: HookProps['intensity'], hasImage: boolean): Shot[] {
  const per = intensity === 'premium' ? 2 : 1
  const moves: Move[] = ['punchIn', 'whipL', 'slamUp', 'whipR', 'slamDown', 'zoomOut']
  const sfxCycle = ['impact', 'whoosh-short', 'impact', 'whoosh', 'impact']
  const shots: Shot[] = []
  WORDS.forEach((w, i) => {
    const isPayoff = i === WORDS.length - 1
    shots.push({
      beats: isPayoff && intensity === 'premium' ? per + 2 : per,   // premium HOLDS the payoff
      kind: 'word', text: w.text, color: w.color, sub: w.sub,
      move: isPayoff ? 'zoomOut' : moves[i % moves.length],
      sfx: isPayoff ? 'riser' : sfxCycle[i % sfxCycle.length],
    })
    // in high-energy, interleave a quick image flash between words if we have one
    if (hasImage && intensity === 'highenergy' && i % 2 === 1) shots.push({ beats: 1, kind: 'image', move: i % 4 === 1 ? 'whipR' : 'whipL', sfx: 'whoosh-short' })
  })
  return shots
}

// movement transform for a shot, given local progress 0..1 within the shot.
function moveStyle(move: Move, p: number, held: boolean): React.CSSProperties {
  const inP = clamp(p / 0.35, 0, 1)                       // entrance occupies first 35%
  const s = 1 - Math.pow(1 - inP, 3)                       // easeOut
  const drift = held ? 0 : 0                               // (kept subtle; idle handled by caller)
  switch (move) {
    case 'punchIn': return { transform: `scale(${1.4 - s * 0.4})`, opacity: inP }
    case 'zoomOut': return { transform: `scale(${0.7 + s * 0.3})`, opacity: inP }
    case 'whipL': return { transform: `translateX(${(1 - s) * 700}px)`, opacity: inP, filter: `blur(${(1 - s) * 8}px)` }
    case 'whipR': return { transform: `translateX(${-(1 - s) * 700}px)`, opacity: inP, filter: `blur(${(1 - s) * 8}px)` }
    case 'slamUp': return { transform: `translateY(${(1 - s) * 300}px) scale(${0.9 + s * 0.1})`, opacity: inP }
    case 'slamDown': return { transform: `translateY(${-(1 - s) * 300}px) scale(${0.9 + s * 0.1})`, opacity: inP }
    default: return { opacity: inP }
  }
}

export const BeatHook: React.FC<HookProps> = ({ intensity, image }) => {
  const frame = useCurrentFrame()
  const shots = buildShots(intensity, !!image)
  // absolute start frame of each shot on the beat grid
  const starts: number[] = []; let acc = 0
  for (const sh of shots) { starts.push(Math.round(acc * BEAT)); acc += sh.beats }
  const totalFrames = Math.round(acc * BEAT)

  // which shot are we in?
  let idx = 0; for (let i = 0; i < starts.length; i++) if (frame >= starts[i]) idx = i
  const sh = shots[idx]
  const shotStart = starts[idx]
  const shotLen = (shots[idx + 1] ? starts[idx + 1] : totalFrames) - shotStart
  const p = clamp((frame - shotStart) / shotLen, 0, 1)
  const held = sh.beats > 2

  // whole-frame beat flash (subtle) — a tiny brightness pop on every cut
  const cutFlash = clamp(1 - (frame - shotStart) / 4, 0, 1)

  // background: constant slow push so it NEVER sits still, plus a color shift per cut
  const bgScale = 1.05 + (frame / totalFrames) * 0.08
  const gx = 40 + Math.sin(frame * 0.03) * 20, gy = 40 + Math.cos(frame * 0.025) * 16

  return (
    <AbsoluteFill style={{ background: NAVY, overflow: 'hidden' }}>
      {/* driving music bed */}
      <Audio src={staticFile('beat-bed.wav')} volume={0.5} />
      {/* SFX: one Sequence per shot, firing its hit at the cut frame */}
      {shots.map((s, i) => (
        <Sequence key={i} from={starts[i]} durationInFrames={Math.max(1, (starts[i + 1] ?? totalFrames) - starts[i])}>
          <Audio src={staticFile(`sfx/${s.sfx}.wav`)} volume={s.sfx === 'riser' ? 0.5 : 0.7} />
        </Sequence>
      ))}

      {/* moving mesh backdrop */}
      <AbsoluteFill style={{ transform: `scale(${bgScale})` }}>
        <AbsoluteFill style={{ background: `radial-gradient(900px 900px at ${gx}% ${gy}%, ${ACC2}aa, transparent 55%)` }} />
        <AbsoluteFill style={{ background: `radial-gradient(700px 700px at ${100 - gx}% ${100 - gy}%, ${GOLD}33, transparent 55%)` }} />
      </AbsoluteFill>

      {/* optional image flash shots (high-energy) */}
      {sh.kind === 'image' && image && (
        <AbsoluteFill style={moveStyle(sh.move, p, held)}>
          <Img src={staticFile(image)} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.75) contrast(1.1)' }} />
          <AbsoluteFill style={{ background: `linear-gradient(${NAVY}55, ${NAVY}99)` }} />
        </AbsoluteFill>
      )}

      {/* word/stat shots */}
      {(sh.kind === 'word' || sh.kind === 'stat') && (
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '0 100px' }}>
          <div style={{ ...moveStyle(sh.move, p, held) }}>
            <div style={{ fontFamily: MONT, fontWeight: 900, fontSize: 190, lineHeight: 0.95, letterSpacing: '-0.01em', color: sh.color, textShadow: '0 6px 40px rgba(0,0,0,0.6)' }}>{sh.text}</div>
            {sh.sub && <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 44, letterSpacing: '0.14em', color: CREAM, marginTop: 30, opacity: clamp((p - 0.4) / 0.3, 0, 1) }}>{sh.sub.toUpperCase()}</div>}
          </div>
        </AbsoluteFill>
      )}

      {/* per-cut white flash — the visual "hit" that pairs with the impact SFX */}
      <AbsoluteFill style={{ background: '#fff', opacity: cutFlash * (intensity === 'highenergy' ? 0.16 : 0.1), pointerEvents: 'none' }} />
      {/* film-ish vignette for depth */}
      <AbsoluteFill style={{ background: 'radial-gradient(130% 130% at 50% 45%, transparent 55%, rgba(0,0,0,0.6))', pointerEvents: 'none' }} />
    </AbsoluteFill>
  )
}

// duration helpers for the compositions
export function hookFrames(intensity: HookProps['intensity'], hasImage: boolean): number {
  const shots = buildShots(intensity, hasImage); let acc = 0; for (const s of shots) acc += s.beats
  return Math.round(acc * BEAT) + 6
}
