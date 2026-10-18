// Live smoke test of the deployed Lambda site (costs about 1 cent per look).
// Renders a tiny made-up video per customer look ON LAMBDA, through the same
// lambda-render.mjs the video service uses, then cleans up.
//   npx jiti scripts/look-samples/lambda-smoke.ts           (slide deck + infographic + editorial)
// Needs REMOTION_* in .env.local. Run after every deploy-lambda-site.sh.
import fs from 'fs'; import path from 'path'; import { execFileSync } from 'child_process'; import { createRequire } from 'module'
import { buildPreviewPlan } from '../../app/_lib/first-scene-preview-server'
import { SAMPLE_BRAND, SAMPLE_CLIENT, SAMPLE_EXTRACTED, SAMPLE_SCENES } from './sample-content'
const ROOT = path.resolve(__dirname, '..', '..'); const RD = path.join(ROOT, 'remotion'); const PUB = path.join(RD, 'public'); const reqRoot = createRequire(path.join(ROOT, 'package.json'))
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/).filter((l) => /^REMOTION_/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] }))
const s = fs.readFileSync(path.join(ROOT, 'render-service/server.js'), 'utf8')
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const H: any = new Function(`${s.slice(s.indexOf('// ==== PURE HELPERS (BEGIN) ===='), s.indexOf('// ==== PURE HELPERS (END) ===='))}\nreturn { previewDirectedJob }`)()
const slides = reqRoot(path.join(ROOT, 'render-service/slides.js'))
const now = new Date().toISOString()
const brand = { id: 's', user_id: 's', name: SAMPLE_BRAND.name, primary_color: SAMPLE_BRAND.primary_color, secondary_color: SAMPLE_BRAND.secondary_color, accent_color: SAMPLE_BRAND.accent_color, background_color: SAMPLE_BRAND.background_color, text_color: SAMPLE_BRAND.text_color, show_logo: false, brand_guide_data: {}, profile_type: 'company', photo_placement: 'none', is_default: true, created_at: now, updated_at: now } as never
const made: string[] = []
const silent = (f: string, t: number) => { execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-t', String(t), f]); made.push(f) }
const OUT = path.join(ROOT, '.shots', 'lambda-smoke'); fs.mkdirSync(OUT, { recursive: true })
const tag = `zzsmoke${Date.now()}`
function render(comp: string, props: object) {
  const pf = path.join(PUB, `${tag}-${comp}-props.json`); fs.writeFileSync(pf, JSON.stringify(props)); made.push(pf)
  const out = path.join(OUT, `${comp}.mp4`)
  try {
    execFileSync('node', ['scripts/lambda-render.mjs', '--comp', comp, '--props', pf, '--out', out], { cwd: RD, env: { ...process.env, ...env }, stdio: 'pipe', maxBuffer: 1e8 })
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '1.5', '-i', out, '-frames:v', '1', out.replace(/\.mp4$/, '.png')])
    console.log(`OK   ${comp} → ${out}`); return true
  } catch (e) { console.log(`FAIL ${comp}: ${String((e as { stdout?: Buffer }).stdout || e).split('\n').filter((l) => /FAILED|Error/.test(l)).join(' ').slice(0, 400)}`); return false }
}
let ok = true
try {
  // Slide deck look, with a presenter photo — the 2026-10-08 crash case. The
  // voice/music names are FIXED (dir-vo-<id>.mp3), as in production.
  const plan = buildPreviewPlan({ output: 'video', look: 'slides', draft: { scenes: SAMPLE_SCENES, extractedData: SAMPLE_EXTRACTED, recipientName: SAMPLE_CLIENT, brandId: 's' }, brand })!
  const p = H.previewDirectedJob(plan.request, { planFromSuppliedScenes: slides.planFromSuppliedScenes, buildBrandPalette: slides.buildBrandPalette }).props.plan
  p.scenes = p.scenes.slice(0, 2); p.noSfx = true
  const photo = `${tag}-presenter.png`; fs.copyFileSync(path.join(PUB, 'pexels-bg-1.jpg'), path.join(PUB, photo)); made.push(path.join(PUB, photo))
  p.presenter = { name: 'Alex Rivera', role: 'Agent', photo, onCover: true, onClosing: true }
  const backup: [string, string][] = []
  for (const n of [...p.scenes.map((sc: { id: number }) => `dir-vo-${sc.id}.mp3`), 'dir-music.mp3']) { const f = path.join(PUB, n); if (fs.existsSync(f)) { fs.renameSync(f, f + '.smokebak'); backup.push([f + '.smokebak', f]) } }
  try { for (const sc of p.scenes) { delete sc.backdrop; silent(path.join(PUB, `dir-vo-${sc.id}.mp3`), 1.5) } silent(path.join(PUB, 'dir-music.mp3'), 2); ok = render('DirectedVideo', { plan: p }) && ok }
  finally { for (const f of made.splice(0)) fs.rmSync(f, { force: true }); for (const [a, b] of backup) fs.renameSync(a, b) }
  // Infographic + Editorial with their built-in sample props.
  ok = render('InfographicVideo', {}) && ok
  ok = render('EditorialVideo', {}) && ok
} finally { for (const f of made) fs.rmSync(f, { force: true }) }
process.exit(ok ? 0 : 1)
