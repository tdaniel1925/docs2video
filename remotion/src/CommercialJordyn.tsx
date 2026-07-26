import React from 'react'
import {
  AbsoluteFill, Sequence, Audio, Img, staticFile, useCurrentFrame, useVideoConfig,
  interpolate, spring, Easing,
} from 'remotion'
import { FilmGrade } from './cinematic/FilmGrade'
import { GlassPanel, type GPalette } from './cinematic/Glass'
import JORDYN_AUDIO from '../public/jordyn/durations.json'

/* ============================================================================
 * JORDYN — "A Brain for Your Business" · warm 30s commercial.
 * Palette from jordyn.app: cream #faf9f5, peach #e8b4a0, gold #e5d9a8, sage
 * #b6c4a2. Warm cinematic Gemini backdrops + conceptual UI mockups, glass +
 * film grade + Ken-Burns + cross-dissolves, Rachel VO + warm music bed. Every
 * claim grounded in the site (industry brain, morning briefing, self-building
 * pipeline, drafts in your voice, autopilot follow-ups, answers the phone).
 * ==========================================================================*/

const FPS = 30
const CREAM = '#faf9f5'
const INK = '#3a352e'           // warm dark ink for text on cream
const INK_SOFT = '#6b6459'
const PEACH = '#e8b4a0'         // soft peach (backgrounds/glows)
const GOLD = '#d9b24a'
const SAGE = '#8faa78'
// SATURATED accents for solid fills + legible accent text (the brand rust family)
const RUST = '#c4623f'          // the real Jordyn logo rust
const GOLD_D = '#c78a2a'        // deeper gold
const SAGE_D = '#6f8c58'        // deeper sage
const PANEL_DK = '#2c2721'      // warm near-black for dark scrims
const FONT = 'Archivo, Inter, system-ui, sans-serif'
const PAL: GPalette = { bg: PANEL_DK, accent: PEACH, accent2: GOLD, text: CREAM, muted: '#cbb8a6' }

const EASE = {
  expoOut: Easing.bezier(0.16, 1, 0.3, 1),
  backOut: Easing.bezier(0.34, 1.56, 0.64, 1),
  power: Easing.bezier(0.22, 1, 0.36, 1),
}
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))

// A soft readability plate behind a text group so copy always reads over busy
// Gemini imagery. `tone`: 'light' = cream veil (dark text), 'dark' = warm-dark veil (cream text).
const Plate: React.FC<{ children: React.ReactNode; tone?: 'light' | 'dark'; w?: number; pad?: string }> =
({ children, tone = 'dark', w, pad = '34px 58px' }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
    padding: pad, borderRadius: 20, width: w,
    // darker/stronger scrims so copy ALWAYS reads over bright Gemini imagery
    background: tone === 'dark' ? 'rgba(24,18,13,0.74)' : 'rgba(250,249,245,0.9)',
    backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
    boxShadow: tone === 'dark' ? '0 24px 70px rgba(0,0,0,0.5)' : '0 24px 70px rgba(150,110,80,0.35)',
    border: tone === 'dark' ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(200,150,110,0.35)',
  }}>{children}</div>
)

// All 8 backdrops are present (generated), so we render them directly. If Img
// fails to load, Remotion's onError below swaps to the CSS fallback — no fragile
// delayRender probe (which was timing out in headless render).
const useHasBg = (_i: number) => true

// warm backdrop with Ken-Burns; CSS cream fallback
const Backdrop: React.FC<{ i: number; focusX?: number; focusY?: number; dark?: boolean }> =
({ i, focusX = 50, focusY = 48, dark = false }) => {
  const f = useCurrentFrame(); const { durationInFrames } = useVideoConfig()
  const hasBg = useHasBg(i)
  const p = interpolate(f, [0, durationInFrames], [0, 1], { extrapolateRight: 'clamp', easing: EASE.expoOut })
  const scale = 1.08 + p * 0.08
  const tx = (50 - focusX) * p * 0.22, ty = (50 - focusY) * p * 0.22
  const drift = Math.sin(f * 0.011) * 5
  return (
    <AbsoluteFill style={{ background: CREAM, overflow: 'hidden' }}>
      {hasBg ? (
        <Img src={staticFile(`jordyn/bg-${i}.png`)} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale}) translate(${tx}%, ${ty}%)` }} />
      ) : (
        <AbsoluteFill style={{ background: `radial-gradient(60% 55% at ${34 + drift}% 34%, ${PEACH}44, transparent 60%), radial-gradient(56% 52% at ${70 - drift}% 72%, ${SAGE}33, transparent 62%), ${CREAM}` }} />
      )}
      {/* soft cream scrim top+bottom for text legibility on warm imagery */}
      <AbsoluteFill style={{ background: dark
        ? `linear-gradient(180deg, ${PANEL_DK}dd, transparent 34%, transparent 60%, ${PANEL_DK}ee)`
        : `linear-gradient(180deg, ${CREAM}dd, transparent 30%, transparent 60%, ${CREAM}ee)` }} />
      <AbsoluteFill style={{ boxShadow: dark ? 'inset 0 0 300px rgba(20,16,10,0.6)' : 'inset 0 0 260px rgba(180,150,120,0.28)' }} />
    </AbsoluteFill>
  )
}

const CountUp: React.FC<{ to: number; prefix?: string; suffix?: string; dur?: number; at?: number }> =
({ to, prefix = '', suffix = '', dur = 28, at = 0 }) => {
  const f = useCurrentFrame()
  const p = interpolate(f - at, [0, dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.power })
  return <>{prefix}{Math.round(to * p).toLocaleString('en-US')}{suffix}</>
}

// headline text with warm shadow; color defaults to warm ink (for cream bg)
const Line: React.FC<{ children: React.ReactNode; at?: number; size?: number; color?: string; weight?: number; onDark?: boolean; ls?: string }> =
({ children, at = 0, size = 88, color, weight = 900, onDark = false, ls = '-0.02em' }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const sp = spring({ frame: f - at, fps, config: { damping: 15, stiffness: 150, mass: 0.85 } })
  const o = interpolate(f - at, [0, 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const col = color || (onDark ? CREAM : INK)
  return (
    <div style={{
      fontFamily: FONT, fontWeight: weight, fontSize: size, lineHeight: 1.04, color: col, letterSpacing: ls, textAlign: 'center',
      transform: `translateY(${(1 - sp) * 26}px) scale(${0.94 + sp * 0.06})`, opacity: o,
      textShadow: onDark ? '0 3px 24px rgba(0,0,0,0.5)' : '0 2px 20px rgba(180,150,120,0.45)',
    }}>{children}</div>
  )
}

// Jordyn wordmark — the REAL brand logo (transparent PNG). Width-driven.
const Wordmark: React.FC<{ size?: number; onDark?: boolean }> = ({ size = 108 }) => (
  <Img src={staticFile('jordyn/logo.png')} style={{ width: size * 4.2, height: 'auto', display: 'block', filter: 'drop-shadow(0 6px 24px rgba(150,90,60,0.28))' }} />
)

// SOLID-FILL chip: accent background, white text — reads on ANY backdrop.
const Chip: React.FC<{ children: React.ReactNode; at: number; accent?: string }> = ({ children, at, accent = SAGE }) => {
  const f = useCurrentFrame()
  const p = interpolate(f - at, [0, 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.backOut })
  return (
    <div style={{
      fontFamily: FONT, fontWeight: 800, fontSize: 30, color: '#fff', padding: '15px 32px',
      borderRadius: 10, background: accent, whiteSpace: 'nowrap',
      transform: `translateY(${(1 - p) * 38}px) scale(${0.9 + p * 0.1})`, opacity: clamp(p),
      boxShadow: `0 8px 26px ${accent}66, inset 0 1px 0 rgba(255,255,255,0.25)`,
      textShadow: '0 1px 3px rgba(0,0,0,0.25)',
    }}>{children}</div>
  )
}

/* ============================ SCENES ====================================== */

// 0) BLANK BOX — every other AI starts here
const S_Pain: React.FC = () => {
  const f = useCurrentFrame()
  const cursor = Math.sin(f * 0.2) > 0 ? 1 : 0.15   // blinking cursor
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <Backdrop i={0} focusX={40} dark />
      <Plate tone="dark" pad="40px 64px">
        <Line at={2} size={52} color="#d8c9b8" weight={700} onDark>Every other AI agent:</Line>
        {/* an empty prompt box with a blinking cursor */}
        <div style={{ marginTop: 8, width: 720, height: 96, borderRadius: 14, background: 'rgba(255,255,255,0.08)', border: '2px solid rgba(255,255,255,0.28)', display: 'flex', alignItems: 'center', paddingLeft: 26 }}>
          <div style={{ width: 3, height: 44, background: CREAM, opacity: cursor }} />
          <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 30, color: 'rgba(240,235,225,0.4)', marginLeft: 14 }}>Ask me anything…</div>
        </div>
        <Line at={16} size={40} color="#c9bcab" weight={700} onDark>A blank box. Waiting on you.</Line>
      </Plate>
    </AbsoluteFill>
  )
}

// a red ✕ row (the work other AI makes you do)
const CrossRow: React.FC<{ text: string; at: number }> = ({ text, at }) => {
  const f = useCurrentFrame()
  const p = interpolate(f - at, [0, 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.backOut })
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, opacity: clamp(p), transform: `translateX(${(1 - p) * -40}px)` }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: '#b04a3a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 22, color: '#fff' }}>✕</div>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 46, color: '#e8ddce', textShadow: '0 2px 14px rgba(0,0,0,0.5)' }}>{text}</div>
    </div>
  )
}

// 1) YOU OPERATE — the work THEY make you do
const S_Turn: React.FC = () => (
  <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
    <Backdrop i={1} dark />
    <Plate tone="dark" pad="42px 66px">
      <Line at={2} size={56} color={CREAM} weight={900} onDark>So you do the work.</Line>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
        {['You prompt it', 'You train it', 'You babysit it'].map((t, k) => (
          <CrossRow key={k} text={t} at={12 + k * 9} />
        ))}
      </div>
    </Plate>
  </AbsoluteFill>
)

// 2) THE TURN — Jordyn is different
const S_Brain: React.FC = () => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const sp = spring({ frame: f - 2, fps, config: { damping: 13, stiffness: 150 } })
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <Backdrop i={2} focusY={44} />
      <Plate tone="light" pad="44px 70px">
        <div style={{ transform: `scale(${interpolate(sp, [0, 1], [0.7, 1])})`, opacity: clamp(sp), display: 'flex', alignItems: 'center', gap: 18 }}>
          <Img src={staticFile('jordyn/logo.png')} style={{ height: 92, width: 'auto', filter: 'drop-shadow(0 4px 16px rgba(150,90,60,0.3))' }} />
          <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 76, color: INK, letterSpacing: '-0.02em' }}>is different.</div>
        </div>
      </Plate>
    </AbsoluteFill>
  )
}

// 3) FLUENT — arrives already knowing your world (solid chips)
const S_Fluent: React.FC = () => (
  <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
    <Backdrop i={3} dark />
    <Plate tone="dark" pad="40px 66px">
      <Line at={2} size={58} color={CREAM} weight={900} onDark>It arrives already fluent.</Line>
      <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
        {['The vocabulary', 'The paperwork', 'The deadlines'].map((t, k) => (
          <Chip key={k} at={12 + k * 8} accent={[RUST, GOLD_D, SAGE_D][k]}>{t}</Chip>
        ))}
      </div>
    </Plate>
  </AbsoluteFill>
)

// 4) MORNING BRIEFING — conceptual UI + label
const S_Briefing: React.FC = () => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const sp = spring({ frame: f - 6, fps, config: { damping: 18, stiffness: 120 } })
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 26 }}>
      <Backdrop i={4} focusX={40} dark />
      <Plate tone="dark" pad="38px 62px">
        <div style={{ opacity: clamp(sp), transform: `translateY(${(1 - sp) * 18}px)`, fontFamily: FONT, fontWeight: 800, fontSize: 28, letterSpacing: '0.16em', color: PEACH, textTransform: 'uppercase', marginBottom: 6 }}>Then it learns you</div>
        <Line at={16} size={56} color={CREAM} weight={900} onDark>It reads your inbox —</Line>
        <Line at={22} size={44} color="#e8ddce" weight={700} onDark>your clients, your deals, your voice.</Line>
      </Plate>
    </AbsoluteFill>
  )
}

// 5) THE WORK — 3 capabilities
const S_Work: React.FC = () => (
  <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
    <Backdrop i={5} dark />
    <Plate tone="dark" pad="40px 68px">
      <Line at={2} size={54} color={CREAM} weight={900} onDark>No prompting. It just works.</Line>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 14 }}>
        {['Morning briefings, ready', 'A pipeline that builds itself', 'Replies in your voice'].map((t, k) => {
          const at = 12 + k * 12
          return <ChipRow key={k} text={t} at={at} accent={[RUST, GOLD_D, SAGE_D][k]} />
        })}
      </div>
    </Plate>
  </AbsoluteFill>
)
const ChipRow: React.FC<{ text: string; at: number; accent: string }> = ({ text, at, accent }) => {
  const f = useCurrentFrame()
  const p = interpolate(f - at, [0, 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.backOut })
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, opacity: clamp(p), transform: `translateX(${(1 - p) * -46}px)` }}>
      <div style={{ width: 40, height: 40, borderRadius: 11, background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 22, color: CREAM, boxShadow: `0 4px 18px ${accent}66` }}>✓</div>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 48, color: CREAM, textShadow: '0 2px 16px rgba(0,0,0,0.45)' }}>{text}</div>
    </div>
  )
}

// 6) PHONE — the NEW hook
const S_Phone: React.FC = () => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const sp = spring({ frame: f - 4, fps, config: { damping: 14, stiffness: 130 } })
  const ring = 1 + Math.sin(f * 0.25) * 0.03
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 24 }}>
      <Backdrop i={6} focusY={42} dark />
      <div style={{ transform: `scale(${interpolate(sp, [0, 1], [0.8, 1]) * ring})`, opacity: clamp(sp), marginBottom: 8 }}>
        <div style={{ width: 120, height: 120, borderRadius: '50%', background: `linear-gradient(145deg, ${SAGE_D}, ${GOLD_D})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 58, boxShadow: `0 0 70px ${SAGE_D}` }}>📞</div>
      </div>
      <Plate tone="dark">
        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 26, letterSpacing: '0.22em', color: PEACH, textTransform: 'uppercase', marginBottom: 4, opacity: interpolate(f, [0, 14], [0, 1], { extrapolateRight: 'clamp' }) }}>New</div>
        <Line at={12} size={58} color={CREAM} weight={900} onDark>It answers your phone.</Line>
        <Line at={20} size={44} color="#e8ddce" weight={700} onDark>And makes your calls.</Line>
      </Plate>
    </AbsoluteFill>
  )
}

// 7) CTA
const S_CTA: React.FC = () => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const sp = spring({ frame: f - 2, fps, config: { damping: 14, stiffness: 150 } })
  const tag = interpolate(f, [16, 32], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut })
  const btn = interpolate(f, [28, 44], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.backOut })
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 26 }}>
      <Backdrop i={7} focusY={58} />
      <Plate tone="light" pad="46px 72px">
        <div style={{ transform: `scale(${interpolate(sp, [0, 1], [0.74, 1])})`, opacity: clamp(sp) }}><Wordmark size={108} /></div>
        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 36, color: INK_SOFT, opacity: tag, transform: `translateY(${(1 - tag) * 16}px)`, marginTop: 8, textAlign: 'center', lineHeight: 1.25 }}>
          Not a tool you operate.<br /><span style={{ color: INK }}>An assistant that works.</span>
        </div>
        <div style={{ opacity: clamp(btn), transform: `translateY(${(1 - clamp(btn)) * 12}px)`, marginTop: 16, fontFamily: FONT, fontWeight: 900, fontSize: 46, color: RUST, letterSpacing: '-0.01em' }}>
          jordyn.app
        </div>
      </Plate>
    </AbsoluteFill>
  )
}

/* ============================ TIMELINE ==================================== */
const S = (sec: number) => Math.round(sec * FPS)
const COMPS = [S_Pain, S_Turn, S_Brain, S_Fluent, S_Briefing, S_Work, S_Phone, S_CTA]
const DARK = [true, true, false, true, true, true, true, false]
const PAD = 0.75
const XF = 0.4
const FALLBACK = [4.6, 4.4, 3.4, 4.0, 4.2, 5.2, 3.2, 5.0]
const vo: number[] = (JORDYN_AUDIO && (JORDYN_AUDIO as any).vo) || FALLBACK
const SEG = COMPS.map((c, i) => ({ c, d: (vo[i] || FALLBACK[i]) + PAD }))
const _sumD = SEG.reduce((a, s) => a + s.d, 0)
export const JORDYN_FRAMES = Math.round((_sumD - (SEG.length - 1) * XF) * FPS)

const Dissolve: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => {
  const f = useCurrentFrame(); const xf = S(XF)
  const inO = interpolate(f, [0, xf], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const outO = interpolate(f, [dur - xf, dur], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return <AbsoluteFill style={{ opacity: Math.min(inO, outO) }}>{children}</AbsoluteFill>
}

export const CommercialJordyn: React.FC = () => {
  let cursor = 0
  const starts = SEG.map((seg, i) => { const from = S(cursor); cursor += seg.d - (i < SEG.length - 1 ? XF : 0); return from })
  return (
    <AbsoluteFill style={{ background: CREAM }}>
      {/* real ElevenLabs music bed — audible under the VO (ducked but present) */}
      <Audio src={staticFile('jordyn/music.mp3')} volume={0.42} />
      {SEG.map((seg, i) => {
        const Comp = seg.c
        const durF = S(seg.d)
        return (
          <Sequence key={i} from={starts[i]} durationInFrames={durF + 2}>
            <Dissolve dur={durF}><Comp /></Dissolve>
            <FilmGrade accent={DARK[i] ? PEACH : GOLD} intensity={DARK[i] ? 0.7 : 0.4} />
            <Sequence from={Math.round(0.18 * FPS)}>
              <Audio src={staticFile(`jordyn/vo-${i}.mp3`)} volume={1} />
            </Sequence>
          </Sequence>
        )
      })}
    </AbsoluteFill>
  )
}
