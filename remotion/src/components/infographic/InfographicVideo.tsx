import { AbsoluteFill, Series, Audio } from 'remotion'
import { staticFile, setAssetBase } from '../../lib/asset'
import { z } from 'zod'
import { type Theme, MODERN_FINTECH } from '../../tokens'
import { themeSchema } from '../../schema'
import { InfographicScene } from './InfographicScene'
import type { SceneContent } from './layoutPicker'
import { LogoWatermark, LogoLockup, LogoFeature, LOCKUP_MAX_H, FEATURE_TEXT_MAX_H, type LogoSource } from './BrandLogo'
import type { Reserve } from './Stage'

/** Per-scene schema for the infographic pipeline output. */
const metricSchema = z.object({ label: z.string(), value: z.string(), highlight: z.boolean().optional(), icon: z.string().optional() })
const stepSchema = z.object({ label: z.string(), sub: z.string().optional(), icon: z.string().optional() })
const cardSchema = z.object({ title: z.string(), body: z.string().optional(), icon: z.string().optional() })

export const infoSceneSchema = z.object({
  eyebrow: z.string().optional(),
  title: z.string(),
  body: z.string().optional(),
  kind: z.enum(['hero', 'kpis', 'iconrow', 'timeline', 'cards', 'statement']).optional(),
  metrics: z.array(metricSchema).optional(),
  steps: z.array(stepSchema).optional(),
  cards: z.array(cardSchema).optional(),
  audio: z.string().optional(),
  durationInFrames: z.number(),
})

// A real uploaded logo: either one transparent PNG path, or light/dark variants
// produced by the Sharp upload pipeline (light reads on dark themes & vice-versa).
const logoSchema = z.union([
  z.string(),
  z.object({ light: z.string().optional(), dark: z.string().optional() }),
])

export const infographicSchema = z.object({
  assetBase: z.string().optional(),   // set by the Lambda render script; empty = local files
  theme: themeSchema,
  brandName: z.string().optional(),
  logo: logoSchema.optional(),
  /** Set true when a complex/multi-color logo should sit on a frosted chip. */
  logoChip: z.boolean().optional(),
  /** Optional ambient background image (public/ path) shown darkened behind every scene. */
  bgImage: z.string().optional(),
  scenes: z.array(infoSceneSchema).min(1),
})
export type InfographicProps = z.infer<typeof infographicSchema>

export function infoTotal(props: InfographicProps): number {
  return props.scenes.reduce((a, s) => a + s.durationInFrames, 0)
}

export const InfographicVideo: React.FC<InfographicProps> = ({ assetBase, theme, scenes, logo, logoChip, brandName, bgImage }) => {
  setAssetBase(assetBase)
  const t = theme as Theme
  const lastIndex = scenes.length - 1
  return (
    <AbsoluteFill style={{ backgroundColor: t.ink }}>
      <Series>
        {scenes.map((s, i) => {
          const isFirst = i === 0
          const isLast = i === lastIndex
          const hasBrand = !!(logo || brandName)
          // Keep the scene's content clear of the brand overlays drawn on top of it.
          const reserve: Reserve = {
            top: isFirst && hasBrand ? INTRO_CLEAR : logo && !isLast ? WATERMARK_CLEAR : 0,
            bottom: isLast && hasBrand ? OUTRO_CLEAR : 0,
          }
          return (
            <Series.Sequence key={i} durationInFrames={s.durationInFrames}>
              <InfographicScene scene={s as SceneContent} theme={t} bgImage={bgImage} reserve={reserve} />

              {/* Intro lockup over the opening scene; outro feature over closing. */}
              {isFirst && (logo || brandName) ? (
                <LogoOverlay position="intro">
                  <LogoLockup logo={logo as LogoSource} theme={t} brandName={brandName} />
                </LogoOverlay>
              ) : null}
              {isLast && (logo || brandName) ? (
                <LogoOverlay position="outro">
                  <LogoFeature logo={logo as LogoSource} theme={t} brandName={brandName} />
                </LogoOverlay>
              ) : null}

              {/* Persistent corner watermark on every NON-intro/outro scene
                  (the intro/outro already feature the logo prominently). */}
              {logo && !isFirst && !isLast ? (
                <LogoWatermark logo={logo as LogoSource} theme={t} chip={logoChip} corner="top-right" />
              ) : null}

              {s.audio ? <Audio src={staticFile(s.audio)} /> : null}
            </Series.Sequence>
          )
        })}
      </Series>
    </AbsoluteFill>
  )
}

// Where the brand overlays sit, and how much of the frame each scene must
// therefore keep clear (overlay + a gap). The lockup/feature heights are capped
// in BrandLogo, so these are the most they can ever take.
const INTRO_TOP = 140
const OUTRO_BOTTOM = 220
const INTRO_CLEAR = INTRO_TOP + LOCKUP_MAX_H + 25                                 // 350
const OUTRO_CLEAR = OUTRO_BOTTOM + 40 /* feature margin */ + Math.max(110, FEATURE_TEXT_MAX_H) + 30   // 420
const WATERMARK_CLEAR = 64 + 52 + 24 + 20                                         // corner logo + chip + gap

/** Positions the intro lockup (upper third) / outro feature (centered) over a scene. */
const LogoOverlay: React.FC<{ position: 'intro' | 'outro'; children: React.ReactNode }> = ({ position, children }) => (
  <AbsoluteFill style={{
    alignItems: 'center', zIndex: 6, pointerEvents: 'none',
    justifyContent: position === 'intro' ? 'flex-start' : 'flex-end',
    paddingTop: position === 'intro' ? INTRO_TOP : 0,
    paddingBottom: position === 'outro' ? OUTRO_BOTTOM : 0,
  }}>
    {children}
  </AbsoluteFill>
)

/** Demo fallback when no infographic.json exists yet. */
export const INFO_DEFAULT: InfographicProps = {
  theme: MODERN_FINTECH,
  scenes: [{ title: 'Run the infographic generator first', durationInFrames: 90 }],
}
