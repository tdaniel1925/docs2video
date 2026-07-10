import { AbsoluteFill, Audio, Img, Sequence, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing, type CalculateMetadataFunction } from 'remotion'
import { useMemo } from 'react'
import { useAudioData, visualizeAudio, getAudioDurationInSeconds } from '@remotion/media-utils'
import { fitText } from '@remotion/layout-utils'
import { loadFont as loadArchivo } from '@remotion/google-fonts/Archivo'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'

const { fontFamily: ARCHIVO } = loadArchivo()
const { fontFamily: INTER } = loadInter()

/**
 * AppCommercial — a killer product spot for Docs2Video (a product of Docs2Cash).
 * Kinetic type + real UI mockups sliding/tilting in on the beat + logo +
 * per-section VO. Brand blue (#2d6a9f) / orange (#f5a623). 7 sections.
 */

const FPS = 30
const INK = '#0a0f16'
const CREAM = '#f4f7fb'
const BLUE = '#4a9fe0'      // brightened brand blue for dark bg
const ORANGE = '#f5a623'
const MUTED = '#8b97a8'
const TOP_SAFE = 100

export type AppProps = { starts: number[]; total: number }
const GAP = Math.round(0.4 * FPS)
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export const appMetadata: CalculateMetadataFunction<AppProps> = async () => {
  const starts: number[] = []
  let t = Math.round(0.5 * FPS)
  for (let i = 1; i <= 7; i++) {
    starts.push(t)
    t += Math.round((await getAudioDurationInSeconds(staticFile(`app-vo-${i}.mp3`))) * FPS) + GAP
  }
  return { durationInFrames: t + Math.round(2.2 * FPS), props: { starts, total: t + Math.round(2.2 * FPS) } }
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

const Line: React.FC<{ text: string; at: number; size: number; color?: string; beats: number[]; maxW: number; label?: boolean; anim?: 'scale' | 'wipe' }> =
({ text, at, size, color = CREAM, beats, maxW, label, anim = 'scale' }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig(); const start = snap(at, beats)
  const family = label ? INTER : ARCHIVO; const weight = label ? 700 : 800
  const { fontSize: fit } = fitText({ text, withinWidth: maxW, fontFamily: family, fontWeight: weight })
  const fontSize = Math.min(size, fit * 0.94)
  const s = spring({ frame: frame - start, fps, config: { damping: 15, stiffness: 190, mass: 0.65 } })
  const base = { fontFamily: family, fontWeight: weight, fontSize, color, letterSpacing: label ? '0.3em' : '-0.02em', lineHeight: 1.1, whiteSpace: 'nowrap' as const, textTransform: label ? 'uppercase' as const : 'none' as const, textShadow: '0 2px 22px rgba(0,0,0,0.55)' }
  if (anim === 'wipe') return <div style={{ ...base, clipPath: `inset(0 ${(1 - s) * 100}% 0 0)`, opacity: s > 0.02 ? 1 : 0 }}>{text}</div>
  return <div style={{ ...base, opacity: s, transform: `translateY(${(1 - s) * 24}px)` }}>{text}</div>
}

// UI screenshot in a soft frame, slides/tilts in on the beat, glow-on-beat.
const UIShot: React.FC<{ src: string; at: number; beats: number[]; tilt?: number }> = ({ src, at, beats, tilt = -2 }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig(); const start = snap(at, beats)
  const s = spring({ frame: frame - start, fps, config: { damping: 15, stiffness: 120, mass: 0.9 } })
  const hit = bp(frame, beats); const float = Math.sin((frame - start) * 0.045) * 6
  return (
    <div style={{ transform: `translateY(${(1 - s) * 320 + float}px) rotate(${tilt * (1 - s * 0.4)}deg) scale(${0.82 + s * 0.18})`, opacity: s, width: '100%', borderRadius: 16, overflow: 'hidden', boxShadow: `0 40px 100px rgba(0,0,0,0.6), 0 0 ${18 + hit * 55}px ${BLUE}${Math.round(22 + hit * 40).toString(16).padStart(2, '0')}`, border: '1px solid #2a3648' }}>
      <Img src={staticFile(src)} style={{ width: '100%', display: 'block' }} />
    </div>
  )
}

export const AppCommercial: React.FC<AppProps> = ({ starts, total }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const { beats, spectrum } = useBeats(total); const pulse = bp(frame, beats)
  const S = starts; const idx = Math.max(0, S.filter((s) => frame >= s - 8).length - 1)
  const ends = [...S.slice(1), total - Math.round(2.0 * FPS)]; const endF = ends[idx] ?? total
  const fadeAt = (e: number) => interpolate(frame, [e - 12, e], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.quad) })
  const drift = frame * 0.2; const pushIn = 1 + (frame / total) * 0.04
  const accent = idx === 0 ? ORANGE : BLUE

  return (
    <AbsoluteFill style={{ background: INK }}>
      <Audio src={staticFile('app-music.mp3')} volume={(f) => interpolate(f, [0, 30, total - 60, total - 8], [0, 0.11, 0.11, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />
      {S.map((st, i) => <Sequence key={i} from={st}><Audio src={staticFile(`app-vo-${i + 1}.mp3`)} /></Sequence>)}

      {/* backdrop */}
      <AbsoluteFill style={{ transform: `scale(${pushIn * 1.08}) translate(${Math.sin(drift * 0.01) * 8}px, ${Math.cos(drift * 0.008) * 6}px)` }}>
        <Img src={staticFile('bg-hero.png')} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(2px) saturate(1.15) hue-rotate(-8deg) brightness(0.82)' }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(10,15,22,0.64), rgba(10,15,22,0.5) 50%, rgba(10,15,22,0.74))' }} />
      <AbsoluteFill style={{ background: `radial-gradient(950px 640px at 50% 116%, ${accent}22 0%, transparent 60%)` }} />
      <AbsoluteFill style={{ background: 'radial-gradient(120% 120% at 50% 45%, transparent 55%, rgba(0,0,0,0.5) 100%)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 90, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 11, opacity: 0.4 }}>
        {spectrum.map((v, i) => <div key={i} style={{ width: 12, height: 6 + clamp(v * 5, 0, 1) * 78, borderRadius: 3, background: i % 3 === 0 ? BLUE : i % 3 === 1 ? '#33445c' : ORANGE }} />)}
      </div>

      {/* ── sections ── */}
      {/* 0: hook (text only) */}
      {idx === 0 && (
        <AbsoluteFill style={{ opacity: fadeAt(endF), justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '0 120px' }}>
          <div>
            <Line text="YOU SEND DOCUMENTS." at={S[0] + 4} size={104} beats={beats} maxW={1650} />
            <div style={{ height: 26 }} />
            <Line text="NOBODY READS THEM." at={S[0] + 20} size={104} color={ORANGE} beats={beats} maxW={1650} />
          </div>
        </AbsoluteFill>
      )}
      {/* 1: upload UI */}
      {idx === 1 && (
        <AbsoluteFill style={{ opacity: fadeAt(endF), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 30, padding: `${TOP_SAFE + 10}px 130px 120px` }}>
          <Line text="ANY DOCUMENT IN." at={S[1] + 4} size={70} color={BLUE} beats={beats} maxW={1500} label />
          <div style={{ width: 1120 }}><UIShot src="ui-1.png" at={S[1] + 20} beats={beats} tilt={-2} /></div>
        </AbsoluteFill>
      )}
      {/* 2: script editor */}
      {idx === 2 && (
        <AbsoluteFill style={{ opacity: fadeAt(endF), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 30, padding: `${TOP_SAFE + 10}px 130px 120px` }}>
          <Line text="AI WRITES IT · YOU APPROVE IT." at={S[2] + 4} size={62} color={BLUE} beats={beats} maxW={1500} label />
          <div style={{ width: 1160 }}><UIShot src="ui-2.png" at={S[2] + 18} beats={beats} tilt={2} /></div>
        </AbsoluteFill>
      )}
      {/* 3: slides */}
      {idx === 3 && (
        <AbsoluteFill style={{ opacity: fadeAt(endF), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 30, padding: `${TOP_SAFE + 10}px 130px 120px` }}>
          <Line text="BRANDED SLIDES · ONE CLICK TO REDO." at={S[3] + 4} size={54} color={ORANGE} beats={beats} maxW={1600} label />
          <div style={{ width: 1180 }}><UIShot src="ui-3.png" at={S[3] + 18} beats={beats} tilt={-2} /></div>
        </AbsoluteFill>
      )}
      {/* 4: analytics */}
      {idx === 4 && (
        <AbsoluteFill style={{ opacity: fadeAt(endF), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 30, padding: `${TOP_SAFE + 10}px 130px 120px` }}>
          <Line text="SEND · TRACK · GET PAID." at={S[4] + 4} size={66} color={BLUE} beats={beats} maxW={1500} label />
          <div style={{ width: 1160 }}><UIShot src="ui-4.png" at={S[4] + 18} beats={beats} tilt={2} /></div>
        </AbsoluteFill>
      )}
      {/* 5: audiences */}
      {idx === 5 && (
        <AbsoluteFill style={{ opacity: fadeAt(endF), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 34, padding: `${TOP_SAFE + 10}px 130px 120px` }}>
          <Line text="BUILT FOR EVERY TEAM" at={S[5] + 4} size={72} beats={beats} maxW={1500} />
          <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', justifyContent: 'center' }}>
            {[['HR', S[5] + 16], ['TRAINING', S[5] + 24], ['DEVELOPMENT', S[5] + 32], ['INSURANCE AGENTS', S[5] + 42]].map(([t, at], i) => {
              const s = spring({ frame: frame - snap(at as number, beats), fps, config: { damping: 14, stiffness: 170 } })
              return <div key={i} style={{ opacity: s, transform: `scale(${0.7 + s * 0.3})`, fontFamily: ARCHIVO, fontWeight: 800, fontSize: 52, color: i === 3 ? ORANGE : BLUE, background: 'rgba(255,255,255,0.05)', border: `2px solid ${i === 3 ? ORANGE : BLUE}55`, borderRadius: 14, padding: '18px 34px' }}>{t}</div>
            })}
          </div>
        </AbsoluteFill>
      )}
      {/* 6: logo close */}
      {idx >= 6 && (() => {
        const s = spring({ frame: frame - S[6], fps, config: { damping: 18, stiffness: 90 } })
        const cta = spring({ frame: frame - (S[6] + 40), fps, config: { damping: 16, stiffness: 110 } })
        return (
          <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
            <div>
              <Img src={staticFile('d2v-logo.png')} style={{ width: 720, opacity: s, transform: `scale(${0.85 + s * 0.15 + pulse * 0.02})`, filter: 'drop-shadow(0 8px 40px rgba(74,159,224,0.35))' }} />
              <div style={{ fontFamily: INTER, fontWeight: 600, fontSize: 30, color: MUTED, marginTop: 30, opacity: cta }}>Your documents, finally worth watching.</div>
              <div style={{ fontFamily: INTER, fontWeight: 700, fontSize: 24, letterSpacing: '0.22em', color: ORANGE, marginTop: 40, opacity: cta }}>START FREE · DOCS2VIDEO.COM</div>
              <div style={{ fontFamily: INTER, fontWeight: 600, fontSize: 19, letterSpacing: '0.18em', color: '#5a6678', marginTop: 26, opacity: cta }}>A PRODUCT OF DOCS2CASH</div>
            </div>
          </AbsoluteFill>
        )
      })()}

      {/* beat bloom on cuts */}
      {(() => { const c = snap((S[idx] ?? 0) + 2, beats); const fl = clamp(1 - (frame - c) / 6, 0, 1) * (frame >= c ? 1 : 0); return <AbsoluteFill style={{ background: '#fff', opacity: fl * 0.1, pointerEvents: 'none' }} /> })()}

      {/* chrome: small logo top-left (hidden on the logo-close section) */}
      {idx < 6 && (
        <>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: TOP_SAFE, background: 'linear-gradient(180deg, rgba(10,15,22,0.55), transparent)', zIndex: 10, pointerEvents: 'none' }} />
          <Img src={staticFile('d2v-logo.png')} style={{ position: 'absolute', top: 34, left: 54, height: 46, zIndex: 11, filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.4))' }} />
        </>
      )}
    </AbsoluteFill>
  )
}
