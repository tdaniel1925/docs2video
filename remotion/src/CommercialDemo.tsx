import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing, type CalculateMetadataFunction } from 'remotion'
import { useMemo } from 'react'
import { useAudioData, visualizeAudio, getAudioDurationInSeconds } from '@remotion/media-utils'
import { fitText } from '@remotion/layout-utils'
import { loadFont as loadArchivo } from '@remotion/google-fonts/Archivo'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import { loadFont as loadFraunces } from '@remotion/google-fonts/Fraunces'

const { fontFamily: ARCHIVO } = loadArchivo()
const { fontFamily: INTER } = loadInter()
const { fontFamily: FRAUNCES } = loadFraunces() // high-contrast serif for accent beats

// Top safe band (EBU R95 style): image cells never enter this zone, so the
// pinned brand chrome can never be overlapped — the top-right collision fix.
const TOP_SAFE = 100

/**
 * CommercialDemo — a full Docs2Video spot combining every technique discussed:
 *  - kinetic typography synced to a real ElevenLabs voiceover (per-section
 *    clips, so text appears WITH the words being spoken)
 *  - "product photos": live screenshots of docs2video.com, browser-framed,
 *    floating/tilting, slamming in ON DETECTED BEATS of the music
 *  - beat detection: bass-band onset peaks measured from the actual track
 *  - music ducked under the VO; EQ bars visualize the real spectrum
 *  - persistent brand chrome above everything
 */

const FPS = 30
const INK = '#0b0e14'
const CREAM = '#f4f1ec'
const MINT = '#c7e8a8'
const AMBER = '#ffb454'

export type CommercialProps = { starts: number[]; total: number }

const GAP = Math.round(0.45 * FPS) // breath between VO sections

export const commercialMetadata: CalculateMetadataFunction<CommercialProps> = async () => {
  const durs: number[] = []
  for (let i = 1; i <= 6; i++) {
    durs.push(await getAudioDurationInSeconds(staticFile(`commercial-vo-${i}.mp3`)))
  }
  const starts: number[] = []
  let t = Math.round(0.6 * FPS)
  for (const d of durs) {
    starts.push(t)
    t += Math.round(d * FPS) + GAP
  }
  const total = t + Math.round(2.6 * FPS) // logo tail
  return { durationInFrames: total, props: { starts, total } }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

// ── beat detection: bass-band onset peaks measured across the whole track ──
function useBeats(totalFrames: number): { beats: number[]; spectrum: number[]; bass: number } {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const audioData = useAudioData(staticFile('commercial-music.mp3'))

  const beats = useMemo(() => {
    if (!audioData) return []
    const energy: number[] = []
    for (let f = 0; f < totalFrames; f++) {
      const s = visualizeAudio({ fps, frame: f, audioData, numberOfSamples: 16 })
      energy.push(s[0] + s[1]) // kick band
    }
    // 1) raw onsets: local peaks above adaptive threshold
    const onsets: number[] = []
    const win = 20
    for (let f = 2; f < energy.length - 2; f++) {
      const lo = Math.max(0, f - win), hi = Math.min(energy.length, f + win)
      const avg = energy.slice(lo, hi).reduce((a, b) => a + b, 0) / (hi - lo)
      const isPeak = energy[f] > avg * 1.3 && energy[f] >= energy[f - 1] && energy[f] >= energy[f + 1]
      if (isPeak && (onsets.length === 0 || f - onsets[onsets.length - 1] >= 8)) onsets.push(f)
    }
    if (onsets.length < 4) return onsets
    // 2) tempo: mode of pairwise onset intervals in the 60–160 BPM range
    //    (12–30 frames @30fps), counting near-multiples back to the base period
    const votes = new Map<number, number>()
    for (let i = 1; i < onsets.length; i++) {
      const d = onsets[i] - onsets[i - 1]
      for (let period = 12; period <= 30; period++) {
        for (let mult = 1; mult <= 3; mult++) {
          if (Math.abs(d - period * mult) <= 1) votes.set(period, (votes.get(period) || 0) + 1)
        }
      }
    }
    const period = [...votes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 15
    // 3) phase: offset that lines the grid up with the most onset energy
    let bestPhase = 0, bestScore = -1
    for (let phase = 0; phase < period; phase++) {
      let score = 0
      for (let f = phase; f < energy.length; f += period) score += energy[f] || 0
      if (score > bestScore) { bestScore = score; bestPhase = phase }
    }
    // 4) regular grid — a steady grid FEELS on-beat even when single kicks vary
    const grid: number[] = []
    for (let f = bestPhase; f < totalFrames; f += period) grid.push(f)
    return grid
  }, [audioData, fps, totalFrames])

  if (!audioData) return { beats: [], spectrum: new Array(20).fill(0), bass: 0 }
  const spec = visualizeAudio({ fps, frame, audioData, numberOfSamples: 32 })
  return { beats, spectrum: spec.slice(0, 20), bass: clamp((spec[0] + spec[1]) * 2.6, 0, 1) }
}

// pulse that decays after the most recent beat (the "hit")
function beatPulse(frame: number, beats: number[]): number {
  let last = -100
  for (const b of beats) { if (b <= frame) last = b; else break }
  return Math.exp(-(frame - last) / 5)
}

// ── shared elements ───────────────────────────────────────────────────────
const Kicker: React.FC<{ text: string; at: number; color?: string }> = ({ text, at, color = MINT }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = spring({ frame: frame - at, fps, config: { damping: 15, stiffness: 130 } })
  return (
    <div style={{ fontFamily: INTER, fontWeight: 700, fontSize: 30, letterSpacing: '0.4em', color, opacity: s, transform: `translateY(${(1 - s) * 18}px)`, marginBottom: 26 }}>{text}</div>
  )
}

// Snap a nominal frame to the next beat-grid frame — entrances LAND on beats.
const snapToBeat = (f: number, beats: number[]): number => {
  for (const b of beats) if (b >= f) return b
  return f
}

// Text: springs in ON a beat, then holds perfectly steady (no pulse — the
// twitching scale read as glitching). Beat energy lives in shots/EQ/glow only.
// MEASURED: the whole line is sized with fitText against its container width,
// so it can never spill into a neighboring cell — no eyeballed sizes.
//   font: 'display' (Archivo, heavy sans) or 'serif' (Fraunces, hi-contrast)
//   anim: 'scale' (spring pop) or 'wipe' (mask reveal) — entrance variety
const BigLine: React.FC<{
  words: { w: string; c?: string }[]; at: number; size?: number; step?: number
  beats?: number[]; maxWidth?: number; font?: 'display' | 'serif'; anim?: 'scale' | 'wipe'
}> = ({ words, at, size = 120, step = 7, beats = [], maxWidth = 1560, font = 'display', anim = 'scale' }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const start = snapToBeat(at, beats)
  const family = font === 'serif' ? FRAUNCES : ARCHIVO
  const weight = font === 'serif' ? 600 : 800
  const italic = font === 'serif'
  const text = words.map((x) => x.w).join(' ')
  const { fontSize: fitted } = fitText({ text, withinWidth: maxWidth, fontFamily: family, fontWeight: weight })
  const fontSize = Math.min(size, fitted * 0.93)
  return (
    <div style={{ lineHeight: 1.12, maxWidth, whiteSpace: 'nowrap' }}>
      {words.map(({ w, c }, i) => {
        // decelerating spring for entrances (M3 easing principle from research)
        const s = spring({ frame: frame - (start + i * step), fps, config: { damping: 15, stiffness: 190, mass: 0.65 } })
        const common = {
          display: 'inline-block' as const, fontFamily: family, fontWeight: weight,
          fontStyle: italic ? ('italic' as const) : ('normal' as const), fontSize,
          color: c || CREAM, marginRight: i < words.length - 1 ? '0.3em' : 0,
          letterSpacing: font === 'serif' ? '-0.01em' : '-0.02em',
          textShadow: c ? `0 0 34px ${c}55` : '0 2px 24px rgba(0,0,0,0.55)',
        }
        if (anim === 'wipe') {
          return (
            <span key={i} style={{ ...common, overflow: 'hidden', clipPath: `inset(0 ${(1 - s) * 100}% 0 0)`, opacity: s > 0.02 ? 1 : 0 }}>{w}</span>
          )
        }
        return (
          <span key={i} style={{ ...common, opacity: s, transform: `scale(${0.5 + s * 0.5}) rotate(${(1 - s) * -5}deg)` }}>{w}</span>
        )
      })}
    </div>
  )
}

// Browser-framed product screenshot: FLOW-layout element that fills its grid/
// flex cell — the layout engine guarantees it can never overlap text, so it
// can be as BIG as its cell allows. Tilt is kept small enough that the rotated
// bounding-box expansion stays inside the cell gutters.
const ProductShot: React.FC<{ src: string; at: number; beats: number[]; tilt?: number }> = ({ src, at, beats, tilt = -2.5 }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const start = snapToBeat(at, beats)
  const s = spring({ frame: frame - start, fps, config: { damping: 14, stiffness: 120, mass: 0.9 } })
  const hit = beatPulse(frame, beats)
  const float = Math.sin((frame - start) * 0.045) * 7
  return (
    <div style={{
      // Beat response is GLOW/SHADOW only — no scale bump (scale twitching on
      // every beat read as glitching). The entrance itself lands on a beat.
      transform: `translateY(${(1 - s) * 340 + float}px) rotate(${tilt * (1 - s * 0.3)}deg) scale(${0.8 + s * 0.2})`,
      opacity: s, width: '100%', borderRadius: 18, overflow: 'hidden',
      boxShadow: `0 44px 110px rgba(0,0,0,0.6), 0 0 ${20 + hit * 60}px ${MINT}${Math.round(24 + hit * 40).toString(16).padStart(2, '0')}`,
      border: '1px solid #2a3446',
    }}>
      <div style={{ height: 44, background: '#161d29', display: 'flex', alignItems: 'center', gap: 9, padding: '0 18px' }}>
        <div style={{ width: 13, height: 13, borderRadius: 7, background: '#ff5f57' }} />
        <div style={{ width: 13, height: 13, borderRadius: 7, background: '#febc2e' }} />
        <div style={{ width: 13, height: 13, borderRadius: 7, background: '#28c840' }} />
        <div style={{ marginLeft: 18, fontFamily: INTER, fontSize: 17, color: '#7c8797', background: '#0d131d', borderRadius: 8, padding: '5px 20px' }}>docs2video.com</div>
      </div>
      <Img src={staticFile(src)} style={{ width: '100%', display: 'block' }} />
    </div>
  )
}

// ── the composition ───────────────────────────────────────────────────────
export const CommercialDemo: React.FC<CommercialProps> = ({ starts, total }) => {
  const frame = useCurrentFrame()
  const { beats, spectrum, bass } = useBeats(total)
  const pulse = beatPulse(frame, beats)

  const S = starts
  const sectionIdx = S.filter((s) => frame >= s - 8).length - 1
  const drift = frame * 0.22

  const fadeAt = (end: number) => interpolate(frame, [end - 12, end], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.quad) })
  const ends = [...S.slice(1), total - Math.round(1.9 * FPS)]

  // Per-section accent palette shift (the "variety" ask) — pulled off the
  // section index; in production this maps to the script's `beat` field.
  const ACCENTS = [AMBER, AMBER, MINT, MINT, MINT, MINT]
  const accent = ACCENTS[Math.max(0, Math.min(ACCENTS.length - 1, sectionIdx))]
  const bg = sectionIdx <= 1 ? 'bg-warm.png' : sectionIdx >= 5 ? 'bg-mint.png' : 'bg-hero.png'

  // Section-transition whoosh + a sub-bass impact ON the first beat after each
  // section starts — the "Hollywood" layer.
  const sfx = S.flatMap((st) => {
    const hit = snapToBeat(st + 2, beats)
    return [
      { src: 'sfx-whoosh.wav', from: Math.max(0, st - 10) },
      { src: 'sfx-impact.wav', from: hit },
    ]
  })

  // slow cinematic push-in on the whole frame (micro-motion, never fully still)
  const pushIn = 1 + (frame / total) * 0.04

  return (
    <AbsoluteFill style={{ background: INK }}>
      {/* music, ducked under VO, fading out at the end */}
      <Audio src={staticFile('commercial-music.mp3')} volume={(f) => interpolate(f, [0, 30, total - 70, total - 8], [0, 0.13, 0.13, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />
      {/* voiceover clips at their section starts */}
      {S.map((st, i) => (
        <Sequence key={i} from={st}>
          <Audio src={staticFile(`commercial-vo-${i + 1}.mp3`)} />
        </Sequence>
      ))}
      {/* sound design: whoosh into each section, sub-bass impact on the beat */}
      {sfx.map((x, i) => (
        <Sequence key={`sfx${i}`} from={x.from}>
          <Audio src={staticFile(x.src)} volume={x.src.includes('impact') ? 0.5 : 0.32} />
        </Sequence>
      ))}

      {/* LAYER 1 — Pexels bokeh video loop, blurred + slow push-in (depth plane 1) */}
      <AbsoluteFill style={{ transform: `scale(${pushIn * 1.08}) translate(${Math.sin(drift * 0.01) * 10}px, ${Math.cos(drift * 0.008) * 8}px)` }}>
        <OffthreadVideo src={staticFile('pexels-bg-loop.mp4')} muted loop style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(4px) saturate(1.05) brightness(0.75)' }} />
      </AbsoluteFill>
      {/* LAYER 2 — dark scrim so text always clears contrast (WCAG) */}
      <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(8,11,20,0.62) 0%, rgba(8,11,20,0.48) 50%, rgba(8,11,20,0.72) 100%)` }} />
      {/* LAYER 3 — accent bass glow rising from below, tinted per section */}
      <AbsoluteFill style={{ background: `radial-gradient(950px 640px at 50% 116%, ${accent}${Math.round(10 + bass * 34).toString(16).padStart(2, '0')} 0%, transparent 60%)` }} />
      {/* LAYER 4 — vignette + subtle grain feel for cinematic grade */}
      <AbsoluteFill style={{ background: 'radial-gradient(120% 120% at 50% 45%, transparent 55%, rgba(0,0,0,0.55) 100%)' }} />

      {/* EQ bars */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 110, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 11, opacity: 0.42 }}>
        {spectrum.map((v, i) => (
          <div key={i} style={{ width: 13, height: 6 + clamp(v * 5, 0, 1) * 92, borderRadius: 3, background: i % 3 === 0 ? MINT : i % 3 === 1 ? '#37455c' : AMBER }} />
        ))}
      </div>

      {/* ── sections, each synced to its VO clip ── */}
      {sectionIdx === 0 && (
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center', opacity: fadeAt(ends[0]) }}>
          <div>
            <Kicker text="YOUR BEST WORK" at={S[0]} />
            <BigLine words={[{ w: 'SENT.' }, { w: 'OPENED?' }, { w: 'IGNORED.', c: AMBER }]} at={S[0] + 8} size={140} step={16} beats={beats} />
          </div>
        </AbsoluteFill>
      )}

      {sectionIdx === 1 && (
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center', opacity: fadeAt(ends[1]) }}>
          <div>
            <BigLine words={[{ w: 'PROPOSALS.' }, { w: 'POLICIES.' }, { w: 'REPORTS.' }]} at={S[1]} size={104} step={12} beats={beats} anim="wipe" />
            <div style={{ height: 44 }} />
            {/* serif accent beat — elegant contrast against the heavy sans */}
            <BigLine words={[{ w: 'Brilliant' }, { w: '—' }, { w: 'and' }, { w: 'unread.', c: AMBER }]} at={S[1] + 42} size={116} step={8} beats={beats} font="serif" />
          </div>
        </AbsoluteFill>
      )}

      {sectionIdx === 2 && (
        /* FLOW layout: caption / image / caption stacked in a flex column —
           overlap is impossible by construction, so the shot goes BIG. */
        <AbsoluteFill style={{ opacity: fadeAt(ends[2]), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 30, padding: `${TOP_SAFE + 10}px 0 130px` }}>
          <div style={{ textAlign: 'center' }}>
            <BigLine words={[{ w: 'ANY' }, { w: 'DOCUMENT' }, { w: '→' }, { w: 'VIDEO.', c: MINT }]} at={S[2] + 6} size={76} step={9} beats={beats} maxWidth={1600} />
          </div>
          <div style={{ width: 1180 }}>
            <ProductShot src="product-1.png" at={S[2] + 26} beats={beats} tilt={-2} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <BigLine words={[{ w: 'IN' }, { w: 'ABOUT' }, { w: 'A' }, { w: 'MINUTE.', c: AMBER }]} at={S[2] + 78} size={56} step={7} beats={beats} maxWidth={1400} />
          </div>
        </AbsoluteFill>
      )}

      {sectionIdx === 3 && (
        /* FLOW layout: two grid columns + fixed gutter — text is fitted to its
           column, the shot fills its own. They cannot touch. */
        <AbsoluteFill style={{ opacity: fadeAt(ends[3]), display: 'grid', gridTemplateColumns: '760px 70px 1fr', alignItems: 'center', padding: `${TOP_SAFE}px 70px 90px` }}>
          <div>
            {[
              { t: 'REAL NARRATION', c: CREAM, at: S[3] + 8 },
              { t: 'DESIGNS THAT MOVE', c: MINT, at: S[3] + 34 },
              { t: 'YOUR BRAND', c: AMBER, at: S[3] + 62 },
            ].map(({ t, c, at }) => (
              <div key={t} style={{ marginBottom: 16 }}><BigLine words={[{ w: t, c }]} at={at} size={74} beats={beats} maxWidth={760} /></div>
            ))}
          </div>
          <div />
          <div style={{ maxHeight: 1080 - TOP_SAFE - 90, overflow: 'visible' }}><ProductShot src="product-2.png" at={S[3] + 4} beats={beats} tilt={2.5} /></div>
        </AbsoluteFill>
      )}

      {sectionIdx === 4 && (
        <AbsoluteFill style={{ opacity: fadeAt(ends[4]), display: 'grid', gridTemplateColumns: '1fr 70px 700px', alignItems: 'center', padding: `${TOP_SAFE}px 70px 90px` }}>
          <div style={{ maxHeight: 1080 - TOP_SAFE - 90, overflow: 'visible' }}><ProductShot src="product-3.png" at={S[4] + 2} beats={beats} tilt={-2.5} /></div>
          <div />
          <div style={{ textAlign: 'right' }}>
            {[
              { t: 'SEND IT.', c: CREAM, at: S[4] + 6 },
              { t: 'TRACK IT.', c: CREAM, at: S[4] + 26 },
              { t: 'THEY RESPOND.', c: MINT, at: S[4] + 48 },
            ].map(({ t, c, at }) => (
              <div key={t} style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}><BigLine words={[{ w: t, c }]} at={at} size={80} beats={beats} maxWidth={700} /></div>
            ))}
          </div>
        </AbsoluteFill>
      )}

      {sectionIdx >= 5 && (
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          <div>
            <BigLine words={[{ w: 'ONE' }, { w: 'DOCUMENT.' }]} at={S[5]} size={92} step={7} beats={beats} />
            <BigLine words={[{ w: 'ONE' }, { w: 'MINUTE.' }]} at={S[5] + 22} size={92} step={7} beats={beats} />
            <BigLine words={[{ w: 'ONE' }, { w: 'VIDEO.', c: MINT }]} at={S[5] + 44} size={92} step={7} beats={beats} />
            <div style={{ marginTop: 54 }}>
              <BigLine words={[{ w: 'Docs2' }, { w: 'Video', c: MINT }]} at={S[5] + 92} size={150} step={5} beats={beats} />
            </div>
            <div style={{ fontFamily: INTER, fontWeight: 700, fontSize: 34, letterSpacing: '0.3em', color: AMBER, marginTop: 40, opacity: spring({ frame: frame - (S[5] + 120), fps: FPS, config: { damping: 15, stiffness: 110 } }) }}>
              START FREE · DOCS2VIDEO.COM
            </div>
          </div>
        </AbsoluteFill>
      )}

      {/* beat-locked bloom on each section start — a "cut on impact" flash */}
      {(() => {
        const cutHit = snapToBeat((S[sectionIdx] ?? 0) + 2, beats)
        const flash = clamp(1 - (frame - cutHit) / 6, 0, 1) * (frame >= cutHit ? 1 : 0)
        return <AbsoluteFill style={{ background: '#ffffff', opacity: flash * 0.12, pointerEvents: 'none' }} />
      })()}

      {/* ── persistent brand chrome — scrim strip + top z so nothing overlaps ── */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: TOP_SAFE, background: 'linear-gradient(180deg, rgba(8,11,20,0.55), transparent)', zIndex: 10, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: 40, left: 58, display: 'flex', alignItems: 'center', gap: 15, zIndex: 11 }}>
        <div style={{ width: 14, height: 14, borderRadius: 4, background: MINT, transform: `scale(${1 + pulse * 0.25})` }} />
        <span style={{ fontFamily: INTER, fontWeight: 700, fontSize: 25, letterSpacing: '0.32em', color: '#c9d2df' }}>DOCS2VIDEO</span>
      </div>
    </AbsoluteFill>
  )
}
