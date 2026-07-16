import React from 'react'
import { AbsoluteFill, Img, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion'
import { loadFont as loadPlayfair } from '@remotion/google-fonts/PlayfairDisplay'
import { loadFont as loadBebas } from '@remotion/google-fonts/BebasNeue'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import ihGrid from '../public/ihost/beatgrid.json'
import { CountUp, StreakWipe, Bokeh, HeroFlash } from './lib/pizzazz'
import { makeMusicDuck, beatLock, gridToFrames, durationsFromStarts, type VoWindow } from './lib/audio'
import { MusicBed } from './lib/musicbed'

const { fontFamily: SERIF } = loadPlayfair()   // elegant glamour serif
const { fontFamily: DISPLAY } = loadBebas()     // bold condensed showbiz caps
const { fontFamily: BODY } = loadInter()
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const FPS = 30

/* ============================================================================
 * iHOSTPOKER — autonomous, content-driven commercial. The system read the whole
 * site and MADE the calls:
 *   · THEME: the THRILL of Vegas, brought to your event. Glamour + excitement +
 *     celebration. Arc: ordinary event → electric high-roller casino night.
 *   · AUDIENCE: Houston event hosts — corporate, fundraisers, private parties.
 *   · LOOK: LUXE CASINO NIGHTLIFE — deep red + gold + black, felt green, warm
 *     glamorous light, card/chip/suit motifs, neon glow. A FIFTH distinct style
 *     (vs. gold-luxury AICEO, upbeat-blue Apex, emerald-terminal Pubco, red-
 *     blueprint SmartScale). Premium, not cheap.
 *   · PROOF: 10,000+ events since 2003 (20+ yrs) — count-up. Real event photos
 *     (pro showgirl shoot) used as hero moments.
 *   · PIZZAZZ fit: dealt cards, chip stacks, suit symbols, spinning-glow.
 * ==========================================================================*/

const BG = '#0c0505', FELT = '#0d3d2a', RED = '#c41230', RED_HI = '#e8324f'
const GOLD = '#e8b84b', GOLD_HI = '#ffd97a', GOLD_DEEP = '#a8801f'
const CREAM = '#faf3e6', MUTE = '#b9a89a'

// warm glamour vignette + gold light on every image
const Shot: React.FC<{ src: string; folder?: 'gen' | 'photos'; dur: number; focus?: string; kb?: number; dim?: number }> =
({ src, folder = 'gen', dur, focus = '50% 45%', kb = 1.14, dim = 1 }) => {
  const frame = useCurrentFrame()
  const p = interpolate(frame, [0, dur], [0, 1], { extrapolateRight: 'clamp' })
  const sc = 1.05 + (kb - 1) * p
  const dx = -1.2 * p, dy = 0.6 * p
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: BG }}>
      <Img src={staticFile(`ihost/${folder}/${src}`)} style={{ width: '116%', height: '116%', position: 'absolute', left: '-8%', top: '-8%', objectFit: 'cover', objectPosition: focus, transform: `scale(${sc}) translate(${dx}%,${dy}%)`, filter: `brightness(${0.9 * dim}) contrast(1.08) saturate(1.14)` }} />
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${BG}88, transparent 26%, transparent 55%, ${BG}f0)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(85% 85% at 50% 42%, transparent 42%, ${BG}e6)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(70% 70% at 78% 18%, ${GOLD}1c, transparent 45%)`, mixBlendMode: 'screen' }} />
    </AbsoluteFill>
  )
}

// glamour headline — Bebas display or Playfair serif, gold key phrase
const Head: React.FC<{ pre?: string; hot?: string; post?: string; size?: number; hold: number; kicker?: string; serif?: boolean }> =
({ pre = '', hot = '', post = '', size = 110, hold, kicker, serif = false }) => {
  const frame = useCurrentFrame()
  const o = interpolate(frame, [0, 8, hold - 10, hold], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const y = interpolate(frame, [0, 14], [16, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  const kO = interpolate(frame, [2, 10], [0, 1], { extrapolateRight: 'clamp' })
  const rule = clamp((frame - 8) / 14, 0, 1)
  const face = serif ? SERIF : DISPLAY
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 150 }}>
      <div style={{ opacity: o, transform: `translateY(${y}px)`, textAlign: 'center', maxWidth: 1500 }}>
        {kicker && <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 20, letterSpacing: '0.4em', textTransform: 'uppercase', color: GOLD, marginBottom: 20, opacity: kO }}>{kicker}</div>}
        <div style={{ fontFamily: face, fontWeight: serif ? 700 : 400, fontSize: size, color: CREAM, lineHeight: serif ? 1.1 : 0.98, letterSpacing: serif ? '0' : '0.01em', textTransform: serif ? 'none' : 'uppercase', textShadow: '0 4px 34px rgba(0,0,0,0.9)' }}>
          {pre}{hot && <span style={{ color: 'transparent', backgroundImage: `linear-gradient(180deg, ${GOLD_HI}, ${GOLD} 50%, ${GOLD_DEEP})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', textShadow: `0 0 26px ${GOLD}55` }}>{hot}</span>}{post}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 22 }}>
          <div style={{ width: 160 * rule, height: 2, background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`, boxShadow: `0 0 12px ${GOLD}` }} />
        </div>
      </div>
    </AbsoluteFill>
  )
}

// a playing card that flips/deals in
const Card: React.FC<{ rank: string; suit: string; red?: boolean; delay: number; x: number; rot: number }> =
({ rank, suit, red = false, delay, x, rot }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const pop = spring({ frame: frame - delay, fps, config: { damping: 13, stiffness: 180 } })
  const flip = interpolate(frame - delay, [0, 14], [90, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  const col = red ? RED : '#1a1a1a'
  return (
    <div style={{ position: 'relative', width: 150, height: 210, background: CREAM, borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.6)', transform: `translateX(${x}px) rotate(${rot}deg) scale(${clamp(pop, 0, 1)}) perspective(600px) rotateY(${flip}deg)`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 14 }}>
      <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 40, color: col, lineHeight: 1 }}>{rank}<div style={{ fontSize: 34 }}>{suit}</div></div>
      <div style={{ fontFamily: SERIF, fontSize: 72, color: col, alignSelf: 'center' }}>{suit}</div>
      <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 40, color: col, alignSelf: 'flex-end', transform: 'rotate(180deg)', lineHeight: 1 }}>{rank}<div style={{ fontSize: 34 }}>{suit}</div></div>
    </div>
  )
}

// wordmark
const Wordmark: React.FC<{ size?: number }> = ({ size = 120 }) => (
  <div style={{ fontFamily: DISPLAY, fontSize: size, letterSpacing: '0.02em', display: 'flex', alignItems: 'baseline' }}>
    <span style={{ color: CREAM }}>iHost</span>
    <span style={{ color: 'transparent', backgroundImage: `linear-gradient(180deg, ${GOLD_HI}, ${GOLD_DEEP})`, WebkitBackgroundClip: 'text', backgroundClip: 'text' }}>Poker</span>
    <span style={{ color: RED_HI, fontSize: size * 0.9, marginLeft: 6 }}>♠</span>
  </div>
)

const s = (sec: number) => Math.round(sec * FPS)
type Beat = { dur: number; vo?: string; el: React.ReactNode }
// VO dur: 1:2.18 2:1.72 3:3.58 4:7.76 5:5.99 6:5.39 7:4.64 8:2.37 9:3.62
const BEATS: Beat[] = [
  // cold open — the boring office
  { dur: s(1.0), el: <Shot src="office.png" dur={s(1.0)} kb={1.08} dim={0.7} /> },
  // 1 — you can't fly everyone to Vegas
  { dur: s(2.18 + 0.3), vo: 'ih-1', el: <><Shot src="office.png" dur={s(2.5)} kb={1.12} dim={0.75} />
      <Head pre="You can't fly everyone to " hot="Vegas." size={78} hold={s(2.18 + 0.3)} serif /></> },
  // 2 — so we bring Vegas to you (card deal reveal)
  { dur: s(1.72 + 1.0), vo: 'ih-2', el: <VegasCards hold={s(1.72 + 1.0)} /> },
  // 3 — the brand
  { dur: s(3.58 + 0.3), vo: 'ih-3', el: <><Shot src="table.png" dur={s(3.9)} kb={1.13} focus="55% 45%" />
      <Head kicker="Houston's premier casino parties" hot="iHostPoker." size={124} hold={s(3.58 + 0.3)} /></> },
  // 4 — the games
  { dur: s(7.76 + 0.2), vo: 'ih-4', el: <Games hold={s(7.76 + 0.2)} /> },
  // 5 — the thrill (real photo — showgirls/vegas)
  { dur: s(5.99 + 0.2), vo: 'ih-5', el: <><Shot src="event-0.jpg" folder="photos" dur={s(6.2)} kb={1.12} focus="50% 40%" />
      <Head pre="All the thrill — " hot="none of the risk." size={72} hold={s(5.99 + 0.2)} serif /></> },
  // 6 — the occasions
  { dur: s(5.39 + 0.2), vo: 'ih-6', el: <Occasions hold={s(5.39 + 0.2)} /> },
  // 7 — the credibility (count-up)
  { dur: s(4.64 + 0.2), vo: 'ih-7', el: <Cred hold={s(4.64 + 0.2)} /> },
  // 8 — your event next (real photo)
  { dur: s(2.37 + 0.3), vo: 'ih-8', el: <><Shot src="event-1.jpg" folder="photos" dur={s(2.7)} kb={1.13} />
      <Head hot="You're next." size={128} hold={s(2.37 + 0.3)} /></> },
  // 9 — CTA
  { dur: s(3.62 + 1.6), vo: 'ih-9', el: <CTACard hold={s(3.62 + 1.6)} /> },
]

function VegasCards({ hold }: { hold: number }) {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 45%, ${FELT}, ${BG})` }}>
      <FeltTexture />
      <HeroFlash color={GOLD} at={2} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: -30, alignItems: 'center', marginTop: -40 }}>
          <Card rank="A" suit="♠" delay={2} x={40} rot={-14} />
          <Card rank="K" suit="♥" red delay={7} x={0} rot={-4} />
          <Card rank="A" suit="♦" red delay={12} x={-40} rot={6} />
          <Card rank="A" suit="♣" delay={17} x={-80} rot={16} />
        </div>
      </AbsoluteFill>
      <Head pre="So we bring Vegas " hot="to you." size={80} hold={hold} serif />
    </AbsoluteFill>
  )
}

function Games({ hold }: { hold: number }) {
  const frame = useCurrentFrame()
  const games = [['Blackjack', '♠'], ['Roulette', '⊛'], ['Poker', '♥'], ['Craps', '⚀']]
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Shot src="chips.png" dur={hold} kb={1.12} dim={0.7} />
      <AbsoluteFill style={{ background: `${BG}aa` }} />
      <Bokeh color={GOLD} count={8} big />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 30 }}>
        <div style={{ display: 'flex', gap: 26 }}>
          {games.map(([g, sym], i) => {
            const at = 6 + i * 9
            const pop = spring({ frame: frame - at, fps: FPS, config: { damping: 12, stiffness: 200 } })
            const o = interpolate(frame, [at, at + 6], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
            return (
              <div key={i} style={{ opacity: o, transform: `scale(${clamp(pop, 0, 1)})`, background: `linear-gradient(160deg, ${FELT}, #06251a)`, border: `2px solid ${GOLD}55`, borderRadius: 14, padding: '30px 40px', textAlign: 'center', boxShadow: `0 0 26px ${GOLD}22` }}>
                <div style={{ fontSize: 58, color: GOLD_HI }}>{sym}</div>
                <div style={{ fontFamily: DISPLAY, fontSize: 44, color: CREAM, marginTop: 8, letterSpacing: '0.04em' }}>{g}</div>
              </div>
            )
          })}
        </div>
        <div style={{ fontFamily: BODY, fontWeight: 500, fontSize: 30, color: MUTE, letterSpacing: '0.1em', opacity: interpolate(frame, [42, 54], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>Real tables · real chips · expert dealers</div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

function Occasions({ hold }: { hold: number }) {
  const frame = useCurrentFrame()
  const occ = [['Corporate', 'Team nights & galas'], ['Fundraisers', 'Raise more, have fun'], ['Private', 'Bring Vegas home']]
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 40%, ${FELT}, ${BG})` }}>
      <FeltTexture />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 30 }}>
        {occ.map(([t, d], i) => {
          const at = 6 + i * 12
          const o = interpolate(frame, [at, at + 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
          const y = interpolate(frame, [at, at + 12], [30, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
          return (
            <div key={i} style={{ opacity: o, transform: `translateY(${y}px)`, width: 400, textAlign: 'center' }}>
              <div style={{ fontFamily: DISPLAY, fontSize: 76, color: 'transparent', backgroundImage: `linear-gradient(180deg, ${GOLD_HI}, ${GOLD_DEEP})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', letterSpacing: '0.02em' }}>{t}</div>
              <div style={{ fontFamily: BODY, fontWeight: 500, fontSize: 26, color: MUTE, marginTop: 6 }}>{d}</div>
            </div>
          )
        })}
      </AbsoluteFill>
      <Head hot="We handle every detail." size={58} hold={hold} serif />
    </AbsoluteFill>
  )
}

function Cred({ hold }: { hold: number }) {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Shot src="crowd.png" dur={hold} kb={1.12} dim={0.55} />
      <AbsoluteFill style={{ background: `${BG}99` }} />
      <Bokeh color={GOLD} count={10} big />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
        <div style={{ fontFamily: DISPLAY, fontSize: 260, lineHeight: 1.1, paddingBottom: '0.08em', color: 'transparent', backgroundImage: `linear-gradient(180deg, ${GOLD_HI}, ${GOLD} 50%, ${GOLD_DEEP})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', textShadow: `0 0 50px ${GOLD}44` }}>
          <CountUp to={10000} dur={30} suffix="+" />
        </div>
        <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 34, color: CREAM, letterSpacing: '0.24em', textTransform: 'uppercase', marginTop: 6, opacity: clamp((frame - 20) / 10, 0, 1) }}>Events since 2003</div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

function FeltTexture() {
  return <AbsoluteFill style={{ pointerEvents: 'none', opacity: 0.4, background: `radial-gradient(circle at 50% 40%, ${FELT}, transparent 70%)` }} />
}

function CTACard({ hold }: { hold: number }) {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const up = spring({ frame: frame - 2, fps, config: { damping: 15, stiffness: 130 } })
  const line = interpolate(frame, [22, 36], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const btn = spring({ frame: frame - 42, fps, config: { damping: 12, stiffness: 180 } })
  const url = interpolate(frame, [60, 72], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const pulse = 1 + Math.sin(frame * 0.12) * 0.02
  return (
    <AbsoluteFill style={{ background: `radial-gradient(130% 120% at 50% 42%, ${FELT}, ${BG})` }}>
      <FeltTexture />
      <Bokeh color={GOLD} count={7} big />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
        <div style={{ transform: `scale(${0.74 + clamp(up, 0, 1) * 0.26})` }}><Wordmark size={120} /></div>
        <div style={{ width: 360 * line, height: 2, background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`, marginTop: 24, boxShadow: `0 0 14px ${GOLD}` }} />
        <div style={{ fontFamily: SERIF, fontWeight: 700, fontStyle: 'italic', fontSize: 46, color: CREAM, marginTop: 24, textAlign: 'center', opacity: clamp(line, 0, 1) }}>Your <span style={{ color: GOLD_HI }}>best bet</span> for an unforgettable night.</div>
        <div style={{ marginTop: 34, opacity: clamp(btn, 0, 1), transform: `scale(${(0.7 + clamp(btn, 0, 1) * 0.3) * pulse})` }}>
          <div style={{ background: `linear-gradient(180deg, ${RED_HI}, ${RED})`, color: CREAM, fontFamily: DISPLAY, fontSize: 40, letterSpacing: '0.06em', padding: '18px 56px', borderRadius: 10, boxShadow: `0 0 30px ${RED}88`, textAlign: 'center' }}>Request A Quote</div>
        </div>
        <div style={{ fontFamily: BODY, fontWeight: 500, fontSize: 28, color: MUTE, letterSpacing: '0.08em', marginTop: 24, opacity: url }}>ihostpoker.com · Houston, TX</div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

// beat-lock
const rawStarts: number[] = []; { let t = 0; for (const b of BEATS) { rawStarts.push(t); t += b.dur } }
const B_STARTS = beatLock(rawStarts, gridToFrames((ihGrid as any).beats, FPS), Math.round(0.2 * FPS))
export const ihostDuration = B_STARTS[B_STARTS.length - 1] + BEATS[BEATS.length - 1].dur + 6

export const CommercialIHost: React.FC = () => {
  const starts = B_STARTS
  const durs = durationsFromStarts(starts, ihostDuration - 6)
  const total = ihostDuration
  const voWin = BEATS.map((b, i) => b.vo ? { start: starts[i], end: starts[i] + durs[i] } : null).filter(Boolean) as VoWindow[]
  const musicDuck = makeMusicDuck(voWin, total, { loud: 0.22, duck: 0.09, ramp: 18, fadeInEnd: 14 })
  return (
    <AbsoluteFill style={{ background: BG }}>
      {BEATS.map((b, i) => (
        <Sequence key={i} from={starts[i]} durationInFrames={durs[i] + 6}>
          {b.el}
          {i > 0 && <StreakWipe color={i % 2 ? GOLD : RED_HI} dir={i % 2 ? 1 : -1} dur={12} />}
        </Sequence>
      ))}
      <MusicBed src="ihost/music.mp3" musicFrames={1201} volume={musicDuck} />
      {BEATS.map((b, i) => b.vo ? (
        <Sequence key={'vo' + i} from={starts[i]}><Audio src={staticFile(`ihost/${b.vo}.mp3`)} volume={1.0} /></Sequence>
      ) : null)}
      {starts.slice(1).map((st, i) => (
        <Sequence key={'w' + i} from={st - 3} durationInFrames={16}><Audio src={staticFile('sfx/whoosh-short.wav')} volume={0.26} /></Sequence>
      ))}
      <Sequence from={starts[2]} durationInFrames={30}><Audio src={staticFile('sfx/impact.wav')} volume={0.42} /></Sequence>
    </AbsoluteFill>
  )
}
