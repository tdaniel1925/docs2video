import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion'
import { staticFile } from '../lib/asset'
import { type EditorialTheme } from './theme'
import { parseMetric, renderMetric } from '../components/infographic/format'
import type { EditorialScene } from './archetype'

/* ----------------------------- shared helpers ----------------------------- */

function settle(frame: number, delay: number, fps: number) {
  return interpolate(frame, [delay, delay + Math.round(0.6 * fps)], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic),
  })
}

/** A thin rule that "draws" in from the left. */
const Rule: React.FC<{ color: string; delay: number; width?: number | string; thickness?: number }> = ({ color, delay, width = 220, thickness = 3 }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const p = settle(frame, delay, fps)
  return <div style={{ height: thickness, width: typeof width === 'number' ? width * p : width, background: color, transformOrigin: 'left' }} />
}

const Kicker: React.FC<{ text: string; theme: EditorialTheme; delay?: number }> = ({ text, theme, delay = 2 }) => {
  const { fontKicker: FONT_KICKER } = theme
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const p = settle(frame, delay, fps)
  // Time = bold red kicker with wide tracking (newsmagazine). Editorial = quieter,
  // muted, tighter tracking (refined).
  const isTime = theme.variant === 'time'
  return (
    <div style={{ opacity: p, transform: `translateY(${(1 - p) * 10}px)`, fontFamily: FONT_KICKER, fontWeight: isTime ? 700 : 600, letterSpacing: isTime ? '0.28em' : '0.18em', fontSize: isTime ? 26 : 22, color: isTime ? theme.accent : theme.muted, textTransform: 'uppercase' }}>
      {text}
    </div>
  )
}

/** A framed editorial photo with a monospace caption — or a striped placeholder
 *  if no image (so the slide always looks finished). */
const Figure: React.FC<{ image?: string; caption?: string; theme: EditorialTheme; style?: React.CSSProperties }> = ({ image, caption, theme, style }) => {
  const { fontMono: FONT_MONO } = theme
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const p = settle(frame, 8, fps)
  const r = theme.radius > 0 ? theme.radius : undefined
  return (
    <div style={{ opacity: p, display: 'flex', flexDirection: 'column', gap: 10, ...style }}>
      <div style={{ flex: 1, border: `6px solid ${theme.paper}`, outline: `1.5px solid ${theme.ink}`, boxShadow: '0 6px 24px rgba(0,0,0,0.18)', overflow: 'hidden', position: 'relative', background: theme.paperEdge, borderRadius: r }}>
        {image ? (
          <Img src={staticFile(image)} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'saturate(0.92) contrast(1.05)' }} />
        ) : (
          <AbsoluteFill style={{ backgroundImage: `repeating-linear-gradient(45deg, ${theme.hairline} 0 2px, transparent 2px 14px)` }} />
        )}
      </div>
      {caption ? <div style={{ fontFamily: FONT_MONO, fontSize: 16, letterSpacing: '0.04em', color: theme.muted, textTransform: 'uppercase' }}>{caption}</div> : null}
    </div>
  )
}

/* ------------------------------ the frame --------------------------------- */

/** Every editorial page sits inside a brand-color frame with a paper interior
 *  and a running folio header (BRAND · TITLE · pg). The signature device. */
export const EditorialFrame: React.FC<{
  theme: EditorialTheme
  masthead: string
  runningTitle: string
  page: number
  frameWidth?: number
  showFolio?: boolean
  children: React.ReactNode
}> = ({ theme, masthead, runningTitle, page, frameWidth, showFolio = true, children }) => {
  const { fontMono: FONT_MONO } = theme
  // Frame thickness comes from the theme (Time = bold ~16px, Editorial = thin ~5px)
  // unless a caller overrides it.
  const fw = frameWidth ?? theme.frameWidth
  // The brand-color frame is a real `border` on ONE full-bleed box with
  // box-sizing:border-box — NOT nested AbsoluteFills with padding/inset, which
  // compounded badly and dropped the right + bottom edges (the "cut off" border).
  // A border on a single sized box renders symmetrically on all four sides.
  return (
    <AbsoluteFill style={{
      boxSizing: 'border-box', border: `${fw}px solid ${theme.accent}`,
      background: theme.paper, display: 'flex', flexDirection: 'column',
    }}>
      {showFolio ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '26px 56px', borderBottom: `${theme.variant === 'time' ? 2 : 1}px solid ${theme.variant === 'time' ? theme.ink : theme.hairline}`, fontFamily: FONT_MONO, fontSize: 17, letterSpacing: '0.12em', color: theme.muted, textTransform: 'uppercase' }}>
          <span style={{ fontWeight: 600, color: theme.ink }}>{masthead}</span>
          <span>{runningTitle}</span>
          <span>{String(page).padStart(2, '0')}</span>
        </div>
      ) : null}
      <div style={{ flex: 1, position: 'relative' }}>{children}</div>
    </AbsoluteFill>
  )
}

/* ------------------------------ archetypes -------------------------------- */

type SceneProps = { scene: EditorialScene; theme: EditorialTheme; masthead: string; runningTitle: string; page: number }
type Presenter = { name?: string; role?: string; photo?: string }

/** A square, bordered editorial portrait with a mono caption ("NAME · ROLE") —
 *  the magazine way to show a byline/headshot. Reuses the Figure look. */
const Portrait: React.FC<{ presenter: Presenter; theme: EditorialTheme; size?: number }> = ({ presenter, theme, size = 280 }) => {
  const { fontMono: FONT_MONO } = theme
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const p = settle(frame, 10, fps)
  if (!presenter.photo) return null
  const caption = [presenter.name, presenter.role].filter(Boolean).join(' · ')
  const r = theme.radius > 0 ? theme.radius : undefined
  return (
    <div style={{ opacity: p, transform: `translateY(${(1 - p) * 14}px)`, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
      <div style={{ width: size, height: size, border: `6px solid ${theme.paper}`, outline: `1.5px solid ${theme.ink}`, boxShadow: '0 6px 24px rgba(0,0,0,0.18)', overflow: 'hidden', background: theme.paperEdge, borderRadius: r }}>
        <Img src={staticFile(presenter.photo)} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'saturate(0.95) contrast(1.04)' }} />
      </div>
      {caption ? <div style={{ fontFamily: FONT_MONO, fontSize: 16, letterSpacing: '0.06em', color: theme.muted, textTransform: 'uppercase' }}>{caption}</div> : null}
    </div>
  )
}

/** COVER — masthead + huge headline + dek, optional framed hero or presenter. */
export const CoverScene: React.FC<SceneProps & { presenter?: Presenter; recipient?: string }> = ({ scene, theme, masthead, presenter, recipient }) => {
  const { fontDisplay: FONT_DISPLAY, fontBody: FONT_BODY } = theme
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const titleP = settle(frame, 8, fps)
  const rcpP = settle(frame, 34, fps)
  const hasPortrait = !!presenter?.photo
  return (
    <AbsoluteFill style={{ boxSizing: 'border-box', border: `${theme.variant === 'time' ? 18 : theme.variant === 'editorial' ? 8 : 0}px solid ${theme.accent}`, background: theme.paper, padding: '64px 72px', display: 'flex', flexDirection: 'column' }}>
        {/* Masthead bar — brand name only. No fabricated tagline ("The Special
            Report" etc.); the real section label is the scene's own kicker in
            the headline block below, shown only when the scene provides one. */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `3px solid ${theme.ink}`, paddingBottom: 18 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 88, lineHeight: 0.9, color: theme.ink, letterSpacing: '-0.01em' }}>{masthead}</div>
        </div>
        {/* Headline block — portrait sits to the right when a presenter is shown. */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 56 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 24 }}>
            {scene.kicker ? <Kicker text={scene.kicker} theme={theme} /> : null}
            <div style={{ opacity: titleP, transform: `translateY(${(1 - titleP) * 18}px)`, fontFamily: FONT_DISPLAY, fontSize: hasPortrait ? 124 : 150, lineHeight: 0.94, color: theme.ink, letterSpacing: '-0.02em', maxWidth: 1500 }}>
              {scene.title}
            </div>
            {scene.dek ? (
              <div style={{ opacity: settle(frame, 26, fps), fontFamily: FONT_BODY, fontSize: 36, lineHeight: 1.35, color: theme.muted, maxWidth: 1200, fontStyle: 'italic' }}>{scene.dek}</div>
            ) : null}
            {/* "Prepared for {client}" — personalized cover line. */}
            {recipient ? (
              <div style={{ opacity: rcpP, marginTop: 8 }}>
                <span style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 15, letterSpacing: 3, textTransform: 'uppercase', color: theme.accent }}>Prepared for </span>
                <span style={{ fontFamily: FONT_DISPLAY, fontSize: 30, color: theme.ink }}>{recipient}</span>
              </div>
            ) : null}
          </div>
          {hasPortrait ? <Portrait presenter={presenter!} theme={theme} size={360} /> : null}
        </div>
    </AbsoluteFill>
  )
}

/** LEDE — narrative intro with a drop-cap first letter, optional side figure. */
export const LedeScene: React.FC<SceneProps> = (p) => {
  const { scene, theme } = p
  const { fontDisplay: FONT_DISPLAY, fontBody: FONT_BODY } = theme
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const body = scene.body || scene.dek || ''
  const first = body.slice(0, 1), rest = body.slice(1)
  const bodyP = settle(frame, 18, fps)
  return (
    <Frame {...p}>
      <div style={{ display: 'flex', gap: 56, height: '100%', padding: '56px 56px', alignItems: 'center' }}>
        <div style={{ flex: scene.image ? 1.3 : 1, maxWidth: scene.image ? undefined : 1300 }}>
          {scene.kicker ? <Kicker text={scene.kicker} theme={theme} /> : null}
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 84, lineHeight: 1.0, color: theme.ink, margin: '14px 0 8px', letterSpacing: '-0.015em' }}>{scene.title}</div>
          <Rule color={theme.accent} delay={12} width={180} />
          <div style={{ opacity: bodyP, fontFamily: FONT_BODY, fontSize: 32, lineHeight: 1.5, color: theme.ink, marginTop: 26, maxWidth: 1100 }}>
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 96, lineHeight: 0.7, float: 'left', color: theme.accent, paddingRight: 14, marginTop: 10 }}>{first}</span>
            {rest}
          </div>
        </div>
        {scene.image ? <Figure image={scene.image} caption={scene.kicker} theme={theme} style={{ flex: 1, height: '70%' }} /> : null}
      </div>
    </Frame>
  )
}

/** GRID — 4-6 parallel items in a clean editorial grid. */
export const GridScene: React.FC<SceneProps> = (p) => {
  const { scene, theme } = p
  const { fontDisplay: FONT_DISPLAY, fontBody: FONT_BODY, fontMono: FONT_MONO } = theme
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const items = (scene.items ?? []).slice(0, 6)
  const cols = items.length <= 4 ? 2 : 3
  return (
    <Frame {...p}>
      <div style={{ padding: '52px 56px', height: '100%', display: 'flex', flexDirection: 'column' }}>
        {scene.kicker ? <Kicker text={scene.kicker} theme={theme} /> : null}
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 76, lineHeight: 1.0, color: theme.ink, margin: '12px 0 8px' }}>{scene.title}</div>
        <Rule color={theme.accent} delay={10} width="100%" thickness={2} />
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '40px 56px', marginTop: 40, flex: 1, alignContent: 'start' }}>
          {items.map((it, i) => {
            const op = settle(frame, 16 + i * Math.round(0.1 * fps), fps)
            // Time = numbered TILE with an accent border-top (newsmagazine module).
            // Editorial = clean numbered item, no box.
            // Explainer = soft rounded panel with a rotating accent top border.
            const isTime = theme.variant === 'time'
            const isExplainer = theme.variant === 'explainer'
            const accent = theme.accents[i % theme.accents.length]
            const tileStyle: React.CSSProperties = isExplainer
              ? { background: theme.paperEdge, padding: 24, borderRadius: theme.radius, borderTop: `4px solid ${accent}` }
              : isTime
              ? { borderTop: `3px solid ${theme.accent}`, paddingTop: 16 }
              : {}
            return (
              <div key={i} style={{ opacity: op, transform: `translateY(${(1 - op) * 16}px)`, ...tileStyle }}>
                <div style={{ fontFamily: FONT_MONO, fontSize: 18, color: isExplainer ? accent : theme.accent, marginBottom: 8 }}>{String(i + 1).padStart(2, '0')}</div>
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: 34, lineHeight: 1.1, color: theme.ink, marginBottom: 6 }}>{it.title}</div>
                {it.detail ? <div style={{ fontFamily: FONT_BODY, fontSize: 22, lineHeight: 1.4, color: theme.muted }}>{it.detail}</div> : null}
              </div>
            )
          })}
        </div>
      </div>
    </Frame>
  )
}

/** PULLQUOTE — one isolated statement, oversized serif. */
export const PullQuoteScene: React.FC<SceneProps> = (p) => {
  const { scene, theme } = p
  const { fontDisplay: FONT_DISPLAY, fontKicker: FONT_KICKER } = theme
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const q = scene.quote || scene.title
  const qP = settle(frame, 8, fps)
  return (
    <Frame {...p}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 120px' }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 200, lineHeight: 0.6, color: theme.accent, height: 90 }}>“</div>
        <div style={{ opacity: qP, transform: `translateY(${(1 - qP) * 16}px)`, fontFamily: FONT_DISPLAY, fontSize: 72, lineHeight: 1.18, color: theme.ink, maxWidth: 1500, letterSpacing: '-0.01em' }}>
          {q}
        </div>
        {scene.attribution ? (
          <div style={{ opacity: settle(frame, 26, fps), fontFamily: FONT_KICKER, fontSize: 24, letterSpacing: '0.14em', color: theme.muted, textTransform: 'uppercase', marginTop: 36 }}>— {scene.attribution}</div>
        ) : null}
      </div>
    </Frame>
  )
}

/** STAT — "By the Numbers": 1-3 big serif figures with rules + labels. */
export const StatScene: React.FC<SceneProps> = (p) => {
  const { scene, theme } = p
  const { fontDisplay: FONT_DISPLAY, fontKicker: FONT_KICKER } = theme
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const isExplainer = theme.variant === 'explainer'
  const metrics = (scene.metrics ?? []).filter((m) => m.label && m.value).slice(0, 3)
  // Size the big numeral to the COLUMN COUNT and the LONGEST value so wide
  // values (e.g. "$176,204" or "40 — Preferred Non-Tobacco") never overflow
  // their cell and push the last card past the safe zone.
  const cols = Math.max(1, metrics.length)
  const longest = metrics.reduce((n, m) => Math.max(n, String(m.value).length), 0)
  // Base size by columns, then shrink as the longest value grows.
  const base = cols >= 3 ? 96 : cols === 2 ? 120 : 150
  const numFont = Math.max(40, Math.round(base - Math.max(0, longest - 6) * 5))
  return (
    <Frame {...p}>
      <div style={{ padding: '52px 56px', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflow: 'hidden' }}>
        {scene.kicker ? <Kicker text={scene.kicker} theme={theme} /> : null}
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 64, lineHeight: 1.05, color: theme.ink, margin: '12px 0 0' }}>{scene.title}</div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 40, flex: 1, alignContent: 'center' }}>
          {metrics.map((m, i) => {
            const start = 14 + i * Math.round(0.16 * fps)
            const op = settle(frame, start, fps)
            const countP = interpolate(frame, [start, start + Math.round(1.1 * fps)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
            const numColor = isExplainer ? theme.accents[i % theme.accents.length] : theme.accent
            const blockStyle: React.CSSProperties = isExplainer && theme.radius > 0
              ? { background: theme.paperEdge, padding: 28, borderRadius: theme.radius }
              : {}
            return (
              <div key={i} style={{ opacity: op, minWidth: 0, overflow: 'hidden', ...blockStyle }}>
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: numFont, lineHeight: 0.98, color: numColor, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                  {renderMetric(parseMetric(m.value), countP)}
                </div>
                <div style={{ height: 2, background: theme.ink, margin: '14px 0 12px', width: '60%' }} />
                <div style={{ fontFamily: FONT_KICKER, fontSize: 22, letterSpacing: '0.08em', color: theme.ink, textTransform: 'uppercase', overflowWrap: 'break-word' }}>{m.label}</div>
              </div>
            )
          })}
        </div>
      </div>
    </Frame>
  )
}

/** LIST — ordered principles / steps with big numerals. */
export const ListScene: React.FC<SceneProps> = (p) => {
  const { scene, theme } = p
  const { fontDisplay: FONT_DISPLAY, fontBody: FONT_BODY } = theme
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const isExplainer = theme.variant === 'explainer'
  const items = (scene.items ?? []).slice(0, 5)
  return (
    <Frame {...p}>
      <div style={{ padding: '52px 56px', height: '100%', display: 'flex', flexDirection: 'column' }}>
        {scene.kicker ? <Kicker text={scene.kicker} theme={theme} /> : null}
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 76, lineHeight: 1.0, color: theme.ink, margin: '12px 0 28px' }}>{scene.title}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22, flex: 1, justifyContent: 'center' }}>
          {items.map((it, i) => {
            const op = settle(frame, 16 + i * Math.round(0.12 * fps), fps)
            const stepColor = theme.accents[i % theme.accents.length]
            const rowStyle: React.CSSProperties = isExplainer
              ? { background: theme.paperEdge, borderRadius: theme.radius, padding: 22 }
              : { borderTop: i ? `1px solid ${theme.hairline}` : 'none', paddingTop: i ? 18 : 0 }
            return (
              <div key={i} style={{ opacity: op, transform: `translateX(${(1 - op) * -20}px)`, display: 'flex', gap: 28, alignItems: isExplainer ? 'center' : 'baseline', ...rowStyle }}>
                {isExplainer ? (
                  <div style={{ flexShrink: 0, width: 64, height: 64, borderRadius: '50%', background: stepColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT_DISPLAY, fontSize: 32, lineHeight: 1 }}>{i + 1}</div>
                ) : (
                  <div style={{ fontFamily: FONT_DISPLAY, fontSize: 56, color: theme.accent, lineHeight: 1, minWidth: 70 }}>{String(i + 1).padStart(2, '0')}</div>
                )}
                <div>
                  <div style={{ fontFamily: FONT_DISPLAY, fontSize: 38, lineHeight: 1.1, color: theme.ink }}>{it.title}</div>
                  {it.detail ? <div style={{ fontFamily: FONT_BODY, fontSize: 24, lineHeight: 1.4, color: theme.muted, marginTop: 4 }}>{it.detail}</div> : null}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Frame>
  )
}

/** DECISION — closing call to action + contact + optional presenter portrait. */
export const DecisionScene: React.FC<SceneProps & { contactLine?: string; presenter?: Presenter }> = (p) => {
  const { scene, theme, contactLine, presenter } = p
  const { fontDisplay: FONT_DISPLAY, fontKicker: FONT_KICKER, fontMono: FONT_MONO } = theme
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const titleP = settle(frame, 8, fps)
  const hasPortrait = !!presenter?.photo
  // Prefer the explicit contactLine; fall back to the scene's dek.
  const contact = contactLine || scene.dek
  return (
    <Frame {...p} showFolio>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 64, padding: '0 96px' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {scene.kicker ? <Kicker text={scene.kicker} theme={theme} /> : null}
          <div style={{ opacity: titleP, transform: `translateY(${(1 - titleP) * 16}px)`, fontFamily: FONT_DISPLAY, fontSize: hasPortrait ? 84 : 104, lineHeight: 1.0, color: theme.ink, margin: '14px 0 22px', maxWidth: 1500 }}>{scene.title}</div>
          <Rule color={theme.accent} delay={14} width={260} thickness={4} />
          {/* Presenter name/role line under the rule (the byline). */}
          {presenter?.name ? (
            <div style={{ opacity: settle(frame, 24, fps), fontFamily: FONT_KICKER, fontSize: 26, letterSpacing: '0.12em', color: theme.ink, textTransform: 'uppercase', marginTop: 24 }}>
              {[presenter.name, presenter.role].filter(Boolean).join(' · ')}
            </div>
          ) : null}
          {contact ? (
            <div style={{ opacity: settle(frame, 28, fps), fontFamily: FONT_MONO, fontSize: 30, letterSpacing: '0.06em', color: theme.ink, marginTop: presenter?.name ? 14 : 30 }}>{contact}</div>
          ) : null}
        </div>
        {hasPortrait ? <Portrait presenter={presenter!} theme={theme} size={320} /> : null}
      </div>
    </Frame>
  )
}

/** TIMELINE — a horizontal line of dated milestones (dots draw in left→right). */
export const TimelineScene: React.FC<SceneProps> = (p) => {
  const { scene, theme } = p
  const { fontDisplay: FONT_DISPLAY, fontBody: FONT_BODY } = theme
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const isExplainer = theme.variant === 'explainer'
  const steps = (scene.timeline ?? []).slice(0, 6)
  return (
    <Frame {...p}>
      <div style={{ padding: '52px 56px', height: '100%', display: 'flex', flexDirection: 'column' }}>
        {scene.kicker ? <Kicker text={scene.kicker} theme={theme} /> : null}
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 72, lineHeight: 1.0, color: theme.ink, margin: '12px 0 0' }}>{scene.title}</div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            {/* the connecting line (draws in) */}
            <div style={{ position: 'absolute', top: 9, left: 0, height: 3, width: `${settle(frame, 12, fps) * 100}%`, background: theme.hairline }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
              {steps.map((st, i) => {
                const op = settle(frame, 16 + i * Math.round(0.14 * fps), fps)
                const last = i === steps.length - 1
                const stepColor = isExplainer ? theme.accents[i % theme.accents.length] : theme.accent
                const blockStyle: React.CSSProperties = isExplainer && theme.radius > 0
                  ? { background: theme.paperEdge, borderRadius: theme.radius, padding: 18, marginTop: 4 }
                  : {}
                return (
                  <div key={i} style={{ opacity: op, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0 12px' }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: last ? theme.ink : stepColor, marginBottom: 18 }} />
                    <div style={{ ...blockStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', alignSelf: 'stretch' }}>
                      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 40, color: stepColor, lineHeight: 1 }}>{st.when}</div>
                      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 26, color: theme.ink, marginTop: 8, lineHeight: 1.1 }}>{st.title}</div>
                      {st.detail ? <div style={{ fontFamily: FONT_BODY, fontSize: 19, color: theme.muted, marginTop: 6, lineHeight: 1.35 }}>{st.detail}</div> : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </Frame>
  )
}

/** CHART — a donut (share of a whole) or bars (comparison) + legend. SVG, no image. */
export const ChartScene: React.FC<SceneProps> = (p) => {
  const { scene, theme } = p
  const { fontDisplay: FONT_DISPLAY, fontKicker: FONT_KICKER, fontBody: FONT_BODY } = theme
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const segs = (scene.chart?.segments ?? []).filter((s) => s.label && s.value > 0).slice(0, 5)
  const kind = scene.chart?.kind || (segs.length <= 4 ? 'donut' : 'bar')
  const total = segs.reduce((a, s) => a + s.value, 0) || 1
  const grow = settle(frame, 14, fps)
  const isExplainer = theme.variant === 'explainer'
  // Segment colors: explainer = the four-color accent set; magazine = accent, ink,
  // muted, then tinted hairline.
  const palette = isExplainer ? theme.accents : [theme.accent, theme.ink, theme.muted, theme.hairline, theme.paperEdge]
  return (
    <Frame {...p}>
      <div style={{ padding: '52px 56px', height: '100%', display: 'flex', flexDirection: 'column' }}>
        {scene.kicker ? <Kicker text={scene.kicker} theme={theme} /> : null}
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 72, lineHeight: 1.0, color: theme.ink, margin: '12px 0 0' }}>{scene.title}</div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 72 }}>
          {kind === 'donut' ? (
            <svg width={360} height={360} viewBox="0 0 36 36" style={{ flexShrink: 0, transform: 'rotate(-90deg)' }}>
              {(() => {
                let acc = 0
                return segs.map((s, i) => {
                  const frac = (s.value / total) * grow
                  // pathLength=100 makes the circumference exactly 100 units, so
                  // strokeDasharray works in percentages. Offset walks each
                  // segment around the ring (negative = clockwise from the start).
                  const dash = `${frac * 100} ${100 - frac * 100}`
                  const offset = -acc * 100
                  acc += frac
                  return (
                    <circle key={i} cx="18" cy="18" r="15.9155" fill="transparent"
                      pathLength={100}
                      stroke={palette[i % palette.length]} strokeWidth="5"
                      strokeDasharray={dash} strokeDashoffset={offset} />
                  )
                })
              })()}
            </svg>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 28, height: 320 }}>
              {segs.map((s, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                  <div style={{ fontFamily: FONT_DISPLAY, fontSize: 34, color: theme.accent, marginBottom: 8 }}>{s.value}</div>
                  <div style={{ width: '70%', height: `${(s.value / Math.max(...segs.map((x) => x.value))) * 100 * grow}%`, background: palette[i % palette.length], borderRadius: theme.radius > 0 ? theme.radius : 2 }} />
                  <div style={{ fontFamily: FONT_KICKER, fontSize: 18, letterSpacing: '0.08em', color: theme.ink, textTransform: 'uppercase', marginTop: 12, textAlign: 'center' }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}
          {kind === 'donut' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {segs.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, ...(isExplainer && theme.radius > 0 ? { background: theme.paperEdge, borderRadius: theme.radius, padding: '10px 16px' } : {}) }}>
                  <div style={{ width: 22, height: 22, background: palette[i % palette.length], borderRadius: 3, flexShrink: 0 }} />
                  <div style={{ fontFamily: FONT_BODY, fontSize: 26, color: theme.ink }}>{s.label}</div>
                  <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, color: theme.accent, marginLeft: 8 }}>{Math.round((s.value / total) * 100)}%</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </Frame>
  )
}

/** MATRIX — a decision table (rows × columns). The Time "what to automate" grid. */
export const MatrixScene: React.FC<SceneProps> = (p) => {
  const { scene, theme } = p
  const { fontDisplay: FONT_DISPLAY, fontKicker: FONT_KICKER, fontBody: FONT_BODY } = theme
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const isExplainer = theme.variant === 'explainer'
  const cols = scene.matrix?.columns ?? []
  const rows = (scene.matrix?.rows ?? []).slice(0, 6)
  return (
    <Frame {...p}>
      <div style={{ padding: '52px 56px', height: '100%', display: 'flex', flexDirection: 'column' }}>
        {scene.kicker ? <Kicker text={scene.kicker} theme={theme} /> : null}
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 64, lineHeight: 1.0, color: theme.ink, margin: '12px 0 24px' }}>{scene.title}</div>
        <div style={{ flex: 1 }}>
          {/* header row */}
          <div style={{ display: 'grid', gridTemplateColumns: `1.4fr repeat(${cols.length}, 1fr)`, gap: 0, borderBottom: `2px solid ${theme.ink}`, paddingBottom: 12 }}>
            <div />
            {cols.map((c, i) => (
              <div key={i} style={{ fontFamily: FONT_KICKER, fontSize: 22, letterSpacing: '0.1em', color: theme.accent, textTransform: 'uppercase', textAlign: 'center' }}>{c}</div>
            ))}
          </div>
          {rows.map((r, ri) => {
            const op = settle(frame, 16 + ri * Math.round(0.1 * fps), fps)
            return (
              <div key={ri} style={{ opacity: op, display: 'grid', gridTemplateColumns: `1.4fr repeat(${cols.length}, 1fr)`, gap: 0, alignItems: 'center', ...(isExplainer && theme.radius > 0 ? { background: ri % 2 ? theme.paperEdge : 'transparent', borderRadius: theme.radius, padding: '18px 16px', marginBottom: 6 } : { borderBottom: `1px solid ${theme.hairline}`, padding: '18px 0' }) }}>
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, color: theme.ink }}>{r.label}</div>
                {cols.map((_, ci) => {
                  const cell = r.cells?.[ci] || ''
                  const isCheck = /^(yes|✓|x|true|✔)$/i.test(cell.trim())
                  return (
                    <div key={ci} style={{ textAlign: 'center', fontFamily: FONT_BODY, fontSize: 26, color: isCheck ? theme.accent : theme.muted }}>
                      {isCheck ? '●' : (cell || '–')}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </Frame>
  )
}

/* ----- internal: wrap an archetype's content in the running frame ----- */
const Frame: React.FC<SceneProps & { children: React.ReactNode; showFolio?: boolean }> = ({ theme, masthead, runningTitle, page, showFolio = true, children }) => (
  <EditorialFrame theme={theme} masthead={masthead} runningTitle={runningTitle} page={page} showFolio={showFolio}>
    {children}
  </EditorialFrame>
)
