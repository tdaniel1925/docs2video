/**
 * /process-logo endpoint for the VPS video-service (server.js).
 * ============================================================
 * Self-hosted background removal via rembg (U2-Net). The app's logo upload
 * pipeline calls this when Sharp's flat-color knockout can't cleanly separate a
 * logo from a busy/photo/gradient background.
 *
 * HOW TO INSTALL:
 *   1. Apply the Dockerfile changes in ./Dockerfile.additions (installs python3
 *      + rembg + the u2net model into the image).
 *   2. Paste the `app.post('/process-logo', ...)` block below into server.js,
 *      anywhere after `authCheck` is defined (e.g. next to /extract-document).
 *   3. Add `processLogo` to /health + /selftest if you want it monitored (see
 *      ./health-selftest.additions.js).
 *   4. Redeploy:  bash ./deploy.sh   (scp + docker compose up -d --build)
 *
 * CONTRACT (matches app/_lib/logo-enhance.ts):
 *   POST /process-logo   { imageBase64 }      (x-api-secret header)
 *   -> 200 { pngBase64 } transparent PNG with the background removed
 *   -> 4xx/5xx { error } on failure (the app falls back gracefully)
 */

// ---- paste from here into server.js ----
app.post('/process-logo', authCheck, async (req, res) => {
  const { imageBase64 } = req.body
  if (!imageBase64) return res.status(400).json({ error: 'Missing imageBase64' })

  const workDir = join(tmpdir(), `d2v-logo-${randomUUID()}`)
  const inPath = join(workDir, 'in.png')
  const outPath = join(workDir, 'out.png')
  console.log('[process-logo] starting')

  try {
    await mkdir(workDir, { recursive: true })
    await writeFile(inPath, Buffer.from(imageBase64, 'base64'))

    // rembg CLI: `rembg i input output`. Alpha-matting gives cleaner logo edges.
    // u2net model is baked into the image (see Dockerfile.additions) so this is
    // offline + deterministic, no per-call download.
    await new Promise((resolve, reject) => {
      execFile(
        'rembg',
        ['i', '-a', '-ae', '15', inPath, outPath],
        { timeout: 40000, env: { ...process.env, U2NET_HOME: '/root/.u2net' } },
        (err, stdout, stderr) => {
          if (err) {
            console.error('[process-logo] rembg error:', err.message, (stderr || '').slice(0, 200))
            return reject(new Error('Background removal failed'))
          }
          resolve(stdout)
        }
      )
    })

    const png = await readFile(outPath)
    res.json({ pngBase64: png.toString('base64') })
    console.log('[process-logo] done')
  } catch (err) {
    console.error('[process-logo] error:', err.message)
    reportError({ source: 'process-logo', stage: 'rembg', message: err.message }).catch(() => {})
    res.status(500).json({ error: 'Could not process this logo.' })
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {})
  }
})
// ---- paste until here ----
