import React from 'react'
import { useCurrentFrame, interpolate, Easing } from 'remotion'
import { Fit, FitBox } from '../lib/fit'
import {
  cueFrame, formatFigure, mix, rgba,
  type BigNumberScene, type ChartScene, type ChecklistScene, type ComparisonScene, type CtaScene,
  type KitScene, type QuoteScene, type TimelineScene, type TitleScene,
} from './spec'
import { GRID, KitLogo, MIN_TEXT, useKit } from './theme'
import { settleStyle, spread, useIdle, useLanding, useSettle } from './motion'
import { Body, Card, CountFigure, Eyebrow, Heading, Portrait, revealWindow, Rule, Stage, type SceneProps } from './parts'

// =============================================================================
// THE EIGHT SCENES. Each one fills the same 16:9 grid (theme.tsx GRID) with
// ONE hero element, reads only the look (useKit), and puts every word in a
// <Fit>/<FitBox> so nothing can leave the frame.
// =============================================================================

const W = GRID.width   // 1680
const H = GRID.height  // 812

// When a phrase is said, in scene frames (null if not found / no timings).
function said(scene: KitScene, phrase: string | undefined, voStart: number): number | null {
  const f = cueFrame(scene.words, phrase)
  return f == null ? null : voStart + f
}
const firstWords = (s: string, n = 2) => s.split(/\s+/).slice(0, n).join(' ')

// ── 1. TITLE ─────────────────────────────────────────────────────────────────
export const TitleView: React.FC<SceneProps<TitleScene>> = ({ scene, timing }) => {
  const { t, brand, recipient, body, upper } = useKit()
  const photo = brand.presenter?.onCover === false ? undefined : brand.presenter?.photo
  const at = 8
  const prepared = recipient ? (
    <div style={{ marginTop: 34 }}>
      <Eyebrow at={at + 34} width={photo ? 1000 : 1400} align={photo ? 'left' : 'center'} size={24} lines={1}>Prepared for</Eyebrow>
      <Body text={recipient} at={at + 38} width={photo ? 1000 : 1400} max={54} lines={2} align={photo ? 'left' : 'center'} color={t.text} />
    </div>
  ) : null
  if (photo) {
    return (
      <Stage timing={timing}>
        <div style={{ display: 'flex', height: H, alignItems: 'center', gap: 110 }}>
          <div style={{ width: 1000, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 26 }}>
            <div style={settleStyle(useSettle(at), { rise: 12 })}><KitLogo height={72} maxWidth={520} nameSize={34} /></div>
            <Heading text={scene.headline} at={at + 8} width={1000} max={118} lines={3} />
            <Rule at={at + 20} width={200} />
            {scene.sub ? <Body text={scene.sub} at={at + 24} width={980} max={44} lines={2} /> : null}
            {prepared}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26 }}>
            <Portrait src={photo} width={470} height={560} at={at + 12} />
            {brand.presenter?.name ? (
              <div style={{ width: 520, textAlign: 'center', ...settleStyle(useSettle(at + 30), { rise: 12 }) }}>
                <Fit max={40} min={26} lines={1} style={{ fontFamily: body, fontWeight: 700, color: t.text, textAlign: 'center', lineHeight: 1.25 }}>{brand.presenter.name}</Fit>
                {brand.presenter.role ? <Fit max={26} min={MIN_TEXT.small} lines={1} style={{ fontFamily: body, fontWeight: 600, color: t.muted, textAlign: 'center', letterSpacing: upper ? '0.08em' : 0, lineHeight: 1.3 }}>{brand.presenter.role}</Fit> : null}
              </div>
            ) : null}
          </div>
        </div>
      </Stage>
    )
  }
  // No photo: a centred cover with a framing ornament so the frame is full.
  return (
    <Stage timing={timing}>
      <TitleOrnament />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: H, gap: 28, textAlign: 'center' }}>
        <div style={settleStyle(useSettle(at), { rise: 12 })}><KitLogo height={84} maxWidth={620} align="center" nameSize={38} /></div>
        <Heading text={scene.headline} at={at + 8} width={1440} max={scene.headline.length <= 24 ? 168 : 136} lines={3} align="center" />
        <Rule at={at + 20} width={220} align="center" />
        {scene.sub ? <Body text={scene.sub} at={at + 24} width={1240} max={46} lines={2} align="center" /> : null}
        {prepared}
      </div>
    </Stage>
  )
}

// Corner brackets that draw in and breathe — fills the empty corners of a centred cover.
const TitleOrnament: React.FC = () => {
  const { t } = useKit()
  const frame = useCurrentFrame()
  const p = interpolate(frame, [6, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  const breathe = 1 + Math.sin(frame * 0.03) * 0.15
  const L = 150 * p
  const c = rgba(t.accentBig, 0.55 * breathe)
  const corner = (style: React.CSSProperties) => <div style={{ position: 'absolute', width: L, height: L, ...style }} />
  return (
    <>
      {corner({ left: 0, top: 0, borderLeft: `3px solid ${c}`, borderTop: `3px solid ${c}` })}
      {corner({ right: 0, top: 0, borderRight: `3px solid ${c}`, borderTop: `3px solid ${c}` })}
      {corner({ left: 0, bottom: 0, borderLeft: `3px solid ${c}`, borderBottom: `3px solid ${c}` })}
      {corner({ right: 0, bottom: 0, borderRight: `3px solid ${c}`, borderBottom: `3px solid ${c}` })}
    </>
  )
}

// ── 2. BIG NUMBER ────────────────────────────────────────────────────────────
export const BigNumberView: React.FC<SceneProps<BigNumberScene>> = ({ scene, timing }) => {
  const { t } = useKit()
  const frame = useCurrentFrame()
  // The count-up LANDS on the word that says the number (word timings), else
  // about a third of the way into the voice.
  const cue = said(scene, scene.landOn, timing.voStart)
  const land = cue ?? timing.voStart + Math.min(60, Math.max(30, Math.round(timing.voFrames * 0.32)))
  const { p, pulse } = useLanding(land)
  const idle = useIdle(0.04, 1)
  // A meter under the number fills as it counts, with ticks — it frames the
  // number without ever crossing it; a soft light breathes behind.
  const meterW = 1100
  const ticks = 24
  const after = Math.max(0, frame - land)
  return (
    <Stage timing={timing}>
      <div style={{ position: 'absolute', left: W / 2 - 700, top: H / 2 - 360, width: 1400, height: 720, background: `radial-gradient(closest-side, ${rgba(t.accentBig, (t.dark ? 0.16 : 0.12) + pulse * 0.12 + Math.sin(frame * 0.05) * 0.02)}, transparent)` }} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22 }}>
        <Eyebrow at={10} width={1240} align="center" size={38}>{scene.label}</Eyebrow>
        <div style={{ transform: `scale(${1 + pulse * 0.05 + idle * 0.006})` }}>
          <CountFigure figure={scene.figure} p={p} width={1560} max={300} min={MIN_TEXT.hero} color={t.accentBig} glow={pulse * 0.6} />
        </div>
        <svg width={meterW} height={36}>
          {Array.from({ length: ticks + 1 }, (_, i) => {
            const x = (meterW * i) / ticks
            const lit = i / ticks <= p
            return <line key={i} x1={x} x2={x} y1={i % 6 === 0 ? 0 : 8} y2={26} stroke={lit ? t.accentBig : rgba(t.text, 0.18)} strokeWidth={i % 6 === 0 ? 4 : 2} opacity={lit ? 0.9 : 1} />
          })}
          <rect x={0} y={30} width={meterW} height={4} fill={rgba(t.text, 0.12)} />
          <rect x={0} y={30} width={meterW * p} height={4} fill={t.accentBig} />
          {/* a slow glint runs along the full meter after landing — the frame never sits still */}
          {after > 0 ? <rect x={((after * 9) % (meterW + 300)) - 150} y={28} width={150} height={8} fill={rgba('#ffffff', t.dark ? 0.35 : 0.5)} /> : null}
        </svg>
        {scene.context ? <div style={{ marginTop: 14 }}><Body text={scene.context} at={land + 4} width={1240} max={50} lines={2} align="center" color={t.text} /></div> : null}
      </div>
    </Stage>
  )
}

// ── 3. COMPARISON ────────────────────────────────────────────────────────────
export const ComparisonView: React.FC<SceneProps<ComparisonScene>> = ({ scene, timing }) => {
  const { t, body, head } = useKit()
  const [from, to] = revealWindow(timing)
  const leftAt = Math.max(14, said(scene, firstWords(scene.left.label), timing.voStart) ?? from)
  const rightAt = Math.max(leftAt + 18, said(scene, firstWords(scene.right.label), timing.voStart) ?? Math.round((from + to) / 2))
  const cardW = 760, cardH = scene.verdict ? 500 : 580
  const side = (s: ComparisonScene['left'], at: number, accent: boolean) => {
    const p = useSettle(at, 22)
    const lp = useLanding(at + 26, 30)
    const pad = 46
    // Label, number and points are each sized on their own (a fixed-width Fit
    // each; the points as one FitBox in the room left), so a wide number never
    // shrinks the label to nothing.
    const innerW = cardW - pad * 2
    const pts = (s.points || []).filter((x) => x && x.trim())
    const frame = useCurrentFrame()
    return (
      <div style={settleStyle(p, { rise: 40, scale: 0.04 })}>
        <Card accent={accent} style={{ width: cardW, height: cardH, padding: pad, display: 'flex', flexDirection: 'column', justifyContent: pts.length ? 'flex-start' : 'center', gap: 20 }}>
          <div style={{ width: innerW, flexShrink: 0 }}>
            <Fit max={34} min={MIN_TEXT.label} lines={2} style={{ fontFamily: body, fontWeight: 700, color: accent ? t.accentInk : t.muted, letterSpacing: '0.12em', textTransform: 'uppercase', lineHeight: 1.25 }}>{s.label}</Fit>
          </div>
          {s.figure ? (
            <div style={{ flexShrink: 0 }}>
              <CountFigure figure={s.figure} p={lp.p} width={innerW} max={pts.length ? 150 : 210} min={72} color={accent ? t.accentBig : t.text} align="left" />
            </div>
          ) : null}
          {pts.length ? (
            <div style={{ flex: 1, minHeight: 0, width: innerW }}>
              <FitBox valign={s.figure ? 'start' : 'center'} minScale={0.7}>
                <div style={{ width: innerW, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {pts.map((pt, i) => (
                    <div key={i} style={{ display: 'flex', gap: 18, alignItems: 'flex-start', fontFamily: body, fontWeight: 500, fontSize: s.figure ? 40 : 50, color: t.text, lineHeight: 1.3, opacity: Math.min(1, Math.max(0, (frame - at - 20 - i * 10) / 12)) }}>
                      <span style={{ width: 14, height: 14, marginTop: s.figure ? 18 : 23, flexShrink: 0, background: accent ? t.accentBig : rgba(t.text, 0.4), borderRadius: 2 }} />
                      <span>{pt}</span>
                    </div>
                  ))}
                </div>
              </FitBox>
            </div>
          ) : null}
        </Card>
      </div>
    )
  }
  const vsP = useSettle(rightAt - 6, 16)
  return (
    <Stage timing={timing}>
      <div style={{ display: 'flex', flexDirection: 'column', height: H, gap: 40 }}>
        <Heading text={scene.heading} at={6} width={W} max={76} lines={2} />
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1, minHeight: 0 }}>
          {side(scene.left, leftAt, false)}
          {side(scene.right, rightAt, true)}
          <div style={{ position: 'absolute', left: W / 2 - 52, top: '50%', marginTop: -52, width: 104, height: 104, borderRadius: t.radius, background: t.bg, border: `2px solid ${t.surfaceLine}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: head, fontWeight: 800, fontSize: 38, color: t.text, ...settleStyle(vsP, { scale: 0.4, rise: 0 }) }}>vs</div>
        </div>
        {scene.verdict ? <Body text={scene.verdict} at={rightAt + 30} width={W} max={42} lines={2} color={t.text} /> : null}
      </div>
    </Stage>
  )
}

// ── 4. TIMELINE ──────────────────────────────────────────────────────────────
export const TimelineView: React.FC<SceneProps<TimelineScene>> = ({ scene, timing }) => {
  const { t, head, body, headWeight } = useKit()
  const frame = useCurrentFrame()
  const [from, to] = revealWindow(timing)
  const steps = scene.steps.slice(0, 5)
  const n = steps.length
  const colW = W / n
  const ats = steps.map((s, i) => spread(i, n, from, to, said(scene, firstWords(s.when, 2), timing.voStart) ?? said(scene, firstWords(s.label, 2), timing.voStart)))
  // the track draws to each node as it arrives
  const lastAt = ats[n - 1]
  const trackP = interpolate(frame, [ats[0] - 10, lastAt + 6], [colW / 2 / W, 1 - colW / 2 / W], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  // Group = "when" (150) + track gap (50) + node + card (300). Centred under the heading.
  const headH = 150
  const whenH = 150, cardH = 300, gapTop = 46, gapCard = 40
  const groupH = whenH + gapTop + gapCard + cardH
  const groupTop = headH + Math.max(0, (H - headH - groupH) / 2)
  const trackY = groupTop + whenH + gapTop
  const active = ats.reduce((a, at, i) => (frame >= at ? i : a), -1)
  const cardW = Math.min(420, colW - 36)
  return (
    <Stage timing={timing}>
      <Heading text={scene.heading} at={6} width={W} max={76} lines={2} />
      <div style={{ position: 'absolute', left: 0, top: trackY - 3, width: W, height: 6, background: t.surfaceLine, borderRadius: 3 }} />
      <div style={{ position: 'absolute', left: colW / 2, top: trackY - 3, width: Math.max(0, (trackP * W) - colW / 2), height: 6, background: t.accentBig, borderRadius: 3 }} />
      {steps.map((s, i) => {
        const p = useSettle(ats[i], 20)
        const on = i === active
        const pulse = on ? 1 + Math.sin(frame * 0.12) * 0.12 : 1
        return (
          <div key={i} style={{ position: 'absolute', left: i * colW, top: groupTop, width: colW, display: 'flex', flexDirection: 'column', alignItems: 'center', ...settleStyle(p, { rise: 26 }) }}>
            <div style={{ width: colW - 40, height: whenH, display: 'flex', alignItems: 'flex-end' }}>
              <Fit max={n <= 3 ? 80 : 66} min={34} lines={2} style={{ fontFamily: head, fontWeight: Math.max(700, headWeight), color: t.accentInk, textAlign: 'center', lineHeight: 1.12, paddingBottom: '0.04em' }}>{s.when}</Fit>
            </div>
            <div style={{ height: gapTop }} />
            <div style={{ width: 40, height: 40, marginTop: -20, borderRadius: t.radius / 2, background: frame >= ats[i] ? t.accentBig : t.bg, border: `4px solid ${t.accentBig}`, transform: `scale(${pulse}) rotate(45deg)`, boxShadow: on ? `0 0 26px ${rgba(t.accentBig, 0.7)}` : undefined, boxSizing: 'border-box' }} />
            <div style={{ height: gapCard - 20 }} />
            <Card accent={on} style={{ width: cardW, height: cardH, padding: '30px 30px', display: 'flex', alignItems: 'center' }}>
              <Fit max={n <= 3 ? 50 : 42} min={MIN_TEXT.body - 4} lines={4} maxHeight={cardH - 60} style={{ fontFamily: body, fontWeight: 600, color: t.text, textAlign: 'center', lineHeight: 1.26 }}>{s.label}</Fit>
            </Card>
          </div>
        )
      })}
    </Stage>
  )
}

// ── 5. CHART ─────────────────────────────────────────────────────────────────
export const ChartView: React.FC<SceneProps<ChartScene>> = ({ scene, timing }) => {
  const [from, to] = revealWindow(timing)
  const headH = scene.takeaway ? 210 : 140
  return (
    <Stage timing={timing}>
      <Heading text={scene.heading} at={6} width={scene.kind === 'donut' ? 820 : W} max={72} lines={2} />
      {scene.takeaway && scene.kind !== 'donut' ? <div style={{ marginTop: 14 }}><Body text={scene.takeaway} at={14} width={1300} max={38} lines={2} /></div> : null}
      {scene.kind === 'donut'
        ? <Donut scene={scene} from={from} to={to} />
        : scene.kind === 'line'
          ? <LineArea scene={scene} from={from} to={to} top={headH} />
          : <Bars scene={scene} from={from} to={to} top={headH} voStart={timing.voStart} />}
    </Stage>
  )
}

const figOf = (scene: ChartScene, v: number) => ({ value: v, prefix: scene.prefix, suffix: scene.suffix, decimals: scene.decimals })

const Bars: React.FC<{ scene: ChartScene; from: number; to: number; top: number; voStart: number }> = ({ scene, from, to, top, voStart }) => {
  const { t, head, body } = useKit()
  const frame = useCurrentFrame()
  const pts = scene.points.slice(0, 6)
  const n = pts.length
  const max = Math.max(...pts.map((p) => p.value), 1)
  const hi = scene.highlight ?? pts.reduce((b, p, i) => (p.value > pts[b].value ? i : b), 0)
  const areaH = H - top - 40
  const labelH = 96, valueH = 86
  const barMaxH = areaH - labelH - valueH
  const colW = W / n
  const barW = Math.min(230, colW * 0.56)
  return (
    <div style={{ position: 'absolute', left: 0, top: top + 40, width: W, height: areaH }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: valueH + barMaxH, height: 3, background: t.surfaceLine }} />
      {pts.map((pt, i) => {
        const at = spread(i, n, from, to, said(scene, firstWords(pt.label, 2), voStart))
        const g = interpolate(frame, [at, at + 26], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
        const h = Math.max(6, (pt.value / max) * barMaxH * g)
        const isHi = i === hi
        const col = isHi ? t.accentBig : mix(t.series[1 + (i % Math.max(1, t.series.length - 1))] || t.accentBig, t.bg, 0.3)
        return (
          <div key={i} style={{ position: 'absolute', left: i * colW, top: 0, width: colW, height: areaH }}>
            <div style={{ position: 'absolute', left: (colW - Math.min(colW - 16, 300)) / 2, width: Math.min(colW - 16, 300), top: valueH + barMaxH - h - valueH, height: valueH, display: 'flex', alignItems: 'flex-end', opacity: g }}>
              <Fit max={isHi ? 62 : 50} min={26} lines={1} sizeFor={formatFigure(figOf(scene, pt.value))} style={{ fontFamily: head, fontWeight: 800, color: isHi ? t.accentInk : t.text, textAlign: 'center', lineHeight: 1.2, whiteSpace: 'nowrap', paddingBottom: 8 }}>{formatFigure(figOf(scene, pt.value), pt.value * g)}</Fit>
            </div>
            <div style={{ position: 'absolute', left: (colW - barW) / 2, width: barW, top: valueH + barMaxH - h, height: h, background: col, borderRadius: `${t.radius}px ${t.radius}px 0 0`, boxShadow: isHi ? `0 0 40px ${rgba(t.accentBig, 0.35)}` : undefined }} />
            <div style={{ position: 'absolute', left: 8, width: colW - 16, top: valueH + barMaxH + 16, height: labelH - 16 }}>
              <Fit max={34} min={22} lines={2} style={{ fontFamily: body, fontWeight: 600, color: isHi ? t.text : t.muted, textAlign: 'center', lineHeight: 1.22 }}>{pt.label}</Fit>
            </div>
          </div>
        )
      })}
    </div>
  )
}

const Donut: React.FC<{ scene: ChartScene; from: number; to: number }> = ({ scene, from, to }) => {
  const { t, head, body } = useKit()
  const frame = useCurrentFrame()
  const pts = scene.points.slice(0, 6)
  const total = pts.reduce((a, p) => a + Math.max(0, p.value), 0) || 1
  const hi = scene.highlight ?? 0
  const R = 250, SW = 92, C = 2 * Math.PI * R
  let acc = 0
  const ats = pts.map((_, i) => spread(i, pts.length, from, to))
  const legendTop = 190
  return (
    <>
      <div style={{ position: 'absolute', left: 40, top: 170, width: 620, height: 620 }}>
        <svg width={620} height={620} style={{ overflow: 'visible' }}>
          <g transform={`translate(310,310) rotate(${-90 + Math.sin(frame * 0.01) * 2})`}>
            <circle r={R} fill="none" stroke={t.surfaceLine} strokeWidth={SW} />
            {pts.map((pt, i) => {
              const frac = Math.max(0, pt.value) / total
              const g = interpolate(frame, [ats[i], ats[i] + 24], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
              const off = acc; acc += frac
              return <circle key={i} r={R} fill="none" stroke={t.series[i % t.series.length]} strokeWidth={i === hi ? SW + 16 : SW}
                strokeDasharray={`${Math.max(0, C * frac * g - 4)} ${C}`} strokeDashoffset={-C * off} />
            })}
          </g>
        </svg>
        <div style={{ position: 'absolute', left: 150, top: 230, width: 320, textAlign: 'center' }}>
          <Fit max={84} min={40} lines={1} sizeFor={formatFigure(figOf(scene, pts[hi]?.value ?? 0))} style={{ fontFamily: head, fontWeight: 800, color: t.text, textAlign: 'center', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
            {formatFigure(figOf(scene, pts[hi]?.value ?? 0), (pts[hi]?.value ?? 0) * interpolate(frame, [ats[hi] ?? from, (ats[hi] ?? from) + 26], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }))}
          </Fit>
          <Fit max={28} min={20} lines={2} style={{ fontFamily: body, fontWeight: 600, color: t.muted, textAlign: 'center', lineHeight: 1.25 }}>{pts[hi]?.label}</Fit>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 760, top: legendTop, width: W - 760, height: H - legendTop - 20, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 22 }}>
        {pts.map((pt, i) => {
          const p = useSettle(ats[i], 18)
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 26, ...settleStyle(p, { rise: 0, x: 30 }) }}>
              <div style={{ width: 30, height: 30, flexShrink: 0, background: t.series[i % t.series.length], borderRadius: t.radius / 2 }} />
              <div style={{ flex: 1, minWidth: 0 }}><Fit max={40} min={24} lines={2} style={{ fontFamily: body, fontWeight: 600, color: t.text, lineHeight: 1.22 }}>{pt.label}</Fit></div>
              <div style={{ width: 300, flexShrink: 0 }}><Fit max={52} min={28} lines={1} style={{ fontFamily: head, fontWeight: 800, color: i === hi ? t.accentInk : t.text, textAlign: 'right', lineHeight: 1.2, whiteSpace: 'nowrap' }}>{formatFigure(figOf(scene, pt.value))}</Fit></div>
            </div>
          )
        })}
        {scene.takeaway ? <div style={{ marginTop: 18 }}><Body text={scene.takeaway} at={to} width={W - 760} max={34} lines={2} /></div> : null}
      </div>
    </>
  )
}

const LineArea: React.FC<{ scene: ChartScene; from: number; to: number; top: number }> = ({ scene, from, to, top }) => {
  const { t, head, body } = useKit()
  const frame = useCurrentFrame()
  const pts = scene.points.slice(0, 8)
  const n = pts.length
  const vals = pts.map((p) => p.value)
  const vmax = Math.max(...vals), vmin = Math.min(0, ...vals)
  const plotTop = top + 90, plotH = H - plotTop - 110, plotW = W - 140
  const x = (i: number) => 70 + (n === 1 ? plotW / 2 : (plotW * i) / (n - 1))
  const y = (v: number) => plotTop + plotH - ((v - vmin) / Math.max(1e-9, vmax - vmin)) * plotH
  const g = interpolate(frame, [from, to + 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) })
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.value)}`).join(' ')
  const area = `${d} L${x(n - 1)},${plotTop + plotH} L${x(0)},${plotTop + plotH} Z`
  const len = pts.reduce((a, p, i) => (i ? a + Math.hypot(x(i) - x(i - 1), y(p.value) - y(pts[i - 1].value)) : 0), 0)
  const hi = scene.highlight ?? n - 1
  return (
    <>
      <svg width={W} height={H} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <defs><linearGradient id="kit-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={t.accentBig} stopOpacity={0.32} /><stop offset="100%" stopColor={t.accentBig} stopOpacity={0} /></linearGradient></defs>
        {[0, 0.5, 1].map((f) => <line key={f} x1={0} x2={W} y1={plotTop + plotH * f} y2={plotTop + plotH * f} stroke={t.surfaceLine} strokeWidth={2} />)}
        <path d={area} fill="url(#kit-area)" opacity={g} />
        <path d={d} fill="none" stroke={t.accentBig} strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={`${len * g} ${len}`} />
        {pts.map((p, i) => {
          const reached = g * (n - 1) >= i - 0.01
          return reached ? <circle key={i} cx={x(i)} cy={y(p.value)} r={i === hi ? 15 + Math.sin(frame * 0.12) * 2 : 10} fill={i === hi ? t.accentBig : t.bg} stroke={t.accentBig} strokeWidth={5} /> : null
        })}
      </svg>
      {pts.map((p, i) => {
        const reached = g * (n - 1) >= i - 0.01
        const w = Math.min(300, plotW / Math.max(1, n - 1) * 0.95)
        return (
          <React.Fragment key={i}>
            <div style={{ position: 'absolute', left: Math.min(W - w, Math.max(0, x(i) - w / 2)), top: y(p.value) - 78, width: w, opacity: reached ? 1 : 0 }}>
              <div style={{ display: 'flex', justifyContent: 'center' }}><div style={{ background: rgba(t.bg, 0.86), borderRadius: t.radius, padding: '2px 12px', maxWidth: w }}><Fit max={i === hi ? 50 : 38} min={22} lines={1} sizeFor={formatFigure(figOf(scene, p.value))} style={{ fontFamily: head, fontWeight: 800, color: i === hi ? t.accentInk : t.text, textAlign: 'center', lineHeight: 1.2, whiteSpace: 'nowrap', width: Math.min(w - 24, 40 + formatFigure(figOf(scene, p.value)).length * (i === hi ? 30 : 23)) }}>{formatFigure(figOf(scene, p.value))}</Fit></div></div>
            </div>
            <div style={{ position: 'absolute', left: Math.min(W - w, Math.max(0, x(i) - w / 2)), top: plotTop + plotH + 20, width: w }}>
              <Fit max={30} min={20} lines={2} style={{ fontFamily: body, fontWeight: 600, color: t.muted, textAlign: 'center', lineHeight: 1.22 }}>{p.label}</Fit>
            </div>
          </React.Fragment>
        )
      })}
    </>
  )
}

// ── 6. CHECKLIST ─────────────────────────────────────────────────────────────
export const ChecklistView: React.FC<SceneProps<ChecklistScene>> = ({ scene, timing }) => {
  const { t, body } = useKit()
  const frame = useCurrentFrame()
  const [from, to] = revealWindow(timing)
  const items = scene.items.slice(0, 4)
  const n = items.length
  const leftW = 560, gap = 90, rightW = W - leftW - gap
  return (
    <Stage timing={timing}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: leftW, height: H, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 30 }}>
        <Heading text={scene.heading} at={6} width={leftW} max={92} lines={4} />
        <Rule at={18} width={180} />
      </div>
      <div style={{ position: 'absolute', left: leftW + gap, top: 0, width: rightW, height: H, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 26 }}>
        {items.map((it, i) => {
          const at = spread(i, n, from, to, said(scene, firstWords(it, 2), timing.voStart))
          const p = useSettle(at, 20)
          const tick = interpolate(frame, [at + 6, at + 22], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
          const rowH = Math.min(n <= 2 ? 220 : 176, (H - 26 * (n - 1)) / n)
          return (
            <div key={i} style={{ height: rowH, display: 'flex', alignItems: 'center', gap: 34, ...settleStyle(p, { rise: 0, x: 60 }) }}>
              <Card accent={frame >= at + 10} style={{ width: n <= 2 ? 112 : 92, height: n <= 2 ? 112 : 92, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width={56} height={56} viewBox="0 0 56 56"><path d="M12 29 L24 41 L45 16" fill="none" stroke={t.accentBig} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={60} strokeDashoffset={60 * (1 - tick)} /></svg>
              </Card>
              <div style={{ flex: 1, minWidth: 0, height: rowH, display: 'flex', alignItems: 'center' }}>
                <Fit max={n === 1 ? 84 : n === 2 ? 74 : n === 3 ? 62 : 54} min={MIN_TEXT.body} lines={2} style={{ fontFamily: body, fontWeight: 600, color: t.text, lineHeight: 1.22 }}>{it}</Fit>
              </div>
            </div>
          )
        })}
      </div>
    </Stage>
  )
}

// ── 7. QUOTE ─────────────────────────────────────────────────────────────────
export const QuoteView: React.FC<SceneProps<QuoteScene>> = ({ scene, timing }) => {
  const { t, head, headWeight } = useKit()
  const frame = useCurrentFrame()
  const words = scene.quote.split(/\s+/).filter(Boolean)
  // words brighten one by one across the first ~70% of the voice
  const [from, to] = revealWindow(timing)
  const markP = useSettle(4, 24)
  return (
    <Stage timing={timing}>
      <div style={{ position: 'absolute', left: -10, top: -40, fontFamily: head, fontWeight: 800, fontSize: 340, lineHeight: 1, color: rgba(t.accentBig, 0.9), ...settleStyle(markP, { rise: 30, scale: 0.2 }) }}>“</div>
      <div style={{ position: 'absolute', left: 180, top: 130, width: W - 260, height: 470, display: 'flex', alignItems: 'center' }}>
        <Fit max={words.length <= 8 ? 150 : 96} min={MIN_TEXT.headline - 8} lines={5} sizeFor={scene.quote} style={{ fontFamily: head, fontWeight: Math.min(headWeight, 700), color: t.text, lineHeight: 1.2, letterSpacing: '-0.005em' }}>
          {words.map((w, i) => {
            const at = from + ((to - from) * i) / Math.max(1, words.length)
            const o = interpolate(frame, [at - 8, at + 6], [0.22, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
            return <React.Fragment key={i}><span style={{ opacity: o }}>{w}</span>{i < words.length - 1 ? ' ' : ''}</React.Fragment>
          })}
        </Fit>
      </div>
      {scene.attribution ? (
        <div style={{ position: 'absolute', left: 180, top: 650, width: W - 260, display: 'flex', alignItems: 'center', gap: 26 }}>
          <Rule at={to - 6} width={90} />
          <Body text={scene.attribution} at={to} width={1200} max={38} lines={1} />
        </div>
      ) : null}
    </Stage>
  )
}

// ── 8. CALL TO ACTION ────────────────────────────────────────────────────────
export const CtaView: React.FC<SceneProps<CtaScene>> = ({ scene, timing }) => {
  const { t, body, brand, upper } = useKit()
  const frame = useCurrentFrame()
  const photo = brand.presenter?.onClosing === false ? undefined : brand.presenter?.photo
  const c = scene.contact || {}
  const rows = ([['booking', c.booking], ['phone', c.phone], ['email', c.email], ['website', c.website]] as const).filter(([, v]) => !!v && String(v).trim())
  const leftW = photo ? 1040 : 1400
  const btnP = useSettle(30, 22)
  const glow = 0.5 + Math.sin(frame * 0.08) * 0.5
  const content = (
    <div style={{ width: leftW, display: 'flex', flexDirection: 'column', gap: 34, alignItems: photo ? 'flex-start' : 'center' }}>
      {!photo ? <div style={settleStyle(useSettle(4), { rise: 10 })}><KitLogo height={84} maxWidth={620} align="center" nameSize={38} /></div> : null}
      <Heading text={scene.headline} at={8} width={leftW} max={photo ? 104 : 116} lines={3} align={photo ? 'left' : 'center'} />
      <div style={{ ...settleStyle(btnP, { rise: 20, scale: 0.08 }) }}>
        {/* The button is sized from its words (about 25px a letter at 46px), then
            the words are fitted inside that fixed width — never wider than the column. */}
        <div style={{ background: t.accentBig, borderRadius: t.radius, padding: '26px 54px', boxShadow: `0 16px 50px ${rgba(t.accentBig, 0.25 + glow * 0.2)}`, width: Math.min(leftW, Math.max(440, scene.action.length * 26 + 140)), boxSizing: 'border-box' }}>
          <Fit max={46} min={30} lines={1} style={{ fontFamily: body, fontWeight: 800, color: t.onAccent, letterSpacing: upper ? '0.04em' : 0, lineHeight: 1.2, whiteSpace: 'nowrap', textAlign: 'center' }}>{scene.action}</Fit>
        </div>
      </div>
      {rows.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 6, alignItems: photo ? 'flex-start' : 'center' }}>
          {rows.map(([kind, v], i) => {
            const p = useSettle(44 + i * 8, 18)
            return (
              <div key={kind} style={{ display: 'flex', alignItems: 'center', gap: 20, width: leftW, justifyContent: photo ? 'flex-start' : 'center', ...settleStyle(p, { rise: 14 }) }}>
                <ContactIcon kind={kind} />
                {/* Centred: the row is sized to its words (~22px a letter at 40px) so the icon sits right beside them. */}
                <div style={{ width: photo ? leftW - 70 : Math.min(900, String(v).length * 22 + 24) }}><Fit max={40} min={24} lines={1} style={{ fontFamily: body, fontWeight: 600, color: t.text, lineHeight: 1.25, textAlign: 'left' }}>{String(v)}</Fit></div>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
  return (
    <Stage timing={timing}>
      {photo ? (
        <div style={{ display: 'flex', height: H, alignItems: 'center', gap: 120 }}>
          {content}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
            <Portrait src={photo} width={420} height={500} at={14} />
            <div style={{ width: 460 }}><KitLogo height={58} maxWidth={460} align="center" nameSize={30} /></div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', height: H, alignItems: 'center', justifyContent: 'center' }}>{content}</div>
      )}
    </Stage>
  )
}

const ContactIcon: React.FC<{ kind: 'booking' | 'phone' | 'email' | 'website' }> = ({ kind }) => {
  const { t } = useKit()
  const s = { fill: 'none', stroke: t.accentBig, strokeWidth: 3.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  return (
    <svg width={44} height={44} viewBox="0 0 44 44" style={{ flexShrink: 0 }}>
      {kind === 'phone' && <path {...s} d="M14 6 l6 9 -4 4 c2 5 5 8 10 10 l4 -4 9 6 -3 7 c-14 0 -27 -13 -27 -27z" />}
      {kind === 'email' && <><rect {...s} x="5" y="10" width="34" height="24" rx="3" /><path {...s} d="M6 12 l16 12 16 -12" /></>}
      {kind === 'website' && <><circle {...s} cx="22" cy="22" r="16" /><path {...s} d="M6 22 h32 M22 6 c-8 9 -8 23 0 32 c8 -9 8 -23 0 -32" /></>}
      {kind === 'booking' && <><rect {...s} x="6" y="9" width="32" height="28" rx="3" /><path {...s} d="M6 17 h32 M14 5 v8 M30 5 v8 M16 27 l4 4 8 -9" /></>}
    </svg>
  )
}

export const SCENE_VIEWS = {
  title: TitleView, bignumber: BigNumberView, comparison: ComparisonView, timeline: TimelineView,
  chart: ChartView, checklist: ChecklistView, quote: QuoteView, cta: CtaView,
} as const
