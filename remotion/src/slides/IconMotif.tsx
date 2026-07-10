import React from 'react'
import { useCurrentFrame, useVideoConfig, spring, interpolate, Easing } from 'remotion'
import { getLength } from '@remotion/paths'
import type { GPalette } from '../cinematic/Glass'
import { SCALE } from './Slides'

const hexA = (h: string, a: number) => { const n = (h || '#000').replace('#', ''); return `rgba(${parseInt(n.slice(0, 2), 16)},${parseInt(n.slice(2, 4), 16)},${parseInt(n.slice(4, 6), 16)},${a})` }

/**
 * IconMotif — a large, tasteful line-icon that fills the media side of a slide
 * when there's no chart/figure/screenshot/photo. It's matched to the slide's
 * TOPIC (from heading/beat keywords) so it's supportive, not random: a shield
 * for "defend/compliance", a magnifier for "research", a scale for comparisons,
 * a lock for "secure/private", etc. Tinted to the brand accent, it draws in with
 * a soft glow ring so the empty half now reads as designed, not blank.
 *
 * This is the no-credit stand-in; when Gemini image credits return, the Director
 * can drop a real defocused image in this slot instead.
 */

// keyword → icon key. First match wins; order matters (specific before generic).
const RULES: [RegExp, string][] = [
  [/defend|threat|attack|protect|shield|reputation|guard/i, 'shield'],
  [/research|discover|find|search|look|explore|ticker/i, 'search'],
  [/compl|reg\b|reg fd|legal|counsel|approv|sign-?off|record|rule/i, 'check'],
  [/secure|private|privacy|lock|safe|trust|verif/i, 'lock'],
  [/compare|versus|\bvs\b|old way|agency|cost|cheaper|save/i, 'scale'],
  [/price|plan|tier|\$|free|pay|subscription|billing/i, 'tag'],
  [/data|filing|report|document|sec|number|metric|chart|growth/i, 'doc'],
  [/alert|notif|real-?time|instant|speed|fast|minute|second/i, 'bolt'],
  [/investor|people|audience|community|team|follow|crowd/i, 'people'],
  [/post|publish|channel|broadcast|share|distribut|megaphone|voice/i, 'megaphone'],
  [/network|connect|platform|ecosystem|both sides|two-?sided/i, 'network'],
]

export function pickIcon(...text: (string | undefined)[]): string {
  const hay = text.filter(Boolean).join(' ')
  for (const [re, key] of RULES) if (re.test(hay)) return key
  return 'spark'
}

// Each icon is now an ORDERED LIST of path `d` strings on a 100x100 viewbox.
// Circles/rects are expressed as paths so @remotion/paths can measure them and
// they can DRAW THEMSELVES ON, stroke by stroke, in the listed order.
const circlePath = (cx: number, cy: number, r: number) =>
  `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0`
const rectPath = (x: number, y: number, w: number, h: number) => `M ${x} ${y} h ${w} v ${h} h ${-w} Z`

const PATHS: Record<string, string[]> = {
  shield: ['M50 8 L84 20 V48 C84 70 68 86 50 92 C32 86 16 70 16 48 V20 Z', 'M38 50 l9 9 l17 -19'],
  search: [circlePath(44, 44, 26), 'M63 63 L86 86'],
  check: [circlePath(50, 50, 40), 'M32 51 l12 12 l24 -26'],
  lock: [rectPath(24, 46, 52, 42), 'M34 46 V34 a16 16 0 0 1 32 0 V46', circlePath(50, 64, 5), 'M50 69 v8'],
  scale: ['M50 14 V86', 'M28 82 h44', 'M18 34 h64', 'M50 20 L20 34', 'M50 20 L80 34', 'M8 52 a10 10 0 0 0 20 0 Z', 'M72 52 a10 10 0 0 0 20 0 Z'],
  tag: ['M14 44 L44 14 H84 V54 L54 84 Z', circlePath(66, 32, 7)],
  doc: ['M28 12 H62 L78 28 V88 H28 Z', 'M62 12 V28 H78', 'M38 44 H68', 'M38 58 H68', 'M38 72 H56'],
  bolt: ['M54 8 L26 54 H48 L44 92 L74 42 H52 Z'],
  people: [circlePath(36, 36, 14), circlePath(68, 42, 11), 'M14 84 c0 -18 14 -28 22 -28 c8 0 22 10 22 28', 'M58 84 c0 -14 8 -24 20 -24 c8 0 14 6 16 14'],
  megaphone: ['M20 44 L64 26 V74 L20 56 Z', 'M64 34 c14 0 14 32 0 32', 'M28 58 v18 h12 v-13'],
  network: [circlePath(50, 20, 9), circlePath(22, 72, 9), circlePath(78, 72, 9), 'M46 28 L26 64', 'M54 28 L74 64', 'M31 72 H69'],
  spark: ['M50 12 L58 42 L88 50 L58 58 L50 88 L42 58 L12 50 L42 42 Z'],
}

// A single stroke that draws itself on: strokeDashoffset goes full→0 over its
// window, then a soft settle. Windows are staggered so strokes appear in order.
const Stroke: React.FC<{ d: string; acc: string; start: number; span: number; frame: number }> =
({ d, acc, start, span, frame }) => {
  const len = React.useMemo(() => { try { return getLength(d) } catch { return 100 } }, [d])
  const p = interpolate(frame, [start, start + span], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.ease) })
  return <path d={d} strokeDasharray={len} strokeDashoffset={len * (1 - p)} opacity={frame >= start ? 1 : 0} />
}

export const IconMotif: React.FC<{ iconKey: string; at: number; palette: GPalette; size?: number }> =
({ iconKey, at, palette, size = Math.round(340 * SCALE) }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const s = spring({ frame: frame - at, fps, config: { damping: 20, stiffness: 80 } })
  const breathe = 1 + Math.sin(frame * 0.03) * 0.02
  const acc = palette.accent
  const strokes = PATHS[iconKey] || PATHS.spark
  const local = frame - at
  // draw-on: each stroke gets a staggered window; total ~ 8 + n*7 frames.
  const drawStart = 6, perStroke = 6, span = 10
  // subtle glow pulse once the icon has finished drawing
  const done = drawStart + strokes.length * perStroke + span
  const glowPulse = interpolate(local, [done, done + 14], [0.5, 0.85], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <div style={{ position: 'relative', width: size, height: size, opacity: s, transform: `scale(${(0.82 + s * 0.18) * breathe})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* soft glow ring behind the glyph — brightens once drawn */}
      <div style={{ position: 'absolute', inset: '8%', borderRadius: '50%', background: `radial-gradient(circle, ${hexA(acc, 0.12 + (glowPulse - 0.5) * 0.14)}, transparent 68%)`, filter: 'blur(8px)' }} />
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `1.5px solid ${hexA(acc, 0.18)}` }} />
      <svg viewBox="0 0 100 100" width={size * 0.6} height={size * 0.6} fill="none" stroke={acc} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 ${10 + glowPulse * 10}px ${hexA(acc, glowPulse * 0.6)})` }}>
        {strokes.map((d, i) => <Stroke key={i} d={d} acc={acc} start={drawStart + i * perStroke} span={span} frame={local} />)}
      </svg>
    </div>
  )
}
