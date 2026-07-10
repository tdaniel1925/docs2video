import { AbsoluteFill, Audio, Img, Sequence, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing, type CalculateMetadataFunction, delayRender, continueRender } from 'remotion'
import { useMemo, useState, useEffect } from 'react'
import { useAudioData, visualizeAudio, getAudioDurationInSeconds } from '@remotion/media-utils'
import { fitText } from '@remotion/layout-utils'
import { loadFont as loadArchivo } from '@remotion/google-fonts/Archivo'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import { CameraShot, Typewriter, WordPan, frameAnchor, type CamKey, type AnchorBox } from './motion/CameraKit'
import { EASE } from './motion/MotionKit'

const { fontFamily: ARCHIVO } = loadArchivo()
const { fontFamily: INTER } = loadInter()

/**
 * AppCommercialV4 — CONTENT-AWARE camera. Each feature's camera path is
 * COMPUTED from the real measured anchor boxes (ui-anchors.json), so the zoom
 * always lands on the actual element the VO names — never a guessed coordinate.
 * A director-style plan per scene picks which anchors to visit and HOW the
 * camera travels between them (push / pan / rack), for real variety with intent.
 */

const FPS = 30
const INK = '#0a0f16'
const CREAM = '#f4f7fb'
const BLUE = '#4a9fe0'
const ORANGE = '#f5a623'
const MUTED = '#8b97a8'

export type AppProps = { starts: number[]; total: number }
const GAP = Math.round(0.4 * FPS)
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

type AnchorMap = Record<string, Record<string, AnchorBox>>

// The DIRECTOR'S PLAN per feature: which anchors to visit (by name) + the frame
// each is reached + the coverage (how tight) + the move style. The camera path
// is then BUILT from the real anchor boxes — accurate by construction.
const PLAN: { ui: string; label: string; entrance: 'depth' | 'flip' | 'rise'; beats: { anchor: string; at: number; coverage: number }[] }[] = [
  { ui: 'ui-1', label: 'ANY DOCUMENT IN.', entrance: 'depth',
    beats: [{ anchor: 'dropzone', at: 0, coverage: 0.95 }, { anchor: 'filetypes', at: 70, coverage: 0.7 }, { anchor: 'upload_btn', at: 135, coverage: 0.42 }] },
  { ui: 'ui-2', label: 'AI WRITES · YOU DIRECT.', entrance: 'flip',
    beats: [{ anchor: 'script_scene', at: 0, coverage: 0.7 }, { anchor: 'preview', at: 62, coverage: 0.85 }, { anchor: 'approve_btn', at: 135, coverage: 0.4 }] },
  { ui: 'ui-3', label: 'BRANDED SLIDES · REDO ANY.', entrance: 'rise',
    beats: [{ anchor: 'slide1', at: 0, coverage: 1.05 }, { anchor: 'slide1', at: 55, coverage: 0.9 }, { anchor: 'redo_btn', at: 135, coverage: 0.3 }] },
  { ui: 'ui-4', label: 'SEND · TRACK · GET PAID.', entrance: 'depth',
    beats: [{ anchor: 'views', at: 0, coverage: 0.9 }, { anchor: 'revenue', at: 62, coverage: 0.42 }, { anchor: 'client_row', at: 135, coverage: 0.85 }] },
]

// build a real CamKey[] from the plan + the measured anchors for that ui
function buildPath(plan: typeof PLAN[number], anchors: Record<string, AnchorBox> | undefined): CamKey[] {
  if (!anchors) return [{ at: 0, x: 0.5, y: 0.5, scale: 1.1 }]
  return plan.beats.map((b) => {
    const box = anchors[b.anchor]
    if (!box) return { at: b.at, x: 0.5, y: 0.5, scale: 1.1 }
    const framed = frameAnchor(box, b.coverage)
    return { at: b.at, x: framed.x, y: framed.y, scale: framed.scale }
  })
}

export const appV4Metadata: CalculateMetadataFunction<AppProps> = async () => {
  const starts: number[] = []; let t = Math.round(0.5 * FPS)
  for (let i = 1; i <= 7; i++) { starts.push(t); t += Math.round((await getAudioDurationInSeconds(staticFile(`app-vo-${i}.mp3`))) * FPS) + GAP }
  return { durationInFrames: t + Math.round(2.2 * FPS), props: { starts, total: t + Math.round(2.2 * FPS) } }
}

function useAnchors(): AnchorMap | null {
  const [data, setData] = useState<AnchorMap | null>(null)
  const [handle] = useState(() => delayRender('anchors'))
  useEffect(() => {
    fetch(staticFile('ui-anchors.json')).then(r => r.json()).then((j) => { setData(j); continueRender(handle) }).catch(() => continueRender(handle))
  }, [handle])
  return data
}

function useBeats(totalFrames: number) {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const audioData = useAudioData(staticFile('app-music.mp3'))
  const beats = useMemo(() => {
    if (!audioData) return []
    const e: number[] = []
    for (let f = 0; f < totalFrames; f++) { const s = visualizeAudio({ fps, frame: f, audioData, numberOfSamples: 16 }); e.push(s[0] + s[1]) }
    const on: number[] = []
    for (let f = 2; f < e.length - 2; f++) { const lo = Math.max(0, f - 20), hi = Math.min(e.length, f + 20); const avg = e.slice(lo, hi).reduce((a, b) => a + b, 0) / (hi - lo); if (e[f] > avg * 1.3 && e[f] >= e[f - 1] && e[f] >= e[f + 1] && (on.length === 0 || f - on[on.length - 1] >= 8)) on.push(f) }
    if (on.length < 4) return on
    const votes = new Map<number, number>()
    for (let i = 1; i < on.length; i++) { const d = on[i] - on[i - 1]; for (let p = 12; p <= 30; p++) for (let m = 1; m <= 3; m++) if (Math.abs(d - p * m) <= 1) votes.set(p, (votes.get(p) || 0) + 1) }
    const period = [...votes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 15
    let ph = 0, best = -1; for (let p = 0; p < period; p++) { let sc = 0; for (let f = p; f < e.length; f += period) sc += e[f] || 0; if (sc > best) { best = sc; ph = p } }
    const g: number[] = []; for (let f = ph; f < totalFrames; f += period) g.push(f); return g
  }, [audioData, fps, totalFrames])
  if (!audioData) return { beats: [], spectrum: new Array(20).fill(0) }
  return { beats, spectrum: visualizeAudio({ fps, frame, audioData, numberOfSamples: 32 }).slice(0, 20) }
}
const snap = (f: number, b: number[]) => { for (const x of b) if (x >= f) return x; return f }
const bp = (frame: number, b: number[]) => { let l = -100; for (const x of b) { if (x <= frame) l = x; else break } return Math.exp(-(frame - l) / 5) }

const Label: React.FC<{ text: string; at: number; color: string; beats: number[] }> = ({ text, at, color, beats }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig(); const start = snap(at, beats)
  const s = spring({ frame: frame - start, fps, config: { damping: 15, stiffness: 190 } })
  const { fontSize: fit } = fitText({ text, withinWidth: 1500, fontFamily: INTER, fontWeight: 700 })
  return <div style={{ fontFamily: INTER, fontWeight: 700, fontSize: Math.min(56, fit * 0.94), color, letterSpacing: '0.28em', textTransform: 'uppercase', opacity: s, transform: `translateY(${(1 - s) * 20}px)`, whiteSpace: 'nowrap', textShadow: '0 3px 20px rgba(0,0,0,0.7)' }}>{text}</div>
}

export const AppCommercialV4: React.FC<AppProps> = ({ starts, total }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const anchors = useAnchors()
  const { beats, spectrum } = useBeats(total); const pulse = bp(frame, beats)
  const S = starts; const idx = Math.max(0, S.filter((s) => frame >= s - 8).length - 1)
  const ends = [...S.slice(1), total - Math.round(2.0 * FPS)]; const endF = ends[idx] ?? total
  const fadeAt = (e: number) => interpolate(frame, [e - 12, e], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.quad) })
  const drift = frame * 0.2; const accent = idx === 0 ? ORANGE : BLUE
  const plan = idx >= 1 && idx <= 4 ? PLAN[idx - 1] : null

  return (
    <AbsoluteFill style={{ background: INK }}>
      <Audio src={staticFile('app-music.mp3')} volume={(f) => interpolate(f, [0, 30, total - 60, total - 8], [0, 0.11, 0.11, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />
      {S.map((st, i) => <Sequence key={i} from={st}><Audio src={staticFile(`app-vo-${i + 1}.mp3`)} /></Sequence>)}

      <AbsoluteFill style={{ transform: `scale(${1.08 + (frame / total) * 0.04}) translate(${Math.sin(drift * 0.01) * 8}px, ${Math.cos(drift * 0.008) * 6}px)` }}>
        <Img src={staticFile('bg-hero.png')} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(2px) saturate(1.15) hue-rotate(-8deg) brightness(0.8)' }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(10,15,22,0.66), rgba(10,15,22,0.5) 50%, rgba(10,15,22,0.76))' }} />
      <AbsoluteFill style={{ background: `radial-gradient(950px 640px at 50% 116%, ${accent}22 0%, transparent 60%)` }} />
      <AbsoluteFill style={{ background: 'radial-gradient(120% 120% at 50% 45%, transparent 55%, rgba(0,0,0,0.5) 100%)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 90, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 11, opacity: 0.38 }}>
        {spectrum.map((v, i) => <div key={i} style={{ width: 12, height: 6 + clamp(v * 5, 0, 1) * 78, borderRadius: 3, background: i % 3 === 0 ? BLUE : i % 3 === 1 ? '#33445c' : ORANGE }} />)}
      </div>

      {/* HOOK — fast word pans */}
      {idx === 0 && (
        <AbsoluteFill style={{ opacity: fadeAt(endF), justifyContent: 'center', alignItems: 'flex-start', padding: '0 160px' }}>
          <div>
            <WordPan text="YOU SEND" at={snap(S[0] + 6, beats)} size={130} color={CREAM} family={ARCHIVO} dir={-1} />
            <WordPan text="DOCUMENTS." at={snap(S[0] + 16, beats)} size={130} color={CREAM} family={ARCHIVO} dir={1} />
            <div style={{ height: 20 }} />
            <WordPan text="NOBODY READS THEM." at={snap(S[0] + 34, beats)} size={108} color={ORANGE} family={ARCHIVO} dir={-1} />
          </div>
        </AbsoluteFill>
      )}

      {/* FEATURES — content-aware camera path built from real anchors */}
      {plan && (
        <AbsoluteFill style={{ opacity: fadeAt(endF) }}>
          <CameraShot src={`${plan.ui}.png`} enterAt={S[idx] + 14} keys={buildPath(plan, anchors?.[plan.ui])} entrance={plan.entrance} width={2100} />
          <div style={{ position: 'absolute', bottom: 132, width: '100%', display: 'flex', justifyContent: 'center' }}>
            <div style={{ background: 'rgba(10,15,22,0.62)', backdropFilter: 'blur(8px)', borderRadius: 14, padding: '16px 38px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <Label text={plan.label} at={S[idx] + 24} color={idx % 2 ? BLUE : ORANGE} beats={beats} />
            </div>
          </div>
        </AbsoluteFill>
      )}

      {/* AUDIENCES — typewriter */}
      {idx === 5 && (
        <AbsoluteFill style={{ opacity: fadeAt(endF), flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 30 }}>
          <div style={{ fontFamily: ARCHIVO, fontWeight: 800, fontSize: 76, color: CREAM, opacity: spring({ frame: frame - S[5], fps, config: { damping: 15, stiffness: 180 } }) }}>BUILT FOR</div>
          <div style={{ minHeight: 90 }}>
            <Typewriter text="HR · TRAINING · DEVELOPMENT · INSURANCE" at={S[5] + 18} cps={22} size={58} color={ORANGE} family={ARCHIVO} />
          </div>
        </AbsoluteFill>
      )}

      {/* LOGO close */}
      {idx >= 6 && (() => {
        const s = spring({ frame: frame - S[6], fps, config: { damping: 18, stiffness: 90 } })
        const cta = spring({ frame: frame - (S[6] + 40), fps, config: { damping: 16, stiffness: 110 } })
        const push = 1 + interpolate(frame, [S[6], total], [0, 0.08], { extrapolateLeft: 'clamp', easing: EASE.expoOut })
        return (
          <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
            <AbsoluteFill style={{ background: `radial-gradient(600px 600px at 50% 44%, ${BLUE}${Math.round(18 + pulse * 26).toString(16).padStart(2, '0')} 0%, transparent 60%)` }} />
            <div style={{ transform: `scale(${push})` }}>
              <Img src={staticFile('d2v-logo.png')} style={{ width: 720, opacity: s, transform: `scale(${0.85 + s * 0.15})`, filter: 'drop-shadow(0 8px 40px rgba(74,159,224,0.4))' }} />
              <div style={{ fontFamily: INTER, fontWeight: 600, fontSize: 30, color: MUTED, marginTop: 30, opacity: cta }}>Your documents, finally worth watching.</div>
              <div style={{ fontFamily: INTER, fontWeight: 700, fontSize: 24, letterSpacing: '0.22em', color: ORANGE, marginTop: 40, opacity: cta }}>START FREE · DOCS2VIDEO.COM</div>
              <div style={{ fontFamily: INTER, fontWeight: 600, fontSize: 19, letterSpacing: '0.18em', color: '#5a6678', marginTop: 26, opacity: cta }}>A PRODUCT OF DOCS2CASH</div>
            </div>
          </AbsoluteFill>
        )
      })()}

      {(() => { const c = snap((S[idx] ?? 0) + 2, beats); const fl = clamp(1 - (frame - c) / 6, 0, 1) * (frame >= c ? 1 : 0); return <AbsoluteFill style={{ background: '#fff', opacity: fl * 0.09, pointerEvents: 'none' }} /> })()}

      {idx < 6 && (
        <>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 100, background: 'linear-gradient(180deg, rgba(10,15,22,0.6), transparent)', zIndex: 10, pointerEvents: 'none' }} />
          <Img src={staticFile('d2v-logo.png')} style={{ position: 'absolute', top: 34, left: 54, height: 46, zIndex: 11, filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.4))' }} />
        </>
      )}
    </AbsoluteFill>
  )
}
