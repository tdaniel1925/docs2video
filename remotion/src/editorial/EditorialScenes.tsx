import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion'
import { staticFile } from '../lib/asset'
import { Fit, FitBox } from '../lib/fit'
import { type EditorialTheme } from './theme'
import { parseMetric, renderMetric } from '../components/infographic/format'
import type { EditorialScene } from './archetype'

/*
 * KEEPING WORDS ON THE PAGE. Every word here comes from a model reading the
 * customer's document, so any of it can be far longer than the layout expects.
 * Three rules keep it on the page (checked by `npm run qa:overflow -- editorial`):
 *
 *  1. A single run of text (masthead, kicker, headline, value, label, caption,
 *     contact line) is a <Fit>: it wraps, and past its line limit it shrinks.
 *     Its parent always has a bounded width (minWidth: 0 in flex rows).
 *  2. A group (grid tiles, list rows, timeline steps, chart, table) sits in a
 *     <FitBox> that fills the space left under the headline and scales the
 *     whole group down when it can't fit. The text INSIDE a FitBox is plain
 *     text, never a <Fit> — a Fit inside a FitBox resizes itself when the box
 *     re-scales, which the box's remembered scale doesn't know about.
 *  3. On one-column pages (cover, lede, pull quote, closing) the long body
 *     text is the one item allowed to give up height (flex-shrink + minHeight
 *     0), so its <Fit> shrinks into whatever room the fixed items leave.
 *
 * Page areas that use padding also use boxSizing: 'border-box' — without it a
 * 100%-tall page with padding was taller than the frame, so full pages ran off
 * the bottom of the video.
 */

/* ----------------------------- shared helpers ----------------------------- */

/**
 * For a <Fit> set in tight leading (line-height under ~1.3: headlines, big
 * numerals). The letters of these fonts are taller than a 0.9–1.18 line, so
 * they hang a little below the text's box, and <Fit> read that as "doesn't
 * fit" and shrank every headline to its floor. 0.3em of padding under the
 * text holds the overhang; the matching negative margin gives the space back,
 * so nothing on the page moves. Only use inside a flex column (a block parent
 * would merge the negative margin with the next element's margin).
 */
const hang = (marginBottom = 0): React.CSSProperties => ({ paddingBottom: '0.3em', marginBottom: `calc(${marginBottom}px - 0.3em)` })

function settle(frame: number, delay: number, fps: number) {
  return interpolate(frame, [delay, delay + Math.round(0.6 * fps)], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic),
  })
}

/** A thin rule that "draws" in from the left. */
const Rule: React.FC<{ color: string; delay: number; width?: number | string; thickness?: number }> = ({ color, delay, width = 220, thickness = 3 }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const p = settle(frame, delay, fps)
  return <div style={{ height: thickness, flexShrink: 0, width: typeof width === 'number' ? width * p : width, background: color, transformOrigin: 'left' }} />
}

const Kicker: React.FC<{ text: string; theme: EditorialTheme; delay?: number }> = ({ text, theme, delay = 2 }) => {
  const { fontKicker: FONT_KICKER } = theme
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const p = settle(frame, delay, fps)
  // Time = bold red kicker with wide tracking (newsmagazine). Editorial = quieter,
  // muted, tighter tracking (refined).
  const isTime = theme.variant === 'time'
  return (
    <div style={{ opacity: p, transform: `translateY(${(1 - p) * 10}px)`, flexShrink: 0, fontFamily: FONT_KICKER, fontWeight: isTime ? 700 : 600, color: isTime ? theme.accent : theme.muted, textTransform: 'uppercase' }}>
      {/* Tracking in em so it tightens with the type if a long kicker shrinks. */}
      <Fit max={isTime ? 26 : 22} min={16} lines={2} style={{ letterSpacing: isTime ? '0.28em' : '0.18em' }}>{text}</Fit>
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
    <div style={{ opacity: p, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0, ...style }}>
      <div style={{ flex: 1, minHeight: 0, border: `6px solid ${theme.paper}`, outline: `1.5px solid ${theme.ink}`, boxShadow: '0 6px 24px rgba(0,0,0,0.18)', overflow: 'hidden', position: 'relative', background: theme.paperEdge, borderRadius: r }}>
        {image ? (
          <Img src={staticFile(image)} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'saturate(0.92) contrast(1.05)' }} />
        ) : (
          <AbsoluteFill style={{ backgroundImage: `repeating-linear-gradient(45deg, ${theme.hairline} 0 2px, transparent 2px 14px)` }} />
        )}
      </div>
      {caption ? <Fit max={16} min={12} lines={2} style={{ flexShrink: 0, fontFamily: FONT_MONO, letterSpacing: '0.04em', color: theme.muted, textTransform: 'uppercase' }}>{caption}</Fit> : null}
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
  const folioText: React.CSSProperties = { letterSpacing: '0.12em' }
  return (
    <AbsoluteFill style={{
      boxSizing: 'border-box', border: `${fw}px solid ${theme.accent}`,
      background: theme.paper, display: 'flex', flexDirection: 'column',
    }}>
      {showFolio ? (
        // Brand and running title each get a capped share of the row and
        // shrink (one line) past it, so a long brand or document title can't
        // push the page number off the frame or run into each other.
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 32, flexShrink: 0, padding: '26px 56px', borderBottom: `${theme.variant === 'time' ? 2 : 1}px solid ${theme.variant === 'time' ? theme.ink : theme.hairline}`, fontFamily: FONT_MONO, fontSize: 17, color: theme.muted, textTransform: 'uppercase' }}>
          <div style={{ flex: '0 1 auto', minWidth: 0, maxWidth: '38%', fontWeight: 600, color: theme.ink }}>
            <Fit max={17} min={12} lines={1} style={folioText}>{masthead}</Fit>
          </div>
          <div style={{ flex: '0 1 auto', minWidth: 0, maxWidth: '50%', textAlign: 'center' }}>
            <Fit max={17} min={12} lines={1} style={folioText}>{runningTitle}</Fit>
          </div>
          <div style={{ flexShrink: 0, ...folioText }}>{String(page).padStart(2, '0')}</div>
        </div>
      ) : null}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>{children}</div>
    </AbsoluteFill>
  )
}

/* ------------------------------ archetypes -------------------------------- */

type SceneProps = { scene: EditorialScene; theme: EditorialTheme; masthead: string; runningTitle: string; page: number }
type Presenter = { name?: string; role?: string; photo?: string }

/** A content page's padded body: a column exactly the page's height. */
const pageColumn: React.CSSProperties = { padding: '52px 56px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }
/** The room left under a page's headline, for a <FitBox> group. */
const groupArea: React.CSSProperties = { flex: 1, minHeight: 0, minWidth: 0 }

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
    <div style={{ opacity: p, transform: `translateY(${(1 - p) * 14}px)`, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start', flexShrink: 0 }}>
      <div style={{ width: size, height: size, border: `6px solid ${theme.paper}`, outline: `1.5px solid ${theme.ink}`, boxShadow: '0 6px 24px rgba(0,0,0,0.18)', overflow: 'hidden', background: theme.paperEdge, borderRadius: r }}>
        <Img src={staticFile(presenter.photo)} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'saturate(0.95) contrast(1.04)' }} />
      </div>
      {/* The caption is held to the photo's width (+ its 6px border each side),
          so a long name/role wraps under the photo instead of widening it. */}
      {caption ? (
        <div style={{ width: size + 12 }}>
          <Fit max={16} min={12} lines={3} style={{ fontFamily: FONT_MONO, letterSpacing: '0.06em', color: theme.muted, textTransform: 'uppercase' }}>{caption}</Fit>
        </div>
      ) : null}
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
        {/* Masthead — brand name only. No fabricated tagline ("The Special
            Report" etc.); the real section label is the scene's own kicker in
            the headline block below, shown only when the scene provides one.
            The rule under it is its own line (not a border around the name). */}
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
          <Fit max={88} min={40} lines={1} style={{ ...hang(), fontFamily: FONT_DISPLAY, lineHeight: 0.9, color: theme.ink, letterSpacing: '-0.01em' }}>{masthead}</Fit>
          <div style={{ height: 3, background: theme.ink, marginTop: 18 }} />
        </div>
        {/* Headline block — portrait sits to the right when a presenter is shown. */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 56 }}>
          {/* Headline ≤ 3 lines, kicker ≤ 2, "Prepared for" ≤ 2; the dek takes
              what height is left and shrinks into it. */}
          <div style={{ flex: 1, minWidth: 0, alignSelf: 'stretch', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 24 }}>
            {scene.kicker ? <Kicker text={scene.kicker} theme={theme} /> : null}
            <Fit max={hasPortrait ? 124 : 150} min={56} lines={3} style={{ ...hang(), flexShrink: 0, opacity: titleP, transform: `translateY(${(1 - titleP) * 18}px)`, fontFamily: FONT_DISPLAY, lineHeight: 0.94, color: theme.ink, letterSpacing: '-0.02em', maxWidth: 1500 }}>
              {scene.title}
            </Fit>
            {scene.dek ? (
              <Fit max={36} min={18} style={{ flex: '0 1 auto', minHeight: 0, opacity: settle(frame, 26, fps), fontFamily: FONT_BODY, lineHeight: 1.35, color: theme.muted, maxWidth: 1200, fontStyle: 'italic' }}>{scene.dek}</Fit>
            ) : null}
            {/* "Prepared for {client}" — personalized cover line. Sized in em so
                the label and the name shrink together for a long client name. */}
            {recipient ? (
              <Fit max={30} min={16} lines={2} style={{ flexShrink: 0, opacity: rcpP, marginTop: 8, fontFamily: FONT_DISPLAY, color: theme.ink }}>
                <span style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: '0.5em', letterSpacing: '0.2em', textTransform: 'uppercase', color: theme.accent }}>Prepared for </span>
                {recipient}
              </Fit>
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
      <div style={{ display: 'flex', gap: 56, height: '100%', padding: '56px 56px', boxSizing: 'border-box', alignItems: 'center' }}>
        {/* Title ≤ 3 lines; the paragraph takes the height that's left. */}
        <div style={{ flex: scene.image ? 1.3 : 1, minWidth: 0, maxWidth: scene.image ? undefined : 1300, alignSelf: 'stretch', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {scene.kicker ? <Kicker text={scene.kicker} theme={theme} /> : null}
          <Fit max={84} min={40} lines={3} style={{ flexShrink: 0, fontFamily: FONT_DISPLAY, lineHeight: 1.0, color: theme.ink, marginTop: 14, ...hang(8), letterSpacing: '-0.015em' }}>{scene.title}</Fit>
          <Rule color={theme.accent} delay={12} width={180} />
          <Fit max={32} min={18} style={{ flex: '0 1 auto', minHeight: 0, opacity: bodyP, fontFamily: FONT_BODY, lineHeight: 1.5, color: theme.ink, marginTop: 26, maxWidth: 1100 }}>
            {/* Drop cap in em: 3× the paragraph, as before (96 at 32). */}
            <span data-overlap-ok="drop cap: its line box reaches into the next line; the letter doesn't" style={{ fontFamily: FONT_DISPLAY, fontSize: '3em', lineHeight: 0.7, float: 'left', color: theme.accent, paddingRight: 14, marginTop: 10 }}>{first}</span>
            {rest}
          </Fit>
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
      <div style={pageColumn}>
        {scene.kicker ? <Kicker text={scene.kicker} theme={theme} /> : null}
        <Fit max={76} min={36} lines={2} style={{ flexShrink: 0, fontFamily: FONT_DISPLAY, lineHeight: 1.0, color: theme.ink, marginTop: 12, ...hang(8) }}>{scene.title}</Fit>
        <Rule color={theme.accent} delay={10} width="100%" thickness={2} />
        <div style={{ ...groupArea, marginTop: 40 }}>
          <FitBox minScale={0.6}>
            {/* Plain 1fr columns: a long word widens its column (for every row)
                and, if the grid gets too wide, the FitBox scales it down. */}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '40px 56px', alignContent: 'start' }}>
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
          </FitBox>
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
      {/* Centered as before; the top/bottom padding only matters when a long
          quote fills the page, and the quote is what shrinks into the room. */}
      <div style={{ height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '52px 120px' }}>
        <div data-overlap-ok="decorative quote mark: its 200px line box reaches the quote; the glyph sits above it" style={{ flexShrink: 0, fontFamily: FONT_DISPLAY, fontSize: 200, lineHeight: 0.6, color: theme.accent, height: 90 }}>“</div>
        <Fit max={72} min={32} style={{ ...hang(), flex: '0 1 auto', minHeight: 0, opacity: qP, transform: `translateY(${(1 - qP) * 16}px)`, fontFamily: FONT_DISPLAY, lineHeight: 1.18, color: theme.ink, maxWidth: 1500, letterSpacing: '-0.01em' }}>
          {q}
        </Fit>
        {scene.attribution ? (
          <div style={{ flexShrink: 0, opacity: settle(frame, 26, fps), fontFamily: FONT_KICKER, color: theme.muted, textTransform: 'uppercase', marginTop: 36 }}>
            <Fit max={24} min={14} lines={2} style={{ letterSpacing: '0.14em' }}>— {scene.attribution}</Fit>
          </div>
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
  // The size the big numeral WOULD like to be: by column count, eased down as
  // the longest value grows (the look since launch). The <Fit> below is what
  // guarantees it: a value like "100% High Cap Rate Acct (S&P 500 Index)"
  // wraps inside its own column and shrinks until it fits — it can no longer
  // push its card off the frame (video 98389136: "40 — Preferred
  // Non-Tobacco" ran off the right edge). Because the Fit now does the
  // fitting, this estimate stops at 56 instead of 40: one long value no
  // longer drags every figure on the page down to body-text size.
  const cols = Math.max(1, metrics.length)
  const longest = metrics.reduce((n, m) => Math.max(n, String(m.value).length), 0)
  const base = cols >= 3 ? 96 : cols === 2 ? 120 : 150
  const numFont = Math.max(56, Math.round(base - Math.max(0, longest - 6) * 5))
  return (
    <Frame {...p}>
      <div style={pageColumn}>
        {scene.kicker ? <Kicker text={scene.kicker} theme={theme} /> : null}
        <Fit max={64} min={32} lines={2} style={{ flexShrink: 0, fontFamily: FONT_DISPLAY, lineHeight: 1.05, color: theme.ink, marginTop: 12, ...hang() }}>{scene.title}</Fit>
        {/* minmax(0, 1fr): columns stay equal and never grow to their longest word. */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 40, flex: 1, minHeight: 0, alignContent: 'center' }}>
          {metrics.map((m, i) => {
            const start = 14 + i * Math.round(0.16 * fps)
            const op = settle(frame, start, fps)
            const countP = interpolate(frame, [start, start + Math.round(1.1 * fps)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
            const numColor = isExplainer ? theme.accents[i % theme.accents.length] : theme.accent
            const blockStyle: React.CSSProperties = isExplainer && theme.radius > 0
              ? { background: theme.paperEdge, padding: 28, borderRadius: theme.radius }
              : {}
            const parsed = parseMetric(m.value)
            return (
              // A flex column so the numeral's hang() margin can't merge with the rule's.
              <div key={i} style={{ opacity: op, minWidth: 0, display: 'flex', flexDirection: 'column', ...blockStyle }}>
                {/* Sized against the FINAL value so the count-up doesn't jitter:
                    the final value sits invisibly in the flow (that's what the
                    Fit measures) and the counting number is drawn over it.
                    (Fit's own sizeFor ghost can't take the hang() padding.) */}
                <Fit max={numFont} min={36} lines={3} maxHeight={380} style={{ ...hang(), fontFamily: FONT_DISPLAY, lineHeight: 0.98, color: numColor, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
                  <span style={{ visibility: 'hidden' }}>{renderMetric(parsed, 1)}</span>
                  <span style={{ position: 'absolute', left: 0, top: 0, width: '100%' }}>{renderMetric(parsed, countP)}</span>
                </Fit>
                <div style={{ height: 2, background: theme.ink, margin: '14px 0 12px', width: '60%' }} />
                <Fit max={22} min={14} lines={3} style={{ fontFamily: FONT_KICKER, letterSpacing: '0.08em', color: theme.ink, textTransform: 'uppercase' }}>{m.label}</Fit>
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
      <div style={pageColumn}>
        {scene.kicker ? <Kicker text={scene.kicker} theme={theme} /> : null}
        <Fit max={76} min={36} lines={2} style={{ flexShrink: 0, fontFamily: FONT_DISPLAY, lineHeight: 1.0, color: theme.ink, marginTop: 12, ...hang(28) }}>{scene.title}</Fit>
        <div style={groupArea}>
          <FitBox minScale={0.6} valign="center">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
              {items.map((it, i) => {
                const op = settle(frame, 16 + i * Math.round(0.12 * fps), fps)
                const stepColor = theme.accents[i % theme.accents.length]
                const rowStyle: React.CSSProperties = isExplainer
                  ? { background: theme.paperEdge, borderRadius: theme.radius, padding: 22 }
                  : { borderTop: i ? `1px solid ${theme.hairline}` : 'none', paddingTop: i ? 18 : 0 }
                return (
                  <div key={i} style={{ opacity: op, transform: `translateX(${(1 - op) * -20}px)`, display: 'flex', gap: 28, alignItems: isExplainer ? 'center' : 'baseline', ...rowStyle }}>
                    {isExplainer ? (
                      // Numeral in the PAGE color: the circle is white on dark
                      // pages, so a white numeral vanished into it.
                      <div style={{ flexShrink: 0, width: 64, height: 64, borderRadius: '50%', background: stepColor, color: theme.paper, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT_DISPLAY, fontSize: 32, lineHeight: 1 }}>{i + 1}</div>
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
          </FitBox>
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
        {/* Title ≤ 3 lines, byline ≤ 2; the contact line wraps at its spaces and
            shrinks into the height that's left (a long email/URL can't push the
            portrait off the frame any more). */}
        <div style={{ flex: 1, minWidth: 0, alignSelf: 'stretch', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {scene.kicker ? <Kicker text={scene.kicker} theme={theme} /> : null}
          <Fit max={hasPortrait ? 84 : 104} min={44} lines={3} style={{ flexShrink: 0, opacity: titleP, transform: `translateY(${(1 - titleP) * 16}px)`, fontFamily: FONT_DISPLAY, lineHeight: 1.0, color: theme.ink, marginTop: 14, ...hang(22), maxWidth: 1500 }}>{scene.title}</Fit>
          <Rule color={theme.accent} delay={14} width={260} thickness={4} />
          {/* Presenter name/role line under the rule (the byline). */}
          {presenter?.name ? (
            <div style={{ flexShrink: 0, opacity: settle(frame, 24, fps), fontFamily: FONT_KICKER, color: theme.ink, textTransform: 'uppercase', marginTop: 24 }}>
              <Fit max={26} min={14} lines={2} style={{ letterSpacing: '0.12em' }}>{[presenter.name, presenter.role].filter(Boolean).join(' · ')}</Fit>
            </div>
          ) : null}
          {contact ? (
            <Fit max={30} min={14} style={{ flex: '0 1 auto', minHeight: 0, opacity: settle(frame, 28, fps), fontFamily: FONT_MONO, letterSpacing: '0.06em', color: theme.ink, marginTop: presenter?.name ? 14 : 30 }}>{contact}</Fit>
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
      <div style={pageColumn}>
        {scene.kicker ? <Kicker text={scene.kicker} theme={theme} /> : null}
        <Fit max={72} min={36} lines={2} style={{ flexShrink: 0, fontFamily: FONT_DISPLAY, lineHeight: 1.0, color: theme.ink, marginTop: 12, ...hang() }}>{scene.title}</Fit>
        <div style={groupArea}>
          <FitBox minScale={0.6} valign="center">
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
          </FitBox>
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
  const maxV = Math.max(...segs.map((x) => x.value), 1e-9)
  const grow = settle(frame, 14, fps)
  const isExplainer = theme.variant === 'explainer'
  // Segment colors: explainer = the four-color accent set; magazine = accent, ink,
  // muted, then tinted hairline.
  const palette = isExplainer ? theme.accents : [theme.accent, theme.ink, theme.muted, theme.hairline, theme.paperEdge]
  // Bars: tallest bar 320px, value above it. The value+bar cell has a FIXED
  // height so the FitBox's measured size doesn't change as the bars grow in.
  const BAR = 320
  return (
    <Frame {...p}>
      <div style={pageColumn}>
        {scene.kicker ? <Kicker text={scene.kicker} theme={theme} /> : null}
        <Fit max={72} min={36} lines={2} style={{ flexShrink: 0, fontFamily: FONT_DISPLAY, lineHeight: 1.0, color: theme.ink, marginTop: 12, ...hang() }}>{scene.title}</Fit>
        <div style={groupArea}>
          <FitBox minScale={0.6} valign="center">
            <div style={{ display: 'flex', alignItems: 'center', gap: 72 }}>
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
                // Values + bars on one row (bars share a baseline), labels on
                // the next; 1fr columns widen for a long word and the FitBox
                // scales the chart if the row gets too wide.
                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `repeat(${segs.length}, 1fr)`, columnGap: 28 }}>
                  {segs.map((s, i) => (
                    <div key={`b${i}`} style={{ gridRow: 1, gridColumn: i + 1, height: BAR + 60, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
                      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 34, color: theme.accent, marginBottom: 8 }}>{s.value}</div>
                      <div style={{ width: '70%', flexShrink: 0, height: (s.value / maxV) * BAR * grow, background: palette[i % palette.length], borderRadius: theme.radius > 0 ? theme.radius : 2 }} />
                    </div>
                  ))}
                  {segs.map((s, i) => (
                    <div key={`l${i}`} style={{ gridRow: 2, gridColumn: i + 1, fontFamily: FONT_KICKER, fontSize: 18, letterSpacing: '0.08em', color: theme.ink, textTransform: 'uppercase', marginTop: 12, textAlign: 'center' }}>{s.label}</div>
                  ))}
                </div>
              )}
              {kind === 'donut' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  {segs.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, ...(isExplainer && theme.radius > 0 ? { background: theme.paperEdge, borderRadius: theme.radius, padding: '10px 16px' } : {}) }}>
                      <div style={{ width: 22, height: 22, background: palette[i % palette.length], borderRadius: 3, flexShrink: 0 }} />
                      <div style={{ fontFamily: FONT_BODY, fontSize: 26, color: theme.ink }}>{s.label}</div>
                      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, color: theme.accent, marginLeft: 8, flexShrink: 0 }}>{Math.round((s.value / total) * 100)}%</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </FitBox>
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
  const boxed = isExplainer && theme.radius > 0
  const lastCol = cols.length
  // ONE grid for the header and every row, so a long word widens its column
  // for the whole table (columns stay lined up) and, if the table gets too
  // wide or tall, the FitBox scales it. Row looks are drawn per cell: a
  // hairline under each cell (magazine), or a rounded tinted band (explainer).
  const head: React.CSSProperties = { borderBottom: `2px solid ${theme.ink}`, paddingBottom: 12 }
  const cell = (ri: number, ci: number, op: number): React.CSSProperties => boxed
    ? {
      opacity: op, background: ri % 2 ? theme.paperEdge : 'transparent', padding: '18px 0', marginBottom: 6,
      ...(ci === 0 ? { paddingLeft: 16, borderTopLeftRadius: theme.radius, borderBottomLeftRadius: theme.radius } : {}),
      ...(ci === lastCol ? { paddingRight: 16, borderTopRightRadius: theme.radius, borderBottomRightRadius: theme.radius } : {}),
    }
    : { opacity: op, borderBottom: `1px solid ${theme.hairline}`, padding: '18px 0' }
  return (
    <Frame {...p}>
      <div style={pageColumn}>
        {scene.kicker ? <Kicker text={scene.kicker} theme={theme} /> : null}
        <Fit max={64} min={32} lines={2} style={{ flexShrink: 0, fontFamily: FONT_DISPLAY, lineHeight: 1.0, color: theme.ink, marginTop: 12, ...hang(24) }}>{scene.title}</Fit>
        <div style={groupArea}>
          <FitBox minScale={0.6}>
            <div style={{ display: 'grid', gridTemplateColumns: `1.4fr repeat(${cols.length}, 1fr)` }}>
              {/* header row */}
              <div style={head} />
              {cols.map((c, i) => (
                <div key={`h${i}`} style={{ ...head, fontFamily: FONT_KICKER, fontSize: 22, letterSpacing: '0.1em', color: theme.accent, textTransform: 'uppercase', textAlign: 'center' }}>{c}</div>
              ))}
              {rows.flatMap((r, ri) => {
                const op = settle(frame, 16 + ri * Math.round(0.1 * fps), fps)
                return [
                  <div key={`r${ri}`} style={{ ...cell(ri, 0, op), display: 'flex', alignItems: 'center', fontFamily: FONT_DISPLAY, fontSize: 28, color: theme.ink }}>{r.label}</div>,
                  ...cols.map((_, ci) => {
                    const v = r.cells?.[ci] || ''
                    const isCheck = /^(yes|✓|x|true|✔)$/i.test(v.trim())
                    return (
                      <div key={`r${ri}c${ci}`} style={{ ...cell(ri, ci + 1, op), display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontFamily: FONT_BODY, fontSize: 26, color: isCheck ? theme.accent : theme.muted }}>
                        {isCheck ? '●' : (v || '–')}
                      </div>
                    )
                  }),
                ]
              })}
            </div>
          </FitBox>
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
