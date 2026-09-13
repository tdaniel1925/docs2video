import React from 'react'
import {
  AbsoluteFill, Img, Audio, Sequence, OffthreadVideo, staticFile,
  useCurrentFrame, interpolate, spring, Easing,
} from 'remotion'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import vo from '../../public/restylez/vo.json'
import grid from '../../public/restylez/beatgrid.json'
import { beatLock, gridToFrames } from '../lib/audio'
import { MusicBed } from '../lib/musicbed'

/**
 * RESTYLEZ — THE BRAND FILM.
 *
 * A different job from the launch film, which runs on 25 real product
 * screenshots and is the better piece for proving the product works. This one
 * shows no interface at all: the midnight frustration, the press running, the
 * box of flyers opened on a shop counter. It sells the outcome, and it runs
 * alongside that film rather than replacing it.
 *
 * THE FOOTAGE IS GENERATED, AND THAT CARRIES ONE HARD CONSTRAINT.
 *
 * Every printed piece in these clips has gibberish on it — "Cdnsanr Pruerhe",
 * "ORL HSIRE WONAT AANS". That is the known weakness of generated video, and
 * for a company whose entire product is getting text RIGHT it is not a small
 * blemish, it is the thing a viewer would notice and hold against us.
 *
 * So the edit never lets it be read:
 *   - the worst offender (the fanned spread) is used at a hard push, so the
 *     lettering is off-frame or out of focus
 *   - the box shot cuts before the flyer turns to camera
 *   - the press shot, which has no legible text anywhere, carries the beat
 *     that would otherwise need the spread
 *   - a wash sits under every lower third, which also does the readability job
 *
 * That is not hiding a flaw. It is the same discipline as never showing a
 * competitor's logo: the frame should contain only what we can stand behind.
 */

const { fontFamily: F } = loadInter()
export const BRAND_FPS = 30
const FPS = BRAND_FPS
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const s = (sec: number) => Math.round(sec * FPS)

/* Restylez's own palette, off the logo. */
const INK = '#14161a'
const SUN = '#ffc93c'
const CREAM = '#f7f3ea'
const WHITE = '#ffffff'

const R = (n: string) => staticFile(`restylez/${n}`)
const CLIP = (n: string) => staticFile(`restylez/broll/${n}`)
const D = (vo as { durations: number[] }).durations

const ease = (frame: number, at: number, damping = 18, stiffness = 130) =>
  clamp(spring({ frame: frame - at, fps: FPS, config: { damping, stiffness, mass: 0.9 } }), 0, 1.12)

/**
 * A SHOT.
 *
 * `from` is where in the source clip to start — the useful second is rarely
 * the first. `scale` pushes in, which is how the lettering on a printed piece
 * is kept off-frame; `y` slides the framing to the same end.
 */
const Shot: React.FC<{
  src: string
  from: number
  hold: number
  scale?: number
  push?: number
  x?: number
  y?: number
  dim?: number
  /** Blur the footage. For beats that want colour and shape behind type,
      and where generated lettering must not be readable. */
  blur?: number
}> = ({ src, from, hold, scale = 1.04, push = 0.06, x = 0, y = 0, dim = 0, blur = 0 }) => {
  const frame = useCurrentFrame()
  const t = interpolate(frame, [0, Math.max(1, hold)], [0, 1], {
    extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad),
  })
  /* a short fade at each end so cuts never strobe */
  const inOut = Math.min(clamp(frame / 8, 0, 1), clamp((hold - frame) / 8, 0, 1))
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: INK }}>
      <AbsoluteFill style={{
        transform: `scale(${scale + push * t}) translate(${x}px, ${y}px)`,
        filter: blur ? `blur(${blur}px)` : undefined,
        opacity: inOut,
      }}>
        <OffthreadVideo
          src={src}
          startFrom={Math.round(from * FPS)}
          muted
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </AbsoluteFill>
      {dim > 0 && <AbsoluteFill style={{ background: `rgba(20,22,26,${dim})`, opacity: inOut }} />}
    </AbsoluteFill>
  )
}

/** The wash under the type — readability, and it covers the lower frame. */
const Foot: React.FC = () => (
  <div style={{
    position: 'absolute', left: 0, right: 0, bottom: 0, height: 460, zIndex: 20,
    background: 'linear-gradient(0deg, rgba(20,22,26,0.93) 0%, rgba(20,22,26,0.72) 48%, transparent 100%)',
  }} />
)

/** One line, at the foot. Never more than one thought on screen. */
const Line: React.FC<{ at?: number; size?: number; children: React.ReactNode }> = ({ at = 6, size = 56, children }) => {
  const frame = useCurrentFrame()
  const p = ease(frame, at)
  const k = clamp(p, 0, 1)
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 90, zIndex: 30,
      textAlign: 'center', padding: '0 140px',
      fontWeight: 900, fontSize: size, lineHeight: 1.1, letterSpacing: '-0.03em',
      color: WHITE,
      opacity: clamp(p * 1.8, 0, 1),
      transform: `translateY(${(1 - k) * 22}px)`,
      textShadow: '0 4px 30px rgba(0,0,0,0.6)',
    }}>{children}</div>
  )
}

/* ── THE BEATS ───────────────────────────────────────────────────────────── */

const Midnight: React.FC<{ hold: number }> = ({ hold }) => (
  <AbsoluteFill style={{ fontFamily: F }}>
    <Shot src={CLIP('1-midnight.mp4')} from={1.5} hold={hold} scale={1.06} push={0.05} />
    <Foot />
    <Line at={8} size={58}>Still dragging boxes around <span style={{ color: SUN }}>at midnight?</span></Line>
  </AbsoluteFill>
)

const Frustration: React.FC<{ hold: number }> = ({ hold }) => (
  <AbsoluteFill style={{ fontFamily: F }}>
    <Shot src={CLIP('2-frustration.mp4')} from={2} hold={hold} scale={1.08} push={0.05} dim={0.12} />
    <Foot />
    <Line at={6} size={54}>The fortieth version. <span style={{ color: SUN }}>Still not right.</span></Line>
  </AbsoluteFill>
)

/* THE TURN — the only beat that carries the mark. */
const Meet: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const p = ease(frame, 4, 14, 170)
  return (
    <AbsoluteFill style={{ fontFamily: F, background: INK }}>
      <Shot src={CLIP('3-flyer-lands.mp4')} from={2} hold={hold} scale={1.1} push={0.06} dim={0.42} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', zIndex: 30 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ transform: `scale(${0.88 + 0.12 * clamp(p, 0, 1)})`, opacity: clamp(p * 2, 0, 1) }}>
            <Img src={R('logo.png')} style={{ width: 820, display: 'block', filter: 'drop-shadow(0 18px 50px rgba(0,0,0,0.6))' }} />
          </div>
          <div style={{
            fontWeight: 900, fontSize: 44, color: WHITE, marginTop: 26, letterSpacing: '-0.02em',
            opacity: clamp(ease(frame, 18) * 1.8, 0, 1),
          }}>The first AI graphic designer <span style={{ color: SUN }}>in a box.</span></div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

const Speed: React.FC<{ hold: number }> = ({ hold }) => (
  <AbsoluteFill style={{ fontFamily: F }}>
    {/* the press has NO legible lettering anywhere — it carries the beat that
        would otherwise need the fanned spread */}
    <Shot src={CLIP('4-press.mp4')} from={1} hold={hold} scale={1.05} push={0.07} />
    <Foot />
    <Line at={6} size={54}>Agency quality. Agency speed. <span style={{ color: SUN }}>Not agency prices.</span></Line>
  </AbsoluteFill>
)

const TheBox: React.FC<{ hold: number }> = ({ hold }) => (
  <AbsoluteFill style={{ fontFamily: F }}>
    {/* cut before the flyer turns to camera — the lettering on it is nonsense */}
    <Shot src={CLIP('5-the-box.mp4')} from={0.2} hold={hold} scale={1.3} push={0.05} x={-220} y={40} />
    <Foot />
    <Line at={6} size={54}>Premium work, <span style={{ color: SUN }}>for your business.</span></Line>
  </AbsoluteFill>
)

const Boardroom: React.FC<{ hold: number }> = ({ hold }) => (
  <AbsoluteFill style={{ fontFamily: F }}>
    <Shot src={CLIP('6-boardroom.mp4')} from={1.5} hold={hold} scale={1.06} push={0.06} />
    <Foot />
    <Line at={6} size={52}>Whole decks from a document <span style={{ color: SUN }}>or a topic.</span></Line>
  </AbsoluteFill>
)

/* THE PRICE — the hardest fact in the film, on the shot with the least text. */
const Price: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const rows: [string, string][] = [['An agency', 'hundreds a month'], ['A freelancer', '$1,500 a deck'], ['Restylez', '$35']]
  return (
    <AbsoluteFill style={{ fontFamily: F, background: INK }}>
      {/* pushed hard so the gibberish lettering on the spread never resolves */}
      <Shot src={CLIP('7-spread.mp4')} from={5} hold={hold} scale={1.35} push={0.08} y={-40} dim={0.68} blur={16} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', zIndex: 30 }}>
        <div>
          {rows.map(([who, what], i) => {
            const p = ease(frame, 8 + i * 12)
            const last = i === rows.length - 1
            return (
              <div key={who} style={{
                display: 'flex', alignItems: 'baseline', gap: 28, marginBottom: 18,
                opacity: clamp(p * 2, 0, 1),
                transform: `translateY(${(1 - clamp(p, 0, 1)) * 18}px)`,
              }}>
                <div style={{ width: 300, textAlign: 'right', fontWeight: 700, fontSize: 40, color: last ? SUN : 'rgba(255,255,255,0.55)' }}>{who}</div>
                <div style={{
                  fontWeight: 900, fontSize: last ? 86 : 46,
                  color: last ? WHITE : 'rgba(255,255,255,0.55)',
                  letterSpacing: '-0.03em', lineHeight: 1.2,
                  textDecoration: last ? 'none' : 'line-through',
                  textDecorationColor: 'rgba(255,201,60,0.5)',
                }}>{what}</div>
              </div>
            )
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

const Close: React.FC<{ hold: number }> = () => {
  const frame = useCurrentFrame()
  const p = ease(frame, 2, 16, 150)
  const btn = ease(frame, 24, 16, 150)
  return (
    <AbsoluteFill style={{ fontFamily: F, background: CREAM }}>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', paddingBottom: 190 }}>
        <div style={{ transform: `scale(${0.9 + 0.1 * clamp(p, 0, 1)})`, opacity: clamp(p * 2, 0, 1) }}>
          <Img src={R('logo.png')} style={{ width: 760, display: 'block' }} />
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', padding: '0 0 120px' }}>
        <div style={{ textAlign: 'center', width: 1920 }}>
          <div style={{
            fontWeight: 900, fontSize: 52, color: INK, letterSpacing: '-0.03em',
            opacity: clamp(ease(frame, 12) * 1.8, 0, 1),
          }}>The premium spot for <span style={{ color: '#b8860b' }}>everything graphic design.</span></div>
          <div style={{
            display: 'inline-block', marginTop: 30,
            background: INK, color: SUN, borderRadius: 12,
            padding: '20px 52px', fontWeight: 900, fontSize: 38,
            opacity: clamp(btn * 2, 0, 1),
            transform: `scale(${0.92 + 0.08 * clamp(btn, 0, 1)})`,
          }}>restylez.app</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

/* ── THE CUT ─────────────────────────────────────────────────────────────── */

type Beat = { dur: number; el: (hold: number) => React.ReactNode; vo?: number }

const BEATS: Beat[] = [
  { dur: s(D[0] + 0.8), el: (h) => <Midnight hold={h} />, vo: 0 },
  { dur: s(2.6), el: (h) => <Frustration hold={h} /> },
  { dur: s(D[1] + 0.6), el: (h) => <Meet hold={h} />, vo: 1 },
  { dur: s(D[9] + 0.5), el: (h) => <Speed hold={h} />, vo: 9 },
  { dur: s(D[2] + 0.6), el: (h) => <TheBox hold={h} />, vo: 2 },
  { dur: s(D[6] + 0.5), el: (h) => <Boardroom hold={h} />, vo: 6 },
  { dur: s(D[8] + 0.7), el: (h) => <Price hold={h} />, vo: 8 },
  { dur: s(D[10] + 2.2), el: (h) => <Close hold={h} />, vo: 10 },
]

const rawStarts: number[] = []
{ let t = 0; for (const b of BEATS) { rawStarts.push(t); t += b.dur } }
const STARTS = beatLock(rawStarts, gridToFrames((grid as { beats: number[] }).beats, FPS), Math.round(0.2 * FPS))
export const BRAND_FRAMES = STARTS[STARTS.length - 1] + BEATS[BEATS.length - 1].dur + 6

export const RestylezBrand: React.FC = () => {
  const durs = STARTS.map((st, i) => (i + 1 < STARTS.length ? STARTS[i + 1] : BRAND_FRAMES - 6) - st)
  return (
    <AbsoluteFill style={{ background: INK }}>
      {BEATS.map((b, i) => (
        <Sequence key={i} from={STARTS[i]} durationInFrames={durs[i]}>{b.el(durs[i])}</Sequence>
      ))}
      <MusicBed src="restylez/music.mp3" musicFrames={BRAND_FRAMES + s(2)} volume={() => 0.3} />
      {BEATS.map((b, i) => b.vo === undefined ? null : (
        <Sequence key={'vo' + i} from={STARTS[i]}><Audio src={R(`vo-${b.vo + 1}.mp3`)} volume={1.0} /></Sequence>
      ))}
    </AbsoluteFill>
  )
}
