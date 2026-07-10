import { AbsoluteFill, Audio, Img, Sequence, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing, type CalculateMetadataFunction } from 'remotion'
import { useMemo } from 'react'
import { useAudioData, visualizeAudio, getAudioDurationInSeconds } from '@remotion/media-utils'
import { fitText } from '@remotion/layout-utils'
import { loadFont as loadArchivo } from '@remotion/google-fonts/Archivo'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import { loadFont as loadFraunces } from '@remotion/google-fonts/Fraunces'

const { fontFamily: ARCHIVO } = loadArchivo()
const { fontFamily: INTER } = loadInter()
const { fontFamily: FRAUNCES } = loadFraunces()

/**
 * KineticDoc — DATA-DRIVEN kinetic-typography video. Reads real scene data
 * (headline / stats / narration / beat) from bq-scenes.json, one per-scene
 * voiceover clip, and a music track. Lays each scene out with the beat-locked,
 * safe-band, fit-to-width engine — the numbers come from the document, so a
 * financial video's figures are exact (rendered from data, never baked).
 *
 * Brand-driven: BioQuest red/black. Chrome = brand name top-left only.
 */

const FPS = 30
const INK = '#0b0d10'
const CREAM = '#f4f1ec'
const RED = '#e0203a'       // BioQuest red
const GOLD = '#e6b34a'
const MUTED = '#8b93a1'
const TOP_SAFE = 100

type SceneDatum = { i: number; title: string; beat: string; headline: string; stats: { label: string; value: string }[]; bullets: string[]; narration: string }
export type KineticDocProps = { starts: number[]; total: number; scenes: SceneDatum[] }

const GAP = Math.round(0.4 * FPS)
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export const kineticDocMetadata: CalculateMetadataFunction<KineticDocProps> = async () => {
  const res = await fetch(staticFile('bq-scenes.json'))
  const scenes: SceneDatum[] = await res.json()
  const starts: number[] = []
  let t = Math.round(0.5 * FPS)
  for (let i = 0; i < scenes.length; i++) {
    starts.push(t)
    const d = await getAudioDurationInSeconds(staticFile(`bq-vo-${i + 1}.mp3`))
    t += Math.round(d * FPS) + GAP
  }
  const total = t + Math.round(1.6 * FPS)
  return { durationInFrames: total, props: { starts, total, scenes } }
}

// ── beat grid (regular, phase-locked) — same approach as the commercial ──
function useBeats(totalFrames: number) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const audioData = useAudioData(staticFile('bq-music.mp3'))
  const beats = useMemo(() => {
    if (!audioData) return []
    const e: number[] = []
    for (let f = 0; f < totalFrames; f++) { const s = visualizeAudio({ fps, frame: f, audioData, numberOfSamples: 16 }); e.push(s[0] + s[1]) }
    const onsets: number[] = []
    for (let f = 2; f < e.length - 2; f++) {
      const lo = Math.max(0, f - 20), hi = Math.min(e.length, f + 20)
      const avg = e.slice(lo, hi).reduce((a, b) => a + b, 0) / (hi - lo)
      if (e[f] > avg * 1.3 && e[f] >= e[f - 1] && e[f] >= e[f + 1] && (onsets.length === 0 || f - onsets[onsets.length - 1] >= 8)) onsets.push(f)
    }
    if (onsets.length < 4) return onsets
    const votes = new Map<number, number>()
    for (let i = 1; i < onsets.length; i++) { const d = onsets[i] - onsets[i - 1]; for (let p = 12; p <= 30; p++) for (let m = 1; m <= 3; m++) if (Math.abs(d - p * m) <= 1) votes.set(p, (votes.get(p) || 0) + 1) }
    const period = [...votes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 15
    let ph = 0, best = -1
    for (let p = 0; p < period; p++) { let sc = 0; for (let f = p; f < e.length; f += period) sc += e[f] || 0; if (sc > best) { best = sc; ph = p } }
    const grid: number[] = []
    for (let f = ph; f < totalFrames; f += period) grid.push(f)
    return grid
  }, [audioData, fps, totalFrames])
  if (!audioData) return { beats: [], spectrum: new Array(20).fill(0) }
  const spec = visualizeAudio({ fps, frame, audioData, numberOfSamples: 32 })
  return { beats, spectrum: spec.slice(0, 20) }
}
const snap = (f: number, beats: number[]) => { for (const b of beats) if (b >= f) return b; return f }
const beatPulse = (frame: number, beats: number[]) => { let last = -100; for (const b of beats) { if (b <= frame) last = b; else break }; return Math.exp(-(frame - last) / 5) }

// ── measured, beat-locked text line ──
const Line: React.FC<{ text: string; at: number; size: number; color?: string; beats: number[]; maxW: number; font?: 'display' | 'serif' | 'label'; anim?: 'scale' | 'wipe' }> =
({ text, at, size, color = CREAM, beats, maxW, font = 'display', anim = 'scale' }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const start = snap(at, beats)
  const family = font === 'serif' ? FRAUNCES : font === 'label' ? INTER : ARCHIVO
  const weight = font === 'display' ? 800 : font === 'serif' ? 600 : 700
  const { fontSize: fit } = fitText({ text, withinWidth: maxW, fontFamily: family, fontWeight: weight })
  const fontSize = Math.min(size, fit * 0.94)
  const s = spring({ frame: frame - start, fps, config: { damping: 15, stiffness: 190, mass: 0.65 } })
  const base = {
    fontFamily: family, fontWeight: weight, fontSize, color,
    fontStyle: font === 'serif' ? 'italic' as const : 'normal' as const,
    letterSpacing: font === 'label' ? '0.32em' : '-0.02em',
    lineHeight: 1.1, whiteSpace: 'nowrap' as const,
    textTransform: font === 'label' ? 'uppercase' as const : 'none' as const,
    textShadow: '0 2px 20px rgba(0,0,0,0.5)',
  }
  if (anim === 'wipe') return <div style={{ ...base, clipPath: `inset(0 ${(1 - s) * 100}% 0 0)`, opacity: s > 0.02 ? 1 : 0 }}>{text}</div>
  return <div style={{ ...base, opacity: s, transform: `translateY(${(1 - s) * 26}px)` }}>{text}</div>
}

// ── big number that counts up (for the money/share stats) ──
const StatBlock: React.FC<{ label: string; value: string; at: number; beats: number[]; accent: string }> = ({ label, value, at, beats, accent }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const start = snap(at, beats)
  // count-up if the value has a number; else just reveal
  const m = value.match(/^([^\d]*)([\d,]+(?:\.\d+)?)(.*)$/)
  const p = spring({ frame: frame - start, fps, config: { damping: 26, stiffness: 44, mass: 1.3 } })
  let display = value
  if (m) { const num = parseFloat(m[2].replace(/,/g, '')); if (Number.isFinite(num)) { const cur = Math.round(num * p); display = `${m[1]}${cur.toLocaleString()}${m[3]}` } }
  const lab = spring({ frame: frame - start - 8, fps, config: { damping: 14, stiffness: 120 } })
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: INTER, fontWeight: 700, fontSize: 30, letterSpacing: '0.3em', textTransform: 'uppercase', color: accent, opacity: lab, marginBottom: 14 }}>{label}</div>
      <div style={{ fontFamily: ARCHIVO, fontWeight: 800, fontSize: 210, color: CREAM, lineHeight: 1, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', textShadow: `0 0 50px ${accent}33` }}>{display}</div>
    </div>
  )
}

export const KineticDoc: React.FC<KineticDocProps> = ({ starts, total, scenes }) => {
  const frame = useCurrentFrame()
  const { beats, spectrum } = useBeats(total)
  const pulse = beatPulse(frame, beats)
  const S = starts
  // idx clamped to >=0 so the first scene shows during the pre-roll (frames
  // before S[0]) instead of yielding idx=-1 → undefined end → NaN frame.
  const idx = Math.max(0, S.filter((s) => frame >= s - 8).length - 1)
  const scene = scenes[clamp(idx, 0, Math.max(0, scenes.length - 1))]
  const ends = [...S.slice(1), total - Math.round(1.2 * FPS)]
  const endF = ends[idx] ?? total
  const fadeAt = (e: number) => interpolate(frame, [e - 12, e], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.quad) })
  const drift = frame * 0.2
  const pushIn = 1 + (frame / total) * 0.04

  // accent rotates by beat: problem/close = gold, data beats = red
  const accent = scene?.beat === 'action' || scene?.beat === 'hook' ? GOLD : RED
  const st = scene?.stats?.[0]
  const isLast = idx >= scenes.length - 1

  return (
    <AbsoluteFill style={{ background: INK }}>
      <Audio src={staticFile('bq-music.mp3')} volume={(f) => interpolate(f, [0, 30, total - 60, total - 8], [0, 0.12, 0.12, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />
      {S.map((stt, i) => <Sequence key={i} from={stt}><Audio src={staticFile(`bq-vo-${i + 1}.mp3`)} /></Sequence>)}

      {/* backdrop: pexels bokeh loop, blurred + darkened + push-in */}
      <AbsoluteFill style={{ transform: `scale(${pushIn * 1.08}) translate(${Math.sin(drift * 0.01) * 8}px, ${Math.cos(drift * 0.008) * 6}px)` }}>
        <BgVideo />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(11,13,16,0.66), rgba(11,13,16,0.5) 50%, rgba(11,13,16,0.74))' }} />
      <AbsoluteFill style={{ background: `radial-gradient(950px 640px at 50% 116%, ${accent}22 0%, transparent 60%)` }} />
      <AbsoluteFill style={{ background: 'radial-gradient(120% 120% at 50% 45%, transparent 55%, rgba(0,0,0,0.55) 100%)' }} />

      {/* EQ bars */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 96, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 11, opacity: 0.4 }}>
        {spectrum.map((v, i) => <div key={i} style={{ width: 12, height: 6 + clamp(v * 5, 0, 1) * 82, borderRadius: 3, background: i % 3 === 0 ? RED : i % 3 === 1 ? '#37455c' : GOLD }} />)}
      </div>

      {/* ── the scene ── */}
      <AbsoluteFill style={{ opacity: fadeAt(endF), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 40, padding: `${TOP_SAFE + 20}px 120px 120px` }}>
        {idx === 0 ? (
          // cover: doc title, kinetic
          <>
            <Line text="STOCK ISSUANCE &" at={S[idx] + 4} size={110} beats={beats} maxW={1600} />
            <Line text="TRANSFER AGREEMENT" at={S[idx] + 12} size={110} color={RED} beats={beats} maxW={1600} />
            <Line text="BioQuest, Inc.  ·  BQST  ×  MMM Industries" at={S[idx] + 24} size={40} color={MUTED} beats={beats} maxW={1500} font="serif" />
          </>
        ) : isLast ? (
          // closing
          <>
            <Line text="THE DEAL, IN SHORT" at={S[idx]} size={46} color={accent} beats={beats} maxW={1400} font="label" />
            <Line text="$100K IN." at={S[idx] + 10} size={150} beats={beats} maxW={1600} />
            <Line text="201,700 SHARES OUT." at={S[idx] + 28} size={130} color={RED} beats={beats} maxW={1600} />
            <Line text="Structured in your favor." at={S[idx] + 52} size={56} color={MUTED} beats={beats} maxW={1400} font="serif" />
          </>
        ) : st ? (
          // data scene: headline label + hero stat + supporting line
          <>
            <Line text={scene.headline} at={S[idx] + 4} size={64} color={accent} beats={beats} maxW={1500} font="label" />
            <StatBlock label={st.label} value={st.value} at={S[idx] + 16} beats={beats} accent={accent} />
            {scene.stats[1] && <Line text={`${scene.stats[1].value}  ${scene.stats[1].label.toLowerCase()}`} at={S[idx] + 40} size={54} color={MUTED} beats={beats} maxW={1400} />}
          </>
        ) : (
          // text scene: headline + up to 3 bullet lines
          <>
            <Line text={scene.headline} at={S[idx] + 4} size={92} color={idx % 2 ? RED : CREAM} beats={beats} maxW={1600} anim="wipe" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22, alignItems: 'center' }}>
              {(scene.bullets || []).slice(0, 3).map((b, i) => (
                <Line key={i} text={b} at={S[idx] + 26 + i * 14} size={50} color={MUTED} beats={beats} maxW={1500} font="serif" />
              ))}
            </div>
          </>
        )}
      </AbsoluteFill>

      {/* beat-locked bloom on section cuts */}
      {(() => { const cut = snap((S[idx] ?? 0) + 2, beats); const fl = clamp(1 - (frame - cut) / 6, 0, 1) * (frame >= cut ? 1 : 0); return <AbsoluteFill style={{ background: '#fff', opacity: fl * 0.1, pointerEvents: 'none' }} /> })()}

      {/* brand chrome — top-left only (title removed per direction) */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: TOP_SAFE, background: 'linear-gradient(180deg, rgba(11,13,16,0.55), transparent)', zIndex: 10, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: 40, left: 58, display: 'flex', alignItems: 'center', gap: 15, zIndex: 11 }}>
        <div style={{ width: 14, height: 14, borderRadius: 4, background: RED, transform: `scale(${1 + pulse * 0.25})` }} />
        <span style={{ fontFamily: INTER, fontWeight: 700, fontSize: 25, letterSpacing: '0.3em', color: '#c9d2df' }}>BIOQUEST</span>
        <span style={{ fontFamily: INTER, fontWeight: 600, fontSize: 18, letterSpacing: '0.24em', color: MUTED }}>· BQST</span>
      </div>
    </AbsoluteFill>
  )
}

// Still bokeh photo (Pexels) instead of a video loop — decoding a video on
// every frame made local renders ~2.5h. The still, blurred + drifting via the
// parent push-in transform, is visually equivalent and renders instantly.
const BgVideo: React.FC = () => (
  <Img src={staticFile('bg-hero.png')} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(2px) saturate(1.1) brightness(0.85)' }} />
)
