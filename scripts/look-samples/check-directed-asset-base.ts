// Throwaway check: does DirectedVideo load per-video files (voice + presenter
// photo) from assetBase, the way Lambda serves them? Bundle with a public dir
// that does NOT hold them, serve them on localhost, render the cover frame.
import fs from 'fs'
import path from 'path'
import http from 'http'
import { execFileSync } from 'child_process'
import { createRequire } from 'module'
import { buildPreviewPlan } from '../../app/_lib/first-scene-preview-server'
import { SAMPLE_BRAND, SAMPLE_CLIENT, SAMPLE_EXTRACTED, SAMPLE_SCENES } from './sample-content'
const ROOT = path.resolve(__dirname, '..', '..'); const REMOTION_DIR = path.join(ROOT, 'remotion')
const reqRemotion = createRequire(path.join(REMOTION_DIR, 'package.json')); const reqRoot = createRequire(path.join(ROOT, 'package.json'))
const serverSrc = fs.readFileSync(path.join(ROOT, 'render-service/server.js'), 'utf8')
const cut = (a: string, b: string) => serverSrc.slice(serverSrc.indexOf(a), serverSrc.indexOf(b))
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const H: any = new Function(`${cut('// ==== PURE HELPERS (BEGIN) ====', '// ==== PURE HELPERS (END) ====')}\nreturn { previewDirectedJob }`)()
const slides = reqRoot(path.join(ROOT, 'render-service/slides.js'))
const TMP = process.env.TMPDIR_TEST as string
const ASSETS = path.join(TMP, 'assets'); const PUB = path.join(TMP, 'pub')
fs.mkdirSync(ASSETS, { recursive: true }); fs.mkdirSync(PUB, { recursive: true })
// bundled-only files (sfx/music/fonts) stay with the bundle, like the Lambda site
for (const d of ['sfx', 'fonts']) if (fs.existsSync(path.join(REMOTION_DIR, 'public', d))) fs.cpSync(path.join(REMOTION_DIR, 'public', d), path.join(PUB, d), { recursive: true })
const now = new Date().toISOString()
const brand = { id: 's', user_id: 's', name: SAMPLE_BRAND.name, primary_color: SAMPLE_BRAND.primary_color, secondary_color: SAMPLE_BRAND.secondary_color, accent_color: SAMPLE_BRAND.accent_color, background_color: SAMPLE_BRAND.background_color, text_color: SAMPLE_BRAND.text_color, show_logo: false, brand_guide_data: {}, profile_type: 'company', photo_placement: 'none', is_default: true, created_at: now, updated_at: now } as never
const plan = buildPreviewPlan({ output: 'video', look: 'slides', draft: { scenes: SAMPLE_SCENES, extractedData: SAMPLE_EXTRACTED, recipientName: SAMPLE_CLIENT, brandId: 's' }, brand })!
const j = H.previewDirectedJob(plan.request, { planFromSuppliedScenes: slides.planFromSuppliedScenes, buildBrandPalette: slides.buildBrandPalette })
const p = j.props.plan
p.presenter = { name: 'Alex Rivera', role: 'Agent', photo: 'brand-presenter.png', onCover: true, onClosing: true }
p.noSfx = true
for (const sc of p.scenes) { delete sc.backdrop; execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-t', '2', path.join(ASSETS, `dir-vo-${sc.id}.mp3`)]) }
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-t', '3', path.join(ASSETS, 'dir-music.mp3')])
fs.copyFileSync(path.join(REMOTION_DIR, 'public', 'pexels-bg-1.jpg'), path.join(ASSETS, 'brand-presenter.png'))
const srv = http.createServer((req, res) => { const f = path.join(ASSETS, decodeURIComponent((req.url || '').split('?')[0])); if (!fs.existsSync(f)) { res.writeHead(404); return res.end() } res.writeHead(200, { 'Access-Control-Allow-Origin': '*' }); fs.createReadStream(f).pipe(res) }).listen(8765)
const inputProps = { assetBase: 'http://localhost:8765', plan: p }
;(async () => {
  const { bundle } = reqRemotion('@remotion/bundler'); const { selectComposition, renderStill } = reqRemotion('@remotion/renderer')
  const serveUrl = await bundle({ entryPoint: path.join(REMOTION_DIR, 'src', 'index.ts'), publicDir: PUB })
  try {
    const composition = await selectComposition({ serveUrl, id: 'DirectedVideo', inputProps })
    console.log('duration', composition.durationInFrames, 'assetBase kept:', (composition.props as { assetBase?: string }).assetBase)
    const frame = (composition.props as { starts: number[] }).starts[0] + 40
    await renderStill({ composition, serveUrl, output: path.join(TMP, 'cover.png'), frame, inputProps, imageFormat: 'png', chromiumOptions: { gl: 'swiftshader' } })
    console.log('RENDER OK', path.join(TMP, 'cover.png'))
  } catch (e) { console.log('RENDER FAILED:', String((e as Error).message).slice(0, 300)) }
  srv.close(); process.exit(0)
})()
