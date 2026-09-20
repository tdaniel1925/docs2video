import React from 'react'
import { AbsoluteFill, Img, Sequence, useCurrentFrame, interpolate, spring, Easing } from 'remotion'
import { staticFile } from '../lib/asset'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import vo from '../../public/showcase/jordyn/vo.json'
import grid from '../../public/showcase/jordyn/beatgrid.json'
import { StreakWipe, Alive, sustained, SettleSweep, CountUp, LogoBug } from '../lib/pizzazz'
import { FPS, s, clamp, pop, timeline, AudioBed, type BeatSpec } from './common'

/* ============================================================================
 * JORDYN — launch commercial in the house style (see RestylezLaunch).
 *   · LOOK: jordyn.app's warm cream + terracotta, ink type, peach panels;
 *     the product is drawn in code and ANIMATED — inbox, brain install,
 *     morning briefing, drafting reply, live phone call, pipeline, invoice.
 *   · MOTION: every beat in <Alive>, reveals spread with sustained(),
 *     SettleSweep on long holds, StreakWipe on every cut, beat-locked.
 * ==========================================================================*/
const { fontFamily: F } = loadInter()
const CREAM = '#faf9f5', PEACH = '#f5e6df', INK = '#3d3929', MUTE = '#6b6759', FAINT = '#9c988a', CLAY = '#c96442', CLAYD = '#b0512f', SAGE = '#7d8c6f', WHITE = '#ffffff', PAPER = '#f0eee6'
const J = (n: string) => staticFile(`showcase/jordyn/${n}`)
const D = (vo as any).durations as number[]

// ---- shared pieces --------------------------------------------------------
const Ground: React.FC<{ bg: string; children: React.ReactNode }> = ({ bg, children }) => (
  <AbsoluteFill style={{ background: bg, fontFamily: F, overflow: 'hidden', color: INK }}>{children}</AbsoluteFill>
)
const Head: React.FC<{ kicker?: string; text: React.ReactNode; color?: string; kColor?: string; size?: number; at?: number; pos?: 'bottom' | 'top' | 'center'; width?: number }> =
({ kicker, text, color = INK, kColor = CLAY, size = 72, at = 4, pos = 'bottom', width = 1500 }) => {
  const frame = useCurrentFrame()
  const p = pop(frame, at)
  const just = pos === 'bottom' ? 'flex-end' : pos === 'top' ? 'flex-start' : 'center'
  return (
    <AbsoluteFill style={{ justifyContent: just, alignItems: 'center', padding: '84px 0 90px' }}>
      <div style={{ opacity: clamp(p * 1.5, 0, 1), transform: `translateY(${(1 - clamp(p, 0, 1)) * 40}px)`, textAlign: 'center', maxWidth: width }}>
        {kicker && <div style={{ fontWeight: 800, fontSize: 24, letterSpacing: '0.18em', textTransform: 'uppercase', color: kColor, marginBottom: 14 }}>{kicker}</div>}
        <div style={{ fontWeight: 900, fontSize: size, color, lineHeight: 1.06, letterSpacing: '-0.03em', paddingBottom: '0.06em' }}>{text}</div>
      </div>
    </AbsoluteFill>
  )
}
const Stamp: React.FC<{ text: string; at: number; color?: string; x?: number; y?: number; rot?: number; size?: number }> = ({ text, at, color = CLAY, x = 1320, y = 150, rot = -8, size = 38 }) => {
  const frame = useCurrentFrame()
  const p = clamp(spring({ frame: frame - at, fps: FPS, config: { damping: 9, stiffness: 300 } }), 0, 1.3)
  if (frame < at) return null
  return <div style={{ position: 'absolute', left: x, top: y, transform: `rotate(${rot}deg) scale(${2 - p})`, opacity: clamp(p, 0, 1), border: `6px solid ${color}`, color, borderRadius: 10, padding: '8px 22px', fontWeight: 900, fontSize: size, letterSpacing: '0.06em', textTransform: 'uppercase', background: `${WHITE}e6`, zIndex: 20, whiteSpace: 'nowrap' }}>{text}</div>
}
/** An app window frame — the product lives inside these. */
const Win: React.FC<{ x: number; y: number; w: number; h: number; at: number; title?: string; children: React.ReactNode; rot?: number; z?: number; bg?: string }> = ({ x, y, w, h, at, title = 'jordyn.app', children, rot = 0, z = 1, bg = WHITE }) => {
  const frame = useCurrentFrame()
  const p = pop(frame, at, 13)
  const drift = Math.sin((frame + at) * 0.03) * 3
  return (
    <div style={{ position: 'absolute', left: x, top: y + drift, width: w, height: h, zIndex: z, background: bg, borderRadius: 10, boxShadow: '0 30px 60px rgba(61,57,41,0.22), 0 4px 12px rgba(61,57,41,0.12)', overflow: 'hidden', opacity: clamp(p * 2, 0, 1), transform: `scale(${0.7 + 0.3 * clamp(p, 0, 1.05)}) rotate(${rot * (2 - clamp(p, 0, 1))}deg)`, transformOrigin: '50% 60%' }}>
      <div style={{ height: 34, background: PAPER, display: 'flex', alignItems: 'center', gap: 7, padding: '0 14px', borderBottom: `1px solid #e6e2d8` }}>
        {['#f0a58c', '#f3d07d', '#a9c48f'].map((c) => <div key={c} style={{ width: 10, height: 10, borderRadius: 5, background: c }} />)}
        <div style={{ marginLeft: 10, fontSize: 13, fontWeight: 600, color: FAINT }}>{title}</div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 34, bottom: 0 }}>{children}</div>
    </div>
  )
}
/** Letter-by-letter typing. */
const Type: React.FC<{ text: string; at: number; cps?: number; style?: React.CSSProperties; cursor?: boolean }> = ({ text, at, cps = 1.4, style, cursor = true }) => {
  const frame = useCurrentFrame()
  const n = clamp(Math.floor((frame - at) * cps), 0, text.length)
  const done = n >= text.length
  return <span style={style}>{text.slice(0, n)}{cursor && !done && frame >= at && <span style={{ opacity: Math.floor(frame / 8) % 2 ? 0 : 1 }}>|</span>}</span>
}
const JAvatar: React.FC<{ size?: number }> = ({ size = 30 }) => <div style={{ width: size, height: size, borderRadius: size / 2, background: CLAY, color: WHITE, fontWeight: 900, fontSize: size * 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>J</div>

// ---- BEAT 1 — the problem: the inbox piles up while the phone rings -------------
const ProblemBeat: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const subjects = ['Re: revised quote?', 'Following up (3rd time)', 'Estimate #204', 'Renewal — Alvarez', 'Can we move Tuesday?', 'Signed forms attached', 'URGENT: closing docs', 'Re: Re: Re: invoice', 'Quick question', 'Are you there??', 'Chen file update', 'Newsletter: 9 tips']
  const n = clamp(Math.floor(frame / 3), 0, 60)
  const ring = frame > hold * 0.45 ? Math.sin(frame * 1.4) * 6 : 0
  const missed = clamp(Math.floor((frame - hold * 0.45) / 10), 0, 4)
  const zoom = 1 + interpolate(frame, [hold - 18, hold - 4], [0, 0.18], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  return (
    <Ground bg={PEACH}>
      <Alive intensity={0.8}>
        <AbsoluteFill style={{ transform: `scale(${zoom})`, transformOrigin: '45% 55%' }}>
          <Win x={200} y={250} w={980} h={620} at={2} title="Inbox — 6:52 AM">
            <div style={{ position: 'absolute', left: 0, top: 0, right: 0, padding: '14px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ece8de', background: WHITE, zIndex: 2 }}>
              <div style={{ fontWeight: 900, fontSize: 26 }}>Inbox</div>
              <div style={{ background: CLAY, color: WHITE, fontWeight: 900, fontSize: 22, padding: '4px 14px', borderRadius: 8, transform: `scale(${1 + (n % 3 === 0 ? 0.08 : 0)})` }}>{n} unread</div>
            </div>
            {Array.from({ length: Math.min(n, 12) }, (_, i) => {
              const at = i * 3; const p = pop(frame, at, 14)
              return (
                <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: 66 + i * 44, height: 44, display: 'flex', alignItems: 'center', gap: 16, padding: '0 22px', borderBottom: '1px solid #f1eee6', background: i % 2 ? '#fdfcfa' : WHITE, opacity: clamp(p * 2, 0, 1), transform: `translateX(${(1 - clamp(p, 0, 1)) * -60}px)` }}>
                  <div style={{ width: 10, height: 10, borderRadius: 5, background: CLAY }} />
                  <div style={{ fontWeight: 800, fontSize: 18, width: 170 }}>{['Chen', 'Wilson', 'Ortiz', 'Alvarez', 'Maria', 'Dana', 'Title Co.', 'Martinez', 'Sam', 'Lee', 'Chen', 'Promo'][i]}</div>
                  <div style={{ fontWeight: 600, fontSize: 18, color: MUTE, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden' }}>{subjects[i]}</div>
                  <div style={{ fontSize: 14, color: FAINT }}>{6 - Math.floor(i / 3)}:{(52 - i * 4 + 60) % 60 < 10 ? '0' : ''}{(52 - i * 4 + 60) % 60} AM</div>
                </div>
              )
            })}
          </Win>
          {/* the phone */}
          <div style={{ position: 'absolute', left: 1290, top: 300, width: 300, height: 560, background: INK, borderRadius: 10, boxShadow: '0 40px 80px rgba(61,57,41,0.35)', transform: `rotate(${ring}deg)`, opacity: clamp(pop(frame, 10) * 2, 0, 1) }}>
            <div style={{ position: 'absolute', left: 16, right: 16, top: 16, bottom: 16, background: '#2a271d', borderRadius: 8, padding: 24, color: WHITE }}>
              <div style={{ fontSize: 14, color: '#b5b0a2', fontWeight: 600 }}>{frame > hold * 0.45 ? 'Incoming call' : 'Tuesday 6:52 AM'}</div>
              <div style={{ fontWeight: 900, fontSize: 28, marginTop: 8 }}>{frame > hold * 0.45 ? 'Unknown caller' : '4 missed'}</div>
              {missed > 0 && <div style={{ position: 'absolute', right: -14, top: -14, background: CLAY, color: WHITE, fontWeight: 900, fontSize: 22, width: 44, height: 44, borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{missed}</div>}
              <div style={{ position: 'absolute', left: 24, right: 24, bottom: 30, display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ width: 70, height: 70, borderRadius: 35, background: '#d9534f' }} /><div style={{ width: 70, height: 70, borderRadius: 35, background: SAGE }} />
              </div>
            </div>
          </div>
          {/* sticky notes */}
          {[['call Chen back', 1250, 900, -6], ['Alvarez renewal??', 1600, 400, 5], ['invoice Ortiz', 1520, 910, 4]].map(([t, x, y, r], i) => {
            const p = pop(frame, 20 + i * 8, 10)
            return <div key={i} style={{ position: 'absolute', left: x as number, top: y as number, width: 200, padding: '16px 18px', background: '#fbe9a6', color: INK, fontWeight: 700, fontSize: 22, boxShadow: '0 12px 24px rgba(61,57,41,0.25)', transform: `rotate(${r as number}deg) scale(${clamp(p, 0, 1.1)})`, opacity: clamp(p * 2, 0, 1), fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>{t}</div>
          })}
        </AbsoluteFill>
      </Alive>
      <Head pos="top" size={68} at={2} text={<>Sixty emails before coffee. <span style={{ color: CLAY }}>Again.</span></>} />
      <SettleSweep color={WHITE} hold={hold} />
    </Ground>
  )
}

// ---- BEAT 2 — logo slam + "Meet Jordyn." ----------------------------------------
const SlamBeat: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const p = clamp(spring({ frame: frame - 2, fps: FPS, config: { damping: 11, stiffness: 240, mass: 0.9 } }), 0, 1)
  const ring = clamp((frame - 6) / 22, 0, 1)
  const bursts = Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * Math.PI * 2; const d = ring * (380 + (i % 3) * 90); return <div key={i} style={{ position: 'absolute', left: 960 + Math.cos(a) * d, top: 470 + Math.sin(a) * d, width: 18, height: 18, borderRadius: 4, background: [CLAY, PEACH, SAGE, WHITE][i % 4], opacity: 1 - ring, transform: `rotate(${ring * 300}deg)` }} /> })
  const words = ['Email.', 'Phone.', 'Paperwork.', 'Handled.']
  return (
    <Ground bg={INK}>
      <Alive intensity={0.6}>
        {frame > 6 && bursts}
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', paddingBottom: 150 }}>
          <div style={{ transform: `scale(${3 - 2 * p})`, opacity: clamp(p * 3, 0, 1), background: CREAM, padding: '40px 70px', borderRadius: 10, boxShadow: '0 30px 80px rgba(0,0,0,0.5)' }}>
            <Img src={J('logo.png')} style={{ width: 760, display: 'block' }} />
          </div>
        </AbsoluteFill>
      </Alive>
      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', padding: '0 0 90px' }}>
        <div style={{ textAlign: 'center', maxWidth: 1600 }}>
          <div style={{ fontWeight: 800, fontSize: 24, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#e8a58c', marginBottom: 14, opacity: clamp(pop(frame, 14) * 1.5, 0, 1) }}>AI digital employees are here</div>
          <div style={{ fontWeight: 900, fontSize: 66, color: WHITE, lineHeight: 1.06, letterSpacing: '-0.03em', paddingBottom: '0.06em' }}>
            {words.map((w, i) => {
              const at = sustained(i, words.length, Math.round(hold * 0.8), 34)
              const q = pop(frame, at, 11)
              return <span key={w} style={{ display: 'inline-block', margin: '0 12px', color: i === 3 ? '#e8a58c' : WHITE, opacity: clamp(q * 2, 0, 1), transform: `translateY(${(1 - clamp(q, 0, 1)) * 30}px) scale(${0.9 + 0.1 * clamp(q, 0, 1)})` }}>{w}</span>
            })}
          </div>
        </div>
      </AbsoluteFill>
      <SettleSweep color={CLAY} hold={hold} />
    </Ground>
  )
}

// ---- BEAT 3 — the brain installs: type an industry, knowledge chips lock in ----
const BrainBeat: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const chips = ['Contingency dates', 'Escrow & title', 'Listing agreements', 'Lender follow-ups', 'Inspection windows', 'Closing checklist', 'Disclosures', 'Open-house leads', 'Commission splits', 'MLS vocabulary', 'Buyer reps', 'Appraisal gaps']
  const installAt = 40
  const prog = clamp((frame - installAt) / (hold * 0.55), 0, 1)
  const cx = 1330, cy = 440
  return (
    <Ground bg={CREAM}>
      <Alive>
        <Win x={120} y={230} w={760} h={330} at={2} title="Sign up — one question">
          <div style={{ padding: 30 }}>
            <div style={{ fontWeight: 800, fontSize: 24, color: MUTE }}>What industry are you in?</div>
            <div style={{ marginTop: 16, border: `3px solid ${frame < installAt ? CLAY : '#e6e2d8'}`, borderRadius: 8, padding: '16px 20px', fontWeight: 900, fontSize: 40, minHeight: 84 }}><Type text="real estate" at={6} cps={0.55} /></div>
            <div style={{ marginTop: 18, display: 'inline-block', background: prog > 0 ? SAGE : CLAY, color: WHITE, fontWeight: 800, fontSize: 22, padding: '12px 22px', borderRadius: 8, transform: `scale(${1 - (frame > installAt - 3 && frame < installAt + 3 ? 0.08 : 0)})` }}>{prog >= 1 ? '✓ Brain installed' : prog > 0 ? `Installing brain… ${Math.round(prog * 100)}%` : 'Install Jordyn’s brain →'}</div>
          </div>
        </Win>
        {/* the brain: a ring of chips flying in and locking around the J */}
        <div style={{ position: 'absolute', left: cx - 110, top: cy - 110, width: 220, height: 220, borderRadius: 110, background: CLAY, color: WHITE, fontWeight: 900, fontSize: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 0 ${prog * 26}px rgba(201,100,66,0.15), 0 30px 60px rgba(61,57,41,0.25)`, transform: `scale(${0.6 + 0.4 * pop(frame, installAt - 10, 10)})`, opacity: clamp(pop(frame, installAt - 10) * 2, 0, 1) }}>J</div>
        {chips.map((c, i) => {
          const at = installAt + 4 + i * Math.round((hold * 0.5) / chips.length)
          const p = pop(frame, at, 12)
          const a = (i / chips.length) * Math.PI * 2 - Math.PI / 2
          const r = 265 + (i % 2) * 95
          const tx = cx + Math.cos(a) * r, ty = cy + Math.sin(a) * r
          const fx = tx + Math.cos(a) * 900 * (1 - clamp(p, 0, 1)), fy = ty + Math.sin(a) * 600 * (1 - clamp(p, 0, 1))
          return <div key={c} style={{ position: 'absolute', left: fx, top: fy, transform: `translate(-50%,-50%) rotate(${(1 - clamp(p, 0, 1)) * 40}deg)`, opacity: clamp(p * 2, 0, 1), background: WHITE, border: `2px solid ${PEACH}`, color: INK, fontWeight: 800, fontSize: 18, padding: '8px 14px', borderRadius: 8, boxShadow: '0 12px 24px rgba(61,57,41,0.15)', whiteSpace: 'nowrap' }}>{c}</div>
        })}
        <Stamp text="Speaks real estate" at={installAt + Math.round(hold * 0.52)} x={520} y={470} rot={-6} />
        {/* other industries, cycling small */}
        <div style={{ position: 'absolute', left: 120, top: 640, display: 'flex', gap: 14, flexWrap: 'wrap', width: 760 }}>
          {['Insurance', 'Law', 'HVAC', 'Dental', 'Accounting', 'Consulting', 'Anything you type'].map((t, i) => {
            const p = pop(frame, 20 + i * 5, 12)
            return <div key={t} style={{ background: i === 6 ? INK : PEACH, color: i === 6 ? WHITE : INK, fontWeight: 800, fontSize: 22, padding: '10px 18px', borderRadius: 8, opacity: clamp(p * 2, 0, 1), transform: `scale(${clamp(p, 0, 1.1)})` }}>{t}</div>
          })}
        </div>
      </Alive>
      <Head pos="bottom" at={6} size={56} kicker="The swappable brain" text={<>Type your industry. <span style={{ color: CLAY }}>Her brain installs in seconds.</span></>} />
      <SettleSweep color={WHITE} hold={hold} />
    </Ground>
  )
}

// ---- BEAT 4 — morning briefing: swept overnight, three things need you --------
const BriefingBeat: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const items = [['Chen asked for the revised quote', 'reply drafted'], ['Estimate #204 — 6 days, no reply', 'chase drafted'], ['Renewal window opens for Alvarez', 'on your calendar']]
  return (
    <Ground bg={PEACH}>
      <Alive>
        <Win x={360} y={200} w={1200} h={560} at={2} title="Today — 7:02 AM">
          <div style={{ padding: '30px 40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}><JAvatar size={40} /><div style={{ fontWeight: 900, fontSize: 40 }}>Good morning, Sam.</div></div>
            <div style={{ marginTop: 10, fontWeight: 700, fontSize: 22, color: MUTE }}>Swept <span style={{ color: CLAY, fontWeight: 900 }}><CountUp to={60} decimals={0} startAt={8} dur={24} /></span> emails and 2 inboxes overnight · <span style={{ color: SAGE, fontWeight: 900 }}>3 need you</span></div>
            {items.map(([t, tag], i) => {
              const at = sustained(i, items.length, Math.round(hold * 0.7), 24)
              const p = pop(frame, at, 13)
              return (
                <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 22, padding: '18px 22px', background: PAPER, borderRadius: 8, opacity: clamp(p * 2, 0, 1), transform: `translateX(${(1 - clamp(p, 0, 1)) * 80}px)` }}>
                  <div style={{ width: 34, height: 34, borderRadius: 17, background: CLAY, color: WHITE, fontWeight: 900, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</div>
                  <div style={{ fontWeight: 800, fontSize: 28, flex: 1 }}>{t}</div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: SAGE, background: WHITE, padding: '6px 12px', borderRadius: 6, opacity: clamp((frame - at - 10) / 8, 0, 1) }}>✓ {tag}</div>
                </div>
              )
            })}
          </div>
        </Win>
        {/* coffee */}
        <Img src={J('illo-hero.png')} style={{ position: 'absolute', left: 60, top: 560, width: 300, borderRadius: 10, transform: `rotate(-5deg) scale(${clamp(pop(frame, 12), 0, 1)})`, boxShadow: '0 20px 40px rgba(61,57,41,0.2)' }} />
      </Alive>
      <Head pos="bottom" at={6} size={56} text={<>Every inbox swept overnight. <span style={{ color: CLAY }}>What needs you is waiting before your coffee.</span></>} />
      <SettleSweep color={WHITE} hold={hold} />
    </Ground>
  )
}

// ---- BEAT 5 — the reply drafts itself in your voice; nothing sends without you ----
const EmailBeat: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const body = 'Hi Dana — thanks for sending the signed forms. I’ve filed them with the Chen file and flagged the appraisal window for Thursday. Want me to send the revised quote today?'
  const doneAt = 8 + Math.ceil(body.length / 2.2)
  const hoverAt = Math.round(hold * 0.7)
  return (
    <Ground bg={CREAM}>
      <Alive>
        <Win x={200} y={150} w={1100} h={640} at={2} title="Reply — Re: signed forms attached">
          <div style={{ padding: '24px 34px' }}>
            <div style={{ fontSize: 20, color: MUTE, fontWeight: 600 }}>To: <span style={{ color: INK, fontWeight: 800 }}>dana@harborlife.com</span></div>
            <div style={{ marginTop: 18, padding: '20px 24px', background: PAPER, borderRadius: 8, minHeight: 250, fontSize: 27, lineHeight: 1.45, fontWeight: 600 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: WHITE, borderRadius: 6, padding: '4px 10px', fontSize: 16, color: CLAY, fontWeight: 800, marginBottom: 12 }}><JAvatar size={20} /> AI draft · in your voice</div><br />
              <Type text={body} at={8} cps={2.2} />
            </div>
            <div style={{ marginTop: 22, display: 'flex', gap: 14, alignItems: 'center' }}>
              {['Polish', 'Shorter', 'Dictate'].map((t) => <div key={t} style={{ fontWeight: 800, fontSize: 20, padding: '10px 18px', borderRadius: 8, border: `2px solid ${PEACH}`, color: MUTE }}>{t}</div>)}
              <div style={{ flex: 1 }} />
              <div style={{ fontWeight: 900, fontSize: 24, padding: '14px 32px', borderRadius: 8, background: frame > hoverAt ? CLAYD : CLAY, color: WHITE, transform: `scale(${frame > hoverAt ? 1.06 : 1})`, boxShadow: frame > hoverAt ? `0 0 0 8px rgba(201,100,66,0.2)` : 'none' }}>Send ↑</div>
            </div>
          </div>
        </Win>
        {/* cursor drifts to Send but stops — it's yours to click */}
        <svg style={{ position: 'absolute', left: interpolate(frame, [doneAt, hoverAt], [1500, 1215], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad) }), top: interpolate(frame, [doneAt, hoverAt], [900, 700], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad) }), width: 44, height: 52, filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.3))', zIndex: 5 }} viewBox="0 0 24 28"><path d="M3 2 L3 22 L8.5 17 L12 26 L15.5 24.5 L12 16 L19 16 Z" fill={INK} stroke={WHITE} strokeWidth="1.5" /></svg>
        <Stamp text="Nothing sends without your OK" at={hoverAt + 4} x={1130} y={560} rot={-7} size={32} />
        <Img src={J('illo-email.png')} style={{ position: 'absolute', left: 1380, top: 130, width: 380, borderRadius: 10, transform: `rotate(4deg) scale(${clamp(pop(frame, 10), 0, 1)})`, boxShadow: '0 20px 40px rgba(61,57,41,0.2)' }} />
      </Alive>
      <Head pos="bottom" at={6} size={56} kicker="A real email client, with AI inside" text={<>Replies drafted in your voice. <span style={{ color: CLAY }}>Every one stays a draft until you hit Send.</span></>} />
      <SettleSweep color={WHITE} hold={hold} />
    </Ground>
  )
}

// ---- BEAT 6 — the phone: Jordyn answers, the caller books a slot mid-call ------
const PhoneBeat: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const lines: [string, string, number][] = [['J', 'Harbor Realty, this is Jordyn — how can I help?', 10], ['C', 'Hi, I’d like to see the Maple St listing this week.', 34], ['J', 'Thursday at 4 is open — shall I book it?', 58], ['C', 'Perfect.', 78], ['J', 'Booked. Confirmation is on its way to your phone.', 90]]
  const bookAt = 96
  const booked = pop(frame, bookAt, 11)
  return (
    <Ground bg={INK}>
      <Alive intensity={0.7}>
        {/* waveform */}
        <div style={{ position: 'absolute', left: 120, top: 150, width: 560, height: 120, display: 'flex', alignItems: 'center', gap: 6 }}>
          {Array.from({ length: 48 }, (_, i) => <div key={i} style={{ flex: 1, height: 10 + Math.abs(Math.sin(frame * 0.35 + i * 0.7)) * 90 * (frame > 6 ? 1 : 0), background: i % 3 ? '#e8a58c' : CLAY, borderRadius: 3 }} />)}
        </div>
        <div style={{ position: 'absolute', left: 120, top: 290, color: WHITE }}>
          <div style={{ fontWeight: 800, fontSize: 20, color: '#e8a58c', letterSpacing: '0.16em', textTransform: 'uppercase' }}>Incoming · (312) 555-0148</div>
          <div style={{ fontWeight: 900, fontSize: 40, marginTop: 6 }}>Answered in your business’s name</div>
        </div>
        {/* transcript */}
        <div style={{ position: 'absolute', left: 120, top: 400, width: 760 }}>
          {lines.map(([who, t, at], i) => {
            const p = pop(frame, at, 13)
            const me = who === 'J'
            return <div key={i} style={{ display: 'flex', gap: 12, justifyContent: me ? 'flex-start' : 'flex-end', marginTop: 12, opacity: clamp(p * 2, 0, 1), transform: `translateY(${(1 - clamp(p, 0, 1)) * 20}px)` }}>
              {me && <JAvatar size={34} />}
              <div style={{ maxWidth: 560, background: me ? CREAM : '#514b3b', color: me ? INK : WHITE, fontWeight: 700, fontSize: 24, padding: '12px 18px', borderRadius: 10 }}>{t}</div>
            </div>
          })}
        </div>
        {/* calendar */}
        <Win x={1040} y={150} w={740} h={560} at={4} title="Calendar — this week">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', height: '100%' }}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d, ci) => (
              <div key={d} style={{ borderRight: '1px solid #ece8de', padding: 10 }}>
                <div style={{ fontWeight: 800, fontSize: 18, color: ci === 3 ? CLAY : MUTE, textAlign: 'center' }}>{d}</div>
                {[[0, 1, '#e9ecdd'], [0, 3, '#e9ecdd'], [1, 0, '#f1e3d8'], [2, 2, '#e9ecdd'], [4, 1, '#f1e3d8']].filter((b) => b[0] === ci).map((b, k) => <div key={k} style={{ marginTop: 14 + (b[1] as number) * 48, height: 40, background: b[2] as string, borderRadius: 6 }} />)}
                {ci === 3 && <div style={{ marginTop: 40, height: 64, background: CLAY, color: WHITE, borderRadius: 6, fontWeight: 900, fontSize: 17, padding: 8, transform: `scale(${clamp(booked, 0, 1.15)})`, opacity: clamp(booked * 2, 0, 1), boxShadow: `0 0 0 ${clamp(booked, 0, 1) * 10}px rgba(201,100,66,0.25)` }}>4:00 PM<br />Maple St showing</div>}
              </div>
            ))}
          </div>
        </Win>
        <Stamp text="18¢ a minute · no seats" at={bookAt + 14} x={1120} y={640} rot={-6} color={SAGE} size={30} />
      </Alive>
      <Head pos="bottom" at={6} size={54} color={WHITE} kColor="#e8a58c" kicker="Your own AI-answered number" text={<>She answers your phone — <span style={{ color: '#e8a58c' }}>and callers book real appointments mid-call.</span></>} />
      <SettleSweep color={CLAY} hold={hold} />
    </Ground>
  )
}

// ---- BEAT 7 — the pipeline builds itself from the inbox --------------------------
const PipelineBeat: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const cols = ['New', 'In progress', 'Won']
  const moveAt = Math.round(hold * 0.45)
  const mv = clamp(spring({ frame: frame - moveAt, fps: FPS, config: { damping: 14, stiffness: 120 } }), 0, 1)
  const csvAt = 14
  return (
    <Ground bg={PEACH}>
      <Alive>
        {/* the email that triggers it */}
        <div style={{ position: 'absolute', left: 90, top: 200, width: 460, background: WHITE, borderRadius: 10, padding: '20px 24px', boxShadow: '0 20px 40px rgba(61,57,41,0.2)', opacity: clamp(pop(frame, 4) * 2, 0, 1), transform: `scale(${clamp(pop(frame, 4), 0, 1.05)})` }}>
          <div style={{ fontSize: 16, color: FAINT, fontWeight: 700 }}>From: Chen · 9:14 AM</div>
          <div style={{ fontWeight: 900, fontSize: 24, marginTop: 4 }}>Re: revised quote</div>
          <div style={{ fontSize: 21, marginTop: 8, color: MUTE, fontWeight: 600 }}>“We’re in. Send the paperwork and let’s close Friday.”</div>
          <div style={{ marginTop: 14, display: 'inline-flex', gap: 8, alignItems: 'center', background: PAPER, borderRadius: 6, padding: '6px 12px', fontWeight: 800, fontSize: 17, color: SAGE, opacity: clamp((frame - moveAt + 6) / 8, 0, 1) }}><JAvatar size={20} /> moved Chen → Won · to-do: send closing docs</div>
        </div>
        {/* the board */}
        <Win x={620} y={150} w={1200} h={560} at={2} title="Pipeline">
          <div style={{ display: 'flex', height: '100%', padding: 20, gap: 20 }}>
            {cols.map((c, ci) => (
              <div key={c} style={{ flex: 1, background: PAPER, borderRadius: 8, padding: 14 }}>
                <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: '0.12em', textTransform: 'uppercase', color: ci === 2 ? SAGE : MUTE }}>{c}</div>
                {[['Wilson', 0, 0], ['Ortiz', 0, 1], ['Martinez ✓', 2, 0], ['Alvarez', 1, 0]].filter((k) => k[1] === ci).map((k, i) => {
                  const p = pop(frame, 10 + i * 6 + ci * 4, 13)
                  return <div key={k[0] as string} style={{ marginTop: 14, background: WHITE, borderRadius: 8, padding: '14px 16px', fontWeight: 800, fontSize: 22, boxShadow: '0 6px 14px rgba(61,57,41,0.08)', opacity: clamp(p * 2, 0, 1), transform: `translateY(${(1 - clamp(p, 0, 1)) * 30}px)` }}>{k[0] as string}</div>
                })}
              </div>
            ))}
          </div>
          {/* the Chen card travels from In progress to Won */}
          <div style={{ position: 'absolute', left: 420 + mv * 386, top: 140 + Math.sin(mv * Math.PI) * -60, width: 346, background: WHITE, borderRadius: 8, padding: '14px 16px', fontWeight: 800, fontSize: 22, boxShadow: `0 ${10 + mv * 20}px ${20 + mv * 30}px rgba(61,57,41,0.2)`, transform: `rotate(${Math.sin(mv * Math.PI) * -6}deg) scale(${1 + Math.sin(mv * Math.PI) * 0.08})`, opacity: clamp(pop(frame, 12) * 2, 0, 1), border: `2px solid ${mv > 0.9 ? SAGE : 'transparent'}` }}>Chen · 12d {mv > 0.9 && <span style={{ color: SAGE }}>✓</span>}</div>
        </Win>
        {/* csv import */}
        <div style={{ position: 'absolute', left: 90, top: 560, width: 460, background: INK, color: WHITE, borderRadius: 10, padding: '18px 24px', opacity: clamp(pop(frame, csvAt) * 2, 0, 1), transform: `translateY(${(1 - clamp(pop(frame, csvAt), 0, 1)) * 40}px)` }}>
          <div style={{ fontSize: 16, color: '#b5b0a2', fontWeight: 700 }}>book-of-business.csv</div>
          <div style={{ fontWeight: 900, fontSize: 34, marginTop: 4 }}><CountUp to={142} decimals={0} startAt={csvAt + 6} dur={30} /> clients in</div>
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>{['Alvarez', 'Chen', 'Martinez', '+138'].map((n, i) => <div key={n} style={{ background: '#514b3b', borderRadius: 6, padding: '4px 10px', fontWeight: 700, fontSize: 16, opacity: clamp(pop(frame, csvAt + 16 + i * 4) * 2, 0, 1) }}>{n}</div>)}</div>
        </div>
        <Stamp text="Self-building pipeline" at={moveAt + 26} x={1150} y={640} rot={-6} />
      </Alive>
      <Head pos="bottom" at={6} size={56} text={<>Deals, decisions and to-dos <span style={{ color: CLAY }}>record themselves from your email.</span></>} />
      <SettleSweep color={WHITE} hold={hold} />
    </Ground>
  )
}

// ---- BEAT 8 — get paid from one sentence -------------------------------------------
const InvoiceBeat: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const invAt = 46, paidAt = Math.round(hold * 0.68)
  const inv = pop(frame, invAt, 12)
  return (
    <Ground bg={CREAM}>
      <Alive>
        {/* chat */}
        <Win x={120} y={170} w={800} h={520} at={2} title="Chat with Jordyn">
          <div style={{ padding: '26px 30px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}><div style={{ background: CLAY, color: WHITE, fontWeight: 800, fontSize: 28, padding: '14px 20px', borderRadius: 10, maxWidth: 600 }}><Type text="Invoice Chen $1,200 for the review" at={6} cps={1.2} /></div></div>
            <div style={{ display: 'flex', gap: 12, marginTop: 20, opacity: clamp(pop(frame, invAt - 6) * 2, 0, 1) }}><JAvatar size={34} /><div style={{ background: PAPER, fontWeight: 700, fontSize: 24, padding: '14px 20px', borderRadius: 10, maxWidth: 600 }}>Done — invoice #1042 sent with a pay-online link. I’ll nudge Chen if it’s unpaid in 5 days.</div></div>
            <div style={{ marginTop: 22, display: 'flex', gap: 14 }}>{['Day 0 ✓', 'Day 5 ✓', 'Day 10'].map((d, i) => <div key={d} style={{ fontWeight: 800, fontSize: 18, padding: '8px 14px', borderRadius: 6, background: i < 2 ? '#e9ecdd' : PAPER, color: i < 2 ? SAGE : FAINT, opacity: clamp(pop(frame, paidAt - 30 + i * 8) * 2, 0, 1) }}>{d}</div>)}</div>
          </div>
        </Win>
        {/* the invoice */}
        <div style={{ position: 'absolute', left: 1040, top: 130, width: 640, height: 600, background: WHITE, borderRadius: 10, boxShadow: '0 40px 80px rgba(61,57,41,0.25)', padding: '36px 40px', opacity: clamp(inv * 2, 0, 1), transform: `translateY(${(1 - clamp(inv, 0, 1)) * 200}px) rotate(${(1 - clamp(inv, 0, 1)) * 8 + 2}deg)` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><Img src={J('logo.png')} style={{ width: 150 }} /><div style={{ fontWeight: 800, fontSize: 18, color: FAINT }}>INVOICE #1042</div></div>
          <div style={{ marginTop: 30, fontSize: 20, color: MUTE, fontWeight: 600 }}>Billed to</div><div style={{ fontWeight: 900, fontSize: 28 }}>Chen Family Trust</div>
          <div style={{ marginTop: 26, borderTop: `2px solid ${PAPER}`, paddingTop: 16, display: 'flex', justifyContent: 'space-between', fontSize: 22, fontWeight: 700 }}><span>Portfolio review</span><span>$1,200.00</span></div>
          <div style={{ marginTop: 26, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}><div style={{ fontWeight: 800, fontSize: 20, color: MUTE }}>Total due</div><div style={{ fontWeight: 900, fontSize: 64, letterSpacing: '-0.03em', lineHeight: 1 }}><CountUp to={1200} prefix="$" decimals={0} startAt={invAt + 6} dur={22} /></div></div>
          <div style={{ marginTop: 28, background: CLAY, color: WHITE, fontWeight: 900, fontSize: 24, padding: '16px', borderRadius: 8, textAlign: 'center' }}>Pay online →</div>
        </div>
        <Stamp text="Paid ✓" at={paidAt} x={1380} y={520} rot={-14} color={SAGE} size={64} />
      </Alive>
      <Head pos="bottom" at={6} size={56} kicker="Stripe invoicing, built in" text={<>Say it once. <span style={{ color: CLAY }}>Branded invoice, pay link, chased until it’s paid.</span></>} />
      <SettleSweep color={WHITE} hold={hold} />
    </Ground>
  )
}

// ---- BEAT 9 — paperwork on your letterhead; edit a sent deck, same link ------------
const PaperworkBeat: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const docs = [['Cover letter', 'PDF', 260, 340, 110, 300, -5], ['Disclosure packet', 'PDF', 260, 340, 400, 260, 3], ['Listing presentation', 'DECK', 460, 280, 700, 290, -2], ['Buyer guide', 'DOCX', 260, 340, 1190, 250, 4], ['Follow-up campaign', '3 emails', 320, 220, 1480, 330, -3]] as const
  const editAt = Math.round(hold * 0.55)
  const e = clamp((frame - editAt) / 14, 0, 1)
  return (
    <Ground bg={PEACH}>
      <Alive>
        {docs.map(([t, k, w, h, x, y, r], i) => {
          const at = sustained(i, docs.length, Math.round(hold * 0.5), 4)
          const p = pop(frame, at, 11)
          const isDeck = i === 2
          return (
            <div key={t} style={{ position: 'absolute', left: x, top: y, width: w, height: h, background: WHITE, borderRadius: 8, boxShadow: '0 24px 48px rgba(61,57,41,0.22)', padding: 18, opacity: clamp(p * 2, 0, 1), transform: `rotate(${r * (2 - clamp(p, 0, 1))}deg) scale(${clamp(p, 0, 1.1)})` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><Img src={J('logo.png')} style={{ width: 70 }} /><div style={{ fontWeight: 800, fontSize: 12, color: CLAY, letterSpacing: '0.1em' }}>{k}</div></div>
              <div style={{ fontWeight: 900, fontSize: isDeck ? 26 : 18, marginTop: 14 }}>{isDeck && e > 0.5 ? 'Listing presentation · v2' : t}</div>
              {isDeck ? (
                <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>{[0, 1, 2, 3].map((n) => <div key={n} style={{ flex: 1, height: 110, borderRadius: 6, background: n === 2 && e > 0.5 ? CLAY : PAPER, transition: 'none', transform: n === 2 ? `scale(${1 + Math.sin(e * Math.PI) * 0.15})` : undefined }} />)}</div>
              ) : Array.from({ length: 6 }, (_, n) => <div key={n} style={{ height: 8, width: `${90 - (n * 17) % 40}%`, background: PAPER, borderRadius: 4, marginTop: 12 }} />)}
              {isDeck && <div style={{ marginTop: 12, fontSize: 15, fontWeight: 700, color: MUTE }}>jordyn.app/p/a8f3 · <span style={{ color: SAGE }}>{e > 0.5 ? 'same link, new version' : 'shared with Chen'}</span></div>}
            </div>
          )
        })}
        <Stamp text="Same link · new version" at={editAt + 12} x={660} y={560} rot={-6} color={SAGE} size={30} />
      </Alive>
      <Head pos="bottom" at={6} size={56} text={<>Letters, PDFs and presentations on your letterhead — <span style={{ color: CLAY }}>edit a sent deck, the link never changes.</span></>} />
      <SettleSweep color={WHITE} hold={hold} />
    </Ground>
  )
}

// ---- BEAT 10 — the money: the stack and the hire fall, $499 slams in --------------
const PriceTagBeat: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const tags = [
    { t: 'The tool stack', p: '$585', per: 'a month — and you still do the work', x: 330, at: 6, rot: -4 },
    { t: 'A human assistant', p: '$3,000+', per: 'a month, plus turnover', x: 1030, at: 20, rot: 3 },
  ]
  const slamAt = Math.round(hold * 0.5)
  const slam = clamp(spring({ frame: frame - slamAt, fps: FPS, config: { damping: 10, stiffness: 260, mass: 1 } }), 0, 1)
  const knock = clamp((frame - slamAt - 2) / 16, 0, 1)
  return (
    <Ground bg={INK}>
      <Alive intensity={0.6}>
        {tags.map((g, i) => {
          const p = pop(frame, g.at, 9)
          const dy = -knock * 900, dx = (i === 0 ? -1 : 1) * knock * 700
          return (
            <div key={g.t} style={{ position: 'absolute', left: g.x + dx, top: 280 - (1 - clamp(p, 0, 1)) * 500 + dy, width: 560, background: WHITE, borderRadius: 10, padding: '22px 26px', boxShadow: '0 30px 60px rgba(0,0,0,0.55)', transform: `rotate(${g.rot * (2 - clamp(p, 0, 1)) + knock * (i === 0 ? -160 : 160)}deg)`, opacity: clamp(p * 2, 0, 1) }}>
              <div style={{ fontWeight: 800, fontSize: 22, color: MUTE }}>{g.t}</div>
              <div style={{ fontWeight: 900, fontSize: 96, color: INK, lineHeight: 1, letterSpacing: '-0.03em', marginTop: 4 }}>{g.p}</div>
              <div style={{ fontWeight: 700, fontSize: 20, color: CLAY, marginTop: 6 }}>{g.per}</div>
            </div>
          )
        })}
        <div style={{ position: 'absolute', left: 410, top: 230, width: 1100, background: CLAY, borderRadius: 10, padding: '30px 40px', textAlign: 'center', boxShadow: '0 50px 100px rgba(0,0,0,0.6)', transform: `scale(${3 - 2 * slam}) rotate(${(1 - slam) * -8 - 2}deg)`, opacity: clamp(slam * 3, 0, 1), color: WHITE }}>
          <div style={{ fontWeight: 800, fontSize: 26, opacity: 0.85 }}>Jordyn · Digital Employee</div>
          <div style={{ display: 'flex', gap: 40, alignItems: 'flex-end', justifyContent: 'center', marginTop: 4 }}>
            <div style={{ fontWeight: 900, fontSize: 170, lineHeight: 1, letterSpacing: '-0.04em' }}>$499</div>
            <div style={{ textAlign: 'left', paddingBottom: 18 }}><div style={{ fontWeight: 800, fontSize: 32 }}>a month</div><div style={{ fontWeight: 700, fontSize: 24, opacity: 0.9 }}>24/7 · no turnover · no benefits</div></div>
          </div>
        </div>
        <Stamp text="14-day free trial" at={slamAt + 26} x={1180} y={620} rot={-8} color={SAGE} />
      </Alive>
      <Head pos="bottom" at={4} size={56} color={WHITE} kicker="Less than the pile of tools" kColor="#e8a58c" text={<>One closed deal <span style={{ color: '#e8a58c' }}>covers years of it.</span></>} />
      <SettleSweep color={CLAY} hold={hold} />
    </Ground>
  )
}

// ---- BEAT 11 — CTA -------------------------------------------------------------------
const CtaBeat: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const p = pop(frame, 2, 12)
  const fade = interpolate(frame, [hold - 14, hold - 2], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <Ground bg={CREAM}>
      <Alive intensity={0.6}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', paddingBottom: 220, opacity: fade }}>
          <div style={{ transform: `scale(${0.6 + 0.4 * p})`, opacity: clamp(p * 2, 0, 1) }}>
            <Img src={J('logo.png')} style={{ width: 760, display: 'block', filter: 'drop-shadow(0 20px 40px rgba(61,57,41,0.2))' }} />
          </div>
        </AbsoluteFill>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 96, textAlign: 'center', opacity: fade }}>
          <div style={{ fontWeight: 900, fontSize: 70, color: INK, letterSpacing: '-0.03em', transform: `translateY(${(1 - pop(frame, 12)) * 30}px)`, opacity: clamp(pop(frame, 12) * 2, 0, 1) }}>Hire your first digital employee.</div>
          <div style={{ marginTop: 22, display: 'inline-block', background: CLAY, color: WHITE, fontWeight: 800, fontSize: 34, padding: '14px 36px', borderRadius: 10, transform: `scale(${pop(frame, 22)})` }}>jordyn.app</div>
          <div style={{ marginTop: 14, fontWeight: 700, fontSize: 22, color: MUTE, opacity: clamp(pop(frame, 30) * 2, 0, 1) }}>14-day free trial · Nothing sends without your OK</div>
        </div>
      </Alive>
    </Ground>
  )
}

// ---- assembly ---------------------------------------------------------------------------
const BEATS: BeatSpec[] = [
  { dur: s(D[0] + 0.9), el: (h) => <ProblemBeat hold={h} /> },
  { dur: s(D[1] + 0.6), el: (h) => <SlamBeat hold={h} />, impact: true },
  { dur: s(D[2] + 0.5), el: (h) => <BrainBeat hold={h} /> },
  { dur: s(D[3] + 0.8), el: (h) => <BriefingBeat hold={h} /> },
  { dur: s(D[4] + 0.9), el: (h) => <EmailBeat hold={h} /> },
  { dur: s(D[5] + 0.4), el: (h) => <PhoneBeat hold={h} /> },
  { dur: s(D[6] + 0.9), el: (h) => <PipelineBeat hold={h} /> },
  { dur: s(D[7] + 0.8), el: (h) => <InvoiceBeat hold={h} /> },
  { dur: s(D[8] + 0.6), el: (h) => <PaperworkBeat hold={h} /> },
  { dur: s(D[9] + 0.4), el: (h) => <PriceTagBeat hold={h} />, impact: true },
  { dur: s(D[10] + 1.6), el: (h) => <CtaBeat hold={h} />, impact: true },
]
const TL = timeline(BEATS, (grid as any).beats)
export const JORDYN_FRAMES = TL.total
export const JORDYN_FPS = FPS

export const Jordyn: React.FC = () => (
  <AbsoluteFill style={{ background: CREAM }}>
    {BEATS.map((b, i) => (
      <Sequence key={i} from={TL.starts[i]} durationInFrames={TL.durs[i] + 6}>
        {b.el(TL.durs[i], i)}
        {i !== 1 && i !== 10 && <LogoBug src="showcase/jordyn/logo.png" width={150} opacity={0.95} />}
        {i > 0 && <StreakWipe color={i % 2 ? WHITE : CLAY} dir={i % 2 ? 1 : -1} dur={10} />}
      </Sequence>
    ))}
    <AudioBed id="jordyn" voice={!('placeholder' in vo)} beats={BEATS} tl={TL} voDur={D} musicFrames={s(100)} loud={0.34} duck={0.12} whoosh={0.22} impacts={BEATS.map((b, i) => b.impact ? TL.starts[i] : -1).filter((f) => f >= 0)} />
  </AbsoluteFill>
)
