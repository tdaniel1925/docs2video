// =============================================================================
// REMAKE THE LOOK SAMPLE PICTURES (public/style-samples/<look>-{cover,data,closing}.png)
//
// Why this exists: the old samples were frames from real customer-style jobs
// and showed real company, product and person names to every customer. These
// are drawn from the made-up story in sample-content.ts instead.
//
// How: the SAME code path as the free first-scene preview on step 3 —
// buildPreviewPlan (the app's real builders) → the render service's pure
// preview helpers (cut out of render-service/server.js, exactly as
// tests/preview-still-server.test.ts does) → the real Remotion compositions,
// rendered locally. So each picture truly shows that look.
//
// No paid AI pictures. Cinematic normally puts an AI photo behind each scene;
// here it uses the licence-free Pexels bokeh photos already in
// remotion/public (pexels-bg-1/2/3.jpg). Infographic normally adds an AI
// backdrop; here it shows its own code-drawn ground (same as the preview).
//
// Run from the repo root:  npx jiti scripts/look-samples/make-look-samples.ts
// Writes raw 1920x1080 frames to .shots/look-samples/raw, then the shrunk,
// compressed copies over public/style-samples (same names, same sizes).
// =============================================================================

import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import { buildPreviewPlan } from '../../app/_lib/first-scene-preview-server'
import type { Brand } from '../../app/_lib/types'
import { SAMPLE_BRAND, SAMPLE_CLIENT, SAMPLE_EXTRACTED, SAMPLE_SCENES } from './sample-content'

const ROOT = path.resolve(__dirname, '..', '..')
const REMOTION_DIR = path.join(ROOT, 'remotion')
const RAW_DIR = path.join(ROOT, '.shots', 'look-samples', 'raw')
const OUT_DIR = path.join(ROOT, 'public', 'style-samples')
const reqRemotion = createRequire(path.join(REMOTION_DIR, 'package.json'))
const reqRoot = createRequire(path.join(ROOT, 'package.json'))

// ── The render service's pure helpers (what ships, not a copy) ─────────────
const serverSrc = fs.readFileSync(path.join(ROOT, 'render-service/server.js'), 'utf8')
const cut = (from: string, to: string) => serverSrc.slice(serverSrc.indexOf(from), serverSrc.indexOf(to))
const pure = cut('// ==== PURE HELPERS (BEGIN) ====', '// ==== PURE HELPERS (END) ====')
// v3Theme (+ the contrast guard it calls) lives outside the pure block.
const themeSrc = cut('function guardAccentDark(', "app.post('/render-v3'")
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const H: any = new Function(`${pure}\n${themeSrc}\nreturn { previewDirectedJob, previewV3Job, previewEditorialJob, v3Theme, PREVIEW_SCENE_FRAMES, PREVIEW_SHOT_AT, PREVIEW_V3_LEAD_IN }`)()
const slides = reqRoot(path.join(ROOT, 'render-service/slides.js'))

// ── The made-up brand, as a Brand row ──────────────────────────────────────
const now = new Date().toISOString()
const brand: Brand = {
  id: 'sample', user_id: 'sample', name: SAMPLE_BRAND.name,
  logo_url: null, logo_file_url: null, logo_light_url: null, logo_dark_url: null, show_logo: false,
  primary_color: SAMPLE_BRAND.primary_color, secondary_color: SAMPLE_BRAND.secondary_color,
  accent_color: SAMPLE_BRAND.accent_color, background_color: SAMPLE_BRAND.background_color, text_color: SAMPLE_BRAND.text_color,
  tagline: null, description: null, industry: 'insurance', tone: null, target_audience: null,
  fonts: [], brand_values: [], services: [], social_links: {}, content_themes: [], competitor_notes: null,
  unique_selling_points: [], logo_kit: null, reference_slides: null, deck_style_id: null, is_default: true,
  brand_guide_data: { phone: SAMPLE_BRAND.phone, email: SAMPLE_BRAND.email, website: SAMPLE_BRAND.website },
  profile_type: 'company', photo_placement: 'none', created_at: now, updated_at: now,
}
const draft = { scenes: SAMPLE_SCENES, extractedData: SAMPLE_EXTRACTED, recipientName: SAMPLE_CLIENT, brandId: 'sample' }

type Job = { comp: string; props: Record<string, unknown>; frames: { cover: number; data: number; closing: number } }

/** Which looks, and how big their existing pictures are (kept the same). */
const LOOKS: { id: string; width: number }[] = [
  { id: 'slides', width: 1920 }, { id: 'aurora', width: 1920 }, { id: 'cinematic', width: 960 },
  { id: 'editorial', width: 960 }, { id: 'explainer', width: 1920 }, { id: 'infographic', width: 1920 },
]

function jobFor(look: string): Job {
  const plan = buildPreviewPlan({ output: 'video', look, draft, brand })
  if (!plan) throw new Error(`no preview plan for ${look}`)
  const at = H.PREVIEW_SHOT_AT as number
  const per = H.PREVIEW_SCENE_FRAMES as number
  if (plan.engine === 'directed') {
    const j = H.previewDirectedJob(plan.request, { planFromSuppliedScenes: slides.planFromSuppliedScenes, buildBrandPalette: slides.buildBrandPalette })
    const starts = j.props.starts as number[]
    return { comp: j.comp, props: j.props, frames: { cover: starts[0] + at, data: j.frame, closing: starts[starts.length - 1] + at } }
  }
  if (plan.engine === 'v3') {
    const j = H.previewV3Job(plan.request, { v3Theme: H.v3Theme })
    const scenes = j.props.scenes as { image?: string; durationInFrames: number }[]
    if (look === 'cinematic') {
      // Stand-in for the AI photo: licence-free stock already in remotion/public.
      scenes.forEach((s, i) => { s.image = `pexels-bg-${(i % 3) + 1}.jpg` })
    }
    const lead = j.frame - (plan.request as { sceneIndex: number }).sceneIndex * per - at
    const lastStart = lead + (scenes.length - 1) * per
    // The cover is the title card V3 plays before scene 1 (when there is one).
    return { comp: j.comp, props: j.props, frames: { cover: (plan.request as { sceneIndex: number }).sceneIndex > 0 ? lead + at : Math.max(1, Math.round(lead * 0.7)), data: j.frame, closing: lastStart + at } }
  }
  const j = H.previewEditorialJob(plan.request)
  const n = (j.props.scenes as unknown[]).length
  return { comp: j.comp, props: j.props, frames: { cover: at, data: j.frame, closing: (n - 1) * per + at } }
}

async function main() {
  fs.mkdirSync(RAW_DIR, { recursive: true })
  const only = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  const looks = only.length ? LOOKS.filter((l) => only.includes(l.id)) : LOOKS
  const jobs = looks.map((l) => ({ ...l, job: jobFor(l.id) }))
  fs.writeFileSync(path.join(RAW_DIR, 'jobs.json'), JSON.stringify(jobs, null, 2))

  if (process.argv.includes('--dry')) { console.log(JSON.stringify(jobs.map((j) => ({ id: j.id, comp: j.job.comp, frames: j.job.frames, n: (j.job.props as { scenes?: unknown[] }).scenes?.length })))); return }
  const { bundle } = reqRemotion('@remotion/bundler')
  const { selectComposition, renderStill } = reqRemotion('@remotion/renderer')
  console.log('Bundling remotion…')
  const serveUrl = await bundle({ entryPoint: path.join(REMOTION_DIR, 'src', 'index.ts'), publicDir: path.join(REMOTION_DIR, 'public') })
  const sharp = reqRoot('sharp')

  for (const { id, width, job } of jobs) {
    const composition = await selectComposition({ serveUrl, id: job.comp, inputProps: job.props })
    for (const kind of ['cover', 'data', 'closing'] as const) {
      const frame = Math.min(job.frames[kind], composition.durationInFrames - 1)
      const raw = path.join(RAW_DIR, `${id}-${kind}.png`)
      await renderStill({ composition, serveUrl, output: raw, frame, inputProps: job.props, imageFormat: 'png', chromiumOptions: { gl: 'swiftshader' } })
      // Same pixel size as the picture it replaces; palette PNG keeps it small.
      await sharp(raw).resize(width, Math.round((width * 9) / 16)).png({ palette: true, quality: 90, effort: 10, compressionLevel: 9 }).toFile(path.join(OUT_DIR, `${id}-${kind}.png`))
      console.log(`${id}-${kind}: ${job.comp} frame ${frame}`)
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
