import React from 'react'
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing, Sequence, Img, staticFile, spring, Audio } from 'remotion'
import { MusicBed } from './lib/musicbed'
import { makeMusicDuck, type VoWindow } from './lib/audio'
import { loadFont as loadArchivoBlack } from '@remotion/google-fonts/ArchivoBlack'
import { loadFont as loadArchivo } from '@remotion/google-fonts/Archivo'

/* ============================================================================
 * ApexVox — a VOX-STYLE explainer ad. Motion-graphic ANNOTATIONS layered over
 * neutral documentary footage: hand-drawn circles + arrows that draw ON, highlight
 * sweeps over key phrases, callout labels that point at things, animated bar/line
 * charts, big stat reveals — all tightly synced to the VO. Bold sans, one strong
 * accent (Vox yellow) + brand red. Explanatory, not sales-y.
 * ==========================================================================*/

const { fontFamily: BLACK } = loadArchivoBlack()
const { fontFamily: SANS } = loadArchivo()
const FPS = 30
const INK = '#141618', PAPER = '#faf8f3', YELLOW = '#f7c948', RED = '#d81f27', NAVY = '#16305e', BLUE = '#2f6df6'
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const ASSET = 'c-apexVOX', LOGO = 'c-apexTORN'

// footage with a slow Vox-style push + a slight desat/darken so annotations pop
const Footage: React.FC<{ src: string; dur: number; focus?: string; dim?: number }> = ({ src, dur, focus = '50% 50%', dim = 0.32 }) => {
  const frame = useCurrentFrame()
  const sc = interpolate(frame, [0, dur], [1.06, 1.15], { extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: '#000' }}>
      <Img src={staticFile(src)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: focus, transform: `scale(${sc})`, filter: 'saturate(0.85) contrast(1.02)' }} />
      <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(10,12,16,${dim * 0.7}), rgba(10,12,16,${dim}))` }} />
    </AbsoluteFill>
  )
}

// ---- ANNOTATION PRIMITIVES (the Vox toolkit) ----

// a hand-drawn ellipse that DRAWS ON around a region (stroke-dashoffset reveal)
const CircleAt: React.FC<{ at: number; x: number; y: number; w: number; h: number; color?: string; wobble?: number }> = ({ at, x, y, w, h, color = YELLOW, wobble = 0 }) => {
  const frame = useCurrentFrame()
  const p = clamp((frame - at) / 16, 0, 1)
  const C = 2 * Math.PI * ((w + h) / 4) * 1.15
  const rot = -6 + wobble
  return (
    <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <ellipse cx={x} cy={y} rx={w / 2} ry={h / 2} fill="none" stroke={color} strokeWidth={7} strokeLinecap="round"
        transform={`rotate(${rot} ${x} ${y})`} strokeDasharray={C} strokeDashoffset={C * (1 - p)} style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))' }} />
    </svg>
  )
}

// an arrow that draws from A to B (line + head)
const Arrow: React.FC<{ at: number; x1: number; y1: number; x2: number; y2: number; color?: string }> = ({ at, x1, y1, x2, y2, color = RED }) => {
  const frame = useCurrentFrame()
  const p = clamp((frame - at) / 14, 0, 1)
  const cx = x1 + (x2 - x1) * p, cy = y1 + (y2 - y1) * p
  const ang = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI
  return (
    <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <line x1={x1} y1={y1} x2={cx} y2={cy} stroke={color} strokeWidth={7} strokeLinecap="round" style={{ filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.5))' }} />
      {p > 0.9 && <g transform={`translate(${x2} ${y2}) rotate(${ang})`} style={{ filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.5))' }}>
        <path d="M 0 0 L -26 -12 L -20 0 L -26 12 Z" fill={color} />
      </g>}
    </svg>
  )
}

// a callout label (chip) that pops next to an annotation
const Callout: React.FC<{ at: number; x: number; y: number; text: string; color?: string; fg?: string; anchor?: 'l' | 'r' | 'c' }> = ({ at, x, y, text, color = YELLOW, fg = INK, anchor = 'l' }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const s = spring({ frame: frame - at, fps, config: { damping: 12, stiffness: 220 } })
  if (frame < at) return null
  const tx = anchor === 'r' ? '-100%' : anchor === 'c' ? '-50%' : '0'
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: `translateX(${tx}) scale(${clamp(s, 0, 1.05)})`, transformOrigin: anchor === 'r' ? 'right center' : 'left center', background: color, color: fg, fontFamily: BLACK, fontSize: 30, padding: '12px 20px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: '0.01em', boxShadow: '0 6px 18px rgba(0,0,0,0.4)', whiteSpace: 'nowrap' }}>{text}</div>
  )
}

// a lower-third title bar with a highlight-swept keyword (the Vox headline device)
const LowerBar: React.FC<{ at: number; pre: string; hot: string; post?: string; hi?: string }> = ({ at, pre, hot, post = '', hi = YELLOW }) => {
  const frame = useCurrentFrame()
  const o = clamp((frame - at) / 8, 0, 1)
  const sweep = clamp((frame - at - 8) / 12, 0, 1)   // highlight sweeps across the hot word
  return (
    <div style={{ position: 'absolute', left: 90, bottom: 96, maxWidth: 1500, opacity: o, transform: `translateY(${(1 - o) * 24}px)` }}>
      <div style={{ display: 'inline-block', background: 'rgba(10,12,16,0.72)', padding: '18px 26px', borderLeft: `8px solid ${RED}`, borderRadius: 4 }}>
        <span style={{ fontFamily: BLACK, fontSize: 62, color: PAPER, lineHeight: 1.05 }}>
          {pre}
          <span style={{ position: 'relative', display: 'inline-block', padding: '0 6px', color: INK }}>
            <span style={{ position: 'absolute', left: 0, top: '12%', bottom: '12%', width: `${sweep * 100}%`, background: hi, zIndex: 0, borderRadius: 3 }} />
            <span style={{ position: 'relative', zIndex: 1, color: sweep > 0.3 ? INK : PAPER, transition: 'color 0.1s' }}>{hot}</span>
          </span>
          {post}
        </span>
      </div>
    </div>
  )
}

// an animated bar chart that grows (data-reveal)
const BarChart: React.FC<{ at: number; x: number; y: number; bars: { label: string; v: number; color: string }[]; w?: number; h?: number }> = ({ at, x, y, bars, w = 620, h = 300 }) => {
  const frame = useCurrentFrame()
  const max = Math.max(...bars.map((b) => b.v))
  const bw = w / bars.length
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, height: h + 60 }}>
      {bars.map((b, i) => {
        const on = clamp((frame - at - i * 6) / 14, 0, 1)
        const bh = (b.v / max) * h * on
        return (
          <div key={i} style={{ position: 'absolute', left: i * bw, bottom: 50, width: bw - 22, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontFamily: BLACK, fontSize: 26, color: PAPER, marginBottom: 6, opacity: on }}>{Math.round(b.v * on)}</div>
            <div style={{ width: '100%', height: bh, background: b.color, borderRadius: '4px 4px 0 0' }} />
          </div>
        )
      })}
      {bars.map((b, i) => (
        <div key={'l' + i} style={{ position: 'absolute', left: i * bw, bottom: 0, width: bw - 22, textAlign: 'center', fontFamily: SANS, fontWeight: 700, fontSize: 18, color: '#c9cdd4', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: clamp((frame - at) / 12, 0, 1) }}>{b.label}</div>
      ))}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 48, height: 2, background: 'rgba(255,255,255,0.25)' }} />
    </div>
  )
}

// a big stat that counts up + a label (the Vox "number moment")
const BigStat: React.FC<{ at: number; x: number; y: number; value: number; prefix?: string; suffix?: string; label: string; color?: string }> = ({ at, x, y, value, prefix = '', suffix = '', label, color = YELLOW }) => {
  const frame = useCurrentFrame()
  const p = clamp((frame - at) / 20, 0, 1)
  const n = Math.round(value * p)
  return (
    <div style={{ position: 'absolute', left: x, top: y }}>
      <div style={{ fontFamily: BLACK, fontSize: 200, lineHeight: 0.9, color, textShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>{prefix}{n.toLocaleString()}{suffix}</div>
      <div style={{ fontFamily: BLACK, fontSize: 40, color: PAPER, textTransform: 'uppercase', letterSpacing: '0.02em', marginTop: 4 }}>{label}</div>
    </div>
  )
}

// small kicker top-left (Vox always frames the segment)
const Kicker: React.FC<{ text: string }> = ({ text }) => (
  <div style={{ position: 'absolute', top: 60, left: 90, background: RED, color: PAPER, fontFamily: BLACK, fontSize: 24, padding: '10px 18px', textTransform: 'uppercase', letterSpacing: '0.08em', borderRadius: 4 }}>{text}</div>
)

// ---- SCENES ----

// S1: the problem — annotate the chaos photo (circle the paper stacks, arrow the spreadsheet)
const S1: React.FC = () => (
  <AbsoluteFill>
    <Footage src={`${ASSET}/desk-chaos.png`} dur={140} focus="55% 55%" />
    <Kicker text="For insurance pros" />
    <CircleAt at={16} x={1500} y={760} w={620} h={330} color={YELLOW} />
    <Callout at={30} x={1180} y={560} text="Your whole book — on paper" color={YELLOW} />
    <Arrow at={48} x1={760} y1={340} x2={470} y2={230} color={RED} />
    <Callout at={54} x={780} y={330} text="Buried in spreadsheets" color={RED} fg={PAPER} />
    <LowerBar at={72} pre="Your book of business is " hot="invisible" post="." hi={YELLOW} />
  </AbsoluteFill>
)

// S2: the product — annotate the thinking agent, big label reveal
const S2: React.FC = () => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const pop = spring({ frame: frame - 10, fps, config: { damping: 14, stiffness: 130 } })
  return (
    <AbsoluteFill>
      <Footage src={`${ASSET}/agent-think.png`} dur={175} focus="45% 45%" dim={0.42} />
      <Kicker text="The fix" />
      {/* logo chip top-right */}
      <div style={{ position: 'absolute', top: 60, right: 90, background: NAVY, padding: '18px 26px', borderRadius: 6, transform: `scale(${clamp(pop, 0, 1)})`, transformOrigin: 'top right' }}>
        <Img src={staticFile(`${LOGO}/logo.png`)} style={{ width: 300, height: 'auto', display: 'block' }} />
      </div>
      <CircleAt at={20} x={640} y={430} w={520} h={560} color={BLUE} />
      <Callout at={36} x={980} y={360} text="Meet SmartViewz" color={BLUE} fg={PAPER} />
      <LowerBar at={60} pre="AI that reads your " hot="whole book" post="." hi={YELLOW} />
    </AbsoluteFill>
  )
}

// S3: the ask — a "conversation" overlay + the data answer (bar chart + big stat)
const S3: React.FC = () => {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ background: NAVY }}>
      <Footage src={`${ASSET}/laptop-data.png`} dur={210} focus="50% 55%" dim={0.55} />
      <Kicker text="Just ask" />
      {/* the question chip, typed */}
      <div style={{ position: 'absolute', top: 150, left: 90, background: 'rgba(10,12,16,0.8)', border: `2px solid ${YELLOW}`, borderRadius: 10, padding: '22px 30px', opacity: clamp((frame - 8) / 8, 0, 1) }}>
        <span style={{ fontFamily: BLACK, fontSize: 46, color: PAPER }}>“Who’s about to lapse?”</span>
      </div>
      {/* the data answer */}
      <BarChart at={40} x={90} y={360} bars={[{ label: 'Jan', v: 4, color: '#5b8cff' }, { label: 'Feb', v: 7, color: '#5b8cff' }, { label: 'Mar', v: 9, color: YELLOW }, { label: 'Apr', v: 12, color: RED }]} />
      <BigStat at={54} x={1150} y={380} value={12} label="policies at risk" color={RED} />
      <Callout at={80} x={1150} y={660} text="+ cross-sells on 5" color={YELLOW} />
      <LowerBar at={96} pre="Answers in " hot="seconds" post=", not weeks." hi={YELLOW} />
    </AbsoluteFill>
  )
}

// S4: the payoff — annotate the handshake, checklist of capabilities reveals
const S4: React.FC = () => {
  const frame = useCurrentFrame()
  const items = ['Spot every lapse', 'Surface every cross-sell', 'Catch compliance risk']
  return (
    <AbsoluteFill>
      <Footage src={`${ASSET}/handshake.png`} dur={175} focus="50% 45%" dim={0.5} />
      <Kicker text="Your edge" />
      <CircleAt at={14} x={960} y={470} w={620} h={420} color={YELLOW} />
      <div style={{ position: 'absolute', top: 150, right: 90, width: 720 }}>
        {items.map((it, i) => {
          const on = clamp((frame - (30 + i * 16)) / 12, 0, 1)
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 22, opacity: on, transform: `translateX(${(1 - on) * 40}px)` }}>
              <div style={{ width: 44, height: 44, borderRadius: 22, background: YELLOW, color: INK, fontFamily: BLACK, fontSize: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✓</div>
              <div style={{ background: 'rgba(10,12,16,0.78)', padding: '12px 20px', borderRadius: 6, fontFamily: BLACK, fontSize: 36, color: PAPER }}>{it}</div>
            </div>
          )
        })}
      </div>
      <LowerBar at={84} pre="Never " hot="miss" post=" a thing." hi={RED} />
    </AbsoluteFill>
  )
}

// S5: CTA — clean end card, Vox-style bold + logo + underline-drawn URL
const S5: React.FC = () => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const pop = spring({ frame: frame - 8, fps, config: { damping: 13, stiffness: 140 } })
  const uw = clamp((frame - 34) / 14, 0, 1)
  return (
    <AbsoluteFill style={{ background: NAVY, justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ transform: `scale(${clamp(pop, 0, 1)})`, marginBottom: 34 }}>
        <Img src={staticFile(`${LOGO}/logo.png`)} style={{ width: 460, height: 'auto' }} />
      </div>
      <div style={{ fontFamily: BLACK, fontSize: 100, color: PAPER, textAlign: 'center', lineHeight: 1.0 }}>
        Stop guessing.<br /><span style={{ color: YELLOW }}>Start knowing.</span>
      </div>
      <div style={{ position: 'relative', marginTop: 40, fontFamily: BLACK, fontSize: 44, color: PAPER }}>
        reachtheapex.net
        <div style={{ position: 'absolute', left: 0, bottom: -12, height: 8, width: `${uw * 100}%`, background: RED, borderRadius: 4 }} />
      </div>
    </AbsoluteFill>
  )
}

const VO_SEC = [3.07, 4.50, 5.85, 5.25, 4.23]
const DUR = VO_SEC.map((d) => Math.round((d + 1.6) * FPS))
const BEATS = [S1, S2, S3, S4, S5]
const MUSIC_FRAMES = Math.round(29.99 * FPS)
export const APEX_VOX_FRAMES = DUR.reduce((a, b) => a + b, 0)

export const ApexVox: React.FC = () => {
  const starts: number[] = []; { let t = 0; for (const d of DUR) { starts.push(t); t += d } }
  const total = APEX_VOX_FRAMES
  const voWin: VoWindow[] = starts.map((st, i) => ({ start: st, end: st + Math.round(VO_SEC[i] * FPS) }))
  const duck = makeMusicDuck(voWin, total, { loud: 0.2, duck: 0.08, ramp: 14, fadeInEnd: 10, fadeOutStart: total - 20, fadeOutEnd: total - 3 })
  return (
    <AbsoluteFill style={{ background: INK }}>
      {BEATS.map((B, i) => (
        <Sequence key={i} from={starts[i]} durationInFrames={DUR[i]}><B /></Sequence>
      ))}
      {starts.map((st, i) => (
        <Sequence key={'vo' + i} from={st + 6}><Audio src={staticFile(`c-apex3/vo-${i + 1}.mp3`)} /></Sequence>
      ))}
      <MusicBed src="c-apex3/music.mp3" musicFrames={MUSIC_FRAMES} volume={duck} />
    </AbsoluteFill>
  )
}
