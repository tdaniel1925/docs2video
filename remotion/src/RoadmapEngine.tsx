import React from 'react'
import { AbsoluteFill, Sequence, Audio, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion'

/* ============================================================================
 * APEX ROADMAP — distributor training series ENGINE (props-driven, reusable).
 * ONE component runs every episode. Torn-paper (navy/red/cream). All readable
 * data on code-drawn cream torn-paper PANELS (never AI-spelled). Captions HOLD
 * (no flash). Intro/end titles HOLD. Ducked audio. Corner logo. Episode badge.
 * REP-FACING training: never expose the internal waterfall / company cut; BV is
 * a value Apex "designates" per product.
 * Per-episode wrappers pass: dir, data(durations.json), caps, panelMap, meta.
 * ==========================================================================*/
export const FPS = 30
const NAVY = '#1e3a70', NAVY_D = '#132649', RED = '#c0272d', WHITE = '#fff', CREAM = '#f4efe4', GREEN = '#2f7d4f'
const INK = '#23324a', SOFT = '#6b6a5c'
const FONT = 'Archivo, Inter, system-ui, sans-serif'
const EASE = { expoOut: Easing.bezier(0.16, 1, 0.3, 1), backOut: Easing.bezier(0.34, 1.56, 0.64, 1) }
export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))
export const S = (sec: number) => Math.round(sec * FPS)
export const C = { NAVY, NAVY_D, RED, WHITE, CREAM, GREEN, INK, SOFT, FONT, EASE }

/* ---- types ---- */
export type Cap = { kicker?: string; head: string; accent?: string }
export type EpisodeData = { vo: number[]; lines: string[]; panels: Record<string, string> }
export type EpisodeMeta = {
  dir: string                    // asset folder, e.g. 'road1'
  seriesTag: string              // e.g. 'APEX ROADMAP'
  episodeLabel: string           // intro tagline, e.g. 'Episode 1 · Welcome'
  introHead: string              // big intro title, e.g. 'Welcome To Apex'
  endHead: string; endAccent?: string  // end card headline
  endUrl?: string                // e.g. 'reachtheapex.net'
  finaleCap: Cap                 // caption on the last (finale) scene beat
}

const grainSVG = encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(#n)' opacity='0.5'/></svg>`)
export const Grain: React.FC<{ o?: number }> = ({ o = 0.05 }) => { const f = useCurrentFrame(); return <AbsoluteFill style={{ pointerEvents: 'none', backgroundImage: `url("data:image/svg+xml,${grainSVG}")`, backgroundPosition: `${(f * 4) % 180}px ${(f * 6) % 180}px`, mixBlendMode: 'multiply', opacity: o }} /> }
export const Star: React.FC<{ size?: number; color?: string }> = ({ size = 20, color = RED }) => (<svg width={size} height={size} viewBox="0 0 24 24"><path d="M12 1.6l2.9 6.5 7.1.6-5.4 4.7 1.7 6.9L12 17.9 5.7 20.3l1.7-6.9L2 8.7l7.1-.6z" fill={color} /></svg>)

/* ---- caption HOLDS (no out-fade; scene Dissolve handles exit) ---- */
const TORN_CARD = 'polygon(0% 7%,5% 2%,11% 8%,17% 2%,24% 8%,31% 2%,38% 8%,45% 2%,52% 8%,59% 2%,66% 8%,73% 2%,80% 8%,87% 2%,94% 8%,100% 3%,100% 92%,95% 98%,88% 91%,81% 98%,74% 91%,67% 98%,60% 91%,53% 98%,46% 91%,39% 98%,32% 91%,25% 98%,18% 91%,11% 98%,5% 91%,0% 96%)'
const CaptionCard: React.FC<{ c: Cap }> = ({ c }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const s = spring({ frame: f - 4, fps, config: { damping: 20, stiffness: 150 } })
  const head = c.accent && c.head.includes(c.accent) ? <>{c.head.replace(c.accent, '')}<span style={{ color: '#ff8a8a' }}>{c.accent}</span></> : c.head
  return (
    <div style={{ position: 'absolute', left: 80, bottom: 120, maxWidth: 1600, transform: `translateY(${(1 - s) * 40}px) rotate(-1.4deg)`, opacity: clamp(s) }}>
      <div style={{ background: NAVY, clipPath: TORN_CARD, padding: '26px 52px 30px' }}>
        {c.kicker ? <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}><Star /><div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 22, letterSpacing: '0.2em', color: '#ff9d9d', textTransform: 'uppercase' }}>{c.kicker}</div></div> : null}
        <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 68, lineHeight: 1.03, color: WHITE, letterSpacing: '-0.02em' }}>{head}</div>
      </div>
    </div>
  )
}

/* ---- code-drawn cream torn-paper PANEL (all readable data lives here) ---- */
const PANEL_TORN = 'polygon(1% 3%,7% 1%,14% 4%,21% 1%,29% 3%,37% 0%,45% 3%,53% 1%,61% 4%,69% 1%,77% 3%,85% 0%,93% 3%,99% 1%,100% 7%,99% 18%,100% 30%,99% 44%,100% 58%,99% 72%,100% 84%,99% 93%,94% 99%,85% 97%,76% 100%,66% 97%,56% 100%,46% 97%,36% 100%,26% 97%,16% 100%,8% 98%,2% 99%,0% 93%,1% 78%,0% 64%,1% 50%,0% 36%,1% 22%,0% 10%)'
export const Panel: React.FC<{ children: React.ReactNode; kicker?: string; foot?: React.ReactNode }> = ({ children, kicker, foot }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const s = spring({ frame: f - 2, fps, config: { damping: 17, stiffness: 120 } })
  return (
    <div style={{ position: 'absolute', left: 190, top: 130, width: 1540, height: 820, transform: `translateY(${(1 - s) * 26}px) rotate(-0.5deg)`, opacity: clamp(s) }}>
      <div style={{ position: 'absolute', inset: -8, background: 'rgba(0,0,0,0.42)', clipPath: PANEL_TORN, filter: 'blur(10px)' }} />
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(160deg, ${CREAM}, #ece5d6)`, clipPath: PANEL_TORN, overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '70px 100px', textAlign: 'center' }}>
        <Grain o={0.08} />
        {kicker ? <div style={{ position: 'relative', fontFamily: FONT, fontWeight: 800, fontSize: 26, letterSpacing: '0.2em', color: RED, textTransform: 'uppercase', marginBottom: 26 }}>{kicker}</div> : null}
        <div style={{ position: 'relative', width: '100%' }}>{children}</div>
        {foot ? <div style={{ position: 'relative', fontFamily: FONT, fontWeight: 700, fontSize: 30, color: INK, marginTop: 30, lineHeight: 1.3 }}>{foot}</div> : null}
      </div>
    </div>
  )
}
export const Big: React.FC<{ children: React.ReactNode; color?: string; size?: number }> = ({ children, color = NAVY, size = 170 }) => <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: size, lineHeight: 0.92, color, letterSpacing: '-0.03em' }}>{children}</div>
export const Lead: React.FC<{ children: React.ReactNode; size?: number }> = ({ children, size = 50 }) => <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: size, color: INK, lineHeight: 1.28 }}>{children}</div>
export const CountUp: React.FC<{ to: number; prefix?: string; suffix?: string; at?: number; dur?: number }> = ({ to, prefix = '', suffix = '', at = 6, dur = 28 }) => { const f = useCurrentFrame(); const p = interpolate(f - at, [0, dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut }); return <>{prefix}{Math.round(to * p).toLocaleString('en-US')}{suffix}</> }

/* ---- numbered step list (a very common training layout) ---- */
export const Steps: React.FC<{ items: string[]; kicker?: string; foot?: React.ReactNode }> = ({ items, kicker, foot }) => { const f = useCurrentFrame(); return (
  <Panel kicker={kicker} foot={foot}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'stretch', width: '100%', maxWidth: 1150, margin: '0 auto' }}>
      {items.map((t, i) => { const p = interpolate(f - (6 + i * 8), [0, 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.backOut }); return (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 26, opacity: clamp(p), transform: `translateX(${(1 - p) * -30}px)` }}>
          <div style={{ flexShrink: 0, width: 78, height: 78, borderRadius: 16, background: i % 2 ? RED : NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 42, color: WHITE }}>{i + 1}</div>
          <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 40, color: INK, textAlign: 'left', lineHeight: 1.2 }}>{t}</div>
        </div>) })}
    </div>
  </Panel>
) }

/* ---- two-column "this + that" (two ways to earn, two paths, etc) ---- */
export const TwoCol: React.FC<{ kicker?: string; foot?: React.ReactNode; left: { t: string; s?: string }; right: { t: string; s?: string }; joiner?: string }> = ({ kicker, foot, left, right, joiner = '+' }) => (
  <Panel kicker={kicker} foot={foot}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 30 }}>
      <div style={{ flex: 1, maxWidth: 520, minHeight: 220, background: NAVY, borderRadius: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 28 }}><div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 48, color: WHITE }}>{left.t}</div>{left.s ? <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 28, color: '#cdd8ec', marginTop: 8 }}>{left.s}</div> : null}</div>
      <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 64, color: SOFT }}>{joiner}</div>
      <div style={{ flex: 1, maxWidth: 520, minHeight: 220, background: RED, borderRadius: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 28 }}><div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 48, color: WHITE }}>{right.t}</div>{right.s ? <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 28, color: '#ffd9d9', marginTop: 8 }}>{right.s}</div> : null}</div>
    </div>
  </Panel>
)

/* ---- one big statement panel ---- */
export const Statement: React.FC<{ kicker?: string; foot?: React.ReactNode; children: React.ReactNode }> = ({ kicker, foot, children }) => (
  <Panel kicker={kicker} foot={foot}><Lead size={54}>{children}</Lead></Panel>
)

/* ---- paper scene (STRONG Ken-Burns) ---- */
const makeScene = (dir: string): React.FC<{ i: number }> => ({ i }) => {
  const f = useCurrentFrame(); const { durationInFrames } = useVideoConfig()
  const p = interpolate(f, [0, durationInFrames], [0, 1], { extrapolateRight: 'clamp', easing: Easing.bezier(0.33, 0, 0.4, 1) })
  const d = i % 4; const zoomIn = d < 2
  const scale = zoomIn ? 1.06 + p * 0.20 : 1.26 - p * 0.20
  const panX = (d === 0 ? 1 : d === 1 ? -1 : d === 2 ? 1 : -1) * p * 5
  const panY = (d % 2 === 0 ? -1 : 1) * p * 3
  return (
    <AbsoluteFill style={{ background: NAVY_D, overflow: 'hidden' }}>
      <Img src={staticFile(`${dir}/f-${i}.png`)} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale}) translate(${panX}%, ${panY}%)` }} />
      <Grain />
      <AbsoluteFill style={{ background: `linear-gradient(180deg, transparent 52%, rgba(19,38,73,0.6))` }} />
    </AbsoluteFill>
  )
}

const Blobs: React.FC = () => { const f = useCurrentFrame(); const d = Math.sin(f * 0.03) * 30; return (<AbsoluteFill style={{ background: `radial-gradient(120% 100% at 50% 40%, ${NAVY}, ${NAVY_D})` }}><div style={{ position: 'absolute', width: 700, height: 700, borderRadius: '50%', background: `${RED}22`, filter: 'blur(80px)', top: 120 + d, left: '30%' }} /></AbsoluteFill>) }
const INTRO = S(4.6), END = S(4.6), INTRO_XF = S(0.5), END_XF = S(0.5)

const IntroScreen: React.FC<{ meta: EpisodeMeta }> = ({ meta }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const s = spring({ frame: f - 4, fps, config: { damping: 13, stiffness: 130 } })
  const badgeIn = interpolate(f, [10, 22], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut })
  const headIn = interpolate(f, [18, 32], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut })
  // NO out-fade: the intro HOLDS solid to its last frame; the first body beat
  // dissolves in ON TOP of it (single-layer crossfade = no title flash).
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 22 }}>
      <Blobs />
      <div style={{ background: WHITE, borderRadius: 14, padding: '30px 54px', boxShadow: '0 26px 70px rgba(0,0,0,0.5)', transform: `translateY(${(1 - s) * 40}px) scale(${0.82 + clamp(s) * 0.18})`, opacity: clamp(s) }}><Img src={staticFile(`${meta.dir}/logo.png`)} style={{ height: 128, display: 'block' }} /></div>
      {/* episode badge (holds) */}
      <div style={{ opacity: badgeIn, transform: `translateY(${(1 - badgeIn) * 12}px)`, display: 'flex', alignItems: 'center', gap: 12, background: RED, borderRadius: 8, padding: '10px 22px' }}>
        <Star size={20} color={WHITE} /><div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 24, letterSpacing: '0.24em', color: WHITE, textTransform: 'uppercase' }}>{meta.seriesTag}</div>
      </div>
      {/* big episode title (holds) */}
      <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 72, color: WHITE, opacity: headIn, transform: `translateY(${(1 - headIn) * 12}px)`, letterSpacing: '-0.02em', textAlign: 'center' }}>{meta.introHead}</div>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 30, color: '#ff9d9d', opacity: headIn }}>{meta.episodeLabel}</div>
    </AbsoluteFill>
  )
}
const EndScreen: React.FC<{ meta: EpisodeMeta }> = ({ meta }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig(); const s = spring({ frame: f - 4, fps, config: { damping: 14, stiffness: 140 } })
  const tag = interpolate(f, [20, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut })
  const url = interpolate(f, [34, 54], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut })
  const head = meta.endAccent && meta.endHead.includes(meta.endAccent) ? <>{meta.endHead.replace(meta.endAccent, '')}<span style={{ color: '#ff8a8a' }}>{meta.endAccent}</span></> : meta.endHead
  return (
    <AbsoluteFill>
      <Blobs />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 24, padding: '0 120px' }}>
        <div style={{ background: WHITE, borderRadius: 14, padding: '30px 54px', boxShadow: '0 22px 60px rgba(0,0,0,0.5)', transform: `translateY(${(1 - s) * 34}px) scale(${0.86 + clamp(s) * 0.14})`, opacity: clamp(s) }}><Img src={staticFile(`${meta.dir}/logo.png`)} style={{ height: 118, display: 'block' }} /></div>
        <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 50, color: WHITE, opacity: tag, textAlign: 'center', lineHeight: 1.15 }}>{head}</div>
        {meta.endUrl ? <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 44, color: WHITE, opacity: url }}>{meta.endUrl}</div> : null}
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
const CornerLogo: React.FC<{ from: number; to: number; dir: string }> = ({ from, to, dir }) => { const f = useCurrentFrame(); const inO = interpolate(f, [from, from + S(0.5)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }); const outO = interpolate(f, [to - S(0.5), to], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }); return <div style={{ position: 'absolute', top: 40, right: 50, opacity: Math.min(inO, outO) }}><div style={{ background: 'rgba(255,255,255,0.92)', borderRadius: 10, padding: '10px 18px', boxShadow: '0 6px 22px rgba(0,0,0,0.35)' }}><Img src={staticFile(`${dir}/logo.png`)} style={{ height: 38, display: 'block' }} /></div></div> }

/* ---- timeline ---- */
const PAD = 0.5, XF = 0.4
const Dissolve: React.FC<{ dur: number; children: React.ReactNode; noOut?: boolean }> = ({ dur, children, noOut }) => { const f = useCurrentFrame(); const xf = S(XF); const inO = interpolate(f, [0, xf], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }); const outO = noOut ? 1 : interpolate(f, [dur - xf, dur], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }); return <AbsoluteFill style={{ opacity: Math.min(inO, outO) }}>{children}</AbsoluteFill> }

// NO overlap between intro/body/end — each holds solid then the next covers it.
// bodyStart = INTRO (clean handoff, no double-fade flash). endStart = right after
// the last beat. Audio master must use BODY_START = INTRO/FPS (4.6) to stay synced.
export const framesFor = (vo: number[]) => {
  const segD = vo.map((d) => (d || 6) + PAD)
  const bodyFrames = Math.round((segD.reduce((a, b) => a + b, 0) - (segD.length - 1) * XF) * FPS)
  return INTRO + bodyFrames + END
}

export const RoadmapEpisode: React.FC<{ data: EpisodeData; caps: Record<number, Cap>; panelMap: Record<string, React.FC>; meta: EpisodeMeta }> = ({ data, caps, panelMap, meta }) => {
  const vo = data.vo || []; const PANELS = data.panels || {}
  const Scene = makeScene(meta.dir)
  const FINALE = vo.length - 1
  const segD = vo.map((d) => (d || 6) + PAD)
  const bodyFrames = Math.round((segD.reduce((a, b) => a + b, 0) - (segD.length - 1) * XF) * FPS)
  const bodyStart = INTRO // clean cut from intro → body (no overlap = no flash)
  let cursor = 0
  const starts = segD.map((d) => { const from = S(cursor); cursor += d - XF; return bodyStart + from })
  const endStart = bodyStart + bodyFrames // EndScreen starts right when body ends
  const bgScene = (i: number) => { for (let k = i; k >= 0; k--) if (!PANELS[k]) return k; return 0 }
  return (
    <AbsoluteFill style={{ background: NAVY_D }}>
      <Audio src={staticFile(`${meta.dir}/musicDucked.mp3`)} volume={1} />
      <Audio src={staticFile(`${meta.dir}/voMaster.mp3`)} volume={1} />
      <Sequence from={0} durationInFrames={INTRO}><IntroScreen meta={meta} /></Sequence>
      {segD.map((d, i) => {
        const durF = S(d); const panel = PANELS[i]; const cap = caps[i]; const P = panel ? panelMap[panel] : null
        const finale = i === FINALE
        return (
          <Sequence key={i} from={starts[i]} durationInFrames={durF + 2}>
            <Dissolve dur={durF} noOut={finale}>
              <AbsoluteFill>
                {panel ? (
                  <AbsoluteFill style={{ background: NAVY_D }}>
                    <Img src={staticFile(`${meta.dir}/f-${bgScene(i)}.png`)} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.45) saturate(1.05)', transform: 'scale(1.12)' }} />
                    <AbsoluteFill style={{ background: 'rgba(19,38,73,0.55)' }} />
                    {P ? <P /> : null}
                  </AbsoluteFill>
                ) : finale ? (
                  // Finale = hero scene + torn caption ONLY. Dedicated EndScreen
                  // after is the single CTA card (no duplicate → no end-title flash).
                  <AbsoluteFill><Scene i={i} /><CaptionCard c={meta.finaleCap} /></AbsoluteFill>
                ) : (
                  <><Scene i={i} />{cap && cap.head ? <CaptionCard c={cap} /> : null}</>
                )}
              </AbsoluteFill>
            </Dissolve>
          </Sequence>
        )
      })}
      <Sequence from={endStart} durationInFrames={END}><EndScreen meta={meta} /></Sequence>
      <CornerLogo from={bodyStart} to={endStart + S(0.3)} dir={meta.dir} />
    </AbsoluteFill>
  )
}
