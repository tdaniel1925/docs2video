import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion'
import { FONT_DISPLAY, FONT_KICKER, FONT_BODY, FONT_MONO, type EditorialTheme } from './theme'
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
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const p = settle(frame, delay, fps)
  return (
    <div style={{ opacity: p, transform: `translateY(${(1 - p) * 10}px)`, fontFamily: FONT_KICKER, fontWeight: 600, letterSpacing: '0.22em', fontSize: 26, color: theme.accent, textTransform: 'uppercase' }}>
      {text}
    </div>
  )
}

/** A framed editorial photo with a monospace caption — or a striped placeholder
 *  if no image (so the slide always looks finished). */
const Figure: React.FC<{ image?: string; caption?: string; theme: EditorialTheme; style?: React.CSSProperties }> = ({ image, caption, theme, style }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const p = settle(frame, 8, fps)
  return (
    <div style={{ opacity: p, display: 'flex', flexDirection: 'column', gap: 10, ...style }}>
      <div style={{ flex: 1, border: `1px solid ${theme.ink}`, overflow: 'hidden', position: 'relative', background: theme.paperEdge }}>
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
}> = ({ theme, masthead, runningTitle, page, frameWidth = 16, showFolio = true, children }) => {
  // The brand-color frame is a real `border` on ONE full-bleed box with
  // box-sizing:border-box — NOT nested AbsoluteFills with padding/inset, which
  // compounded badly and dropped the right + bottom edges (the "cut off" border).
  // A border on a single sized box renders symmetrically on all four sides.
  return (
    <AbsoluteFill style={{
      boxSizing: 'border-box', border: `${frameWidth}px solid ${theme.accent}`,
      background: theme.paper, display: 'flex', flexDirection: 'column',
    }}>
      {showFolio ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '26px 56px', borderBottom: `1px solid ${theme.hairline}`, fontFamily: FONT_MONO, fontSize: 17, letterSpacing: '0.12em', color: theme.muted, textTransform: 'uppercase' }}>
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
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const p = settle(frame, 10, fps)
  if (!presenter.photo) return null
  const caption = [presenter.name, presenter.role].filter(Boolean).join(' · ')
  return (
    <div style={{ opacity: p, transform: `translateY(${(1 - p) * 14}px)`, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
      <div style={{ width: size, height: size, border: `1px solid ${theme.ink}`, overflow: 'hidden', background: theme.paperEdge }}>
        <Img src={staticFile(presenter.photo)} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'saturate(0.95) contrast(1.04)' }} />
      </div>
      {caption ? <div style={{ fontFamily: FONT_MONO, fontSize: 16, letterSpacing: '0.06em', color: theme.muted, textTransform: 'uppercase' }}>{caption}</div> : null}
    </div>
  )
}

/** COVER — masthead + huge headline + dek, optional framed hero or presenter. */
export const CoverScene: React.FC<SceneProps & { presenter?: Presenter }> = ({ scene, theme, masthead, presenter }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const titleP = settle(frame, 8, fps)
  const hasPortrait = !!presenter?.photo
  return (
    <AbsoluteFill style={{ boxSizing: 'border-box', border: `18px solid ${theme.accent}`, background: theme.paper, padding: '64px 72px', display: 'flex', flexDirection: 'column' }}>
        {/* Masthead bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `3px solid ${theme.ink}`, paddingBottom: 18 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 88, lineHeight: 0.9, color: theme.ink, letterSpacing: '-0.01em' }}>{masthead}</div>
          <div style={{ fontFamily: FONT_KICKER, fontSize: 22, letterSpacing: '0.18em', color: theme.muted, textTransform: 'uppercase', paddingBottom: 8 }}>The Special Report</div>
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
          </div>
          {hasPortrait ? <Portrait presenter={presenter!} theme={theme} size={360} /> : null}
        </div>
    </AbsoluteFill>
  )
}

/** LEDE — narrative intro with a drop-cap first letter, optional side figure. */
export const LedeScene: React.FC<SceneProps> = (p) => {
  const { scene, theme } = p
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
            return (
              <div key={i} style={{ opacity: op, transform: `translateY(${(1 - op) * 16}px)` }}>
                <div style={{ fontFamily: FONT_MONO, fontSize: 18, color: theme.accent, marginBottom: 8 }}>{String(i + 1).padStart(2, '0')}</div>
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
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const metrics = (scene.metrics ?? []).filter((m) => m.label && m.value).slice(0, 3)
  return (
    <Frame {...p}>
      <div style={{ padding: '52px 56px', height: '100%', display: 'flex', flexDirection: 'column' }}>
        {scene.kicker ? <Kicker text={scene.kicker} theme={theme} /> : null}
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 72, lineHeight: 1.0, color: theme.ink, margin: '12px 0 0' }}>{scene.title}</div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${metrics.length}, 1fr)`, gap: 48, flex: 1, alignContent: 'center' }}>
          {metrics.map((m, i) => {
            const start = 14 + i * Math.round(0.16 * fps)
            const op = settle(frame, start, fps)
            const countP = interpolate(frame, [start, start + Math.round(1.1 * fps)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
            return (
              <div key={i} style={{ opacity: op }}>
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: 132, lineHeight: 0.95, color: theme.accent, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
                  {renderMetric(parseMetric(m.value), countP)}
                </div>
                <div style={{ height: 2, background: theme.ink, margin: '14px 0 12px', width: '60%' }} />
                <div style={{ fontFamily: FONT_KICKER, fontSize: 24, letterSpacing: '0.1em', color: theme.ink, textTransform: 'uppercase' }}>{m.label}</div>
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
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const items = (scene.items ?? []).slice(0, 5)
  return (
    <Frame {...p}>
      <div style={{ padding: '52px 56px', height: '100%', display: 'flex', flexDirection: 'column' }}>
        {scene.kicker ? <Kicker text={scene.kicker} theme={theme} /> : null}
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 76, lineHeight: 1.0, color: theme.ink, margin: '12px 0 28px' }}>{scene.title}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22, flex: 1, justifyContent: 'center' }}>
          {items.map((it, i) => {
            const op = settle(frame, 16 + i * Math.round(0.12 * fps), fps)
            return (
              <div key={i} style={{ opacity: op, transform: `translateX(${(1 - op) * -20}px)`, display: 'flex', gap: 28, alignItems: 'baseline', borderTop: i ? `1px solid ${theme.hairline}` : 'none', paddingTop: i ? 18 : 0 }}>
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: 56, color: theme.accent, lineHeight: 1, minWidth: 70 }}>{String(i + 1).padStart(2, '0')}</div>
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

/* ----- internal: wrap an archetype's content in the running frame ----- */
const Frame: React.FC<SceneProps & { children: React.ReactNode; showFolio?: boolean }> = ({ theme, masthead, runningTitle, page, showFolio = true, children }) => (
  <EditorialFrame theme={theme} masthead={masthead} runningTitle={runningTitle} page={page} showFolio={showFolio}>
    {children}
  </EditorialFrame>
)
