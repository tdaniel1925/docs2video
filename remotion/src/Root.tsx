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
import { EditorialVideo, editorialSchema, editorialTotal, EDITORIAL_DEFAULT, type EditorialProps } from './editorial/EditorialVideo'
import { resolveTheme } from './v3/styling'
import { v3Schema, type V3Props } from './v3/schema'
import { EXECUTIVE_LIGHT } from './tokens'
import { explainerSchema, type ExplainerProps } from './schema'
import { SAMPLE } from './sample-data'
import { FPS, AURORA } from './tokens'
import { MotionSample, MOTION_DEFAULT, MOTION_SAMPLE_FRAMES, type MotionSampleProps } from './motion/MotionSample'
import { KineticDemo, KINETIC_FRAMES } from './KineticDemo'
import { CommercialDemo, commercialMetadata, type CommercialProps } from './CommercialDemo'
import { KineticDoc, kineticDocMetadata, type KineticDocProps } from './KineticDoc'
import { AppCommercial, appMetadata, type AppProps } from './AppCommercial'
import { CinematicHeroShowcase, CINE_FRAMES } from './cinematic/CinematicHeroShowcase'
import { AnimatedExplainer, EXPLAINER_FRAMES } from './explainer/AnimatedExplainer'
import { AppCommercialV2, appV2Metadata } from './AppCommercialV2'
import { AppCommercialV3, appV3Metadata } from './AppCommercialV3'
import { AppCommercialV4, appV4Metadata } from './AppCommercialV4'
import { ValorCommercial, valorMetadata, type ValorProps } from './ValorCommercial'
import { ApexCommercial, apexMetadata, type ApexProps } from './ApexCommercial'
import { DirectedVideo, directedMetadata, type DirectedProps } from './DirectedVideo'
import { BeatHook, hookFrames, type HookProps } from './kinetic/BeatHook'
import { LookTest, LOOKTEST_FRAMES } from './looks/LookTest'
import { GlassCompare, GLASS_FRAMES } from './cinematic/GlassCompare'
import type { LookName } from './looks/Looks'

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
      id="AnimatedExplainer"
      component={AnimatedExplainer}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={EXPLAINER_FRAMES}
    />
    <Composition
      id="CinematicHeroShowcase"
      component={CinematicHeroShowcase}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={CINE_FRAMES}
    />
    <Composition id="GlassFigSubtle" component={GlassCompare} defaultProps={{ style: 'subtle' as const, mode: 'figure' as const }} fps={FPS} width={1920} height={1080} durationInFrames={GLASS_FRAMES} />
    <Composition id="GlassFigVivid" component={GlassCompare} defaultProps={{ style: 'vivid' as const, mode: 'figure' as const }} fps={FPS} width={1920} height={1080} durationInFrames={GLASS_FRAMES} />
    <Composition id="GlassChartSubtle" component={GlassCompare} defaultProps={{ style: 'subtle' as const, mode: 'chart' as const }} fps={FPS} width={1920} height={1080} durationInFrames={GLASS_FRAMES} />
    <Composition id="GlassChartVivid" component={GlassCompare} defaultProps={{ style: 'vivid' as const, mode: 'chart' as const }} fps={FPS} width={1920} height={1080} durationInFrames={GLASS_FRAMES} />
    <Composition
      id="LookTestLedger"
      component={LookTest}
      defaultProps={{ look: 'ledger' as LookName, value: 116371, label: 'Year 10 Illustrated Value' }}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={LOOKTEST_FRAMES}
    />
    <Composition
      id="LookTestBokeh"
      component={LookTest}
      defaultProps={{ look: 'bokeh' as LookName, value: 176204, label: 'Death Benefit' }}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={LOOKTEST_FRAMES}
    />
    <Composition
      id="HookPremium"
      component={BeatHook}
      defaultProps={{ intensity: 'premium', image: 'hook-img.png' } as HookProps}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={hookFrames('premium', true)}
    />
    <Composition
      id="HookHighEnergy"
      component={BeatHook}
      defaultProps={{ intensity: 'highenergy', image: 'hook-img.png' } as HookProps}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={hookFrames('highenergy', true)}
    />
    <Composition
      id="DirectedVideo"
      component={DirectedVideo}
      defaultProps={{ plan: { title: '', palette: { bg: '#0a1626', accent: '#cda234', accent2: '#2a4568', text: '#f4f6fb' }, scenes: [] }, starts: [], total: 300 } as DirectedProps}
      calculateMetadata={directedMetadata}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={300}
    />
    <Composition
      id="ApexCommercial"
      component={ApexCommercial}
      defaultProps={{ starts: [15, 130, 300, 440, 580, 720], total: 1000 } as ApexProps}
      calculateMetadata={apexMetadata}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={1000}
    />
    <Composition
      id="ValorCommercial"
      component={ValorCommercial}
      defaultProps={{ starts: [15, 130, 300, 440, 580, 720], total: 1000 } as ValorProps}
      calculateMetadata={valorMetadata}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={1000}
    />
    <Composition
      id="AppCommercialV4"
      component={AppCommercialV4}
      defaultProps={{ starts: [15, 130, 300, 440, 580, 720, 860], total: 1000 } as AppProps}
      calculateMetadata={appV4Metadata}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={1000}
    />
    <Composition
      id="AppCommercialV3"
      component={AppCommercialV3}
      defaultProps={{ starts: [15, 130, 300, 440, 580, 720, 860], total: 1000 } as AppProps}
      calculateMetadata={appV3Metadata}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={1000}
    />
    <Composition
      id="AppCommercialV2"
      component={AppCommercialV2}
      defaultProps={{ starts: [15, 130, 300, 440, 580, 720, 860], total: 1000 } as AppProps}
      calculateMetadata={appV2Metadata}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={1000}
    />
    <Composition
      id="AppCommercial"
      component={AppCommercial}
      defaultProps={{ starts: [15, 130, 300, 440, 580, 720, 860], total: 1000 } as AppProps}
      calculateMetadata={appMetadata}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={1000}
    />
    <Composition
      id="KineticDoc"
      component={KineticDoc}
      defaultProps={{ starts: [15, 130, 260, 380, 500, 620, 760, 880], total: 1000, scenes: [] } as KineticDocProps}
      calculateMetadata={kineticDocMetadata}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={1000}
    />
    <Composition
      id="CommercialDemo"
      component={CommercialDemo}
      defaultProps={{ starts: [18, 100, 200, 340, 470, 580], total: 1400 } as CommercialProps}
      calculateMetadata={commercialMetadata}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={1400}
    />
    <Composition
      id="KineticDemo"
      component={KineticDemo}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={KINETIC_FRAMES}
    />
    <Composition
      id="MotionSample"
      component={MotionSample}
      defaultProps={MOTION_DEFAULT as MotionSampleProps}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={MOTION_SAMPLE_FRAMES}
    />
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
        // Real render payloads are passed via --props (per-video props file) and
        // always carry per-scene audio — use them directly, NEVER the shared
        // infographic.json (concurrent renders clobbered it: video A rendered
        // video B's content). The staticFile fetch remains only for the legacy
        // generator/studio workflow, whose defaultProps have no audio.
        const passedInfo = props as InfographicProps
        if (Array.isArray(passedInfo?.scenes) && passedInfo.scenes.some((s: any) => s?.audio)) {
          return { props, durationInFrames: infoTotal(props), fps: FPS, width: 1920, height: 1080 }
        }
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
      id="EditorialVideo"
      component={EditorialVideo}
      schema={editorialSchema}
      defaultProps={EDITORIAL_DEFAULT as EditorialProps}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={120}
      calculateMetadata={async ({ props }) => {
        // If real scenes are passed via --props (theme preview marks them
        // __preview; the production render now passes --props=editorial.json
        // explicitly), use them directly. This is the reliable path — it never
        // depends on the staticFile fetch below, which can fail inside the
        // bundle and silently fall through to the placeholder defaultProps.
        const passed = props as EditorialProps
        if (passed && Array.isArray(passed.scenes) && passed.scenes.length > 0) {
          return { props, durationInFrames: editorialTotal(props), fps: FPS, width: 1920, height: 1080 }
        }
        // Fallback: read the editorial.json written to public/ (legacy path).
        try {
          const res = await fetch(staticFile('editorial.json'))
          if (res.ok) {
            const data = (await res.json()) as EditorialProps
            return { props: data, durationInFrames: editorialTotal(data), fps: FPS, width: 1920, height: 1080 }
          }
        } catch {}
        return { props, durationInFrames: editorialTotal(props), fps: FPS, width: 1920, height: 1080 }
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
        // Real render payloads are passed via --props (per-video props file) and
        // always carry per-scene audio — use them directly, NEVER the shared
        // v3.json, which concurrent renders clobbered (video A rendered video
        // B's content) and whose silent fetch-failure rendered the "Run the
        // generator first" placeholder as a completed video. The staticFile
        // fetch remains only for the legacy scripts/generate-v3.mjs workflow —
        // its defaultProps placeholder scene has no audio, so it never matches.
        const passedV3 = props as V3Props
        if (Array.isArray(passedV3?.scenes) && passedV3.scenes.some((s: any) => s?.audio)) {
          return { props, durationInFrames: v3Total(props), fps: FPS, width: 1920, height: 1080 }
        }
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
