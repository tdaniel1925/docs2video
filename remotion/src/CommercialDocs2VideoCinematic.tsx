import React from 'react'
import { AbsoluteFill, Img, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion'
import { loadFont as loadPlusJakarta } from '@remotion/google-fonts/PlusJakartaSans'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import { CountUp, LogoBug } from './lib/pizzazz'
import { makeMusicDuck, type VoWindow } from './lib/audio'
import { MusicBed } from './lib/musicbed'
import { Intro, pickIntro } from './lib/intros'
import { LivingStill, CamBreath, CamMove, WeightyEntry } from './lib/cinematography'

const { fontFamily: JAKARTA } = loadPlusJakarta()
const { fontFamily: BODY } = loadInter()
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const FPS = 30

/* ============================================================================
 * DOCS2VIDEO — CINEMATIC LIVING-STILL flagship. Every image is a LIVING scene
 * (parallax push + atmospheric overlays + cinematic grade), a continuous flowing
 * camera, weighty text entries. No AI video — stills MADE to feel like video.
 * Uses the current feature set (from BUILD-STATE + site).
 * ==========================================================================*/

const BG = '#0b1220', BG2 = '#0f1b30'
const TEAL = '#12a394', TEAL_HI = '#3ad6c4', GOLD = '#f5a623', TERRA = '#e0592f'
const CREAM = '#f4f7fb', WHITE = '#ffffff', MUTE = '#a7bad2'

const Logo: React.FC<{ w?: number }> = ({ w = 460 }) => (
  <Img src={staticFile('d2v-cine/logo.png')} style={{ width: w, height: 'auto', display: 'block', filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.6))' }} />
)

// cinematic headline — weighty entry, sits in the lower third over the living still
const Line: React.FC<{ pre?: string; hot?: string; post?: string; sub?: string; size?: number; hold: number; color?: string; at?: number }> =
({ pre = '', hot = '', post = '', sub, size = 62, hold, color = TEAL_HI, at = 4 }) => {
  const frame = useCurrentFrame()
  const o = interpolate(frame, [at, at + 10, hold - 12, hold], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const y = interpolate(frame, [at, at + 18], [30, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  const rule = clamp((frame - at - 6) / 16, 0, 1)
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 130 }}>
      <div style={{ opacity: o, transform: `translateY(${y}px)`, textAlign: 'center', maxWidth: 1500 }}>
        <div style={{ fontFamily: JAKARTA, fontWeight: 700, fontSize: size, color: CREAM, lineHeight: 1.16, paddingBottom: '0.04em', letterSpacing: '-0.01em', textShadow: '0 4px 40px rgba(0,0,0,0.95)' }}>
          {pre}{hot && <span style={{ color, textShadow: `0 0 26px ${color}66` }}>{hot}</span>}{post}
        </div>
        {sub && <div style={{ fontFamily: BODY, fontWeight: 500, fontSize: size * 0.36, color: MUTE, marginTop: 14, textShadow: '0 2px 20px rgba(0,0,0,0.9)' }}>{sub}</div>}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
          <div style={{ width: 130 * rule, height: 2, background: `linear-gradient(90deg, transparent, ${color}, transparent)`, boxShadow: `0 0 12px ${color}` }} />
        </div>
      </div>
    </AbsoluteFill>
  )
}

const s = (sec: number) => Math.round(sec * FPS)
type Beat = { dur: number; vo?: string; el: React.ReactNode; cam?: boolean }
// reuse existing VO (dv-*, copied into d2v-cine). durs: 1:3.07 2:3.90 3:7.34 4:8.31 5:7.71 6:7.24 7:7.20 8:5.48 9:5.06 10:2.74
const BEATS: Beat[] = [
  // 1 — the problem: LITERAL ignored docs (subtle dust only, gritty)
  { dur: s(3.07 + 0.3), vo: 'dv-1', el: <><Living src="gen/ignored.png" atmos="dust" grade="gritty" dur={s(3.37)} camFrom={[6, 3, 1.28]} />
      <Line pre="You send documents. They " hot="don't read them." color={TERRA} size={58} hold={s(3.07 + 0.3)} /></> },
  // 2 — the stat
  { dur: s(3.90 + 0.3), vo: 'dv-2', el: <StatBeat hold={s(3.90 + 0.3)} /> },
  // 3 — LITERAL: dragging a PDF into an upload drop-zone (clean, no atmosphere)
  { dur: s(7.34 + 0.3), vo: 'dv-3', el: <><Living src="gen/upload.png" atmos="none" grade="clean" dur={s(7.64)} focus="45% 42%" camFrom={[-5, 2, 1.2]} />
      <Line pre="Upload " hot="any document." sub="Our AI reads every page" size={56} hold={s(7.34 + 0.3)} color={GOLD} /></> },
  // 4 — LITERAL: a connected storyboard/timeline on screen
  { dur: s(8.31 + 0.3), vo: 'dv-4', el: <><Living src="gen/story.png" atmos="none" grade="clean" dur={s(8.61)} camFrom={[5, -2, 1.18]} />
      <Line pre="A real story — " hot="not disjointed slides." size={54} hold={s(8.31 + 0.3)} /></> },
  // 5 — LITERAL: a finished branded video PLAYING on screen
  { dur: s(7.71 + 0.3), vo: 'dv-5', el: <><Living src="gen/video.png" atmos="none" grade="clean" dur={s(8.01)} focus="55% 45%" camFrom={[-6, 1, 1.2]} />
      <Line pre="Branded. Narrated. " hot="In minutes." sub="Your logo · your colors · your voice" size={54} hold={s(7.71 + 0.3)} color={GOLD} /></> },
  // 6 — the feature grid (weighty chips)
  { dur: s(7.24 + 0.3), vo: 'dv-6', el: <FeatureGrid hold={s(7.24 + 0.3)} /> },
  // 7 — three formats
  { dur: s(7.20 + 0.3), vo: 'dv-7', el: <FormatsBeat hold={s(7.20 + 0.3)} /> },
  // 8 — LITERAL: client watches a video and clicks to book (warm, subtle bokeh)
  { dur: s(5.48 + 0.3), vo: 'dv-8', el: <><Living src="gen/book.png" atmos="dust" grade="warm" dur={s(5.78)} camFrom={[4, 2, 1.2]} />
      <Line pre="They watch. " hot="They book." sub="Every video ships with a branded share page" size={52} hold={s(5.48 + 0.3)} /></> },
  // 9 — brand
  { dur: s(5.06 + 0.3), vo: 'dv-9', el: <BrandBeat hold={s(5.06 + 0.3)} /> },
  // 10 — CTA
  { dur: s(2.74 + 1.8), vo: 'dv-10', el: <CTACard hold={s(2.74 + 1.8)} /> },
]

// a living still wrapped in a slow camera move — the flowing-camera + parallax combo
function Living({ src, atmos, grade, dur, focus = '50% 45%', camFrom = [4, 2, 1.22] as [number, number, number] }:
  { src: string; atmos: any; grade: any; dur: number; focus?: string; camFrom?: [number, number, number] }) {
  return (
    <CamBreath intensity={1.1}>
      <CamMove keys={[{ at: 0, x: camFrom[0], y: camFrom[1], scale: camFrom[2] }, { at: dur, x: 0, y: 0, scale: 1.0 }]}>
        <LivingStill src={`d2v-cine/${src}`} dur={dur} atmos={atmos} grade={grade} focus={focus} push={0.12} />
      </CamMove>
    </CamBreath>
  )
}

function StatBeat({ hold }: { hold: number }) {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const pop = spring({ frame: frame - 2, fps, config: { damping: 12, stiffness: 160 } })
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 40%, ${BG2}, ${BG})` }}>
      <CamBreath intensity={0.8}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
          <div style={{ fontFamily: JAKARTA, fontWeight: 800, fontSize: 210, color: TERRA, transform: `scale(${0.7 + clamp(pop, 0, 1) * 0.3})`, textShadow: `0 0 50px ${TERRA}44`, lineHeight: 1.15, paddingBottom: '0.04em' }}>&lt;2 min</div>
          <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 32, color: MUTE, letterSpacing: '0.1em', marginTop: 6, opacity: clamp((frame - 12) / 8, 0, 1) }}>of attention per document</div>
        </AbsoluteFill>
      </CamBreath>
    </AbsoluteFill>
  )
}

function FeatureGrid({ hold }: { hold: number }) {
  const feats: [string, string, string][] = [
    ['🎬', 'Stunning video styles', TEAL_HI], ['🎨', '65 slide templates', GOLD],
    ['🎙️', '6 pro voices', '#60a5fa'], ['🎵', 'AI music', TERRA],
  ]
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 36%, ${BG2}, ${BG})` }}>
      <CamBreath intensity={0.9}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {feats.map(([ic, t, c], i) => (
              <div key={i} style={{ display: 'flex', justifyContent: i % 2 ? 'flex-start' : 'flex-end' }}>
                <WeightyEntry at={6 + i * 5} from={i % 2 ? 'right' : 'left'} distance={300}>
                  <div style={{ background: '#152238', border: `1px solid ${c}55`, borderRadius: 16, padding: '26px 42px', display: 'flex', alignItems: 'center', gap: 20, width: 540 }}>
                    <div style={{ fontSize: 52 }}>{ic}</div>
                    <div style={{ fontFamily: JAKARTA, fontWeight: 700, fontSize: 38, color: WHITE }}>{t}</div>
                  </div>
                </WeightyEntry>
              </div>
            ))}
          </div>
        </AbsoluteFill>
      </CamBreath>
    </AbsoluteFill>
  )
}

function FormatsBeat({ hold }: { hold: number }) {
  const frame = useCurrentFrame()
  const fmts: [string, string, string][] = [['📹', 'Video', TEAL_HI], ['📊', 'Slide Deck', GOLD], ['📄', 'PDF', '#60a5fa']]
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 40%, ${BG2}, ${BG})` }}>
      <CamBreath intensity={0.9}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 40 }}>
          <div style={{ fontFamily: JAKARTA, fontWeight: 700, fontSize: 48, color: CREAM, opacity: clamp((frame - 4) / 8, 0, 1) }}>One document. <span style={{ color: TEAL_HI }}>Three ways to share.</span></div>
          <div style={{ display: 'flex', gap: 30 }}>
            {fmts.map(([ic, t, c], i) => (
              <WeightyEntry key={i} at={10 + i * 7} from="bottom" distance={280}>
                <div style={{ background: '#152238', border: `2px solid ${c}`, borderRadius: 18, padding: '34px 50px', textAlign: 'center', width: 320 }}>
                  <div style={{ fontSize: 68 }}>{ic}</div>
                  <div style={{ fontFamily: JAKARTA, fontWeight: 700, fontSize: 42, color: c as string, marginTop: 10 }}>{t}</div>
                </div>
              </WeightyEntry>
            ))}
          </div>
        </AbsoluteFill>
      </CamBreath>
    </AbsoluteFill>
  )
}

function BrandBeat({ hold }: { hold: number }) {
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      {/* the success living still, dimmed, behind the brand */}
      <LivingStill src="d2v-cine/gen/success.png" dur={hold} atmos="dust" grade="warm" push={0.1} />
      <AbsoluteFill style={{ background: `${BG}c8` }} />
      <CamBreath intensity={0.8}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 20 }}>
          <WeightyEntry at={2} from="scale" shadow={false}><Logo w={560} /></WeightyEntry>
          <BrandTag hold={hold} />
        </AbsoluteFill>
      </CamBreath>
    </AbsoluteFill>
  )
}
function BrandTag({ hold }: { hold: number }) {
  const frame = useCurrentFrame()
  return <div style={{ fontFamily: JAKARTA, fontWeight: 700, fontSize: 40, color: CREAM, textAlign: 'center', opacity: clamp((frame - 16) / 10, 0, 1), maxWidth: 1200 }}>Turn any document into a <span style={{ color: TEAL_HI }}>professional explainer video.</span></div>
}

function CTACard({ hold }: { hold: number }) {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const btn = spring({ frame: frame - 6, fps, config: { damping: 12, stiffness: 180 } })
  const url = interpolate(frame, [30, 42], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const pulse = 1 + Math.sin(frame * 0.14) * 0.03
  return (
    <AbsoluteFill style={{ background: `radial-gradient(130% 120% at 50% 42%, ${BG2}, ${BG})` }}>
      <CamBreath intensity={0.8}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 26 }}>
          <WeightyEntry at={0} from="scale" shadow={false}><Logo w={420} /></WeightyEntry>
          <div style={{ marginTop: 6, opacity: clamp(btn, 0, 1), transform: `scale(${(0.7 + clamp(btn, 0, 1) * 0.3) * pulse})` }}>
            <div style={{ background: `linear-gradient(180deg, ${GOLD}, ${TERRA})`, color: '#1a1206', fontFamily: JAKARTA, fontWeight: 800, fontSize: 34, padding: '20px 56px', borderRadius: 12, boxShadow: `0 0 34px ${GOLD}55`, textAlign: 'center' }}>Start Free — 2,000 Credits</div>
          </div>
          <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 28, color: MUTE, opacity: url }}>docs2video.com · no commitment</div>
        </AbsoluteFill>
      </CamBreath>
    </AbsoluteFill>
  )
}

// ---- intro + timing (no beat-lock here — cinematic flows, not snap-cuts) ----
const INTRO = Math.round(3.0 * FPS)
const INTRO_STYLE = pickIntro('luxury')   // signature draw-on
const STARTS: number[] = []; { let t = INTRO; for (const b of BEATS) { STARTS.push(t); t += b.dur } }
export const docs2videoCineDuration = STARTS[STARTS.length - 1] + BEATS[BEATS.length - 1].dur + 8
const MUSIC_FRAMES = Math.round(60.0 * FPS)

export const CommercialDocs2VideoCinematic: React.FC = () => {
  const total = docs2videoCineDuration
  const voWin = BEATS.map((b, i) => b.vo ? { start: STARTS[i], end: STARTS[i] + b.dur } : null).filter(Boolean) as VoWindow[]
  const musicDuck = makeMusicDuck(voWin, total, { loud: 0.2, duck: 0.08, ramp: 18, fadeInEnd: 16, fadeOutStart: total - 30, fadeOutEnd: total - 8 })
  return (
    <AbsoluteFill style={{ background: BG }}>
      <Sequence from={0} durationInFrames={INTRO + 2}>
        <Intro style={INTRO_STYLE} dur={INTRO} tokens={{ bg: BG, bg2: BG2, accent: TEAL, accentHi: TEAL_HI }} render={<Logo w={540} />} />
      </Sequence>
      {BEATS.map((b, i) => (
        <Sequence key={i} from={STARTS[i]} durationInFrames={b.dur + 10}>
          {b.el}
          {/* soft cross-fade through black for a cinematic (not snappy) flow */}
          <SoftFade dur={b.dur} />
          {i < 8 && <LogoBug src="d2v-cine/logo.png" width={190} />}
        </Sequence>
      ))}
      <MusicBed src="d2v-cine/music.mp3" musicFrames={MUSIC_FRAMES} volume={musicDuck} />
      {BEATS.map((b, i) => b.vo ? (
        <Sequence key={'vo' + i} from={STARTS[i]}><Audio src={staticFile(`d2v-cine/${b.vo}.mp3`)} volume={1.0} /></Sequence>
      ) : null)}
    </AbsoluteFill>
  )
}

const SoftFade: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame()
  const inA = 10, outA = Math.max(inA + 2, dur - 8), outB = Math.max(outA + 1, dur + 2)
  const o = interpolate(frame, [0, inA, outA, outB], [1, 0, 0, 0.85], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return <AbsoluteFill style={{ background: BG, opacity: o, pointerEvents: 'none' }} />
}
