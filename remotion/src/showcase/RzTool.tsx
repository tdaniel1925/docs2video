import React from 'react'
import { AbsoluteFill, Img, Sequence, useCurrentFrame, interpolate, spring, Easing } from 'remotion'
import { staticFile } from '../lib/asset'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import { StreakWipe, Alive, SettleSweep, LogoBug } from '../lib/pizzazz'
import { FPS, s, clamp, pop, timeline, AudioBed, type BeatSpec } from './common'

/* ============================================================================
 * RZ TOOL EXPLAINER ENGINE — one composition, driven by a spec:
 *   real full-page captures in a browser frame that scrolls to the control
 *   being talked about, a cursor that travels to the real box, typing
 *   overlays, punch-zooms, stamps and headlines. Same house style as
 *   RzRemake; this is the reusable version. See specs in ./rzspecs.ts.
 * ==========================================================================*/
const { fontFamily: F } = loadInter()
const SUN = '#ffc93c', INK = '#14161a', BLUE = '#2e6be6', CREAM = '#f6f1e8', CORAL = '#ff6b57', WHITE = '#ffffff', MUTE = '#6b7080'
export type Box = { x: number; y: number; w: number; h: number }
export type Beat = {
  kind?: 'screen' | 'cta'
  shot?: string; focus?: string; bias?: number; zoom?: number
  cursor?: string; cursorFrom?: 'edge' | string; click?: boolean; clickAt?: number
  fade?: string; fadeAt?: number; fadeFocus?: string
  type?: { box: string; text: string; at?: number; cps?: number }
  kicker?: string; head: string; stamp?: string; stampAt?: number; stampColor?: string; stampX?: number
  pad?: number; bg?: string; url?: string; label?: string
}
export type ToolSpec = { id: string; url: string; beats: Beat[]; music?: number; cta: { head: string; url: string } }
export type ToolData = { spec: ToolSpec; vo: { durations: number[]; placeholder?: boolean }; grid: { beats: number[] }; boxes: Record<string, Box | number> }

const FX = 160, FY = 140, FW = 1600, CHROME = 44, VIEW = 816, SC = FW / 1920
const ease = Easing.inOut(Easing.cubic)
const travel = (frame: number, from: number, to: number, a: { x: number; y: number }, b: { x: number; y: number }) => { const t = ease(clamp((frame - from) / Math.max(1, to - from), 0, 1)); return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t } }
const accent = (text: string) => text.split('*').map((part, i) => i % 2 ? <span key={i} style={{ color: BLUE }}>{part}</span> : <React.Fragment key={i}>{part}</React.Fragment>)

const Head: React.FC<{ kicker?: string; text: React.ReactNode; at?: number }> = ({ kicker, text, at = 4 }) => {
  const frame = useCurrentFrame(); const p = pop(frame, at)
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'center', padding: '34px 0 30px' }}>
      <div style={{ opacity: clamp(p * 1.5, 0, 1), transform: `translateY(${(1 - clamp(p, 0, 1)) * 30}px)`, textAlign: 'center', maxWidth: 1600 }}>
        {kicker && <div style={{ fontWeight: 800, fontSize: 22, letterSpacing: '0.18em', textTransform: 'uppercase', color: BLUE, marginBottom: 6 }}>{kicker}</div>}
        <div style={{ fontWeight: 900, fontSize: 54, color: INK, lineHeight: 1.06, letterSpacing: '-0.03em', paddingBottom: '0.06em' }}>{text}</div>
      </div>
    </AbsoluteFill>
  )
}
const Stamp: React.FC<{ text: string; at: number; color?: string; x?: number; y?: number; rot?: number; size?: number }> = ({ text, at, color = CORAL, x = 1300, y = 905, rot = -6, size = 30 }) => {
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

const ScreenBeat: React.FC<{ b: Beat; hold: number; data: ToolData; idx: number }> = ({ b, hold, data, idx }) => {
  const frame = useCurrentFrame()
  const A = (n: string) => staticFile(`showcase/${data.spec.id}/${n}.png`)
  const bx = (k?: string): Box => (k && (data.boxes[k] as Box)) || { x: 960, y: 300, w: 10, h: 10 }
  const pageH = (shot: string) => (data.boxes['page_' + shot] as number) || 2400
  const scrollFor = (shot: string, box: Box, bias = 0) => clamp(box.y + box.h / 2 - (VIEW / SC) / 2 + bias, 0, Math.max(0, pageH(shot) - VIEW / SC))
  const toScreen = (px: number, py: number, sy: number) => ({ x: FX + px * SC, y: FY + CHROME + (py - sy) * SC })

  const shot = b.shot!
  const focus = bx(b.focus)
  const syTarget = scrollFor(shot, focus, b.bias ?? 0)
  // scroll in over the first 20 frames from a little above (feels like a real page)
  const sy = idx === 0 ? interpolate(frame, [10, 34], [0, syTarget], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease }) : interpolate(frame, [0, 18], [Math.max(0, syTarget - 160), syTarget], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease })
  const fadeAt = Math.round(hold * (b.fadeAt ?? 0.55))
  const fadeP = b.fade ? clamp((frame - fadeAt) / 10, 0, 1) : 0
  const fadeScroll = b.fade ? scrollFor(b.fade, bx(b.fadeFocus || b.focus), b.bias ?? 0) : sy
  // cursor: travels from the previous spot (or the edge) to the target box, clicks at clickAt
  const target = b.cursor ? bx(b.cursor) : null
  const clickAt = Math.round(hold * (b.clickAt ?? 0.5))
  const tPt = target ? toScreen(target.x + target.w / 2, target.y + target.h / 2, sy) : null
  const fromPt = b.cursorFrom && b.cursorFrom !== 'edge' ? (() => { const f = bx(b.cursorFrom); return toScreen(f.x + f.w / 2, f.y + f.h / 2, sy) })() : { x: 1700, y: 1000 }
  const c = tPt ? travel(frame, 8, clickAt - 4, fromPt, tPt) : null
  const clicking = !!b.click && frame >= clickAt - 2 && frame < clickAt + 6
  // typing overlay in a real box
  const ty = b.type ? bx(b.type.box) : null
  const tyAt = b.type?.at ?? 12, cps = b.type?.cps ?? 2.6
  const n = b.type ? clamp(Math.floor((frame - tyAt) * cps), 0, b.type.text.length) : 0
  const r = ty ? toScreen(ty.x, ty.y, sy) : null
  // punch zoom around the focus
  const zoom = b.zoom ? interpolate(frame, [4, 22], [1, b.zoom], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease }) : 1
  const origin = toScreen(focus.x + focus.w / 2, focus.y + Math.min(focus.h / 2, 200), sy)
  const winP = pop(frame, idx === 0 ? 2 : 0, 14)
  const bg = b.bg || (idx % 2 ? CREAM : SUN)
  const stampAt = Math.round(hold * (b.stampAt ?? 0.6))
  return (
    <AbsoluteFill style={{ background: bg, fontFamily: F, overflow: 'hidden' }}>
      <Alive intensity={0.6}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transform: `scale(${zoom})`, transformOrigin: `${origin.x}px ${origin.y}px` }}>
          <div style={{ position: 'absolute', left: FX, top: FY, width: FW, height: CHROME + VIEW, borderRadius: 10, overflow: 'hidden', background: WHITE, boxShadow: '0 40px 90px rgba(20,22,26,0.28)', opacity: clamp(winP * 2, 0, 1), transform: `translateY(${(1 - clamp(winP, 0, 1)) * 60}px) scale(${0.96 + 0.04 * clamp(winP, 0, 1)})` }}>
            <div style={{ height: CHROME, background: '#eef0f5', display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', borderBottom: '1px solid #dde0e8' }}>
              {['#ff5f57', '#febc2e', '#28c840'].map((cc) => <div key={cc} style={{ width: 12, height: 12, borderRadius: 6, background: cc }} />)}
              <div style={{ marginLeft: 16, flex: 1, height: 26, borderRadius: 6, background: WHITE, fontSize: 14, fontWeight: 600, color: MUTE, display: 'flex', alignItems: 'center', padding: '0 12px' }}>{b.url || data.spec.url}</div>
            </div>
            <div style={{ position: 'absolute', left: 0, top: CHROME, width: FW, height: VIEW, overflow: 'hidden' }}>
              <Img src={A(shot)} style={{ position: 'absolute', left: 0, top: -sy * SC, width: FW, display: 'block' }} />
              {b.fade && <Img src={A(b.fade)} style={{ position: 'absolute', left: 0, top: -fadeScroll * SC, width: FW, display: 'block', opacity: fadeP }} />}
              {b.type && r && (
                <div style={{ position: 'absolute', left: r.x - FX + 12, top: r.y - FY - CHROME + 10, width: ty!.w * SC - 24, fontSize: 15.5, lineHeight: 1.45, fontWeight: 500, color: INK, opacity: 1 - fadeP }}>{b.type.text.slice(0, n)}{n < b.type.text.length && frame >= tyAt && <span style={{ opacity: Math.floor(frame / 8) % 2 ? 0 : 1 }}>|</span>}</div>
              )}
            </div>
          </div>
          {c && frame >= 8 && <Cursor x={c.x} y={c.y} click={clicking} />}
          {b.label && tPt && frame >= clickAt && <div style={{ position: 'absolute', left: tPt.x - 40, top: tPt.y - 70, background: INK, color: SUN, fontWeight: 800, fontSize: 18, padding: '8px 14px', borderRadius: 8, opacity: clamp(pop(frame, clickAt) * 2, 0, 1) }}>{b.label}</div>}
        </div>
        {b.stamp && <Stamp text={b.stamp} at={stampAt} color={b.stampColor} x={b.stampX ?? Math.max(700, 1760 - b.stamp.length * 19)} />}
      </Alive>
      <Head at={2} kicker={b.kicker} text={accent(b.head)} />
      <SettleSweep color={WHITE} hold={hold} />
    </AbsoluteFill>
  )
}

const CtaBeat: React.FC<{ hold: number; spec: ToolSpec }> = ({ hold, spec }) => {
  const frame = useCurrentFrame(); const p = pop(frame, 2, 12)
  const fade = interpolate(frame, [hold - 14, hold - 2], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ background: SUN, fontFamily: F, overflow: 'hidden' }}>
      <Alive intensity={0.6}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', paddingBottom: 200, opacity: fade }}>
          <div style={{ transform: `scale(${0.6 + 0.4 * p})`, opacity: clamp(p * 2, 0, 1) }}><Img src={staticFile('restylez/logo.png')} style={{ width: 760, display: 'block', filter: 'drop-shadow(0 20px 40px rgba(20,22,26,0.25))' }} /></div>
        </AbsoluteFill>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 96, textAlign: 'center', opacity: fade }}>
          <div style={{ fontWeight: 900, fontSize: 66, color: INK, letterSpacing: '-0.03em', transform: `translateY(${(1 - pop(frame, 12)) * 30}px)`, opacity: clamp(pop(frame, 12) * 2, 0, 1) }}>{spec.cta.head}</div>
          <div style={{ marginTop: 22, display: 'inline-block', background: INK, color: SUN, fontWeight: 800, fontSize: 34, padding: '14px 36px', borderRadius: 10, transform: `scale(${pop(frame, 22)})` }}>{spec.cta.url}</div>
        </div>
      </Alive>
    </AbsoluteFill>
  )
}

/** Build a composition (component + frame count) from a tool's data. */
export function makeTool(data: ToolData) {
  const D = data.vo.durations
  const BEATS: BeatSpec[] = data.spec.beats.map((b, i) => ({
    dur: s((D[i] ?? 3) + (b.pad ?? (b.kind === 'cta' ? 1.6 : b.type ? 1.6 : 0.9))),
    el: (h) => b.kind === 'cta' ? <CtaBeat hold={h} spec={data.spec} /> : <ScreenBeat b={b} hold={h} data={data} idx={i} />,
    impact: b.kind === 'cta' || !!b.click, noVo: D[i] == null,
  }))
  const TL = timeline(BEATS, data.grid.beats)
  const Comp: React.FC = () => (
    <AbsoluteFill style={{ background: SUN }}>
      {BEATS.map((b, i) => (
        <Sequence key={i} from={TL.starts[i]} durationInFrames={TL.durs[i] + 6}>
          {b.el(TL.durs[i], i)}
          {data.spec.beats[i].kind !== 'cta' && <LogoBug src="restylez/logo.png" width={150} opacity={0.95} />}
          {i > 0 && <StreakWipe color={i % 2 ? WHITE : SUN} dir={i % 2 ? 1 : -1} dur={10} />}
        </Sequence>
      ))}
      <AudioBed id={data.spec.id} voice={!data.vo.placeholder} beats={BEATS} tl={TL} voDur={D} musicFrames={s(data.spec.music ?? 100)} loud={0.3} duck={0.1} whoosh={0.2} impacts={BEATS.map((b, i) => b.impact ? TL.starts[i] : -1).filter((f) => f >= 0)} />
    </AbsoluteFill>
  )
  return { Comp, frames: TL.total, fps: FPS }
}

/** A tour: beats borrowed from several tools' captures, narrated by its own voice track. */
export function makeTour(id: string, items: { data: ToolData; beat: Beat }[], vo: { durations: number[]; placeholder?: boolean }, grid: { beats: number[] }, cta: { head: string; url: string }) {
  const D = vo.durations
  const spec: ToolSpec = { id, url: 'restylez.app', beats: items.map((it) => it.beat), cta }
  const BEATS: BeatSpec[] = items.map((it, i) => ({
    dur: s((D[i] ?? 3) + (it.beat.pad ?? (it.beat.kind === 'cta' ? 1.6 : 0.8))),
    el: (h) => it.beat.kind === 'cta' ? <CtaBeat hold={h} spec={spec} /> : <ScreenBeat b={it.beat} hold={h} data={{ ...it.data, spec: { ...it.data.spec, url: it.beat.url || it.data.spec.url } }} idx={i} />,
    impact: it.beat.kind === 'cta' || !!it.beat.click, noVo: D[i] == null,
  }))
  const TL = timeline(BEATS, grid.beats)
  const Comp: React.FC = () => (
    <AbsoluteFill style={{ background: SUN }}>
      {BEATS.map((b, i) => (
        <Sequence key={i} from={TL.starts[i]} durationInFrames={TL.durs[i] + 6}>
          {b.el(TL.durs[i], i)}
          {items[i].beat.kind !== 'cta' && <LogoBug src="restylez/logo.png" width={150} opacity={0.95} />}
          {i > 0 && <StreakWipe color={i % 2 ? WHITE : SUN} dir={i % 2 ? 1 : -1} dur={10} />}
        </Sequence>
      ))}
      <AudioBed id={id} voice={!vo.placeholder} beats={BEATS} tl={TL} voDur={D} musicFrames={s(100)} loud={0.3} duck={0.1} whoosh={0.2} impacts={BEATS.map((b, i) => b.impact ? TL.starts[i] : -1).filter((f) => f >= 0)} />
    </AbsoluteFill>
  )
  return { Comp, frames: TL.total, fps: FPS }
}
