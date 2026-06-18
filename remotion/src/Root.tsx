import { Composition, staticFile } from 'remotion'
import { loadFont as loadArchivo } from '@remotion/google-fonts/Archivo'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import { AuroraExplainer, totalFrames } from './AuroraExplainer'
import { SceneShowcase, SHOWCASE_FRAMES, SHOWCASE_THEME } from './SceneShowcase'
import { CinematicShowcase, CINEMATIC_FRAMES, CINEMATIC_THEME } from './CinematicShowcase'
import { ThemePreview } from './ThemePreview'
import { PremiumShowcase, PREMIUM_FRAMES, PREMIUM_THEME } from './PremiumShowcase'
import { V3Video, v3Total } from './v3/V3Video'
import { Storyboard87, SB87_FRAMES } from './v3/Storyboard87'
import { InfographicDemo, INFO_DEMO_FRAMES } from './components/infographic/InfographicDemo'
import { InfographicVideo, infographicSchema, infoTotal, INFO_DEFAULT, type InfographicProps } from './components/infographic/InfographicVideo'
import { resolveTheme } from './v3/styling'
import { v3Schema, type V3Props } from './v3/schema'
import { EXECUTIVE_LIGHT } from './tokens'
import { explainerSchema, type ExplainerProps } from './schema'
import { SAMPLE } from './sample-data'
import { FPS, AURORA } from './tokens'

loadArchivo()
loadInter()

// Same content + narration, re-skinned with the Aurora theme — proves the look
// is fully theme-driven (swap the theme prop, everything re-colors).
const SAMPLE_AURORA: ExplainerProps = { ...SAMPLE, theme: AURORA }

const withAssets = async (props: ExplainerProps): Promise<ExplainerProps> => {
  let merged: ExplainerProps = props
  try {
    const res = await fetch(staticFile('narration.json'))
    if (res.ok) {
      const n = await res.json()
      merged = { ...merged, narration: n.narration, sceneDurations: n.durations }
    }
  } catch {}
  // Background images, if generated, live as bg-<scene>.png in public/.
  const scenes = ['cover', 'pillars', 'stat', 'bullets', 'closing'] as const
  const backgrounds: Record<string, string> = {}
  for (const s of scenes) {
    try {
      const r = await fetch(staticFile(`bg-${s}.png`), { method: 'HEAD' })
      if (r.ok) backgrounds[s] = `bg-${s}.png`
    } catch {}
  }
  if (Object.keys(backgrounds).length > 0) merged = { ...merged, backgrounds }
  return merged
}

export const RemotionRoot: React.FC = () => {
  return (
    <>
    <Composition
      id="AuroraExplainer"
      component={AuroraExplainer}
      schema={explainerSchema}
      defaultProps={SAMPLE}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={totalFrames(SAMPLE)}
      calculateMetadata={async ({ props }) => {
        const merged = await withAssets(props)
        return { props: merged, durationInFrames: totalFrames(merged), fps: FPS, width: 1920, height: 1080 }
      }}
    />
    <Composition
      id="AuroraExplainerAlt"
      component={AuroraExplainer}
      schema={explainerSchema}
      defaultProps={SAMPLE_AURORA}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={totalFrames(SAMPLE_AURORA)}
      calculateMetadata={async ({ props }) => {
        const merged = await withAssets(props)
        return { props: merged, durationInFrames: totalFrames(merged), fps: FPS, width: 1920, height: 1080 }
      }}
    />
    <Composition
      id="SceneShowcase"
      component={SceneShowcase}
      defaultProps={{ theme: SHOWCASE_THEME }}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={SHOWCASE_FRAMES}
    />
    <Composition
      id="CinematicShowcase"
      component={CinematicShowcase}
      defaultProps={{ theme: CINEMATIC_THEME }}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={CINEMATIC_FRAMES}
    />
    <Composition
      id="ThemePreview"
      component={ThemePreview}
      defaultProps={{ themeIndex: 0 }}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={120}
    />
    <Composition
      id="PremiumShowcase"
      component={PremiumShowcase}
      defaultProps={{ theme: PREMIUM_THEME }}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={PREMIUM_FRAMES}
    />
    <Composition
      id="InfographicDemo"
      component={InfographicDemo}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={INFO_DEMO_FRAMES}
    />
    <Composition
      id="InfographicVideo"
      component={InfographicVideo}
      schema={infographicSchema}
      defaultProps={INFO_DEFAULT as InfographicProps}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={90}
      calculateMetadata={async ({ props }) => {
        // Load the generated infographic.json (scenes + structured metrics +
        // narration produced by the infographic generator from extracted data).
        try {
          const res = await fetch(staticFile('infographic.json'))
          if (res.ok) {
            const data = (await res.json()) as InfographicProps
            return { props: data, durationInFrames: infoTotal(data), fps: FPS, width: 1920, height: 1080 }
          }
        } catch {}
        return { props, durationInFrames: infoTotal(props), fps: FPS, width: 1920, height: 1080 }
      }}
    />
    <Composition
      id="V3Video"
      component={V3Video}
      schema={v3Schema}
      defaultProps={{ theme: EXECUTIVE_LIGHT, scenes: [{ title: 'Run the generator first', image: 'bg-cover.png', durationInFrames: 90 }] } as V3Props}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={90}
      calculateMetadata={async ({ props }) => {
        // Load the generated v3.json (script + images + narration produced by
        // scripts/generate-v3.mjs from a source topic).
        try {
          const res = await fetch(staticFile('v3.json'))
          if (res.ok) {
            const data = (await res.json()) as V3Props
            return { props: data, durationInFrames: v3Total(data), fps: FPS, width: 1920, height: 1080 }
          }
        } catch {}
        return { props, durationInFrames: v3Total(props), fps: FPS, width: 1920, height: 1080 }
      }}
    />
    <Composition
      id="Storyboard87"
      component={Storyboard87}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={SB87_FRAMES}
    />
    {/* Same content, AUTO-themed for an insurance doc (classifier default). */}
    <Composition
      id="Storyboard87Insurance"
      component={Storyboard87}
      defaultProps={{ theme: resolveTheme({ category: 'insurance' }) }}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={SB87_FRAMES}
    />
    {/* Same content, Premium structure + a sample BRAND's accents injected
        (deep red + gold) — proves brand-drives-accents. */}
    <Composition
      id="Storyboard87Branded"
      component={Storyboard87}
      defaultProps={{ theme: resolveTheme({ category: 'events', brand: { colors: ['#C8102E', '#D4AF37', '#F3E3C3'] } }) }}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={SB87_FRAMES}
    />
    </>
  )
}
