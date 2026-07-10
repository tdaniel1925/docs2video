import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion'
import { useAudioData, visualizeAudio } from '@remotion/media-utils'
import { loadFont as loadArchivo } from '@remotion/google-fonts/Archivo'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'

const { fontFamily: ARCHIVO } = loadArchivo()
const { fontFamily: INTER } = loadInter()

/**
 * KineticDemo — kinetic-typography explainer demo, driven by the music.
 * Zero images: pure animated type + code-drawn backdrop. The Remotion chrome
 * (brand name top-left, tag top-right, corner logo mark) stays on top —
 * exactly the layering a production kinetic style would use.
 *
 * "Moves to music" two ways:
 *  - audio-reactive: headline scale, glow, and the EQ bars follow the track's
 *    actual amplitude via visualizeAudio (no BPM assumptions)
 *  - choreographed: section entrances ride a fixed grid tuned to the track
 */

export const KINETIC_FRAMES = 1050 // 35s @ 30fps

const INK = '#0b0e14'
const CREAM = '#f4f1ec'
const MINT = '#c7e8a8'
const AMBER = '#ffb454'

// ── tiny helpers ──────────────────────────────────────────────────────────
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

function usePulse(): { amp: number; bass: number; spectrum: number[] } {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const audioData = useAudioData(staticFile('demo-music.mp3'))
  if (!audioData) return { amp: 0, bass: 0, spectrum: new Array(24).fill(0) }
  const spectrum = visualizeAudio({ fps, frame, audioData, numberOfSamples: 32 })
  const bass = (spectrum[0] + spectrum[1] + spectrum[2]) / 3
  const amp = spectrum.reduce((a, b) => a + b, 0) / spectrum.length
  return { amp, bass, spectrum: spectrum.slice(0, 24) }
}

// One word slamming in with a spring, optionally tinted.
const PopWord: React.FC<{ word: string; at: number; color?: string; size?: number; pulse?: number }> = ({ word, at, color = CREAM, size = 150, pulse = 0 }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = spring({ frame: frame - at, fps, config: { damping: 11, stiffness: 190, mass: 0.7 } })
  if (frame < at) return null
  return (
    <span style={{
      display: 'inline-block', fontFamily: ARCHIVO, fontWeight: 800, fontSize: size,
      color, letterSpacing: '-0.02em', margin: '0 26px',
      transform: `scale(${(0.4 + s * 0.6) * (1 + pulse * 0.05)}) rotate(${(1 - s) * -6}deg)`,
      opacity: s,
      textShadow: color !== CREAM ? `0 0 ${40 + pulse * 60}px ${color}66` : undefined,
    }}>{word}</span>
  )
}

// ── sections ──────────────────────────────────────────────────────────────

// 1) Word-by-word hook
const Hook: React.FC<{ from: number; pulse: number }> = ({ from, pulse }) => {
  const words: [string, string?][] = [['YOUR'], ['MONEY'], ['HAS', undefined], ['A'], ['STORY.', MINT]]
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: 1600, lineHeight: 1.1 }}>
        {words.map(([w, c], i) => (
          <PopWord key={w} word={w} at={from + i * 9} color={c} pulse={pulse} />
        ))}
      </div>
    </AbsoluteFill>
  )
}

// 2) Alternating line slides
const Lines: React.FC<{ from: number }> = ({ from }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const lines = ['Most people never hear it.', 'It hides in statements.', 'It drowns in jargon.']
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div>
        {lines.map((l, i) => {
          const s = spring({ frame: frame - (from + i * 16), fps, config: { damping: 16, stiffness: 130 } })
          const dir = i % 2 === 0 ? -1 : 1
          return (
            <div key={l} style={{
              fontFamily: ARCHIVO, fontWeight: 700, fontSize: 84, color: i === 2 ? AMBER : CREAM,
              textAlign: 'center', lineHeight: 1.25, opacity: s,
              transform: `translateX(${dir * (1 - s) * 420}px)`,
            }}>{l}</div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}

// 3) Count-up hero number, breathing with the bass
const CountUp: React.FC<{ from: number; bass: number }> = ({ from, bass }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const p = spring({ frame: frame - from, fps, config: { damping: 26, stiffness: 44, mass: 1.4 } })
  const value = Math.round(912300 * p)
  const label = spring({ frame: frame - from - 12, fps, config: { damping: 14, stiffness: 120 } })
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: INTER, fontWeight: 700, fontSize: 34, letterSpacing: '0.38em', color: MINT, opacity: label, marginBottom: 18 }}>
          WHAT YOU'VE ALREADY BUILT
        </div>
        <div style={{
          fontFamily: ARCHIVO, fontWeight: 800, fontSize: 250, color: CREAM, lineHeight: 1,
          letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums',
          transform: `scale(${1 + bass * 0.045})`,
          textShadow: `0 0 ${60 + bass * 120}px ${MINT}44`,
        }}>
          ${value.toLocaleString()}
        </div>
      </div>
    </AbsoluteFill>
  )
}

// 4) Single-word slams
const Slams: React.FC<{ from: number; pulse: number }> = ({ from, pulse }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const words = [['CLEAR.', CREAM], ['VISUAL.', MINT], ['PERSONAL.', AMBER]] as const
  const per = 26
  const idx = clamp(Math.floor((frame - from) / per), 0, words.length - 1)
  const local = frame - from - idx * per
  const s = spring({ frame: local, fps, config: { damping: 12, stiffness: 220, mass: 0.6 } })
  const [word, color] = words[idx]
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{
        fontFamily: ARCHIVO, fontWeight: 800, fontSize: 300, color, letterSpacing: '-0.03em',
        transform: `scale(${(2.2 - s * 1.2) * (1 + pulse * 0.04)})`,
        opacity: clamp(s * 1.4, 0, 1),
        textShadow: `0 0 ${50 + pulse * 90}px ${color}55`,
      }}>{word}</div>
    </AbsoluteFill>
  )
}

// 5) "One document. One minute. One video." stacked stagger
const Ones: React.FC<{ from: number }> = ({ from }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const rows = ['ONE DOCUMENT.', 'ONE MINUTE.', 'ONE VIDEO.']
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div>
        {rows.map((r, i) => {
          const s = spring({ frame: frame - (from + i * 14), fps, config: { damping: 13, stiffness: 170 } })
          return (
            <div key={r} style={{
              fontFamily: ARCHIVO, fontWeight: 800, fontSize: 128, textAlign: 'center', lineHeight: 1.22,
              color: i === 2 ? MINT : CREAM, opacity: s,
              transform: `translateY(${(1 - s) * 80}px) scale(${0.9 + s * 0.1})`,
            }}>{r}</div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}

// 6) Brand close
const Close: React.FC<{ from: number; pulse: number }> = ({ from, pulse }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = spring({ frame: frame - from, fps, config: { damping: 18, stiffness: 90 } })
  const cta = spring({ frame: frame - from - 24, fps, config: { damping: 16, stiffness: 110 } })
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontFamily: ARCHIVO, fontWeight: 800, fontSize: 170, color: CREAM, letterSpacing: '-0.02em',
          opacity: s, transform: `scale(${(0.86 + s * 0.14) * (1 + pulse * 0.03)})`,
        }}>
          Docs2<span style={{ color: MINT }}>Video</span>
        </div>
        <div style={{ fontFamily: INTER, fontWeight: 600, fontSize: 42, color: '#9aa3b2', marginTop: 20, opacity: cta, transform: `translateY(${(1 - cta) * 24}px)` }}>
          Your documents, telling their story.
        </div>
        <div style={{ fontFamily: INTER, fontWeight: 700, fontSize: 30, letterSpacing: '0.3em', color: AMBER, marginTop: 46, opacity: cta }}>
          DOCS2VIDEO.COM
        </div>
      </div>
    </AbsoluteFill>
  )
}

// ── the composition ───────────────────────────────────────────────────────
export const KineticDemo: React.FC = () => {
  const frame = useCurrentFrame()
  const { pulse, bass, spectrum } = (() => {
    const { amp, bass, spectrum } = usePulse()
    // Smooth + exaggerate a little so the pulse reads on screen
    return { pulse: clamp(amp * 6, 0, 1), bass: clamp(bass * 5, 0, 1), spectrum }
  })()

  // Section timeline (frames @30fps)
  const S = { hook: 15, lines: 165, count: 330, slams: 540, ones: 640, close: 820 }
  const active = frame < S.lines ? 'hook' : frame < S.count ? 'lines' : frame < S.slams ? 'count' : frame < S.ones ? 'slams' : frame < S.close ? 'ones' : 'close'

  // Cross-fade sections in their last 12 frames
  const sectionEnd = active === 'hook' ? S.lines : active === 'lines' ? S.count : active === 'count' ? S.slams : active === 'slams' ? S.ones : active === 'ones' ? S.close : KINETIC_FRAMES
  const fade = interpolate(frame, [sectionEnd - 12, sectionEnd], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.quad) })

  // Backdrop: slow gradient drift + bass-reactive vignette glow
  const drift = frame * 0.25
  return (
    <AbsoluteFill style={{ background: INK }}>
      <Audio src={staticFile('demo-music.mp3')} volume={(f) => interpolate(f, [KINETIC_FRAMES - 45, KINETIC_FRAMES], [1, 0], { extrapolateLeft: 'clamp' })} />

      {/* animated backdrop */}
      <AbsoluteFill style={{
        background: `radial-gradient(1200px 800px at ${30 + Math.sin(drift * 0.017) * 12}% ${40 + Math.cos(drift * 0.013) * 10}%, #16202f 0%, ${INK} 62%)`,
      }} />
      <AbsoluteFill style={{
        background: `radial-gradient(900px 600px at 50% 118%, ${MINT}${Math.round(10 + bass * 26).toString(16).padStart(2, '0')} 0%, transparent 60%)`,
      }} />

      {/* EQ bars along the bottom — literally the music, visualized */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 10, opacity: 0.5 }}>
        {spectrum.map((v, i) => (
          <div key={i} style={{ width: 14, height: 6 + clamp(v * 5, 0, 1) * 100, borderRadius: 3, background: i % 3 === 0 ? MINT : i % 3 === 1 ? '#3d4d63' : AMBER }} />
        ))}
      </div>

      {/* content sections */}
      <AbsoluteFill style={{ opacity: fade }}>
        {active === 'hook' && <Hook from={S.hook} pulse={pulse} />}
        {active === 'lines' && <Lines from={S.lines} />}
        {active === 'count' && <CountUp from={S.count} bass={bass} />}
        {active === 'slams' && <Slams from={S.slams} pulse={pulse} />}
        {active === 'ones' && <Ones from={S.ones} />}
        {active === 'close' && <Close from={S.close} pulse={pulse} />}
      </AbsoluteFill>

      {/* ── persistent Remotion chrome (the point of the demo): brand name top,
             tag top-right, logo mark corner — always above the kinetic layer ── */}
      <div style={{ position: 'absolute', top: 42, left: 60, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 14, height: 14, borderRadius: 4, background: MINT }} />
        <span style={{ fontFamily: INTER, fontWeight: 700, fontSize: 26, letterSpacing: '0.32em', color: '#c9d2df' }}>SUMMIT FINANCIAL</span>
      </div>
      <div style={{ position: 'absolute', top: 42, right: 60, fontFamily: INTER, fontWeight: 600, fontSize: 22, letterSpacing: '0.22em', color: '#5d6b80' }}>
        KINETIC · 2026
      </div>
      <div style={{ position: 'absolute', bottom: 42, right: 60, display: 'flex', alignItems: 'center', gap: 12, opacity: 0.85 }}>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: `linear-gradient(135deg, ${MINT}, ${AMBER})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: ARCHIVO, fontWeight: 800, fontSize: 18, color: INK }}>S</div>
        <span style={{ fontFamily: INTER, fontWeight: 600, fontSize: 20, color: '#8b96a8' }}>Logo stays here</span>
      </div>
    </AbsoluteFill>
  )
}
