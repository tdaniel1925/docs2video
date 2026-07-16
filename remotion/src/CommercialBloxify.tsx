import React from 'react'
import { AbsoluteFill, Img, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion'
import { loadFont as loadNunito } from '@remotion/google-fonts/Nunito'
import { loadFont as loadBaloo } from '@remotion/google-fonts/Baloo2'
import bxGrid from '../public/bloxify/beatgrid.json'
import { CountUp, Bokeh, Alive, sustained, SettleSweep } from './lib/pizzazz'
import { makeMusicDuck, beatLock, gridToFrames, durationsFromStarts, type VoWindow } from './lib/audio'
import { MusicBed } from './lib/musicbed'

const { fontFamily: ROUND } = loadBaloo()     // chunky rounded playful display
const { fontFamily: BODY } = loadNunito()      // friendly rounded body
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const FPS = 30

/* ============================================================================
 * BLOXIFY — autonomous, content-driven commercial. The system read the site and
 * MADE the calls:
 *   · WHAT: a premium mobile BLOCK-PUZZLE game, "Block Puzzle, Reimagined."
 *     3 modes, 6 realms, 350+ levels, 72 boss puzzles. Anti-dark-pattern:
 *     No Forced Ads · Offline · Supports Artists. Launches June 4, 2026.
 *   · THEME: playful, satisfying, cozy-premium. Arc: ad-spammy puzzle games →
 *     a handcrafted, ad-free one. Pre-launch → CTA is "Notify Me / June 4".
 *   · LOOK: playful GAME-UI — colorful rounded blocks, bouncy springs, the real
 *     mascot "Blox", vibrant realm colors on a cozy dark-navy base. A SIXTH
 *     distinct style (vs. AICEO gold, Apex blue, Pubco emerald, SmartScale red,
 *     iHost casino). App-Store-trailer energy.
 *   · PIZZAZZ fit: animated FALLING + CLEARING blocks, mascot, count-up stats,
 *     the launch countdown.
 * ==========================================================================*/

const BG = '#161a2e', BG2 = '#20264a', PANEL = '#2a3157'
// vibrant block palette (from the real game's rainbow blocks + brand accents)
const COLORS = ['#e24b4a', '#ef9f27', '#4cc38a', '#378add', '#8b5cf6', '#ec4899', '#22d3ee']
const CREAM = '#f7f5ef', WHITE = '#ffffff', MUTE = '#9aa2c8'
const PINK = '#ffb7c5', LIME = '#4cc38a', SKY = '#378add', ORANGE = '#ef9f27'

/* ---- BLOX, the mascot, as a CHARACTER (not a prop) ------------------------
 * The director's PERSONALITY read for Bloxify = "charming & mischievous". Blox
 * ACTS across the ad using physical comedy built from 3 still poses (wave /
 * present / celebrate) + transform-based acting. Squash-and-stretch gives him
 * life even from a static image. Each `act` is a little bit of business.
 * -------------------------------------------------------------------------- */
type Act = 'idle' | 'hop' | 'peek' | 'dodge' | 'bonk' | 'dance' | 'tripIn' | 'cheer'
const Mascot: React.FC<{ pose?: 'wave' | 'present' | 'celebrate'; act?: Act; at?: number; size?: number; style?: React.CSSProperties; flip?: boolean }> =
({ pose = 'wave', act = 'idle', at = 0, size = 240, style, flip = false }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const f = frame - at
  let x = 0, y = 0, rot = 0, sx = 1, sy = 1, o = 1
  const bob = Math.sin(frame * 0.14) * 6                 // always-alive idle bob
  const squash = (t: number) => { sx = 1 + t; sy = 1 - t }  // t>0 wide/short
  switch (act) {
    case 'idle': y = bob; rot = Math.sin(frame * 0.08) * 3; break
    case 'hop': {
      const c = (f % 26) / 26; const h = Math.sin(c * Math.PI); y = -h * 60 + bob
      if (c < 0.12) squash(0.18); else if (c > 0.5 && c < 0.62) squash(-0.14); else if (c > 0.9) squash(0.12)
      break }
    case 'peek': { // slides up from below, bobs, watching
      o = clamp(f / 8, 0, 1); y = interpolate(f, [0, 12], [180, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.back(2)) }) + bob * 0.5
      rot = Math.sin(frame * 0.1) * 4; break }
    case 'dodge': { // leans/hops aside as if avoiding something, repeatedly
      const c = (f % 20) / 20; x = Math.sin(c * Math.PI * 2) * 40; rot = -x * 0.3; y = bob; break }
    case 'bonk': { // gets bonked: squishes down then springs back with a wobble
      if (f < 6) squash(interpolate(f, [0, 6], [0, 0.4], { extrapolateRight: 'clamp' }))
      else { const s = spring({ frame: f - 6, fps, config: { damping: 6, stiffness: 200 } }); const w = (1 - clamp(s, 0, 1)) * 0.4; squash(w); rot = Math.sin((f - 6) * 0.6) * (1 - clamp(s, 0, 1)) * 12 }
      y = bob; break }
    case 'dance': { // happy wiggle side to side
      x = Math.sin(frame * 0.3) * 26; rot = Math.sin(frame * 0.3) * 12; y = Math.abs(Math.sin(frame * 0.3)) * -14 + bob; break }
    case 'tripIn': { // trips into frame from the side, stumbles, recovers
      x = interpolate(f, [0, 16], [-500, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
      if (f > 14 && f < 24) { rot = Math.sin((f - 14) * 0.8) * 16; squash(0.15) }
      else rot = Math.sin(frame * 0.08) * 3
      y = bob; o = clamp(f / 6, 0, 1); break }
    case 'cheer': { // celebratory jumps
      const c = (f % 22) / 22; const h = Math.sin(c * Math.PI); y = -h * 70 + bob; rot = Math.sin(frame * 0.4) * 8
      if (c < 0.1) squash(0.2); if (c > 0.9) squash(0.15); break }
  }
  const poseFile = pose === 'wave' ? 'mascot-wave' : pose === 'present' ? 'mascot-present' : 'mascot-celebrate'
  return (
    <div style={{ position: 'absolute', opacity: o, transform: `translate(${x}px, ${y}px) rotate(${rot}deg) scaleX(${(flip ? -1 : 1) * sx}) scaleY(${sy})`, transformOrigin: 'bottom center', ...style }}>
      <Img src={staticFile(`bloxify/${poseFile}.png`)} style={{ width: size, height: 'auto', display: 'block', filter: 'drop-shadow(0 12px 16px rgba(0,0,0,0.4))' }} />
    </div>
  )
}

// a single rounded game block
const Blk: React.FC<{ c: string; size?: number; style?: React.CSSProperties }> = ({ c, size = 60, style }) => (
  <div style={{ width: size, height: size, borderRadius: size * 0.22, background: `linear-gradient(150deg, ${c}, ${shade(c, -22)})`, boxShadow: `inset 0 ${size * 0.06}px 0 rgba(255,255,255,0.35), inset 0 -${size * 0.06}px 0 rgba(0,0,0,0.2), 0 4px 10px rgba(0,0,0,0.3)`, ...style }} />
)
function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16)
  const r = clamp((n >> 16) + amt, 0, 255), g = clamp(((n >> 8) & 255) + amt, 0, 255), b = clamp((n & 255) + amt, 0, 255)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

// playful headline — chunky rounded, bouncy spring-in, colored key word
const Head: React.FC<{ pre?: string; hot?: string; post?: string; color?: string; size?: number; hold: number; kicker?: string }> =
({ pre = '', hot = '', post = '', color = ORANGE, size = 96, hold, kicker }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const pop = spring({ frame, fps, config: { damping: 11, stiffness: 190 } })
  const o = interpolate(frame, [0, 6, hold - 8, hold], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const kO = interpolate(frame, [2, 10], [0, 1], { extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 150 }}>
      <div style={{ opacity: o, transform: `scale(${0.82 + clamp(pop, 0, 1) * 0.18})`, textAlign: 'center', maxWidth: 1500 }}>
        {kicker && <div style={{ fontFamily: BODY, fontWeight: 800, fontSize: 22, letterSpacing: '0.24em', textTransform: 'uppercase', color, marginBottom: 18, opacity: kO }}>{kicker}</div>}
        <div style={{ fontFamily: ROUND, fontWeight: 800, fontSize: size, color: WHITE, lineHeight: 1.02, textShadow: '0 5px 0 rgba(0,0,0,0.25), 0 10px 30px rgba(0,0,0,0.4)' }}>
          {pre}{hot && <span style={{ color }}>{hot}</span>}{post}
        </div>
      </div>
    </AbsoluteFill>
  )
}

// cozy soft-gradient game backdrop with floating blocks
const PlayfulBG: React.FC<{ tint?: string }> = ({ tint = SKY }) => {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 30%, ${BG2}, ${BG})` }}>
      <AbsoluteFill style={{ background: `radial-gradient(60% 50% at 70% 20%, ${tint}22, transparent 60%)` }} />
      {Array.from({ length: 10 }, (_, i) => {
        const r = ((i * 9301 + 49297) % 233280) / 233280
        const x = r * 100, y = ((((i * 4021) % 233280) / 233280) * 100 + Math.sin(frame * 0.02 + i) * 4)
        const spin = frame * (0.3 + r) + i * 40
        return <div key={i} style={{ position: 'absolute', left: `${x}%`, top: `${(y + 100) % 100}%`, opacity: 0.18, transform: `rotate(${spin}deg)` }}><Blk c={COLORS[i % COLORS.length]} size={30 + r * 30} /></div>
      })}
    </AbsoluteFill>
  )
}

const s = (sec: number) => Math.round(sec * FPS)
type Beat = { dur: number; vo?: string; el: React.ReactNode }
// VO: 1:3.07 2:3.30 3:5.53 4:7.43 5:5.06 6:5.94 7:4.78 8:3.53 9:2.79
const BEATS: Beat[] = [
  // 1 — the problem (ad-spam) — a board choked with fake ad blocks
  { dur: s(3.07 + 0.2), vo: 'bx-1', el: <AdSpam hold={s(3.07 + 0.2)} /> },
  // 2 — meet Bloxify (wordmark + mascot bounce)
  { dur: s(3.30 + 0.6), vo: 'bx-2', el: <MeetBloxify hold={s(3.30 + 0.6)} /> },
  // 3 — satisfying clears (the block-clear hero moment)
  { dur: s(5.53 + 0.2), vo: 'bx-3', el: <ClearBoard hold={s(5.53 + 0.2)} /> },
  // 4 — three modes
  { dur: s(7.43 + 0.2), vo: 'bx-4', el: <Modes hold={s(7.43 + 0.2)} /> },
  // 5 — the numbers (count-up)
  { dur: s(5.06 + 0.2), vo: 'bx-5', el: <Numbers hold={s(5.06 + 0.2)} /> },
  // 6 — the promises (no ads / offline / artists)
  { dur: s(5.94 + 0.2), vo: 'bx-6', el: <Promises hold={s(5.94 + 0.2)} /> },
  // 7 — daily / social (screenshot in a phone)
  { dur: s(4.78 + 0.2), vo: 'bx-7', el: <Daily hold={s(4.78 + 0.2)} /> },
  // 8 — launch date
  { dur: s(3.53 + 0.3), vo: 'bx-8', el: <Launch hold={s(3.53 + 0.3)} /> },
  // 9 — CTA
  { dur: s(2.79 + 1.8), vo: 'bx-9', el: <CTACard hold={s(2.79 + 1.8)} /> },
]

function AdSpam({ hold }: { hold: number }) {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 40%, #3a2030, ${BG})` }}>
      {/* fake annoying "AD" blocks popping up chaotically */}
      {Array.from({ length: 7 }, (_, i) => {
        const at = i * 4
        const o = interpolate(frame, [at, at + 4], [0, 0.9], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
        const pos = [[10, 20], [70, 15], [40, 60], [80, 65], [20, 70], [55, 35], [30, 40]][i]
        return <div key={i} style={{ position: 'absolute', left: `${pos[0]}%`, top: `${pos[1]}%`, opacity: o, transform: `rotate(${(i % 2 ? 1 : -1) * 6}deg)`, background: '#e24b4a', color: WHITE, fontFamily: ROUND, fontWeight: 800, fontSize: 40, padding: '14px 30px', borderRadius: 12, boxShadow: '0 6px 16px rgba(0,0,0,0.5)' }}>AD ✕</div>
      })}
      {/* Blox down in the corner getting pelted by the ad-spam, dodging + bonked */}
      <Mascot pose="present" act={frame < 20 ? 'dodge' : 'bonk'} at={frame < 20 ? 0 : 20} size={220} style={{ left: 120, bottom: 40 }} />
      <Head pre="Tired of puzzles that " hot="spam you?" color={PINK} size={80} hold={hold} />
    </AbsoluteFill>
  )
}

function MeetBloxify({ hold }: { hold: number }) {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const wm = spring({ frame: frame - 2, fps, config: { damping: 12, stiffness: 160 } })
  const mascot = spring({ frame: frame - 12, fps, config: { damping: 9, stiffness: 170 } })
  const bounce = Math.sin(frame * 0.2) * 10
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 35%, ${BG2}, ${BG})` }}>
      <PlayfulBG tint={ORANGE} />
      <Bokeh color={ORANGE} count={6} big />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 10 }}>
        <Img src={staticFile('bloxify/wordmark.png')} style={{ width: 620, height: 'auto', transform: `scale(${0.6 + clamp(wm, 0, 1) * 0.4})`, filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.5))' }} />
        <div style={{ fontFamily: ROUND, fontWeight: 700, fontSize: 48, color: MUTE, opacity: clamp((frame - 16) / 8, 0, 1) }}>Block Puzzle, <span style={{ color: ORANGE }}>Reimagined.</span></div>
      </AbsoluteFill>
      {/* Blox bounds in waving and hops with excitement */}
      <Mascot pose="wave" act={frame < 24 ? 'peek' : 'cheer'} at={frame < 24 ? 12 : 24} size={260} style={{ right: 160, bottom: 70 }} />
    </AbsoluteFill>
  )
}

// the satisfying block-clear hero moment — a row fills then flashes & clears
function ClearBoard({ hold }: { hold: number }) {
  const frame = useCurrentFrame()
  const cols = 9, rows = 9, cell = 78, gap = 8
  // pre-filled board state + a bottom row that completes then clears
  const filled = (r: number, c: number) => ((r * 7 + c * 3) % 5 !== 0) && r < 6
  const dropRow = 6
  const dropDone = interpolate(frame, [8, 22], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.bounce) })
  const clearAt = 40
  const clearFlash = interpolate(frame, [clearAt, clearAt + 6], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const cleared = frame > clearAt + 8
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 30%, ${BG2}, ${BG})` }}>
      <PlayfulBG tint={LIME} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ position: 'relative', background: '#0e1226', borderRadius: 20, padding: gap, boxShadow: `0 0 0 3px ${SKY}66, 0 20px 50px rgba(0,0,0,0.5)` }}>
          {Array.from({ length: rows }, (_, r) => (
            <div key={r} style={{ display: 'flex', gap }}>
              {Array.from({ length: cols }, (_, c) => {
                const isDrop = r === dropRow
                const on = filled(r, c) || (isDrop && dropDone > (c / cols))
                const rowClearing = isDrop && frame >= clearAt
                if (!on || (rowClearing && cleared)) return <div key={c} style={{ width: cell, height: cell, borderRadius: 14, background: '#161a30', marginBottom: gap, marginRight: 0 }} />
                const col = COLORS[(r + c) % COLORS.length]
                return <div key={c} style={{ marginBottom: gap }}><Blk c={col} size={cell} style={{ borderRadius: 14, transform: rowClearing ? `scale(${1 - clearFlash})` : 'none', filter: rowClearing ? `brightness(${1 + clearFlash * 2})` : 'none' }} /></div>
              })}
            </div>
          ))}
          {frame >= clearAt && frame < clearAt + 20 && (
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: `translate(-50%,-50%) scale(${interpolate(frame, [clearAt, clearAt + 10], [0.5, 1.3], { extrapolateRight: 'clamp' })})`, fontFamily: ROUND, fontWeight: 800, fontSize: 90, color: LIME, textShadow: `0 0 30px ${LIME}, 0 4px 0 rgba(0,0,0,0.3)`, opacity: interpolate(frame, [clearAt, clearAt + 6, clearAt + 18], [0, 1, 0], { extrapolateRight: 'clamp' }) }}>CLEAR!</div>
          )}
        </div>
      </AbsoluteFill>
      {/* Blox peeks over from the right, then dances the moment the row CLEARS */}
      <Mascot pose="celebrate" act={frame < clearAt + 4 ? 'peek' : 'dance'} at={frame < clearAt + 4 ? 18 : clearAt + 4} size={200} style={{ right: 180, bottom: 60 }} />
      <Head hot="Satisfying clears." color={LIME} size={72} hold={hold} />
    </AbsoluteFill>
  )
}

function Modes({ hold }: { hold: number }) {
  const frame = useCurrentFrame()
  const modes = [['Zen', 'No timer. Just flow.', SKY], ['Blitz', 'Beat the clock.', ORANGE], ['Adventure', '6 realms await.', LIME]]
  // reveals spread across the WHOLE beat (sustained) so it never freezes early
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 35%, ${BG2}, ${BG})` }}>
      <PlayfulBG tint={SKY} />
      <Alive intensity={1.1}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 44 }}>
          <div style={{ fontFamily: ROUND, fontWeight: 800, fontSize: 56, color: WHITE, opacity: clamp((frame - 4) / 8, 0, 1) }}>Three ways to play</div>
          <div style={{ display: 'flex', gap: 30 }}>
            {modes.map(([t, d, c], i) => {
              const at = sustained(i, modes.length, hold, 16)   // card i reveals spread across the beat
              const pop = spring({ frame: frame - at, fps: FPS, config: { damping: 11, stiffness: 180 } })
              const shown = clamp(pop, 0, 1)
              // each card keeps a gentle idle bob after it lands (stays alive)
              const bob = shown > 0.9 ? Math.sin((frame - at) * 0.12 + i) * 4 : 0
              // reveal IN PLACE (opacity + partial scale) — fixed 340px slot so the
              // row stays centered & stable instead of reflowing as cards appear
              return (
                <div key={i} style={{ width: 340, opacity: shown, transform: `scale(${0.7 + shown * 0.3}) translateY(${bob}px)`, background: PANEL, border: `3px solid ${c}`, borderRadius: 22, padding: '34px 40px', textAlign: 'center', boxShadow: `0 0 ${28 + Math.sin(frame * 0.1 + i) * 10}px ${c}44`, boxSizing: 'border-box' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 16 }}>
                    {[0, 1, 2].map((k) => <div key={k} style={{ transform: `translateY(${Math.sin(frame * 0.16 + k * 0.8 + i) * 5}px)` }}><Blk c={c as string} size={38} /></div>)}
                  </div>
                  <div style={{ fontFamily: ROUND, fontWeight: 800, fontSize: 48, color: c as string }}>{t}</div>
                  <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 26, color: MUTE, marginTop: 6 }}>{d}</div>
                </div>
              )
            })}
          </div>
        </AbsoluteFill>
      </Alive>
      {/* Blox hops in and cheers along the bottom as the mode cards land */}
      <Mascot pose="wave" act={frame < 20 ? 'tripIn' : 'hop'} at={frame < 20 ? 0 : 20} size={150} style={{ left: '50%', bottom: 70, marginLeft: -75 }} />
      <SettleSweep color={SKY} hold={hold} />
    </AbsoluteFill>
  )
}

function Numbers({ hold }: { hold: number }) {
  const frame = useCurrentFrame()
  const stats: [number, string, string, string][] = [[6, '', 'Realms', LIME], [350, '+', 'Levels', SKY], [72, '', 'Boss Puzzles', ORANGE], [50, '+', 'Unlockables', PINK]]
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 40%, ${BG2}, ${BG})` }}>
      <PlayfulBG tint={LIME} />
      <Bokeh color={LIME} count={7} big />
      <Alive intensity={1}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          {/* FIXED-WIDTH slots so the row stays centered & stable as items reveal
              in place (spreading reveals in a plain flex row made it reflow/jump) */}
          <div style={{ display: 'flex', gap: 20 }}>
            {stats.map(([v, suf, l, c], i) => {
              const at = sustained(i, stats.length, hold, 8)   // count-ups spread across the beat
              const pop = spring({ frame: frame - at, fps: FPS, config: { damping: 11, stiffness: 200 } })
              const shown = clamp(pop, 0, 1)
              const bob = shown > 0.9 ? Math.sin((frame - at) * 0.11 + i) * 4 : 0
              return (
                <div key={i} style={{ width: 320, textAlign: 'center', opacity: shown, transform: `scale(${0.6 + shown * 0.4}) translateY(${bob}px)` }}>
                  <div style={{ fontFamily: ROUND, fontWeight: 800, fontSize: 120, color: c, textShadow: `0 5px 0 rgba(0,0,0,0.25), 0 0 ${26 + Math.sin(frame * 0.09 + i) * 10}px ${c}55` }}><CountUp to={v} suffix={suf} startAt={at} dur={22} /></div>
                  <div style={{ fontFamily: BODY, fontWeight: 700, fontSize: 26, color: WHITE, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 4 }}>{l}</div>
                </div>
              )
            })}
          </div>
        </AbsoluteFill>
      </Alive>
      <SettleSweep color={LIME} hold={hold} />
    </AbsoluteFill>
  )
}

function Promises({ hold }: { hold: number }) {
  const frame = useCurrentFrame()
  const items = [['🚫', 'No Forced Ads', PINK], ['📴', 'Offline Play', SKY], ['🎵', 'We Support Artists', ORANGE]]
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 40%, ${BG2}, ${BG})` }}>
      <PlayfulBG tint={PINK} />
      <Alive intensity={1}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 26 }}>
          {items.map(([ic, t, c], i) => {
            const at = sustained(i, items.length, hold, 8)   // rows spread across the beat
            const x = interpolate(frame, [at, at + 12], [-60, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
            const o = interpolate(frame, [at, at + 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
            const settled = frame > at + 14
            const bob = settled ? Math.sin((frame - at) * 0.1 + i) * 3 : 0
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 24, opacity: o, transform: `translateX(${x}px) translateY(${bob}px)`, background: PANEL, borderRadius: 18, padding: '22px 44px', border: `2px solid ${c}55`, boxShadow: `0 0 ${Math.abs(Math.sin(frame * 0.08 + i)) * 18}px ${c}33` }}>
                <div style={{ fontSize: 56, transform: `rotate(${Math.sin(frame * 0.12 + i) * 5}deg)` }}>{ic}</div>
                <div style={{ fontFamily: ROUND, fontWeight: 800, fontSize: 54, color: c as string }}>{t}</div>
              </div>
            )
          })}
        </AbsoluteFill>
      </Alive>
      <SettleSweep color={PINK} hold={hold} />
    </AbsoluteFill>
  )
}

function Daily({ hold }: { hold: number }) {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const phone = spring({ frame: frame - 2, fps, config: { damping: 13, stiffness: 130 } })
  const feats = ['Daily Streaks', 'Challenges', 'Leaderboards']
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 40% 40%, ${BG2}, ${BG})` }}>
      <PlayfulBG tint={SKY} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 80 }}>
        {/* phone mockup with the real screenshot */}
        <div style={{ transform: `scale(${0.7 + clamp(phone, 0, 1) * 0.3}) rotate(-4deg)`, borderRadius: 40, padding: 10, background: '#0a0c18', boxShadow: `0 0 0 4px ${SKY}55, 0 30px 60px rgba(0,0,0,0.6)` }}>
          <Img src={staticFile('bloxify/screen-zen.jpg')} style={{ width: 250, height: 528, objectFit: 'cover', borderRadius: 32, display: 'block' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontFamily: ROUND, fontWeight: 800, fontSize: 60, color: WHITE }}>Play every day.</div>
          {feats.map((f, i) => {
            const at = 14 + i * 8
            const o = interpolate(frame, [at, at + 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
            const x = interpolate(frame, [at, at + 10], [40, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
            return <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, opacity: o, transform: `translateX(${x}px)` }}><Blk c={COLORS[i]} size={34} /><span style={{ fontFamily: BODY, fontWeight: 700, fontSize: 38, color: CREAM }}>{f}</span></div>
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

function Launch({ hold }: { hold: number }) {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const pop = spring({ frame: frame - 2, fps, config: { damping: 12, stiffness: 160 } })
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 40%, ${BG2}, ${BG})` }}>
      <PlayfulBG tint={ORANGE} />
      <Bokeh color={ORANGE} count={8} big />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontFamily: BODY, fontWeight: 800, fontSize: 30, letterSpacing: '0.22em', textTransform: 'uppercase', color: MUTE, opacity: clamp((frame - 4) / 8, 0, 1) }}>Launching on Google Play</div>
        <div style={{ fontFamily: ROUND, fontWeight: 800, fontSize: 180, color: 'transparent', backgroundImage: `linear-gradient(180deg, ${ORANGE}, ${PINK})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', transform: `scale(${0.7 + clamp(pop, 0, 1) * 0.3})`, textShadow: `0 0 40px ${ORANGE}33`, lineHeight: 1 }}>JUNE 4</div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

function CTACard({ hold }: { hold: number }) {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const wm = spring({ frame: frame - 2, fps, config: { damping: 13, stiffness: 140 } })
  const mascot = spring({ frame: frame - 10, fps, config: { damping: 9, stiffness: 170 } })
  const btn = spring({ frame: frame - 30, fps, config: { damping: 11, stiffness: 180 } })
  const url = interpolate(frame, [50, 62], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const pulse = 1 + Math.sin(frame * 0.14) * 0.03
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 40%, ${BG2}, ${BG})` }}>
      <PlayfulBG tint={ORANGE} />
      <Bokeh color={PINK} count={7} big />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
        <Img src={staticFile('bloxify/wordmark.png')} style={{ width: 560, height: 'auto', transform: `scale(${0.7 + clamp(wm, 0, 1) * 0.3})`, filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.5))' }} />
        <div style={{ fontFamily: ROUND, fontWeight: 700, fontSize: 40, color: MUTE, marginTop: 8, opacity: clamp((frame - 14) / 8, 0, 1) }}>Block Puzzle, <span style={{ color: ORANGE }}>Reimagined.</span></div>
        <div style={{ marginTop: 34, opacity: clamp(btn, 0, 1), transform: `scale(${(0.7 + clamp(btn, 0, 1) * 0.3) * pulse})` }}>
          <div style={{ background: `linear-gradient(180deg, ${ORANGE}, ${shade(ORANGE, -30)})`, color: WHITE, fontFamily: ROUND, fontWeight: 800, fontSize: 40, padding: '20px 60px', borderRadius: 18, boxShadow: `0 6px 0 ${shade(ORANGE, -50)}, 0 12px 26px rgba(0,0,0,0.4)` }}>Notify Me →</div>
        </div>
        <div style={{ fontFamily: BODY, fontWeight: 700, fontSize: 28, color: MUTE, marginTop: 24, opacity: url }}>bloxify.app · June 4 on Google Play</div>
      </AbsoluteFill>
      {/* Blox trips into frame, stumbles, then cheers by the CTA */}
      <Mascot pose="celebrate" act={frame < 30 ? 'tripIn' : 'cheer'} at={frame < 30 ? 6 : 30} size={230} style={{ left: 180, bottom: 70 }} />
    </AbsoluteFill>
  )
}

// beat-lock — shared plumbing (lib/audio); per-brand tuning stays here
const rawStarts: number[] = []; { let t = 0; for (const b of BEATS) { rawStarts.push(t); t += b.dur } }
const B_STARTS = beatLock(rawStarts, gridToFrames((bxGrid as any).beats, FPS), Math.round(0.18 * FPS))
export const bloxifyDuration = B_STARTS[B_STARTS.length - 1] + BEATS[BEATS.length - 1].dur + 6

export const CommercialBloxify: React.FC = () => {
  const starts = B_STARTS
  const durs = durationsFromStarts(starts, bloxifyDuration - 6)
  const total = bloxifyDuration
  const voWin = BEATS.map((b, i) => b.vo ? { start: starts[i], end: starts[i] + durs[i] } : null).filter(Boolean) as VoWindow[]
  const musicDuck = makeMusicDuck(voWin, total, { loud: 0.22, duck: 0.09, ramp: 18, fadeInEnd: 14 })
  return (
    <AbsoluteFill style={{ background: BG }}>
      {BEATS.map((b, i) => (
        <Sequence key={i} from={starts[i]} durationInFrames={durs[i] + 6}>
          {b.el}
        </Sequence>
      ))}
      <MusicBed src="bloxify/music.mp3" musicFrames={1020} volume={musicDuck} />
      {BEATS.map((b, i) => b.vo ? (
        <Sequence key={'vo' + i} from={starts[i]}><Audio src={staticFile(`bloxify/${b.vo}.mp3`)} volume={1.0} /></Sequence>
      ) : null)}
      {starts.slice(1).map((st, i) => (
        <Sequence key={'w' + i} from={st - 3} durationInFrames={16}><Audio src={staticFile('sfx/whoosh-short.wav')} volume={0.22} /></Sequence>
      ))}
      {/* satisfying pop on the block CLEAR */}
      <Sequence from={starts[2] + 40} durationInFrames={20}><Audio src={staticFile('sfx/impact-soft.wav')} volume={0.4} /></Sequence>
    </AbsoluteFill>
  )
}
