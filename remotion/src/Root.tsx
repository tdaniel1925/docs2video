import { Composition, staticFile } from 'remotion'
 import { PlateSlide, PLATE_FRAMES, PLATE_FPS } from './PlateSlide'
import { IllusDeck, ILLUS_FRAMES, ILLUS_FPS } from './IllusDeck'
import { SteampunkDeck, STEAM_FRAMES, STEAM_FPS } from './SteampunkDeck'
import { TornPaperTest, TORN_FRAMES } from './TornPaperTest'
import { CommercialApexTorn, APEX_TORN_FRAMES } from './CommercialApexTorn'
import { CommercialApexPhonk, APEX_PHONK_FRAMES } from './CommercialApexPhonk'
import { ApexEditorial, APEX_EDITORIAL_FRAMES } from './ApexEditorial'
import { ApexKinetic, APEX_KINETIC_FRAMES } from './ApexKinetic'
import { ApexGrid, APEX_GRID_FRAMES } from './ApexGrid'
import { ApexVox, APEX_VOX_FRAMES } from './ApexVox'
import { ApexFlat, APEX_FLAT_FRAMES } from './ApexFlat'
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
import { HeroReveal, KineticHype, CinematicOpen, SplitCompare, StatGrid, CTAClose } from './CommercialProto'
import { CommercialFull, commercialDuration } from './CommercialFull'
import { CommercialAthletic, athleticDuration } from './CommercialAthletic'
// NOTE: ~18 experimental commercial/demo compositions (CommercialApex, Bloxify,
// Docs2Video{Cinematic,Comic,Kinetic}, DynamicsDemo, LivingStillDemo, etc.) were
// R&D and are intentionally NOT registered here — they stay local-only so the
// production VPS bundle carries only shipping compositions. The two spec-driven
// TEMPLATES below (the productionized result of that R&D) are what ships.
import { TemplateFintech, fintechSchema, fintechDuration, type FintechProps } from './templates/TemplateFintech'
import { TemplateCommercial, commercialSchema, commercialDuration as tcDuration, type CommercialProps as TCProps } from './templates/TemplateCommercial'
import { BeatHook, hookFrames, type HookProps } from './kinetic/BeatHook'
import { LookTest, LOOKTEST_FRAMES } from './looks/LookTest'
import { GlassCompare, GLASS_FRAMES } from './cinematic/GlassCompare'
import { CommercialD2VPulse, D2V_PULSE_FRAMES } from './CommercialD2VPulse'
import { CommercialJordyn, JORDYN_FRAMES } from './CommercialJordyn'
import { CommercialJordynPaper, JORDYN_PAPER_FRAMES } from './CommercialJordynPaper'
import { CommercialJordynFlat, JORDYN_FLAT_FRAMES } from './CommercialJordynFlat'
import { CommercialJordynLong, JORDYN_LONG_FRAMES } from './CommercialJordynLong'
import { CommercialVertical, type VertProps } from './CommercialVertical'
import { CommercialApexBrand, APEX_FRAMES } from './CommercialApexBrand'
import { CommercialApexTornPaper, APEX_TORN_FRAMES as APEX_TORNPAPER_FRAMES } from './CommercialApexTornPaper'
import { PaperChartDemo, PAPER_CHART_FRAMES } from './PaperChartDemo'
import { CompPlanOverview, COMP1_FRAMES } from './CompPlanOverview'
import { CompPlanDetail, COMPD_FRAMES } from './CompPlanDetail'
import { CompVideo2Tech, COMP2_FRAMES } from './CompVideo2Tech'
import { CompVideo3Insurance, COMP3_FRAMES } from './CompVideo3Insurance'
import { CompVideo4Team, COMP4_FRAMES } from './CompVideo4Team'
import { RoadmapEp1, ROAD1_FRAMES } from './RoadmapEp1'
import { RoadmapEp2, ROAD2_FRAMES } from './RoadmapEp2'
import { RoadmapEp3, ROAD3_FRAMES } from './RoadmapEp3'
import { RoadmapEp4, ROAD4_FRAMES } from './RoadmapEp4'
import { RoadmapEp5, ROAD5_FRAMES } from './RoadmapEp5'
import { RoadmapEp6, ROAD6_FRAMES } from './RoadmapEp6'
import { RoadmapEp7, ROAD7_FRAMES } from './RoadmapEp7'
import { RoadmapEp8, ROAD8_FRAMES } from './RoadmapEp8'
import { RoadmapEp9, ROAD9_FRAMES } from './RoadmapEp9'
import { RoadmapEp10, ROAD10_FRAMES } from './RoadmapEp10'
import { RoadmapEp11, ROAD11_FRAMES } from './RoadmapEp11'
import { RoadmapEp12, ROAD12_FRAMES } from './RoadmapEp12'
import { RoadmapEp13, ROAD13_FRAMES } from './RoadmapEp13'
import { RoadmapEp14, ROAD14_FRAMES } from './RoadmapEp14'
import { RoadmapEp15, ROAD15_FRAMES } from './RoadmapEp15'
import { RoadmapEp16, ROAD16_FRAMES } from './RoadmapEp16'
import { TechComp, TECHCOMP_FRAMES } from './TechComp'
import { Power53, POWER53_FRAMES } from './Power53'
import { PosterHype, POSTER_FRAMES } from './PosterHype'
import { Cinematic, CINE_FRAMES } from './Cinematic'
import { Cinematic2, CINE2_FRAMES } from './Cinematic2'
import { CinematicPexels, PEXELS_FRAMES } from './CinematicPexels'
import { RealtyGlobal, REALTY_FRAMES } from './RealtyGlobal'
import { GlossySlides, GLOSSY_FRAMES } from './GlossySlides'
import { JordynReal, JORDYN2_FRAMES } from './JordynReal'
import { InfographicSample, INFOG_FRAMES } from './InfographicSample'
import type { LookName } from './looks/Looks'

// compute a vertical video's total frames from its data.json (VO durations)
const vertMetadata = async ({ props }: { props: VertProps }) => {
  const FPS = 30, PAD = 0.8, XF = 0.4
  const INTRO = 3.0, END = 4.5, IXF = 0.5, EXF = 0.5
  let vo: number[] = new Array(10).fill(7)
  try {
    const res = await fetch(staticFile(`vert-${props.vert}/data.json`))
    if (res.ok) { const j = await res.json(); if (Array.isArray(j.vo)) vo = j.vo }
  } catch {}
  const segD = vo.map((d) => (d || 7) + PAD)
  const body = Math.round((segD.reduce((a, b) => a + b, 0) - 9 * XF) * FPS)
  const total = Math.round((INTRO - IXF) * FPS) + body + Math.round((END - EXF) * FPS)
  return { durationInFrames: total, fps: FPS, width: 1920, height: 1080 }
}

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

// demo props for the parameterized template (reuses existing SmartViewz assets to
// prove ANY brand plugs in via --props). The VPS/director will produce this JSON.
const FINTECH_DEMO: FintechProps = {
  brand: { bg: '#111111', bg2: '#1a1a1a', panel: '#1e1e1e', accent: '#ddb166', accentHi: '#f0d29a', cyan: '#22d3ee', green: '#22c55e', cream: '#f5f0e8', mute: '#9fa2ad', white: '#ffffff' },
  wordmark: { pre: 'Smart', post: 'Viewz' },
  logoLetter: 'S',
  assetDir: 'smartviewz',
  music: { file: 'music.mp3', frames: Math.round(41.98 * 30) },
  introFrames: 90,
  duck: { loud: 0.2, duck: 0.08 },
  beats: [
    { dur: 2.85, vo: 'sv-1', kind: 'shot', img: 'gen/chaos.png', pre: "Running your agency on ", hot: "yesterday's data." },
    { dur: 5.14, vo: 'sv-3', kind: 'meet', sub: 'The AI Intelligence Platform' },
    { dur: 7.0, vo: 'sv-5', kind: 'stats', kicker: 'Your agency, live', hot: 'Every metric, real time.', stats: [{ value: 2.8, prefix: '$', suffix: 'M', label: 'Premium', decimals: 1 }, { value: 387, label: 'Agents' }, { value: 1842, label: 'Policies' }] },
    { dur: 5.5, vo: 'sv-6', kind: 'chat', chat: { q: 'Which contracts expire this week?', a: '3 contracts expire this week — $1.2M at risk.' } },
    { dur: 5.4, vo: 'sv-9', kind: 'cta', cta: { headline: 'See everything. Miss nothing.', button: 'Start Free Trial', url: 'smartviewz.com' } },
  ],
}

// spec-driven engine demo (reuses smartviewz assets; styleId picks the look)
const TC_DEMO: TCProps = {
  styleId: 'fintech',
  brand: { bg: '#111111', bg2: '#1a1a1a', panel: '#1e1e1e', accent: '#ddb166', accentHi: '#f0d29a', accent2: '#22d3ee', cream: '#f5f0e8', mute: '#9fa2ad', white: '#ffffff' },
  wordmark: { pre: 'Smart', post: 'Viewz' }, logoLetter: 'S', assetDir: 'smartviewz',
  music: { file: 'music.mp3', frames: Math.round(41.98 * 30) }, introFrames: 90, duck: { loud: 0.2, duck: 0.08 }, bug: true,
  beats: [
    { dur: 2.85, vo: 'sv-1', kind: 'shot', img: 'gen/chaos.png', pre: 'Running your agency on ', hot: "yesterday's data." },
    { dur: 5.14, vo: 'sv-3', kind: 'meet', sub: 'The AI Intelligence Platform' },
    { dur: 7.0, vo: 'sv-5', kind: 'stats', kicker: 'Your agency, live', hot: 'Every metric, real time.', stats: [{ value: 2.8, prefix: '$', suffix: 'M', label: 'Premium', decimals: 1 }, { value: 387, label: 'Agents' }, { value: 1842, label: 'Policies' }] },
    { dur: 5.4, vo: 'sv-9', kind: 'cta', cta: { headline: 'See everything. Miss nothing.', button: 'Start Free Trial', url: 'smartviewz.com' } },
  ],
}

export const RemotionRoot: React.FC = () => {
  return (
    <>
    <Composition
      id="CommercialD2VPulse"
      component={CommercialD2VPulse}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={D2V_PULSE_FRAMES}
    />
    <Composition
      id="CommercialJordyn"
      component={CommercialJordyn}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={JORDYN_FRAMES}
    />
    <Composition
      id="CommercialJordynPaper"
      component={CommercialJordynPaper}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={JORDYN_PAPER_FRAMES}
    />
    <Composition
      id="CommercialJordynFlat"
      component={CommercialJordynFlat}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={JORDYN_FLAT_FRAMES}
    />
    <Composition
      id="CommercialJordynLong"
      component={CommercialJordynLong}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={JORDYN_LONG_FRAMES}
    />
    <Composition
      id="CommercialVertical"
      component={CommercialVertical}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={2700}
      defaultProps={{ vert: 'insurance' }}
      calculateMetadata={vertMetadata}
    />
    <Composition
      id="CommercialApexBrand"
      component={CommercialApexBrand}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={APEX_FRAMES}
    />
    <Composition
      id="CommercialApexTornPaper"
      component={CommercialApexTornPaper}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={APEX_TORNPAPER_FRAMES}
    />
    <Composition
      id="PaperChartDemo"
      component={PaperChartDemo}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={PAPER_CHART_FRAMES}
    />
    <Composition
      id="CompPlanOverview"
      component={CompPlanOverview}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={COMP1_FRAMES}
    />
    <Composition
      id="CompPlanDetail"
      component={CompPlanDetail}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={COMPD_FRAMES}
    />
    <Composition
      id="CompVideo2Tech"
      component={CompVideo2Tech}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={COMP2_FRAMES}
    />
    <Composition
      id="CompVideo3Insurance"
      component={CompVideo3Insurance}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={COMP3_FRAMES}
    />
    <Composition
      id="CompVideo4Team"
      component={CompVideo4Team}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={COMP4_FRAMES}
    />
    <Composition
      id="RoadmapEp1"
      component={RoadmapEp1}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={ROAD1_FRAMES}
    />
    <Composition
      id="RoadmapEp2"
      component={RoadmapEp2}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={ROAD2_FRAMES}
    />
    <Composition id="RoadmapEp3" component={RoadmapEp3} fps={FPS} width={1920} height={1080} durationInFrames={ROAD3_FRAMES} />
    <Composition id="RoadmapEp4" component={RoadmapEp4} fps={FPS} width={1920} height={1080} durationInFrames={ROAD4_FRAMES} />
    <Composition id="RoadmapEp5" component={RoadmapEp5} fps={FPS} width={1920} height={1080} durationInFrames={ROAD5_FRAMES} />
    <Composition id="RoadmapEp6" component={RoadmapEp6} fps={FPS} width={1920} height={1080} durationInFrames={ROAD6_FRAMES} />
    <Composition id="RoadmapEp7" component={RoadmapEp7} fps={FPS} width={1920} height={1080} durationInFrames={ROAD7_FRAMES} />
    <Composition id="RoadmapEp8" component={RoadmapEp8} fps={FPS} width={1920} height={1080} durationInFrames={ROAD8_FRAMES} />
    <Composition id="RoadmapEp9" component={RoadmapEp9} fps={FPS} width={1920} height={1080} durationInFrames={ROAD9_FRAMES} />
    <Composition id="RoadmapEp10" component={RoadmapEp10} fps={FPS} width={1920} height={1080} durationInFrames={ROAD10_FRAMES} />
    <Composition id="RoadmapEp11" component={RoadmapEp11} fps={FPS} width={1920} height={1080} durationInFrames={ROAD11_FRAMES} />
    <Composition id="RoadmapEp12" component={RoadmapEp12} fps={FPS} width={1920} height={1080} durationInFrames={ROAD12_FRAMES} />
    <Composition id="RoadmapEp13" component={RoadmapEp13} fps={FPS} width={1920} height={1080} durationInFrames={ROAD13_FRAMES} />
    <Composition id="RoadmapEp14" component={RoadmapEp14} fps={FPS} width={1920} height={1080} durationInFrames={ROAD14_FRAMES} />
    <Composition id="RoadmapEp15" component={RoadmapEp15} fps={FPS} width={1920} height={1080} durationInFrames={ROAD15_FRAMES} />
    <Composition id="RoadmapEp16" component={RoadmapEp16} fps={FPS} width={1920} height={1080} durationInFrames={ROAD16_FRAMES} />
    <Composition id="TechComp" component={TechComp} fps={FPS} width={1920} height={1080} durationInFrames={TECHCOMP_FRAMES} />
    <Composition id="Power53" component={Power53} fps={FPS} width={1920} height={1080} durationInFrames={POWER53_FRAMES} />
    <Composition id="PosterHype" component={PosterHype} fps={FPS} width={1920} height={1080} durationInFrames={POSTER_FRAMES} />
    <Composition id="Cinematic" component={Cinematic} fps={FPS} width={1920} height={1080} durationInFrames={CINE_FRAMES} />
    <Composition id="Cinematic2" component={Cinematic2} fps={FPS} width={1920} height={1080} durationInFrames={CINE2_FRAMES} />
    <Composition id="CinematicPexels" component={CinematicPexels} fps={FPS} width={1920} height={1080} durationInFrames={PEXELS_FRAMES} />
    <Composition id="RealtyGlobal" component={RealtyGlobal} fps={FPS} width={1920} height={1080} durationInFrames={REALTY_FRAMES} />
    <Composition id="GlossySlides" component={GlossySlides} fps={FPS} width={1920} height={1080} durationInFrames={GLOSSY_FRAMES} />
    <Composition id="JordynReal" component={JordynReal} fps={FPS} width={1920} height={1080} durationInFrames={JORDYN2_FRAMES} />
    <Composition id="InfographicSample" component={InfographicSample} fps={FPS} width={1920} height={1080} durationInFrames={INFOG_FRAMES} />
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
    {/* Commercial prototypes — cinematic direction pitches */}
    <Composition id="ProtoHeroReveal" component={HeroReveal} fps={FPS} width={1920} height={1080} durationInFrames={110} />
    <Composition id="ProtoKineticHype" component={KineticHype} fps={FPS} width={1920} height={1080} durationInFrames={90} />
    <Composition id="ProtoCinematicOpen" component={CinematicOpen} fps={FPS} width={1920} height={1080} durationInFrames={120} />
    <Composition id="ProtoSplitCompare" component={SplitCompare} fps={FPS} width={1920} height={1080} durationInFrames={100} />
    <Composition id="ProtoStatGrid" component={StatGrid} fps={FPS} width={1920} height={1080} durationInFrames={100} />
    <Composition id="ProtoCTAClose" component={CTAClose} fps={FPS} width={1920} height={1080} durationInFrames={110} />
    <Composition id="CommercialFull" component={CommercialFull} fps={FPS} width={1920} height={1080} durationInFrames={commercialDuration} />
    <Composition id="CommercialAthletic" component={CommercialAthletic} fps={FPS} width={1920} height={1080} durationInFrames={athleticDuration} />
    {/* (18 experimental commercial/demo compositions intentionally unregistered —
        see the import note above; they stay local-only, off the production bundle.) */}
    {/* PARAMETERIZED template — renders ANY brand from --props (VPS pipeline step 1) */}
    <Composition
      id="TemplateFintech"
      component={TemplateFintech}
      schema={fintechSchema}
      defaultProps={FINTECH_DEMO}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={fintechDuration(FINTECH_DEMO)}
      calculateMetadata={({ props }) => ({ durationInFrames: fintechDuration(props as FintechProps), fps: FPS, width: 1920, height: 1080 })}
    />
    {/* THE SPEC-DRIVEN ENGINE — one composition, all 10 styles, any brand from --props */}
    <Composition
      id="TemplateCommercial"
      component={TemplateCommercial}
      schema={commercialSchema}
      defaultProps={TC_DEMO}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={tcDuration(TC_DEMO)}
      calculateMetadata={({ props }) => ({ durationInFrames: tcDuration(props as TCProps), fps: FPS, width: 1920, height: 1080 })}
    />
    <Composition id="TornPaperTest" component={TornPaperTest} fps={FPS} width={1920} height={1080} durationInFrames={TORN_FRAMES} />
    <Composition id="CommercialApexTorn" component={CommercialApexTorn} fps={FPS} width={1920} height={1080} durationInFrames={APEX_TORN_FRAMES} />
    <Composition id="CommercialApexPhonk" component={CommercialApexPhonk} fps={FPS} width={1920} height={1080} durationInFrames={APEX_PHONK_FRAMES} />
    <Composition id="ApexEditorial" component={ApexEditorial} fps={30} width={1920} height={1080} durationInFrames={APEX_EDITORIAL_FRAMES} />
    <Composition id="ApexKinetic" component={ApexKinetic} fps={30} width={1920} height={1080} durationInFrames={APEX_KINETIC_FRAMES} />
    <Composition id="ApexGrid" component={ApexGrid} fps={30} width={1920} height={1080} durationInFrames={APEX_GRID_FRAMES} />
    <Composition id="ApexVox" component={ApexVox} fps={30} width={1920} height={1080} durationInFrames={APEX_VOX_FRAMES} />
    <Composition id="ApexFlat" component={ApexFlat} fps={30} width={1920} height={1080} durationInFrames={APEX_FLAT_FRAMES} />
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
    {/* Gemini plate + real animated Remotion text (hybrid proof). */}
    <Composition
      id="PlateSlide"
      component={PlateSlide}
      fps={PLATE_FPS}
      width={1920}
      height={1080}
      durationInFrames={PLATE_FRAMES}
    />
    {/* 6-page illustration deck: Gemini plates + live animated text + VO. */}
    <Composition
      id="IllusDeck"
      component={IllusDeck}
      fps={ILLUS_FPS}
      width={1920}
      height={1080}
      durationInFrames={ILLUS_FRAMES}
    />
    {/* Steampunk template via the app's own slide engine. */}
    <Composition
      id="SteampunkDeck"
      component={SteampunkDeck}
      fps={STEAM_FPS}
      width={1920}
      height={1080}
      durationInFrames={STEAM_FRAMES}
    />
    </>
  )
}
