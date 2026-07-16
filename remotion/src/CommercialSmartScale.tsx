import React from 'react'
import { AbsoluteFill, Img, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion'
import { loadFont as loadSpaceGrotesk } from '@remotion/google-fonts/SpaceGrotesk'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import { loadFont as loadJetBrains } from '@remotion/google-fonts/JetBrainsMono'
import ssGrid from '../public/smartscale/beatgrid.json'
import { StreakWipe, Bokeh, HeroFlash } from './lib/pizzazz'
import { makeMusicDuck, beatLock, gridToFrames, durationsFromStarts, type VoWindow } from './lib/audio'
import { MusicBed } from './lib/musicbed'

const { fontFamily: DISPLAY } = loadSpaceGrotesk()
const { fontFamily: BODY } = loadInter()
const { fontFamily: MONO } = loadJetBrains()
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const FPS = 30

/* ============================================================================
 * SMART SCALE — autonomous, content-driven commercial. The system read all of
 * smartscaleagent.com and MADE the calls:
 *   · THEME: precision / craftsmanship / founder-led — the anti-agency message.
 *     Arc: agency chaos & hand-offs → precision, built without compromise.
 *   · AUDIENCE: businesses that need serious software, burned by typical agencies.
 *   · LOOK: bold RED (#dc2626) on near-black (#0a0a0a) — a precise "engineering
 *     blueprint" aesthetic (mono accents, schematic grid, sharp lines). A FOURTH
 *     distinct style vs. gold-luxury (AICEO), upbeat-blue (Apex), emerald-terminal
 *     (Pubco). Driven by the site's own brand.
 *   · PIZZAZZ fit: it's about BUILDING → blueprint draw-on, the 5-step process
 *     rail, a tech-stack ticker (TS/React/Next/Node/Python), real client logos.
 * ==========================================================================*/

const BG = '#0a0a0a', BG2 = '#141414', PANEL = '#171717'
const RED = '#dc2626', RED_HI = '#f04444', RED_DEEP = '#991b1b'
const WHITE = '#f5f5f5', MUTE = '#8a8a8a', LINE = '#2a2a2a'

// blueprint grid that subtly draws/drifts — the engineering texture
const Blueprint: React.FC<{ live?: boolean }> = ({ live = true }) => {
  const frame = useCurrentFrame()
  const draw = live ? clamp(frame / 24, 0, 1) : 1
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', opacity: 0.5 * draw }}>
      <AbsoluteFill style={{ backgroundImage: `linear-gradient(${RED}12 1px, transparent 1px), linear-gradient(90deg, ${RED}12 1px, transparent 1px)`, backgroundSize: '80px 80px', backgroundPosition: `${(frame * 0.2) % 80}px 0` }} />
      <AbsoluteFill style={{ backgroundImage: `linear-gradient(${WHITE}06 1px, transparent 1px), linear-gradient(90deg, ${WHITE}06 1px, transparent 1px)`, backgroundSize: '20px 20px' }} />
    </AbsoluteFill>
  )
}

const Shot: React.FC<{ src: string; dur: number; focus?: string; kb?: number; dim?: number; glitch?: boolean }> =
({ src, dur, focus = '50% 45%', kb = 1.14, dim = 1, glitch = false }) => {
  const frame = useCurrentFrame()
  const p = interpolate(frame, [0, dur], [0, 1], { extrapolateRight: 'clamp' })
  const sc = 1.05 + (kb - 1) * p
  const jit = glitch ? (Math.sin(frame * 2.1) * 2 + (frame % 7 < 1 ? 6 : 0)) : 0
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: BG }}>
      <Img src={staticFile(`smartscale/gen/${src}`)} style={{ width: '114%', height: '114%', position: 'absolute', left: '-7%', top: '-7%', objectFit: 'cover', objectPosition: focus, transform: `scale(${sc}) translateX(${jit}px)`, filter: `brightness(${(glitch ? 0.7 : 0.84) * dim}) contrast(1.16) saturate(${glitch ? 1.15 : 1.05})` }} />
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${BG}88, transparent 28%, transparent 55%, ${BG}f2)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(95% 95% at 50% 40%, transparent 45%, ${BG}dd)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(80% 80% at 15% 85%, ${RED}14, transparent 42%)`, mixBlendMode: 'screen' }} />
    </AbsoluteFill>
  )
}

// headline — grotesk display, red key phrase, precise mono kicker with // prefix
const Head: React.FC<{ pre?: string; hot?: string; post?: string; size?: number; hold: number; kicker?: string; align?: 'center' | 'left' }> =
({ pre = '', hot = '', post = '', size = 74, hold, kicker, align = 'center' }) => {
  const frame = useCurrentFrame()
  const o = interpolate(frame, [0, 8, hold - 10, hold], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  // mask-wipe reveal from the left
  const wipe = interpolate(frame, [2, 16], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  const kO = interpolate(frame, [2, 10], [0, 1], { extrapolateRight: 'clamp' })
  const rule = clamp((frame - 8) / 14, 0, 1)
  const isL = align === 'left'
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: isL ? 'flex-start' : 'center', paddingBottom: 150, paddingLeft: isL ? 120 : 0 }}>
      <div style={{ opacity: o, textAlign: isL ? 'left' : 'center', maxWidth: 1500 }}>
        {kicker && <div style={{ fontFamily: MONO, fontWeight: 600, fontSize: 20, letterSpacing: '0.28em', textTransform: 'uppercase', color: RED, marginBottom: 20, opacity: kO }}>{'// '}{kicker}</div>}
        <div style={{ overflow: 'hidden' }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: size, color: WHITE, lineHeight: 1.08, letterSpacing: '-0.015em', textShadow: '0 4px 30px rgba(0,0,0,0.9)', clipPath: `inset(0 ${100 - wipe}% 0 0)` }}>
            {pre}{hot && <span style={{ color: RED_HI, textShadow: `0 0 24px ${RED}66` }}>{hot}</span>}{post}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: isL ? 'flex-start' : 'center', marginTop: 24 }}>
          <div style={{ width: 140 * rule, height: 2, background: `linear-gradient(90deg, ${isL ? RED : 'transparent'}, ${RED_HI}, transparent)`, boxShadow: `0 0 12px ${RED}` }} />
        </div>
      </div>
    </AbsoluteFill>
  )
}

// wordmark — red mark + "SMART SCALE" grotesk
const Wordmark: React.FC<{ size?: number; showMark?: boolean }> = ({ size = 90, showMark = true }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
    {showMark && <Img src={staticFile('smartscale/logo.png')} style={{ width: size * 1.15, height: size * 1.15, objectFit: 'contain', filter: `drop-shadow(0 0 20px ${RED}66)` }} />}
    <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: size, letterSpacing: '0.02em', color: WHITE, lineHeight: 0.9 }}>
      SMART<br /><span style={{ color: RED_HI }}>SCALE</span>
    </div>
  </div>
)

const s = (sec: number) => Math.round(sec * FPS)
type Beat = { dur: number; vo?: string; el: React.ReactNode }
// VO dur: 1:4.32 2:4.55 3:2.23 4:8.64 5:7.24 6:6.46 7:5.62 8:5.02 9:4.32
const BEATS: Beat[] = [
  { dur: s(1.2), el: <Shot src="chaos.png" dur={s(1.2)} glitch kb={1.1} /> },
  // 1 — the problem: agencies overpromise
  { dur: s(4.32 + 0.2), vo: 'sc-1', el: <><Shot src="chaos.png" dur={s(4.5)} glitch kb={1.14} />
      <Head pre="Most agencies " hot="overpromise." size={72} hold={s(4.32 + 0.2)} /></> },
  // 2 — the pain: hand-offs, middle layers
  { dur: s(4.55 + 0.2), vo: 'sc-2', el: <><Shot src="chaos.png" dur={s(4.8)} glitch kb={1.16} dim={0.85} />
      <Head pre="Account managers. Middle layers. " hot="Excuses." size={62} hold={s(4.55 + 0.2)} /></> },
  // 3 — the turn: built differently (wordmark)
  { dur: s(2.23 + 0.8), vo: 'sc-3', el: <TurnCard hold={s(2.23 + 0.8)} /> },
  // 4 — founder-led (the differentiator, real cinematic shot)
  { dur: s(8.64 + 0.2), vo: 'sc-4', el: <><Shot src="founder.png" dur={s(8.9)} kb={1.12} focus="55% 40%" />
      <Head kicker="Founder-led execution" pre="Led directly by the " hot="founders." post=" No middle layers." size={58} hold={s(8.64 + 0.2)} align="left" /></> },
  // 5 — capabilities (blueprint)
  { dur: s(7.24 + 0.2), vo: 'sc-5', el: <Capabilities hold={s(7.24 + 0.2)} /> },
  // 6 — the process rail (5 steps)
  { dur: s(6.46 + 0.2), vo: 'sc-6', el: <ProcessRail hold={s(6.46 + 0.2)} /> },
  // 7 — AI-powered / faster (build)
  { dur: s(5.62 + 0.2), vo: 'sc-7', el: <><Shot src="build.png" dur={s(5.9)} kb={1.13} />
      <Head kicker="AI-enhanced workflows" pre="Faster — " hot="without cutting corners." size={58} hold={s(5.62 + 0.2)} /></> },
  // 8 — the positioning + client proof
  { dur: s(5.02 + 0.2), vo: 'sc-8', el: <ClientProof hold={s(5.02 + 0.2)} /> },
  // 9 — CTA
  { dur: s(4.32 + 1.6), vo: 'sc-9', el: <CTACard hold={s(4.32 + 1.6)} /> },
]

function TurnCard({ hold }: { hold: number }) {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const pop = spring({ frame: frame - 2, fps, config: { damping: 13, stiffness: 170 } })
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 45%, ${BG2}, ${BG})` }}>
      <Blueprint />
      <HeroFlash color={RED} at={2} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 20 }}>
        <div style={{ transform: `scale(${0.7 + clamp(pop, 0, 1) * 0.3})` }}><Wordmark size={104} /></div>
        <div style={{ fontFamily: MONO, fontSize: 30, color: MUTE, letterSpacing: '0.14em', opacity: clamp((frame - 14) / 8, 0, 1) }}>is built differently.</div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

function Capabilities({ hold }: { hold: number }) {
  const frame = useCurrentFrame()
  const caps = ['Web Platforms', 'Mobile Apps', 'AI Systems', 'Enterprise', 'Integrations']
  const stack = ['TypeScript', 'React', 'Next.js', 'Node.js', 'Python', 'PostgreSQL']
  const tickerX = -(frame * 3) % 1200
  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, ${BG2}, ${BG})` }}>
      <Blueprint live={false} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 44 }}>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 1500 }}>
          {caps.map((c, i) => {
            const at = 6 + i * 8
            const o = interpolate(frame, [at, at + 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
            const y = interpolate(frame, [at, at + 10], [20, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
            return (
              <div key={i} style={{ opacity: o, transform: `translateY(${y}px)`, background: PANEL, border: `1px solid ${RED}33`, borderRadius: 10, padding: '22px 34px', fontFamily: DISPLAY, fontWeight: 600, fontSize: 38, color: WHITE, boxShadow: `0 0 20px ${RED}14` }}>
                <span style={{ color: RED_HI, fontFamily: MONO, fontSize: 26 }}>{String(i + 1).padStart(2, '0')} </span>{c}
              </div>
            )
          })}
        </div>
        {/* tech-stack ticker */}
        <div style={{ overflow: 'hidden', width: '80%', opacity: interpolate(frame, [30, 42], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>
          <div style={{ display: 'flex', gap: 50, transform: `translateX(${tickerX}px)`, whiteSpace: 'nowrap' }}>
            {[...stack, ...stack, ...stack].map((t, i) => (
              <span key={i} style={{ fontFamily: MONO, fontSize: 28, color: MUTE, letterSpacing: '0.05em' }}>{t}<span style={{ color: RED, margin: '0 25px' }}>·</span></span>
            ))}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

function ProcessRail({ hold }: { hold: number }) {
  const frame = useCurrentFrame()
  const steps = ['Discovery', 'Architecture', 'Engineering', 'Validation', 'Deployment']
  const lineGrow = clamp((frame - 8) / 40, 0, 1)
  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, ${BG2}, ${BG})` }}>
      <Blueprint />
      <Bokeh color={RED} count={6} big />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
        <div style={{ fontFamily: MONO, fontSize: 20, letterSpacing: '0.28em', color: RED, textTransform: 'uppercase', marginBottom: 50 }}>{'// A deliberate process'}</div>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 0 }}>
          {/* connecting rail that draws across */}
          <div style={{ position: 'absolute', top: '50%', left: 40, right: 40, height: 2, background: LINE }} />
          <div style={{ position: 'absolute', top: '50%', left: 40, width: `calc((100% - 80px) * ${lineGrow})`, height: 2, background: `linear-gradient(90deg, ${RED}, ${RED_HI})`, boxShadow: `0 0 12px ${RED}` }} />
          {steps.map((st, i) => {
            const at = 8 + i * 9
            const pop = spring({ frame: frame - at, fps: FPS, config: { damping: 12, stiffness: 200 } })
            const o = interpolate(frame, [at, at + 6], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
            return (
              <div key={i} style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', width: 260, opacity: o, transform: `scale(${clamp(pop, 0, 1)})` }}>
                <div style={{ width: 66, height: 66, borderRadius: '50%', background: BG, border: `2px solid ${RED}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontWeight: 700, fontSize: 24, color: RED_HI, boxShadow: `0 0 20px ${RED}55` }}>{String(i + 1).padStart(2, '0')}</div>
                <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 26, color: WHITE, marginTop: 16 }}>{st}</div>
              </div>
            )
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

function ClientProof({ hold }: { hold: number }) {
  const frame = useCurrentFrame()
  const clients = ['botmakers', 'bloxify', 'gulf-coast-alloys', 'valor-financial', 'apex-affinity']
  const headO = interpolate(frame, [4, 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 40%, ${BG2}, ${BG})` }}>
      <Blueprint live={false} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 30 }}>
        <div style={{ textAlign: 'center', opacity: headO }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 60, color: WHITE }}>Enterprise quality.</div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 60, color: RED_HI }}>Boutique attention.</div>
        </div>
        <div style={{ fontFamily: MONO, fontSize: 18, color: MUTE, letterSpacing: '0.24em', textTransform: 'uppercase', marginTop: 14, opacity: interpolate(frame, [hold - 60, hold - 48], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>Trusted by forward-thinking companies</div>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          {clients.map((c, i) => {
            const at = hold - 52 + i * 6
            const pop = interpolate(frame, [at, at + 10], [0.4, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(2)) })
            const o = interpolate(frame, [at, at + 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
            return (
              <div key={i} style={{ background: '#ffffff', borderRadius: 10, padding: '18px 26px', height: 84, display: 'flex', alignItems: 'center', opacity: o, transform: `scale(${pop})`, boxShadow: '0 6px 20px rgba(0,0,0,0.4)' }}>
                <Img src={staticFile(`smartscale/clients/${c}.png`)} style={{ height: 48, width: 'auto', objectFit: 'contain' }} />
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
  const btn = spring({ frame: frame - 42, fps, config: { damping: 12, stiffness: 180 } })
  const url = interpolate(frame, [60, 72], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const pulse = 1 + Math.sin(frame * 0.12) * 0.02
  return (
    <AbsoluteFill style={{ background: `radial-gradient(130% 120% at 50% 42%, ${BG2}, ${BG})` }}>
      <Blueprint />
      <Bokeh color={RED} count={5} big />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
        <div style={{ transform: `scale(${0.74 + clamp(up, 0, 1) * 0.26})` }}><Wordmark size={96} /></div>
        <div style={{ width: 360 * line, height: 2, background: `linear-gradient(90deg, transparent, ${RED}, transparent)`, marginTop: 30, boxShadow: `0 0 14px ${RED}` }} />
        <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 44, color: WHITE, marginTop: 26, textAlign: 'center', opacity: clamp(line, 0, 1) }}>Built <span style={{ color: RED_HI }}>without compromise.</span></div>
        <div style={{ marginTop: 34, opacity: clamp(btn, 0, 1), transform: `scale(${(0.7 + clamp(btn, 0, 1) * 0.3) * pulse})` }}>
          <div style={{ background: `linear-gradient(180deg, ${RED_HI}, ${RED_DEEP})`, color: WHITE, fontFamily: DISPLAY, fontWeight: 700, fontSize: 32, letterSpacing: '0.04em', padding: '20px 54px', borderRadius: 10, boxShadow: `0 0 30px ${RED}88`, textAlign: 'center' }}>Start a Conversation</div>
        </div>
        <div style={{ fontFamily: MONO, fontWeight: 500, fontSize: 26, color: MUTE, letterSpacing: '0.08em', marginTop: 26, opacity: url }}>smartscaleagent.com</div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

// beat-lock to the 120 BPM grid
const rawStarts: number[] = []; { let t = 0; for (const b of BEATS) { rawStarts.push(t); t += b.dur } }
const B_STARTS = beatLock(rawStarts, gridToFrames((ssGrid as any).beats, FPS), Math.round(0.2 * FPS))
export const smartScaleDuration = B_STARTS[B_STARTS.length - 1] + BEATS[BEATS.length - 1].dur + 6

export const CommercialSmartScale: React.FC = () => {
  const starts = B_STARTS
  const durs = durationsFromStarts(starts, smartScaleDuration - 6)
  const total = smartScaleDuration
  const voWin = BEATS.map((b, i) => b.vo ? { start: starts[i], end: starts[i] + durs[i] } : null).filter(Boolean) as VoWindow[]
  const musicDuck = makeMusicDuck(voWin, total, { loud: 0.2, duck: 0.08, ramp: 18, fadeInEnd: 14 })
  return (
    <AbsoluteFill style={{ background: BG }}>
      {BEATS.map((b, i) => (
        <Sequence key={i} from={starts[i]} durationInFrames={durs[i] + 6}>
          {b.el}
          {i > 0 && <StreakWipe color={i <= 2 ? RED : RED_HI} dir={i % 2 ? 1 : -1} dur={12} />}
        </Sequence>
      ))}
      <MusicBed src="smartscale/music.mp3" musicFrames={1259} volume={musicDuck} />
      {BEATS.map((b, i) => b.vo ? (
        <Sequence key={'vo' + i} from={starts[i]}><Audio src={staticFile(`smartscale/${b.vo}.mp3`)} volume={1.0} /></Sequence>
      ) : null)}
      {starts.slice(1).map((st, i) => (
        <Sequence key={'w' + i} from={st - 3} durationInFrames={16}><Audio src={staticFile('sfx/whoosh-short.wav')} volume={0.26} /></Sequence>
      ))}
      <Sequence from={starts[3]} durationInFrames={30}><Audio src={staticFile('sfx/impact.wav')} volume={0.42} /></Sequence>
    </AbsoluteFill>
  )
}
