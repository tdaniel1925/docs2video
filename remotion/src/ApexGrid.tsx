import React from 'react'
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing, Sequence, Img, staticFile, spring, Audio } from 'remotion'
import { MusicBed } from './lib/musicbed'
import { makeMusicDuck, type VoWindow } from './lib/audio'
import { loadFont as loadSora } from '@remotion/google-fonts/Sora'
import { loadFont as loadManrope } from '@remotion/google-fonts/Manrope'

/* ============================================================================
 * TREATMENT C — "SPLIT-MOTION GRID / DASHBOARD". A modular panel system: the
 * frame is divided into asymmetric tiles that slide, swap, and reveal like a
 * live product dashboard assembling itself. MULTIPLE simultaneous zones, no
 * single focal point. Cool, precise, systematic — the opposite of both the
 * editorial (print) and kinetic (chaos) worlds. SAME Apex message.
 * ==========================================================================*/

const { fontFamily: SORA } = loadSora()
const { fontFamily: MANROPE } = loadManrope()
const FPS = 30
const BG = '#0a1526', PANEL = '#12203a', PANEL2 = '#16294a', LINE = 'rgba(120,160,255,0.14)'
const RED = '#e0343b', BLUE = '#5b8cff', CREAM = '#eef2fb', MUTE = '#8fa4c8'
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const ASSET = 'c-apexTORN'

// a panel that slides/scales into its grid cell
const Tile: React.FC<{ at: number; from?: 'l' | 'r' | 'u' | 'd' | 'scale'; style?: React.CSSProperties; children?: React.ReactNode; bg?: string }> = ({ at, from = 'scale', style, children, bg = PANEL }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const s = spring({ frame: frame - at, fps, config: { damping: 16, stiffness: 130 } })
  const p = clamp(s, 0, 1)
  let tf = ''
  if (from === 'l') tf = `translateX(${(1 - p) * -60}px)`
  else if (from === 'r') tf = `translateX(${(1 - p) * 60}px)`
  else if (from === 'u') tf = `translateY(${(1 - p) * -60}px)`
  else if (from === 'd') tf = `translateY(${(1 - p) * 60}px)`
  else tf = `scale(${0.9 + p * 0.1})`
  return (
    <div style={{ position: 'absolute', background: bg, border: `1px solid ${LINE}`, borderRadius: 10, overflow: 'hidden', opacity: p, transform: tf, boxShadow: '0 20px 60px rgba(0,0,0,0.35)', ...style }}>
      {children}
    </div>
  )
}

// a live-counting metric inside a tile
const Metric: React.FC<{ at: number; label: string; value: string; accent?: string }> = ({ at, label, value, accent = BLUE }) => {
  const frame = useCurrentFrame()
  const on = clamp((frame - at) / 14, 0, 1)
  return (
    <div style={{ padding: '26px 30px' }}>
      <div style={{ fontFamily: MANROPE, fontWeight: 700, fontSize: 16, letterSpacing: '0.18em', color: MUTE, textTransform: 'uppercase', marginBottom: 12 }}>{label}</div>
      <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: 68, color: CREAM, opacity: on, transform: `translateY(${(1 - on) * 12}px)`, lineHeight: 1 }}>{value}</div>
      <div style={{ height: 4, marginTop: 16, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${on * 100}%`, background: accent, borderRadius: 2 }} />
      </div>
    </div>
  )
}

const persistentGrid = (
  <AbsoluteFill style={{ pointerEvents: 'none', opacity: 0.5 }}>
    {[...Array(11)].map((_, i) => <div key={'v' + i} style={{ position: 'absolute', left: `${(i + 1) * 8.33}%`, top: 0, bottom: 0, width: 1, background: 'rgba(120,160,255,0.04)' }} />)}
  </AbsoluteFill>
)

// ---- C1: boot-up. The dashboard assembles — a wide header tile slides from top,
// two side tiles slide in from L/R, a big statement tile scales in center-low.
const C1: React.FC = () => (
  <AbsoluteFill style={{ background: BG }}>
    {persistentGrid}
    <Tile at={2} from="u" style={{ top: 70, left: 90, width: 1740, height: 90 }}>
      <div style={{ display: 'flex', alignItems: 'center', height: '100%', padding: '0 30px', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: MANROPE, fontWeight: 700, fontSize: 20, letterSpacing: '0.2em', color: BLUE, textTransform: 'uppercase' }}>APEX · SMARTVIEWZ</div>
        <div style={{ fontFamily: MANROPE, fontWeight: 600, fontSize: 18, color: MUTE }}>● live · for insurance pros</div>
      </div>
    </Tile>
    <Tile at={12} from="l" style={{ top: 200, left: 90, width: 1120, height: 700, background: PANEL2 }}>
      <div style={{ padding: '70px 64px' }}>
        <div style={{ fontFamily: MANROPE, fontWeight: 700, fontSize: 20, letterSpacing: '0.2em', color: RED, textTransform: 'uppercase', marginBottom: 26 }}>The book of business, live</div>
        <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: 104, lineHeight: 1.0, color: CREAM }}>Your book,<br />finally<br />talking back.</div>
      </div>
    </Tile>
    <Tile at={22} from="r" style={{ top: 200, left: 1250, width: 580, height: 335 }}><Metric at={30} label="Policies tracked" value="1,842" /></Tile>
    <Tile at={28} from="r" style={{ top: 565, left: 1250, width: 580, height: 335, background: PANEL2 }}><Metric at={36} label="At risk this month" value="12" accent={RED} /></Tile>
  </AbsoluteFill>
)

// ---- C2: product tile focus. Logo tile top-left, a big "ask anything" input-bar
// tile spanning the bottom, metric tiles right.
const C2: React.FC = () => {
  const frame = useCurrentFrame()
  const caret = Math.floor(frame / 8) % 2 === 0
  return (
    <AbsoluteFill style={{ background: BG }}>
      {persistentGrid}
      <Tile at={2} from="u" style={{ top: 90, left: 90, width: 760, height: 300 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Img src={staticFile(`${ASSET}/logo.png`)} style={{ width: 520, height: 'auto' }} />
        </div>
      </Tile>
      <Tile at={10} from="r" style={{ top: 90, left: 890, width: 940, height: 140, background: PANEL2 }}>
        <div style={{ padding: '30px 34px' }}>
          <div style={{ fontFamily: MANROPE, fontWeight: 700, fontSize: 16, letterSpacing: '0.18em', color: MUTE, textTransform: 'uppercase' }}>What it is</div>
          <div style={{ fontFamily: SORA, fontWeight: 700, fontSize: 40, color: CREAM, marginTop: 6 }}>The AI that reads your whole book.</div>
        </div>
      </Tile>
      <Tile at={16} from="r" style={{ top: 250, left: 890, width: 455, height: 140 }}><Metric at={24} label="Agents" value="387" /></Tile>
      <Tile at={20} from="r" style={{ top: 250, left: 1375, width: 455, height: 140, background: PANEL2 }}><Metric at={28} label="Premium" value="$2.8M" accent={RED} /></Tile>
      {/* the ask bar spanning the bottom */}
      <Tile at={26} from="d" style={{ top: 460, left: 90, width: 1740, height: 440, background: PANEL2 }}>
        <div style={{ padding: '54px 60px' }}>
          <div style={{ fontFamily: MANROPE, fontWeight: 700, fontSize: 18, letterSpacing: '0.2em', color: BLUE, textTransform: 'uppercase', marginBottom: 30 }}>Just ask</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, background: BG, border: `1px solid ${LINE}`, borderRadius: 12, padding: '30px 36px' }}>
            <div style={{ width: 14, height: 14, borderRadius: 7, background: RED }} />
            <div style={{ fontFamily: SORA, fontWeight: 600, fontSize: 52, color: CREAM }}>Who’s about to lapse?{caret ? <span style={{ color: BLUE }}> |</span> : ''}</div>
          </div>
        </div>
      </Tile>
    </AbsoluteFill>
  )
}

// ---- C3: the answer resolves — the ask bar collapses up, an answer panel
// expands, result tiles cascade in.
const C3: React.FC = () => {
  const frame = useCurrentFrame()
  const rows = [['Policy #4821', 'Lapses in 6 days', 'Cross-sell: umbrella'], ['Policy #7734', 'Lapses in 11 days', 'Cross-sell: life'], ['Policy #1180', 'Lapses in 14 days', 'Review flagged']]
  return (
    <AbsoluteFill style={{ background: BG }}>
      {persistentGrid}
      <Tile at={2} from="u" style={{ top: 90, left: 90, width: 1740, height: 150, background: PANEL2 }}>
        <div style={{ display: 'flex', alignItems: 'center', height: '100%', padding: '0 50px', gap: 30 }}>
          <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: 90, color: RED }}>12</div>
          <div style={{ fontFamily: SORA, fontWeight: 700, fontSize: 44, color: CREAM }}>policies at risk — with cross-sells on 5.</div>
        </div>
      </Tile>
      {rows.map((r, i) => (
        <Tile key={i} at={14 + i * 8} from="l" style={{ top: 280 + i * 200, left: 90, width: 1740, height: 170 }}>
          <div style={{ display: 'flex', alignItems: 'center', height: '100%', padding: '0 50px', gap: 40 }}>
            <div style={{ fontFamily: SORA, fontWeight: 700, fontSize: 40, color: CREAM, width: 420 }}>{r[0]}</div>
            <div style={{ width: 1, height: '54%', background: LINE }} />
            <div style={{ fontFamily: MANROPE, fontWeight: 700, fontSize: 34, color: RED, width: 420 }}>{r[1]}</div>
            <div style={{ width: 1, height: '54%', background: LINE }} />
            <div style={{ fontFamily: MANROPE, fontWeight: 600, fontSize: 34, color: BLUE }}>{r[2]}</div>
          </div>
        </Tile>
      ))}
    </AbsoluteFill>
  )
}

// ---- C4: capability grid — a real 2x2 of feature tiles snapping in on a beat.
const C4: React.FC = () => {
  const items = [['Spot lapses', 'before they happen'], ['Surface cross-sells', 'on every account'], ['Catch compliance', 'risk automatically'], ['No waiting', 'on a single report']]
  const pos = [{ t: 200, l: 90 }, { t: 200, l: 970 }, { t: 560, l: 90 }, { t: 560, l: 970 }]
  return (
    <AbsoluteFill style={{ background: BG }}>
      {persistentGrid}
      <div style={{ position: 'absolute', top: 90, left: 90, fontFamily: MANROPE, fontWeight: 700, fontSize: 20, letterSpacing: '0.2em', color: RED, textTransform: 'uppercase' }}>Your edge — never miss</div>
      {items.map((it, i) => (
        <Tile key={i} at={6 + i * 6} from={i % 2 ? 'r' : 'l'} style={{ top: pos[i].t, left: pos[i].l, width: 860, height: 320, background: i % 2 ? PANEL2 : PANEL }}>
          <div style={{ padding: '48px 50px' }}>
            <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: 60, color: CREAM }}>{it[0]}</div>
            <div style={{ fontFamily: MANROPE, fontWeight: 500, fontSize: 34, color: MUTE, marginTop: 14 }}>{it[1]}</div>
            <div style={{ marginTop: 30, width: 60, height: 6, background: i % 2 ? RED : BLUE, borderRadius: 3 }} />
          </div>
        </Tile>
      ))}
    </AbsoluteFill>
  )
}

// ---- C5: CTA — tiles converge into one centered card (the ONE time it resolves
// to center — earned by the dashboard collapsing into a single call to action).
const C5: React.FC = () => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const btn = spring({ frame: frame - 34, fps, config: { damping: 13, stiffness: 160 } })
  return (
    <AbsoluteFill style={{ background: BG }}>
      {persistentGrid}
      <Tile at={2} from="scale" style={{ top: 190, left: 360, width: 1200, height: 700, background: PANEL2 }}>
        <div style={{ padding: '90px 80px', textAlign: 'center' }}>
          <Img src={staticFile(`${ASSET}/logo.png`)} style={{ width: 420, height: 'auto', margin: '0 auto 40px' }} />
          <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: 76, color: CREAM, lineHeight: 1.05 }}>Stop guessing.<br /><span style={{ color: RED }}>Start knowing.</span></div>
          <div style={{ transform: `scale(${clamp(btn, 0, 1)})`, marginTop: 44, display: 'inline-block', background: RED, color: CREAM, fontFamily: SORA, fontWeight: 700, fontSize: 38, padding: '22px 56px', borderRadius: 10 }}>Get SmartViewz</div>
          <div style={{ fontFamily: MANROPE, fontWeight: 600, fontSize: 24, color: MUTE, marginTop: 26 }}>reachtheapex.net · free to join</div>
        </div>
      </Tile>
    </AbsoluteFill>
  )
}

const VO_SEC = [3.07, 4.50, 5.85, 5.25, 4.23]
const DUR = VO_SEC.map((d) => Math.round((d + 1.5) * FPS))
const BEATS = [C1, C2, C3, C4, C5]
const MUSIC_FRAMES = Math.round(29.99 * FPS)
export const APEX_GRID_FRAMES = DUR.reduce((a, b) => a + b, 0)

export const ApexGrid: React.FC = () => {
  const starts: number[] = []; { let t = 0; for (const d of DUR) { starts.push(t); t += d } }
  const total = APEX_GRID_FRAMES
  const voWin: VoWindow[] = starts.map((st, i) => ({ start: st, end: st + Math.round(VO_SEC[i] * FPS) }))
  const duck = makeMusicDuck(voWin, total, { loud: 0.2, duck: 0.08, ramp: 14, fadeInEnd: 10, fadeOutStart: total - 20, fadeOutEnd: total - 3 })
  return (
    <AbsoluteFill style={{ background: BG }}>
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
