import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing, type CalculateMetadataFunction } from 'remotion'
import { useMemo } from 'react'
import { useAudioData, visualizeAudio, getAudioDurationInSeconds } from '@remotion/media-utils'
import { fitText } from '@remotion/layout-utils'
import { loadFont as loadMont } from '@remotion/google-fonts/Montserrat'
import { loadFont as loadPoppins } from '@remotion/google-fonts/Poppins'
import { EASE } from './motion/MotionKit'

const { fontFamily: MONT } = loadMont()      // Apex display
const { fontFamily: POPPINS } = loadPoppins() // Apex body

/**
 * ApexCommercial — built from reachtheapex.net's OWN assets (scraped): logo,
 * real lifestyle photos, background video, and their red/navy palette. True to
 * Apex's positioning: "Two paths, one opportunity" — sell insurance with A-rated
 * carriers AND earn from AI tools, build a team, real training. Living Ken-Burns
 * camera on their real photos (always moving, crisp).
 */

const FPS = 30
const NAVY = '#0c1a33'        // rgb(30,58,114) deepened
const NAVY2 = '#16305c'
const RED = '#e0313f'         // rgb(204,32,39) brightened for dark bg
const CREAM = '#f4f6fb'
const MUTED = '#93a1bb'

export type ApexProps = { starts: number[]; total: number }
const GAP = Math.round(0.4 * FPS)
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const B = 'brand/apex/'

// Photo scenes: real Apex image + Ken-Burns path + caption. Photos never freeze.
const SCENES: { img: string; from: [number, number, number]; to: [number, number, number]; label: string; sub?: string; color: string }[] = [
  { img: 'img-2.jpg', from: [0.5, 0.4, 1.12], to: [0.4, 0.55, 1.32], label: 'TOP-RATED CARRIERS', sub: 'Write for A-rated life & annuity carriers.', color: RED },
  { img: 'img-4.jpg', from: [0.45, 0.35, 1.1], to: [0.55, 0.5, 1.35], label: 'PROTECT FAMILIES', sub: 'Real training, mentorship, and support.', color: CREAM },
  { img: 'img-6.jpg', from: [0.5, 0.3, 1.15], to: [0.35, 0.6, 1.4], label: 'UNCAPPED INCOME', sub: 'Earn from your sales — and your team.', color: RED },
]

export const apexMetadata: CalculateMetadataFunction<ApexProps> = async () => {
  const starts: number[] = []; let t = Math.round(0.5 * FPS)
  for (let i = 1; i <= 6; i++) { starts.push(t); t += Math.round((await getAudioDurationInSeconds(staticFile(`apex-vo-${i}.mp3`))) * FPS) + GAP }
  return { durationInFrames: t + Math.round(2.4 * FPS), props: { starts, total: t + Math.round(2.4 * FPS) } }
}

function useBeats(totalFrames: number) {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const audioData = useAudioData(staticFile('apex-music.mp3'))
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

const KBPhoto: React.FC<{ img: string; from: [number, number, number]; to: [number, number, number]; localFrame: number; dur: number }> =
({ img, from, to, localFrame, dur }) => {
  const p = EASE.expoOut(clamp(localFrame / dur, 0, 1))
  const drift = Math.max(0, localFrame - dur)
  const fx = from[0] + (to[0] - from[0]) * p + Math.sin(drift * 0.02) * 0.006
  const fy = from[1] + (to[1] - from[1]) * p + Math.cos(drift * 0.016) * 0.005
  const sc = from[2] + (to[2] - from[2]) * p + drift * 0.0004
  const W = 1920 * sc, H = 1080 * sc
  const tx = 1920 / 2 - fx * W, ty = 1080 / 2 - fy * H
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Img src={staticFile(B + img)} style={{ position: 'absolute', width: W, height: H, objectFit: 'cover', transform: `translate(${tx}px,${ty}px)`, transformOrigin: '0 0' }} />
      <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(12,26,51,0.32), rgba(12,26,51,0.18) 45%, rgba(12,26,51,0.85))` }} />
      <AbsoluteFill style={{ background: 'radial-gradient(130% 130% at 50% 42%, transparent 52%, rgba(0,0,0,0.55) 100%)' }} />
    </AbsoluteFill>
  )
}

const TitleLine: React.FC<{ text: string; at: number; size: number; color: string; beats: number[]; maxW: number; anim?: 'rise' | 'wipe' }> =
({ text, at, size, color, beats, maxW, anim = 'rise' }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig(); const start = snap(at, beats)
  const { fontSize: fit } = fitText({ text, withinWidth: maxW, fontFamily: MONT, fontWeight: 800 })
  const fontSize = Math.min(size, fit * 0.94)
  const s = spring({ frame: frame - start, fps, config: { damping: 16, stiffness: 150 } })
  const base = { fontFamily: MONT, fontWeight: 800, fontSize, color, letterSpacing: '0.02em', lineHeight: 1.05, whiteSpace: 'nowrap' as const, textShadow: '0 3px 26px rgba(0,0,0,0.6)' }
  if (anim === 'wipe') return <div style={{ ...base, clipPath: `inset(0 ${(1 - s) * 100}% 0 0)`, opacity: s > 0.02 ? 1 : 0 }}>{text}</div>
  return <div style={{ ...base, opacity: s, transform: `translateY(${(1 - s) * 26}px)` }}>{text}</div>
}

export const ApexCommercial: React.FC<ApexProps> = ({ starts, total }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const { beats, spectrum } = useBeats(total); const pulse = bp(frame, beats)
  const S = starts; const idx = Math.max(0, S.filter((s) => frame >= s - 8).length - 1)
  const ends = [...S.slice(1), total - Math.round(2.2 * FPS)]; const endF = ends[idx] ?? total
  const fadeAt = (e: number) => interpolate(frame, [e - 12, e], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.quad) })
  // 0=hook(video), 1=two-paths text, 2..4=photos, 5=logo close
  const photo = idx >= 2 && idx <= 4 ? SCENES[idx - 2] : null
  const localF = frame - (S[idx] ?? 0)

  return (
    <AbsoluteFill style={{ background: NAVY }}>
      <Audio src={staticFile('apex-music.mp3')} volume={(f) => interpolate(f, [0, 30, total - 60, total - 8], [0, 0.1, 0.1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />
      {S.map((st, i) => <Sequence key={i} from={st}><Audio src={staticFile(`apex-vo-${i + 1}.mp3`)} /></Sequence>)}

      {/* 0: HOOK — Apex's own background video, darkened, with the opening line */}
      {idx === 0 && (
        <AbsoluteFill style={{ opacity: fadeAt(endF) }}>
          <AbsoluteFill style={{ transform: `scale(${1.05 + localF * 0.0006})` }}>
            <OffthreadVideo src={staticFile(B + 'vid-2.mp4')} muted loop style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.48) saturate(1.05)' }} />
          </AbsoluteFill>
          <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(12,26,51,0.5), rgba(12,26,51,0.4) 45%, rgba(12,26,51,0.85))' }} />
          <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '0 140px' }}>
            <div>
              <TitleLine text="A CAREER WITH" at={S[0] + 6} size={116} color={CREAM} beats={beats} maxW={1600} />
              <TitleLine text="NO CEILING." at={S[0] + 20} size={150} color={RED} beats={beats} maxW={1600} />
            </div>
          </AbsoluteFill>
        </AbsoluteFill>
      )}

      {/* 1: TWO PATHS — the signature message, split screen feel */}
      {idx === 1 && (
        <AbsoluteFill style={{ opacity: fadeAt(endF), background: `radial-gradient(1200px 800px at 50% 30%, ${NAVY2}, ${NAVY})`, justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 28, textAlign: 'center', padding: '0 120px' }}>
          <TitleLine text="TWO PATHS." at={S[1] + 6} size={130} color={CREAM} beats={beats} maxW={1600} />
          <TitleLine text="ONE OPPORTUNITY." at={S[1] + 20} size={130} color={RED} beats={beats} maxW={1600} />
          <div style={{ fontFamily: POPPINS, fontWeight: 600, fontSize: 40, color: MUTED, marginTop: 10, opacity: spring({ frame: frame - snap(S[1] + 40, beats), fps, config: { damping: 16, stiffness: 120 } }) }}>Room for everyone.</div>
        </AbsoluteFill>
      )}

      {/* 2..4: PHOTO scenes with living Ken-Burns camera on Apex's real images */}
      {photo && (
        <AbsoluteFill style={{ opacity: fadeAt(endF) }}>
          <KBPhoto img={photo.img} from={photo.from} to={photo.to} localFrame={localF} dur={endF - (S[idx] ?? 0) - 14} />
          <div style={{ position: 'absolute', bottom: 150, left: 120, right: 120 }}>
            <TitleLine text={photo.label} at={S[idx] + 14} size={92} color={photo.color} beats={beats} maxW={1600} anim="wipe" />
            {photo.sub && <div style={{ fontFamily: POPPINS, fontWeight: 600, fontSize: 40, color: CREAM, marginTop: 14, opacity: spring({ frame: frame - snap(S[idx] + 30, beats), fps, config: { damping: 16, stiffness: 130 } }), textShadow: '0 2px 18px rgba(0,0,0,0.7)' }}>{photo.sub}</div>}
          </div>
        </AbsoluteFill>
      )}

      {/* 5: LOGO close */}
      {idx >= 5 && (() => {
        const s = spring({ frame: frame - S[5], fps, config: { damping: 18, stiffness: 90 } })
        const cta = spring({ frame: frame - (S[5] + 36), fps, config: { damping: 16, stiffness: 110 } })
        const push = 1 + interpolate(frame, [S[5], total], [0, 0.07], { extrapolateLeft: 'clamp', easing: EASE.expoOut })
        return (
          <AbsoluteFill style={{ background: `radial-gradient(1000px 700px at 50% 45%, ${NAVY2}, ${NAVY})`, justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
            <AbsoluteFill style={{ background: `radial-gradient(600px 600px at 50% 44%, ${RED}${Math.round(14 + pulse * 22).toString(16).padStart(2, '0')} 0%, transparent 60%)` }} />
            <div style={{ transform: `scale(${push})` }}>
              {/* Apex logo is white-on-transparent → shows directly on navy */}
              <Img src={staticFile(B + 'logo.png')} style={{ width: 560, opacity: s, transform: `scale(${0.85 + s * 0.15})`, filter: 'drop-shadow(0 8px 30px rgba(0,0,0,0.5))' }} />
              <div style={{ fontFamily: MONT, fontWeight: 800, fontSize: 40, letterSpacing: '0.12em', color: RED, marginTop: 30, opacity: cta }}>EVERYONE WINS AT APEX</div>
              <div style={{ fontFamily: POPPINS, fontWeight: 700, fontSize: 26, letterSpacing: '0.2em', color: CREAM, marginTop: 22, opacity: cta }}>REACHTHEAPEX.NET</div>
            </div>
          </AbsoluteFill>
        )
      })()}

      {/* EQ bars in brand red/navy */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 11, opacity: 0.32 }}>
        {spectrum.map((v, i) => <div key={i} style={{ width: 12, height: 5 + clamp(v * 5, 0, 1) * 66, borderRadius: 3, background: i % 3 === 0 ? RED : i % 3 === 1 ? '#24406e' : '#3a5a8c' }} />)}
      </div>

      {(() => { const c = snap((S[idx] ?? 0) + 2, beats); const fl = clamp(1 - (frame - c) / 6, 0, 1) * (frame >= c ? 1 : 0); return <AbsoluteFill style={{ background: '#fff', opacity: fl * 0.08, pointerEvents: 'none' }} /> })()}

      {/* chrome: Apex logo top-left (white, shows on the dark scenes) */}
      {idx >= 2 && idx < 5 && (
        <>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 96, background: 'linear-gradient(180deg, rgba(12,26,51,0.6), transparent)', zIndex: 10 }} />
          <Img src={staticFile(B + 'logo.png')} style={{ position: 'absolute', top: 30, left: 54, height: 44, zIndex: 11, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.6))' }} />
        </>
      )}
    </AbsoluteFill>
  )
}
