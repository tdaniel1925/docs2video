/**
 * Standalone live test for the commercial pipeline — runs the FULL director
 * (comprehend → direct → VO → images → ElevenLabs Music) and renders
 * TemplateCommercial, WITHOUT touching Supabase/auth. Proves the generation +
 * render path end-to-end. Run INSIDE the container:
 *   docker exec docs2video-service node /app/test-commercial.js "https://example.com" "BrandName"
 * Output: /app/remotion/out/test-commercial.mp4
 */
const { join } = require('path')
const { execFile } = require('child_process')
const { generateCommercial } = require('./commercial')

const REMOTION_DIR = process.env.REMOTION_DIR || '/app/remotion'
const url = process.argv[2] || 'https://smartviewz.com'
const brandName = process.argv[3] || ''

// image gen: Cloudflare FLUX (free) if configured, else Gemini via a tiny fetch.
const { cloudflareImage, cloudflareAvailable } = require('./slides')
async function geminiImage(prompt, outPath) {
  const KEY = process.env.GEMINI_API_KEY
  const model = process.env.IMAGE_MODEL || 'gemini-3-pro-image-preview'
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${KEY}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt + ' Cinematic, photorealistic, dark, moody, 16:9.' }] }], generationConfig: { responseModalities: ['IMAGE'] } }),
    signal: AbortSignal.timeout(90000),
  })
  if (!r.ok) throw new Error(`gemini ${r.status}`)
  const j = await r.json()
  const part = (j.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData)
  if (!part) throw new Error('gemini: no image')
  const { writeFile } = require('fs/promises')
  await writeFile(outPath, Buffer.from(part.inlineData.data, 'base64'))
}

;(async () => {
  const t0 = Date.now()
  const log = (m) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${m}`)
  console.log(`\n▶ TEST commercial: ${url}${brandName ? ` (${brandName})` : ''}\n`)

  const imageGen = cloudflareAvailable()
    ? async (p, o) => { try { return await cloudflareImage(p, o) } catch (e) { return await geminiImage(p, o) } }
    : geminiImage

  const deps = {
    geminiImage: imageGen,
    tts: (fn) => fn(),
    stageMusic: async (_mood, outPath) => {
      // fallback only (ElevenLabs Music is primary in generateCommercial): silent track
      await new Promise((res, rej) => execFile('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-t', '5', '-q:a', '9', outPath], { timeout: 30000 }, (e) => e ? rej(e) : res()))
    },
  }

  const pub = join(REMOTION_DIR, 'public')
  const { props, propsPath, assetDir, styleId, totalSec } = await generateCommercial({
    pub, url, brandName, videoId: 'test', deps, log,
  })
  log(`GENERATED: style=${styleId}, ${props.beats.length} beats, ~${totalSec.toFixed(1)}s`)
  console.log(`   wordmark: ${props.wordmark.pre}${props.wordmark.post}  |  accent ${props.brand.accent}`)
  console.log(`   beats: ${props.beats.map((b) => b.kind).join(' → ')}`)
  console.log(`   VO lines: ${props.beats.filter((b) => b.vo).length}  |  music.frames: ${props.music.frames}`)

  const outFile = join(REMOTION_DIR, 'out', 'test-commercial.mp4')
  log('RENDERING TemplateCommercial...')
  await new Promise((resolve, reject) => {
    const { spawn } = require('child_process')
    const child = spawn('npx', ['remotion', 'render', 'TemplateCommercial', outFile, `--props=${propsPath}`, '--gl=swiftshader', '--concurrency=12', '--image-format=jpeg', '--log=error'], { cwd: REMOTION_DIR, env: process.env })
    let last = ''
    child.stdout.on('data', (b) => { const m = [...b.toString().matchAll(/(\d+)\/(\d+)/g)].pop(); if (m && m[0] !== last) { last = m[0]; process.stdout.write(`\r   frames ${m[0]}   `) } })
    child.stderr.on('data', (b) => process.stderr.write(b))
    child.on('close', (c) => { process.stdout.write('\n'); c === 0 ? resolve() : reject(new Error(`render exit ${c}`)) })
    child.on('error', reject)
  })
  log(`DONE → ${outFile}`)
})().catch((e) => { console.error('\nFAILED:', e.stack || e.message); process.exit(1) })
