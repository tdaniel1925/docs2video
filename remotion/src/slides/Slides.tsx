import React from 'react'
import { Img, staticFile, useCurrentFrame, useVideoConfig, spring } from 'remotion'
import { loadFont as loadMont } from '@remotion/google-fonts/Montserrat'
import { loadFont as loadSans } from '@remotion/google-fonts/SourceSans3'
import { FitOdometer } from '../charts/Odometer'
import { legibleOn, type Palette } from '../charts/Charts'
import type { GPalette } from '../cinematic/Glass'
import { Fit } from '../lib/fit'

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
 *
 * Every word here comes from a model reading somebody's document, so every text
 * slot either shrinks to its box (lib/fit <Fit>) or wraps inside a box whose
 * group is shrunk by the layout (<FitBox> in DirectedVideo). Nothing is cut.
 */

// ---- shared slide heading (topic line, accent kicker + rule) ----
// Fills its parent's width; the heading shrinks until it fits `lines` lines.
export const SlideHeading: React.FC<{ kicker?: string; heading: string; at: number; palette: GPalette; align?: 'left' | 'center'; lines?: number }> =
({ kicker, heading, at, palette, align = 'left', lines = 3 }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const s = spring({ frame: frame - at, fps, config: { damping: 18, stiffness: 130 } })
  const acc = legibleOn(palette.accent, palette.bg, palette as Palette)
  return (
    <div style={{ width: '100%', minWidth: 0, textAlign: align, opacity: s, transform: `translateY(${(1 - s) * 22}px)` }}>
      {kicker && <Fit max={sc(22)} min={16} lines={2} style={{ fontFamily: SANS, fontWeight: 800, letterSpacing: '0.26em', textTransform: 'uppercase', color: acc, marginBottom: sc(14), lineHeight: 1.2 }}>{kicker}</Fit>}
      <Fit max={sc(74)} min={sc(40)} lines={lines} style={{ fontFamily: MONT, fontWeight: 800, lineHeight: 1.04, color: palette.text, letterSpacing: '0.002em', textShadow: '0 3px 24px rgba(0,0,0,0.6)' }}>{heading}</Fit>
      <div style={{ width: sc(96), height: 4, borderRadius: 2, background: acc, marginTop: sc(22), marginLeft: align === 'center' ? 'auto' : 0, marginRight: align === 'center' ? 'auto' : 0, transform: `scaleX(${clamp((frame - at) / 12, 0, 1)})`, transformOrigin: align === 'center' ? 'center' : 'left', boxShadow: `0 0 18px ${hexA(acc, 0.6)}` }} />
    </div>
  )
}

export type Bullet = { text: string; highlight?: string; cueFrame?: number }

// ---- ANIMATED BULLET LIST — each bullet slides in at its own cueFrame; the
// key phrase (highlight) is lit in accent when the bullet lands. Bullets wrap
// to their column; a list too tall for its slide is shrunk as a group by the
// layout (FitBox), so the text stays one size across the list. ----
export const BulletList: React.FC<{ items: Bullet[]; sceneStart: number; palette: GPalette; size?: number }> =
({ items, sceneStart, palette, size = sc(40) }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const acc = legibleOn(palette.accent, palette.bg, palette as Palette)
  // gap + tick derive from the (already-scaled) font size so spacing stays
  // proportional at any SCALE — bigger text, proportionally bigger breathing room.
  const gap = Math.round(size * 0.72), tick = Math.round(size * 0.38)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap, minWidth: 0 }}>
      {items.map((b, i) => {
        // default staggered cue if the Director didn't time it
        const at = b.cueFrame ?? sceneStart + 18 + i * 20
        const s = spring({ frame: frame - at, fps, config: { damping: 20, stiffness: 130 } })
        const lit = frame >= at + 4   // highlight fires just after the bullet lands
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: Math.round(size * 0.5), opacity: s, transform: `translateX(${Math.min(0, (1 - s) * -34)}px)` }}>
            {/* accent tick that draws in */}
            <div style={{ marginTop: size * 0.3, width: tick, height: tick, borderRadius: 3, background: acc, boxShadow: `0 0 14px ${hexA(acc, 0.7)}`, transform: `scale(${clamp((frame - at) / 8, 0, 1)})`, flexShrink: 0 }} />
            <div style={{ flex: '1 1 0', fontFamily: SANS, fontWeight: 600, fontSize: size, lineHeight: 1.24, color: palette.text, textShadow: '0 2px 14px rgba(0,0,0,0.6)', overflowWrap: 'anywhere', minWidth: 0 }}>
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

// ---- DATA / COMPARISON CARDS — 2-5 stat tiles side by side (6+ wrap to two
// rows); numbers count up (via Odometer) when their card lands. `accent:true`
// marks the "winner" card. Every card has a fixed width, and its label, value
// and note each shrink to that width (lib/fit) — "100% High Cap Rate Acct (S&P
// 500 Index)" arriving where "$10,000" was expected wraps and shrinks inside
// the card instead of running off the frame. ----
export const DataCards: React.FC<{ cards: Card[]; sceneStart: number; palette: GPalette; vs?: boolean }> =
({ cards, sceneStart, palette, vs }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const acc = legibleOn(palette.accent, palette.bg, palette as Palette)
  // dense rows (4-5 tiles, e.g. a pricing ladder) get tighter cards; 2-3 stay
  // roomy. Cards share a FIXED width so the row is even and predictable. More
  // than 5 wrap onto two rows rather than shrinking into slivers.
  const n = cards.length
  const perRow = n > 5 ? Math.ceil(n / 2) : n
  const many = perRow >= 4
  const gap = many ? sc(16) : sc(24)
  // card width scales with SCALE; a 5-card row is capped so it still fits 1920.
  const cardW = many ? (perRow >= 5 ? Math.min(sc(292), Math.floor((1720 - (perRow - 1) * 18) / perRow)) : sc(320)) : sc(400)
  const padX = many ? sc(24) : sc(34)
  // the value line's size: numbers roll in on the Odometer, words are text;
  // both shrink to the card's inner width.
  const capBig = many ? sc(60) : sc(82)
  return (
    <div style={{ display: 'flex', gap, alignItems: 'stretch', justifyContent: 'center', flexWrap: n > 5 ? 'wrap' : 'nowrap', maxWidth: n > 5 ? perRow * cardW + (perRow - 1) * gap : undefined }}>
      {cards.map((c, i) => {
        const at = c.cueFrame ?? sceneStart + 20 + i * 16
        const s = spring({ frame: frame - at, fps, config: { damping: 18, stiffness: 120 } })
        const num = parseNum(c.value)
        const win = c.accent
        return (
          <React.Fragment key={i}>
            <div style={{
              position: 'relative', width: cardW, flexShrink: 0, boxSizing: 'border-box', padding: `${many ? sc(28) : sc(36)}px ${padX}px`, borderRadius: 10,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
              background: win ? hexA(palette.accent, 0.14) : hexA(palette.bg, 0.4), backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
              border: `1.5px solid ${win ? hexA(acc, 0.6) : hexA(palette.text, 0.2)}`, boxShadow: win ? `0 0 46px ${hexA(acc, 0.3)}, 0 20px 50px rgba(0,0,0,0.45)` : '0 18px 46px rgba(0,0,0,0.45)',
              opacity: s, transform: `translateY(${(1 - s) * 30}px) scale(${Math.min(1, 0.94 + s * 0.06)})`, textAlign: 'center',
            }}>
              {win && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, transparent, ${acc}, transparent)` }} />}
              {c.label ? (
                <Fit max={many ? sc(15) : sc(18)} min={14} lines={2} style={{ fontFamily: SANS, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: win ? acc : palette.muted, marginBottom: many ? sc(14) : sc(18), lineHeight: 1.2 }}>{c.label}</Fit>
              ) : null}
              {/* value line — shrinks to the card's inner width, so it can never spill the card */}
              {num != null
                ? <FitOdometer value={num.value} at={at + 8} max={capBig} min={Math.round(capBig * 0.35)} color={win ? acc : palette.text} prefix={num.prefix} suffix={num.suffix} decimals={num.decimals} />
                : c.value ? <Fit max={capBig} min={Math.round(capBig * 0.3)} lines={2} style={{ fontFamily: MONT, fontWeight: 800, lineHeight: 1.08, color: win ? acc : palette.text }}>{c.value}</Fit> : null}
              {c.sub && <Fit max={many ? sc(15) : sc(20)} min={14} lines={3} style={{ fontFamily: SANS, fontWeight: 600, color: palette.muted, marginTop: many ? sc(12) : sc(16), lineHeight: 1.3 }}>{c.sub}</Fit>}
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
// ONLY when the whole value IS a number: "$100–$200/mo", "Oct 10, 2026 – Oct 10,
// 2027", "8–12%" or "100% High Cap Rate Acct" used to become "$100/mo", "10",
// "8%", "100%" — the rest silently dropped. Those now show as written.
function parseNum(raw: string): { value: number; prefix: string; suffix: string; decimals: number } | null {
  const m = String(raw ?? '').trim().match(/^(~?\$?)\s?(-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?)\s?(%|\/mo|\/yr|\/year|\/month|k|K|M|s|x|\+)?$/)
  if (!m) return null
  const value = parseFloat(m[2].replace(/,/g, ''))
  if (!Number.isFinite(value)) return null
  return { value, prefix: m[1] || '', suffix: m[4] || '', decimals: m[3] ? Math.min(2, m[3].length) : 0 }
}

export type Pin = { x: number; y: number; label: string; cueFrame?: number }

// ---- SCREENSHOT FRAME — the REAL website in a browser-chrome mockup with a
// slow push-in, plus optional annotation pins that pop at their cue. This is the
// "why aren't we using screenshots" fix. Pins stay inside the screenshot: a pin
// near an edge grows away from that edge, and its label wraps/shrinks (at most
// half the screenshot wide). ----
export const ScreenshotFrame: React.FC<{ file: string; at: number; palette: GPalette; pins?: Pin[]; sceneStart: number; width?: number; imgHeight?: number }> =
({ file, at, palette, pins = [], sceneStart, width = sc(1120), imgHeight = sc(560) }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const s = spring({ frame: frame - at, fps, config: { damping: 20, stiffness: 110 } })
  const push = 1 + clamp((frame - at) / 200, 0, 1) * 0.06   // slow living push-in
  const acc = legibleOn(palette.accent, palette.bg, palette as Palette)
  return (
    <div style={{ position: 'relative', width, borderRadius: 10, overflow: 'hidden', border: `1.5px solid ${hexA(palette.text, 0.22)}`, boxShadow: `0 40px 90px rgba(0,0,0,0.6), 0 0 60px ${hexA(palette.accent, 0.18)}`, opacity: s, transform: `translateY(${(1 - s) * 40}px) scale(${Math.min(1, 0.94 + s * 0.06)})` }}>
      {/* browser chrome bar */}
      <div style={{ height: 46, background: hexA(palette.bg, 0.9), display: 'flex', alignItems: 'center', gap: 9, padding: '0 20px', borderBottom: `1px solid ${hexA(palette.text, 0.12)}` }}>
        {['#ff5f57', '#febc2e', '#28c840'].map((c) => <div key={c} style={{ width: 13, height: 13, borderRadius: '50%', background: c, opacity: 0.85 }} />)}
        <div style={{ flex: 1, marginLeft: 12, height: 24, borderRadius: 6, background: hexA(palette.text, 0.08), display: 'flex', alignItems: 'center', paddingLeft: 14, fontFamily: SANS, fontSize: 14, color: palette.muted, letterSpacing: '0.04em' }}>{'•'} secure</div>
      </div>
      {/* fixed-height viewport so a tall page can't blow out the slide — shows the
          top of the page (the hero), the meaningful part, and crops the rest. */}
      <div style={{ position: 'relative', overflow: 'hidden', background: palette.bg, height: imgHeight }}>
        {/* The pins below are annotations placed ON this picture on purpose. */}
        <Img data-overflow-ok="annotation pins sit on the screenshot by design" src={staticFile(file)} style={{ width: '100%', display: 'block', transform: `scale(${push})`, transformOrigin: '50% 0%' }} />
        {/* annotation pins */}
        {pins.map((p, i) => {
          const pat = p.cueFrame ?? sceneStart + 30 + i * 22
          const ps = spring({ frame: frame - pat, fps, config: { damping: 14, stiffness: 200 } })
          const px = clamp(Number(p.x) || 0, 0, 100), py = clamp(Number(p.y) || 0, 0, 100)
          // The pill gets a WIDTH worked out from its label (at most half the
          // screenshot), so the label inside it can shrink to a fixed box — a
          // pill that sized itself to its own text would chase the text's size.
          const padX = sc(14), dot = sc(9), gap = sc(10)
          const pillW = Math.round(Math.min(width * 0.46, String(p.label || '').length * sc(19) * 0.56 + padX * 2 + dot + gap + 4))
          return (
            // placed so the pill always contains its point AND stays inside the screenshot
            <div key={i} style={{ position: 'absolute', left: (px / 100) * (width - pillW), top: `${py}%`, width: pillW, boxSizing: 'border-box', transform: `translateY(-${py}%) scale(${Math.min(1, ps)})`, transformOrigin: `${px}% ${py}%`, opacity: ps, display: 'flex', alignItems: 'center', gap, background: hexA(palette.bg, 0.92), border: `1.5px solid ${acc}`, borderRadius: 8, padding: `${sc(8)}px ${padX}px`, boxShadow: `0 6px 24px rgba(0,0,0,0.5), 0 0 20px ${hexA(acc, 0.4)}` }}>
              <div style={{ width: dot, height: dot, borderRadius: '50%', background: acc, boxShadow: `0 0 10px ${acc}`, flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: '1 1 0' }}>
                <Fit max={sc(19)} min={14} lines={2} style={{ fontFamily: SANS, fontWeight: 700, color: palette.text, lineHeight: 1.2 }}>{p.label}</Fit>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
