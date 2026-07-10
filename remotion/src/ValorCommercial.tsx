import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing, type CalculateMetadataFunction } from 'remotion'
import { useMemo } from 'react'
import { useAudioData, visualizeAudio, getAudioDurationInSeconds } from '@remotion/media-utils'
import { fitText } from '@remotion/layout-utils'
import { loadFont as loadMont } from '@remotion/google-fonts/Montserrat'
import { loadFont as loadSans } from '@remotion/google-fonts/SourceSans3'
import { EASE } from './motion/MotionKit'

const { fontFamily: MONT } = loadMont()   // Valor's display font
const { fontFamily: SANS } = loadSans()   // Valor's body font (Source Sans family)

/**
 * ValorCommercial — built from valorfs.com's OWN assets (scraped): logo, real
 * hero photos, background video, and their exact navy/gold palette. The photos
 * get living, content-aware camera moves (Ken Burns push + slow pan, always
 * moving, crisp). True to Valor's positioning: an IMO/FMO for insurance agents.
 */

const FPS = 30
const NAVY = '#0a1b2e'        // rgb(7,41,68)-ish, deepened
const NAVY2 = '#16304f'
const GOLD = '#cda234'        // rgb(205,162,52) — Valor gold
const CREAM = '#f3efe6'
const MUTED = '#9aa7b8'

export type ValorProps = { starts: number[]; total: number }
const GAP = Math.round(0.4 * FPS)
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const B = 'brand/valor/'

// Each content section: a real Valor image + a Ken-Burns camera path (start/end
// focus & zoom over the shot) + the caption. Photos NEVER sit still.
const SCENES: { img: string; from: [number, number, number]; to: [number, number, number]; label: string; sub?: string }[] = [
  // [x,y,scale] focus in 0..1 of the image
  { img: 'img-1.jpeg', from: [0.6, 0.4, 1.15], to: [0.35, 0.55, 1.35], label: 'GO IT ALONE?', sub: 'Building an insurance business is hard.' },
  { img: 'img-4.png', from: [0.5, 0.35, 1.1], to: [0.5, 0.5, 1.3], label: 'PARTNER WITH VALOR', sub: 'We help independent agents grow.' },
  { img: 'img-3.jpeg', from: [0.5, 0.3, 1.2], to: [0.5, 0.6, 1.45], label: 'TOP-RATED CARRIERS', sub: 'Life & annuity solutions, full portfolio.' },
]

export const valorMetadata: CalculateMetadataFunction<ValorProps> = async () => {
  const starts: number[] = []; let t = Math.round(0.5 * FPS)
  for (let i = 1; i <= 6; i++) { starts.push(t); t += Math.round((await getAudioDurationInSeconds(staticFile(`valor-vo-${i}.mp3`))) * FPS) + GAP }
  return { durationInFrames: t + Math.round(2.4 * FPS), props: { starts, total: t + Math.round(2.4 * FPS) } }
}

function useBeats(totalFrames: number) {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const audioData = useAudioData(staticFile('valor-music.mp3'))
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

// Ken-Burns photo: fills frame, camera eases from `from`→`to` then keeps a slow
// continuing drift (never freezes). Crisp — no motion blur on the slow move.
const KBPhoto: React.FC<{ img: string; from: [number, number, number]; to: [number, number, number]; localFrame: number; dur: number }> =
({ img, from, to, localFrame, dur }) => {
  const p = EASE.expoOut(clamp(localFrame / dur, 0, 1))
  const drift = Math.max(0, localFrame - dur)
  const fx = from[0] + (to[0] - from[0]) * p + Math.sin(drift * 0.02) * 0.006
  const fy = from[1] + (to[1] - from[1]) * p + Math.cos(drift * 0.016) * 0.005
  const sc = from[2] + (to[2] - from[2]) * p + drift * 0.0004
  // image sized to cover frame at scale=1 → translate to center focus point
  const W = 1920 * sc, H = 1080 * sc
  const tx = 1920 / 2 - fx * W, ty = 1080 / 2 - fy * H
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Img src={staticFile(B + img)} style={{ position: 'absolute', width: W, height: H, objectFit: 'cover', transform: `translate(${tx}px,${ty}px)`, transformOrigin: '0 0' }} />
      {/* navy grade + vignette for cohesion with brand */}
      <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(10,27,46,0.35), rgba(10,27,46,0.2) 45%, rgba(10,27,46,0.82))` }} />
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

export const ValorCommercial: React.FC<ValorProps> = ({ starts, total }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const { beats, spectrum } = useBeats(total); const pulse = bp(frame, beats)
  const S = starts; const idx = Math.max(0, S.filter((s) => frame >= s - 8).length - 1)
  const ends = [...S.slice(1), total - Math.round(2.2 * FPS)]; const endF = ends[idx] ?? total
  const fadeAt = (e: number) => interpolate(frame, [e - 12, e], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.quad) })
  // sections: 0=hook(bg video), 1..3 = photo scenes, 4 = value text, 5 = logo close
  const photo = idx >= 1 && idx <= 3 ? SCENES[idx - 1] : null
  const localF = frame - (S[idx] ?? 0)

  return (
    <AbsoluteFill style={{ background: NAVY }}>
      <Audio src={staticFile('valor-music.mp3')} volume={(f) => interpolate(f, [0, 30, total - 60, total - 8], [0, 0.1, 0.1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />
      {S.map((st, i) => <Sequence key={i} from={st}><Audio src={staticFile(`valor-vo-${i + 1}.mp3`)} /></Sequence>)}

      {/* 0: HOOK — Valor's own background VIDEO, darkened, with the opening line */}
      {idx === 0 && (
        <AbsoluteFill style={{ opacity: fadeAt(endF) }}>
          <AbsoluteFill style={{ transform: `scale(${1.05 + localF * 0.0006})` }}>
            <OffthreadVideo src={staticFile(B + 'vid-1.mp4')} muted loop style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.5) saturate(1.05)' }} />
          </AbsoluteFill>
          <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(10,27,46,0.5), rgba(10,27,46,0.4) 45%, rgba(10,27,46,0.85))' }} />
          <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '0 140px' }}>
            <div>
              <TitleLine text="GROWTH" at={S[0] + 6} size={150} color={CREAM} beats={beats} maxW={1600} />
              <TitleLine text="TAKES VALOR." at={S[0] + 20} size={150} color={GOLD} beats={beats} maxW={1600} />
            </div>
          </AbsoluteFill>
        </AbsoluteFill>
      )}

      {/* 1..3: PHOTO scenes with living Ken-Burns camera on Valor's real images */}
      {photo && (
        <AbsoluteFill style={{ opacity: fadeAt(endF) }}>
          <KBPhoto img={photo.img} from={photo.from} to={photo.to} localFrame={localF} dur={endF - (S[idx] ?? 0) - 14} />
          <div style={{ position: 'absolute', bottom: 150, left: 120, right: 120 }}>
            <TitleLine text={photo.label} at={S[idx] + 14} size={92} color={GOLD} beats={beats} maxW={1600} anim="wipe" />
            {photo.sub && <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 40, color: CREAM, marginTop: 14, opacity: spring({ frame: frame - snap(S[idx] + 30, beats), fps, config: { damping: 16, stiffness: 130 } }), textShadow: '0 2px 18px rgba(0,0,0,0.7)' }}>{photo.sub}</div>}
          </div>
        </AbsoluteFill>
      )}

      {/* 4: VALUE — text over navy with the brand dot pattern feel */}
      {idx === 4 && (
        <AbsoluteFill style={{ opacity: fadeAt(endF), background: `radial-gradient(1200px 800px at 70% 20%, ${NAVY2}, ${NAVY})`, justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 26, textAlign: 'center', padding: '0 140px' }}>
          <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 34, letterSpacing: '0.32em', color: GOLD, opacity: spring({ frame: frame - S[4], fps, config: { damping: 15, stiffness: 170 } }) }}>MARKETING FOR INSURANCE ENTREPRENEURS</div>
          <TitleLine text="TRAINING · TOOLS · TEAM" at={S[4] + 14} size={100} color={CREAM} beats={beats} maxW={1600} />
          <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 38, color: MUTED, opacity: spring({ frame: frame - snap(S[4] + 34, beats), fps, config: { damping: 16, stiffness: 120 } }) }}>Built for entrepreneurs, not corporations.</div>
        </AbsoluteFill>
      )}

      {/* 5: LOGO close — the real Valor logo (recolored to gold via drop-shadow trick kept white-on-navy) */}
      {idx >= 5 && (() => {
        const s = spring({ frame: frame - S[5], fps, config: { damping: 18, stiffness: 90 } })
        const cta = spring({ frame: frame - (S[5] + 36), fps, config: { damping: 16, stiffness: 110 } })
        const push = 1 + interpolate(frame, [S[5], total], [0, 0.07], { extrapolateLeft: 'clamp', easing: EASE.expoOut })
        return (
          <AbsoluteFill style={{ background: `radial-gradient(1000px 700px at 50% 45%, ${NAVY2}, ${NAVY})`, justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
            <AbsoluteFill style={{ background: `radial-gradient(600px 600px at 50% 44%, ${GOLD}${Math.round(14 + pulse * 22).toString(16).padStart(2, '0')} 0%, transparent 60%)` }} />
            <div style={{ transform: `scale(${push})` }}>
              {/* logo is black-on-transparent → invert to white on navy */}
              <Img src={staticFile(B + 'logo.png')} style={{ width: 620, opacity: s, transform: `scale(${0.85 + s * 0.15})`, filter: 'invert(1) brightness(1.1) drop-shadow(0 8px 30px rgba(0,0,0,0.5))' }} />
              <div style={{ fontFamily: MONT, fontWeight: 800, fontSize: 42, letterSpacing: '0.14em', color: GOLD, marginTop: 34, opacity: cta }}>GROW WITH VALOR</div>
              <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 26, letterSpacing: '0.2em', color: CREAM, marginTop: 22, opacity: cta }}>VALORFS.COM</div>
            </div>
          </AbsoluteFill>
        )
      })()}

      {/* EQ bars in brand gold/navy */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 11, opacity: 0.34 }}>
        {spectrum.map((v, i) => <div key={i} style={{ width: 12, height: 5 + clamp(v * 5, 0, 1) * 66, borderRadius: 3, background: i % 3 === 0 ? GOLD : i % 3 === 1 ? '#2a4568' : '#3a5372' }} />)}
      </div>

      {/* beat bloom on cuts */}
      {(() => { const c = snap((S[idx] ?? 0) + 2, beats); const fl = clamp(1 - (frame - c) / 6, 0, 1) * (frame >= c ? 1 : 0); return <AbsoluteFill style={{ background: '#fff', opacity: fl * 0.08, pointerEvents: 'none' }} /> })()}

      {/* chrome: small Valor logo top-left (white) */}
      {idx >= 1 && idx < 5 && (
        <>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 96, background: 'linear-gradient(180deg, rgba(10,27,46,0.6), transparent)', zIndex: 10 }} />
          <Img src={staticFile(B + 'logo.png')} style={{ position: 'absolute', top: 30, left: 54, height: 52, zIndex: 11, filter: 'invert(1) brightness(1.1) drop-shadow(0 2px 6px rgba(0,0,0,0.5))' }} />
        </>
      )}
    </AbsoluteFill>
  )
}
