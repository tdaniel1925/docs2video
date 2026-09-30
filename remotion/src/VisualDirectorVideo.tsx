import { Fragment, useLayoutEffect, useRef } from 'react'
import type { CalculateMetadataFunction } from 'remotion'
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  continueRender,
  delayRender,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import { Fit } from './lib/fit'

// Load Inter explicitly: the render image only has Liberation fonts, so an
// unloaded 'Inter' silently exported in a different face from the editor.
const { fontFamily: INTER } = loadInter('normal', { weights: ['500', '600', '700', '800', '900'], subsets: ['latin'] })
const FONT = `${INTER}, Arial, sans-serif`

// Counts a stat up to exactly the spoken value: keeps decimals and thousands
// separators ("2.5×" used to end as "3×"), clamps spring overshoot, and never
// counts a year. Mirrors countUpTitle in the VisualDirector editor.
const countUpTitle = (title: string, progress: number) => {
  const match = title.match(/^([^\d-]*)(-?[\d,]*\.?\d+)(.*)$/)
  if (!match) return title
  const raw = match[2]
  const target = Number(raw.replaceAll(',', ''))
  if (!Number.isFinite(target) || (/^\d{4}$/.test(raw) && target >= 1900 && target <= 2100)) return title
  const decimals = raw.includes('.') ? raw.split('.')[1].length : 0
  const value = target * Math.max(0, Math.min(1, progress))
  const text = raw.includes(',')
    ? value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : value.toFixed(decimals)
  return `${match[1]}${text}${match[3]}`
}

// Captions sit at bottom 6% and are roughly 8% tall; anything anchored to the
// bottom edge must clear this band or it renders underneath the caption box.
const CAPTION_CLEARANCE = 0.16

export type VisualDirectorScene = {
  id: string
  start: number
  end: number
  label: string
  type: 'headline' | 'stat' | 'quote' | 'list' | 'chart' | 'workflow' | 'network' | 'comparison' | 'interface' | 'lower-third' | 'none'
  title: string
  subtitle: string
  placement: 'left' | 'right' | 'full'
  color: string
  enabled: boolean
  chartData?: Array<{ label: string; value: number }>
  motionPlan?: {
    purpose: string
    visual_concept?: string
    visualConcept?: string
    speaker_region?: 'left' | 'center' | 'right' | 'varies'
    preferred_region?: 'left' | 'right' | 'full'
    primary_animation?: MotionAnimation
    primaryAnimation?: MotionAnimation
    elements?: Array<{ type: string; content: string; animation: MotionAnimation; start: number }>
    exit: 'reverseCollapse' | 'slideAway' | 'maskClose' | 'scaleDown' | 'fadeSoft'
    intro_seconds?: number
    introSeconds?: number
    outro_seconds?: number
    outroSeconds?: number
  }
}

type MotionAnimation = 'slideSoftLeft' | 'slideSoftRight' | 'springUp' | 'scalePop' | 'maskReveal' | 'numberCount' | 'lineDraw' | 'cardExpand' | 'wordBuild' | 'splitReveal' | 'zoomFocus' | 'stackCards' | 'backgroundTakeover'

export type VisualDirectorWord = { word: string; start: number; end: number }

export type VisualDirectorProps = {
  sourceFile: string
  sourceUrl?: string
  durationSeconds: number
  aspect: '16:9' | '9:16' | '1:1'
  captions: boolean
  scenes: VisualDirectorScene[]
  words: VisualDirectorWord[]
  logo?: { sourceFile?: string; sourceUrl?: string; placement: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'; start: number; end: number; size: number } | null
}

const CAPTION_WORDS = 7
// Most bars a chart shows. The render service already keeps only the first 8.
const MAX_BARS = 8

// ---------------------------------------------------------------------------
// PANEL CAP — the panel is as tall as its words, up to a limit. Every word here
// comes from a transcript or a model, so a panel built for "2.5×" gets handed a
// 300-character title and a 500-character subtitle. The panel used to hide
// whatever didn't fit (overflow: hidden) — a chart or a whole subtitle simply
// vanished. Now, when the content is taller than the room, the whole group is
// scaled down together; it is laid out wider as it shrinks, so the lines
// re-wrap into the freed room rather than just getting smaller.
//
// Like FitBox (lib/fit), but for a box whose height comes from its content
// rather than from its parent. The <Fit> runs inside are measured first, at
// the panel's real width: ResetCap, the first child, puts the group back to
// scale 1 before they measure, so every frame measures the same way no matter
// what the previous frame left behind.
// ---------------------------------------------------------------------------
const capCache = new Map<string, number>()
const fontsReady = () => typeof document === 'undefined' || !document.fonts || document.fonts.status === 'loaded'

const ResetCap: React.FC<{ outer: React.RefObject<HTMLDivElement | null>; inner: React.RefObject<HTMLDivElement | null> }> = ({ outer, inner }) => {
  useLayoutEffect(() => {
    if (outer.current) outer.current.style.height = ''
    if (inner.current) { inner.current.style.width = '100%'; inner.current.style.transform = '' }
  })
  return null
}

/**
 * A network node (or the hub) that is centred on a point and may be at most
 * `maxHeight` tall. The <Fit> inside shrinks the words first; only when even
 * the smallest size is too tall is the whole node scaled down about its centre.
 */
const Node: React.FC<{ maxHeight: number; style: React.CSSProperties; children: React.ReactNode }> = ({ maxHeight, style, children }) => {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const fit = () => {
      const el = ref.current
      if (!el) return
      el.style.scale = ''
      // scrollHeight, not offsetHeight: words that overflowed the Fit at its
      // floor count too. Plus the borders, which scrollHeight leaves out.
      const h = el.scrollHeight + (el.offsetHeight - el.clientHeight)
      if (h > maxHeight + 1) {
        el.style.scale = String(maxHeight / h)
        console.log('D2V_FIT_SMALL ' + JSON.stringify({ what: 'VD network node', size: Math.round(maxHeight / h * 100), min: 100, text: (el.textContent || '').slice(0, 80) }))
      }
    }
    fit()
    if (!fontsReady()) {
      const handle = delayRender('VisualDirector node: waiting for fonts before measuring')
      document.fonts.ready.then(() => { fit(); continueRender(handle) })
    }
  })
  return <div ref={ref} style={style}>{children}</div>
}

const Capped: React.FC<{ maxHeight: number; minScale?: number; children: React.ReactNode }> = ({ maxHeight, minScale = 0.55, children }) => {
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const fit = () => {
      const box = outer.current, el = inner.current
      if (!box || !el) return
      const W = box.clientWidth
      if (!W) return
      const apply = (s: number) => { el.style.width = `${W / s}px`; el.style.transform = s < 1 ? `scale(${s})` : '' }
      // Fits at scale s: not taller than the cap. Widths are already safe: every
      // <Fit> inside measured at the narrowest width (scale 1), and shrinking
      // only ever lays the group out wider.
      const fits = (s: number) => { apply(s); return el.offsetHeight * s <= maxHeight }
      const key = [el.innerHTML.length, el.textContent, W, Math.round(maxHeight)].join('¦')
      let s = capCache.get(key)
      if (s == null) {
        s = 1
        if (!fits(1)) {
          let lo = 0.1, hi = 1
          for (let i = 0; i < 12; i++) {
            const mid = (lo + hi) / 2
            if (fits(mid)) lo = mid
            else hi = mid
          }
          s = lo
        }
        if (fontsReady()) capCache.set(key, s)
      }
      apply(s)
      box.style.height = `${el.offsetHeight * s}px`
      // Picked up by scripts/overflow-qa.mjs, like Fit's own warning.
      if (s < minScale) console.log('D2V_FIT_SMALL ' + JSON.stringify({ what: 'VD panel', size: Math.round(s * 100), min: Math.round(minScale * 100), text: (el.textContent || '').slice(0, 80) }))
    }
    fit()
    if (!fontsReady()) {
      const handle = delayRender('VisualDirector panel: waiting for fonts before measuring')
      document.fonts.ready.then(() => { fit(); continueRender(handle) })
    }
  })
  return <div ref={outer} style={{ position: 'relative', width: '100%', minWidth: 0 }}>
    <div ref={inner} style={{ width: '100%', transformOrigin: '0 0' }}>
      <ResetCap outer={outer} inner={inner} />
      {children}
    </div>
  </div>
}

const captionGroup = (words: VisualDirectorWord[], time: number) => {
  let active = -1
  for (let index = 0; index < words.length; index += 1) {
    if (words[index].start <= time) active = index
    else break
  }
  if (active < 0) return { words: [] as VisualDirectorWord[], active }
  const start = Math.floor(active / CAPTION_WORDS) * CAPTION_WORDS
  const group = words.slice(start, start + CAPTION_WORDS)
  if (!group.length || time > group[group.length - 1].end + 1.25) return { words: [], active }
  return { words: group, active: active - start }
}

const SceneGraphic = ({ scene, time, captionsVisible }: { scene: VisualDirectorScene; time: number; captionsVisible: boolean }) => {
  const frame = useCurrentFrame()
  const { fps, width, height } = useVideoConfig()
  const localFrame = Math.max(0, frame - Math.round(scene.start * fps))
  const introSeconds = Math.max(.2, scene.motionPlan?.intro_seconds ?? scene.motionPlan?.introSeconds ?? .55)
  const outroSeconds = Math.max(.2, scene.motionPlan?.outro_seconds ?? scene.motionPlan?.outroSeconds ?? .4)
  const entrance = spring({ fps, frame: localFrame, durationInFrames: Math.round(introSeconds * fps), config: { damping: 18, stiffness: 135 } })
  const exit = interpolate(time, [scene.end - outroSeconds, scene.end], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const lowerThird = scene.type === 'lower-third'
  const full = scene.placement === 'full' && !lowerThird
  const right = scene.placement === 'right'
  const itemSource = scene.subtitle.includes('|') ? scene.subtitle.split('|') : scene.subtitle.split(/,\s*(?:and\s+)?|\s+and\s+/i)
  const items = itemSource.map((item) => item.trim().replace(/[.]$/, '')).filter(Boolean)
  const animatedTitle = scene.type === 'stat' ? countUpTitle(scene.title, entrance) : scene.title
  const chartData = (scene.chartData || []).filter((item) => Number.isFinite(item.value) && item.value >= 0).slice(0, MAX_BARS)
  // Comparison labels come only from the spoken words ("Before: manual"),
  // never from invented BEFORE/AFTER captions.
  const comparisonItems = chartData.length >= 2
    ? chartData.slice(0, 2).map((item) => ({ label: item.label, value: item.value.toLocaleString() }))
    : items.slice(0, 2).map((item) => { const [label, ...rest] = item.split(':'); return rest.length ? { label: label.trim(), value: rest.join(':').trim() } : { label: '', value: item } })
  const chartMax = Math.max(1, ...chartData.map((item) => item.value))
  // Match the editor's container-relative type scale. Canvas-relative sizing
  // made exported titles much larger than the preview and caused clipping.
  const titleRatio = scene.title.length > 28 ? .022 : scene.title.length > 15 ? .028 : .035
  const statRatio = scene.title.length > 15 ? .048 : .062
  const baseSize = lowerThird
    ? Math.max(42, Math.round(width * .032))
    : Math.max(28, Math.min(height * .14, Math.round(width * (scene.type === 'stat' ? statRatio : titleRatio))))
  const panelWidth = lowerThird ? '31%' : full ? '78%' : width < height ? '76%' : '32%'
  const reveal = (index: number, pace = .13, content?: string) => {
    const matchedElement = content ? scene.motionPlan?.elements?.find((element) => element.content.trim().toLowerCase() === content.trim().toLowerCase()) : undefined
    const plannedStart = matchedElement?.start ?? scene.motionPlan?.elements?.[index]?.start
    if (Number.isFinite(plannedStart)) return interpolate(localFrame, [Number(plannedStart) * fps, (Number(plannedStart) + .45) * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    return Math.max(0, Math.min(1, entrance * 1.45 - index * pace))
  }
  const family = scene.motionPlan?.primary_animation ?? scene.motionPlan?.primaryAnimation ?? (scene.type === 'stat' ? 'numberCount' : scene.type === 'network' || scene.type === 'workflow' ? 'lineDraw' : 'springUp')
  const direction = right ? 1 : -1
  const motionTransform = family === 'slideSoftLeft' ? `translateX(${(1 - entrance) * -70}px)`
    : family === 'slideSoftRight' ? `translateX(${(1 - entrance) * 70}px)`
      : family === 'springUp' ? `translateY(${(1 - entrance) * 55}px) scale(${.97 + entrance * .03})`
        : family === 'scalePop' || family === 'cardExpand' ? `scale(${.84 + entrance * .16}) rotate(${(1 - entrance) * direction * 1.5}deg)`
          : family === 'zoomFocus' || family === 'backgroundTakeover' ? `scale(${1.07 - entrance * .07})`
            : family === 'stackCards' ? `translate(${direction * (1 - entrance) * 40}px, ${(1 - entrance) * 34}px) rotate(${direction * (1 - entrance) * 2}deg)`
              : `translateX(${direction * (1 - entrance) * 55}px) scale(${.97 + entrance * .03})`
  const exitFamily = scene.motionPlan?.exit ?? 'fadeSoft'
  const exitTransform = exitFamily === 'reverseCollapse' || exitFamily === 'scaleDown' ? ` scale(${.88 + exit * .12})`
    : exitFamily === 'slideAway' ? ` translateX(${direction * (1 - exit) * 70}px)`
      : ''
  const clipAmount = Math.max(
    family === 'maskReveal' || family === 'wordBuild' || family === 'splitReveal' ? (1 - entrance) * 100 : 0,
    exitFamily === 'maskClose' ? (1 - exit) * 100 : 0,
  )

  // How tall the panel's content may get: the panel's own 82% limit of the room
  // inside the outer padding (full: 9% of the WIDTH, as CSS reads '9% 12%'),
  // less the panel's padding. Content taller than this is scaled down (Capped).
  const outerPadBottom = lowerThird ? Math.round(height * (captionsVisible ? CAPTION_CLEARANCE : 0.055)) : full ? width * 0.09 : Math.round(height * 0.08)
  const outerPadTop = lowerThird ? 0 : outerPadBottom
  const panelPadY = lowerThird ? height * 0.017 : height * 0.034
  const contentMax = Math.max(40, (height - outerPadTop - outerPadBottom) * 0.82 - 2 * panelPadY - 2)
  const itemSize = Math.max(18, width * 0.015)
  // Tallest bar: the old chart box (22% of the height) less its 30px label
  // strip and 2px axis line, so bars are exactly as tall as they were.
  const barArea = height * .22 - 32
  const hubFont = Math.max(14, baseSize * .45)
  const nodeFont = Math.max(14, width * .0105)
  // At line-height 1.02 the glyphs hang below the last line box; the padding
  // gives them room (so Fit doesn't read that as overflow) and the negative
  // margin takes it back, so the layout is unchanged.
  // A counting stat is sized against its FINAL value (sizeFor), measured on a
  // hidden copy that inherits the Fit's line-height — so the Fit keeps a
  // roomy 1.25 for that copy and the visible number sits in a 1.02 block.
  const glyphRoom: React.CSSProperties = { paddingBottom: '0.1em', marginBottom: '-0.1em' }
  const titleStyle: React.CSSProperties = { color: scene.type === 'quote' ? '#fff' : scene.color, fontWeight: 850, letterSpacing: '-0.045em' }
  const title = scene.type === 'stat'
    ? <Fit max={baseSize} min={Math.min(baseSize, 24)} sizeFor={scene.title} style={{ ...titleStyle, lineHeight: 1.25 }}><div style={{ lineHeight: 1.02 }}>{animatedTitle}</div></Fit>
    : scene.type !== 'interface' && scene.type !== 'network'
      ? <Fit max={baseSize} min={Math.min(baseSize, 24)} lines={lowerThird ? 2 : undefined} style={{ ...titleStyle, lineHeight: 1.02, ...glyphRoom }}>{animatedTitle}</Fit>
      : null

  return <AbsoluteFill style={{
    justifyContent: lowerThird ? 'flex-end' : 'center',
    alignItems: lowerThird ? 'flex-start' : full ? 'center' : right ? 'flex-end' : 'flex-start',
    padding: lowerThird
      ? `0 ${Math.round(width * 0.045)}px ${Math.round(height * (captionsVisible ? CAPTION_CLEARANCE : 0.055))}px`
      : full ? '9% 12%' : `${Math.round(height * 0.08)}px ${Math.round(width * 0.045)}px`,
    boxSizing: 'border-box',
    background: full ? 'rgba(5,6,9,.72)' : undefined,
    opacity: exit,
  }}>
    <div style={{
      width: panelWidth,
      maxWidth: '100%',
      maxHeight: '82%',
      overflow: 'hidden',
      padding: lowerThird ? `${height * 0.017}px ${width * 0.014}px` : `${height * 0.034}px ${width * 0.017}px`,
      boxSizing: 'border-box',
      color: '#fff',
      textAlign: full ? 'center' : 'left',
      borderLeft: full ? undefined : `7px solid ${scene.color}`,
      borderRadius: 24,
      background: lowerThird ? 'rgba(8,9,13,.88)' : 'linear-gradient(135deg, rgba(8,9,13,.9), rgba(8,9,13,.56))',
      boxShadow: '0 28px 80px rgba(0,0,0,.35)',
      backdropFilter: 'blur(16px)',
      transform: `${motionTransform}${exitTransform}`,
      clipPath: clipAmount > 0 ? `inset(0 ${clipAmount}% 0 0 round 18px)` : undefined,
      filter: family === 'zoomFocus' ? `blur(${(1 - entrance) * 7}px)` : undefined,
      fontFamily: FONT,
    }}>
      <Capped maxHeight={contentMax}>
      {scene.type === 'quote' && <div style={{ color: scene.color, fontSize: baseSize * 0.8, lineHeight: 0.7, marginBottom: 16 }}>“</div>}
      {lowerThird && <Fit max={Math.max(14, width * .009)} lines={2} style={{ marginBottom: 8, color: 'rgba(255,255,255,.68)', fontFamily: 'monospace', fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase' }}>{scene.label}</Fit>}
      {title}
      {scene.type === 'list' && items.length > 0 ? <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 10, marginTop: 22 }}>
        {items.slice(0, 7).map((item, index) => <div key={`${item}-${index}`} style={{ display: 'flex', gap: 14, alignItems: 'center', minWidth: 0, padding: '10px 14px', borderRadius: 9, background: 'rgba(255,255,255,.07)', opacity: reveal(index), transform: `translateX(${(1 - reveal(index)) * 26}px)`, fontSize: itemSize }}><b style={{ flex: 'none', color: scene.color, fontFamily: 'monospace' }}>{String(index + 1).padStart(2, '0')}</b><div style={{ flex: 1, minWidth: 0 }}><Fit max={itemSize} min={16} lines={2}>{item}</Fit></div></div>)}
      </div> : scene.type === 'chart' && chartData.length >= 2 ? <div style={{ display: 'grid', gridTemplateColumns: `repeat(${chartData.length}, minmax(0, 1fr))`, columnGap: width * .014, alignItems: 'end', marginTop: 4, borderBottom: '2px solid rgba(255,255,255,.35)' }}>
        {/* Row 1: each value sits just above its bar; bars share one baseline. Row 2: the labels. */}
        {chartData.map((item, index) => <div key={`bar-${item.label}-${index}`} style={{ gridRow: 1, gridColumn: index + 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <Fit max={Math.max(17, width * .014)} lines={2} style={{ marginBottom: 0, textAlign: 'center', fontWeight: 700, opacity: reveal(index, .1) }}>{item.value.toLocaleString().replace(/,/g, ',​') /* a big number may wrap after a comma, never mid-group */}</Fit>
          <div style={{ height: barArea * Math.max(8, item.value / chartMax * 100) / 100, transform: `scaleY(${reveal(index, .1)})`, transformOrigin: 'bottom', borderRadius: '8px 8px 0 0', background: `linear-gradient(180deg, #fff3, ${scene.color})`, boxShadow: `0 0 30px ${scene.color}55` }} />
        </div>)}
        {chartData.map((item, index) => <div key={`label-${item.label}-${index}`} style={{ gridRow: 2, gridColumn: index + 1, alignSelf: 'start', minWidth: 0, padding: '8px 0 6px' }}><Fit max={Math.max(14, width * .011)} lines={2} style={{ textAlign: 'center' }}>{item.label}</Fit></div>)}
      </div> : scene.type === 'workflow' ? <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 10, marginTop: 22 }}>{items.slice(0, 6).map((item, index) => <div key={`${item}-${index}`} style={{ position: 'relative', display: 'grid', gridTemplateColumns: '38px minmax(0, 1fr)', gap: 12, alignItems: 'center', opacity: reveal(index, .13, item), transform: `translateY(${(1 - reveal(index, .13, item)) * 18}px)` }}><b style={{ width: 36, height: 36, border: `2px solid ${scene.color}`, borderRadius: 8, display: 'grid', placeItems: 'center', color: scene.color, fontFamily: 'monospace', zIndex: 1, background: 'rgba(8,9,13,.94)' }}>{index + 1}</b><div style={{ minWidth: 0, padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,.07)', fontSize: Math.max(17, width * .014) }}><Fit max={Math.max(17, width * .014)} min={16} lines={3}>{item}</Fit></div>{index < items.length - 1 && <i style={{ position: 'absolute', left: 17, top: 35, width: 3, height: 20, background: scene.color, transformOrigin: 'top', transform: `scaleY(${reveal(index + 1, .13, items[index + 1])})`, boxShadow: `0 0 10px ${scene.color}` }} />}</div>)}</div>
      : scene.type === 'interface' ? <div><div style={{ color: '#8f8d94', fontFamily: 'monospace', fontSize: width * .009, letterSpacing: '.16em' }}>AI ASSISTANT</div><Fit max={baseSize * .72} min={Math.min(baseSize * .72, 20)} style={{ marginTop: 18, color: '#fff', fontWeight: 850 }}>{scene.title}</Fit><div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 9, marginTop: 18 }}>{items.slice(0, 6).map((item, index) => <div key={`${item}-${index}`} style={{ minWidth: 0, padding: '11px 14px', borderRadius: 8, background: 'rgba(255,255,255,.07)', borderLeft: `3px solid ${scene.color}`, opacity: reveal(index), transform: `translateY(${(1 - reveal(index)) * 14}px)`, fontSize: Math.max(16, width * .013) }}><Fit max={Math.max(16, width * .013)} min={16} lines={3}>{item}</Fit></div>)}</div></div>
      : scene.type === 'network' ? <div style={{ position: 'relative', height: height * .34 }}><svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>{items.slice(0, 6).map((_, index) => { const angle = (Math.PI * 2 * index / Math.min(6, items.length)) - Math.PI / 2; const x = 50 + Math.cos(angle) * 39; const y = 50 + Math.sin(angle) * 38; return <line key={index} x1="50" y1="50" x2={x} y2={y} stroke={scene.color} strokeWidth="1.5" strokeDasharray="100" strokeDashoffset={100 - reveal(index) * 100} opacity="0.82" vectorEffect="non-scaling-stroke" style={{ filter: `drop-shadow(0 0 4px ${scene.color})` }} /> })}</svg>
        {/* The hub may be at most 36% of the area tall; each node 24%, and never wider than twice its distance to the nearer side — so no node leaves the area or runs into another. */}
        <Node maxHeight={height * .34 * .36} style={{ position: 'absolute', left: '50%', top: '50%', width: '38%', minHeight: '28%', translate: '-50% -50%', display: 'grid', placeItems: 'center', padding: 14, border: `2px solid ${scene.color}`, borderRadius: 10, background: 'rgba(8,9,13,.94)', color: '#fff', fontWeight: 850, textAlign: 'center', fontSize: hubFont }}><Fit max={hubFont} min={14} lines={Math.max(1, Math.floor((height * .34 * .36 - 32) / (hubFont * 1.2)))} style={{ lineHeight: 1.2 }}>{scene.title}</Fit></Node>
        {items.slice(0, 6).map((item, index) => { const angle = (Math.PI * 2 * index / Math.min(6, items.length)) - Math.PI / 2; const x = 50 + Math.cos(angle) * 39; const y = 50 + Math.sin(angle) * 38; return <Node key={`${item}-${index}`} maxHeight={height * .34 * .24} style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, translate: '-50% -50%', width: 'max-content', maxWidth: `${Math.min(29, 2 * Math.min(x, 100 - x))}%`, padding: '8px 11px', border: '1px solid rgba(255,255,255,.12)', borderRadius: 7, background: 'rgba(14,12,18,.94)', opacity: reveal(index), fontSize: nodeFont, textAlign: 'center' }}><Fit max={nodeFont} min={14} lines={Math.max(1, Math.floor((height * .34 * .24 - 18) / (nodeFont * 1.2)))} style={{ lineHeight: 1.2 }}>{item}</Fit></Node> })}</div>
      : scene.type === 'comparison' ? <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14, marginTop: 24 }}>{comparisonItems.map((item, index) => <div key={`${item.value}-${index}`} style={{ minWidth: 0, minHeight: height * .13, padding: 18, borderRadius: 10, border: `2px solid ${index ? scene.color : 'rgba(255,255,255,.15)'}`, background: index ? `${scene.color}18` : 'rgba(255,255,255,.05)', opacity: reveal(index, .22), transform: `translateY(${(1 - reveal(index, .22)) * 20}px)` }}>{item.label && <i style={{ display: 'block', color: '#aaa7af', fontFamily: 'monospace', fontSize: width * .009, overflowWrap: 'anywhere' }}>{item.label}</i>}<Fit max={Math.max(18, width * .016)} min={16} style={{ marginTop: 14, fontWeight: 700 }}>{item.value}</Fit></div>)}</div>
      : scene.subtitle && <Fit max={lowerThird ? Math.max(24, width * .016) : Math.max(18, width * 0.017)} min={16} lines={lowerThird ? 3 : undefined} style={{ marginTop: lowerThird ? 8 : 18, lineHeight: 1.35, fontWeight: 550 }}>{scene.subtitle}</Fit>}
      </Capped>
    </div>
  </AbsoluteFill>
}

export const VisualDirectorVideo = (props: VisualDirectorProps) => {
  const frame = useCurrentFrame()
  const { fps, width, height } = useVideoConfig()
  const time = frame / fps
  const scene = props.scenes.find((item) => item.enabled && item.type !== 'none' && time >= item.start && time < item.end)
  const caption = captionGroup(props.words, time)
  const logoVisible = props.logo && time >= props.logo.start && time < props.logo.end
  const logoEntrance = props.logo ? spring({ fps, frame: Math.max(0, frame - Math.round(props.logo.start * fps)), durationInFrames: Math.round(.5 * fps), config: { damping: 18, stiffness: 140 } }) : 0
  const logoExit = props.logo ? interpolate(time, [props.logo.end - .35, props.logo.end], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 0
  const logoPosition = props.logo?.placement || 'top-right'
  const logoStyle = props.logo ? {
    position: 'absolute' as const,
    width: `${props.logo.size}%`,
    maxHeight: '16%',
    objectFit: 'contain' as const,
    top: logoPosition.startsWith('top') ? '5%' : undefined,
    bottom: logoPosition.startsWith('bottom') ? '5%' : undefined,
    left: logoPosition.endsWith('left') ? '4.5%' : undefined,
    right: logoPosition.endsWith('right') ? '4.5%' : undefined,
    opacity: Math.min(logoEntrance, logoExit),
    transform: `translateY(${(1 - logoEntrance) * 24}px) scale(${.92 + logoEntrance * .08})`,
    filter: 'drop-shadow(0 8px 22px rgba(0,0,0,.45))',
  } : undefined

  return <AbsoluteFill style={{ backgroundColor: '#08090b' }}>
    <OffthreadVideo
      src={props.sourceUrl || staticFile(props.sourceFile)}
      style={{ width, height, objectFit: 'cover' }}
    />
    {scene && <SceneGraphic scene={scene} time={time} captionsVisible={props.captions && props.words.length > 0} />}
    {logoVisible && props.logo && logoStyle && <Img src={props.logo.sourceUrl || staticFile(props.logo.sourceFile || '')} style={logoStyle} />}
    {/* One line, always: CAPTION_CLEARANCE and the side panels' height both
        assume the band is one line tall. A group too long for one line
        shrinks instead of growing up over the lower third. */}
    {props.captions && caption.words.length > 0 && <div style={{
      position: 'absolute', left: '12%', right: '12%', bottom: '6%',
      padding: `${height * 0.018}px ${width * 0.025}px`, borderRadius: 18,
      color: '#fff', background: 'rgba(0,0,0,.76)',
      fontFamily: FONT, fontWeight: 750,
      fontSize: Math.max(23, width * 0.023), lineHeight: 1.25, textAlign: 'center',
      textShadow: '0 2px 8px rgba(0,0,0,.8)',
    }}>
      <Fit max={Math.max(23, width * 0.023)} min={Math.round(Math.max(23, width * 0.023) * 0.6)} lines={1} style={{ wordSpacing: '0.09em' /* a space + this = the old .3em gap between words */ }}>
        {caption.words.map((word, index) => <Fragment key={`${word.start}-${index}`}>{index ? ' ' : ''}<span style={{ color: index === caption.active ? '#d9ff6b' : '#fff' }}>{word.word}</span></Fragment>)}
      </Fit>
    </div>}
  </AbsoluteFill>
}

export const visualDirectorMetadata: CalculateMetadataFunction<VisualDirectorProps> = ({ props }) => {
  const size = props.aspect === '9:16' ? { width: 1080, height: 1920 } : props.aspect === '1:1' ? { width: 1080, height: 1080 } : { width: 1920, height: 1080 }
  return { ...size, durationInFrames: Math.max(1, Math.ceil(props.durationSeconds * 30)) }
}
