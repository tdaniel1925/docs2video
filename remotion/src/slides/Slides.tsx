import React from 'react'
import { Img, staticFile, useCurrentFrame, useVideoConfig, spring } from 'remotion'
import { fitText } from '@remotion/layout-utils'
import { loadFont as loadMont } from '@remotion/google-fonts/Montserrat'
import { loadFont as loadSans } from '@remotion/google-fonts/SourceSans3'
import { Odometer } from '../charts/Odometer'
import { legibleOn, type Palette } from '../charts/Charts'
import type { GPalette } from '../cinematic/Glass'

const { fontFamily: MONT } = loadMont()
const { fontFamily: SANS } = loadSans()
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const hexA = (h: string, a: number) => { const n = (h || '#000').replace('#', ''); const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16); return `rgba(${r},${g},${b},${a})` }

// ---- GLOBAL SCALE — ONE knob that grows every slide element proportionally so
// content fills the frame without any slide drifting out of sync with the others.
// Every font size, gap, icon, card, and padding in the slide system multiplies
// through SCALE. Tune this single number to make everything bigger/smaller. ----
export const SCALE = 1.3
const sc = (n: number) => Math.round(n * SCALE)

/**
 * SLIDE BLOCKS — the toolkit that turns a scene from "one headline + 30s of
 * talking" into a real explainer slide: a topic heading with supporting content
 * (bullets, data/comparison cards, a screenshot) that ANIMATES IN SYNC with the
 * voiceover. Each block/bullet takes a `cueFrame` — the exact frame the narrator
 * says it — so reveals land on the word, and the key phrase lights in accent.
 *
 * All blocks share the cinematic palette + glass language so they sit naturally
 * on the photographic backdrops under the film grade + persistent chrome.
 */

// ---- shared slide heading (topic line, accent kicker + rule) ----
export const SlideHeading: React.FC<{ kicker?: string; heading: string; at: number; palette: GPalette; align?: 'left' | 'center' }> =
({ kicker, heading, at, palette, align = 'left' }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const s = spring({ frame: frame - at, fps, config: { damping: 18, stiffness: 130 } })
  const acc = legibleOn(palette.accent, palette.bg, palette as Palette)
  return (
    <div style={{ textAlign: align, opacity: s, transform: `translateY(${(1 - s) * 22}px)` }}>
      {kicker && <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: sc(22), letterSpacing: '0.26em', textTransform: 'uppercase', color: acc, marginBottom: sc(14) }}>{kicker}</div>}
      <div style={{ fontFamily: MONT, fontWeight: 800, fontSize: sc(74), lineHeight: 1.04, color: palette.text, letterSpacing: '0.002em', textShadow: '0 3px 24px rgba(0,0,0,0.6)' }}>{heading}</div>
      <div style={{ width: sc(96), height: 4, borderRadius: 2, background: acc, marginTop: sc(22), marginLeft: align === 'center' ? 'auto' : 0, marginRight: align === 'center' ? 'auto' : 0, transform: `scaleX(${clamp((frame - at) / 12, 0, 1)})`, transformOrigin: align === 'center' ? 'center' : 'left', boxShadow: `0 0 18px ${hexA(acc, 0.6)}` }} />
    </div>
  )
}

export type Bullet = { text: string; highlight?: string; cueFrame?: number }

// ---- ANIMATED BULLET LIST — each bullet slides in at its own cueFrame; the
// key phrase (highlight) is lit in accent when the bullet lands. ----
export const BulletList: React.FC<{ items: Bullet[]; sceneStart: number; palette: GPalette; size?: number }> =
({ items, sceneStart, palette, size = sc(40) }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const acc = legibleOn(palette.accent, palette.bg, palette as Palette)
  // gap + tick derive from the (already-scaled) font size so spacing stays
  // proportional at any SCALE — bigger text, proportionally bigger breathing room.
  const gap = Math.round(size * 0.72), tick = Math.round(size * 0.38)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      {items.map((b, i) => {
        // default staggered cue if the Director didn't time it
        const at = b.cueFrame ?? sceneStart + 18 + i * 20
        const s = spring({ frame: frame - at, fps, config: { damping: 20, stiffness: 130 } })
        const lit = frame >= at + 4   // highlight fires just after the bullet lands
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: Math.round(size * 0.5), opacity: s, transform: `translateX(${(1 - s) * -34}px)` }}>
            {/* accent tick that draws in */}
            <div style={{ marginTop: size * 0.3, width: tick, height: tick, borderRadius: 3, background: acc, boxShadow: `0 0 14px ${hexA(acc, 0.7)}`, transform: `scale(${clamp((frame - at) / 8, 0, 1)})`, flexShrink: 0 }} />
            <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: size, lineHeight: 1.24, color: palette.text, textShadow: '0 2px 14px rgba(0,0,0,0.6)', overflowWrap: 'anywhere', minWidth: 0 }}>
              {renderWithHighlight(b.text, b.highlight, acc, lit)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// split a bullet's text and wrap the highlight phrase in an accent-lit span that
// "turns on" (color + underline glow) when the narrator reaches it.
function renderWithHighlight(text: string, highlight: string | undefined, acc: string, lit: boolean) {
  if (!highlight) return text
  const i = text.toLowerCase().indexOf(highlight.toLowerCase())
  if (i < 0) return text
  const before = text.slice(0, i), mid = text.slice(i, i + highlight.length), after = text.slice(i + highlight.length)
  return (<>{before}<span style={{ color: lit ? acc : 'inherit', fontWeight: 800, transition: 'color 0.2s', textShadow: lit ? `0 0 18px ${hexA(acc, 0.5)}` : 'none', borderBottom: lit ? `3px solid ${hexA(acc, 0.7)}` : '3px solid transparent', paddingBottom: 1 }}>{mid}</span>{after}</>)
}

export type Card = { label: string; value: string; sub?: string; accent?: boolean; cueFrame?: number }

// ---- DATA / COMPARISON CARDS — 2-4 stat tiles side by side; numbers count up
// (via Odometer) when their card lands. `accent:true` marks the "winner" card. ----
export const DataCards: React.FC<{ cards: Card[]; sceneStart: number; palette: GPalette; vs?: boolean }> =
({ cards, sceneStart, palette, vs }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const acc = legibleOn(palette.accent, palette.bg, palette as Palette)
  // dense rows (4-5 tiles, e.g. a pricing ladder) get tighter cards; 2-3 stay
  // roomy. Cards share a FIXED width so the row is even and predictable.
  const n = cards.length
  const many = n >= 4
  // card width scales with SCALE; a 5-card row is capped so it still fits 1920.
  const cardW = many ? (n >= 5 ? Math.min(sc(292), Math.floor((1720 - (n - 1) * 18) / n)) : sc(320)) : sc(400)
  const padX = many ? sc(24) : sc(34)
  const innerW = cardW - padX * 2
  // AUTO-FIT each number to the card's inner width — this is the fix for numbers
  // spilling out. We measure the FULL rendered string (prefix+value+suffix) and
  // pick the largest font that fits, capped so short values ($0) don't balloon.
  const capBig = many ? sc(60) : sc(82)
  const fitNum = (raw: string) => {
    const num = parseNum(raw)
    const shown = num != null ? `${num.prefix}${Math.round(num.value).toLocaleString('en-US')}${num.suffix}` : raw
    const { fontSize } = fitText({ text: shown, withinWidth: innerW, fontFamily: MONT, fontWeight: 800 })
    return { num, size: Math.min(capBig, Math.floor(fontSize)) }
  }
  return (
    <div style={{ display: 'flex', gap: many ? sc(16) : sc(24), alignItems: 'stretch', justifyContent: 'center', flexWrap: 'nowrap', maxWidth: 1820 }}>
      {cards.map((c, i) => {
        const at = c.cueFrame ?? sceneStart + 20 + i * 16
        const s = spring({ frame: frame - at, fps, config: { damping: 18, stiffness: 120 } })
        const { num, size } = fitNum(c.value)
        const win = c.accent
        return (
          <React.Fragment key={i}>
            <div style={{
              position: 'relative', width: cardW, flexShrink: 0, padding: `${many ? sc(28) : sc(36)}px ${padX}px`, borderRadius: 10,
              display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'hidden',
              background: win ? hexA(palette.accent, 0.14) : hexA(palette.bg, 0.4), backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
              border: `1.5px solid ${win ? hexA(acc, 0.6) : hexA(palette.text, 0.2)}`, boxShadow: win ? `0 0 46px ${hexA(acc, 0.3)}, 0 20px 50px rgba(0,0,0,0.45)` : '0 18px 46px rgba(0,0,0,0.45)',
              opacity: s, transform: `translateY(${(1 - s) * 30}px) scale(${0.94 + s * 0.06})`, textAlign: 'center',
            }}>
              {win && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, transparent, ${acc}, transparent)` }} />}
              <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: many ? sc(15) : sc(18), letterSpacing: '0.14em', textTransform: 'uppercase', color: win ? acc : palette.muted, marginBottom: many ? sc(14) : sc(18), maxWidth: '100%' }}>{c.label}</div>
              {/* number line — width-clamped so it can never spill the card */}
              <div style={{ width: innerW, height: size * 1.34, display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
                {num != null
                  ? <Odometer value={num.value} at={at + 8} size={size} color={win ? acc : palette.text} prefix={num.prefix} suffix={num.suffix} />
                  : <div style={{ fontFamily: MONT, fontWeight: 800, fontSize: size, lineHeight: 1, color: win ? acc : palette.text, whiteSpace: 'nowrap' }}>{c.value}</div>}
              </div>
              {c.sub && <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: many ? sc(15) : sc(20), color: palette.muted, marginTop: many ? sc(12) : sc(16), lineHeight: 1.3, maxWidth: '100%' }}>{c.sub}</div>}
            </div>
            {vs && i === 0 && cards.length === 2 && (
              <div style={{ display: 'flex', alignItems: 'center', fontFamily: MONT, fontWeight: 800, fontSize: sc(30), color: palette.muted, opacity: spring({ frame: frame - at - 8, fps, config: { damping: 16, stiffness: 140 } }) }}>vs</div>
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// "$399/mo" | "$15,000" | "15s" | "10" → { value, prefix, suffix } for the odometer.
function parseNum(raw: string): { value: number; prefix: string; suffix: string } | null {
  const m = String(raw).replace(/,/g, '').match(/-?\d+(\.\d+)?/)
  if (!m) return null
  return { value: parseFloat(m[0]), prefix: /\$/.test(raw) ? '$' : '', suffix: /%/.test(raw) ? '%' : /\/mo|per month/i.test(raw) ? '/mo' : /\bs(ec)?\b/i.test(raw) ? 's' : /k\b/i.test(raw) ? 'k' : '' }
}

export type Pin = { x: number; y: number; label: string; cueFrame?: number }

// ---- SCREENSHOT FRAME — the REAL website in a browser-chrome mockup with a
// slow push-in, plus optional annotation pins that pop at their cue. This is the
// "why aren't we using screenshots" fix. ----
export const ScreenshotFrame: React.FC<{ file: string; at: number; palette: GPalette; pins?: Pin[]; sceneStart: number; width?: number; imgHeight?: number }> =
({ file, at, palette, pins = [], sceneStart, width = sc(1120), imgHeight = sc(560) }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const s = spring({ frame: frame - at, fps, config: { damping: 20, stiffness: 110 } })
  const push = 1 + clamp((frame - at) / 200, 0, 1) * 0.06   // slow living push-in
  const acc = legibleOn(palette.accent, palette.bg, palette as Palette)
  return (
    <div style={{ position: 'relative', width, borderRadius: 12, overflow: 'hidden', border: `1.5px solid ${hexA(palette.text, 0.22)}`, boxShadow: `0 40px 90px rgba(0,0,0,0.6), 0 0 60px ${hexA(palette.accent, 0.18)}`, opacity: s, transform: `translateY(${(1 - s) * 40}px) scale(${(0.94 + s * 0.06)})` }}>
      {/* browser chrome bar */}
      <div style={{ height: 46, background: hexA(palette.bg, 0.9), display: 'flex', alignItems: 'center', gap: 9, padding: '0 20px', borderBottom: `1px solid ${hexA(palette.text, 0.12)}` }}>
        {['#ff5f57', '#febc2e', '#28c840'].map((c) => <div key={c} style={{ width: 13, height: 13, borderRadius: '50%', background: c, opacity: 0.85 }} />)}
        <div style={{ flex: 1, marginLeft: 12, height: 24, borderRadius: 6, background: hexA(palette.text, 0.08), display: 'flex', alignItems: 'center', paddingLeft: 14, fontFamily: SANS, fontSize: 14, color: palette.muted, letterSpacing: '0.04em' }}>{'•'} secure</div>
      </div>
      {/* fixed-height viewport so a tall page can't blow out the slide — shows the
          top of the page (the hero), the meaningful part, and crops the rest. */}
      <div style={{ position: 'relative', overflow: 'hidden', background: palette.bg, height: imgHeight }}>
        <Img src={staticFile(file)} style={{ width: '100%', display: 'block', transform: `scale(${push})`, transformOrigin: '50% 0%' }} />
        {/* annotation pins */}
        {pins.map((p, i) => {
          const pat = p.cueFrame ?? sceneStart + 30 + i * 22
          const ps = spring({ frame: frame - pat, fps, config: { damping: 14, stiffness: 200 } })
          return (
            <div key={i} style={{ position: 'absolute', left: `${p.x}%`, top: `${p.y}%`, transform: `translate(-50%,-50%) scale(${ps})`, opacity: ps }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: sc(10), background: hexA(palette.bg, 0.92), border: `1.5px solid ${acc}`, borderRadius: 8, padding: `${sc(8)}px ${sc(14)}px`, boxShadow: `0 6px 24px rgba(0,0,0,0.5), 0 0 20px ${hexA(acc, 0.4)}`, whiteSpace: 'nowrap' }}>
                <div style={{ width: sc(9), height: sc(9), borderRadius: '50%', background: acc, boxShadow: `0 0 10px ${acc}` }} />
                <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: sc(19), color: palette.text }}>{p.label}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
