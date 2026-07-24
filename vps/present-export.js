// Presentation → MP4 export (the "video is a derived export" job).
// Contract: POST /export-presentation { videoId, htmlUrl } (x-api-secret).
// Responds 202 immediately; the capture runs in background:
//   1. Open htmlUrl?record=1 in Playwright (controls hidden, page audio off),
//      read the embedded VO clips + their durations FROM the page itself,
//      drive slide timing via startShow(), record the page at 1080p.
//   2. Rebuild the narration on the identical schedule (concat clips + gap
//      silences — the proven anti-drift approach), mux h264/aac.
//   3. Upload to storage videos/presentations/{id}.mp4 and set
//      videos.export_video_url.
// Deps: playwright (add to vps/package.json + Dockerfile: npx playwright
// install --with-deps chromium). ffmpeg already in the image.
const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const os = require('os')

const GAP_MS = 800
const TAIL_MS = 1800

async function runExport({ videoId, htmlUrl, supabase, log }) {
  const { chromium } = require('playwright')
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'present-export-'))
  try {
    // ── 1. Read VO data from the page, then record ──
    const browser = await chromium.launch({ args: ['--no-sandbox'] })
    const probeCtx = await browser.newContext()
    const probe = await probeCtx.newPage()
    await probe.goto(`${htmlUrl}?record=1`, { waitUntil: 'networkidle', timeout: 60000 })
    const voData = await probe.evaluate(async () => {
      const clips = (typeof VO !== 'undefined' ? VO : [])
      const durs = []
      for (const b64 of clips) {
        if (!b64) { durs.push(2500); continue }
        // eslint-disable-next-line no-await-in-loop
        const d = await new Promise((resolve) => {
          const a = new Audio('data:audio/mpeg;base64,' + b64)
          a.onloadedmetadata = () => resolve(Math.round(a.duration * 1000))
          a.onerror = () => resolve(2500)
        })
        durs.push(d)
      }
      return { clips, durs }
    })
    await probeCtx.close()
    if (!voData.clips.length) throw new Error('Presentation has no narration — only interactive presentations export to video.')

    const durs = voData.durs.map((d, i, arr) => d + (i === arr.length - 1 ? TAIL_MS : GAP_MS))
    const totalMs = durs.reduce((a, b) => a + b, 0)
    log(`capturing ${durs.length} slides · ${(totalMs / 1000).toFixed(1)}s`)

    const capDir = path.join(work, 'cap'); fs.mkdirSync(capDir)
    const ctx = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      recordVideo: { dir: capDir, size: { width: 1920, height: 1080 } },
    })
    const page = await ctx.newPage()
    const tPage = Date.now()
    await page.goto(`${htmlUrl}?record=1`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(900)
    const leadMs = Date.now() - tPage
    await page.evaluate((d) => window.startShow(d), durs)
    await page.waitForTimeout(totalMs + 800)
    await page.close(); await ctx.close(); await browser.close()
    const webm = path.join(capDir, fs.readdirSync(capDir).find((f) => f.endsWith('.webm')))

    // ── 2. Narration on the identical schedule ──
    const clipFiles = voData.clips.map((b64, i) => {
      const f = path.join(work, `vo-${i}.mp3`)
      fs.writeFileSync(f, Buffer.from(b64, 'base64'))
      return f
    })
    const inputs = ['-f', 'lavfi', '-t', (leadMs / 1000).toFixed(3), '-i', 'anullsrc=r=44100:cl=stereo']
    const labels = ['[0:a]']; const filters = []
    clipFiles.forEach((f, i) => {
      inputs.push('-i', f)
      const idx = inputs.filter((x) => x === '-i').length - 1
      filters.push(`[${idx}:a]aresample=44100,pan=stereo|c0=c0|c1=c0[c${i}]`)
      labels.push(`[c${i}]`)
      if (i < clipFiles.length - 1) {
        inputs.push('-f', 'lavfi', '-t', (GAP_MS / 1000).toFixed(3), '-i', 'anullsrc=r=44100:cl=stereo')
        labels.push(`[${inputs.filter((x) => x === '-i').length - 1}:a]`)
      }
    })
    const wav = path.join(work, 'narration.wav')
    execFileSync('ffmpeg', ['-y', ...inputs, '-filter_complex',
      `${filters.join(';')};${labels.join('')}concat=n=${labels.length}:v=0:a=1,loudnorm=I=-16:TP=-1.5:LRA=9[out]`,
      '-map', '[out]', wav], { stdio: 'pipe' })

    // ── 3. Mux + upload ──
    const mp4 = path.join(work, 'export.mp4')
    execFileSync('ffmpeg', ['-y', '-i', webm, '-i', wav,
      '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
      '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-b:a', '160k', '-shortest', mp4], { stdio: 'pipe' })

    const storagePath = `presentations/${videoId}.mp4`
    const buf = fs.readFileSync(mp4)
    const up = await supabase.storage.from('videos').upload(storagePath, buf, { contentType: 'video/mp4', upsert: true })
    if (up.error) throw new Error(up.error.message)
    const { data: pub } = supabase.storage.from('videos').getPublicUrl(storagePath)
    await supabase.from('videos').update({ export_video_url: pub.publicUrl }).eq('id', videoId)
    log(`export done · ${Math.round(buf.length / 1048576)}MB → ${pub.publicUrl}`)
  } finally {
    fs.rmSync(work, { recursive: true, force: true })
  }
}

/** Express handler factory — server.js wires:
 *  app.post('/export-presentation', authCheck, exportPresentation(supabase)) */
function exportPresentation(supabase) {
  return async (req, res) => {
    const { videoId, htmlUrl } = req.body || {}
    if (!videoId || !htmlUrl) return res.status(400).json({ error: 'videoId and htmlUrl required' })
    res.status(202).json({ success: true, accepted: true })
    const log = (...a) => console.log(`[export-presentation ${videoId}]`, ...a)
    runExport({ videoId, htmlUrl, supabase, log }).catch(async (err) => {
      console.error(`[export-presentation ${videoId}] FAILED:`, err.message)
      await supabase.from('videos').update({ error_message: `Video export failed: ${err.message}` }).eq('id', videoId).catch(() => {})
    })
  }
}

module.exports = { exportPresentation }
