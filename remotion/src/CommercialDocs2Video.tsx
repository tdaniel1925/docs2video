import React from 'react'
import { AbsoluteFill, Img, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion'
import { loadFont as loadPlusJakarta } from '@remotion/google-fonts/PlusJakartaSans'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import bgGrid from '../public/docs2video/beatgrid.json'
import { StreakWipe, Bokeh, Alive, sustained, SettleSweep, LogoBug } from './lib/pizzazz'
import { makeMusicDuck, beatLock, gridToFrames, durationsFromStarts, type VoWindow } from './lib/audio'
import { Intro, pickIntro } from './lib/intros'
import { MusicBed } from './lib/musicbed'
import { MorphCut, ParticleField, Cursor } from './lib/dynamics'

const { fontFamily: JAKARTA } = loadPlusJakarta()   // matches the app's brand font
const { fontFamily: BODY } = loadInter()
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const FPS = 30

/* ============================================================================
 * DOCS2VIDEO — commercial for our own product, with the CURRENT feature set.
 *   · WHAT: turn any document (PDF/text/idea) into a professional, branded,
 *     narrated explainer VIDEO — plus editable slide deck (PPTX) + PDF — with a
 *     shareable watch page. "in minutes, not hours."
 *   · CURRENT FEATURES shown: narrative-first two-pass scripting (real story, not
 *     disjointed slides), multiple video STYLES, 65 slide templates, 6 voices,
 *     AI music, real-logo + website-scraper branding, branded share/watch page
 *     with calendar booking. Start free — 2,000 credits.
 *   · LOOK: blue + teal + gold on dark navy — harmonizes with the logo.
 *   · SIGNATURE DYNAMIC: the document → VIDEO MorphCut transformation (the whole
 *     product in one motion). + style cards, feature reveals, share-page cursor.
 *   · INTRO: signature (elegant draw) — premium-but-friendly product feel.
 *   · LogoBug upper-left through the body (the new system rule).
 * ==========================================================================*/

const BG = '#0b1220', BG2 = '#0f1b30', PANEL = '#152238'
const TEAL = '#0d9488', TEAL_HI = '#2dd4bf', BLUE = '#3b82f6', BLUE_HI = '#60a5fa'
const GOLD = '#f5a623', TERRA = '#e0592f'
const CREAM = '#f4f7fb', WHITE = '#ffffff', MUTE = '#8fa3bf'
const PANEL_LINE = '#23344f'

const Logo: React.FC<{ w?: number }> = ({ w = 460 }) => (
  <Img src={staticFile('docs2video/logo.png')} style={{ width: w, height: 'auto', display: 'block', filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.5))' }} />
)

const Head: React.FC<{ pre?: string; hot?: string; post?: string; size?: number; hold: number; kicker?: string; color?: string }> =
({ pre = '', hot = '', post = '', size = 64, hold, kicker, color = TEAL_HI }) => {
  const frame = useCurrentFrame()
  const o = interpolate(frame, [0, 8, hold - 10, hold], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const y = interpolate(frame, [0, 14], [16, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  const kO = interpolate(frame, [2, 10], [0, 1], { extrapolateRight: 'clamp' })
  const rule = clamp((frame - 8) / 14, 0, 1)
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 150 }}>
      <div style={{ opacity: o, transform: `translateY(${y}px)`, textAlign: 'center', maxWidth: 1500 }}>
        {kicker && <div style={{ fontFamily: BODY, fontWeight: 700, fontSize: 20, letterSpacing: '0.24em', textTransform: 'uppercase', color: color, marginBottom: 18, opacity: kO }}>{kicker}</div>}
        <div style={{ fontFamily: JAKARTA, fontWeight: 700, fontSize: size, color: CREAM, lineHeight: 1.16, paddingBottom: '0.04em', letterSpacing: '-0.01em', textShadow: '0 4px 30px rgba(0,0,0,0.85)' }}>
          {pre}{hot && <span style={{ color, textShadow: `0 0 22px ${color}55` }}>{hot}</span>}{post}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 22 }}>
          <div style={{ width: 130 * rule, height: 2, background: `linear-gradient(90deg, transparent, ${color}, transparent)`, boxShadow: `0 0 12px ${color}` }} />
        </div>
      </div>
    </AbsoluteFill>
  )
}

// a little document mock (pages of "text" lines)
const DocMock: React.FC<{ scale?: number }> = ({ scale = 1 }) => (
  <div style={{ width: 300 * scale, height: 400 * scale, background: '#f7f9fc', borderRadius: 12, padding: 26 * scale, boxShadow: '0 20px 50px rgba(0,0,0,0.5)', transform: `rotate(-3deg)` }}>
    <div style={{ width: '55%', height: 14 * scale, background: '#1f2d45', borderRadius: 4, marginBottom: 18 * scale }} />
    {Array.from({ length: 9 }, (_, i) => <div key={i} style={{ width: `${92 - (i % 3) * 14}%`, height: 8 * scale, background: '#c7d2e0', borderRadius: 3, marginBottom: 12 * scale }} />)}
  </div>
)
// a video player mock (branded slide + play button)
const VideoMock: React.FC<{ scale?: number }> = ({ scale = 1 }) => {
  const frame = useCurrentFrame()
  const pulse = 1 + Math.sin(frame * 0.15) * 0.05
  return (
    <div style={{ width: 460 * scale, height: 300 * scale, background: `linear-gradient(140deg, ${BG2}, ${PANEL})`, borderRadius: 16, boxShadow: `0 20px 50px rgba(0,0,0,0.55), 0 0 0 1px ${TEAL}44`, overflow: 'hidden', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(60% 60% at 30% 30%, ${TEAL}22, transparent)` }} />
      <div style={{ position: 'absolute', top: 24, left: 26, width: '50%', height: 16, background: TEAL_HI, borderRadius: 4 }} />
      <div style={{ position: 'absolute', top: 52, left: 26, width: '38%', height: 10, background: MUTE, borderRadius: 3 }} />
      <div style={{ position: 'absolute', bottom: 20, left: 26, right: 26, height: 5, background: '#2a3a54', borderRadius: 3 }}>
        <div style={{ width: '40%', height: '100%', background: GOLD, borderRadius: 3 }} />
      </div>
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: `translate(-50%,-50%) scale(${pulse})`, width: 76 * scale, height: 76 * scale, borderRadius: '50%', background: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 30px ${GOLD}66` }}>
        <div style={{ width: 0, height: 0, borderLeft: `${26 * scale}px solid ${BG}`, borderTop: `${16 * scale}px solid transparent`, borderBottom: `${16 * scale}px solid transparent`, marginLeft: 8 * scale }} />
      </div>
    </div>
  )
}

const s = (sec: number) => Math.round(sec * FPS)
type Beat = { dur: number; vo?: string; el: React.ReactNode }
// VO: 1:3.07 2:3.90 3:7.34 4:8.31 5:7.71 6:7.24 7:7.20 8:5.48 9:5.06 10:2.74
const BEATS: Beat[] = [
  // 1 — the problem
  { dur: s(3.07 + 0.2), vo: 'dv-1', el: <ProblemBeat hold={s(3.07 + 0.2)} /> },
  // 2 — the stat
  { dur: s(3.90 + 0.3), vo: 'dv-2', el: <StatBeat hold={s(3.90 + 0.3)} /> },
  // 3 — upload anything (doc) → THE MORPH is here at the transformation
  { dur: s(7.34 + 0.2), vo: 'dv-3', el: <TransformBeat hold={s(7.34 + 0.2)} /> },
  // 4 — the AI writes a real STORY (not disjointed slides) — a current feature
  { dur: s(8.31 + 0.2), vo: 'dv-4', el: <StoryBeat hold={s(8.31 + 0.2)} /> },
  // 5 — branded video in minutes (your logo/colors/voice)
  { dur: s(7.71 + 0.2), vo: 'dv-5', el: <BrandedBeat hold={s(7.71 + 0.2)} /> },
  // 6 — the feature grid (styles, templates, voices, music)
  { dur: s(7.24 + 0.2), vo: 'dv-6', el: <FeatureGrid hold={s(7.24 + 0.2)} /> },
  // 7 — three formats
  { dur: s(7.20 + 0.2), vo: 'dv-7', el: <FormatsBeat hold={s(7.20 + 0.2)} /> },
  // 8 — the share page (cursor books a call)
  { dur: s(5.48 + 0.2), vo: 'dv-8', el: <SharePageBeat hold={s(5.48 + 0.2)} /> },
  // 9 — brand
  { dur: s(5.06 + 0.3), vo: 'dv-9', el: <BrandBeat hold={s(5.06 + 0.3)} /> },
  // 10 — CTA
  { dur: s(2.74 + 1.6), vo: 'dv-10', el: <CTACard hold={s(2.74 + 1.6)} /> },
]

function ProblemBeat({ hold }: { hold: number }) {
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 40%, #201824, ${BG})` }}>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        {/* a doc being ignored — fades/greys */}
        <div style={{ opacity: 0.5, filter: 'grayscale(0.6)' }}><DocMock scale={0.8} /></div>
      </AbsoluteFill>
      <Head pre="You send documents. They " hot="don't read them." size={58} color={TERRA} hold={hold} />
    </AbsoluteFill>
  )
}

function StatBeat({ hold }: { hold: number }) {
  const frame = useCurrentFrame()
  const pop = spring({ frame: frame - 2, fps: FPS, config: { damping: 12, stiffness: 160 } })
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 40%, ${BG2}, ${BG})` }}>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
        <div style={{ fontFamily: JAKARTA, fontWeight: 800, fontSize: 200, color: TERRA, transform: `scale(${0.7 + clamp(pop, 0, 1) * 0.3})`, textShadow: `0 0 50px ${TERRA}44`, lineHeight: 1.15, paddingBottom: '0.04em' }}>&lt;2 min</div>
        <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 32, color: MUTE, letterSpacing: '0.1em', marginTop: 6, opacity: clamp((frame - 12) / 8, 0, 1) }}>of attention per document</div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

// THE SIGNATURE MOMENT — a document morphs into a video
function TransformBeat({ hold }: { hold: number }) {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 40%, ${BG2}, ${BG})` }}>
      <ParticleField color={TEAL} count={16} kind="data" />
      <MorphCut at={20} dur={22} from={<DocMock scale={1.1} />} to={<VideoMock scale={1.15} />} />
      <Head pre="Upload " hot="any document." size={54} hold={hold} />
    </AbsoluteFill>
  )
}

function StoryBeat({ hold }: { hold: number }) {
  const frame = useCurrentFrame()
  // disjointed fragments reorder into a flowing line
  const flow = clamp((frame - 20) / 30, 0, 1)
  const frags = ['intro', 'the problem', 'your solution', 'the proof', 'the ask']
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 38%, ${BG2}, ${BG})` }}>
      <Alive intensity={0.5}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 34 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {frags.map((f, i) => {
              const at = 6 + i * 5
              const o = interpolate(frame, [at, at + 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
              const jitter = (1 - flow) * (i % 2 ? 12 : -12)
              return (
                <React.Fragment key={i}>
                  <div style={{ opacity: o, transform: `translateY(${jitter}px)`, background: PANEL, border: `1px solid ${TEAL}55`, borderRadius: 10, padding: '14px 22px', fontFamily: BODY, fontWeight: 600, fontSize: 26, color: CREAM }}>{f}</div>
                  {i < frags.length - 1 && <div style={{ width: 20 * flow, height: 3, background: TEAL_HI, opacity: flow, borderRadius: 3 }} />}
                </React.Fragment>
              )
            })}
          </div>
        </AbsoluteFill>
      </Alive>
      <Head pre="A real story — " hot="not disjointed slides." size={52} hold={hold} />
    </AbsoluteFill>
  )
}

function BrandedBeat({ hold }: { hold: number }) {
  const frame = useCurrentFrame()
  const items = [['Your logo', TEAL_HI], ['Your colors', GOLD], ['Your voice', BLUE_HI]]
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 40%, ${BG2}, ${BG})` }}>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 30 }}>
        <div style={{ transform: 'scale(1.1)' }}><VideoMock scale={0.95} /></div>
        <div style={{ display: 'flex', gap: 18 }}>
          {items.map(([t, c], i) => {
            const at = 16 + i * 6
            const pop = spring({ frame: frame - at, fps: FPS, config: { damping: 12, stiffness: 200 } })
            return <div key={i} style={{ transform: `scale(${clamp(pop, 0, 1)})`, background: PANEL, border: `1px solid ${c}66`, borderRadius: 10, padding: '12px 24px', fontFamily: JAKARTA, fontWeight: 700, fontSize: 28, color: c as string }}>{t}</div>
          })}
        </div>
      </AbsoluteFill>
      <Head kicker="Branded, narrated, in minutes" hot="Made yours." size={46} hold={hold} />
    </AbsoluteFill>
  )
}

function FeatureGrid({ hold }: { hold: number }) {
  const frame = useCurrentFrame()
  const feats: [string, string, string][] = [
    ['🎬', 'Stunning video styles', TEAL_HI],
    ['🎨', '65 slide templates', GOLD],
    ['🎙️', '6 pro voices', BLUE_HI],
    ['🎵', 'AI music', TERRA],
  ]
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 36%, ${BG2}, ${BG})` }}>
      <Bokeh color={TEAL} count={6} big />
      <Alive intensity={0.5}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
            {feats.map(([ic, t, c], i) => {
              const at = sustained(i, feats.length, hold, 8)
              const pop = spring({ frame: frame - at, fps: FPS, config: { damping: 12, stiffness: 190 } })
              return (
                <div key={i} style={{ transform: `scale(${clamp(pop, 0, 1)})`, background: PANEL, border: `1px solid ${c}55`, borderRadius: 16, padding: '28px 44px', display: 'flex', alignItems: 'center', gap: 22, width: 560, boxShadow: `0 0 ${Math.abs(Math.sin(frame * 0.08 + i)) * 16}px ${c}22` }}>
                  <div style={{ fontSize: 54 }}>{ic}</div>
                  <div style={{ fontFamily: JAKARTA, fontWeight: 700, fontSize: 40, color: WHITE }}>{t}</div>
                </div>
              )
            })}
          </div>
        </AbsoluteFill>
      </Alive>
      <SettleSweep color={TEAL} hold={hold} />
    </AbsoluteFill>
  )
}

function FormatsBeat({ hold }: { hold: number }) {
  const frame = useCurrentFrame()
  const fmts: [string, string, string][] = [['📹', 'Video', TEAL_HI], ['📊', 'Slide Deck', GOLD], ['📄', 'PDF', BLUE_HI]]
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 40%, ${BG2}, ${BG})` }}>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 40 }}>
        <div style={{ fontFamily: JAKARTA, fontWeight: 700, fontSize: 48, color: CREAM, opacity: clamp((frame - 4) / 8, 0, 1) }}>One document. <span style={{ color: TEAL_HI }}>Three ways to share.</span></div>
        <div style={{ display: 'flex', gap: 30 }}>
          {fmts.map(([ic, t, c], i) => {
            const at = 10 + i * 8
            const pop = spring({ frame: frame - at, fps: FPS, config: { damping: 11, stiffness: 190 } })
            return (
              <div key={i} style={{ transform: `scale(${clamp(pop, 0, 1)})`, background: PANEL, border: `2px solid ${c}`, borderRadius: 18, padding: '34px 50px', textAlign: 'center', width: 320, boxShadow: `0 0 26px ${c}22` }}>
                <div style={{ fontSize: 68 }}>{ic}</div>
                <div style={{ fontFamily: JAKARTA, fontWeight: 700, fontSize: 42, color: c as string, marginTop: 10 }}>{t}</div>
              </div>
            )
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

function SharePageBeat({ hold }: { hold: number }) {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 38%, ${BG2}, ${BG})` }}>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        {/* a branded share page mock: video + book-a-call button */}
        <div style={{ background: PANEL, border: `1px solid ${PANEL_LINE}`, borderRadius: 20, padding: 28, boxShadow: '0 30px 70px rgba(0,0,0,0.5)', display: 'flex', gap: 26, alignItems: 'center' }}>
          <VideoMock scale={0.8} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: 340 }}>
            <div style={{ width: '80%', height: 18, background: '#2a3a54', borderRadius: 4 }} />
            <div style={{ width: '60%', height: 12, background: '#22314a', borderRadius: 3 }} />
            <div style={{ marginTop: 10, background: `linear-gradient(180deg, ${TEAL_HI}, ${TEAL})`, borderRadius: 10, padding: '16px 0', textAlign: 'center', fontFamily: JAKARTA, fontWeight: 700, fontSize: 28, color: BG, boxShadow: `0 0 24px ${TEAL}55` }}>📅 Book a Call</div>
          </div>
        </div>
      </AbsoluteFill>
      {/* cursor moves to the book button and clicks */}
      <Cursor from={[40, 80]} to={[62, 60]} clickAt={s(2.6)} color={TEAL_HI} />
      <Head kicker="Every video ships with" hot="a branded share page." size={44} hold={hold} />
    </AbsoluteFill>
  )
}

function BrandBeat({ hold }: { hold: number }) {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const up = spring({ frame: frame - 2, fps, config: { damping: 15, stiffness: 120 } })
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 45%, ${BG2}, ${BG})` }}>
      <Bokeh color={TEAL} count={6} big />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 22 }}>
        <div style={{ transform: `scale(${0.78 + clamp(up, 0, 1) * 0.22})` }}><Logo w={560} /></div>
        <div style={{ fontFamily: JAKARTA, fontWeight: 700, fontSize: 40, color: CREAM, textAlign: 'center', opacity: clamp((frame - 14) / 10, 0, 1), maxWidth: 1200 }}>Turn any document into a <span style={{ color: TEAL_HI }}>professional explainer video.</span></div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

function CTACard({ hold }: { hold: number }) {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const btn = spring({ frame: frame - 4, fps, config: { damping: 12, stiffness: 180 } })
  const url = interpolate(frame, [26, 38], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const pulse = 1 + Math.sin(frame * 0.14) * 0.03
  return (
    <AbsoluteFill style={{ background: `radial-gradient(130% 120% at 50% 42%, ${BG2}, ${BG})` }}>
      <Bokeh color={GOLD} count={6} big />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 26 }}>
        <Logo w={420} />
        <div style={{ marginTop: 6, opacity: clamp(btn, 0, 1), transform: `scale(${(0.7 + clamp(btn, 0, 1) * 0.3) * pulse})` }}>
          <div style={{ background: `linear-gradient(180deg, ${GOLD}, ${TERRA})`, color: '#1a1206', fontFamily: JAKARTA, fontWeight: 800, fontSize: 34, letterSpacing: '0.01em', padding: '20px 56px', borderRadius: 12, boxShadow: `0 0 34px ${GOLD}55`, textAlign: 'center' }}>Start Free — 2,000 Credits</div>
        </div>
        <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 28, color: MUTE, letterSpacing: '0.04em', opacity: url }}>docs2video.com · no commitment</div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

// ---- intro + shared plumbing ----
const INTRO = Math.round(3.0 * FPS)
const INTRO_STYLE = pickIntro('luxury')   // → 'signature' (elegant draw) — premium but friendly
const rawStarts: number[] = []; { let t = INTRO; for (const b of BEATS) { rawStarts.push(t); t += b.dur } }
const B_STARTS = beatLock(rawStarts, gridToFrames((bgGrid as any).beats, FPS).filter((g) => g >= INTRO), Math.round(0.2 * FPS))
export const docs2videoDuration = B_STARTS[B_STARTS.length - 1] + BEATS[BEATS.length - 1].dur + 6

export const CommercialDocs2Video: React.FC = () => {
  const starts = B_STARTS
  const durs = durationsFromStarts(starts, docs2videoDuration - 6)
  const total = docs2videoDuration
  const voWin = BEATS.map((b, i) => b.vo ? { start: starts[i], end: starts[i] + durs[i] } : null).filter(Boolean) as VoWindow[]
  const musicDuck = makeMusicDuck(voWin, total, { loud: 0.2, duck: 0.08, ramp: 18, fadeInEnd: 14 })
  return (
    <AbsoluteFill style={{ background: BG }}>
      {/* SIGNATURE intro — the Docs2Video logo draws on with a shimmer */}
      <Sequence from={0} durationInFrames={INTRO + 2}>
        <Intro style={INTRO_STYLE} dur={INTRO} tokens={{ bg: BG, bg2: BG2, accent: TEAL, accentHi: TEAL_HI }} render={<Logo w={540} />} />
      </Sequence>
      {BEATS.map((b, i) => (
        <Sequence key={i} from={starts[i]} durationInFrames={durs[i] + 6}>
          {b.el}
          {/* persistent logo bug during the body (skip brand beat #8 + CTA #9) */}
          {i < 8 && <LogoBug src="docs2video/logo.png" width={190} />}
          {i > 0 && <StreakWipe color={TEAL} dir={i % 2 ? 1 : -1} dur={12} />}
        </Sequence>
      ))}
      {/* MusicBed loops the track to cover the FULL video (fixes music cut-off) */}
      <MusicBed src="docs2video/music.mp3" musicFrames={1322} volume={musicDuck} />
      {BEATS.map((b, i) => b.vo ? (
        <Sequence key={'vo' + i} from={starts[i]}><Audio src={staticFile(`docs2video/${b.vo}.mp3`)} volume={1.0} /></Sequence>
      ) : null)}
      {starts.slice(1).map((st, i) => (
        <Sequence key={'w' + i} from={st - 3} durationInFrames={16}><Audio src={staticFile('sfx/whoosh-short.wav')} volume={0.22} /></Sequence>
      ))}
      <Sequence from={starts[2] + 20} durationInFrames={26}><Audio src={staticFile('sfx/impact-soft.wav')} volume={0.36} /></Sequence>
    </AbsoluteFill>
  )
}
