import React from 'react'
import { AbsoluteFill, Img, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion'
import { loadFont as loadSpaceGrotesk } from '@remotion/google-fonts/SpaceGrotesk'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import { loadFont as loadJetBrains } from '@remotion/google-fonts/JetBrainsMono'
import svGrid from '../public/smartviewz/beatgrid.json'
import { CountUp, Bar, StreakWipe, Bokeh, Alive, sustained, SettleSweep } from './lib/pizzazz'
import { makeMusicDuck, beatLock, gridToFrames, durationsFromStarts, type VoWindow } from './lib/audio'
import { MusicBed } from './lib/musicbed'
import { Intro, pickIntro } from './lib/intros'

const { fontFamily: DISPLAY } = loadSpaceGrotesk()
const { fontFamily: BODY } = loadInter()
const { fontFamily: MONO } = loadJetBrains()
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const FPS = 30

/* ============================================================================
 * SMARTVIEWZ — autonomous, content-driven commercial. The system read the site
 * and MADE the calls:
 *   · WHAT: an AI intelligence platform for life & annuity agencies. Turns Smart
 *     Office data (or any CSV) into real-time AI dashboards + revenue intelligence.
 *     "Powered by Claude AI." Producers / Supervisors / MGAs.
 *   · THEME: BLIND SPOTS → CLARITY & CONTROL. "You're running your agency on
 *     yesterday's data. Now see everything, live."
 *   · LOOK: premium fintech-SaaS — GOLD (#ddb166) on near-black (#1a1a1a), a
 *     clean live dashboard UI. A SEVENTH distinct style (vs AICEO gold-luxury,
 *     Apex blue, Pubco emerald, SmartScale red, iHost casino, Bloxify game).
 *   · SIGNATURE PIZZAZZ: an ANIMATED DASHBOARD as the hero — metrics count up, a
 *     premium-trend chart draws, compliance lights red/yellow/green, the AI chat
 *     types a plain-English answer, at-risk alerts ping.
 * ==========================================================================*/

const BG = '#111111', BG2 = '#1a1a1a', PANEL = '#1e1e1e', LINE = '#2c2c2c'
const GOLD = '#ddb166', GOLD_HI = '#f0d29a', GOLD_DEEP = '#c49a4e'
const GREEN = '#22c55e', AMBER = '#eab308', RED = '#ef4444'
const CREAM = '#f5f0e8', WHITE = '#ffffff', MUTE = '#9fa2ad'

const Shot: React.FC<{ src: string; dur: number; focus?: string; kb?: number; dim?: number }> =
({ src, dur, focus = '50% 45%', kb = 1.13, dim = 1 }) => {
  const frame = useCurrentFrame()
  const p = interpolate(frame, [0, dur], [0, 1], { extrapolateRight: 'clamp' })
  const sc = 1.04 + (kb - 1) * p
  const dx = -1.2 * p, dy = 0.6 * p
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: BG }}>
      <Img src={staticFile(`smartviewz/gen/${src}`)} style={{ width: '114%', height: '114%', position: 'absolute', left: '-7%', top: '-7%', objectFit: 'cover', objectPosition: focus, transform: `scale(${sc}) translate(${dx}%,${dy}%)`, filter: `brightness(${0.82 * dim}) contrast(1.1) saturate(1.02)` }} />
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${BG}88, transparent 28%, transparent 55%, ${BG}f2)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(95% 95% at 50% 40%, transparent 45%, ${BG}dd)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(70% 70% at 78% 18%, ${GOLD}16, transparent 45%)`, mixBlendMode: 'screen' }} />
    </AbsoluteFill>
  )
}

const Head: React.FC<{ pre?: string; hot?: string; post?: string; size?: number; hold: number; kicker?: string }> =
({ pre = '', hot = '', post = '', size = 66, hold, kicker }) => {
  const frame = useCurrentFrame()
  const o = interpolate(frame, [0, 8, hold - 10, hold], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const y = interpolate(frame, [0, 14], [16, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  const kO = interpolate(frame, [2, 10], [0, 1], { extrapolateRight: 'clamp' })
  const rule = clamp((frame - 8) / 14, 0, 1)
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 150 }}>
      <div style={{ opacity: o, transform: `translateY(${y}px)`, textAlign: 'center', maxWidth: 1500 }}>
        {kicker && <div style={{ fontFamily: MONO, fontWeight: 600, fontSize: 19, letterSpacing: '0.28em', textTransform: 'uppercase', color: GOLD, marginBottom: 18, opacity: kO }}>{kicker}</div>}
        <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: size, color: CREAM, lineHeight: 1.14, paddingBottom: '0.04em', letterSpacing: '-0.01em', textShadow: '0 4px 30px rgba(0,0,0,0.9)' }}>
          {pre}{hot && <span style={{ color: 'transparent', backgroundImage: `linear-gradient(180deg, ${GOLD_HI}, ${GOLD_DEEP})`, WebkitBackgroundClip: 'text', backgroundClip: 'text' }}>{hot}</span>}{post}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 22 }}>
          <div style={{ width: 130 * rule, height: 2, background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`, boxShadow: `0 0 12px ${GOLD}` }} />
        </div>
      </div>
    </AbsoluteFill>
  )
}

// wordmark: gold "S" tile + "SmartViewz"
const Wordmark: React.FC<{ size?: number }> = ({ size = 90 }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
    <div style={{ width: size, height: size, borderRadius: size * 0.19, background: `linear-gradient(135deg, ${GOLD_HI}, ${GOLD_DEEP})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: DISPLAY, fontWeight: 700, fontSize: size * 0.6, color: BG, boxShadow: `0 0 30px ${GOLD}55` }}>S</div>
    <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: size * 0.72, letterSpacing: '-0.01em', color: WHITE }}>Smart<span style={{ color: GOLD }}>Viewz</span></div>
  </div>
)

// small UI card
const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 14, padding: 24, ...style }}>{children}</div>
)

const s = (sec: number) => Math.round(sec * FPS)
type Beat = { dur: number; vo?: string; el: React.ReactNode }
// VO dur: 1:2.55 2:5.06 3:4.92 4:4.78 5:6.78 6:5.34 7:8.22 8:6.18 9:3.76
const BEATS: Beat[] = [
  // 1 — the problem: yesterday's data
  { dur: s(2.55 + 0.3), vo: 'sv-1', el: <><Shot src="chaos.png" dur={s(2.85)} kb={1.12} />
      <Head pre="Running your agency on " hot="yesterday's data." size={62} hold={s(2.55 + 0.3)} /></> },
  // 2 — the pain (static exports, blind spots)
  { dur: s(5.06 + 0.2), vo: 'sv-2', el: <><Shot src="chaos.png" dur={s(5.26)} kb={1.15} dim={0.85} />
      <Head pre="Static exports. Slow reports. " hot="Blind spots." size={60} hold={s(5.06 + 0.2)} /></> },
  // 3 — meet SmartViewz (wordmark)
  { dur: s(4.92 + 0.4), vo: 'sv-3', el: <MeetCard hold={s(4.92 + 0.4)} /> },
  // 4 — connects fast
  { dur: s(4.78 + 0.2), vo: 'sv-4', el: <ConnectCard hold={s(4.78 + 0.2)} /> },
  // 5 — THE HERO: live dashboard, metrics count up + chart draws
  { dur: s(6.78 + 0.2), vo: 'sv-5', el: <Dashboard hold={s(6.78 + 0.2)} /> },
  // 6 — AI chat, plain English (Claude AI)
  { dur: s(5.34 + 0.2), vo: 'sv-6', el: <ChatCard hold={s(5.34 + 0.2)} /> },
  // 7 — revenue intelligence alerts (at-risk)
  { dur: s(8.22 + 0.2), vo: 'sv-7', el: <AlertsCard hold={s(8.22 + 0.2)} /> },
  // 8 — every role (producers / supervisors / MGAs)
  { dur: s(6.18 + 0.2), vo: 'sv-8', el: <RolesCard hold={s(6.18 + 0.2)} /> },
  // 9 — CTA
  { dur: s(3.76 + 1.6), vo: 'sv-9', el: <CTACard hold={s(3.76 + 1.6)} /> },
]

function MeetCard({ hold }: { hold: number }) {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const pop = spring({ frame: frame - 2, fps, config: { damping: 14, stiffness: 140 } })
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 42%, ${BG2}, ${BG})` }}>
      <Bokeh color={GOLD} count={6} big />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 18 }}>
        <div style={{ transform: `scale(${0.72 + clamp(pop, 0, 1) * 0.28})` }}><Wordmark size={100} /></div>
        <div style={{ fontFamily: BODY, fontWeight: 500, fontSize: 34, color: MUTE, opacity: clamp((frame - 14) / 8, 0, 1) }}>The AI Intelligence Platform for <span style={{ color: GOLD }}>Life & Annuity</span></div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

function ConnectCard({ hold }: { hold: number }) {
  const frame = useCurrentFrame()
  const flow = clamp((frame - 8) / 26, 0, 1)
  const node = (label: string, x: number, on: boolean) => (
    <Card style={{ opacity: on ? 1 : 0.4, transform: `scale(${on ? 1 : 0.94})`, textAlign: 'center', minWidth: 260, boxShadow: on ? `0 0 26px ${GOLD}22` : 'none' }}>
      <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 34, color: on ? CREAM : MUTE }}>{label}</div>
    </Card>
  )
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 40%, ${BG2}, ${BG})` }}>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 40 }}>
        {node('Smart Office', 0, frame > 8)}
        <div style={{ position: 'relative', width: 140, height: 4, background: LINE, borderRadius: 4 }}>
          <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${flow * 100}%`, background: `linear-gradient(90deg, ${GOLD}, ${GOLD_HI})`, borderRadius: 4, boxShadow: `0 0 12px ${GOLD}` }} />
        </div>
        <div style={{ transform: 'scale(1.1)' }}>{node('SmartViewz', 0, frame > 26)}</div>
      </AbsoluteFill>
      <Head kicker="Connects in under 3 minutes" pre="Or upload " hot="any CSV." size={48} hold={hold} />
    </AbsoluteFill>
  )
}

// THE HERO — a live agency dashboard that builds
function Dashboard({ hold }: { hold: number }) {
  const frame = useCurrentFrame()
  const chartPts = [30, 42, 38, 55, 60, 52, 70, 78, 74, 88, 95, 110]
  const chartP = clamp((frame - 20) / 34, 0, 1)
  const shownPts = Math.ceil(chartP * chartPts.length)
  const W = 1580, H = 780
  const metrics: [string, number, string, string][] = [
    ['TOTAL PREMIUM', 2.8, '$', 'M'], ['ACTIVE AGENTS', 387, '', ''], ['POLICIES', 1842, '', ''], ['PIPELINE', 487, '$', 'K'],
  ]
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 30%, ${BG2}, ${BG})` }}>
      <Bokeh color={GOLD} count={5} big />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <Card style={{ width: W, height: H, padding: 32, boxShadow: `0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px ${GOLD}22` }}>
          {/* header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Wordmark size={40} /></div>
            <div style={{ fontFamily: BODY, fontSize: 22, color: MUTE }}>Good morning, Sarah — your agency overview</div>
          </div>
          {/* metric tiles count up */}
          <div style={{ display: 'flex', gap: 20, marginBottom: 24 }}>
            {metrics.map(([label, val, pre, suf], i) => {
              const at = 6 + i * 5
              const o = interpolate(frame, [at, at + 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
              const y = interpolate(frame, [at, at + 10], [16, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
              return (
                <div key={i} style={{ flex: 1, background: BG2, border: `1px solid ${LINE}`, borderRadius: 12, padding: 22, opacity: o, transform: `translateY(${y}px)` }}>
                  <div style={{ fontFamily: MONO, fontSize: 15, color: MUTE, letterSpacing: '0.1em' }}>{label}</div>
                  <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 52, color: GOLD_HI, marginTop: 6, lineHeight: 1.15, paddingBottom: '0.04em' }}>
                    <CountUp to={val} prefix={pre} suffix={suf} startAt={at} dur={20} decimals={pre === '$' && suf === 'M' ? 1 : 0} />
                  </div>
                </div>
              )
            })}
          </div>
          {/* premium trend chart draws */}
          <div style={{ background: BG2, border: `1px solid ${LINE}`, borderRadius: 12, padding: 22, height: 400, position: 'relative' }}>
            <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 22, color: CREAM }}>Premium Trend <span style={{ color: GREEN, fontSize: 18 }}>+12.4% ↑</span></div>
            <svg width="100%" height="320" style={{ marginTop: 10 }} viewBox="0 0 1480 320" preserveAspectRatio="none">
              {[0, 1, 2, 3].map((g) => <line key={g} x1="0" y1={g * 100} x2="1480" y2={g * 100} stroke={LINE} strokeWidth="1" />)}
              <polyline
                points={chartPts.slice(0, shownPts).map((p, i) => `${(i / (chartPts.length - 1)) * 1480},${320 - p * 2.6}`).join(' ')}
                fill="none" stroke={GOLD} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 8px ${GOLD}88)` }} />
              {shownPts > 0 && (() => { const i = shownPts - 1; const px = (i / (chartPts.length - 1)) * 1480; const py = 320 - chartPts[i] * 2.6; return <circle cx={px} cy={py} r="7" fill={GOLD_HI} style={{ filter: `drop-shadow(0 0 10px ${GOLD})` }} /> })()}
            </svg>
          </div>
        </Card>
      </AbsoluteFill>
      <SettleSweep color={GOLD} hold={hold} />
    </AbsoluteFill>
  )
}

// AI chat typing a plain-English answer
function ChatCard({ hold }: { hold: number }) {
  const frame = useCurrentFrame()
  const q = 'Which contracts expire this week?'
  const a = '3 contracts expire this week — $1.2M premium at risk. Want the list?'
  const qShown = Math.floor(clamp((frame - 6) / 20, 0, 1) * q.length)
  const aShown = Math.floor(clamp((frame - 34) / 40, 0, 1) * a.length)
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 40%, ${BG2}, ${BG})` }}>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontFamily: MONO, fontSize: 19, letterSpacing: '0.24em', textTransform: 'uppercase', color: GOLD, marginBottom: 12 }}>{'// Ask anything · Powered by Claude AI'}</div>
        {/* user question */}
        <Card style={{ width: 1000, background: BG2, alignSelf: 'flex-end', marginRight: '18%' }}>
          <div style={{ fontFamily: BODY, fontWeight: 500, fontSize: 30, color: CREAM }}>{q.slice(0, qShown)}{qShown < q.length && frame < 30 ? '▋' : ''}</div>
        </Card>
        {/* AI answer */}
        {frame > 32 && (
          <Card style={{ width: 1000, alignSelf: 'flex-start', marginLeft: '18%', border: `1px solid ${GOLD}44`, boxShadow: `0 0 26px ${GOLD}18` }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ width: 40, height: 40, borderRadius: 9, background: `linear-gradient(135deg, ${GOLD_HI}, ${GOLD_DEEP})`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: DISPLAY, fontWeight: 700, color: BG, fontSize: 22 }}>S</div>
              <div style={{ fontFamily: BODY, fontWeight: 500, fontSize: 30, color: CREAM, lineHeight: 1.35 }}>{a.slice(0, aShown)}{aShown < a.length ? '▋' : ''}</div>
            </div>
          </Card>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

// revenue intelligence alerts ping in
function AlertsCard({ hold }: { hold: number }) {
  const frame = useCurrentFrame()
  const alerts: [string, string, string][] = [
    ['⚠', '3 contracts expiring this week — $1.2M premium at risk', AMBER],
    ['✕', '2 agents flagged for zero production', RED],
    ['●', 'Carrier concentration risk detected — 41% with one carrier', AMBER],
    ['✓', 'Compliance: 384 of 387 agents green', GREEN],
  ]
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 36%, ${BG2}, ${BG})` }}>
      <Bokeh color={GOLD} count={5} big />
      <Alive intensity={0.5}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontFamily: MONO, fontSize: 19, letterSpacing: '0.26em', textTransform: 'uppercase', color: GOLD, marginBottom: 14 }}>{'// Revenue Intelligence'}</div>
          {alerts.map(([ic, text, c], i) => {
            const at = sustained(i, alerts.length, hold, 10)
            const o = interpolate(frame, [at, at + 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
            const x = interpolate(frame, [at, at + 12], [50, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
            const glow = Math.abs(Math.sin(frame * 0.08 + i)) * 16
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 20, opacity: o, transform: `translateX(${x}px)`, background: PANEL, border: `1px solid ${c}55`, borderRadius: 12, padding: '20px 32px', width: 1120, boxShadow: `0 0 ${glow}px ${c}33` }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: `${c}22`, color: c as string, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>{ic}</div>
                <div style={{ fontFamily: BODY, fontWeight: 500, fontSize: 30, color: CREAM }}>{text}</div>
              </div>
            )
          })}
        </AbsoluteFill>
      </Alive>
      <SettleSweep color={GOLD} hold={hold} />
    </AbsoluteFill>
  )
}

function RolesCard({ hold }: { hold: number }) {
  const frame = useCurrentFrame()
  const roles: [string, string][] = [['Producers', 'Your personal command center'], ['Supervisors', 'Manage teams with real data'], ['MGAs & IMOs', 'Enterprise-grade intelligence']]
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Shot src="team.png" dur={hold} kb={1.1} dim={0.55} />
      <AbsoluteFill style={{ background: `${BG}bb` }} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 30 }}>
        <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 54, color: CREAM, opacity: clamp((frame - 4) / 8, 0, 1) }}>One platform. <span style={{ color: GOLD }}>Every role.</span></div>
        <div style={{ display: 'flex', gap: 26 }}>
          {roles.map(([t, d], i) => {
            const at = sustained(i, roles.length, hold, 12)
            const pop = spring({ frame: frame - at, fps: FPS, config: { damping: 12, stiffness: 190 } })
            return (
              <div key={i} style={{ transform: `scale(${clamp(pop, 0, 1)})`, background: PANEL, border: `1px solid ${GOLD}44`, borderRadius: 16, padding: '30px 36px', width: 380, textAlign: 'center', boxShadow: `0 0 26px ${GOLD}18` }}>
                <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 40, color: GOLD_HI }}>{t}</div>
                <div style={{ fontFamily: BODY, fontWeight: 500, fontSize: 24, color: MUTE, marginTop: 8 }}>{d}</div>
              </div>
            )
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

function CTACard({ hold }: { hold: number }) {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const up = spring({ frame: frame - 2, fps, config: { damping: 15, stiffness: 130 } })
  const line = interpolate(frame, [22, 36], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const btn = spring({ frame: frame - 40, fps, config: { damping: 12, stiffness: 180 } })
  const url = interpolate(frame, [58, 70], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const pulse = 1 + Math.sin(frame * 0.12) * 0.02
  return (
    <AbsoluteFill style={{ background: `radial-gradient(130% 120% at 50% 42%, ${BG2}, ${BG})` }}>
      <Bokeh color={GOLD} count={6} big />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
        <div style={{ transform: `scale(${0.74 + clamp(up, 0, 1) * 0.26})` }}><Wordmark size={104} /></div>
        <div style={{ width: 380 * line, height: 2, background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`, marginTop: 28, boxShadow: `0 0 14px ${GOLD}` }} />
        <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 52, color: CREAM, marginTop: 26, textAlign: 'center', opacity: clamp(line, 0, 1) }}>See everything. <span style={{ color: GOLD_HI }}>Miss nothing.</span></div>
        <div style={{ marginTop: 34, opacity: clamp(btn, 0, 1), transform: `scale(${(0.7 + clamp(btn, 0, 1) * 0.3) * pulse})` }}>
          <div style={{ background: `linear-gradient(180deg, ${GOLD_HI}, ${GOLD_DEEP})`, color: BG, fontFamily: DISPLAY, fontWeight: 700, fontSize: 32, letterSpacing: '0.02em', padding: '20px 54px', borderRadius: 12, boxShadow: `0 0 30px ${GOLD}66`, textAlign: 'center' }}>Start Free Trial</div>
        </div>
        <div style={{ fontFamily: MONO, fontWeight: 500, fontSize: 26, color: MUTE, letterSpacing: '0.08em', marginTop: 24, opacity: url }}>smartviewz.com · no credit card required</div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

// EPIC INTRO — director picks by personality. SmartViewz = a data/analytics
// platform → 'terminal' (boots up from code). Prepended; all beats offset by it.
const INTRO = Math.round(3.0 * FPS)
const INTRO_STYLE = pickIntro('data')

// shared beat-lock + ducking plumbing (starts offset by the intro)
const rawStarts: number[] = []; { let t = INTRO; for (const b of BEATS) { rawStarts.push(t); t += b.dur } }
const B_STARTS = beatLock(rawStarts, gridToFrames((svGrid as any).beats, FPS).filter((g) => g >= INTRO), Math.round(0.2 * FPS))
export const smartViewzDuration = B_STARTS[B_STARTS.length - 1] + BEATS[BEATS.length - 1].dur + 6

export const CommercialSmartViewz: React.FC = () => {
  const starts = B_STARTS
  const durs = durationsFromStarts(starts, smartViewzDuration - 6)
  const total = smartViewzDuration
  const voWin = BEATS.map((b, i) => b.vo ? { start: starts[i], end: starts[i] + durs[i] } : null).filter(Boolean) as VoWindow[]
  const musicDuck = makeMusicDuck(voWin, total, { loud: 0.2, duck: 0.08, ramp: 18, fadeInEnd: 14 })
  return (
    <AbsoluteFill style={{ background: BG }}>
      {/* the epic cinematic intro */}
      <Sequence from={0} durationInFrames={INTRO + 2}>
        <Intro style={INTRO_STYLE} dur={INTRO} tokens={{ bg: BG, bg2: BG2, accent: GOLD, accentHi: GOLD_HI }} render={<Wordmark size={120} />} />
      </Sequence>
      {BEATS.map((b, i) => (
        <Sequence key={i} from={starts[i]} durationInFrames={durs[i] + 6}>
          {b.el}
          {i > 0 && <StreakWipe color={GOLD} dir={i % 2 ? 1 : -1} dur={12} />}
        </Sequence>
      ))}
      <MusicBed src="smartviewz/music.mp3" musicFrames={1259} volume={musicDuck} />
      {BEATS.map((b, i) => b.vo ? (
        <Sequence key={'vo' + i} from={starts[i]}><Audio src={staticFile(`smartviewz/${b.vo}.mp3`)} volume={1.0} /></Sequence>
      ) : null)}
      {starts.slice(1).map((st, i) => (
        <Sequence key={'w' + i} from={st - 3} durationInFrames={16}><Audio src={staticFile('sfx/whoosh-short.wav')} volume={0.24} /></Sequence>
      ))}
      <Sequence from={starts[2]} durationInFrames={30}><Audio src={staticFile('sfx/impact.wav')} volume={0.4} /></Sequence>
    </AbsoluteFill>
  )
}
