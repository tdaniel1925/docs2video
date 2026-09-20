import React from 'react'
import { AbsoluteFill, Sequence, useCurrentFrame, interpolate, Easing } from 'remotion'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import { loadFont as loadMono } from '@remotion/google-fonts/JetBrainsMono'
import { loadFont as loadSerif } from '@remotion/google-fonts/DMSerifDisplay'
import vo from '../../public/showcase/northwind/vo.json'
import grid from '../../public/showcase/northwind/beatgrid.json'
import { CinematicFootage } from '../lib/footage'
import { CamMove, CamPunch, DepthStage, DepthLayer } from '../lib/cinematography'
import { ParticleField, ChartRoad, GrowBars, MorphCut } from '../lib/dynamics'
import { SettleSweep, CountUp } from '../lib/pizzazz'
import { FPS, s, clamp, pop, timeline, AudioBed, Rise, Letters, FadeOut, type BeatSpec } from './common'

const { fontFamily: SANS } = loadInter()
const { fontFamily: MONO } = loadMono()
const { fontFamily: SERIF } = loadSerif()

/* ============================================================================
 * NORTHWIND CAPITAL — an investment firm. The "data as spectacle" piece: deep
 * navy, one accent, numbers that pour in, a chart that draws itself as a road,
 * a live dashboard built in code with a cursor that actually clicks, a ticker
 * that never stops. Confident, quiet, expensive. Cuts on the beat.
 * ==========================================================================*/
const NAVY = '#07101c', NAVY2 = '#0c1a2c', LINE = '#1b2c44', ICE = '#e8f0fa', MUTE = '#7d8fa8', ACC = '#4fd1c5', GOLD = '#e2b45a'
const D = (vo as { durations: number[] }).durations
const F = (i: number) => `showcase/northwind/f-${i}.mp4`

const Grid: React.FC<{ opacity?: number }> = ({ opacity = 0.35 }) => {
  const frame = useCurrentFrame()
  return <AbsoluteFill style={{ opacity, backgroundImage: `linear-gradient(${LINE} 1px, transparent 1px), linear-gradient(90deg, ${LINE} 1px, transparent 1px)`, backgroundSize: '96px 96px', backgroundPosition: `${(frame * 0.3) % 96}px ${(frame * 0.15) % 96}px` }} />
}
const Ticker: React.FC<{ y?: number }> = ({ y = 1010 }) => {
  const frame = useCurrentFrame()
  const items = ['NWC +1.24%', 'S&P 500 5,612.40', 'AUM $2.4B', '10Y 3.98%', 'GOLD 2,410', 'EUR/USD 1.0842', 'VIX 13.2', 'NASDAQ 17,904', 'NWC FLAGSHIP +12.1% YTD']
  const text = items.join('     ·     ')
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: y, height: 42, overflow: 'hidden', borderTop: `1px solid ${LINE}`, background: `${NAVY}cc` }}>
      <div style={{ position: 'absolute', whiteSpace: 'nowrap', fontFamily: MONO, fontSize: 15, color: MUTE, lineHeight: '42px', letterSpacing: '0.06em', transform: `translateX(${-(frame * 1.6) % 2400}px)` }}>{text}     ·     {text}     ·     {text}</div>
    </div>
  )
}
const Kicker: React.FC<{ at: number; text: string }> = ({ at, text }) => (
  <Rise at={at} style={{ fontFamily: MONO, fontSize: 15, letterSpacing: '0.34em', textTransform: 'uppercase', color: ACC }}>{text}</Rise>
)
const Big: React.FC<{ at: number; children: React.ReactNode; size?: number; color?: string; align?: 'left' | 'center' }> = ({ at, children, size = 74, color = ICE, align = 'left' }) => (
  <Rise at={at} dur={18} style={{ fontFamily: SANS, fontWeight: 800, fontSize: size, color, lineHeight: 1.02, letterSpacing: '-0.035em', textAlign: align, paddingBottom: '0.06em' }}>{children}</Rise>
)

// 1 — "the market you remember": city footage, cool grade, a heavy claim.
const Remember: React.FC<{ hold: number }> = ({ hold }) => (
  <CamMove keys={[{ at: 0, scale: 1.0 }, { at: hold, scale: 1.09 }]}>
    <CinematicFootage src={F(0)} dur={hold} grade="cool" brand={NAVY} brandStrength={0.45} grain={0.06} letterbox>
      <ParticleField color={ACC} count={22} kind="data" speed={0.8} />
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(8,12,24,0) 35%, rgba(8,12,24,0.82) 100%)' }} />
      <AbsoluteFill style={{ justifyContent: 'flex-end', padding: '0 0 170px 120px' }}>
        <Kicker at={6} text="Northwind Capital" />
        <div style={{ height: 16 }} />
        <Big at={12} size={66}>Most portfolios are built<br />for the market <span style={{ color: MUTE }}>you remember.</span></Big>
      </AbsoluteFill>
    </CinematicFootage>
  </CamMove>
)

// 2 — the turn: the word "coming" arrives out of depth; a morph from footage to the navy stage.
const Coming: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ background: NAVY }}>
      <Grid />
      <ParticleField color={ACC} count={30} kind="data" speed={1.3} />
      <DepthStage travelX={6} push={1.2}>
        <DepthLayer depth={0.2} float={1}><AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 84, color: ICE, letterSpacing: '-0.035em', lineHeight: 1 }}><Letters text="Northwind builds" at={4} step={2} from="blur" /></div>
            <div style={{ fontFamily: SERIF, fontSize: 118, color: ACC, lineHeight: 1.05, marginTop: 10, opacity: clamp((frame - 28) / 14, 0, 1), transform: `scale(${0.9 + 0.1 * clamp((frame - 28) / 14, 0, 1)})` }}>for the one that’s coming.</div>
          </div>
        </AbsoluteFill></DepthLayer>
      </DepthStage>
      <SettleSweep color={ACC} hold={hold} />
    </AbsoluteFill>
  )
}

// 3 — the numbers pour in: $2.4B, 14 years, one rule.
const Numbers: React.FC<{ hold: number }> = () => {
  const frame = useCurrentFrame()
  const cells = [
    { at: 6, big: <div style={{ fontFamily: SANS, fontSize: 150, color: ICE }}><CountUp to={2.4} prefix="$" suffix="B" decimals={1} startAt={6} dur={40} /></div>, label: 'under management' },
    { at: 30, big: <div style={{ fontFamily: SANS, fontSize: 150, color: ICE }}><CountUp to={14} decimals={0} startAt={30} dur={36} /></div>, label: 'years' },
    { at: 54, big: <div style={{ fontFamily: SERIF, fontSize: 178, color: GOLD, lineHeight: 0.85 }}>1</div>, label: 'rule: no surprises' },
  ]
  return (
    <AbsoluteFill style={{ background: NAVY }}>
      <Grid opacity={0.25} />
      <CamPunch at={54} amount={0.04}>
        <AbsoluteFill style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 70, padding: '0 100px' }}>
          {cells.map((c, i) => {
            const p = pop(frame, c.at, 15)
            return (
              <div key={i} style={{ flex: 1, opacity: clamp(p * 2, 0, 1), transform: `translateY(${(1 - clamp(p, 0, 1)) * 40}px)`, borderLeft: `2px solid ${i === 2 ? GOLD : ACC}`, paddingLeft: 28 }}>
                <div style={{ fontFamily: SANS, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, paddingBottom: '0.08em' }}>{c.big}</div>
                <div style={{ fontFamily: MONO, fontSize: 18, letterSpacing: '0.22em', textTransform: 'uppercase', color: MUTE, marginTop: 14 }}>{c.label}</div>
              </div>
            )
          })}
        </AbsoluteFill>
      </CamPunch>
      <Ticker />
    </AbsoluteFill>
  )
}

// 4 — the live view: a dashboard drawn in code; the cursor clicks a position and it expands.
const Dashboard: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const rows = [['Global Equity', '42.0%', '+8.4%'], ['US Treasuries', '23.5%', '+3.1%'], ['Private Credit', '14.0%', '+11.2%'], ['Real Assets', '12.5%', '+6.7%'], ['Cash', '8.0%', '+4.9%']]
  const clickAt = Math.round(hold * 0.42)
  const open = clamp((frame - clickAt) / 12, 0, 1)
  const cx = interpolate(frame, [8, clickAt], [1500, 760], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad) })
  const cy = interpolate(frame, [8, clickAt], [900, 500], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad) })
  const cardIn = pop(frame, 4, 15)
  return (
    <AbsoluteFill style={{ background: NAVY }}>
      <Grid opacity={0.2} />
      <CamMove keys={[{ at: 0, scale: 1.0 }, { at: hold, scale: 1.06, x: -1 }]}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ width: 1360, background: NAVY2, border: `1px solid ${LINE}`, borderRadius: 10, padding: 28, opacity: clamp(cardIn * 2, 0, 1), transform: `translateY(${(1 - clamp(cardIn, 0, 1)) * 50}px)`, boxShadow: '0 40px 100px rgba(0,0,0,.6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 24, color: ICE }}>Daniel Family Trust <span style={{ color: MUTE, fontWeight: 600 }}>· live</span></div>
              <div style={{ fontFamily: MONO, fontSize: 15, color: ACC }}>● updated 4s ago</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 22 }}>
              <div>
                {rows.map((r, i) => {
                  const rp = clamp((frame - 10 - i * 4) / 10, 0, 1)
                  const sel = i === 2 && open > 0
                  return (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px', padding: '13px 14px', borderBottom: `1px solid ${LINE}`, opacity: rp, transform: `translateX(${(1 - rp) * -20}px)`, background: sel ? `${ACC}18` : 'transparent', borderLeft: sel ? `3px solid ${ACC}` : '3px solid transparent', fontFamily: SANS, color: ICE, fontSize: 20 }}>
                      <span>{r[0]}</span><span style={{ fontFamily: MONO, color: MUTE }}>{r[1]}</span><span style={{ fontFamily: MONO, color: ACC }}>{r[2]}</span>
                    </div>
                  )
                })}
                <div style={{ marginTop: 14, fontFamily: MONO, fontSize: 14, color: MUTE }}>Total fees this year: <span style={{ color: ICE }}>$4,812.00</span> · 0.20% of assets · no hidden charges</div>
              </div>
              <div style={{ borderLeft: `1px solid ${LINE}`, paddingLeft: 22 }}>
                <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: '0.22em', textTransform: 'uppercase', color: MUTE }}>{open > 0 ? 'Private Credit · detail' : 'Portfolio · 12 months'}</div>
                <div style={{ marginTop: 12, opacity: 1 - open, position: open >= 1 ? 'absolute' : 'relative' }}><ChartRoad points={[100, 103, 101, 108, 112, 110, 118, 121, 127, 126, 133, 138]} color={ACC} w={440} h={200} startAt={14} dur={50} /></div>
                <div style={{ marginTop: 12, opacity: open, position: open <= 0 ? 'absolute' : 'relative' }}>
                  <GrowBars values={[62, 80, 74, 96, 88, 100]} color={ACC} color2={GOLD} w={440} h={170} startAt={clickAt + 4} />
                  <div style={{ fontFamily: SANS, fontSize: 16, color: ICE, marginTop: 10 }}>Risk: <span style={{ color: GOLD }}>moderate</span> · Liquidity: quarterly · Plain English: <span style={{ color: MUTE }}>loans to solid mid-size companies, paid back with interest.</span></div>
                </div>
              </div>
            </div>
          </div>
        </AbsoluteFill>
      </CamMove>
      {/* the cursor — a real click, not a pretend one */}
      <svg style={{ position: 'absolute', left: cx, top: cy, width: 30, height: 36, filter: 'drop-shadow(0 4px 8px rgba(0,0,0,.6))', opacity: clamp((frame - 6) / 6, 0, 1) }} viewBox="0 0 24 28"><path d="M3 2 L3 22 L8.5 17 L12 26 L15.5 24.5 L12 16 L19 16 Z" fill={ICE} stroke={NAVY} strokeWidth="1.5" /></svg>
      {frame >= clickAt && frame < clickAt + 12 && <div style={{ position: 'absolute', left: cx - 18, top: cy - 18, width: 48, height: 48, borderRadius: '50%', border: `2px solid ${ACC}`, opacity: 1 - (frame - clickAt) / 12, transform: `scale(${1 + (frame - clickAt) / 6})` }} />}
      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 70 }}>
        <Rise at={18} style={{ fontFamily: SANS, fontWeight: 800, fontSize: 40, color: ICE, letterSpacing: '-0.02em' }}>Every position. Every fee. Every risk. <span style={{ color: ACC }}>One screen.</span></Rise>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

// 5 — the record: 12% average, eight straight years — the chart road runs across the whole frame.
const Record: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ background: NAVY }}>
      <Grid opacity={0.22} />
      <ParticleField color={ACC} count={16} kind="data" speed={0.6} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'flex-start', paddingLeft: 120 }}>
        <Kicker at={4} text="Since 2012" />
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 26, marginTop: 10 }}>
          <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 210, color: ICE, lineHeight: 0.95, letterSpacing: '-0.05em', paddingBottom: '0.08em' }}><CountUp to={12} suffix="%" decimals={0} startAt={8} dur={34} /></div>
          <div style={{ fontFamily: SANS, fontSize: 26, color: MUTE, paddingBottom: 30, lineHeight: 1.3 }}>average annual<br />return</div>
        </div>
        <div style={{ position: 'absolute', right: 120, top: 200, width: 760 }}>
          <ChartRoad points={[100, 112, 119, 134, 151, 162, 181, 204, 229, 251, 282, 316]} color={ACC} w={760} h={360} startAt={12} dur={60} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: MONO, fontSize: 13, color: MUTE, marginTop: 8 }}><span>2012</span><span>2016</span><span>2020</span><span>2024</span></div>
        </div>
        <Rise at={50} style={{ marginTop: 30, fontFamily: SANS, fontWeight: 700, fontSize: 34, color: ICE }}>Eight straight years <span style={{ color: GOLD }}>ahead of the index.</span></Rise>
        <div style={{ marginTop: 14, fontFamily: MONO, fontSize: 13, color: MUTE, opacity: clamp((frame - 60) / 12, 0, 1) }}>Net of fees. Past performance does not guarantee future results.</div>
      </AbsoluteFill>
      <CamPunch at={38} amount={0.03}><div /></CamPunch>
      <Ticker />
    </AbsoluteFill>
  )
}

// 6 — the letter morphs into the live view.
const Letter: React.FC<{ hold: number }> = ({ hold }) => {
  const at = Math.round(hold * 0.45)
  const Paper = (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ width: 620, background: '#f6f3ec', color: '#333', padding: '40px 46px', fontFamily: SERIF, fontSize: 18, lineHeight: 1.7, transform: 'rotate(-2deg)', boxShadow: '0 30px 80px rgba(0,0,0,.6)' }}>
        <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '0.2em', color: '#888' }}>QUARTERLY LETTER · Q2</div>
        <div style={{ marginTop: 10 }}>Dear Investor, — the quarter saw continued volatility across… <span style={{ color: '#aaa' }}>(three more pages)</span></div>
        <div style={{ marginTop: 10, color: '#aaa' }}>Received 47 days after quarter end.</div>
      </div>
    </AbsoluteFill>
  )
  const Live = (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ width: 760, background: NAVY2, border: `1px solid ${ACC}66`, borderRadius: 10, padding: '30px 36px', boxShadow: `0 0 80px ${ACC}22` }}>
        <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: '0.24em', color: ACC }}>● LIVE · TODAY 14:02</div>
        <div style={{ display: 'flex', gap: 40, marginTop: 14 }}>
          {[['Value', '$3,214,880'], ['Today', '+$8,412'], ['YTD', '+12.1%']].map(([k, v]) => <div key={k}><div style={{ fontFamily: MONO, fontSize: 13, color: MUTE }}>{k}</div><div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 40, color: ICE, letterSpacing: '-0.03em' }}>{v}</div></div>)}
        </div>
      </div>
    </AbsoluteFill>
  )
  return (
    <AbsoluteFill style={{ background: NAVY }}>
      <Grid opacity={0.2} />
      <MorphCut at={at} dur={16} from={Paper} to={Live} />
      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 90 }}>
        <Big at={6} size={54} align="center">You don’t get a quarterly letter.<br /><span style={{ color: ACC }}>You get a live view.</span></Big>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

// 7 — three words, three beats, one seal.
const Promise: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const words = ['Independent.', 'Fee-only.', 'Fiduciary, in writing.']
  return (
    <CamMove keys={[{ at: 0, scale: 1.0 }, { at: hold, scale: 1.05 }]}>
      <CinematicFootage src={F(1)} dur={hold} grade="cool" brand={NAVY} brandStrength={0.55} grain={0.06}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            {words.map((w, i) => { const p = pop(frame, 6 + i * 16, 12); return <div key={w} style={{ fontFamily: SANS, fontWeight: 800, fontSize: 84, color: i === 2 ? GOLD : ICE, letterSpacing: '-0.035em', lineHeight: 1.1, opacity: clamp(p * 2, 0, 1), transform: `translateY(${(1 - clamp(p, 0, 1)) * 30}px)` }}>{w}</div> })}
          </div>
        </AbsoluteFill>
      </CinematicFootage>
    </CamMove>
  )
}

// 8 — the close.
const Close: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ background: NAVY }}>
      <Grid opacity={0.18} />
      <ParticleField color={ACC} count={24} kind="data" speed={0.5} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 84, height: 84, margin: '0 auto 24px', border: `3px solid ${ACC}`, borderRadius: 10, display: 'grid', placeItems: 'center', transform: `rotate(${45 * clamp((frame - 4) / 20, 0, 1)}deg)`, opacity: clamp((frame - 4) / 10, 0, 1) }}><div style={{ width: 30, height: 30, background: ACC, transform: 'rotate(-45deg)' }} /></div>
          <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 96, color: ICE, letterSpacing: '-0.04em', lineHeight: 1 }}><Letters text="NORTHWIND" at={10} step={2} from="blur" /></div>
          <div style={{ fontFamily: MONO, fontSize: 18, letterSpacing: '0.5em', textTransform: 'uppercase', color: ACC, marginTop: 14, opacity: clamp((frame - 34) / 12, 0, 1) }}>Capital</div>
          <Rise at={48} style={{ fontFamily: SERIF, fontSize: 40, color: GOLD, marginTop: 28 }}>Built for what’s next.</Rise>
          <Rise at={64} style={{ fontFamily: MONO, fontSize: 15, color: MUTE, marginTop: 24, letterSpacing: '0.2em' }}>northwindcapital.com · SEC-registered investment adviser</Rise>
        </div>
      </AbsoluteFill>
      <FadeOut total={hold} dur={20} />
    </AbsoluteFill>
  )
}

const BEATS: BeatSpec[] = [
  { dur: s(D[0] + 0.9), el: (h) => <Remember hold={h} /> },
  { dur: s(D[1] + 1.0), el: (h) => <Coming hold={h} />, impact: true },
  { dur: s(D[2] + 0.8), el: (h) => <Numbers hold={h} /> },
  { dur: s(D[3] + 1.2), el: (h) => <Dashboard hold={h} /> },
  { dur: s(D[4] + 0.8), el: (h) => <Record hold={h} /> },
  { dur: s(D[5] + 0.8), el: (h) => <Letter hold={h} /> },
  { dur: s(D[6] + 0.7), el: (h) => <Promise hold={h} /> },
  { dur: s(D[7] + 2.2), el: (h) => <Close hold={h} />, impact: true },
]
const TL = timeline(BEATS, (grid as { beats: number[] }).beats)
export const NORTHWIND_FRAMES = TL.total
export const NORTHWIND_FPS = FPS

export const Northwind: React.FC = () => (
  <AbsoluteFill style={{ background: NAVY }}>
    {BEATS.map((b, i) => (
      <Sequence key={i} from={TL.starts[i]} durationInFrames={TL.durs[i] + 4}>{b.el(TL.durs[i], i)}</Sequence>
    ))}
    <AudioBed id="northwind" voice={!('placeholder' in vo)} beats={BEATS} tl={TL} voDur={D} musicFrames={s(66)} loud={0.3} duck={0.1} whoosh={0.16} impacts={BEATS.map((b, i) => b.impact ? TL.starts[i] : -1).filter((f) => f >= 0)} />
  </AbsoluteFill>
)
