import React from 'react'
import { AbsoluteFill, Sequence, Audio, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion'
import DATA from '../public/comp1/durations.json'

/* ============================================================================
 * APEX COMP PLAN — Video 1: "Two Ladders, One Opportunity" (~90s overview).
 * Torn-paper style (navy/red/cream). Story beats use FLUX paper scenes; DATA
 * beats (60/40 split, 9-rank ladder, 50-90% range, generational overrides) are
 * drawn in CODE on cream torn-paper panels (readable, no AI gibberish) — per
 * the readability rule. Real Apex logo intro/corner/end. Ducked audio.
 * ==========================================================================*/

const FPS = 30
const NAVY = '#1e3a70', NAVY_D = '#132649', RED = '#c0272d', WHITE = '#fff', CREAM = '#f4efe4', GREEN = '#2f7d4f'
const INK = '#23324a'
const FONT = 'Archivo, Inter, system-ui, sans-serif'
const EASE = { expoOut: Easing.bezier(0.16, 1, 0.3, 1), backOut: Easing.bezier(0.34, 1.56, 0.64, 1) }
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))
const S = (sec: number) => Math.round(sec * FPS)

const vo: number[] = (DATA as any).vo || new Array(12).fill(6)
const DATASET = new Set<number>((DATA as any).data || [3, 4, 6, 7])

// captions for the STORY (paper-scene) beats — Title Case, on torn navy card
const CAPS: Record<number, { kicker?: string; head: string; accent?: string }> = {
  0: { kicker: 'The Apex Comp Plan', head: 'Two Ladders. One Opportunity.', accent: 'One Opportunity.' },
  1: { kicker: 'Ladder One · Technology', head: 'Open To Everyone.' },
  2: { kicker: 'How You Earn', head: 'Sell The Tools. Build A Team.' },
  5: { kicker: 'Ladder Two · Insurance', head: 'For Licensed Agents.' },
  8: { kicker: 'The Difference', head: 'Separate — But They Stack.', accent: 'They Stack.' },
  9: { kicker: 'Your Choice', head: 'One. The Other. Or Both.' },
  10: { kicker: '', head: 'No Ceiling On Either.', accent: 'No Ceiling' },
}

const grainSVG = encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(#n)' opacity='0.5'/></svg>`)
const Grain: React.FC<{ o?: number }> = ({ o = 0.05 }) => { const f = useCurrentFrame(); return <AbsoluteFill style={{ pointerEvents: 'none', backgroundImage: `url("data:image/svg+xml,${grainSVG}")`, backgroundPosition: `${(f * 4) % 180}px ${(f * 6) % 180}px`, mixBlendMode: 'multiply', opacity: o }} /> }

const Star: React.FC<{ size?: number; color?: string }> = ({ size = 20, color = RED }) => (
  <svg width={size} height={size} viewBox="0 0 24 24"><path d="M12 1.6l2.9 6.5 7.1.6-5.4 4.7 1.7 6.9L12 17.9 5.7 20.3l1.7-6.9L2 8.7l7.1-.6z" fill={color} /></svg>
)

// torn caption card (navy) — bottom-left, for story beats
const TORN_CARD = 'polygon(0% 7%,5% 2%,11% 8%,17% 2%,24% 8%,31% 2%,38% 8%,45% 2%,52% 8%,59% 2%,66% 8%,73% 2%,80% 8%,87% 2%,94% 8%,100% 3%,100% 92%,95% 98%,88% 91%,81% 98%,74% 91%,67% 98%,60% 91%,53% 98%,46% 91%,39% 98%,32% 91%,25% 98%,18% 91%,11% 98%,5% 91%,0% 96%)'
const CaptionCard: React.FC<{ c: { kicker?: string; head: string; accent?: string } }> = ({ c }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const s = spring({ frame: f - 6, fps, config: { damping: 18, stiffness: 130 } })
  const head = c.accent && c.head.includes(c.accent) ? <>{c.head.replace(c.accent, '')}<span style={{ color: '#ff8a8a' }}>{c.accent}</span></> : c.head
  return (
    <div style={{ position: 'absolute', left: 80, bottom: 120, maxWidth: 1500, transform: `translateY(${(1 - s) * 44}px) rotate(-1.4deg)`, opacity: clamp(s) }}>
      <div style={{ background: NAVY, clipPath: TORN_CARD, padding: '28px 54px 32px' }}>
        {c.kicker ? <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}><Star /><div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 22, letterSpacing: '0.2em', color: '#ff9d9d', textTransform: 'uppercase' }}>{c.kicker}</div></div> : null}
        <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 72, lineHeight: 1.03, color: WHITE, letterSpacing: '-0.02em' }}>{head}</div>
      </div>
    </div>
  )
}

// a code-drawn cream torn-paper PANEL (readable data lives here)
const PANEL_TORN = 'polygon(1% 3%,7% 1%,14% 4%,21% 1%,29% 3%,37% 0%,45% 3%,53% 1%,61% 4%,69% 1%,77% 3%,85% 0%,93% 3%,99% 1%,100% 7%,99% 18%,100% 30%,99% 44%,100% 58%,99% 72%,100% 84%,99% 93%,94% 99%,85% 97%,76% 100%,66% 97%,56% 100%,46% 97%,36% 100%,26% 97%,16% 100%,8% 98%,2% 99%,0% 93%,1% 78%,0% 64%,1% 50%,0% 36%,1% 22%,0% 10%)'
const Panel: React.FC<{ children: React.ReactNode; at?: number }> = ({ children, at = 2 }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const s = spring({ frame: f - at, fps, config: { damping: 16, stiffness: 120 } })
  return (
    <div style={{ position: 'absolute', left: 210, top: 150, width: 1500, height: 780, transform: `translateY(${(1 - s) * 30}px) rotate(-0.5deg)`, opacity: clamp(s) }}>
      <div style={{ position: 'absolute', inset: -8, background: 'rgba(0,0,0,0.4)', clipPath: PANEL_TORN, filter: 'blur(10px)' }} />
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(160deg, ${CREAM}, #ece5d6)`, clipPath: PANEL_TORN, overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 90px' }}>
        <Grain o={0.08} />
        <div style={{ position: 'relative', width: '100%', textAlign: 'center' }}>{children}</div>
      </div>
    </div>
  )
}
const PanelKicker: React.FC<{ children: React.ReactNode }> = ({ children }) => <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 26, letterSpacing: '0.2em', color: RED, textTransform: 'uppercase', marginBottom: 18 }}>{children}</div>
const CountUp: React.FC<{ to: number; suffix?: string; at?: number; dur?: number }> = ({ to, suffix = '', at = 6, dur = 26 }) => { const f = useCurrentFrame(); const p = interpolate(f - at, [0, dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut }); return <>{Math.round(to * p)}{suffix}</> }

/* ---- DATA PANELS ---- */
// beat 3: 60% you / 40% team override split
const Panel60_40: React.FC = () => {
  const f = useCurrentFrame()
  const grow = interpolate(f, [10, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut })
  return (
    <Panel>
      <PanelKicker>Technology · Every Sale</PanelKicker>
      <div style={{ display: 'flex', gap: 30, justifyContent: 'center', alignItems: 'stretch', marginTop: 10 }}>
        <div style={{ flex: 60, textAlign: 'center' }}>
          <div style={{ height: 150 * grow + 60, background: NAVY, borderRadius: 10, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 14, transition: 'none' }}>
            <span style={{ fontFamily: FONT, fontWeight: 900, fontSize: 84, color: WHITE }}><CountUp to={60} suffix="%" at={12} /></span>
          </div>
          <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 34, color: INK, marginTop: 14 }}>You Keep</div>
        </div>
        <div style={{ flex: 40, textAlign: 'center' }}>
          <div style={{ height: 100 * grow + 60, background: RED, borderRadius: 10, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 14, alignSelf: 'flex-end' }}>
            <span style={{ fontFamily: FONT, fontWeight: 900, fontSize: 84, color: WHITE }}><CountUp to={40} suffix="%" at={12} /></span>
          </div>
          <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 34, color: INK, marginTop: 14 }}>Team Overrides</div>
        </div>
      </div>
    </Panel>
  )
}
// beat 4: 9-rank ladder (Starter -> Elite)
const RANKS = ['Starter', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Ruby', 'Diamond', 'Crown', 'Elite']
const PanelRanks: React.FC = () => {
  const f = useCurrentFrame()
  return (
    <Panel>
      <PanelKicker>Technology · 9 Ranks</PanelKicker>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 14, height: 300 }}>
        {RANKS.map((r, i) => {
          const at = 8 + i * 4
          const p = interpolate(f - at, [0, 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.backOut })
          const h = 70 + i * 26
          const last = i === RANKS.length - 1
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, opacity: clamp(p), transform: `translateY(${(1 - p) * 20}px)` }}>
              <div style={{ width: 92, height: h, background: last ? RED : NAVY, borderRadius: 8, boxShadow: last ? `0 0 24px ${RED}66` : 'none' }} />
              <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 20, color: last ? RED : INK }}>{r}</div>
            </div>
          )
        })}
      </div>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 30, color: INK, marginTop: 22 }}>Starter → <span style={{ color: RED }}>Elite</span> · deeper overrides + rank bonuses</div>
    </Panel>
  )
}
// beat 6: 50% -> 90% insurance commission range
const PanelRange: React.FC = () => {
  const f = useCurrentFrame()
  const fill = interpolate(f, [10, 55], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut })
  const val = Math.round(50 + fill * 40)
  return (
    <Panel>
      <PanelKicker>Insurance · Your Commission</PanelKicker>
      <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 150, color: GREEN, lineHeight: 0.9 }}>{val}%</div>
      <div style={{ width: 900, height: 26, borderRadius: 13, background: '#d8cfbd', margin: '26px auto 0', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${fill * 100}%`, background: `linear-gradient(90deg, ${GREEN}, #3fa06a)`, borderRadius: 13 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', width: 900, margin: '10px auto 0', fontFamily: FONT, fontWeight: 800, fontSize: 26, color: INK }}><span>50% start</span><span>90% MGA</span></div>
      <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 28, color: INK, marginTop: 22 }}>of first-year premium · paid by A-rated carriers · you own the book</div>
    </Panel>
  )
}
// beat 7: generational overrides (Gen 1-6)
const GENS = [{ g: 'Gen 1', p: 15 }, { g: 'Gen 2', p: 5 }, { g: 'Gen 3', p: 3 }, { g: 'Gen 4', p: 2 }, { g: 'Gen 5', p: 1 }, { g: 'Gen 6', p: 0.5 }]
const PanelGens: React.FC = () => {
  const f = useCurrentFrame()
  return (
    <Panel>
      <PanelKicker>Insurance · Build A Team</PanelKicker>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 28, height: 300 }}>
        {GENS.map((x, i) => {
          const at = 8 + i * 5
          const p = interpolate(f - at, [0, 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.backOut })
          const h = 30 + (x.p / 15) * 230
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, opacity: clamp(p), transform: `translateY(${(1 - p) * 20}px)` }}>
              <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 40, color: i === 0 ? RED : INK }}>{x.p}%</div>
              <div style={{ width: 120, height: h, background: i === 0 ? RED : NAVY, borderRadius: 8 }} />
              <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 22, color: INK }}>{x.g}</div>
            </div>
          )
        })}
      </div>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 30, color: INK, marginTop: 22 }}>Overrides <span style={{ color: RED }}>6 generations</span> deep</div>
    </Panel>
  )
}

/* ---- paper scene (story beats) ---- */
const Scene: React.FC<{ i: number; push?: number }> = ({ i, push = 0.1 }) => {
  const f = useCurrentFrame(); const { durationInFrames } = useVideoConfig()
  const p = interpolate(f, [0, durationInFrames], [0, 1], { extrapolateRight: 'clamp', easing: EASE.expoOut })
  const scale = 1.05 + p * push; const drift = Math.sin(f * 0.02) * 0.006
  return (
    <AbsoluteFill style={{ background: NAVY_D, overflow: 'hidden' }}>
      <Img src={staticFile(`comp1/f-${i}.png`)} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale + drift})` }} />
      <Grain />
      <AbsoluteFill style={{ background: `linear-gradient(180deg, transparent 55%, rgba(19,38,73,0.55))` }} />
    </AbsoluteFill>
  )
}

/* ---- intro / end / corner ---- */
const Blobs: React.FC = () => { const f = useCurrentFrame(); const d = Math.sin(f * 0.03) * 30; return (<AbsoluteFill style={{ background: `radial-gradient(120% 100% at 50% 40%, ${NAVY}, ${NAVY_D})` }}><div style={{ position: 'absolute', width: 700, height: 700, borderRadius: '50%', background: `${RED}22`, filter: 'blur(80px)', top: 120 + d, left: '30%' }} /></AbsoluteFill>) }
const INTRO = S(3.0), END = S(4.5), INTRO_XF = S(0.5), END_XF = S(0.5)
const IntroScreen: React.FC = () => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const s = spring({ frame: f - 4, fps, config: { damping: 13, stiffness: 130 } })
  const tag = interpolate(f, [24, 44], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut })
  const out = interpolate(f, [INTRO - INTRO_XF, INTRO], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 28, opacity: out }}>
      <Blobs />
      <div style={{ background: WHITE, borderRadius: 14, padding: '36px 60px', boxShadow: '0 26px 70px rgba(0,0,0,0.5)', transform: `translateY(${(1 - s) * 40}px) scale(${0.82 + clamp(s) * 0.18})`, opacity: clamp(s) }}><Img src={staticFile('comp1/logo.png')} style={{ height: 150, display: 'block' }} /></div>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 40, color: WHITE, opacity: tag, display: 'flex', alignItems: 'center', gap: 14 }}><Star size={26} /> The Compensation Plan <Star size={26} /></div>
    </AbsoluteFill>
  )
}
const EndScreen: React.FC = () => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const s = spring({ frame: f - 4, fps, config: { damping: 14, stiffness: 140 } })
  const tag = interpolate(f, [20, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut })
  const url = interpolate(f, [34, 54], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut })
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 24 }}>
      <Blobs />
      <div style={{ background: WHITE, borderRadius: 14, padding: '30px 54px', boxShadow: '0 22px 60px rgba(0,0,0,0.5)', transform: `translateY(${(1 - s) * 34}px) scale(${0.86 + clamp(s) * 0.14})`, opacity: clamp(s) }}><Img src={staticFile('comp1/logo.png')} style={{ height: 120, display: 'block' }} /></div>
      <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 50, color: WHITE, opacity: tag, textAlign: 'center' }}>Two Ladders. <span style={{ color: '#ff8a8a' }}>One Opportunity.</span></div>
      <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 44, color: WHITE, opacity: url }}>reachtheapex.net</div>
    </AbsoluteFill>
  )
}
const CornerLogo: React.FC<{ from: number; to: number }> = ({ from, to }) => {
  const f = useCurrentFrame()
  const inO = interpolate(f, [from, from + S(0.5)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const outO = interpolate(f, [to - S(0.5), to], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return <div style={{ position: 'absolute', top: 40, right: 50, opacity: Math.min(inO, outO) }}><div style={{ background: 'rgba(255,255,255,0.92)', borderRadius: 10, padding: '10px 18px', boxShadow: '0 6px 22px rgba(0,0,0,0.35)' }}><Img src={staticFile('comp1/logo.png')} style={{ height: 38, display: 'block' }} /></div></div>
}

/* ---- timeline ---- */
const PAD = 0.55, XF = 0.4
const segD = vo.map((d) => (d || 6) + PAD)
const bodyFrames = Math.round((segD.reduce((a, b) => a + b, 0) - (segD.length - 1) * XF) * FPS)
export const COMP1_FRAMES = INTRO - INTRO_XF + bodyFrames + END - END_XF
const Dissolve: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => {
  const f = useCurrentFrame(); const xf = S(XF)
  const inO = interpolate(f, [0, xf], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const outO = interpolate(f, [dur - xf, dur], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return <AbsoluteFill style={{ opacity: Math.min(inO, outO) }}>{children}</AbsoluteFill>
}
const DataFor = (i: number) => i === 3 ? <Panel60_40 /> : i === 4 ? <PanelRanks /> : i === 6 ? <PanelRange /> : i === 7 ? <PanelGens /> : null

export const CompPlanOverview: React.FC = () => {
  const bodyStart = INTRO - INTRO_XF
  let cursor = 0
  const starts = segD.map((d) => { const from = S(cursor); cursor += d - XF; return bodyStart + from })
  const endStart = bodyStart + bodyFrames - END_XF
  return (
    <AbsoluteFill style={{ background: NAVY_D }}>
      {/* voMaster places each line at scene-start + 0.18s (master-audio VO_OFFSET) */}
      <Audio src={staticFile('comp1/musicDucked.mp3')} volume={1} />
      <Audio src={staticFile('comp1/voMaster.mp3')} volume={1} />
      <Sequence from={0} durationInFrames={INTRO}><IntroScreen /></Sequence>
      {segD.map((d, i) => {
        const durF = S(d); const isData = DATASET.has(i); const cap = CAPS[i]
        return (
          <Sequence key={i} from={starts[i]} durationInFrames={durF + 2}>
            <Dissolve dur={durF}>
              <AbsoluteFill>
                {isData ? (
                  <AbsoluteFill style={{ background: NAVY_D }}>
                    {/* subtle paper texture bg behind data panels */}
                    <Img src={staticFile('comp1/f-0.png')} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.5) saturate(1.05)', transform: 'scale(1.1)' }} />
                    <AbsoluteFill style={{ background: 'rgba(19,38,73,0.5)' }} />
                    {DataFor(i)}
                  </AbsoluteFill>
                ) : (
                  <>
                    <Scene i={i} />
                    {cap ? <CaptionCard c={cap} /> : null}
                  </>
                )}
              </AbsoluteFill>
            </Dissolve>
          </Sequence>
        )
      })}
      <Sequence from={endStart} durationInFrames={END}><EndScreen /></Sequence>
      <CornerLogo from={bodyStart} to={endStart + S(0.3)} />
    </AbsoluteFill>
  )
}
