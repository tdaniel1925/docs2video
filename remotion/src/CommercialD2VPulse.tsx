import React from 'react'
import {
  AbsoluteFill, Sequence, Audio, Img, staticFile, useCurrentFrame, useVideoConfig,
  interpolate, spring, Easing, continueRender, delayRender,
} from 'remotion'
import { FilmGrade } from './cinematic/FilmGrade'
import { GlassPanel, LowerThird, type GPalette } from './cinematic/Glass'
import PULSE_AUDIO from '../public/d2v-pulse/durations.json'

/* ============================================================================
 * DOCS2VIDEO — "PULSE"  ·  full-production 30s ad.
 * Cinematic Gemini backdrops (Ken-Burns push) + glass depth + FilmGrade finish
 * + cross-dissolves, Rachel (ElevenLabs) VO + music bed. Every claim grounded in
 * the codebase: 12 industries (industries.ts), $0/2-free (pricing.ts), brand
 * match (brand-scraper), share page + analytics (watch + analytics), API/MCP,
 * deck/PDF export. Scenes gracefully fall back to a CSS backdrop if a bg-*.png
 * is absent, so the render never blocks on a missing asset.
 * ==========================================================================*/

const FPS = 30
const BG = '#080b12'
const INK = '#f4f6fb'
const MUTE = '#8493ad'
const TEAL = '#12c2b4'
const TEALHI = '#6ff2e6'
const AMBER = '#ffb648'
const FONT = 'Archivo, Inter, system-ui, sans-serif'
const PAL: GPalette = { bg: BG, accent: TEAL, accent2: TEALHI, text: INK, muted: MUTE }

const EASE = {
  expoOut: Easing.bezier(0.16, 1, 0.3, 1),
  backOut: Easing.bezier(0.34, 1.56, 0.64, 1),
  power: Easing.bezier(0.22, 1, 0.36, 1),
}
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))

/* ---- which scenes have a Gemini backdrop (probed at mount) ---------------- */
const useHasBg = (i: number) => {
  const [ok, setOk] = React.useState(false)
  const [handle] = React.useState(() => delayRender(`bg-${i}`))
  React.useEffect(() => {
    let done = false
    fetch(staticFile(`d2v-pulse/bg-${i}.png`), { method: 'HEAD' })
      .then((r) => { if (!done) setOk(r.ok) })
      .catch(() => {})
      .finally(() => { if (!done) continueRender(handle) })
    return () => { done = true }
  }, [handle])
  return ok
}

/* ---- backdrop: Gemini photo with slow Ken-Burns, else living CSS ---------- */
const Backdrop: React.FC<{ i: number; tint?: string; focusX?: number; focusY?: number }> =
({ i, tint = TEAL, focusX = 50, focusY = 46 }) => {
  const f = useCurrentFrame(); const { durationInFrames } = useVideoConfig()
  const hasBg = useHasBg(i)
  const p = interpolate(f, [0, durationInFrames], [0, 1], { extrapolateRight: 'clamp', easing: EASE.expoOut })
  const scale = 1.08 + p * 0.09
  const tx = (50 - focusX) * p * 0.25, ty = (50 - focusY) * p * 0.25
  const drift = Math.sin(f * 0.012) * 5
  return (
    <AbsoluteFill style={{ background: BG, overflow: 'hidden' }}>
      {hasBg ? (
        <Img src={staticFile(`d2v-pulse/bg-${i}.png`)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale}) translate(${tx}%, ${ty}%)` }} />
      ) : (
        <>
          <AbsoluteFill style={{
            background: `radial-gradient(62% 56% at ${30 + drift}% 36%, ${tint}26, transparent 60%),
                         radial-gradient(56% 52% at ${72 - drift}% 70%, #2b47b033, transparent 62%)`,
          }} />
          <AbsoluteFill style={{
            backgroundImage: `linear-gradient(${MUTE}0d 1px, transparent 1px), linear-gradient(90deg, ${MUTE}0d 1px, transparent 1px)`,
            backgroundSize: '68px 68px', transform: `translateY(${(f * 0.4) % 68}px)`,
            maskImage: 'radial-gradient(75% 75% at 50% 45%, #000 40%, transparent 85%)',
          }} />
        </>
      )}
      {/* legibility scrim so text always reads over the photo */}
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${BG}cc 0%, transparent 30%, transparent 62%, ${BG}dd 100%)` }} />
      <AbsoluteFill style={{ boxShadow: 'inset 0 0 320px rgba(0,0,0,0.66)' }} />
    </AbsoluteFill>
  )
}

/* ---- count-up ------------------------------------------------------------- */
const CountUp: React.FC<{ to: number; prefix?: string; suffix?: string; dur?: number; at?: number }> =
({ to, prefix = '', suffix = '', dur = 28, at = 0 }) => {
  const f = useCurrentFrame()
  const p = interpolate(f - at, [0, dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.power })
  return <>{prefix}{Math.round(to * p).toLocaleString('en-US')}{suffix}</>
}

/* ---- word that slams in --------------------------------------------------- */
const Slam: React.FC<{ children: React.ReactNode; at?: number; color?: string; size?: number; weight?: number; ls?: string }> =
({ children, at = 0, color = INK, size = 150, weight = 900, ls = '-0.03em' }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const sp = spring({ frame: f - at, fps, config: { damping: 13, stiffness: 165, mass: 0.8 } })
  const o = interpolate(f - at, [0, 6], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const blur = interpolate(f - at, [0, 9], [14, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <div style={{
      fontFamily: FONT, fontWeight: weight, fontSize: size, lineHeight: 0.98, color,
      letterSpacing: ls, textAlign: 'center', textTransform: 'uppercase',
      transform: `scale(${interpolate(sp, [0, 1], [0.62, 1])})`, opacity: o, filter: `blur(${blur}px)`,
      textShadow: `0 4px 40px rgba(0,0,0,0.6), 0 0 60px ${color}22`,
    }}>{children}</div>
  )
}

/* ---- logo wordmark -------------------------------------------------------- */
const Wordmark: React.FC<{ size?: number; mark?: number }> = ({ size = 104, mark = 88 }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
    <div style={{ width: mark, height: mark, borderRadius: mark * 0.19, background: `linear-gradient(135deg, ${TEAL}, ${TEALHI})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 60px ${TEAL}66, inset 0 2px 10px rgba(255,255,255,0.3)` }}>
      <div style={{ width: 0, height: 0, borderTop: `${mark * 0.24}px solid transparent`, borderBottom: `${mark * 0.24}px solid transparent`, borderLeft: `${mark * 0.36}px solid ${BG}`, marginLeft: mark * 0.09 }} />
    </div>
    <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: size, letterSpacing: '-0.03em', color: INK, textShadow: '0 4px 30px rgba(0,0,0,0.6)' }}>
      docs<span style={{ color: TEAL }}>2</span>video
    </div>
  </div>
)

const chipAccents = [TEAL, TEALHI, AMBER, TEAL, TEALHI, AMBER]
const Chip: React.FC<{ children: React.ReactNode; at: number; accent?: string }> = ({ children, at, accent = TEAL }) => {
  const f = useCurrentFrame()
  const p = interpolate(f - at, [0, 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.backOut })
  return (
    <div style={{
      fontFamily: FONT, fontWeight: 800, fontSize: 30, color: INK, padding: '15px 30px',
      border: `2px solid ${accent}`, borderRadius: 10, background: `${accent}18`, backdropFilter: 'blur(6px)',
      transform: `translateY(${(1 - p) * 40}px) scale(${0.9 + p * 0.1})`, opacity: clamp(p),
      whiteSpace: 'nowrap', boxShadow: `0 0 40px ${accent}22`,
    }}>{children}</div>
  )
}

/* ============================ SCENES ====================================== */

// 0) HOOK
const S_Hook: React.FC = () => {
  const f = useCurrentFrame()
  const flash = interpolate(f, [0, 5], [1, 0], { extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 16 }}>
      <Backdrop i={0} tint={AMBER} />
      <Slam at={2} size={78} color={MUTE} weight={800}>Your best ideas are</Slam>
      <Slam at={16} size={150} color={INK}>stuck&nbsp;in&nbsp;docs.</Slam>
      <AbsoluteFill style={{ background: '#fff', opacity: flash * 0.45, pointerEvents: 'none' }} />
    </AbsoluteFill>
  )
}

// 1) BRAND
const S_Brand: React.FC = () => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const sp = spring({ frame: f - 2, fps, config: { damping: 14, stiffness: 150 } })
  const bar = interpolate(f, [12, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut })
  const line = interpolate(f, [22, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut })
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 28 }}>
      <Backdrop i={1} focusX={50} focusY={50} />
      <div style={{ transform: `scale(${interpolate(sp, [0, 1], [0.7, 1])})`, opacity: clamp(sp) }}><Wordmark /></div>
      <div style={{ width: interpolate(bar, [0, 1], [0, 560]), height: 3, background: `linear-gradient(90deg, transparent, ${TEAL}, transparent)` }} />
      <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 42, color: '#c3cede', opacity: line, transform: `translateY(${(1 - line) * 20}px)`, textShadow: '0 2px 12px rgba(0,0,0,0.9), 0 0 30px rgba(0,0,0,0.7)', padding: '10px 28px', borderRadius: 10, background: 'rgba(8,11,18,0.42)', backdropFilter: 'blur(4px)' }}>
        Any document → a <span style={{ color: INK }}>branded, narrated video.</span>
      </div>
    </AbsoluteFill>
  )
}

// 2) INPUT — three source chips
const S_Input: React.FC = () => {
  const f = useCurrentFrame()
  const title = interpolate(f, [2, 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut })
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 40 }}>
      <Backdrop i={2} focusX={20} />
      <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 68, color: INK, opacity: title, transform: `translateY(${(1 - title) * 24}px)`, textShadow: '0 3px 24px rgba(0,0,0,0.6)' }}>
        Start with anything.
      </div>
      <div style={{ display: 'flex', gap: 22 }}>
        {[['🔗', 'A link'], ['📄', 'A file'], ['✏️', 'A few notes']].map(([ic, label], k) => {
          const at = 12 + k * 8
          return (
            <div key={k} style={{ opacity: 1 }}>
              <GlassPanel at={at} style="vivid" palette={PAL} pad={34}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, minWidth: 220 }}>
                  <div style={{ fontSize: 56 }}>{ic}</div>
                  <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 32, color: INK }}>{label}</div>
                </div>
              </GlassPanel>
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}

// 3) AI WRITES — process line
const S_AI: React.FC = () => {
  const f = useCurrentFrame()
  const items = ['Writes the script', 'Matches your brand', 'Narrates it aloud']
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 30 }}>
      <Backdrop i={3} focusX={60} />
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 30, letterSpacing: '0.2em', color: TEALHI, textTransform: 'uppercase', opacity: interpolate(f, [0, 12], [0, 1], { extrapolateRight: 'clamp' }) }}>The AI does the work</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {items.map((t, k) => {
          const at = 10 + k * 14
          const p = interpolate(f - at, [0, 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.backOut })
          return (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 20, opacity: clamp(p), transform: `translateX(${(1 - p) * -50}px)` }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${TEAL}, ${TEALHI})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 24, color: BG, boxShadow: `0 0 24px ${TEAL}55` }}>✓</div>
              <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 52, color: INK, textShadow: '0 2px 18px rgba(0,0,0,0.6)' }}>{t}</div>
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}

// 4) PROOF — count-up stats in glass
const Stat: React.FC<{ big: React.ReactNode; label: string; at: number; accent: string }> = ({ big, label, at, accent }) => (
  <GlassPanel at={at} style="subtle" palette={PAL} pad={40}>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 300 }}>
      <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 128, lineHeight: 1, color: accent, letterSpacing: '-0.03em', textShadow: `0 0 60px ${accent}44` }}>{big}</div>
      <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 28, color: MUTE, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
    </div>
  </GlassPanel>
)
const S_Proof: React.FC = () => (
  <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 40 }}>
    <Backdrop i={4} />
    <Stat big={<CountUp to={12} at={6} />} label="Industries tuned" at={4} accent={TEAL} />
    <Stat big={<CountUp to={4} prefix="~" suffix=" min" at={12} />} label="File to film" at={12} accent={TEALHI} />
    <Stat big={<CountUp to={0} prefix="$" at={18} />} label="To start" at={20} accent={AMBER} />
  </AbsoluteFill>
)

// 5) FEATURES — share + export chips
const S_Features: React.FC = () => {
  const f = useCurrentFrame()
  const title = interpolate(f, [2, 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut })
  const chips = ['Share page + analytics', 'Brand-matched', 'AI voiceover', 'Decks & PDFs', 'Compliance-safe']
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 30 }}>
      <Backdrop i={5} />
      <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 62, color: INK, opacity: title, transform: `translateY(${(1 - title) * 22}px)`, textShadow: '0 3px 24px rgba(0,0,0,0.6)' }}>Share it. Track it. Export it.</div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 1180 }}>
        {chips.map((c, k) => <Chip key={k} at={10 + k * 7} accent={chipAccents[k % chipAccents.length]}>{c}</Chip>)}
      </div>
    </AbsoluteFill>
  )
}

// 6) API — automation
const S_API: React.FC = () => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const sp = spring({ frame: f - 4, fps, config: { damping: 15, stiffness: 130 } })
  const sub = interpolate(f, [20, 36], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut })
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 26 }}>
      <Backdrop i={6} />
      <div style={{ opacity: clamp(sp), transform: `scale(${interpolate(sp, [0, 1], [0.8, 1])})` }}>
        <GlassPanel at={4} style="vivid" palette={PAL} pad={44}>
          <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 40, color: TEALHI, letterSpacing: '0.02em' }}>
            <span style={{ color: MUTE }}>POST</span> /v1/videos
          </div>
        </GlassPanel>
      </div>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 46, color: INK, opacity: sub, transform: `translateY(${(1 - sub) * 18}px)`, textShadow: '0 2px 18px rgba(0,0,0,0.6)' }}>
        An API + MCP — videos on <span style={{ color: TEAL }}>autopilot.</span>
      </div>
    </AbsoluteFill>
  )
}

// 7) CTA
const S_CTA: React.FC = () => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const sp = spring({ frame: f - 2, fps, config: { damping: 13, stiffness: 150 } })
  const flash = interpolate(f, [0, 6], [0.8, 0], { extrapolateRight: 'clamp' })
  const url = interpolate(f, [18, 32], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut })
  const btn = interpolate(f, [28, 44], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.backOut })
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 30 }}>
      <Backdrop i={7} focusY={60} />
      <div style={{ transform: `scale(${interpolate(sp, [0, 1], [0.72, 1])})`, opacity: clamp(sp) }}><Wordmark size={96} mark={82} /></div>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 48, color: TEALHI, opacity: url, transform: `translateY(${(1 - url) * 16}px)`, textShadow: '0 2px 18px rgba(0,0,0,0.6)' }}>docs2video.com</div>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 30, color: BG, background: `linear-gradient(90deg, ${TEAL}, ${TEALHI})`, padding: '18px 42px', borderRadius: 10, opacity: clamp(btn), transform: `scale(${0.9 + clamp(btn) * 0.1})`, boxShadow: `0 0 50px ${TEAL}66` }}>
        Start free — 2 videos on us
      </div>
      <AbsoluteFill style={{ background: '#fff', opacity: flash * 0.5, pointerEvents: 'none' }} />
    </AbsoluteFill>
  )
}

/* ============================ TIMELINE ==================================== */
const S = (sec: number) => Math.round(sec * FPS)
const COMPS = [S_Hook, S_Brand, S_Input, S_AI, S_Proof, S_Features, S_API, S_CTA]
const PAD = 0.7
const XF = 0.4 // cross-dissolve seconds
const FALLBACK = [4.0, 2.4, 3.6, 6.2, 5.4, 6.6, 5.4, 5.2]
const vo: number[] = (PULSE_AUDIO && (PULSE_AUDIO as any).vo) || FALLBACK
const SEG = COMPS.map((c, i) => ({ c, d: (vo[i] || FALLBACK[i]) + PAD }))
// total = sum of scene durations MINUS the cross-fade overlaps (each adjacent
// pair overlaps by XF), so there's no black tail after the last scene.
const _sumD = SEG.reduce((a, s) => a + s.d, 0)
export const D2V_PULSE_FRAMES = Math.round((_sumD - (SEG.length - 1) * XF) * FPS)

const Dissolve: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => {
  const f = useCurrentFrame()
  const xf = S(XF)
  const inO = interpolate(f, [0, xf], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const outO = interpolate(f, [dur - xf, dur], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return <AbsoluteFill style={{ opacity: Math.min(inO, outO) }}>{children}</AbsoluteFill>
}

export const CommercialD2VPulse: React.FC = () => {
  let cursor = 0
  // overlap each scene by the cross-fade so dissolves blend (no black gap)
  const starts = SEG.map((seg, i) => { const from = S(cursor); cursor += seg.d - (i < SEG.length - 1 ? XF : 0); return from })
  return (
    <AbsoluteFill style={{ background: BG }}>
      <Audio src={staticFile('d2v-pulse/music.mp3')} volume={0.2} />
      {SEG.map((seg, i) => {
        const Comp = seg.c
        const durF = S(seg.d)
        return (
          <Sequence key={i} from={starts[i]} durationInFrames={durF + 2}>
            <Dissolve dur={durF}>
              <Comp />
            </Dissolve>
            {/* one film grade over ALL scenes for cohesion (inside the fade) */}
            <FilmGrade accent={TEAL} intensity={0.85} />
            <Sequence from={Math.round(0.18 * FPS)}>
              <Audio src={staticFile(`d2v-pulse/vo-${i}.mp3`)} volume={1} />
            </Sequence>
          </Sequence>
        )
      })}
    </AbsoluteFill>
  )
}
