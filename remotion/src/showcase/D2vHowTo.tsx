import React from 'react'
import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, useCurrentFrame, interpolate, spring, Easing } from 'remotion'
import { staticFile } from '../lib/asset'
import { loadFont as loadJakarta } from '@remotion/google-fonts/PlusJakartaSans'
import { Alive } from '../lib/pizzazz'
import vo from '../../public/showcase/d2vhowto/vo.json'
import boxesJson from '../../public/showcase/d2vhowto/boxes.json'

/* ============================================================================
 * DOCS2VIDEO — "Make your first video" (the first-login pop-up film).
 *
 * The SvToday screen-film engine in Docs2Video's navy and logo blue:
 *   · real captures of the live app, made by a throwaway account walking a
 *     made-up quote (Rivera-term-life-quote.pdf, "Sample document") through all
 *     eight steps (public/showcase/d2vhowto, boxes.json = element boxes)
 *   · a camera that pushes in on the real control, a cursor that travels to the
 *     real button, blue rings, a headline per step
 *   · ONE continuous voice take (fal.ai, ElevenLabs v3, Sarah); beats are cut
 *     from its word timings (vo.json)
 *   · a quiet music bed that dips under the voice on an eased curve
 *   · editing master: 2 s clean handles at head and tail, no baked fades; the
 *     voice starts after the head handle. The web cut is trimmed from it.
 * ==========================================================================*/
const { fontFamily: FONT } = loadJakarta()
export const FPS = 30
const s = (sec: number) => Math.round(sec * FPS)
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const ease = Easing.inOut(Easing.cubic)
const pop = (frame: number, at: number) => clamp(spring({ frame: frame - at, fps: FPS, config: { damping: 14, stiffness: 150, mass: 0.8 } }), 0, 1.15)

const BG = '#06101f', CHROME_BG = '#0c1a31', LINE = '#1d3152', INK = '#f2f6fc', MUTE = '#93a6c2', ACC = '#39c0f6'
const HEAD = s(2), TAIL = s(2)
const DIR = 'showcase/d2vhowto'

type Box = { x: number; y: number; w: number; h: number }
const BOXES = boxesJson as unknown as Record<string, Box>
const union = (...names: string[]): Box => {
  const bs = names.map((n) => BOXES[n])
  const x = Math.min(...bs.map((b) => b.x)), y = Math.min(...bs.map((b) => b.y))
  return { x, y, w: Math.max(...bs.map((b) => b.x + b.w)) - x, h: Math.max(...bs.map((b) => b.y + b.h)) - y }
}
const box = (k: string | Box): Box => (typeof k === 'string' ? BOXES[k] : k)
const WHOLE: Box = { x: 0, y: 0, w: 1920, h: 1080 }

// Browser frame on the 1920×1080 canvas; captures are 1920 wide.
const FX = 210, FY = 176, FW = 1500, CHROME = 40, VIEW = 844, SC = FW / 1920
const toScreen = (px: number, py: number) => ({ x: FX + px * SC, y: FY + CHROME + py * SC })
const CENTER = { x: 960, y: 620 }

type Cam = { focus: string | Box; zoom: number }
type Ring = { box: string | Box; at: number }
type Way = { to: string; at: number; click?: boolean }
type Beat = {
  kind?: 'screen' | 'cta'
  shot?: string; url?: string; cam?: Cam
  fade?: { shot: string; at: number; cam: Cam; url?: string }
  cursor?: { from?: string; path: Way[] }
  rings?: Ring[]
  clip?: { box: string; src: string; from: number }
  kicker?: string; head?: string; stamp?: string; stampAt?: number
}

const U = 'docs2video.com'
const BEATS: Beat[] = [
  { shot: '01-home', url: `${U}/dashboard`, cam: { focus: WHOLE, zoom: 1 }, kicker: 'Welcome to Docs2Video', head: 'Make your *first video.*' },
  { shot: '01-home', url: `${U}/dashboard`, cam: { focus: 'home_doc', zoom: 1.75 }, cursor: { path: [{ to: 'home_doc', at: 0.5, click: true }] }, rings: [{ box: 'home_doc', at: 0.5 }], kicker: 'Home', head: 'Start from a *document.*' },
  { shot: '02-content', url: `${U}/create`, cam: { focus: WHOLE, zoom: 1 }, cursor: { path: [{ to: 'ct_read', at: 0.42, click: true }] }, rings: [{ box: 'ct_file', at: 0.12 }], kicker: 'Step 1 · Content', head: 'Drop it in. *Press Read it.*', stamp: 'Free', stampAt: 0.7 },
  { shot: '03-story', url: `${U}/create/story`, cam: { focus: union('st_point', 'st_tiles', 'st_askbox'), zoom: 1.12 }, rings: [{ box: 'st_point', at: 0.08 }, { box: 'st_tiles', at: 0.38 }, { box: 'st_askbox', at: 0.72 }], kicker: 'Step 2 · Story', head: 'Your point. *Your numbers.*' },
  { shot: '03b-story-length', url: `${U}/create/story`, cam: { focus: union('st_len_all', 'st_written'), zoom: 1.5 }, cursor: { path: [{ to: 'st_len', at: 0.3, click: true }] }, rings: [{ box: 'st_written', at: 0.6 }], kicker: 'Step 2 · Story', head: 'Pick a *length.*' },
  { shot: '04-brand', url: `${U}/create/brand`, cam: { focus: union('br_fields', 'br_photo_thumb'), zoom: 1.3 }, rings: [{ box: 'br_fields', at: 0.2 }, { box: 'br_photo_thumb', at: 0.6 }], kicker: 'Step 3 · Brand', head: 'Who it’s *from.*' },
  { shot: '04b-brand-contact', url: `${U}/create/brand`, cam: { focus: union('br_phone', 'br_email'), zoom: 1.45 }, rings: [{ box: union('br_phone', 'br_email'), at: 0.15 }], kicker: 'Step 3 · Brand', head: 'How to *reach you.*', stamp: 'Saved for next time', stampAt: 0.55 },
  { shot: '05-look', url: `${U}/create/style`, cam: { focus: 'lk_grid', zoom: 1.04 }, cursor: { path: [{ to: 'lk_swiss_card', at: 0.2, click: true }, { to: 'lk_tab_mine', at: 0.42, click: true }, { to: 'lk_preview', at: 0.82 }] }, fade: { shot: '05b-mylooks', at: 0.44, cam: { focus: WHOLE, zoom: 1 }, url: `${U}/create/style` }, rings: [{ box: 'lk_preview', at: 0.82 }], kicker: 'Step 4 · Look', head: 'Templates, or *3D looks.*' },
  { shot: '06-scenes', url: `${U}/create/scenes`, cam: { focus: WHOLE, zoom: 1.05 }, cursor: { path: [{ to: 'sc_edit', at: 0.42, click: true }] }, fade: { shot: '06b-scene-edit', at: 0.5, cam: { focus: WHOLE, zoom: 1.05 } }, kicker: 'Step 5 · Scenes', head: 'Read each *scene.*' },
  { shot: '07-voice', url: `${U}/create/voice`, cam: { focus: union('vo_list', 'vo_music'), zoom: 1.5 }, cursor: { path: [{ to: 'vo_sarah', at: 0.3, click: true }, { to: 'vo_music', at: 0.72 }] }, rings: [{ box: 'vo_list', at: 0.1 }, { box: 'vo_music', at: 0.72 }], kicker: 'Step 6 · Voice', head: 'Pick a *voice.*' },
  { shot: '08-opener', url: `${U}/create/opening`, cam: { focus: union('op_open_card', 'op_close_card'), zoom: 1.2 }, rings: [{ box: 'op_open_card', at: 0.1 }, { box: 'op_close_card', at: 0.5 }], kicker: 'Step 7 · Opener & close', head: 'Hello, and *how to reach you.*' },
  { shot: '09-review', url: `${U}/create/review`, cam: { focus: WHOLE, zoom: 1.04 }, cursor: { path: [{ to: 'rv_make', at: 0.3, click: true }] }, rings: [{ box: 'rv_make', at: 0.3 }], fade: { shot: '10-making', at: 0.4, cam: { focus: WHOLE, zoom: 1.04 }, url: `${U}/create/generating` }, kicker: 'Step 8 · Review', head: 'Press *Make it.*', stamp: 'About 10 minutes', stampAt: 0.6 },
  { shot: '11-done', url: `${U}/videos`, cam: { focus: union('dn_player', 'dn_send'), zoom: 1.12 }, clip: { box: 'dn_player', src: 'result.mp4', from: 4 }, cursor: { path: [{ to: 'dn_email', at: 0.3, click: true }, { to: 'dn_send', at: 0.55, click: true }] }, rings: [{ box: 'dn_send', at: 0.55 }], kicker: 'Ready to send', head: 'Send it to *your client.*' },
  { kind: 'cta' },
]

// ---- timing from the continuous take -------------------------------------------------
type Seg = { start: number | null; end: number | null }
const SEGS = (vo as { segments: Seg[]; total: number }).segments
const VO_TOTAL = (vo as { total: number }).total
const STARTS = BEATS.map((_, i) => (i === 0 ? 0 : HEAD + s((SEGS[i - 1].end ?? 0) + 0.25)))
const END = HEAD + s(VO_TOTAL + 2.4) // closing card holds after the last word
export const D2V_HOWTO_FRAMES = END + TAIL
const DURS = STARTS.map((st, i) => (i < STARTS.length - 1 ? STARTS[i + 1] : D2V_HOWTO_FRAMES) - st)

const accent = (text: string) => text.split('*').map((p, i) => (i % 2 ? <span key={i} style={{ color: ACC }}>{p}</span> : <React.Fragment key={i}>{p}</React.Fragment>))

const Head: React.FC<{ kicker?: string; head?: string; at: number }> = ({ kicker, head, at }) => {
  const frame = useCurrentFrame(); const p = pop(frame, at)
  if (!head) return null
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'center', pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, height: 170, background: `linear-gradient(${BG} 62%, ${BG}00)` }} />
      <div style={{ position: 'relative', marginTop: 28, textAlign: 'center', opacity: clamp(p * 1.6, 0, 1), transform: `translateY(${(1 - clamp(p, 0, 1)) * 26}px)` }}>
        {kicker && <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 21, letterSpacing: '0.2em', textTransform: 'uppercase', color: ACC, marginBottom: 6 }}>{kicker}</div>}
        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 56, color: INK, letterSpacing: '-0.02em', lineHeight: 1.12 }}>{accent(head)}</div>
      </div>
    </AbsoluteFill>
  )
}

const Stamp: React.FC<{ text: string; at: number }> = ({ text, at }) => {
  const frame = useCurrentFrame()
  if (frame < at) return null
  const p = clamp(spring({ frame: frame - at, fps: FPS, config: { damping: 11, stiffness: 260 } }), 0, 1.2)
  return <div style={{ position: 'absolute', right: 120, bottom: 70, transform: `rotate(-4deg) scale(${1.6 - 0.6 * p})`, opacity: clamp(p, 0, 1), border: `5px solid ${ACC}`, color: ACC, borderRadius: 10, padding: '10px 24px', fontFamily: FONT, fontWeight: 800, fontSize: 30, letterSpacing: '0.06em', textTransform: 'uppercase', background: 'rgba(6,16,31,0.9)', whiteSpace: 'nowrap', zIndex: 30 }}>{text}</div>
}

const Cursor: React.FC<{ x: number; y: number; click: number }> = ({ x, y, click }) => (
  <div style={{ position: 'absolute', left: x - 6, top: y - 4, zIndex: 40, transform: `scale(${1 - 0.15 * click})`, transformOrigin: '6px 4px' }}>
    {click > 0 && <div style={{ position: 'absolute', left: -24, top: -26, width: 60, height: 60, borderRadius: 30, border: `4px solid ${ACC}`, opacity: 0.8 * click, transform: `scale(${1.4 - 0.4 * click})` }} />}
    <svg style={{ width: 40, height: 48, filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.55))' }} viewBox="0 0 24 28"><path d="M3 2 L3 22 L8.5 17 L12 26 L15.5 24.5 L12 16 L19 16 Z" fill="#ffffff" stroke="#06101f" strokeWidth="1.5" /></svg>
  </div>
)

/** Camera state for a target: zoom about the focus, pulling it toward frame center. */
const camAt = (c: Cam, amount: number) => {
  const b = box(c.focus)
  const f = toScreen(b.x + b.w / 2, b.y + b.h / 2)
  const z = 1 + (c.zoom - 1) * amount
  const pull = c.zoom > 1 ? amount : 0
  return { z, fx: f.x, fy: f.y, px: f.x + (CENTER.x - f.x) * pull, py: f.y + (CENTER.y - f.y) * pull }
}

const ScreenBeat: React.FC<{ b: Beat; hold: number; first: boolean }> = ({ b, hold, first }) => {
  const frame = useCurrentFrame()
  const inP = first ? 1 : ease(clamp(frame / 30, 0, 1))
  const creep = 1 + 0.02 * (frame / hold)
  const A = camAt(b.cam!, inP)
  const fadeAt = b.fade ? Math.round(hold * b.fade.at) : Infinity
  const fadeP = b.fade ? clamp((frame - fadeAt) / 12, 0, 1) : 0
  const moveP = b.fade ? ease(clamp((frame - fadeAt - 4) / 28, 0, 1)) : 0
  const B = b.fade ? camAt(b.fade.cam, 1) : A
  const lerp = (a: number, c: number) => a + (c - a) * moveP
  const z = lerp(A.z, B.z) * creep, fx = lerp(A.fx, B.fx), fy = lerp(A.fy, B.fy), px = lerp(A.px, B.px), py = lerp(A.py, B.py)
  const tx = px - fx * z, ty = py - fy * z
  const map = (pt: { x: number; y: number }) => ({ x: pt.x * z + tx, y: pt.y * z + ty })
  const center = (k: string) => { const bb = box(k); return toScreen(bb.x + bb.w / 2, bb.y + bb.h / 2) }

  let cur: { x: number; y: number } | null = null, click = 0
  if (b.cursor) {
    const pts = [b.cursor.from ? center(b.cursor.from) : { x: 1780, y: 1000 }, ...b.cursor.path.map((w) => center(w.to))]
    const times = [6, ...b.cursor.path.map((w) => Math.round(hold * w.at))]
    let seg = 0; while (seg < times.length - 2 && frame > times[seg + 1]) seg++
    const t = ease(clamp((frame - times[seg]) / Math.max(1, times[seg + 1] - 4 - times[seg]), 0, 1))
    const p = { x: pts[seg].x + (pts[seg + 1].x - pts[seg].x) * t, y: pts[seg].y + (pts[seg + 1].y - pts[seg].y) * t }
    cur = map(p)
    for (const [i, w] of b.cursor.path.entries()) if (w.click) { const d = frame - times[i + 1]; if (d >= -2 && d < 10) click = Math.max(click, 1 - Math.abs(d - 2) / 8) }
  }
  const url = fadeP > 0.5 && b.fade?.url ? b.fade.url : b.url
  const clipBox = b.clip ? box(b.clip.box) : null

  return (
    <AbsoluteFill style={{ background: BG, overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: `radial-gradient(60% 50% at 50% 55%, rgba(57,192,246,0.10), ${BG}00 70%)` }} />
      <Alive intensity={0.3}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transformOrigin: '0 0', transform: `translate(${tx}px, ${ty}px) scale(${z})` }}>
          <div style={{ position: 'absolute', left: FX, top: FY, width: FW, height: CHROME + VIEW, borderRadius: 10, overflow: 'hidden', background: '#0a1628', border: `1px solid ${LINE}`, boxShadow: '0 40px 100px rgba(0,0,0,0.55)' }}>
            <div style={{ height: CHROME, background: CHROME_BG, display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', borderBottom: `1px solid ${LINE}` }}>
              {['#ff5f57', '#febc2e', '#28c840'].map((c) => <div key={c} style={{ width: 12, height: 12, borderRadius: 6, background: c }} />)}
              <div style={{ marginLeft: 16, flex: 1, height: 24, borderRadius: 6, background: BG, fontFamily: FONT, fontSize: 14, fontWeight: 500, color: MUTE, display: 'flex', alignItems: 'center', padding: '0 12px' }}>{url}</div>
            </div>
            <div style={{ position: 'absolute', left: 0, top: CHROME, width: FW, height: VIEW, overflow: 'hidden' }}>
              <Img src={staticFile(`${DIR}/${b.shot}.png`)} style={{ position: 'absolute', left: 0, top: 0, width: FW }} />
              {b.fade && <Img src={staticFile(`${DIR}/${b.fade.shot}.png`)} style={{ position: 'absolute', left: 0, top: 0, width: FW, opacity: fadeP }} />}
              {b.clip && clipBox && (
                <div style={{ position: 'absolute', left: clipBox.x * SC, top: clipBox.y * SC, width: clipBox.w * SC, height: clipBox.h * SC, overflow: 'hidden', borderRadius: 8, background: '#000' }}>
                  <OffthreadVideo muted src={staticFile(`${DIR}/${b.clip.src}`)} startFrom={s(b.clip.from)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}
            </div>
          </div>
          {(b.rings || []).map((r, i) => {
            const at = Math.round(hold * r.at); const p = pop(frame, at); if (frame < at) return null
            const bb = box(r.box); const tl = toScreen(bb.x, bb.y)
            return <div key={i} style={{ position: 'absolute', left: tl.x - 8, top: tl.y - 8, width: bb.w * SC + 16, height: bb.h * SC + 16, borderRadius: 10, border: `${4 / z}px solid ${ACC}`, boxShadow: `0 0 ${24 / z}px rgba(57,192,246,0.5)`, opacity: clamp(p * 1.4, 0, 1), transform: `scale(${1.08 - 0.08 * clamp(p, 0, 1)})` }} />
          })}
        </div>
      </Alive>
      {cur && <Cursor x={cur.x} y={cur.y} click={click} />}
      {b.stamp && <Stamp text={b.stamp} at={Math.round(hold * (b.stampAt ?? 0.6))} />}
      <Head kicker={b.kicker} head={b.head} at={first ? HEAD + 4 : 4} />
    </AbsoluteFill>
  )
}

const Rise: React.FC<{ at: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ at, children, style }) => {
  const frame = useCurrentFrame(); const p = pop(frame, at)
  return <div style={{ opacity: clamp(p * 1.5, 0, 1), transform: `translateY(${(1 - clamp(p, 0, 1)) * 30}px)`, ...style }}>{children}</div>
}

const STEPS = ['Content', 'Story', 'Brand', 'Look', 'Scenes', 'Voice', 'Opener & close', 'Review']
const Cta: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame(); const p = pop(frame, 4)
  return (
    <AbsoluteFill style={{ background: BG, overflow: 'hidden' }}>
      <Img src={staticFile(`${DIR}/01-home.png`)} style={{ position: 'absolute', inset: 0, width: 1920, height: 1080, filter: 'blur(18px) brightness(0.3)', transform: `scale(${1.08 + 0.04 * (frame / hold)})` }} />
      <AbsoluteFill style={{ background: `radial-gradient(55% 45% at 50% 42%, rgba(57,192,246,0.16), ${BG}00 70%)` }} />
      <Alive intensity={0.35}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', gap: 40, paddingBottom: 30 }}>
          <div style={{ transform: `scale(${(0.85 + 0.15 * p) * (1 + 0.02 * (frame / hold))})`, opacity: clamp(p * 1.6, 0, 1) }}>
            <Img src={staticFile(`${DIR}/logo.png`)} style={{ width: 600, display: 'block', filter: 'drop-shadow(0 24px 50px rgba(0,0,0,0.6))' }} />
          </div>
          <Rise at={12}><div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 76, color: INK, letterSpacing: '-0.02em' }}>Make your <span style={{ color: ACC }}>first video.</span></div></Rise>
          <Rise at={22}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 1500 }}>
              {STEPS.map((t, i) => (
                <div key={t} style={{ fontFamily: FONT, fontWeight: 700, fontSize: 24, color: INK, border: `1px solid ${LINE}`, background: 'rgba(12,26,49,0.85)', borderRadius: 10, padding: '10px 18px', opacity: clamp((frame - 22 - i * 3) / 8, 0, 1) }}>
                  <span style={{ color: ACC, marginRight: 10 }}>{i + 1}</span>{t}
                </div>
              ))}
            </div>
          </Rise>
          <Rise at={40}><div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 30, color: BG, background: ACC, borderRadius: 10, padding: '14px 36px' }}>Press + New to start</div></Rise>
        </AbsoluteFill>
      </Alive>
    </AbsoluteFill>
  )
}

// Music: a quiet bed, lower under the voice, eased between levels (no frame-to-frame jumps).
const VO_ON = HEAD, VO_OFF = HEAD + s(VO_TOTAL)
const musicVol = (f: number) => {
  const up = 0.2, under = 0.075
  const into = interpolate(f, [VO_ON - 18, VO_ON + 6], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease })
  const out = interpolate(f, [VO_OFF + 6, VO_OFF + 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease })
  return up + (under - up) * into * (1 - out)
}

export const D2vHowTo: React.FC = () => (
  <AbsoluteFill style={{ background: BG }}>
    {BEATS.map((b, i) => {
      const hold = DURS[i]
      return (
        <Sequence key={i} from={STARTS[i]} durationInFrames={hold + (i < BEATS.length - 1 ? 10 : 0)}>
          <Dissolve skip={i === 0}>
            {b.kind === 'cta' ? <Cta hold={hold} /> : <ScreenBeat b={b} hold={hold} first={i === 0} />}
          </Dissolve>
        </Sequence>
      )
    })}
    <Audio src={staticFile('music/bed-warm-128.wav')} volume={musicVol} />
    <Sequence from={HEAD}><Audio src={staticFile(`${DIR}/vo.mp3`)} /></Sequence>
  </AbsoluteFill>
)

/** Each new beat dissolves in over the previous one (no wipe, no whoosh). */
const Dissolve: React.FC<{ skip: boolean; children: React.ReactNode }> = ({ skip, children }) => {
  const frame = useCurrentFrame()
  return <AbsoluteFill style={{ opacity: skip ? 1 : interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' }) }}>{children}</AbsoluteFill>
}

/** Beat starts in seconds, for the contact sheet. */
export const D2V_HOWTO_BEATS = STARTS.map((f, i) => ({ start: f / FPS, end: (f + DURS[i]) / FPS }))
