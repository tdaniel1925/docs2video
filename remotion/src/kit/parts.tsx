import React from 'react'
import { AbsoluteFill, Img, useCurrentFrame } from 'remotion'
import { staticFile } from '../lib/asset'
import { Fit } from '../lib/fit'
import { formatFigure, rgba, VO_LEAD, type Figure, type KitScene } from './spec'
import { GRID, MIN_TEXT, useKit } from './theme'
import { Alive, LateSweep, settleStyle, useSettle } from './motion'

// Shared building blocks for the eight scenes. Every piece of words is a <Fit>
// (lib/fit.tsx): it shrinks to its box and can never leave the frame.

/** What every scene is told about its own timing (scene frames). */
export type SceneTiming = {
  /** The scene's full length in frames (with its cut in and out). */
  dur: number
  /** Frame the voice starts. */
  voStart: number
  /** Voice length in frames (no voice → a stand-in length so reveals still spread). */
  voFrames: number
  /** True when there is no real voice (the free preview still). */
  silent: boolean
}
export type SceneProps<S extends KitScene> = { scene: S; timing: SceneTiming }

/** Reveal window inside the voice: items arrive from ~10% to ~72% of it. */
export function revealWindow(tm: SceneTiming): [number, number] {
  const from = tm.voStart + Math.max(8, Math.round(tm.voFrames * 0.08))
  const to = tm.voStart + Math.max(40, Math.round(tm.voFrames * 0.72))
  return [from, Math.max(from + 20, to)]
}

/** The content box every scene lays out in. */
export const Stage: React.FC<{ children: React.ReactNode; timing: SceneTiming; sweep?: boolean; style?: React.CSSProperties }> = ({ children, timing, sweep = true, style }) => {
  const { t } = useKit()
  return (
    <AbsoluteFill>
      <Alive>
        <div style={{ position: 'absolute', left: GRID.side, top: GRID.top, width: GRID.width, height: GRID.height, ...style }}>
          {children}
        </div>
      </Alive>
      {sweep && timing.dur > 200 ? <LateSweep at={Math.round(timing.dur * 0.64)} color={rgba(t.dark ? '#ffffff' : t.accent, t.dark ? 0.5 : 0.35)} /> : null}
    </AbsoluteFill>
  )
}

/** Small uppercase label in the accent ink ("eyebrow"). */
export const Eyebrow: React.FC<{ children: React.ReactNode; at: number; width: number; align?: 'left' | 'center' | 'right'; size?: number; lines?: number }> = ({ children, at, width, align = 'left', size = 30, lines = 2 }) => {
  const { t, body, upper } = useKit()
  const p = useSettle(at)
  return (
    <div style={{ width, ...settleStyle(p, { rise: 14 }) }}>
      <Fit max={size} min={MIN_TEXT.label} lines={lines} style={{ fontFamily: body, fontWeight: 700, color: t.accentInk, letterSpacing: upper ? '0.16em' : '0.02em', textTransform: upper ? 'uppercase' : 'none', lineHeight: 1.25, textAlign: align }}>{children}</Fit>
    </div>
  )
}

/** A scene heading in the headline font. */
export const Heading: React.FC<{ text: string; at: number; width: number; max?: number; lines?: number; align?: 'left' | 'center' }> = ({ text, at, width, max = 78, lines = 2, align = 'left' }) => {
  const { t, head, headWeight } = useKit()
  const p = useSettle(at)
  return (
    <div style={{ width, ...settleStyle(p, { rise: 24 }) }}>
      <Fit max={max} min={MIN_TEXT.heading} lines={lines} style={{ fontFamily: head, fontWeight: headWeight, color: t.text, lineHeight: 1.12, letterSpacing: '-0.01em', textAlign: align, paddingBottom: '0.06em' }}>{text}</Fit>
    </div>
  )
}

/** A growing accent rule under a heading. */
export const Rule: React.FC<{ at: number; width?: number; align?: 'left' | 'center' }> = ({ at, width = 160, align = 'left' }) => {
  const { t } = useKit()
  const p = useSettle(at, 24)
  return <div style={{ height: 5, width: width * p, background: t.accentBig, borderRadius: 2, margin: align === 'center' ? '0 auto' : undefined }} />
}

/** Body copy (muted). */
export const Body: React.FC<{ text: string; at: number; width: number; max?: number; lines?: number; align?: 'left' | 'center'; color?: string }> = ({ text, at, width, max = 44, lines = 2, align = 'left', color }) => {
  const { t, body } = useKit()
  const p = useSettle(at)
  return (
    <div style={{ width, ...settleStyle(p, { rise: 16 }) }}>
      <Fit max={max} min={MIN_TEXT.body} lines={lines} style={{ fontFamily: body, fontWeight: 500, color: color ?? t.muted, lineHeight: 1.3, textAlign: align }}>{text}</Fit>
    </div>
  )
}

/**
 * A number that counts up to its value. Sized against the FINAL text, so it
 * never jitters while counting; written the house way ($ and commas).
 */
export const CountFigure: React.FC<{ figure: Figure; p: number; width: number; max: number; min?: number; color: string; weight?: number; align?: 'left' | 'center' | 'right'; glow?: number }> = ({ figure, p, width, max, min = MIN_TEXT.hero, color, weight, align = 'center', glow = 0 }) => {
  const { head, headWeight } = useKit()
  const final = formatFigure(figure)
  const shown = formatFigure(figure, p >= 1 ? figure.value : figure.value * p)
  return (
    <div style={{ width }}>
      <Fit max={max} min={min} lines={1} sizeFor={final} style={{ fontFamily: head, fontWeight: weight ?? Math.max(700, headWeight), color, lineHeight: 1.18, paddingBottom: '0.04em', letterSpacing: '-0.02em', textAlign: align, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', textShadow: glow > 0 ? `0 0 ${Math.round(40 * glow)}px ${color}` : undefined }}>{shown}</Fit>
    </div>
  )
}

/** A card on the page. */
export const Card: React.FC<{ children: React.ReactNode; accent?: boolean; style?: React.CSSProperties }> = ({ children, accent, style }) => {
  const { t } = useKit()
  return (
    <div style={{
      background: accent ? (t.dark ? rgba(t.accentBig, 0.1) : rgba(t.accentBig, 0.07)) : t.surface,
      border: `2px solid ${accent ? t.accentBig : t.surfaceLine}`,
      borderRadius: t.radius,
      boxShadow: accent ? `0 18px 60px ${rgba(t.accentBig, t.dark ? 0.22 : 0.16)}` : `0 14px 40px ${rgba('#000000', t.dark ? 0.28 : 0.07)}`,
      boxSizing: 'border-box',
      ...style,
    }}>{children}</div>
  )
}

/** The presenter's real photo in a portrait frame (never a drawn face). */
export const Portrait: React.FC<{ src: string; width: number; height: number; at: number }> = ({ src, width, height, at }) => {
  const { t } = useKit()
  const p = useSettle(at, 26)
  const frame = useCurrentFrame()
  const ring = Math.min(1, Math.max(0, (frame - at - 6) / 30))
  return (
    <div style={{ position: 'relative', width, height, ...settleStyle(p, { rise: 30, scale: 0.06 }) }}>
      <div style={{ position: 'absolute', inset: -14, border: `3px solid ${t.accentBig}`, borderRadius: t.radius + 4, clipPath: `inset(0 ${100 - ring * 100}% 0 0)` }} />
      <Img src={staticFile(src)} style={{ width, height, objectFit: 'cover', borderRadius: t.radius, display: 'block', boxShadow: `0 24px 70px ${rgba('#000000', t.dark ? 0.45 : 0.18)}` }} />
    </div>
  )
}

/** The frame the voice starts at for a scene (the timeline's lead-in). */
export const VOICE_AT = VO_LEAD
