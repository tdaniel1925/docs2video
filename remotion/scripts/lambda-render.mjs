// Render a composition on Remotion Lambda — a drop-in for `npx remotion render`.
//
//   node scripts/lambda-render.mjs --comp V3Video --props /path/props.json --out /path/out.mp4
//
// What it does:
//   1. Finds every per-video file the props point at (paths under remotion/public,
//      plus the whole public/<assetDir> folder when props carry `assetDir`), uploads
//      them to the Remotion S3 bucket (public-read) and passes `assetBase` in the
//      props so compositions load them by URL (see src/lib/asset.ts).
//   2. Starts the render on the deployed function, polls progress and prints
//      "Rendered frames N/TOTAL" lines so the VPS progress parser keeps working.
//   3. Downloads the finished MP4 to --out.
//
// Env: REMOTION_AWS_ACCESS_KEY_ID / REMOTION_AWS_SECRET_ACCESS_KEY / REMOTION_AWS_REGION,
//      REMOTION_SERVE_URL (from `npx remotion lambda sites create`),
//      REMOTION_FUNCTION_NAME (optional; defaults to the biggest deployed function).
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync, createWriteStream } from 'fs'
import { join, dirname, relative, extname } from 'path'
import { fileURLToPath } from 'url'
import { renderMediaOnLambda, getRenderProgress, getFunctions, getSites } from '@remotion/lambda/client'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => { if (v.startsWith('--')) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']); return a }, []))
const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const PUBLIC = join(ROOT, 'public')
const region = process.env.REMOTION_AWS_REGION || process.env.AWS_REGION || 'us-east-1'
const comp = args.comp; const out = args.out
if (!comp || !out) { console.error('usage: --comp <id> --props <file> --out <mp4>'); process.exit(2) }
const props = args.props && existsSync(args.props) ? JSON.parse(readFileSync(args.props, 'utf8')) : {}

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.mp4': 'video/mp4', '.json': 'application/json', '.svg': 'image/svg+xml' }

// ---- 1. collect per-video files -------------------------------------------
const files = new Set()
const walk = (dir) => { for (const n of readdirSync(dir)) { const p = join(dir, n); statSync(p).isDirectory() ? walk(p) : files.add(relative(PUBLIC, p).replace(/\\/g, '/')) } }
const scan = (v) => {
  if (typeof v === 'string') { if (v.length < 300 && !/^(https?:|data:)/.test(v)) { const p = join(PUBLIC, v); if (existsSync(p) && statSync(p).isFile()) files.add(v.replace(/^\//, '').replace(/\\/g, '/')) } }
  else if (Array.isArray(v)) v.forEach(scan)
  else if (v && typeof v === 'object') Object.values(v).forEach(scan)
}
scan(props)
if (props.assetDir && existsSync(join(PUBLIC, props.assetDir))) walk(join(PUBLIC, props.assetDir))

// ---- 2. upload to the Remotion bucket --------------------------------------
const serveUrl = process.env.REMOTION_SERVE_URL || (await (async () => { const sites = await getSites({ region }); const s = sites.sites.find((x) => x.id === 'docs2video') || sites.sites[0]; return s?.serveUrl })())
if (!serveUrl) { console.error('No REMOTION_SERVE_URL and no deployed site found'); process.exit(2) }
const bucket = new URL(serveUrl).hostname.split('.')[0]
const functionName = process.env.REMOTION_FUNCTION_NAME || (await getFunctions({ region, compatibleOnly: true })).sort((a, b) => b.memorySizeInMb - a.memorySizeInMb)[0]?.functionName
if (!functionName) { console.error('No compatible Lambda function deployed'); process.exit(2) }
const s3 = new S3Client({ region })
const jobId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
const prefix = `video-assets/${jobId}`
let bytes = 0
for (const f of files) {
  const body = readFileSync(join(PUBLIC, f)); bytes += body.length
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: `${prefix}/${f}`, Body: body, ContentType: MIME[extname(f).toLowerCase()] || 'application/octet-stream', ACL: 'public-read' }))
}
const assetBase = `https://${bucket}.s3.${region}.amazonaws.com/${prefix}`
console.log(`lambda: ${files.size} asset files (${(bytes / 1048576).toFixed(1)} MB) → ${assetBase}`)

// ---- 3. render ---------------------------------------------------------------
const { renderId, bucketName } = await renderMediaOnLambda({
  region, functionName, serveUrl, composition: comp,
  inputProps: { ...props, assetBase },
  codec: 'h264', imageFormat: 'jpeg', jpegQuality: 90, crf: 20,
  privacy: 'public', downloadBehavior: { type: 'download', fileName: null },
  framesPerLambda: 120, maxRetries: 2, timeoutInMilliseconds: 240000,
  chromiumOptions: { gl: 'swangle' },
})
console.log(`lambda: render ${renderId} on ${functionName}`)
let last = -1
for (;;) {
  const p = await getRenderProgress({ renderId, bucketName, functionName, region })
  if (p.fatalErrorEncountered) { console.error('lambda: FAILED', JSON.stringify(p.errors?.slice(0, 2))); process.exit(1) }
  // Progress line in the same shape as the local renderer prints, so the VPS
  // parser ("Rendered frames N/TOTAL") keeps driving the customer's progress bar.
  const total = p.renderMetadata?.videoConfig?.durationInFrames ?? (p.overallProgress ? Math.round((p.framesRendered ?? 0) / p.overallProgress) : 0)
  const done = Math.min(total || 0, Math.round(total ? (p.overallProgress ?? 0) * total : (p.framesRendered ?? 0)))
  if (total && done !== last) { console.log(`Rendered frames ${done}/${total}`); last = done }
  if (p.done) {
    const url = p.outputFile
    if (!url) { console.error('lambda: done but no output url'); process.exit(1) }
    const r = await fetch(url); if (!r.ok) { console.error('lambda: download failed', r.status); process.exit(1) }
    writeFileSync(out, Buffer.from(await r.arrayBuffer()))
    console.log(`lambda: saved ${out} (${(statSync(out).size / 1048576).toFixed(1)} MB, cost ≈ $${(p.costs?.accruedSoFar ?? 0).toFixed(3)})`)
    process.exit(0)
  }
  await new Promise((r) => setTimeout(r, 2500))
}
