import { AbsoluteFill, Series, Sequence, Audio, Img, staticFile, useCurrentFrame, interpolate, Easing, spring, useVideoConfig } from 'remotion'
import type { V3Props, V3Scene } from './schema'
import { FullScreenScene, type Placement } from './FullScreenScene'
import { SlidePanelScene } from './SlidePanelScene'
import { ClosingCard } from './ClosingCard'
import { LogoWatermark, type LogoSource } from '../components/infographic/BrandLogo'
import { ThemedBackground } from '../AuroraBackground'
import { FilmOverlay } from '../FilmOverlay'
import { DesignFrame } from './DesignFrame'
import { FONTS, type Theme } from '../tokens'

/**
 * ONE continuous background for the whole video (sits behind the Series, driven
 * by the global frame so it never resets at a cut). This is what makes every
 * scene read as the same world — the core of the "fluid, authored" look.
 *  - aurora           → code-rendered drifting mesh (theme accents), $0
 *  - editorial-cinema → a single shared image with a slow continuous Ken Burns
 */
const SharedBackdrop: React.FC<{ look: 'aurora' | 'editorial-cinema'; theme: Theme; backdrop?: string; totalFrames: number }> = ({ look, theme, backdrop, totalFrames }) => {
  const f = useCurrentFrame()
  if (look === 'editorial-cinema' && backdrop) {
    // One slow push across the ENTIRE video (continuous, not per-scene).
    const t = interpolate(f, [0, totalFrames], [0, 1], { extrapolateRight: 'clamp' })
    const scale = 1.04 + t * 0.10
    return (
      <AbsoluteFill style={{ backgroundColor: theme.ink, overflow: 'hidden' }}>
        <AbsoluteFill style={{ transform: `scale(${scale})` }}>
          <Img src={staticFile(backdrop)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </AbsoluteFill>
        {/* Darken so foreground text/cards stay readable over any scene. */}
        <AbsoluteFill style={{ background: 'rgba(5,7,12,0.55)' }} />
        <FilmOverlay accent={theme.accents[0]} grain={0.06} />
      </AbsoluteFill>
    )
  }
  // Aurora ($0): drifting brand-colored mesh + subtle grain, continuous.
  return (
    <AbsoluteFill>
      <ThemedBackground theme={theme} />
      <FilmOverlay accent={theme.accents[0]} grain={0.05} />
    </AbsoluteFill>
  )
}

/** Auto-vary placement across scenes so the video never feels one-dimensional. */
const PLACEMENT_CYCLE: Placement[] = ['center', 'left', 'bottom', 'right', 'bottom', 'left', 'center', 'right', 'bottom', 'center']
const KEN: ('in' | 'left' | 'right')[] = ['in', 'right', 'in', 'left', 'in', 'right', 'in', 'left', 'in', 'in']

/** Per-scene in/out transition that VARIES by index so cuts feel EDITED, not a
 *  slideshow: cycles fade, push-up, whip-pan (with motion blur), zoom-blur, and
 *  flash-to-white. Punchier than a plain crossfade — gives the cut energy. */
const Transition: React.FC<{ d: number; variant: number; isLast?: boolean; children: React.ReactNode }> = ({ d, variant, isLast, children }) => {
  const f = useCurrentFrame()
  const IN = 14, OUT = 12
  const inP = interpolate(f, [0, IN], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  // The LAST scene HOLDS — no fade/slide out to black — so the closing card stays
  // fully visible at the end (and seeking to the end shows real content).
  const outP = isLast ? 0 : interpolate(f, [d - OUT, d], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.cubic) })
  const opacity = inP * (1 - outP)
  let transform = ''
  let filter = ''
  let flash = 0
  const v = variant % 5
  if (v === 1) transform = `translateY(${(1 - inP) * 48 + outP * -34}px)`        // push up
  else if (v === 2) { // whip-pan: fast slide + horizontal motion blur on the edges
    transform = `translateX(${(1 - inP) * 90 + outP * -90}px)`
    filter = `blur(${((1 - inP) + outP) * 7}px)`
  } else if (v === 3) { const s = 1.08 - inP * 0.08 + outP * 0.05; transform = `scale(${s})`; filter = `blur(${(1 - inP) * 12 + outP * 9}px)` } // zoom-blur
  else if (v === 4) { flash = Math.max(0, 1 - inP * 1.6) }                       // flash-to-white on entry
  // v===0 = pure fade
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity, transform, filter }}>{children}</AbsoluteFill>
      {flash > 0 ? <AbsoluteFill style={{ background: '#FFFFFF', opacity: flash * 0.85, pointerEvents: 'none' }} /> : null}
    </AbsoluteFill>
  )
}

/** Branded cold-open: brand name (or first title) springs up on black with an
 *  accent rule, holds, then a quick fade to the first scene. ~2s of premium tone. */
// ~3.5s so the client can READ their name + the agent's name before it cuts
// (was 54 / ~1.8s — too fast for a personalized cover).
const COLD_OPEN_FRAMES = 105
const ColdOpen: React.FC<{ text: string; theme: Theme & { logo?: LogoSource }; photo?: string; role?: string; recipient?: string }> = ({ text, theme, photo, role, recipient }) => {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  const rise = spring({ frame: f - 4, fps, config: { damping: 16, stiffness: 110, mass: 0.9 } })
  const rule = interpolate(f, [10, 24], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  const rcp = spring({ frame: f - 26, fps, config: { damping: 18, stiffness: 90 } })
  const out = interpolate(f, [COLD_OPEN_FRAMES - 10, COLD_OPEN_FRAMES], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const accent = theme.accents[1] ?? theme.accents[0]
  return (
    <AbsoluteFill style={{ background: '#05070C', alignItems: 'center', justifyContent: 'center', opacity: out }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, opacity: Math.min(1, rise * 1.4), transform: `translateY(${(1 - rise) * 28}px)` }}>
        {/* Presenter portrait on the cover (Person profile, cover placement). */}
        {photo ? (
          <Img src={staticFile(photo)} style={{ width: 150, height: 150, borderRadius: '50%', objectFit: 'cover', border: `5px solid #FFFFFF`, outline: `2px solid ${accent}`, boxShadow: `0 0 30px ${accent}77`, marginBottom: 6 }} />
        ) : null}
        <div style={{ fontFamily: FONTS.display, fontWeight: 900, fontSize: 96, color: '#FFFFFF', letterSpacing: '-0.02em', textAlign: 'center', maxWidth: 1400, lineHeight: 1 }}>
          {text}
        </div>
        {photo && role ? (
          <div style={{ fontFamily: FONTS.display, fontWeight: 700, letterSpacing: 3, fontSize: 26, color: accent, textTransform: 'uppercase' }}>{role}</div>
        ) : null}
        <div style={{ height: 4, width: 220 * rule, borderRadius: 2, background: accent, boxShadow: `0 0 18px ${accent}` }} />
        {/* "Prepared for {client}" — the personalized cover line. */}
        {recipient ? (
          <div style={{ marginTop: 10, textAlign: 'center', opacity: rcp }}>
            <div style={{ fontFamily: FONTS.display, fontWeight: 700, letterSpacing: 4, fontSize: 17, color: accent, textTransform: 'uppercase' }}>Prepared for</div>
            <div style={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: 34, color: '#FFFFFF', marginTop: 6 }}>{recipient}</div>
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  )
}

export const V3Video: React.FC<V3Props & { logoChip?: boolean }> = ({ theme, scenes, music, logo, logoChip, brandName, presenter, presenterOnCover, presenterOnClosing, look, backdrop, frame, recipient }) => {
  const total = scenes.reduce((s, sc) => s + sc.durationInFrames, 0) + COLD_OPEN_FRAMES
  const openText = brandName || presenter?.name || scenes[0]?.title || ''
  // Fluid looks share ONE continuous backdrop; scenes render transparent on top.
  const fluid = look === 'aurora' || look === 'editorial-cinema'
  // Persistent chrome over every real scene (not the branded cold-open). Defaults
  // the eyebrow to the brand so even videos that pass no `frame` get the cohesive
  // top-left brand mark + edge glow that makes the reference graphics feel authored.
  const frameConfig = { brandName, ...(frame || {}) }
  const hasFrame = !!(frameConfig.eyebrow || frameConfig.brandName || frameConfig.tag || (frameConfig.footer && frameConfig.footer.length))
  return (
    <AbsoluteFill style={{ backgroundColor: theme.ink }}>
      {fluid ? <SharedBackdrop look={look as 'aurora' | 'editorial-cinema'} theme={theme} backdrop={backdrop} totalFrames={total} /> : null}
      <Series>
        {openText ? (
          <Series.Sequence durationInFrames={COLD_OPEN_FRAMES}>
            <ColdOpen text={openText} theme={theme} photo={presenterOnCover ? presenter?.photo : undefined} role={presenter?.role} recipient={recipient} />
          </Series.Sequence>
        ) : null}
        {scenes.map((sc: V3Scene, i) => {
          let placement = sc.placement ?? PLACEMENT_CYCLE[i % PLACEMENT_CYCLE.length]
          // A lower-third lives bottom-left, so keep the title OUT of the bottom
          // zone on metric scenes (otherwise they collide).
          if (sc.metric && (placement === 'bottom' || placement === 'left')) placement = 'top'
          const kenBurns = sc.kenBurns ?? KEN[i % KEN.length]
          // Scenes WITH bullets use the PowerPoint-style glass-panel layout;
          // a scene with a `closing` payload renders the branded contact card;
          // statement/hook scenes (no bullets) stay full-bleed cinematic.
          const hasBullets = Array.isArray(sc.bullets) && sc.bullets.length > 0
          // In fluid looks the shared backdrop IS the imagery — never render a
          // per-scene image (that's the Frankenstein source). In fluid mode also
          // soften the cuts to pure cross-dissolves (variant 0) so the one
          // continuous backdrop reads as truly uninterrupted.
          const sceneImage = fluid ? undefined : sc.image
          const transitionVariant = fluid ? 0 : i
          return (
            <Series.Sequence key={i} durationInFrames={sc.durationInFrames}>
              <Transition d={sc.durationInFrames} variant={transitionVariant} isLast={i === scenes.length - 1}>
                {sc.closing ? (
                  <ClosingCard
                    image={sceneImage}
                    theme={theme}
                    brandName={brandName || presenter?.name}
                    logo={logo as LogoSource}
                    headline={sc.closing.headline || sc.title}
                    cta={sc.closing.cta || sc.body}
                    value={sc.closing.value}
                    contact={sc.closing.contact}
                    presenter={presenterOnClosing ? presenter : undefined}
                    durationInFrames={sc.durationInFrames}
                    transparentBg={fluid}
                  />
                ) : hasBullets ? (
                  <SlidePanelScene
                    image={sceneImage}
                    eyebrow={sc.eyebrow}
                    title={sc.title}
                    bullets={sc.bullets!}
                    accentWordIndex={sc.accentWordIndex}
                    theme={theme}
                    durationInFrames={sc.durationInFrames}
                    transparentBg={fluid}
                  />
                ) : (
                  <FullScreenScene
                    image={sceneImage}
                    placement={placement}
                    kenBurns={kenBurns}
                    eyebrow={sc.eyebrow}
                    title={sc.title}
                    body={sc.body}
                    accentWordIndex={sc.accentWordIndex}
                    theme={theme}
                    durationInFrames={sc.durationInFrames}
                    metric={sc.metric}
                    metrics={sc.metrics}
                    heroMetric={sc.heroMetric}
                    transparentBg={fluid}
                  />
                )}
              </Transition>
              {sc.audio ? <Audio src={staticFile(sc.audio)} /> : null}
            </Series.Sequence>
          )
        })}
      </Series>

      {/* Persistent design frame — overlays every scene AFTER the cold-open so the
          branded title card stays clean. zIndex:10 keeps the chrome above content. */}
      {hasFrame ? (
        <Sequence from={COLD_OPEN_FRAMES}>
          <DesignFrame theme={theme} config={frameConfig} />
        </Sequence>
      ) : null}

      {music ? (
        <Audio src={staticFile(music)} volume={(f) => interpolate(f, [0, 30, total - 45, total], [0, 0.04, 0.04, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />
      ) : null}
      {logo ? <LogoWatermark logo={logo as LogoSource} theme={theme} chip={logoChip} corner="bottom-right" height={96} opacity={0.92} /> : null}
    </AbsoluteFill>
  )
}

export function v3Total(props: V3Props): number {
  const hasOpen = !!(props.brandName || props.scenes[0]?.title)
  return props.scenes.reduce((s, sc) => s + sc.durationInFrames, 0) + (hasOpen ? COLD_OPEN_FRAMES : 0)
}
