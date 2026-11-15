import React from 'react'
import { AbsoluteFill, Easing, Img } from 'remotion'
import { staticFile } from '../lib/asset'
import { cueFrame, formatFigure, isPlatformName, KIT_FPS, VO_LEAD, type BigNumberScene, type ChartScene, type ChecklistScene, type ComparisonScene, type CtaScene, type KitBrand, type KitScene, type QuoteScene, type TimelineScene, type TitleScene, type Word } from '../kit/spec'
import { Body, Card, Flare, Head, Icon, Label, Numeral, Obj, enter, ease, inOut, lerp, pop, useTheme } from './core'
import { Shell, camOf } from './scenes'
import type { Theme } from './theme'

/*
 * THE FILM SCENES for the kit's eight scene types. Each reads the kit scene as the planner wrote it (numbers already
 * checked against the source, compliance already scrubbed) and its voice's word timings, and draws it the theme's
 * way with a camera move. Times: t = seconds since the scene's cut; the voice starts VO_LEAD frames in.
 */
export type SceneCtx = { t: number; d: number; vo0: number; voDur: number; words?: Word[]; brand: KitBrand; recipient?: string; index: number; count: number }
const VO0 = VO_LEAD / KIT_FPS

/* ── timing from the voice ───────────────────────────────────────────────── */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
/** Shown words, each with the moment (scene seconds) it is spoken; words not said land spread through the line. */
export function landTimes(text: string, words: Word[] | undefined, vo0: number, voDur: number): [string, number][] {
  const toks = String(text || '').split(/\s+/).filter(Boolean)
  const out: [string, number][] = []
  let j = 0
  toks.forEach((tk, i) => {
    const n = norm(tk)
    let hit = -1
    if (words && n) for (let k = j; k < Math.min(words.length, j + 10); k++) if (norm(words[k].w) === n) { hit = k; break }
    if (hit >= 0) j = hit + 1
    out.push([tk, hit >= 0 ? vo0 + words![hit].start : vo0 + voDur * 0.45 * (i / Math.max(1, toks.length))])
  })
  for (let i = 1; i < out.length; i++) out[i][1] = Math.max(out[i][1], out[i - 1][1] + 0.07)
  return out
}
/** When a phrase is said (scene seconds), or a share of the way through the voice. */
const cueAt = (c: SceneCtx, phrase: string | undefined, share: number) => {
  const f = cueFrame(c.words, phrase)
  return f != null ? c.vo0 + f / KIT_FPS : c.vo0 + c.voDur * share
}
/** One line of words that fits: size from length × the face's typical letter width. */
export const fitSize = (th: Theme, text: string, width: number, max: number, min = 34) => {
  const f = th.head.toLowerCase()
  const em = f.includes('bebas') ? 0.42 : th.headUpper ? 0.72 * (th.upperScale ?? 1) : f.includes('montserrat') ? 0.6 : f.includes('cormorant') ? 0.42 : th.headItalic ? 0.5 : 0.55
  return Math.max(min, Math.min(max, Math.floor(width / (Math.max(1, String(text).length) * em))))
}
/** A size that fills a box of the given width over up to `lines` lines (words wrap; never wider than the box). */
export const fitLines = (th: Theme, text: string, width: number, lines: number, max: number, min = 30) => {
  const len = String(text).length
  const longest = Math.max(...String(text).split(/\s+/).map((w) => w.length), 1)
  const per = Math.max(longest, Math.ceil(len / lines) + 2)
  return fitSize(th, 'x'.repeat(per), width, max, min)
}
const Words: React.FC<{ t: number; tokens: [string, number][]; size: number; gap?: number; italicLast?: boolean; center?: boolean; color?: string }> = ({ t, tokens, size, gap, italicLast, center, color }) => {
  const th = useTheme()
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: `0 ${gap ?? size * 0.24}px`, justifyContent: center ? 'center' : 'flex-start' }}>
      {tokens.map(([w, at], i) => <span key={i} style={{ display: 'inline-block', ...enter(th, t, at - 0.12, 26) }}>{/\d/.test(w) ? <Numeral t={t} size={size}>{w}</Numeral> : <Head size={size} color={color} italic={italicLast && i === tokens.length - 1}>{w}</Head>}</span>)}
    </div>
  )
}
const clean = (s?: string) => (s && !isPlatformName(s) ? s : '')

/* ── the brand's real logo (never drawn by AI), or its name ───────────────── */
export const BrandMark: React.FC<{ brand: KitBrand; height: number; align?: 'left' | 'center'; shown?: (string | undefined)[] }> = ({ brand, height, align = 'left', shown = [] }) => {
  const th = useTheme()
  const src = th.dark ? brand.logo?.light || brand.logo?.any : brand.logo?.dark || brand.logo?.any
  if (src) return <div style={{ display: 'flex', justifyContent: align === 'center' ? 'center' : 'flex-start' }}><Img src={staticFile(src)} style={{ height, maxWidth: height * 5, objectFit: 'contain' }} /></div>
  const name = clean(brand.name)
  // No logo: the name stands in, unless it is already on screen ("Prepared by Trent Daniel" and then
  // "Trent Daniel" again under it was the owner's live video, 2026-11-15).
  if (!name || nameIn(name, shown)) return null
  return <Label size={Math.round(height * 0.36)} color={th.accent}>{name}</Label>
}
/** Is this name already in one of these on-screen lines? */
const nameIn = (name: string, lines: (string | undefined)[]) => lines.some((l) => !!l && l.toLowerCase().includes(name.toLowerCase()))
/** The advisor's real photo, framed the look's way. */
const Portrait: React.FC<{ src: string; w: number; h: number }> = ({ src, w, h }) => {
  const th = useTheme()
  const round = th.radius >= 20
  const frame: React.CSSProperties =
    th.card === 'glass' ? { border: `2px solid ${th.accent}`, boxShadow: `0 0 50px ${th.accent}40, 0 40px 90px rgba(0,0,0,.55)` }
    : th.card === 'paper' ? { border: '10px solid #fff', boxShadow: '0 30px 70px -26px rgba(40,30,10,.45)' }
    : th.card === 'frame' ? { border: `1px solid ${th.line}`, outline: `1px solid ${th.line}`, outlineOffset: 10, boxShadow: '0 30px 60px -30px rgba(28,42,68,.4)' }
    : th.card === 'rule' ? { border: `1px solid ${th.accent}`, outline: `1px solid ${th.accent}66`, outlineOffset: 12 }
    : { borderBottom: `8px solid ${th.accent}` }
  return <div style={{ width: w, height: h, borderRadius: round ? w : Math.min(th.radius, 16), overflow: 'hidden', boxSizing: 'border-box', ...frame }}><Img src={staticFile(src)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 22%', display: 'block' }} /></div>
}
const ContactIcon: React.FC<{ kind: 'booking' | 'phone' | 'email' | 'website'; color: string }> = ({ kind, color }) => {
  const s = { fill: 'none', stroke: color, strokeWidth: 3, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  return (
    <svg width={40} height={40} viewBox="0 0 44 44" style={{ flexShrink: 0 }}>
      {kind === 'phone' && <path {...s} d="M14 6 l6 9 -4 4 c2 5 5 8 10 10 l4 -4 9 6 -3 7 c-14 0 -27 -13 -27 -27z" />}
      {kind === 'email' && <><rect {...s} x="5" y="10" width="34" height="24" rx="3" /><path {...s} d="M6 12 l16 12 16 -12" /></>}
      {kind === 'website' && <><circle {...s} cx="22" cy="22" r="16" /><path {...s} d="M6 22 h32 M22 6 c-8 9 -8 23 0 32 c8 -9 8 -23 0 -32" /></>}
      {kind === 'booking' && <><rect {...s} x="6" y="9" width="32" height="28" rx="3" /><path {...s} d="M6 17 h32 M14 5 v8 M30 5 v8 M16 27 l4 4 8 -9" /></>}
    </svg>
  )
}
/** Stand back in letterboxed looks so everything sits between the bars. */
const fitCam = <T extends { z: number }>(th: Theme, cam: T): T => (th.letterbox ? { ...cam, z: cam.z - 240 } : cam)
const L = 230 // the left margin of a words column (≥ the right margin of a photo)

/* ── 1. cover ────────────────────────────────────────────────────────────── */
const Cover: React.FC<{ s: TitleScene; c: SceneCtx }> = ({ s, c }) => {
  const th = useTheme()
  const { t, d } = c
  const p = c.brand.presenter
  const photo = p?.photo && p.onCover !== false ? p.photo : ''
  const kicker = clean(c.recipient) ? `Prepared for ${clean(c.recipient)}` : clean(c.brand.name)
  const colW = photo ? 1000 : 1500
  const big = fitLines(th, s.headline, colW, s.headline.length > 16 ? 2 : 1, th.headUpper ? 180 : 156, 64)
  const toks = landTimes(s.headline, c.words, c.vo0, c.voDur)
  const cam = fitCam(th, camOf(th.energy, { z: [[-0.5, -150], [d, 30]], ry: [[-0.5, 3], [d, -1]] }, t, 0))
  const x = photo ? -960 + L + colW / 2 : 0
  const ph = pop(t, 0.2, 16, 110)
  const tall = th.radius >= 20 ? 460 : 560
  return (
    <Shell t={t} cam={cam} seed={3} overlay={<Flare t={t} at={toks[toks.length - 1]?.[1] ?? 1} y={470} x={photo ? 640 : 960} />}>
      {kicker ? <Obj x={x} y={-240} z={60} w={colW} h={50} sharp style={{ display: 'flex', justifyContent: photo ? 'flex-start' : 'center', ...enter(th, t, 0.15) }}><Label size={22} color={th.accent}>{kicker}</Label></Obj> : null}
      <Obj x={x} y={0} z={0} w={colW} h={big * 2.5} sharp style={{ display: 'flex', alignItems: 'center', justifyContent: photo ? 'flex-start' : 'center' }}>
        <Words t={t} tokens={toks} size={big} italicLast={th.headItalic} center={!photo} />
      </Obj>
      {s.sub ? <Obj x={x} y={240} z={40} w={colW} h={60} sharp style={{ display: 'flex', alignItems: 'center', justifyContent: photo ? 'flex-start' : 'center', gap: 20, ...enter(th, t, c.vo0 + c.voDur * 0.6) }}><div style={{ width: 70, height: 2, background: th.accent, flexShrink: 0 }} /><Body size={30} color={th.muted}>{s.sub}</Body></Obj> : null}
      {photo ? (
        <>
          <Obj x={560} y={-40} z={lerp(-200, 30, ph)} w={460} h={tall} sharp opacity={Math.min(1, ph * 1.3)}><Portrait src={photo} w={460} h={tall} /></Obj>
          <Obj x={560} y={tall / 2 + 30} z={30} w={620} h={110} sharp style={{ textAlign: 'center', ...enter(th, t, 0.7) }}>
            {p?.name ? <Head size={th.headUpper ? 58 : 44}>{p.name}</Head> : null}
            <div style={{ marginTop: 8 }}><Body size={24} color={th.muted}>{[p?.role, nameIn(clean(c.brand.name), [p?.name]) ? '' : clean(c.brand.name)].filter(Boolean).join(' · ')}</Body></div>
          </Obj>
        </>
      ) : (
        <Obj y={360} z={30} w={900} h={70} sharp style={{ ...enter(th, t, 0.6) }}><BrandMark brand={c.brand} height={64} align="center" shown={[kicker, s.sub, s.headline]} /></Obj>
      )}
    </Shell>
  )
}

/* ── 2. a big number that lands on the word ──────────────────────────────── */
const BigNumber: React.FC<{ s: BigNumberScene; c: SceneCtx }> = ({ s, c }) => {
  const th = useTheme()
  const { t, d } = c
  const land = cueAt(c, s.landOn, 0.35)
  const v = ease(t, land - 1.0, land + 0.15, 0, s.figure.value, Easing.out(Easing.cubic))
  const text = formatFigure(s.figure, v)
  const size = fitSize(th, formatFigure(s.figure), 1500, th.headUpper ? 300 : 260, 120)
  const ring = ease(t, land - 1.0, land + 0.4, 0, 1, inOut)
  const cam = fitCam(th, camOf(th.energy, { z: [[0, -60], [d, 110]], ry: [[0, -3], [d, 3]] }, t, 60))
  return (
    <Shell t={t} cam={cam} seed={5} overlay={<Flare t={t} at={land + 0.1} y={520} />}>
      <Obj y={20} z={-180} w={760} h={760} sharp style={{ opacity: 0.5 }}>
        <svg width={760} height={760} viewBox="0 0 760 760"><circle cx={380} cy={380} r={360} fill="none" stroke={th.accent} strokeOpacity={0.35} strokeWidth={3} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - ring} transform="rotate(-90 380 380)" /></svg>
      </Obj>
      <Obj y={-250} z={40} w={1500} h={50} sharp style={{ display: 'flex', justifyContent: 'center', ...enter(th, t, 0.1) }}><Label size={24} color={th.accent}>{s.label}</Label></Obj>
      <Obj y={-10} z={0} w={1700} h={size * 1.15} sharp style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', ...enter(th, t, land - 1.0, 30) }}><Numeral t={t} size={size}>{text}</Numeral></Obj>
      {s.context ? <Obj y={230} z={30} w={1400} h={120} sharp style={{ display: 'flex', justifyContent: 'center', textAlign: 'center', ...enter(th, t, land + 0.35) }}><Body size={38} color={th.muted}>{s.context}</Body></Obj> : null}
    </Shell>
  )
}

/* ── 3. two sides ────────────────────────────────────────────────────────── */
const Comparison: React.FC<{ s: ComparisonScene; c: SceneCtx }> = ({ s, c }) => {
  const th = useTheme()
  const { t, d } = c
  const a1 = c.vo0 + c.voDur * 0.12, a2 = cueAt(c, s.right.label, 0.45)
  const cam = fitCam(th, camOf(th.energy, { x: [[0, -60], [d, 60]], z: [[0, -50], [d, 60]], ry: [[0, 4], [d, -4]] }, t, 0))
  const side = (x: { label: string; figure?: ComparisonScene['left']['figure']; points?: string[] }, at: number, strong: boolean, i: number) => {
    const p = pop(t, at, 15, 140)
    const onStrong = strong && (th.card === 'paper' || th.card === 'flat')
    const ink = onStrong ? '#fff' : undefined
    return (
      <Obj key={i} x={(i ? 1 : -1) * 390} y={30} z={lerp(-260, 0, p)} ry={(i ? -1 : 1) * 6} w={700} h={520} opacity={Math.min(1, p * 1.4)}>
        <Card strong={strong} style={{ padding: 50, display: 'flex', flexDirection: 'column', gap: 22 }}>
          <Label size={22} color={onStrong ? 'rgba(255,255,255,.85)' : th.accent}>{x.label}</Label>
          {x.figure ? <Numeral t={t} size={fitSize(th, formatFigure(x.figure), 600, 130, 60)} style={ink ? { color: ink } : undefined}>{formatFigure(x.figure, ease(t, at, at + 0.9, 0, x.figure.value))}</Numeral> : null}
          {(x.points || []).slice(0, 3).map((pt, k) => <div key={k} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', ...enter(th, t, at + 0.4 + k * 0.15, 16) }}><Icon kind="check" size={36} color={ink ?? th.accent} /><Body size={30} color={ink}>{pt}</Body></div>)}
        </Card>
      </Obj>
    )
  }
  return (
    <Shell t={t} cam={cam} seed={7}>
      <Obj y={-330} z={30} w={1600} h={90} sharp style={{ display: 'flex', justifyContent: 'center', ...enter(th, t, 0.1) }}><Head size={fitSize(th, s.heading, 1500, 84, 44)}>{s.heading}</Head></Obj>
      {side(s.left, a1, false, 0)}
      {side(s.right, a2, true, 1)}
      {s.verdict ? <Obj y={360} z={40} w={1500} h={70} sharp style={{ display: 'flex', justifyContent: 'center', ...enter(th, t, c.vo0 + c.voDur * 0.7) }}><Head size={fitSize(th, s.verdict, 1400, 48, 30)} italic>{s.verdict}</Head></Obj> : null}
    </Shell>
  )
}

/* ── 4. steps along a path the camera travels ────────────────────────────── */
const Timeline: React.FC<{ s: TimelineScene; c: SceneCtx }> = ({ s, c }) => {
  const th = useTheme()
  const { t, d } = c
  const n = s.steps.length
  const span = Math.min(1500, 380 * (n - 1))
  const xs = s.steps.map((_, i) => -span / 2 + (n > 1 ? (span * i) / (n - 1) : 0))
  const at = s.steps.map((st, i) => cueAt(c, st.when, 0.1 + (0.75 * i) / Math.max(1, n - 1)))
  const line = ease(t, at[0] - 0.3, at[n - 1] + 0.3, 0, 1, inOut)
  const cam = fitCam(th, camOf(th.energy, { x: [[0, -120], [d, 120]], z: [[0, -40], [d, 40]], ry: [[0, 5], [d, -5]] }, t, 0))
  return (
    <Shell t={t} cam={cam} seed={9}>
      <Obj y={-320} z={30} w={1600} h={90} sharp style={{ display: 'flex', justifyContent: 'center', ...enter(th, t, 0.1) }}><Head size={fitSize(th, s.heading, 1500, 84, 44)}>{s.heading}</Head></Obj>
      <Obj y={20} z={0} w={span + 120} h={8} sharp style={{ background: th.dark ? 'rgba(255,255,255,.12)' : th.line, borderRadius: 8 }}>
        <div style={{ width: `${line * 100}%`, height: '100%', background: th.accent, borderRadius: 8, boxShadow: th.dark ? `0 0 24px ${th.accent}` : 'none' }} />
      </Obj>
      {s.steps.map((st, i) => {
        const p = pop(t, at[i] - 0.2, 13, 170)
        const up = i % 2 === 0
        return (
          <React.Fragment key={i}>
            <Obj x={xs[i]} y={20} z={10} w={34} h={34} sharp style={{ borderRadius: th.radius > 2 ? 34 : 0, background: th.accent, border: `6px solid ${th.bg}`, boxSizing: 'border-box', transform: `scale(${p})` }} />
            <Obj x={xs[i]} y={up ? -130 : 170} z={20} w={360} h={200} sharp style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: up ? 'flex-end' : 'flex-start', gap: 10, opacity: Math.min(1, p * 1.4), transform: `translateY(${(1 - p) * (up ? 20 : -20)}px)` }}>
              <Numeral t={t} size={th.headUpper ? 64 : 50}>{st.when}</Numeral>
              <Body size={28}>{st.label}</Body>
            </Obj>
          </React.Fragment>
        )
      })}
    </Shell>
  )
}

/* ── 5. a chart ──────────────────────────────────────────────────────────── */
const Chart: React.FC<{ s: ChartScene; c: SceneCtx }> = ({ s, c }) => {
  const th = useTheme()
  const { t, d } = c
  const pts = s.points.slice(0, 6)
  const max = Math.max(...pts.map((p) => p.value), 1)
  const fig = (v: number) => formatFigure({ value: v, prefix: s.prefix, suffix: s.suffix, decimals: s.decimals })
  const grow = (i: number) => ease(t, c.vo0 + 0.2 + i * 0.18, c.vo0 + 1.0 + i * 0.18, 0, 1, inOut)
  const hi = s.highlight ?? pts.reduce((b, p, i) => (p.value > pts[b].value ? i : b), 0)
  const color = (i: number) => (i === hi ? th.accent : th.dark ? 'rgba(255,255,255,.28)' : th.series[(i % 2) + 1] ?? th.line)
  const cam = fitCam(th, camOf(th.energy, { z: [[0, -60], [d, 80]], ry: [[0, -4], [d, 4]], y: [[0, 10], [d, -10]] }, t, 0))
  const W = 1300, H = 470
  let body: React.ReactNode
  if (s.kind === 'donut') {
    const sum = pts.reduce((a, p) => a + p.value, 0) || 1
    let acc = 0
    const k = ease(t, c.vo0 + 0.2, c.vo0 + 1.6, 0, 1, inOut)
    body = (
      <div style={{ display: 'flex', alignItems: 'center', gap: 70, height: '100%' }}>
        <svg width={440} height={440} viewBox="0 0 440 440" style={{ flexShrink: 0 }}>
          {pts.map((p, i) => { const f = p.value / sum, a0 = acc; acc += f; return <circle key={i} cx={220} cy={220} r={170} fill="none" stroke={color(i) === th.line ? th.series[0] : color(i)} strokeWidth={i === hi ? 70 : 54} pathLength={1} strokeDasharray={`${Math.max(0, f * k - 0.004)} 1`} strokeDashoffset={-a0 * k} transform="rotate(-90 220 220)" /> })}
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {pts.map((p, i) => <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 18, ...enter(th, t, c.vo0 + 0.4 + i * 0.15, 16) }}><div style={{ width: 22, height: 22, borderRadius: 4, background: color(i) }} /><Body size={32} weight={i === hi ? 700 : 500}>{p.label}</Body><Body size={32} color={th.muted}>{fig(p.value)}</Body></div>)}
        </div>
      </div>
    )
  } else if (s.kind === 'line') {
    const xy = pts.map((p, i) => [60 + (i * (W - 120)) / Math.max(1, pts.length - 1), H - 60 - (p.value / max) * (H - 140)] as const)
    const k = ease(t, c.vo0 + 0.2, c.vo0 + 1.8, 0, 1, inOut)
    body = (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <polyline points={xy.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" stroke={th.accent} strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - k} />
        {xy.map(([x, y], i) => <g key={i} opacity={ease(k, i / Math.max(1, pts.length - 1) - 0.05, i / Math.max(1, pts.length - 1) + 0.05, 0, 1)}><circle cx={x} cy={y} r={i === hi ? 14 : 9} fill={i === hi ? th.accent : th.ink} /><text x={x} y={y - 28} textAnchor="middle" fontSize={30} fontFamily={th.body} fontWeight={700} fill={th.ink}>{fig(pts[i].value)}</text><text x={x} y={H - 10} textAnchor="middle" fontSize={26} fontFamily={th.body} fill={th.muted}>{pts[i].label}</text></g>)}
      </svg>
    )
  } else {
    const bw = Math.min(170, (W - 80) / pts.length - 40)
    body = (
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 40, height: '100%' }}>
        {pts.map((p, i) => (
          <div key={i} style={{ width: bw, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ opacity: grow(i) }}><Body size={34} weight={700} color={i === hi ? th.accent : th.ink}>{fig(p.value * grow(i))}</Body></div>
            <div style={{ width: '100%', height: (H - 120) * (p.value / max) * grow(i), background: color(i), borderRadius: `${Math.min(10, th.radius)}px ${Math.min(10, th.radius)}px 0 0`, boxShadow: i === hi && th.dark ? `0 0 40px ${th.accent}66` : 'none' }} />
            <Body size={28} color={th.muted}>{p.label}</Body>
          </div>
        ))}
      </div>
    )
  }
  return (
    <Shell t={t} cam={cam} seed={13}>
      <Obj y={-340} z={30} w={1600} h={90} sharp style={{ display: 'flex', justifyContent: 'center', ...enter(th, t, 0.1) }}><Head size={fitSize(th, s.heading, 1500, 80, 44)}>{s.heading}</Head></Obj>
      <Obj y={20} z={0} w={W} h={H}>{body}</Obj>
      {s.takeaway ? <Obj y={340} z={40} w={1500} h={70} sharp style={{ display: 'flex', justifyContent: 'center', ...enter(th, t, c.vo0 + c.voDur * 0.65) }}><Head size={fitSize(th, s.takeaway, 1400, 46, 30)} italic>{s.takeaway}</Head></Obj> : null}
    </Shell>
  )
}

/* ── 6. a checklist the camera travels along ─────────────────────────────── */
const Checklist: React.FC<{ s: ChecklistScene; c: SceneCtx }> = ({ s, c }) => {
  const th = useTheme()
  const { t, d } = c
  const items = s.items.slice(0, 4)
  const n = items.length
  const w = n === 1 ? 1100 : n === 2 ? 680 : n === 3 ? 520 : 410
  const gap = 40
  const at = items.map((it, i) => cueAt(c, it.split(/\s+/).slice(0, 2).join(' '), 0.12 + (0.7 * i) / Math.max(1, n)))
  const cam = fitCam(th, camOf(th.energy, { x: [[0, -70], [d, 70]], z: [[0, -40], [d, 50]], ry: [[0, 4], [d, -4]] }, t, 0))
  return (
    <Shell t={t} cam={cam} seed={15}>
      <Obj y={-320} z={30} w={1600} h={90} sharp style={{ display: 'flex', justifyContent: 'center', ...enter(th, t, 0.1) }}><Head size={fitSize(th, s.heading, 1500, 84, 44)}>{s.heading}</Head></Obj>
      {items.map((it, i) => {
        const p = pop(t, at[i] - 0.25, 15, 140)
        const x = (i - (n - 1) / 2) * (w + gap)
        return (
          <Obj key={i} x={x} y={50} z={lerp(-240, -Math.abs(i - (n - 1) / 2) * 30, p)} ry={(i - (n - 1) / 2) * -5} w={w} h={n === 1 ? 360 : 460} opacity={Math.min(1, p * 1.4)}>
            <Card style={{ padding: 44, display: 'flex', flexDirection: 'column', gap: 28 }}>
              <Icon kind="check" size={80} color={th.accent} draw={ease(t, at[i], at[i] + 0.8, 0, 1)} />
              <Head size={fitLines(th, it, w - 88, n === 1 ? 2 : 4, n === 1 ? 84 : n >= 4 ? 52 : 62, 32)}>{it}</Head>
            </Card>
          </Obj>
        )
      })}
    </Shell>
  )
}

/* ── 7. a quote ──────────────────────────────────────────────────────────── */
const Quote: React.FC<{ s: QuoteScene; c: SceneCtx }> = ({ s, c }) => {
  const th = useTheme()
  const { t, d } = c
  const toks = landTimes(s.quote, c.words, c.vo0, c.voDur)
  const len = s.quote.length
  const size = len < 60 ? 92 : len < 120 ? 72 : 58
  const cam = fitCam(th, camOf(th.energy, { z: [[0, -40], [d, 70]], ry: [[0, -2], [d, 2]] }, t, 0))
  return (
    <Shell t={t} cam={cam} seed={17}>
      <Obj x={-640} y={-240} z={-80} w={300} h={300} sharp style={{ ...enter(th, t, 0.05) }}><Head size={360} color={th.accent} style={{ opacity: 0.55, lineHeight: 0.8 }}>“</Head></Obj>
      <Obj y={-10} z={0} w={1400} h={560} sharp style={{ display: 'flex', alignItems: 'center' }}><Words t={t} tokens={toks} size={size} gap={size * 0.26} /></Obj>
      {s.attribution ? <Obj y={330} z={30} w={1400} h={60} sharp style={{ display: 'flex', alignItems: 'center', gap: 20, ...enter(th, t, c.vo0 + c.voDur * 0.85) }}><div style={{ width: 80, height: 2, background: th.accent }} /><Body size={30} color={th.muted}>{s.attribution}</Body></Obj> : null}
    </Shell>
  )
}

/* ── 8. the next step ────────────────────────────────────────────────────── */
const Cta: React.FC<{ s: CtaScene; c: SceneCtx }> = ({ s, c }) => {
  const th = useTheme()
  const { t, d } = c
  const p = c.brand.presenter
  const photo = p?.photo && p.onClosing !== false ? p.photo : ''
  const colW = photo ? 1000 : 1400
  const x = photo ? -960 + L + colW / 2 : 0
  const btnAt = cueAt(c, s.action.split(/\s+/)[0], 0.3)
  const b = pop(t, btnAt - 0.3, 14, 150)
  const pulse = 1 + 0.025 * Math.max(0, Math.sin((t - btnAt) * 3))
  const rows = (['booking', 'phone', 'email', 'website'] as const).filter((k) => s.contact?.[k] && String(s.contact[k]).trim())
  const ph = pop(t, 0.3, 16, 110)
  const tall = th.radius >= 20 ? 420 : 500
  const cam = fitCam(th, camOf(th.energy, { z: [[0, -90], [d, 30]], ry: [[0, -2], [d, 1]] }, t, 0))
  const align = photo ? 'flex-start' : 'center'
  const top = rows.length > 2 ? -300 : -230
  return (
    <Shell t={t} cam={cam} seed={11} overlay={<Flare t={t} at={btnAt} y={560} x={photo ? 600 : 960} />}>
      <Obj x={x} y={top} z={0} w={colW} h={170} sharp style={{ display: 'flex', alignItems: 'center', justifyContent: align, textAlign: photo ? 'left' : 'center', ...enter(th, t, 0.2) }}><Head size={fitSize(th, s.headline, colW, th.headUpper ? 104 : 88, 48)}>{s.headline}</Head></Obj>
      <Obj x={x} y={top + 155} z={40} w={colW} h={104} sharp opacity={Math.min(1, b * 1.3)} style={{ display: 'flex', justifyContent: align }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', height: '100%', padding: '0 60px', borderRadius: th.radius > 12 ? 999 : th.radius, background: th.accent, fontFamily: th.label, fontWeight: 700, fontSize: 36, letterSpacing: '.03em', color: th.dark ? '#111' : '#fff', transform: `scale(${(0.92 + 0.08 * b) * pulse})`, transformOrigin: photo ? 'left center' : 'center', boxShadow: th.dark ? `0 0 40px ${th.accent}66` : '0 20px 40px -18px rgba(0,0,0,.4)', whiteSpace: 'nowrap' }}>{s.action}</div>
      </Obj>
      {rows.map((k, i) => (
        <Obj key={k} x={x} y={top + 300 + i * 66} z={20} w={colW} h={56} sharp style={{ display: 'flex', alignItems: 'center', justifyContent: align, gap: 20, ...enter(th, t, 0.9 + i * 0.12, 20) }}>
          <ContactIcon kind={k} color={th.accent} /><Body size={34} weight={500}>{String(s.contact![k])}</Body>
        </Obj>
      ))}
      {photo ? (
        <>
          <Obj x={560} y={-70} z={lerp(-200, 30, ph)} w={420} h={tall} sharp opacity={Math.min(1, ph * 1.3)}><Portrait src={photo} w={420} h={tall} /></Obj>
          <Obj x={560} y={-70 + tall / 2 + 110} z={30} w={620} h={170} sharp style={{ textAlign: 'center', ...enter(th, t, 0.8) }}>
            {p?.name ? <Head size={th.headUpper ? 58 : 44}>{p.name}</Head> : null}
            {p?.role ? <div style={{ marginTop: 8 }}><Body size={24} color={th.muted}>{p.role}</Body></div> : null}
            <div style={{ marginTop: 16 }}><BrandMark brand={c.brand} height={48} align="center" shown={[p?.name, s.headline]} /></div>
          </Obj>
        </>
      ) : (
        <Obj y={380} z={30} w={900} h={70} sharp style={{ ...enter(th, t, 0.9) }}><BrandMark brand={c.brand} height={60} align="center" shown={[s.headline]} /></Obj>
      )}
    </Shell>
  )
}

/** One kit scene, drawn by the film engine. */
export const FilmScene: React.FC<{ scene: KitScene; c: SceneCtx }> = ({ scene, c }) => {
  switch (scene.type) {
    case 'title': return <Cover s={scene} c={c} />
    case 'bignumber': return <BigNumber s={scene} c={c} />
    case 'comparison': return <Comparison s={scene} c={c} />
    case 'timeline': return <Timeline s={scene} c={c} />
    case 'chart': return <Chart s={scene} c={c} />
    case 'checklist': return <Checklist s={scene} c={c} />
    case 'quote': return <Quote s={scene} c={c} />
    case 'cta': return <Cta s={scene} c={c} />
  }
  return <AbsoluteFill />
}
export { VO0 }
