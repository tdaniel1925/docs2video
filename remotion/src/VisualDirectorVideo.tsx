import type { CalculateMetadataFunction } from 'remotion'
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'

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
  const chartData = (scene.chartData || []).filter((item) => Number.isFinite(item.value) && item.value >= 0)
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
      {scene.type === 'quote' && <div style={{ color: scene.color, fontSize: baseSize * 0.8, lineHeight: 0.7, marginBottom: 16 }}>“</div>}
      {lowerThird && <div style={{ marginBottom: 8, color: 'rgba(255,255,255,.68)', fontFamily: 'monospace', fontSize: Math.max(14, width * .009), fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase' }}>{scene.label}</div>}
      {scene.type !== 'interface' && scene.type !== 'network' && <div style={{ color: scene.type === 'quote' ? '#fff' : scene.color, fontSize: baseSize, fontWeight: 850, lineHeight: 1.02, letterSpacing: '-0.045em', overflowWrap: 'anywhere' }}>{animatedTitle}</div>}
      {scene.type === 'list' && items.length > 0 ? <div style={{ display: 'grid', gap: 10, marginTop: 22 }}>
        {items.slice(0, 7).map((item, index) => <div key={`${item}-${index}`} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '10px 14px', borderRadius: 9, background: 'rgba(255,255,255,.07)', opacity: reveal(index), transform: `translateX(${(1 - reveal(index)) * 26}px)`, fontSize: Math.max(18, width * 0.015), whiteSpace: 'nowrap', overflow: 'hidden' }}><b style={{ color: scene.color, fontFamily: 'monospace' }}>{String(index + 1).padStart(2, '0')}</b><span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item}</span></div>)}
      </div> : scene.type === 'chart' && chartData.length >= 2 ? <div style={{ height: height * .22, display: 'flex', alignItems: 'flex-end', gap: width * .014, marginTop: 34, paddingBottom: 30, borderBottom: '2px solid rgba(255,255,255,.35)' }}>
        {chartData.map((item, index) => <div key={`${item.label}-${index}`} style={{ flex: 1, position: 'relative', height: `${Math.max(8, item.value / chartMax * 100)}%`, transform: `scaleY(${reveal(index, .1)})`, transformOrigin: 'bottom', borderRadius: '8px 8px 0 0', background: `linear-gradient(180deg, #fff3, ${scene.color})`, boxShadow: `0 0 30px ${scene.color}55` }}><b style={{ position: 'absolute', top: -30, width: '100%', textAlign: 'center', fontSize: Math.max(17, width * .014) }}>{item.value.toLocaleString()}</b><span style={{ position: 'absolute', top: '100%', width: '100%', paddingTop: 8, textAlign: 'center', fontSize: Math.max(14, width * .011), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span></div>)}
      </div> : scene.type === 'workflow' ? <div style={{ display: 'grid', gap: 10, marginTop: 22 }}>{items.slice(0, 6).map((item, index) => <div key={`${item}-${index}`} style={{ position: 'relative', display: 'grid', gridTemplateColumns: '38px 1fr', gap: 12, alignItems: 'center', opacity: reveal(index, .13, item), transform: `translateY(${(1 - reveal(index, .13, item)) * 18}px)` }}><b style={{ width: 36, height: 36, border: `2px solid ${scene.color}`, borderRadius: 8, display: 'grid', placeItems: 'center', color: scene.color, fontFamily: 'monospace', zIndex: 1, background: 'rgba(8,9,13,.94)' }}>{index + 1}</b><span style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,.07)', fontSize: Math.max(17, width * .014) }}>{item}</span>{index < items.length - 1 && <i style={{ position: 'absolute', left: 17, top: 35, width: 3, height: 20, background: scene.color, transformOrigin: 'top', transform: `scaleY(${reveal(index + 1, .13, items[index + 1])})`, boxShadow: `0 0 10px ${scene.color}` }} />}</div>)}</div>
      : scene.type === 'interface' ? <div><div style={{ color: '#8f8d94', fontFamily: 'monospace', fontSize: width * .009, letterSpacing: '.16em' }}>AI ASSISTANT</div><div style={{ marginTop: 18, color: '#fff', fontWeight: 850, fontSize: baseSize * .72 }}>{scene.title}</div><div style={{ display: 'grid', gap: 9, marginTop: 18 }}>{items.slice(0, 6).map((item, index) => <div key={`${item}-${index}`} style={{ padding: '11px 14px', borderRadius: 8, background: 'rgba(255,255,255,.07)', borderLeft: `3px solid ${scene.color}`, opacity: reveal(index), transform: `translateY(${(1 - reveal(index)) * 14}px)`, fontSize: Math.max(16, width * .013) }}>{item}</div>)}</div></div>
      : scene.type === 'network' ? <div style={{ position: 'relative', height: height * .34 }}><svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>{items.slice(0, 6).map((_, index) => { const angle = (Math.PI * 2 * index / Math.min(6, items.length)) - Math.PI / 2; const x = 50 + Math.cos(angle) * 39; const y = 50 + Math.sin(angle) * 38; return <line key={index} x1="50" y1="50" x2={x} y2={y} stroke={scene.color} strokeWidth="1.5" strokeDasharray="100" strokeDashoffset={100 - reveal(index) * 100} opacity="0.82" vectorEffect="non-scaling-stroke" style={{ filter: `drop-shadow(0 0 4px ${scene.color})` }} /> })}</svg><div style={{ position: 'absolute', left: '50%', top: '50%', width: '38%', minHeight: '28%', translate: '-50% -50%', display: 'grid', placeItems: 'center', padding: 14, border: `2px solid ${scene.color}`, borderRadius: 12, background: 'rgba(8,9,13,.94)', color: '#fff', fontWeight: 850, textAlign: 'center', fontSize: baseSize * .45 }}>{scene.title}</div>{items.slice(0, 6).map((item, index) => { const angle = (Math.PI * 2 * index / Math.min(6, items.length)) - Math.PI / 2; const x = 50 + Math.cos(angle) * 39; const y = 50 + Math.sin(angle) * 38; return <div key={`${item}-${index}`} style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, translate: '-50% -50%', maxWidth: '29%', padding: '8px 11px', border: '1px solid rgba(255,255,255,.12)', borderRadius: 7, background: 'rgba(14,12,18,.94)', opacity: reveal(index), fontSize: Math.max(13, width * .0105), textAlign: 'center' }}>{item}</div> })}</div>
      : scene.type === 'comparison' ? <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 24 }}>{comparisonItems.map((item, index) => <div key={`${item.value}-${index}`} style={{ minWidth: 0, minHeight: height * .13, padding: 18, borderRadius: 10, border: `2px solid ${index ? scene.color : 'rgba(255,255,255,.15)'}`, background: index ? `${scene.color}18` : 'rgba(255,255,255,.05)', opacity: reveal(index, .22), transform: `translateY(${(1 - reveal(index, .22)) * 20}px)` }}>{item.label && <i style={{ color: '#aaa7af', fontFamily: 'monospace', fontSize: width * .009 }}>{item.label}</i>}<b style={{ display: 'block', marginTop: 14, fontSize: Math.max(18, width * .016), overflowWrap: 'anywhere' }}>{item.value}</b></div>)}</div>
      : scene.subtitle && <div style={{ marginTop: lowerThird ? 8 : 18, maxWidth: '100%', fontSize: lowerThird ? Math.max(24, width * .016) : Math.max(18, width * 0.017), lineHeight: 1.35, fontWeight: 550, overflowWrap: 'anywhere' }}>{scene.subtitle}</div>}
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
    {props.captions && caption.words.length > 0 && <div style={{
      position: 'absolute', left: '12%', right: '12%', bottom: '6%',
      display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '0 .3em',
      padding: `${height * 0.018}px ${width * 0.025}px`, borderRadius: 18,
      color: '#fff', background: 'rgba(0,0,0,.76)',
      fontFamily: FONT, fontWeight: 750,
      fontSize: Math.max(23, width * 0.023), lineHeight: 1.25, textAlign: 'center',
      textShadow: '0 2px 8px rgba(0,0,0,.8)',
    }}>
      {caption.words.map((word, index) => <span key={`${word.start}-${index}`} style={{ color: index === caption.active ? '#d9ff6b' : '#fff' }}>{word.word}</span>)}
    </div>}
  </AbsoluteFill>
}

export const visualDirectorMetadata: CalculateMetadataFunction<VisualDirectorProps> = ({ props }) => {
  const size = props.aspect === '9:16' ? { width: 1080, height: 1920 } : props.aspect === '1:1' ? { width: 1080, height: 1080 } : { width: 1920, height: 1080 }
  return { ...size, durationInFrames: Math.max(1, Math.ceil(props.durationSeconds * 30)) }
}
