import React from 'react'
import { AbsoluteFill, Img, Audio, Sequence, staticFile, useCurrentFrame, interpolate, spring, Easing } from 'remotion'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import grid from '../public/restylez/beatgrid.json'
import vo from '../public/restylez/vo.json'
import { StreakWipe, Alive, sustained, SettleSweep, CountUp, LogoBug } from './lib/pizzazz'
import { makeMusicDuck, beatLock, gridToFrames, durationsFromStarts, type VoWindow } from './lib/audio'
import { MusicBed } from './lib/musicbed'

const { fontFamily: F } = loadInter()
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const FPS = 30
const s = (sec: number) => Math.round(sec * FPS)

/* ============================================================================
 * RESTYLEZ — launch commercial. Fast, upbeat, playful; never corporate.
 *   · LOOK: the site's flat sunflower-yellow + ink type, cream and ink panels
 *     for rhythm, blue/coral accents. Real output images only. ≤10px corners.
 *   · MOTION: every beat wrapped in <Alive>, reveals spread with sustained(),
 *     SettleSweep late in long holds, StreakWipe on every cut, beat-locked.
 *   · AUDIO: Sarah VO per beat (public/restylez/vo-N.mp3), ElevenLabs bed
 *     looped by MusicBed + ducked under VO. Canva named exactly once (beat 2).
 * ==========================================================================*/
const SUN = '#ffc93c', INK = '#14161a', BLUE = '#2e6be6', CREAM = '#f6f1e8', CORAL = '#ff6b57', VIOLET = '#7c5cff', WHITE = '#ffffff', MUTE = '#6b7080'
const R = (n: string) => staticFile(`restylez/${n}`)
const D = (vo as any).durations as number[]

// ---- shared pieces --------------------------------------------------------
const Ground: React.FC<{ bg: string; children: React.ReactNode }> = ({ bg, children }) => (
  <AbsoluteFill style={{ background: bg, fontFamily: F, overflow: 'hidden' }}>{children}</AbsoluteFill>
)
const pop = (frame: number, at: number, damping = 13) => clamp(spring({ frame: frame - at, fps: FPS, config: { damping, stiffness: 160, mass: 0.8 } }), 0, 1.2)

const Head: React.FC<{ kicker?: string; text: React.ReactNode; color?: string; kColor?: string; size?: number; at?: number; pos?: 'bottom' | 'top' | 'center'; width?: number }> =
({ kicker, text, color = INK, kColor = BLUE, size = 76, at = 4, pos = 'bottom', width = 1500 }) => {
  const frame = useCurrentFrame()
  const p = pop(frame, at)
  const y = (1 - clamp(p, 0, 1)) * 40
  const just = pos === 'bottom' ? 'flex-end' : pos === 'top' ? 'flex-start' : 'center'
  return (
    <AbsoluteFill style={{ justifyContent: just, alignItems: 'center', padding: '90px 0 96px' }}>
      <div style={{ opacity: clamp(p * 1.5, 0, 1), transform: `translateY(${y}px)`, textAlign: 'center', maxWidth: width }}>
        {kicker && <div style={{ fontWeight: 800, fontSize: 24, letterSpacing: '0.18em', textTransform: 'uppercase', color: kColor, marginBottom: 14 }}>{kicker}</div>}
        <div style={{ fontWeight: 900, fontSize: size, color, lineHeight: 1.06, letterSpacing: '-0.03em', paddingBottom: '0.06em' }}>{text}</div>
      </div>
    </AbsoluteFill>
  )
}

// a real output image, framed like a print on a table — springs in with a tilt
const Card: React.FC<{ src: string; w: number; x: number; y: number; at: number; rot?: number; z?: number; label?: string; labelColor?: string }> =
({ src, w, x, y, at, rot = 0, z = 1, label, labelColor = INK }) => {
  const frame = useCurrentFrame()
  const p = pop(frame, at, 12)
  const drift = Math.sin((frame + at) * 0.03) * 3
  return (
    <div style={{ position: 'absolute', left: x, top: y + drift, width: w, zIndex: z, opacity: clamp(p * 2, 0, 1), transform: `scale(${0.6 + 0.4 * p}) rotate(${rot * (2 - clamp(p, 0, 1))}deg)`, transformOrigin: '50% 60%' }}>
      <Img src={R(src)} style={{ width: '100%', display: 'block', borderRadius: 8, boxShadow: '0 30px 60px rgba(20,22,26,0.28), 0 4px 12px rgba(20,22,26,0.18)' }} />
      {label && <div style={{ marginTop: 12, textAlign: 'center', fontWeight: 800, fontSize: 22, color: labelColor, letterSpacing: '0.02em' }}>{label}</div>}
    </div>
  )
}

const Stamp: React.FC<{ text: string; at: number; color?: string; x?: number; y?: number; rot?: number }> = ({ text, at, color = CORAL, x = 1320, y = 150, rot = -8 }) => {
  const frame = useCurrentFrame()
  const p = clamp(spring({ frame: frame - at, fps: FPS, config: { damping: 9, stiffness: 300 } }), 0, 1.3)
  if (frame < at) return null
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: `rotate(${rot}deg) scale(${2 - p})`, opacity: clamp(p, 0, 1), border: `6px solid ${color}`, color, borderRadius: 10, padding: '8px 22px', fontWeight: 900, fontSize: 40, letterSpacing: '0.06em', textTransform: 'uppercase', background: `${WHITE}dd`, zIndex: 20 }}>{text}</div>
  )
}

// ---- BEAT 1 — the problem: a fake template editor, the drag misses ----------
const ProblemBeat: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  // cursor travels toward the text box, grabs it, box slips away, cursor overshoots
  const t = clamp(frame / (hold - 14), 0, 1)
  const cx = interpolate(t, [0, 0.35, 0.6, 1], [1500, 1080, 1010, 1180], { easing: Easing.inOut(Easing.quad) })
  const cy = interpolate(t, [0, 0.35, 0.6, 1], [900, 700, 680, 820], { easing: Easing.inOut(Easing.quad) })
  const boxDx = interpolate(t, [0.6, 1], [0, 140], { extrapolateLeft: 'clamp', easing: Easing.out(Easing.back(2)) })
  const boxDy = interpolate(t, [0.6, 1], [0, 90], { extrapolateLeft: 'clamp', easing: Easing.out(Easing.back(2)) })
  const zoom = 1 + interpolate(frame, [hold - 16, hold - 4], [0, 0.22], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  const shake = frame > hold - 14 ? Math.sin(frame * 2.3) * 4 : 0
  return (
    <Ground bg={SUN}>
      <Alive intensity={0.8}>
        <AbsoluteFill style={{ transform: `scale(${zoom}) translate(${shake}px,0)`, transformOrigin: '58% 50%' }}>
          {/* the "template" — a generic editor page */}
          <div style={{ position: 'absolute', left: 560, top: 330, width: 800, height: 700, background: WHITE, borderRadius: 10, boxShadow: '0 30px 80px rgba(20,22,26,0.25)', padding: 40 }}>
            <div style={{ height: 22, width: 300, background: '#e5e7ee', borderRadius: 6 }} />
            <div style={{ height: 300, marginTop: 30, background: '#eef0f6', borderRadius: 8 }} />
            {[420, 300, 360].map((w, i) => <div key={i} style={{ height: 16, width: w, marginTop: 22, background: '#e5e7ee', borderRadius: 6 }} />)}
            {/* the text box that will not behave */}
            <div style={{ position: 'absolute', left: 120 + boxDx, top: 470 + boxDy, width: 420, padding: '14px 18px', border: `3px dashed ${BLUE}`, borderRadius: 8, color: INK, fontWeight: 800, fontSize: 30, background: WHITE, transform: `rotate(${boxDx * 0.06}deg)` }}>
              Your Headline Here
              {[[-6, -6], [-6, 'auto'], ['auto', -6], ['auto', 'auto']].map(([l, tp], i) => <div key={i} style={{ position: 'absolute', width: 12, height: 12, background: BLUE, left: l as any, top: tp as any, right: l === 'auto' ? -6 : 'auto', bottom: tp === 'auto' ? -6 : 'auto', borderRadius: 3 }} />)}
            </div>
          </div>
          {/* cursor */}
          <svg style={{ position: 'absolute', left: cx, top: cy, width: 44, height: 52, filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.3))' }} viewBox="0 0 24 28"><path d="M3 2 L3 22 L8.5 17 L12 26 L15.5 24.5 L12 16 L19 16 Z" fill={INK} stroke={WHITE} strokeWidth="1.5" /></svg>
        </AbsoluteFill>
      </Alive>
      <Head pos="top" size={74} at={2} text={<>Still dragging boxes around<br /><span style={{ color: BLUE }}>at midnight?</span></>} />
      <SettleSweep color={WHITE} hold={hold} />
    </Ground>
  )
}

// ---- BEAT 2 — logo slam + "Never open Canva again." ------------------------
const SlamBeat: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const p = clamp(spring({ frame: frame - 2, fps: FPS, config: { damping: 11, stiffness: 240, mass: 0.9 } }), 0, 1)
  const ring = clamp((frame - 6) / 22, 0, 1)
  const bursts = Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * Math.PI * 2; const d = ring * (380 + (i % 3) * 90); return <div key={i} style={{ position: 'absolute', left: 960 + Math.cos(a) * d, top: 500 + Math.sin(a) * d, width: 18, height: 18, borderRadius: 4, background: [SUN, CORAL, BLUE, WHITE][i % 4], opacity: 1 - ring, transform: `rotate(${ring * 300}deg)` }} /> })
  return (
    <Ground bg={INK}>
      <Alive intensity={0.6}>
        {frame > 6 && bursts}
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', paddingBottom: 120 }}>
          <div style={{ transform: `scale(${3 - 2 * p})`, opacity: clamp(p * 3, 0, 1) }}>
            <Img src={R('logo.png')} style={{ width: 900, display: 'block', filter: 'drop-shadow(0 20px 50px rgba(0,0,0,0.6))' }} />
          </div>
        </AbsoluteFill>
      </Alive>
      {/* the three phrases land one at a time across the long hold */}
      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', padding: '0 0 96px' }}>
        <div style={{ textAlign: 'center', maxWidth: 1500 }}>
          <div style={{ fontWeight: 800, fontSize: 24, letterSpacing: '0.18em', textTransform: 'uppercase', color: SUN, marginBottom: 14, opacity: clamp(pop(frame, 14) * 1.5, 0, 1) }}>The first AI graphic designer in a box</div>
          <div style={{ fontWeight: 900, fontSize: 62, color: WHITE, lineHeight: 1.06, letterSpacing: '-0.03em', paddingBottom: '0.06em' }}>
            {['Agency quality.', 'Agency speed.', 'Not agency prices.'].map((w, i) => {
              const at = sustained(i, 3, Math.round(hold * 0.75), 40)
              const q = pop(frame, at, 11)
              return <span key={w} style={{ display: 'inline-block', margin: '0 12px', color: i === 2 ? SUN : WHITE, opacity: clamp(q * 2, 0, 1), transform: `translateY(${(1 - clamp(q, 0, 1)) * 30}px) scale(${0.9 + 0.1 * clamp(q, 0, 1)})` }}>{w}</span>
            })}
          </div>
        </div>
      </AbsoluteFill>
      <SettleSweep color={SUN} hold={hold} />
    </Ground>
  )
}

// ---- BEAT 3 — premium work: four real pieces land like prints on a table ----
const PremiumBeat: React.FC<{ hold: number }> = ({ hold }) => {
  const pieces = [
    { src: 'gym-after.jpg', w: 330, x: 120, y: 90, rot: -4, label: 'Gym flyer' },
    { src: 'jordyn-slide-2.jpg', w: 560, x: 470, y: 130, rot: 2, label: 'Investor deck' },
    { src: 'supper-gold.jpg', w: 300, x: 1060, y: 80, rot: -2, label: 'Diner, restyled' },
    { src: 'salsa-photo.jpg', w: 300, x: 1400, y: 140, rot: 3, label: 'Gig poster + photo' },
  ]
  return (
    <Ground bg={CREAM}>
      <Alive>
        {pieces.map((o, i) => <Card key={o.src} {...o} at={sustained(i, pieces.length, Math.round(hold * 0.7), 4)} />)}
      </Alive>
      <Head pos="bottom" at={6} size={60} kicker="Premium work" text={<>For your business — <span style={{ color: BLUE }}>or your clients.</span></>} />
      <SettleSweep color={WHITE} hold={hold} />
    </Ground>
  )
}

// ---- BEAT 4 — one design → every format --------------------------------------
const FanBeat: React.FC<{ hold: number }> = ({ hold }) => {
  const outs = [
    { src: 'jordyn-slide-1.jpg', w: 400, x: 700, y: 100, rot: -2, label: 'Slide' },
    { src: 'jordyn-slide-2.jpg', w: 400, x: 1130, y: 90, rot: 2, label: 'Chart slide' },
    { src: 'jordyn-card.jpg', w: 280, x: 1560, y: 120, rot: -3, label: 'Business card' },
    { src: 'jordyn-social.jpg', w: 250, x: 700, y: 420, rot: 3, label: 'Post' },
    { src: 'jordyn-postcard.jpg', w: 400, x: 990, y: 440, rot: -2, label: 'Postcard' },
    { src: 'jordyn-slide-3.jpg', w: 400, x: 1430, y: 430, rot: 3, label: 'Numbers slide' },
  ]
  return (
    <Ground bg={CREAM}>
      <Alive>
        <Card src="jordyn-flyer.jpg" w={330} x={150} y={150} at={2} rot={-4} z={5} label="Your design" labelColor={BLUE} />
        <div style={{ position: 'absolute', left: 560, top: 380, fontSize: 70, fontWeight: 900, color: BLUE, opacity: 0.9 }}>→</div>
        {outs.map((o, i) => <Card key={o.src} {...o} at={sustained(i, outs.length, hold, 14)} />)}
      </Alive>
      <Head pos="bottom" at={6} size={56} text={<>Show it one design. <span style={{ color: BLUE }}>Get every format back</span> in that exact look.</>} />
      <SettleSweep color={WHITE} hold={hold} />
    </Ground>
  )
}

// ---- BEATS 4 + 5 — before → after (words change / look changes) -----------
const BeforeAfter: React.FC<{ hold: number; after: string; before?: string; bg: string; kicker: string; head: React.ReactNode; tint: string }> = ({ hold, after, before = 'club-before.jpg', bg, kicker, head, tint }) => {
  const frame = useCurrentFrame()
  const at = Math.round(hold * 0.34)
  const wipe = clamp((frame - at) / 20, 0, 1)
  const ease = Easing.inOut(Easing.cubic)(wipe)
  const x = 1120, y = 120, w = 470
  return (
    <Ground bg={bg}>
      <Alive>
        <Card src={before} w={w} x={330} y={y} at={2} rot={-2} label="Before" labelColor={MUTE} />
        <div style={{ position: 'absolute', left: 880, top: 420, fontSize: 90, fontWeight: 900, color: tint, transform: `scale(${pop(frame, 10)})` }}>→</div>
        {/* after: the before flyer sits there, then the new one wipes over it top→bottom */}
        <div style={{ position: 'absolute', left: x, top: y + Math.sin(frame * 0.03) * 3, width: w, opacity: clamp(pop(frame, 6) * 2, 0, 1) }}>
          <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', boxShadow: '0 30px 60px rgba(20,22,26,0.28)' }}>
            <Img src={R(before)} style={{ width: '100%', display: 'block' }} />
            <div style={{ position: 'absolute', inset: 0, clipPath: `inset(0 0 ${(1 - ease) * 100}% 0)` }}>
              <Img src={R(after)} style={{ width: '100%', display: 'block' }} />
            </div>
            {wipe > 0 && wipe < 1 && <div style={{ position: 'absolute', left: 0, right: 0, top: `${ease * 100}%`, height: 6, background: tint, boxShadow: `0 0 24px ${tint}` }} />}
          </div>
          <div style={{ marginTop: 12, textAlign: 'center', fontWeight: 800, fontSize: 22, color: tint }}>After</div>
        </div>
      </Alive>
      <Head pos="bottom" at={4} size={56} kicker={kicker} kColor={tint} text={head} />
      <SettleSweep color={WHITE} hold={hold} />
    </Ground>
  )
}

// ---- BEAT 6 — decks: 3 references → 3 decks, chart bars with $ counts ------
const DeckBeat: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const rows = [['jordyn-flyer.jpg', 'jordyn-slide-1.jpg', 'jordyn-slide-2.jpg', 'jordyn-slide-3.jpg'], ['reference-2.png', 'ref2-slide-1.jpg', 'ref2-slide-2.jpg', 'ref2-slide-3.jpg'], ['reference-3.png', 'ref3-slide-1.jpg', 'ref3-slide-2.jpg', 'ref3-slide-3.jpg']]
  const vals = [120000, 180000, 260000, 410000]
  const chartAt = Math.round(hold * 0.56)
  const chartIn = clamp(spring({ frame: frame - chartAt, fps: FPS, config: { damping: 14, stiffness: 150 } }), 0, 1)
  return (
    <Ground bg={INK}>
      <Alive intensity={0.7}>
        {rows.map((r, ri) => r.map((src, ci) => {
          const at = sustained(ri * 4 + ci, 12, Math.round(hold * 0.55), 4)
          const p = pop(frame, at, 14)
          const isRef = ci === 0
          const w = isRef ? 200 : 285, h = isRef ? 200 : 185
          const x = 120 + (isRef ? 0 : 270 + (ci - 1) * 310), y = 80 + ri * 230
          const shift = chartIn
          return (
            <div key={src} style={{ position: 'absolute', left: x - shift * 80, top: y + shift * 40, width: w, height: h, opacity: clamp(p * 2, 0, 1) * (1 - shift * 0.55), transform: `scale(${0.7 + 0.3 * p}) scale(${1 - shift * 0.12})`, borderRadius: 8, overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', outline: isRef ? `4px solid ${SUN}` : 'none' }}>
              <Img src={R(src)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              {isRef && <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: SUN, color: INK, fontWeight: 800, fontSize: 16, textAlign: 'center', padding: '4px 0' }}>reference</div>}
              {!isRef && ci === 1 && <div style={{ position: 'absolute', left: 8, top: 8, background: `${INK}cc`, color: WHITE, fontWeight: 700, fontSize: 15, padding: '3px 8px', borderRadius: 6 }}>→ deck</div>}
            </div>
          )
        }))}
        {/* CHART PANEL — code-drawn, exact numbers */}
        <div style={{ position: 'absolute', left: 1120, top: 140, width: 680, height: 560, background: WHITE, borderRadius: 10, padding: '28px 36px', boxShadow: '0 40px 80px rgba(0,0,0,0.5)', opacity: chartIn, transform: `translateY(${(1 - chartIn) * 60}px) scale(${0.9 + 0.1 * chartIn})` }}>
          <div style={{ fontWeight: 900, fontSize: 30, color: INK }}>Revenue by Quarter</div>
          <div style={{ fontWeight: 600, fontSize: 18, color: MUTE, marginTop: 2 }}>charts stay charts · numbers stay exact</div>
          <div style={{ position: 'absolute', left: 36, right: 36, bottom: 60, top: 120, display: 'flex', alignItems: 'flex-end', gap: 34 }}>
            {vals.map((v, i) => {
              const at = chartAt + 8 + i * 9
              const g = clamp((frame - at) / 18, 0, 1)
              const e = Easing.out(Easing.cubic)(g)
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                  <div style={{ fontWeight: 800, fontSize: 24, color: INK, marginBottom: 8, opacity: g }}><CountUp to={v} prefix="$" decimals={0} startAt={at} dur={18} /></div>
                  <div style={{ width: '100%', height: `${(v / 410000) * 100 * e}%`, background: `linear-gradient(180deg, ${BLUE}, ${VIOLET})`, borderRadius: 6 }} />
                  <div style={{ fontWeight: 700, fontSize: 20, color: MUTE, marginTop: 10 }}>Q{i + 1}</div>
                </div>
              )
            })}
          </div>
        </div>
      </Alive>
      <Head pos="bottom" at={4} size={54} color={WHITE} kicker="Whole decks" kColor={SUN} text={<>From a document or a topic — <span style={{ color: SUN }}>charts stay charts, numbers stay exact.</span></>} />
      <SettleSweep color={SUN} hold={hold} />
    </Ground>
  )
}

// ---- BEAT 7 — PowerPoint stays editable; a multi-slide pack → the 6 you need
const PptxBeat: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const swaps: [string, string, number][] = [['Client', 'Acme Corp', 10], ['Date', 'October 4', 22], ['Revenue', '$410,000', 34]]
  const packAt = Math.round(hold * 0.5)
  const cols = 30, rowsN = 15
  const keep = new Set([47, 121, 188, 236, 302, 371])
  const keptIdx = [...keep]
  return (
    <Ground bg={CREAM}>
      <Alive>
        {/* the editable slide */}
        <div style={{ position: 'absolute', left: 110, top: 120, width: 760, height: 430, background: WHITE, borderRadius: 10, boxShadow: '0 30px 60px rgba(20,22,26,0.22)', padding: 36, opacity: clamp(pop(frame, 2) * 2, 0, 1), transform: `scale(${0.8 + 0.2 * pop(frame, 2)})` }}>
          <div style={{ fontWeight: 900, fontSize: 34, color: INK }}>Investor Update</div>
          {swaps.map(([k, v, at], i) => {
            const p = clamp((frame - at) / 8, 0, 1)
            return (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 26, fontSize: 26 }}>
                <div style={{ width: 130, color: MUTE, fontWeight: 600 }}>{k}</div>
                <div style={{ position: 'relative', padding: '8px 14px', border: `3px dashed ${p > 0 && p < 1 ? BLUE : '#d8dbe6'}`, borderRadius: 8, fontWeight: 800, color: INK, minWidth: 320 }}>
                  <span style={{ opacity: 1 - p, position: p >= 1 ? 'absolute' : 'relative' }}>{['Client name', 'Date', '$0'][i]}</span>
                  <span style={{ opacity: p, position: p <= 0 ? 'absolute' : 'relative', color: BLUE }}>{v}</span>
                </div>
              </div>
            )
          })}
        </div>
        <Stamp text="Still editable" at={44} x={560} y={470} rot={-10} />
        {/* the multi-slide pack collapsing to 6 */}
        <div style={{ position: 'absolute', left: 1000, top: 110, width: 800, height: 450, opacity: clamp((frame - packAt + 10) / 10, 0, 1) }}>
          {Array.from({ length: cols * rowsN }, (_, i) => {
            const c = i % cols, r = Math.floor(i / cols)
            const isKeep = keep.has(i)
            const gone = clamp((frame - (packAt + 12 + ((c * 7 + r * 13) % 17))) / 10, 0, 1)
            const k = isKeep ? clamp((frame - (packAt + 34)) / 14, 0, 1) : 0
            const idx = keptIdx.indexOf(i)
            const tx = isKeep ? (idx * 130 + 20) - c * 26.6 : 0, ty = isKeep ? 360 - r * 30 : 0
            return <div key={i} style={{ position: 'absolute', left: c * 26.6, top: r * 30, width: 22, height: 24, borderRadius: 3, background: isKeep ? BLUE : '#c9cdda', opacity: isKeep ? 1 : 1 - gone, transform: isKeep ? `translate(${tx * k}px, ${ty * k}px) scale(${1 + 4 * k})` : `scale(${1 - gone})`, transformOrigin: '0 0' }} />
          })}
          <div style={{ position: 'absolute', left: 0, top: -40, fontWeight: 800, fontSize: 24, color: MUTE }}>
            <span style={{ opacity: 1 - clamp((frame - (packAt + 40)) / 8, 0, 1) }}>your whole template pack</span>
            <span style={{ position: 'absolute', left: 0, whiteSpace: 'nowrap', color: BLUE, opacity: clamp((frame - (packAt + 40)) / 8, 0, 1) }}>the 6 you need</span>
          </div>
        </div>
      </Alive>
      <Head pos="bottom" at={4} size={54} kicker="PowerPoint Editor & Customizer" text={<>Real, editable <span style={{ color: BLUE }}>.pptx</span>. Hand it a template pack — it picks the slides you need.</>} />
      <SettleSweep color={WHITE} hold={hold} />
    </Ground>
  )
}

// ---- BEAT 8 — every size, print-ready --------------------------------------
const SizesBeat: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const sizes = [['Letter', '8.5 × 11', 170, 220], ['Tabloid', '11 × 17', 160, 247], ['Business card', '3.5 × 2', 210, 120], ['Postcard', '6 × 4', 240, 160], ['Yard sign', '24 × 18', 260, 195], ['Banner', '72 × 24', 330, 110]] as const
  return (
    <Ground bg={SUN}>
      <Alive>
        <div style={{ position: 'absolute', left: 120, top: 250, width: 1680, height: 420, display: 'flex', flexWrap: 'wrap', gap: 32, alignItems: 'center', justifyContent: 'center' }}>
          {sizes.map(([n, d, w, h], i) => {
            const at = sustained(i, sizes.length, Math.round(hold * 0.8), 2)
            const p = pop(frame, at, 10)
            return (
              <div key={n} style={{ width: w, height: h, background: WHITE, borderRadius: 8, boxShadow: '0 20px 40px rgba(20,22,26,0.2)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', transform: `scale(${clamp(p, 0, 1.15)}) rotate(${(1 - clamp(p, 0, 1)) * 12}deg)`, opacity: clamp(p * 2, 0, 1) }}>
                <div style={{ fontWeight: 900, fontSize: 26, color: INK }}>{n}</div>
                <div style={{ fontWeight: 700, fontSize: 20, color: BLUE }}>{d} in</div>
              </div>
            )
          })}
        </div>
        <Stamp text="300 DPI · full bleed" at={Math.round(hold * 0.4)} x={1180} y={560} rot={-7} color={INK} />
        {/* coming soon: the next formats slide up late in the beat */}
        {['Tri-fold', 'Brochure', 'Booklet', 'Magazine'].map((n, i) => {
          const at = Math.round(hold * 0.55) + i * 6
          const p = pop(frame, at, 11)
          return (
            <div key={n} style={{ position: 'absolute', left: 150 + i * 420, top: 700 + (1 - clamp(p, 0, 1)) * 200, width: 380, background: INK, color: SUN, borderRadius: 10, padding: '16px 22px', boxShadow: '0 20px 40px rgba(20,22,26,0.3)', opacity: clamp(p * 2, 0, 1), display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 900, fontSize: 30 }}>{n}</span><span style={{ fontWeight: 800, fontSize: 14, letterSpacing: '0.12em', textTransform: 'uppercase', color: CORAL }}>Coming soon</span>
            </div>
          )
        })}
      </Alive>
      <Head pos="top" at={4} size={58} text={<>Every size, print-ready — <span style={{ color: BLUE }}>and more formats on the way.</span></>} />
      <SettleSweep color={WHITE} hold={hold} />
    </Ground>
  )
}

// ---- BEAT 9 — the money: agency / freelancer / Canva tags fall, $35 slams in ----
const PriceTagBeat: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const tags = [
    { t: 'Design agency', p: '$700', per: 'a month', x: 260, at: 6, rot: -4 },
    { t: 'Freelancer', p: '$1,500', per: 'one deck', x: 760, at: 18, rot: 0 },
    { t: 'Canva', p: '$18', per: 'a month + your weekend', x: 1260, at: 30, rot: 4 },
  ]
  const slamAt = Math.round(hold * 0.52)
  const slam = clamp(spring({ frame: frame - slamAt, fps: FPS, config: { damping: 10, stiffness: 260, mass: 1 } }), 0, 1)
  const knock = clamp((frame - slamAt - 2) / 16, 0, 1)
  const binAt = slamAt + 14
  const drop = clamp((frame - binAt) / 18, 0, 1)
  return (
    <Ground bg={INK}>
      <Alive intensity={0.6}>
        {tags.map((g, i) => {
          const p = pop(frame, g.at, 9)
          // all three get swept off-screen by the slam — Canva last, gently
          const isCanva = i === 2
          const fly = isCanva ? 0 : knock
          const dy = isCanva ? -drop * 900 : -fly * 900
          const dx = isCanva ? drop * 700 : (i === 0 ? -1 : 1) * fly * 700
          const rot = g.rot * (2 - clamp(p, 0, 1)) + (isCanva ? drop * 160 : fly * (i === 0 ? -160 : 160))
          const sc = 1
          return (
            <div key={g.t} style={{ position: 'absolute', left: g.x + dx, top: 300 - (1 - clamp(p, 0, 1)) * 500 + dy, width: 400, background: WHITE, borderRadius: 10, padding: '22px 26px', boxShadow: '0 30px 60px rgba(0,0,0,0.55)', transform: `rotate(${rot}deg) scale(${sc})`, opacity: clamp(p * 2, 0, 1) * (isCanva ? 1 - drop * 0.3 : 1) }}>
              <div style={{ fontWeight: 800, fontSize: 22, color: MUTE }}>{g.t}</div>
              <div style={{ fontWeight: 900, fontSize: 84, color: INK, lineHeight: 1, letterSpacing: '-0.03em', marginTop: 4 }}>{g.p}</div>
              <div style={{ fontWeight: 700, fontSize: 20, color: CORAL, marginTop: 6 }}>{g.per}</div>
            </div>
          )
        })}
        {/* the slam */}
        <div style={{ position: 'absolute', left: 410, top: 250, width: 1100, background: SUN, borderRadius: 10, padding: '30px 40px', textAlign: 'center', boxShadow: '0 50px 100px rgba(0,0,0,0.6)', transform: `scale(${3 - 2 * slam}) rotate(${(1 - slam) * -8 - 2}deg)`, opacity: clamp(slam * 3, 0, 1), transformOrigin: '50% 50%' }}>
          <div style={{ fontWeight: 800, fontSize: 26, color: INK, opacity: 0.75 }}>Restylez</div>
          <div style={{ display: 'flex', gap: 90, alignItems: 'flex-end', justifyContent: 'center', marginTop: 4 }}>
            <div><div style={{ fontWeight: 900, fontSize: 150, color: INK, lineHeight: 1, letterSpacing: '-0.04em' }}>$35</div><div style={{ fontWeight: 800, fontSize: 30, color: INK }}>a whole deck</div></div>
            <div><div style={{ fontWeight: 900, fontSize: 150, color: INK, lineHeight: 1, letterSpacing: '-0.04em' }}>$10</div><div style={{ fontWeight: 800, fontSize: 30, color: INK }}>a flyer</div></div>
          </div>
        </div>
        <Stamp text="Bye, Canva" at={binAt + 12} x={1160} y={600} rot={-8} color={CORAL} />
      </Alive>
      <Head pos="bottom" at={4} size={56} color={WHITE} kicker="Prices you can see" kColor={SUN} text={<>Agency quality. <span style={{ color: SUN }}>Not agency prices.</span></>} />
      <SettleSweep color={SUN} hold={hold} />
    </Ground>
  )
}

// ---- BEAT 11 — CTA ---------------------------------------------------------
const CtaBeat: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const p = pop(frame, 2, 12)
  const fade = interpolate(frame, [hold - 14, hold - 2], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <Ground bg={SUN}>
      <Alive intensity={0.6}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', paddingBottom: 200, opacity: fade }}>
          <div style={{ transform: `scale(${0.6 + 0.4 * p})`, opacity: clamp(p * 2, 0, 1) }}>
            <Img src={R('logo.png')} style={{ width: 820, display: 'block', filter: 'drop-shadow(0 20px 40px rgba(20,22,26,0.25))' }} />
          </div>
        </AbsoluteFill>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 96, textAlign: 'center', opacity: fade }}>
          <div style={{ fontWeight: 900, fontSize: 70, color: INK, letterSpacing: '-0.03em', transform: `translateY(${(1 - pop(frame, 12)) * 30}px)`, opacity: clamp(pop(frame, 12) * 2, 0, 1) }}>Everything graphic design. One place.</div>
          <div style={{ marginTop: 22, display: 'inline-block', background: INK, color: SUN, fontWeight: 800, fontSize: 34, padding: '14px 36px', borderRadius: 10, transform: `scale(${pop(frame, 22)})` }}>restylez.app</div>
        </div>
      </Alive>
    </Ground>
  )
}

// ---- timeline --------------------------------------------------------------
type Beat = { dur: number; el: (hold: number) => React.ReactNode; impact?: boolean }
const BEATS: Beat[] = [
  { dur: s(D[0] + 0.9), el: (h) => <ProblemBeat hold={h} /> },
  { dur: s(D[1] + 0.6), el: (h) => <SlamBeat hold={h} />, impact: true },
  { dur: s(D[2] + 0.4), el: (h) => <PremiumBeat hold={h} /> },
  { dur: s(D[3] + 0.3), el: (h) => <FanBeat hold={h} /> },
  { dur: s(D[4] + 0.9), el: (h) => <BeforeAfter hold={h} after="club-after.jpg" bg={SUN} tint={BLUE} kicker="Same style, different content" head={<>New night, new words — <span style={{ color: BLUE }}>nothing else moves.</span></>} /> },
  { dur: s(D[5] + 0.9), el: (h) => <BeforeAfter hold={h} before="salsa-before.jpg" after="salsa-restyle.jpg" bg={CREAM} tint={CORAL} kicker="Same content, different style" head={<>Keep your words, <span style={{ color: CORAL }}>borrow a whole new look.</span></>} /> },
  { dur: s(D[6] + 0.3), el: (h) => <DeckBeat hold={h} /> },
  { dur: s(D[7] + 0.3), el: (h) => <PptxBeat hold={h} /> },
  { dur: s(D[8] + 0.4), el: (h) => <PriceTagBeat hold={h} />, impact: true },
  { dur: s(D[9] + 0.4), el: (h) => <SizesBeat hold={h} /> },
  { dur: s(D[10] + 1.6), el: (h) => <CtaBeat hold={h} />, impact: true },
]
const rawStarts: number[] = []; { let t = 0; for (const b of BEATS) { rawStarts.push(t); t += b.dur } }
const STARTS = beatLock(rawStarts, gridToFrames((grid as any).beats, FPS), Math.round(0.2 * FPS))
export const RESTYLEZ_FRAMES = STARTS[STARTS.length - 1] + BEATS[BEATS.length - 1].dur + 6
export const RESTYLEZ_FPS = FPS
const MUSIC_FRAMES = Math.round(76.0 * FPS)

export const RestylezLaunch: React.FC = () => {
  const starts = STARTS
  const durs = durationsFromStarts(starts, RESTYLEZ_FRAMES - 6)
  const voWin: VoWindow[] = BEATS.map((_, i) => ({ start: starts[i], end: starts[i] + s(D[i]) }))
  const musicDuck = makeMusicDuck(voWin, RESTYLEZ_FRAMES, { loud: 0.34, duck: 0.12, ramp: 14, fadeInEnd: 6 })
  return (
    <AbsoluteFill style={{ background: SUN }}>
      {BEATS.map((b, i) => (
        <Sequence key={i} from={starts[i]} durationInFrames={durs[i] + 6}>
          {b.el(durs[i])}
          {i !== 1 && i !== 10 && <LogoBug src="restylez/logo.png" width={170} opacity={0.95} />}
          {i > 0 && <StreakWipe color={i % 2 ? WHITE : SUN} dir={i % 2 ? 1 : -1} dur={10} />}
        </Sequence>
      ))}
      <MusicBed src="restylez/music.mp3" musicFrames={MUSIC_FRAMES} volume={musicDuck} />
      {BEATS.map((_, i) => (
        <Sequence key={'vo' + i} from={starts[i]}><Audio src={staticFile(`restylez/vo-${i + 1}.mp3`)} volume={1.0} /></Sequence>
      ))}
      {starts.slice(1).map((st, i) => (
        <Sequence key={'w' + i} from={st - 3} durationInFrames={16}><Audio src={staticFile('sfx/whoosh-short.wav')} volume={0.22} /></Sequence>
      ))}
      {BEATS.map((b, i) => b.impact ? <Sequence key={'imp' + i} from={starts[i]} durationInFrames={30}><Audio src={staticFile('sfx/impact.wav')} volume={0.4} /></Sequence> : null)}
    </AbsoluteFill>
  )
}
