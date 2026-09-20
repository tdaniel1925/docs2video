import React from 'react'
import { AbsoluteFill, Img, Sequence, useCurrentFrame, interpolate, spring, Easing } from 'remotion'
import { staticFile } from '../lib/asset'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import vo from '../../public/showcase/rzmake/vo.json'
import grid from '../../public/showcase/rzmake/beatgrid.json'
import boxes from '../../public/showcase/rzmake/boxes.json'
import { StreakWipe, Alive, SettleSweep, LogoBug } from '../lib/pizzazz'
import { FPS, s, clamp, pop, timeline, AudioBed, type BeatSpec } from './common'

/* ============================================================================
 * RESTYLEZ — "How to remake a design" explainer. House style, REAL screens:
 *   full-page captures of the live app (scripts/rz-make-capture.mjs) shown in
 *   a browser frame that scrolls, a cursor that travels to the real buttons
 *   (positions from boxes.json), punch-zooms on the moment, stamps + headlines.
 * ==========================================================================*/
const { fontFamily: F } = loadInter()
const SUN = '#ffc93c', INK = '#14161a', BLUE = '#2e6be6', CREAM = '#f6f1e8', CORAL = '#ff6b57', WHITE = '#ffffff', MUTE = '#6b7080'
const A = (n: string) => staticFile(`showcase/rzmake/${n}`)
const D = (vo as any).durations as number[]
type Box = { x: number; y: number; w: number; h: number }
const B = boxes as any as Record<string, Box | number>
const bx = (k: string): Box => (B[k] as Box) || { x: 960, y: 540, w: 10, h: 10 }

// browser frame geometry
const FX = 160, FY = 140, FW = 1600, CHROME = 44, VIEW = 816
const SC = FW / 1920
const pageH = (shot: string) => (B['page_' + shot] as number) || 2400
const scrollFor = (shot: string, box: Box, bias = 0) => clamp(box.y + box.h / 2 - (VIEW / SC) / 2 + bias, 0, Math.max(0, pageH(shot) - VIEW / SC))
const toScreen = (px: number, py: number, scrollY: number) => ({ x: FX + px * SC, y: FY + CHROME + (py - scrollY) * SC })

const Ground: React.FC<{ bg: string; children: React.ReactNode }> = ({ bg, children }) => <AbsoluteFill style={{ background: bg, fontFamily: F, overflow: 'hidden' }}>{children}</AbsoluteFill>
const Head: React.FC<{ kicker?: string; text: React.ReactNode; color?: string; kColor?: string; size?: number; at?: number; pos?: 'bottom' | 'top' }> = ({ kicker, text, color = INK, kColor = BLUE, size = 54, at = 4, pos = 'top' }) => {
  const frame = useCurrentFrame(); const p = pop(frame, at)
  return (
    <AbsoluteFill style={{ justifyContent: pos === 'bottom' ? 'flex-end' : 'flex-start', alignItems: 'center', padding: '34px 0 30px' }}>
      <div style={{ opacity: clamp(p * 1.5, 0, 1), transform: `translateY(${(1 - clamp(p, 0, 1)) * 30}px)`, textAlign: 'center', maxWidth: 1600 }}>
        {kicker && <div style={{ fontWeight: 800, fontSize: 22, letterSpacing: '0.18em', textTransform: 'uppercase', color: kColor, marginBottom: 6 }}>{kicker}</div>}
        <div style={{ fontWeight: 900, fontSize: size, color, lineHeight: 1.06, letterSpacing: '-0.03em', paddingBottom: '0.06em' }}>{text}</div>
      </div>
    </AbsoluteFill>
  )
}
const Stamp: React.FC<{ text: string; at: number; color?: string; x?: number; y?: number; rot?: number; size?: number }> = ({ text, at, color = CORAL, x = 1320, y = 150, rot = -8, size = 34 }) => {
  const frame = useCurrentFrame(); const p = clamp(spring({ frame: frame - at, fps: FPS, config: { damping: 9, stiffness: 300 } }), 0, 1.3)
  if (frame < at) return null
  return <div style={{ position: 'absolute', left: x, top: y, transform: `rotate(${rot}deg) scale(${2 - p})`, opacity: clamp(p, 0, 1), border: `6px solid ${color}`, color, borderRadius: 10, padding: '8px 22px', fontWeight: 900, fontSize: size, letterSpacing: '0.06em', textTransform: 'uppercase', background: `${WHITE}e6`, zIndex: 30, whiteSpace: 'nowrap' }}>{text}</div>
}
const Cursor: React.FC<{ x: number; y: number; click?: boolean }> = ({ x, y, click }) => (
  <div style={{ position: 'absolute', left: x - 6, top: y - 4, zIndex: 40, transform: `scale(${click ? 0.85 : 1})`, transformOrigin: '6px 4px' }}>
    {click && <div style={{ position: 'absolute', left: -22, top: -24, width: 56, height: 56, borderRadius: 28, border: `4px solid ${BLUE}`, opacity: 0.6 }} />}
    <svg style={{ width: 40, height: 48, filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.35))' }} viewBox="0 0 24 28"><path d="M3 2 L3 22 L8.5 17 L12 26 L15.5 24.5 L12 16 L19 16 Z" fill={INK} stroke={WHITE} strokeWidth="1.5" /></svg>
  </div>
)
/** The browser frame showing a full-page capture, scrolled; optional punch zoom around a page point. */
const Browser: React.FC<{ shot: string; scrollY: number; at?: number; zoom?: number; zoomAt?: { x: number; y: number }; url?: string; children?: React.ReactNode; fade?: string; fadeP?: number; fadeScroll?: number }> =
({ shot, scrollY, at = 2, zoom = 1, zoomAt, url = 'restylez.app/make', children, fade, fadeP = 0, fadeScroll }) => {
  const frame = useCurrentFrame(); const p = pop(frame, at, 14)
  const origin = zoomAt ? toScreen(zoomAt.x, zoomAt.y, scrollY) : { x: 960, y: 560 }
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transform: `scale(${zoom})`, transformOrigin: `${origin.x}px ${origin.y}px` }}>
      <div style={{ position: 'absolute', left: FX, top: FY, width: FW, height: CHROME + VIEW, borderRadius: 10, overflow: 'hidden', background: WHITE, boxShadow: '0 40px 90px rgba(20,22,26,0.28)', opacity: clamp(p * 2, 0, 1), transform: `translateY(${(1 - clamp(p, 0, 1)) * 60}px) scale(${0.96 + 0.04 * clamp(p, 0, 1)})` }}>
        <div style={{ height: CHROME, background: '#eef0f5', display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', borderBottom: '1px solid #dde0e8' }}>
          {['#ff5f57', '#febc2e', '#28c840'].map((c) => <div key={c} style={{ width: 12, height: 12, borderRadius: 6, background: c }} />)}
          <div style={{ marginLeft: 16, flex: 1, height: 26, borderRadius: 6, background: WHITE, fontSize: 14, fontWeight: 600, color: MUTE, display: 'flex', alignItems: 'center', padding: '0 12px' }}>{url}</div>
        </div>
        <div style={{ position: 'absolute', left: 0, top: CHROME, width: FW, height: VIEW, overflow: 'hidden' }}>
          <Img src={A(shot + '.png')} style={{ position: 'absolute', left: 0, top: -scrollY * SC, width: FW, display: 'block' }} />
          {fade && <Img src={A(fade + '.png')} style={{ position: 'absolute', left: 0, top: -(fadeScroll ?? scrollY) * SC, width: FW, display: 'block', opacity: fadeP }} />}
        </div>
      </div>
      {children}
    </div>
  )
}
const ease = Easing.inOut(Easing.cubic)
const travel = (frame: number, from: number, to: number, a: { x: number; y: number }, b: { x: number; y: number }) => { const t = ease(clamp((frame - from) / Math.max(1, to - from), 0, 1)); return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t } }

// ---- BEAT 1 — intro ---------------------------------------------------------------
const IntroBeat: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const drop = bx('drop'); const sy = interpolate(frame, [10, hold], [0, scrollFor('1-empty', drop, -120)], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease })
  return (
    <Ground bg={SUN}>
      <Alive intensity={0.6}>
        <Browser shot="1-empty" scrollY={sy} at={2}>
          <Cursor {...travel(frame, 20, hold, { x: 1500, y: 980 }, toScreen(drop.x + drop.w / 2, drop.y + drop.h / 2, sy))} />
        </Browser>
        <Stamp text="About a minute" at={24} x={1330} y={905} rot={-6} color={INK} />
      </Alive>
      <Head at={2} kicker="Template Remaker" text={<>Remake any design — <span style={{ color: BLUE }}>step by step.</span></>} />
      <SettleSweep color={WHITE} hold={hold} />
    </Ground>
  )
}

// ---- BEAT 2 — drop the design in --------------------------------------------------
const DropBeat: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const drop = bx('drop'); const sy = scrollFor('1-empty', drop, 40)
  const target = toScreen(drop.x + drop.w / 2, drop.y + drop.h / 2, sy)
  const landAt = Math.round(hold * 0.42)
  const c = travel(frame, 4, landAt, { x: 1780, y: 1000 }, target)
  const landed = clamp((frame - landAt) / 10, 0, 1)
  const swap = clamp((frame - landAt - 8) / 10, 0, 1)
  return (
    <Ground bg={CREAM}>
      <Alive intensity={0.6}>
        <Browser shot="1-empty" scrollY={sy} at={0} fade="2-uploaded" fadeP={swap} fadeScroll={scrollFor('2-uploaded', drop, 40)}>
          {/* the flyer being dragged in */}
          <div style={{ position: 'absolute', left: c.x + 14, top: c.y + 14, width: 150, borderRadius: 6, overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.35)', transform: `rotate(${(1 - landed) * -6}deg) scale(${1 - landed * 0.4})`, opacity: 1 - swap }}>
            <Img src={A('source.png')} style={{ width: '100%', display: 'block' }} />
          </div>
          <Cursor x={c.x} y={c.y} click={frame < landAt} />
        </Browser>
        <Stamp text="Photo · screenshot · PDF" at={landAt + 14} x={1240} y={905} rot={-6} color={BLUE} size={28} />
      </Alive>
      <Head at={2} kicker="Step 1" text={<>Drop in <span style={{ color: BLUE }}>the design.</span></>} />
      <SettleSweep color={WHITE} hold={hold} />
    </Ground>
  )
}

// ---- BEAT 3 — say what to change --------------------------------------------------
const WordsBeat: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const ta = bx('textarea'); const cb = bx('ownit')
  const sy = scrollFor('3-typing-empty', ta, -40)
  const text = 'Change STRONGER to UNSTOPPABLE. Change "STARTS 6 JANUARY" to "STARTS 6 OCTOBER". Change IRONWORKS GYM to FORGE FITNESS.'
  const typeAt = 10, cps = 2.6
  const n = clamp(Math.floor((frame - typeAt) * cps), 0, text.length)
  const doneAt = typeAt + Math.ceil(text.length / cps)
  const clickAt = doneAt + 18
  const tick = clamp((frame - clickAt) / 6, 0, 1)
  const r = toScreen(ta.x, ta.y, sy)
  const cbS = toScreen(cb.x + cb.w / 2, cb.y + cb.h / 2, sy)
  const c = travel(frame, doneAt, clickAt - 4, { x: r.x + ta.w * SC * 0.6, y: r.y + ta.h * SC + 60 }, cbS)
  const zoom = interpolate(frame, [0, 16], [1, 1.25], { extrapolateRight: 'clamp', easing: ease })
  return (
    <Ground bg={SUN}>
      <Alive intensity={0.5}>
        <Browser shot="3-typing-empty" scrollY={sy} at={0} zoom={zoom} zoomAt={{ x: ta.x + ta.w / 2, y: ta.y + 40 }} fade="4b-ticked" fadeP={tick} fadeScroll={scrollFor('4b-ticked', ta, -40)}>
          {/* typed text overlay in the real box */}
          <div style={{ position: 'absolute', left: r.x + 12, top: r.y + 10, width: ta.w * SC - 24, fontSize: 15.5, lineHeight: 1.45, fontWeight: 500, color: INK, fontFamily: F, opacity: 1 - tick }}>{text.slice(0, n)}{n < text.length && <span style={{ opacity: Math.floor(frame / 8) % 2 ? 0 : 1 }}>|</span>}</div>
          {frame >= doneAt && <Cursor x={c.x} y={c.y} click={frame >= clickAt - 3 && frame < clickAt + 6} />}
        </Browser>
        <Stamp text="Plain words" at={typeAt + 30} x={1420} y={905} rot={-6} color={INK} size={30} />
        <Stamp text="Tick: it's mine to use" at={clickAt + 6} x={1160} y={830} rot={-5} color={BLUE} size={28} />
      </Alive>
      <Head at={2} kicker="Step 2" text={<>Say what to change — <span style={{ color: BLUE }}>in plain words.</span></>} />
      <SettleSweep color={WHITE} hold={hold} />
    </Ground>
  )
}

// ---- BEAT 4 — hit Remake it; a minute later, the result ------------------------
const RemakeBeat: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const btn = bx('remake'); const remade = bx('remade')
  const sy1 = scrollFor('4b-ticked', btn, -80)
  const clickAt = 22
  const bS = toScreen(btn.x + btn.w / 2, btn.y + btn.h / 2, sy1)
  const c = travel(frame, 2, clickAt - 3, { x: bS.x + 400, y: bS.y + 260 }, bS)
  const working = clamp((frame - clickAt - 4) / 8, 0, 1)
  const resultAt = Math.round(hold * 0.5)
  const res = clamp((frame - resultAt) / 10, 0, 1)
  const sy2 = scrollFor('6-result', remade, 0)
  const secs = Math.floor(interpolate(frame, [clickAt + 6, resultAt], [0, 58], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }))
  const zoom = frame < resultAt ? interpolate(frame, [clickAt, clickAt + 10], [1, 1.18], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease }) : interpolate(frame, [resultAt, resultAt + 14], [1.0, 1.12], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease })
  return (
    <Ground bg={CREAM}>
      <Alive intensity={0.6}>
        {frame < resultAt ? (
          <Browser shot="4b-ticked" scrollY={sy1} at={0} zoom={zoom} zoomAt={{ x: btn.x + btn.w / 2, y: btn.y }} fade="5-working" fadeP={working} fadeScroll={scrollFor('5-working', btn, -80)}>
            <Cursor x={c.x} y={c.y} click={frame >= clickAt - 2 && frame < clickAt + 6} />
            {working > 0 && (
              <div style={{ position: 'absolute', left: bS.x + 240, top: bS.y - 30, background: INK, color: SUN, borderRadius: 10, padding: '12px 20px', fontWeight: 800, fontSize: 24, opacity: working, transform: `scale(${0.8 + 0.2 * working})`, boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
                Working… <span style={{ color: WHITE, fontVariantNumeric: 'tabular-nums' }}>0:{secs < 10 ? '0' : ''}{secs}</span>
              </div>
            )}
          </Browser>
        ) : (
          <Browser shot="6-result" scrollY={sy2} at={-10} zoom={zoom} zoomAt={{ x: remade.x + remade.w / 2, y: remade.y + remade.h * 0.4 }}>
            <AbsoluteFill style={{ background: CREAM, opacity: 1 - res, pointerEvents: 'none' }} />
          </Browser>
        )}
                <Stamp text="Nothing else moved" at={resultAt + 24} x={1180} y={905} rot={-6} />
      </Alive>
      <Head at={2} kicker="Step 3" text={<>Hit <span style={{ color: BLUE }}>Remake it.</span> About a minute later, it's back.</>} />
      <SettleSweep color={WHITE} hold={hold} />
    </Ground>
  )
}

// ---- BEAT 5 — download, fix, sizes, library ----------------------------------------
const AfterBeat: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const dl = bx('download'); const sy = scrollFor('6-result', dl, 200)
  const stops = [{ k: 'download', label: 'Download', dx: 0 }, { k: 'fix', label: 'Fix something', dx: -160 }, { k: 'sizes', label: 'More sizes', dx: -320 }]
  const libAt = Math.round(hold * 0.66)
  const lib = clamp((frame - libAt) / 10, 0, 1)
  const pts = stops.map((st) => { const b = bx(st.k === 'download' ? 'download' : 'download'); return toScreen(b.x + b.w / 2 + st.dx, b.y + b.h / 2, sy) })
  const seg = Math.max(8, Math.floor((libAt - 8) / 3))
  let c = pts[0]; let hover = 0
  for (let i = 0; i < 3; i++) { const from = 6 + i * seg, to = from + seg - 8; if (frame >= from) { c = travel(frame, from, to, i ? pts[i - 1] : { x: 1700, y: 1000 }, pts[i]); hover = i } }
  return (
    <Ground bg={SUN}>
      <Alive intensity={0.6}>
        {frame < libAt ? (
          <Browser shot="6-result" scrollY={sy} at={0} zoom={1.1} zoomAt={{ x: dl.x - 200, y: dl.y + 120 }}>
            <Cursor x={c.x} y={c.y} click={frame % seg < 4 && frame > 10} />
            {stops.map((st, i) => i <= hover && <div key={st.k} style={{ position: 'absolute', left: pts[i].x - 60, top: pts[i].y - 70, background: INK, color: SUN, fontWeight: 800, fontSize: 18, padding: '8px 14px', borderRadius: 8, opacity: clamp(pop(frame, 6 + i * seg + 4) * 2, 0, 1) }}>{st.label}</div>)}
          </Browser>
        ) : (
          <Browser shot="7-library" scrollY={0} at={libAt - 4} url="restylez.app/library">
            <AbsoluteFill style={{ background: SUN, opacity: 1 - lib, pointerEvents: 'none' }} />
          </Browser>
        )}
        <Stamp text={frame < libAt ? 'Print-ready' : 'Saved to your library'} at={frame < libAt ? 30 : libAt + 12} x={frame < libAt ? 1400 : 1180} y={905} rot={-6} color={INK} size={28} />
      </Alive>
      <Head at={2} kicker="Step 4" text={<>Download it, <span style={{ color: BLUE }}>fix a detail,</span> or make every size.</>} />
      <SettleSweep color={WHITE} hold={hold} />
    </Ground>
  )
}

// ---- BEAT 6 — CTA ----------------------------------------------------------------------
const CtaBeat: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame(); const p = pop(frame, 2, 12)
  const fade = interpolate(frame, [hold - 14, hold - 2], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <Ground bg={SUN}>
      <Alive intensity={0.6}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', paddingBottom: 200, opacity: fade }}>
          <div style={{ transform: `scale(${0.6 + 0.4 * p})`, opacity: clamp(p * 2, 0, 1) }}><Img src={staticFile('restylez/logo.png')} style={{ width: 760, display: 'block', filter: 'drop-shadow(0 20px 40px rgba(20,22,26,0.25))' }} /></div>
        </AbsoluteFill>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 96, textAlign: 'center', opacity: fade }}>
          <div style={{ fontWeight: 900, fontSize: 66, color: INK, letterSpacing: '-0.03em', transform: `translateY(${(1 - pop(frame, 12)) * 30}px)`, opacity: clamp(pop(frame, 12) * 2, 0, 1) }}>One design in. A finished piece out.</div>
          <div style={{ marginTop: 22, display: 'inline-block', background: INK, color: SUN, fontWeight: 800, fontSize: 34, padding: '14px 36px', borderRadius: 10, transform: `scale(${pop(frame, 22)})` }}>restylez.app/make</div>
        </div>
      </Alive>
    </Ground>
  )
}

// ---- assembly ------------------------------------------------------------------------------
const BEATS: BeatSpec[] = [
  { dur: s(D[0] + 0.8), el: (h) => <IntroBeat hold={h} /> },
  { dur: s(D[1] + 0.9), el: (h) => <DropBeat hold={h} /> },
  { dur: s(D[2] + 1.6), el: (h) => <WordsBeat hold={h} /> },
  { dur: s(D[3] + 1.6), el: (h) => <RemakeBeat hold={h} />, impact: true },
  { dur: s(D[4] + 0.8), el: (h) => <AfterBeat hold={h} /> },
  { dur: s(D[5] + 1.6), el: (h) => <CtaBeat hold={h} />, impact: true },
]
const TL = timeline(BEATS, (grid as any).beats)
export const RZMAKE_FRAMES = TL.total
export const RZMAKE_FPS = FPS

export const RzRemake: React.FC = () => (
  <AbsoluteFill style={{ background: SUN }}>
    {BEATS.map((b, i) => (
      <Sequence key={i} from={TL.starts[i]} durationInFrames={TL.durs[i] + 6}>
        {b.el(TL.durs[i], i)}
        {i !== 5 && <LogoBug src="restylez/logo.png" width={150} opacity={0.95} />}
        {i > 0 && <StreakWipe color={i % 2 ? WHITE : SUN} dir={i % 2 ? 1 : -1} dur={10} />}
      </Sequence>
    ))}
    <AudioBed id="rzmake" voice={!('placeholder' in vo)} beats={BEATS} tl={TL} voDur={D} musicFrames={s(100)} loud={0.3} duck={0.1} whoosh={0.2} impacts={BEATS.map((b, i) => b.impact ? TL.starts[i] : -1).filter((f) => f >= 0)} />
  </AbsoluteFill>
)
