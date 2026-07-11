import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing, random } from 'remotion'
import { loadFont as loadMont } from '@remotion/google-fonts/Montserrat'
import { loadFont as loadPlayfair } from '@remotion/google-fonts/PlayfairDisplay'

const { fontFamily: MONT } = loadMont()
const { fontFamily: PLAYFAIR } = loadPlayfair()
// heavy display face for hero numbers/hype — Montserrat 900 (loaded above)
const ARCHIVO = MONT
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * COMMERCIAL PROTOTYPES — three distinct cinematic styles, pushed FAR past the
 * slide system, to show the ceiling of what Remotion can do for real commercials.
 * Each is a self-contained scene. Nothing here is in the product yet — it's a
 * visual pitch of directions.
 *
 * 1. HeroReveal   — a dramatic count-up number that LANDS with a light bloom,
 *                   parallax backdrop push-in, film grain, vignette. "The moment."
 * 2. KineticHype  — high-energy kinetic typography, words that slam/scale/wipe
 *                   on a beat, bold color blocks. "The hype cut."
 * 3. CinematicOpen— an emotional brand open: footage-grade backdrop, slow push,
 *                   elegant serif title fading up through light, letterboxed.
 */

// ---------- shared cinematic finish: film grain + vignette + letterbox ----------
const FilmFinish: React.FC<{ grain?: number; letterbox?: boolean }> = ({ grain = 0.06, letterbox = false }) => {
  const frame = useCurrentFrame()
  return (
    <>
      <AbsoluteFill style={{ background: 'radial-gradient(130% 130% at 50% 45%, transparent 45%, rgba(0,0,0,0.75))', pointerEvents: 'none' }} />
      {/* moving grain */}
      <AbsoluteFill style={{ opacity: grain, mixBlendMode: 'overlay', pointerEvents: 'none' }}>
        <svg width="100%" height="100%"><filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={frame % 10} /></filter><rect width="100%" height="100%" filter="url(#g)" /></svg>
      </AbsoluteFill>
      {letterbox && <>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '11%', background: '#000' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '11%', background: '#000' }} />
      </>}
    </>
  )
}

// living parallax backdrop (push-in + drift + heavy grade)
const Backdrop: React.FC<{ file: string; grade?: string }> = ({ file, grade = 'brightness(0.5) saturate(1.1) contrast(1.08)' }) => {
  const frame = useCurrentFrame()
  const sc = 1.15 + frame * 0.0008
  const tx = Math.sin(frame * 0.008) * 18
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Img src={staticFile(file)} style={{ position: 'absolute', width: '120%', height: '120%', left: '-10%', top: '-10%', objectFit: 'cover', transform: `scale(${sc}) translateX(${tx}px)`, filter: grade }} />
    </AbsoluteFill>
  )
}

// =========================================================================
// 1. HERO REVEAL — the dramatic number moment
// =========================================================================
export const HeroReveal: React.FC = () => {
  const frame = useCurrentFrame(); const { fps, durationInFrames } = useVideoConfig()
  const GOLD = '#e8c877', NAVY = '#0a1526'
  // number counts up with an ease, lands at ~frame 55 with a bloom
  const land = 55
  const p = Easing.out(Easing.cubic)(clamp(frame / land, 0, 1))
  const value = Math.round(824500 * p)
  const bloom = interpolate(frame, [land - 6, land, land + 22], [0, 1, 0.25], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const numScale = 0.7 + spring({ frame, fps, config: { damping: 12, stiffness: 120 } }) * 0.3 + bloom * 0.06
  const labelUp = spring({ frame: frame - 10, fps, config: { damping: 18, stiffness: 90 } })
  const subUp = spring({ frame: frame - land - 8, fps, config: { damping: 18, stiffness: 90 } })
  return (
    <AbsoluteFill style={{ background: NAVY }}>
      <Backdrop file="proto-family.jpg" grade="brightness(0.32) saturate(0.9) contrast(1.1)" />
      <AbsoluteFill style={{ background: `radial-gradient(60% 60% at 50% 50%, ${GOLD}22, transparent 70%)`, opacity: bloom }} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
        <div style={{ fontFamily: MONT, fontWeight: 800, fontSize: 30, letterSpacing: '0.4em', color: GOLD, textTransform: 'uppercase', opacity: labelUp, transform: `translateY(${(1 - labelUp) * 20}px)` }}>Your Projected Income Base</div>
        <div style={{ fontFamily: ARCHIVO, fontWeight: 900, fontSize: 220, color: '#fff', lineHeight: 1, transform: `scale(${numScale})`, textShadow: `0 0 ${40 * bloom}px ${GOLD}, 0 8px 40px rgba(0,0,0,0.7)`, marginTop: 10 }}>
          ${value.toLocaleString('en-US')}
        </div>
        <div style={{ fontFamily: PLAYFAIR, fontStyle: 'italic', fontSize: 40, color: '#e9e3d5', marginTop: 24, opacity: subUp, transform: `translateY(${(1 - subUp) * 20}px)` }}>Guaranteed for life. Starting at 68.</div>
      </AbsoluteFill>
      <FilmFinish grain={0.05} letterbox />
    </AbsoluteFill>
  )
}

// =========================================================================
// 2. KINETIC HYPE — high-energy typography on the beat
// =========================================================================
const BEAT = 14 // frames per beat (~128bpm at 30fps)
export const KineticHype: React.FC = () => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const ACCENT = '#39d98a', BG = '#0d0d10'
  // a sequence of words, each SLAMS in on its beat and holds
  const words = ['STOP', 'GUESSING.', 'START', 'GROWING.']
  const beatPulse = Math.exp(-((frame % BEAT)) / 4)
  const wordIdx = Math.min(words.length - 1, Math.floor(frame / (BEAT * 1.5)))
  const localInWord = frame - wordIdx * BEAT * 1.5
  const slam = spring({ frame: localInWord, fps, config: { damping: 9, stiffness: 260 } })
  const flash = clamp(1 - localInWord / 4, 0, 1)
  return (
    <AbsoluteFill style={{ background: BG }}>
      {/* pulsing color blocks that shift on the beat */}
      <AbsoluteFill style={{ background: `radial-gradient(120% 120% at ${30 + (wordIdx % 2) * 40}% 40%, ${ACCENT}22, transparent 55%)`, opacity: 0.5 + beatPulse * 0.5 }} />
      {/* moving diagonal bars */}
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} style={{ position: 'absolute', top: 0, bottom: 0, width: 4, left: `${((i * 18 + frame * 1.5) % 110) - 5}%`, background: ACCENT, opacity: 0.08, transform: 'skewX(-20deg)' }} />
      ))}
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ fontFamily: ARCHIVO, fontWeight: 900, fontSize: 180, color: '#fff', letterSpacing: '-0.02em', transform: `scale(${0.6 + slam * 0.4}) rotate(${(1 - slam) * -3}deg)`, textShadow: `8px 8px 0 ${ACCENT}`, opacity: clamp(slam * 2, 0, 1) }}>
          {words[wordIdx]}
        </div>
      </AbsoluteFill>
      {/* beat flash */}
      <AbsoluteFill style={{ background: '#fff', opacity: flash * 0.12, pointerEvents: 'none' }} />
      <FilmFinish grain={0.04} />
    </AbsoluteFill>
  )
}

// =========================================================================
// 3. CINEMATIC OPEN — emotional brand open
// =========================================================================
export const CinematicOpen: React.FC = () => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const GOLD = '#d8b56a'
  const titleUp = spring({ frame: frame - 24, fps, config: { damping: 22, stiffness: 60 } })
  const lineGrow = clamp((frame - 46) / 20, 0, 1)
  const subUp = spring({ frame: frame - 60, fps, config: { damping: 20, stiffness: 70 } })
  // slow light sweep across the title
  const sweep = clamp((frame - 30) / 50, 0, 1)
  return (
    <AbsoluteFill style={{ background: '#05070c' }}>
      <Backdrop file="proto-city.jpg" grade="brightness(0.4) saturate(1.05) contrast(1.06)" />
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(5,7,12,0.5), rgba(5,7,12,0.2) 40%, rgba(5,7,12,0.85))' }} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
        <div style={{ position: 'relative', opacity: titleUp, transform: `translateY(${(1 - titleUp) * 24}px) scale(${0.96 + titleUp * 0.04})` }}>
          <div style={{ fontFamily: PLAYFAIR, fontSize: 96, color: '#f4efe3', letterSpacing: '0.01em', textShadow: '0 4px 40px rgba(0,0,0,0.7)' }}>Built for Your Future</div>
          {/* light sweep */}
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, bottom: 0, width: 300, left: `${-40 + sweep * 140}%`, background: 'linear-gradient(105deg, transparent, rgba(255,255,255,0.35), transparent)', transform: 'skewX(-14deg)', mixBlendMode: 'screen', opacity: sweep > 0 && sweep < 1 ? 1 : 0 }} />
          </div>
        </div>
        <div style={{ width: 340 * lineGrow, height: 2, marginTop: 34, background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`, boxShadow: `0 0 20px ${GOLD}` }} />
        <div style={{ fontFamily: MONT, fontWeight: 500, fontSize: 30, letterSpacing: '0.22em', color: '#cdbf9f', marginTop: 28, textTransform: 'uppercase', opacity: subUp }}>Meridian Financial Group</div>
      </AbsoluteFill>
      <FilmFinish grain={0.05} letterbox />
    </AbsoluteFill>
  )
}

// =========================================================================
// 4. SPLIT COMPARE — dramatic side-by-side (the old way vs. you)
// =========================================================================
export const SplitCompare: React.FC = () => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const RED = '#c8503a', GREEN = '#39d98a'
  const wipe = clamp((frame - 8) / 22, 0, 1)
  const lIn = spring({ frame: frame - 18, fps, config: { damping: 18, stiffness: 90 } })
  const rIn = spring({ frame: frame - 30, fps, config: { damping: 18, stiffness: 90 } })
  const vsPop = spring({ frame: frame - 40, fps, config: { damping: 10, stiffness: 200 } })
  return (
    <AbsoluteFill style={{ background: '#0a0a0d' }}>
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '50%', background: '#14100f', clipPath: `inset(0 ${(1 - wipe) * 100}% 0 0)`, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', opacity: lIn }}>
        <div style={{ fontFamily: MONT, fontWeight: 800, fontSize: 26, letterSpacing: '0.2em', color: RED, textTransform: 'uppercase' }}>The Old Way</div>
        <div style={{ fontFamily: ARCHIVO, fontWeight: 900, fontSize: 130, color: '#6b6b6b', marginTop: 12 }}>$10k<span style={{ fontSize: 50 }}>/mo</span></div>
        <div style={{ fontFamily: MONT, fontWeight: 600, fontSize: 24, color: '#8a8a8a', marginTop: 8 }}>Slow. Manual. Expensive.</div>
      </div>
      <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: '50%', background: 'radial-gradient(120% 120% at 50% 40%, #12281d, #0a0a0d)', clipPath: `inset(0 0 0 ${(1 - wipe) * 100}%)`, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', opacity: rIn }}>
        <div style={{ fontFamily: MONT, fontWeight: 800, fontSize: 26, letterSpacing: '0.2em', color: GREEN, textTransform: 'uppercase' }}>With Us</div>
        <div style={{ fontFamily: ARCHIVO, fontWeight: 900, fontSize: 130, color: '#fff', marginTop: 12, textShadow: `0 0 30px ${GREEN}88` }}>$399<span style={{ fontSize: 50 }}>/mo</span></div>
        <div style={{ fontFamily: MONT, fontWeight: 600, fontSize: 24, color: '#bfeed6', marginTop: 8 }}>Instant. Automated. Yours.</div>
      </div>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', pointerEvents: 'none' }}>
        <div style={{ width: 3, height: '76%', background: `linear-gradient(180deg, transparent, ${GREEN}, transparent)`, opacity: wipe, boxShadow: `0 0 24px ${GREEN}` }} />
        <div style={{ position: 'absolute', fontFamily: ARCHIVO, fontWeight: 900, fontSize: 64, color: '#fff', background: '#0a0a0d', borderRadius: '50%', width: 110, height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${GREEN}`, transform: `scale(${vsPop})` }}>VS</div>
      </AbsoluteFill>
      <FilmFinish grain={0.04} />
    </AbsoluteFill>
  )
}

// =========================================================================
// 5. STAT GRID — a burst of proof points that assemble
// =========================================================================
export const StatGrid: React.FC = () => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const ACCENT = '#4fd1e8'
  const stats: [string, string][] = [['15s', 'Report time'], ['3,000+', 'Agents'], ['0%', 'Downside'], ['24/7', 'Available']]
  const titleUp = spring({ frame: frame - 6, fps, config: { damping: 18, stiffness: 90 } })
  return (
    <AbsoluteFill style={{ background: '#07141a' }}>
      <Backdrop file="proto-abstract2.jpg" grade="brightness(0.28) saturate(1.1) contrast(1.05)" />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 40 }}>
        <div style={{ fontFamily: MONT, fontWeight: 800, fontSize: 34, letterSpacing: '0.28em', color: ACCENT, textTransform: 'uppercase', opacity: titleUp }}>The Numbers Don't Lie</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
          {stats.map(([val, label], i) => {
            const at = 18 + i * 8
            const s = spring({ frame: frame - at, fps, config: { damping: 13, stiffness: 150 } })
            return (
              <div key={i} style={{ padding: '32px 30px', borderRadius: 12, background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(14px)', border: `1.5px solid ${ACCENT}44`, textAlign: 'center', opacity: s, transform: `translateY(${(1 - s) * 40}px) scale(${0.9 + s * 0.1})`, boxShadow: `0 0 40px ${ACCENT}22` }}>
                <div style={{ fontFamily: ARCHIVO, fontWeight: 900, fontSize: 76, color: '#fff', lineHeight: 1 }}>{val}</div>
                <div style={{ fontFamily: MONT, fontWeight: 600, fontSize: 20, color: '#9fc7d3', marginTop: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
              </div>
            )
          })}
        </div>
      </AbsoluteFill>
      <FilmFinish grain={0.05} />
    </AbsoluteFill>
  )
}

// =========================================================================
// 6. CTA CLOSE — the final sell, grows and holds
// =========================================================================
export const CTAClose: React.FC = () => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const GOLD = '#e8c877'
  const grow = 1 + interpolate(frame, [0, 90], [0, 0.08], { extrapolateRight: 'clamp', easing: Easing.out(Easing.quad) })
  const up = spring({ frame, fps, config: { damping: 20, stiffness: 70 } })
  const ctaUp = spring({ frame: frame - 22, fps, config: { damping: 16, stiffness: 110 } })
  const bloom = interpolate(frame, [0, 60], [0.1, 0.28], { extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ background: '#0a0f18' }}>
      <Backdrop file="proto-office2.jpg" grade="brightness(0.3) saturate(1) contrast(1.08)" />
      <AbsoluteFill style={{ background: `radial-gradient(60% 60% at 50% 46%, ${GOLD}${Math.round(bloom * 100).toString(16).padStart(2, '0')}, transparent 66%)` }} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', transform: `scale(${grow})` }}>
        <div style={{ fontFamily: PLAYFAIR, fontSize: 84, color: '#f4efe3', opacity: up, textShadow: '0 4px 40px rgba(0,0,0,0.7)' }}>Your future starts today.</div>
        <div style={{ fontFamily: MONT, fontWeight: 800, fontSize: 40, letterSpacing: '0.1em', color: GOLD, marginTop: 36, opacity: ctaUp, textTransform: 'uppercase' }}>Book Your Free Review</div>
        <div style={{ fontFamily: MONT, fontWeight: 700, fontSize: 28, letterSpacing: '0.18em', color: '#e9e3d5', marginTop: 18, opacity: ctaUp }}>meridianfinancial.com</div>
      </AbsoluteFill>
      <FilmFinish grain={0.05} letterbox />
    </AbsoluteFill>
  )
}
