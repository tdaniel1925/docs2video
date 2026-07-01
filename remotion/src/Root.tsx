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
