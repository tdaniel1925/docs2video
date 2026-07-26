const express = require('express')
const { execFile } = require('child_process')
const { writeFile, mkdir, rm, readFile } = require('fs/promises')
const { join, dirname } = require('path')
const { randomUUID, timingSafeEqual } = require('crypto')
const { tmpdir } = require('os')
const { createClient } = require('@supabase/supabase-js')
const WebSocket = require('ws')

const app = express()
app.use(express.json({ limit: '200mb' }))

const PORT = process.env.PORT || 4000
// FAIL CLOSED: no committed fallback secret (review S1). A publicly-known
// fallback meant a missing env var silently opened every privileged endpoint.
const API_SECRET = process.env.API_SECRET
if (!API_SECRET) {
  console.error('FATAL: API_SECRET env var is required — refusing to start.')
  process.exit(1)
}
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const GEMINI_API_KEY = process.env.GEMINI_API_KEY
// Where to POST error alerts (the Vercel app, which has the mailer + Resend).
const APP_URL = process.env.APP_URL || 'https://docs2video.com'

// Fire-and-forget error alert. POSTs to the app's /api/internal/error-report,
// which emails ops. Never throws and never blocks the pipeline — alerting must
// not be able to break a render.
async function reportError({ source, videoId, userId, stage, message, detail }) {
  try {
    await fetch(`${APP_URL}/api/internal/error-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-secret': API_SECRET },
      body: JSON.stringify({ source, videoId, userId, stage, message, detail }),
      signal: AbortSignal.timeout(10000),
    })
  } catch (e) {
    console.error('[reportError] failed to send alert:', e?.message)
  }
}

// Auth middleware — constant-time compare (review S2: `!==` short-circuits on
// the first differing byte, leaking a timing side-channel on the shared secret).
const SECRET_BUF = Buffer.from(API_SECRET)
function authCheck(req, res, next) {
  const token = Buffer.from(String(req.headers['x-api-secret'] || ''))
  if (token.length !== SECRET_BUF.length || !timingSafeEqual(token, SECRET_BUF)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

// Health check — HONEST. Verifies the things that have silently broken before
// (sharp module, required keys, ffmpeg binary) instead of always returning ok.
// Cheap: no external API calls, safe to ping frequently.
app.get('/health', (req, res) => {
  const checks = {}
  // sharp loads? (its absence after a rebuild caused blue-slide videos)
  try { require('sharp'); checks.sharp = true } catch { checks.sharp = false }
  checks.geminiKey = !!GEMINI_API_KEY
  checks.openaiKey = !!OPENAI_API_KEY
  checks.supabase = !!(process.env.SUPABASE_URL || SUPABASE_URL) && !!(process.env.SUPABASE_SERVICE_KEY || SUPABASE_KEY)
  // ffmpeg binary resolves?
  checks.ffmpeg = false
  try {
    require('child_process').execFileSync('ffmpeg', ['-version'], { timeout: 4000, stdio: 'ignore' })
    checks.ffmpeg = true
  } catch { checks.ffmpeg = false }
  const ok = Object.values(checks).every(Boolean)
  res.status(ok ? 200 : 503).json({ status: ok ? 'ok' : 'degraded', checks })
})

// Self-test — runs ONE real slide through the EXACT production path plus probes
// of every external dependency, so a deploy can be verified in seconds and the
// admin System Status panel can confirm the render path actually works.
// Auth-gated (x-api-secret). Each check is isolated so one failure doesn't mask
// the others.
app.post('/selftest', authCheck, async (req, res) => {
  const t0 = Date.now()
  const checks = {}
  const errors = []
  const time = async (name, fn) => {
    const s = Date.now()
    try { await fn(); checks[name] = { ok: true, ms: Date.now() - s } }
    catch (e) { checks[name] = { ok: false, ms: Date.now() - s, error: e?.message || String(e) }; errors.push(`${name}: ${e?.message || e}`) }
  }

  // sharp loads + can process an image
  await time('sharp', async () => {
    const sharp = require('sharp')
    const buf = await sharp({ create: { width: 64, height: 36, channels: 3, background: { r: 27, g: 54, b: 93 } } }).png().toBuffer()
    if (!buf || buf.length < 50) throw new Error('sharp produced empty output')
  })

  // Gemini: generate ONE real slide image (the exact prod model/config)
  await time('gemini', async () => {
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set')
    const { GoogleGenAI } = require('@google/genai')
    const g = new GoogleGenAI({ apiKey: GEMINI_API_KEY, httpOptions: { timeout: 120000 } })
    const r = await g.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: [{ role: 'user', parts: [{ text: 'A simple abstract corporate background, navy blue, 16:9. No text.' }] }],
      config: { responseFormat: { image: { aspectRatio: '16:9', imageSize: '2K' } } },
    })
    const parts = r.candidates?.[0]?.content?.parts ?? []
    if (!parts.some(p => p.inlineData)) throw new Error('No image in Gemini response')
  })

  // TTS: exercise the REAL chain (ElevenLabs primary → OpenAI fallback), so a
  // green check means renders can actually voice scenes regardless of provider.
  await time('tts', async () => {
    const b = await ttsToBuffer('System check.', 'nova')
    if (b.length < 100) throw new Error(`TTS returned ${b.length} bytes`)
  })

  // Supabase read/write + storage upload/delete
  await time('supabase', async () => {
    const sUrl = process.env.SUPABASE_URL || SUPABASE_URL
    const sKey = process.env.SUPABASE_SERVICE_KEY || SUPABASE_KEY
    if (!sUrl || !sKey) throw new Error('Supabase env not set')
    const sb = createClient(sUrl, sKey, { auth: { persistSession: false }, realtime: { transport: WebSocket } })
    const { error } = await sb.from('videos').select('id').limit(1)
    if (error) throw new Error(`Supabase query failed: ${error.message}`)
  })

  await time('storage', async () => {
    const sUrl = process.env.SUPABASE_URL || SUPABASE_URL
    const sKey = process.env.SUPABASE_SERVICE_KEY || SUPABASE_KEY
    const sb = createClient(sUrl, sKey, { auth: { persistSession: false }, realtime: { transport: WebSocket } })
    const path = `_selftest/${randomUUID()}.txt`
    const up = await sb.storage.from('videos').upload(path, Buffer.from('ok'), { contentType: 'text/plain', upsert: true })
    if (up.error) throw new Error(`Upload failed: ${up.error.message}`)
    await sb.storage.from('videos').remove([path])
  })

  // ffmpeg present
  await time('ffmpeg', async () => {
    await new Promise((resolve, reject) => {
      execFile('ffmpeg', ['-version'], { timeout: 5000 }, (err) => err ? reject(new Error('ffmpeg not runnable')) : resolve())
    })
  })

  const ok = Object.values(checks).every(c => c.ok)
  res.status(ok ? 200 : 500).json({ ok, checks, errors, ms: Date.now() - t0 })
})

// Generate a simple fallback slide when OpenAI fails
// Returns an SVG buffer — FFmpeg handles SVG via lavfi or we convert during clip encoding
async function generateFallbackSlide(title, slideNum, totalSlides) {
  const safeTitle = (title || 'Slide').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const words = safeTitle.split(' ')
  const lines = []
  let current = ''
  for (const word of words) {
    if ((current + ' ' + word).length > 40 && current) { lines.push(current); current = word }
    else { current = current ? current + ' ' + word : word }
  }
  if (current) lines.push(current)

  const titleSvg = lines.map((line, i) =>
    `<text x="768" y="${460 + i * 56}" text-anchor="middle" font-size="44" font-weight="bold" fill="white" font-family="Arial, sans-serif">${line}</text>`
  ).join('\n')

  const svg = `<svg width="1536" height="1024" xmlns="http://www.w3.org/2000/svg">
    <rect width="1536" height="1024" fill="#1B365D"/>
    <rect x="60" y="60" width="1416" height="904" rx="12" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="2"/>
    ${titleSvg}
    <text x="768" y="${460 + lines.length * 56 + 30}" text-anchor="middle" font-size="18" fill="rgba(255,255,255,0.5)" font-family="Arial, sans-serif">${slideNum} / ${totalSlides}</text>
  </svg>`

  // Convert SVG to PNG using ffmpeg
  const tmpSvg = join(tmpdir(), `fallback-${randomUUID()}.svg`)
  const tmpPng = join(tmpdir(), `fallback-${randomUUID()}.png`)
  await writeFile(tmpSvg, svg)
  try {
    await runFfmpeg(['-i', tmpSvg, '-y', tmpPng])
    const png = await readFile(tmpPng)
    return png
  } catch {
    // If ffmpeg can't convert SVG, return SVG buffer (will be handled during clip encoding)
    return Buffer.from(svg)
  } finally {
    await rm(tmpSvg, { force: true }).catch(() => {})
    await rm(tmpPng, { force: true }).catch(() => {})
  }
}

// Run ffmpeg command
function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    console.log(`[ffmpeg] Running: ${args.join(' ').slice(0, 200)}...`)
    execFile('ffmpeg', args, { maxBuffer: 100 * 1024 * 1024, timeout: 600000 }, (err, stdout, stderr) => {
      if (err) {
        console.error(`[ffmpeg] Error:`, err.message)
        console.error(`[ffmpeg] Stderr:`, stderr?.slice(0, 500))
        return reject(new Error(`FFmpeg failed: ${err.message}`))
      }
      resolve(stdout + stderr)
    })
  })
}

// Probe an audio file's real duration (seconds). Returns 0 on failure.
function probeAudioDuration(audioPath) {
  return new Promise((resolve) => {
    execFile('ffprobe', ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', audioPath], { timeout: 10000 }, (err, stdout) => {
      if (err) return resolve(0)
      const d = parseFloat((stdout || '').trim())
      resolve(Number.isFinite(d) && d > 0 ? d : 0)
    })
  })
}

/**
 * ASSEMBLY V2 — single-filtergraph assembly (gated by env ASSEMBLY_V2).
 *
 * Builds the ENTIRE video in ONE ffmpeg pass instead of encoding N clips and
 * concatenating them. This removes the whole bug class that the per-clip path
 * suffers from: -shortest truncation, -an clips dropping audio in concat,
 * codec/timestamp seams between independently-encoded clips.
 *
 * For each slide i: the image is looped for exactly its narration duration
 * (+TAIL); narrated segments use the real audio, silent segments get an
 * anullsrc track of the same length — so every segment is homogeneous. Video is
 * joined with the concat filter; audio segments are concatenated into one
 * continuous track; the result is a single re-encode (no seams).
 *
 * @param opts.workDir        dir with slide_<i>.png and audio_<i>.mp3 already written
 * @param opts.slideCount     number of slides
 * @param opts.audioBuffers   per-slide audio buffers (to know which are narrated)
 * @param opts.outputPath     where to write the assembled mp4
 * @returns {Promise<number[]>} per-slide durations (seconds), in order
 */
async function assembleSingleGraph({ workDir, slideCount, audioBuffers, outputPath }) {
  const TAIL = 0.6 // seconds the slide lingers after its narration ends
  const SILENT_DUR = 5 // duration for slides with no narration
  const SR = 44100

  // 1) Decide each segment's duration up front (single source of truth).
  const durations = []
  for (let i = 0; i < slideCount; i++) {
    const hasAudio = audioBuffers[i] && audioBuffers[i].length > 100
    if (hasAudio) {
      const real = await probeAudioDuration(join(workDir, `audio_${i}.mp3`))
      durations.push((real > 0 ? real : Math.round(audioBuffers[i].length / 16000) + 1) + TAIL)
    } else {
      durations.push(SILENT_DUR)
    }
  }

  // 2) Build one ffmpeg command. Inputs: each image (looped) + each narrated audio.
  const args = []
  const audioInputIndex = [] // ffmpeg input index of each slide's audio, or -1
  let inputCount = 0
  // Image inputs first (one per slide).
  for (let i = 0; i < slideCount; i++) {
    args.push('-loop', '1', '-t', String(durations[i]), '-i', join(workDir, `slide_${i}.png`))
    inputCount++
  }
  // Audio inputs (only for narrated slides).
  for (let i = 0; i < slideCount; i++) {
    if (audioBuffers[i] && audioBuffers[i].length > 100) {
      args.push('-i', join(workDir, `audio_${i}.mp3`))
      audioInputIndex[i] = inputCount
      inputCount++
    } else {
      audioInputIndex[i] = -1
    }
  }

  // 3) Filtergraph: normalize each image to 1920x1080, set its duration; build a
  // matching audio segment (real audio padded to the segment length, or silence).
  const vf = 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p'
  const parts = []
  const vLabels = []
  const aLabels = []
  for (let i = 0; i < slideCount; i++) {
    parts.push(`[${i}:v]${vf},trim=duration=${durations[i]},setpts=PTS-STARTPTS[v${i}]`)
    vLabels.push(`[v${i}]`)
    if (audioInputIndex[i] >= 0) {
      // Real narration, padded/trimmed to exactly the segment length.
      parts.push(`[${audioInputIndex[i]}:a]aresample=${SR},apad,atrim=duration=${durations[i]},asetpts=PTS-STARTPTS[a${i}]`)
    } else {
      // Generated silence for the full segment length.
      parts.push(`anullsrc=channel_layout=stereo:sample_rate=${SR}:duration=${durations[i]}[a${i}]`)
    }
    aLabels.push(`[a${i}]`)
  }
  // Concat all video + audio segments into one continuous stream each.
  parts.push(`${vLabels.join('')}concat=n=${slideCount}:v=1:a=0[vout]`)
  parts.push(`${aLabels.join('')}concat=n=${slideCount}:v=0:a=1[aout]`)

  args.push(
    '-filter_complex', parts.join(';'),
    '-map', '[vout]', '-map', '[aout]',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'medium',
    '-c:a', 'aac', '-b:a', '192k',
    '-movflags', '+faststart',
    '-y', outputPath,
  )

  await runFfmpeg(args)
  return durations
}

// Main assembly endpoint
app.post('/assemble', authCheck, async (req, res) => {
  const { slides, audios, videoId, userId, musicUrl, watermarkText, isTrial } = req.body
  // slides: array of base64 PNG strings
  // audios: array of base64 MP3 strings
  // videoId: string
  // userId: string
  // musicUrl: optional string

  if (!slides?.length || !audios?.length || !videoId || !userId) {
    return res.status(400).json({ error: 'Missing slides, audios, videoId, or userId' })
  }

  const workDir = join(tmpdir(), `d2v-${randomUUID()}`)
  console.log(`[${videoId}] Starting assembly: ${slides.length} slides, ${audios.length} audios`)

  // Helper to update video progress in Supabase
  async function updateProgress(detail, pct) {
    if (!SUPABASE_URL || !SUPABASE_KEY) return
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false },
        realtime: { transport: WebSocket },
      })
      await supabase.from('videos').update({ progress_detail: detail, progress_pct: pct }).eq('id', videoId)
    } catch (e) { console.error(`[${videoId}] Progress update failed:`, e.message) }
  }

  try {
    await mkdir(workDir, { recursive: true })
    await updateProgress('Writing files to disk...', 76)

    // Write slides and audio to disk
    for (let i = 0; i < slides.length; i++) {
      await writeFile(join(workDir, `slide_${i}.png`), Buffer.from(slides[i], 'base64'))
      if (audios[i]) {
        await writeFile(join(workDir, `audio_${i}.mp3`), Buffer.from(audios[i], 'base64'))
      }
    }

    // Create individual clips
    const clipFiles = []
    const durations = []

    for (let i = 0; i < slides.length; i++) {
      await updateProgress(`Encoding clip ${i + 1} of ${slides.length}...`, 76 + Math.round((i / slides.length) * 12))
      const clipPath = join(workDir, `clip_${i}.mp4`)
      const slidePath = join(workDir, `slide_${i}.png`)
      const audioPath = join(workDir, `audio_${i}.mp3`)

      const baseVf = 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2'
      let vf = baseVf
      if (isTrial) {
        // Large diagonal watermark for free trial videos
        vf = `${baseVf},drawtext=text='DOCS2VIDEO TRIAL':fontsize=120:fontcolor=white@0.25:x=(w-tw)/2:y=(h-th)/2:borderw=2:bordercolor=black@0.15`
      } else if (watermarkText) {
        vf = `${baseVf},drawtext=text='${watermarkText.replace(/'/g, "\\'")}':fontsize=32:fontcolor=white@0.4:x=w-tw-40:y=h-th-30`
      }

      if (audios[i]) {
        await runFfmpeg([
          '-loop', '1',
          '-i', slidePath,
          '-i', audioPath,
          '-c:v', 'libx264',
          '-tune', 'stillimage',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-pix_fmt', 'yuv420p',
          '-vf', vf,
          '-shortest',
          '-y',
          clipPath,
        ])
      } else {
        await runFfmpeg([
          '-loop', '1',
          '-i', slidePath,
          '-t', '5',
          '-c:v', 'libx264',
          '-tune', 'stillimage',
          '-pix_fmt', 'yuv420p',
          '-vf', vf,
          '-an',
          '-y',
          clipPath,
        ])
      }

      clipFiles.push(clipPath)
      // Get accurate clip duration via ffprobe
      try {
        const probeDuration = await new Promise((resolve) => {
          execFile('ffprobe', ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', clipPath], { timeout: 10000 }, (err, stdout) => {
            if (err) resolve(null)
            else resolve(parseFloat(stdout.trim()))
          })
        })
        durations.push(probeDuration || 5)
      } catch {
        const audioSize = audios[i] ? Buffer.from(audios[i], 'base64').length : 0
        durations.push(audioSize > 0 ? Math.round(audioSize / 16000) : 5)
      }
    }

    console.log(`[${videoId}] Clips done, concatenating...`)
    await updateProgress('Joining clips together...', 89)

    // Concatenate clips
    const concatFile = join(workDir, 'concat.txt')
    const concatContent = clipFiles.map(f => `file '${f}'`).join('\n')
    await writeFile(concatFile, concatContent)

    const outputPath = join(workDir, 'output.mp4')
    await runFfmpeg([
      '-f', 'concat',
      '-safe', '0',
      '-i', concatFile,
      '-c', 'copy',
      '-movflags', '+faststart',
      '-y',
      outputPath,
    ])

    // Mix background music if provided
    let finalPath = outputPath
    if (musicUrl) {
      try {
        console.log(`[${videoId}] Downloading background music from: ${musicUrl}`)
        const musicRes = await fetch(musicUrl, { signal: AbortSignal.timeout(30000), redirect: 'follow' })
        console.log(`[${videoId}] Music fetch status: ${musicRes.status} ${musicRes.statusText}`)
        if (musicRes.ok) {
          const musicPath = join(workDir, 'bgmusic.mp3')
          const musicBuf = Buffer.from(await musicRes.arrayBuffer())
          await writeFile(musicPath, musicBuf)

          const totalDuration = durations.reduce((sum, d) => sum + d, 0)
          const fadeOutStart = Math.max(0, totalDuration - 3)

          const mixedPath = join(workDir, 'output_with_music.mp4')
          await runFfmpeg([
            '-i', outputPath,
            '-stream_loop', '-1',
            '-i', musicPath,
            '-filter_complex',
            // normalize=0 stops amix from auto-ducking the narration; narration stays
            // at full volume and music sits as a quiet bed underneath at ~4%.
            `[0:a]volume=1.0[narr];[1:a]volume=0.04,afade=t=in:st=0:d=2,afade=t=out:st=${fadeOutStart}:d=3[music];[narr][music]amix=inputs=2:duration=first:normalize=0[out]`,
            '-map', '0:v',
            '-map', '[out]',
            '-c:v', 'copy',
            '-c:a', 'aac',
            '-b:a', '192k',
            '-movflags', '+faststart',
            '-y',
            mixedPath,
          ])
          finalPath = mixedPath
          console.log(`[${videoId}] Music mixed`)
          await updateProgress('Music added, finalizing...', 93)
        } else {
          console.error(`[${videoId}] Music download failed: ${musicRes.status} ${musicRes.statusText}`)
        }
      } catch (err) {
        console.error(`[${videoId}] Music mixing failed, using video without music:`, err.message)
      }
    } else {
      console.log(`[${videoId}] No musicUrl provided, skipping music`)
    }

    // Read final video
    const videoBuffer = await readFile(finalPath)
    console.log(`[${videoId}] Video assembled: ${(videoBuffer.length / 1024 / 1024).toFixed(1)}MB`)

    // Upload to Supabase Storage
    if (SUPABASE_URL && SUPABASE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false },
        realtime: { transport: WebSocket },
      })

      const videoStoragePath = `${userId}/${videoId}.mp4`
      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(videoStoragePath, videoBuffer, { contentType: 'video/mp4', upsert: true })

      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

      const { data: urlData } = supabase.storage.from('videos').getPublicUrl(videoStoragePath)

      // Upload thumbnail (first slide)
      const thumbBuffer = Buffer.from(slides[0], 'base64')
      const thumbPath = `${userId}/${videoId}_thumb.png`
      await supabase.storage.from('videos').upload(thumbPath, thumbBuffer, { contentType: 'image/png', upsert: true })
      const { data: thumbUrlData } = supabase.storage.from('videos').getPublicUrl(thumbPath)

      // Upload individual slides and collect URLs
      await updateProgress('Saving slides...', 96)
      const slideUrls = []
      for (let i = 0; i < slides.length; i++) {
        const slideBuf = Buffer.from(slides[i], 'base64')
        const slidePath = `${userId}/${videoId}_slide_${i}.png`
        await supabase.storage.from('videos').upload(slidePath, slideBuf, { contentType: 'image/png', upsert: true })
        const { data: slideUrl } = supabase.storage.from('videos').getPublicUrl(slidePath)
        slideUrls.push(slideUrl.publicUrl)
      }
      console.log(`[${videoId}] Uploaded ${slideUrls.length} slides + video to Supabase`)

      // Mark video as completed directly — don't rely on Vercel (it may have timed out)
      const totalDuration = durations.reduce((s, d) => s + d, 0)
      await supabase.from('videos').update({
        video_url: urlData.publicUrl,
        thumbnail_url: thumbUrlData.publicUrl,
        duration: Math.round(totalDuration),
        // slide_durations: durations, // column doesn't exist in schema
        slide_urls: slideUrls,
        status: 'completed',
        progress_detail: null,
        progress_pct: 100,
      }).eq('id', videoId)

      console.log(`[${videoId}] Marked as completed in database`)

      res.json({
        success: true,
        videoUrl: urlData.publicUrl,
        thumbnailUrl: thumbUrlData.publicUrl,
        durations,
        totalDuration,
      })
    } else {
      // Return video as base64 if no Supabase configured
      res.json({
        success: true,
        videoBase64: videoBuffer.toString('base64'),
        durations,
        totalDuration: durations.reduce((s, d) => s + d, 0),
      })
    }
  } catch (err) {
    console.error(`[${videoId}] Error:`, err.message)
    // Mark video as failed directly in database
    if (SUPABASE_URL && SUPABASE_KEY) {
      try {
        const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false }, realtime: { transport: WebSocket } })
        await sb.from('videos').update({ status: 'failed', error_message: err.message, progress_detail: `Assembly failed: ${err.message}`, progress_pct: 0 }).eq('id', videoId)
      } catch (e) { console.error(`[${videoId}] Failed to update status:`, e.message) }
    }
    res.status(500).json({ error: err.message })
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {})
  }
})

// PPTX/PPT to PDF conversion (for Gemini extraction)
// Presentation -> MP4 export (interactive presentations; HTML-first pipeline)
const { exportPresentation } = require('./present-export')
app.post('/export-presentation', authCheck, (req, res) => {
  const sUrl = process.env.SUPABASE_URL, sKey = process.env.SUPABASE_SERVICE_KEY
  if (!sUrl || !sKey) return res.status(500).json({ error: 'Supabase not configured' })
  const sb = createClient(sUrl, sKey, { auth: { persistSession: false } })
  return exportPresentation(sb)(req, res)
})

app.post('/convert-to-pdf', authCheck, async (req, res) => {
  const { fileBase64, fileName } = req.body
  if (!fileBase64 || !fileName) {
    return res.status(400).json({ error: 'Missing fileBase64 or fileName' })
  }

  const workDir = join(tmpdir(), `d2v-pdf-${randomUUID()}`)
  console.log(`[convert-to-pdf] Converting: ${fileName}`)

  try {
    await mkdir(workDir, { recursive: true })

    const ext = fileName.split('.').pop().toLowerCase()
    const inputPath = join(workDir, `input.${ext}`)
    await writeFile(inputPath, Buffer.from(fileBase64, 'base64'))

    // Convert to PDF using LibreOffice
    await new Promise((resolve, reject) => {
      execFile('libreoffice', [
        '--headless',
        '--convert-to', 'pdf',
        '--outdir', workDir,
        inputPath,
      ], { timeout: 120000 }, (err, stdout, stderr) => {
        if (err) {
          console.error('[convert-to-pdf] LibreOffice error:', err.message, stderr)
          return reject(new Error(`Conversion failed: ${err.message}`))
        }
        resolve(stdout)
      })
    })

    const pdfPath = join(workDir, 'input.pdf')
    const pdfBuffer = await readFile(pdfPath)
    console.log(`[convert-to-pdf] PDF created: ${(pdfBuffer.length / 1024 / 1024).toFixed(1)}MB`)

    res.json({ success: true, pdfBase64: pdfBuffer.toString('base64') })
  } catch (err) {
    console.error(`[convert-to-pdf] Error:`, err.message)
    res.status(500).json({ error: err.message })
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {})
  }
})

// PPTX/PPT to PNG slide conversion endpoint
// Requires LibreOffice: apt-get install libreoffice-impress
app.post('/convert', authCheck, async (req, res) => {
  const { fileBase64, fileName } = req.body
  if (!fileBase64 || !fileName) {
    return res.status(400).json({ error: 'Missing fileBase64 or fileName' })
  }

  const workDir = join(tmpdir(), `d2v-convert-${randomUUID()}`)
  console.log(`[convert] Starting conversion: ${fileName}`)

  try {
    await mkdir(workDir, { recursive: true })

    // Write uploaded file
    const ext = fileName.split('.').pop().toLowerCase()
    const inputPath = join(workDir, `input.${ext}`)
    await writeFile(inputPath, Buffer.from(fileBase64, 'base64'))

    // Convert to PDF first (LibreOffice) — skip if already a PDF
    let pdfPath
    if (ext === 'pdf') {
      pdfPath = inputPath
      console.log(`[convert] Input is already PDF, skipping LibreOffice`)
    } else {
      await new Promise((resolve, reject) => {
        execFile('libreoffice', [
          '--headless',
          '--convert-to', 'pdf',
          '--outdir', workDir,
          inputPath,
        ], { timeout: 120000 }, (err, stdout, stderr) => {
          if (err) {
            console.error('[convert] LibreOffice error:', err.message, stderr)
            return reject(new Error(`Conversion failed: ${err.message}`))
          }
          resolve(stdout)
        })
      })
      pdfPath = join(workDir, 'input.pdf')
    }

    // Get page count using pdfinfo or ffprobe
    let pageCount = 0
    try {
      const { stdout } = await new Promise((resolve, reject) => {
        execFile('pdfinfo', [pdfPath], { timeout: 10000 }, (err, stdout, stderr) => {
          if (err) return reject(err)
          resolve({ stdout, stderr })
        })
      })
      const match = stdout.match(/Pages:\s+(\d+)/)
      pageCount = match ? parseInt(match[1], 10) : 0
    } catch {
      // Fallback: try pdftoppm and count output files
      pageCount = 50 // Will be corrected by actual output
    }

    console.log(`[convert] PDF has ${pageCount} pages, rendering to PNG...`)

    // Convert PDF pages to PNG using pdftoppm (poppler-utils)
    // Renders at 1920px wide (16:9 = 1080px tall)
    await new Promise((resolve, reject) => {
      execFile('pdftoppm', [
        '-png',
        '-rx', '192',  // 192 DPI for ~1920px width on standard slides
        '-ry', '192',
        pdfPath,
        join(workDir, 'slide'),
      ], { timeout: 120000 }, (err) => {
        if (err) return reject(new Error(`pdftoppm failed: ${err.message}`))
        resolve(null)
      })
    })

    // Read all generated slide images
    const { readdir } = require('fs/promises')
    const files = await readdir(workDir)
    const slideFiles = files
      .filter(f => f.startsWith('slide-') && f.endsWith('.png'))
      .sort()

    console.log(`[convert] Generated ${slideFiles.length} slide images`)

    const slideImages = []
    for (const sf of slideFiles) {
      const buf = await readFile(join(workDir, sf))

      // Resize to exact 1920x1080 using ffmpeg
      const resizedPath = join(workDir, `resized_${sf}`)
      await runFfmpeg([
        '-i', join(workDir, sf),
        '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=white',
        '-y',
        resizedPath,
      ])
      const resizedBuf = await readFile(resizedPath)
      slideImages.push(resizedBuf.toString('base64'))
    }

    if (slideImages.length === 0) {
      throw new Error('No slides extracted from file')
    }

    console.log(`[convert] Conversion complete: ${slideImages.length} slides`)
    res.json({ success: true, slides: slideImages, count: slideImages.length })
  } catch (err) {
    console.error(`[convert] Error:`, err.message)
    res.status(500).json({ error: err.message })
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {})
  }
})

// ============================================================
// EXTRACT-DOCUMENT — parse an uploaded doc into structured ExtractedData.
// (Was missing on the VPS; the app calls this for PDF/DOCX/PPTX/etc. uploads.)
// Flow: write file -> convert to PDF if needed (libreoffice) -> pull text
// (pdftotext) -> Gemini structures it into { title, sections, keyMetrics, ... }.
// ============================================================
app.post('/extract-document', authCheck, async (req, res) => {
  const { fileBase64, fileName, purpose, mimeType } = req.body
  if (!fileBase64 || !fileName) {
    return res.status(400).json({ error: 'Missing fileBase64 or fileName' })
  }
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured on VPS' })
  }

  const workDir = join(tmpdir(), `d2v-extract-${randomUUID()}`)
  console.log(`[extract-document] Starting: ${fileName}`)

  try {
    await mkdir(workDir, { recursive: true })
    const ext = (fileName.split('.').pop() || '').toLowerCase()
    const inputPath = join(workDir, `input.${ext || 'bin'}`)
    await writeFile(inputPath, Buffer.from(fileBase64, 'base64'))

    // 1) Get plain text. .txt/.csv read directly; everything else -> PDF -> pdftotext.
    let text = ''
    if (ext === 'txt' || ext === 'csv') {
      text = (await readFile(inputPath, 'utf-8')).slice(0, 60000)
    } else {
      let pdfPath = inputPath
      if (ext !== 'pdf') {
        await new Promise((resolve, reject) => {
          execFile('libreoffice', ['--headless', '--convert-to', 'pdf', '--outdir', workDir, inputPath], { timeout: 120000 }, (err, stdout, stderr) => {
            if (err) { console.error('[extract-document] LibreOffice error:', err.message, stderr?.slice(0, 200)); return reject(new Error('Could not convert this file type.')) }
            resolve(stdout)
          })
        })
        pdfPath = join(workDir, 'input.pdf')
      }
      const txtPath = join(workDir, 'out.txt')
      await new Promise((resolve, reject) => {
        execFile('pdftotext', ['-layout', pdfPath, txtPath], { timeout: 60000 }, (err) => {
          if (err) return reject(new Error('Could not read text from this document.'))
          resolve(null)
        })
      })
      text = (await readFile(txtPath, 'utf-8').catch(() => '')).slice(0, 60000)
    }

    if (!text.trim()) {
      throw new Error('No readable text found in this document. If it is a scanned image, please paste the text instead.')
    }

    // 2) Gemini structures the text into ExtractedData.
    const { GoogleGenAI } = require('@google/genai')
    const genai = new GoogleGenAI({ apiKey: GEMINI_API_KEY, httpOptions: { timeout: 120000 } })
    const prompt = `You are extracting the key content of a document so it can become an explainer video.${purpose ? ` The user's purpose: "${purpose}".` : ''}
Return ONLY valid JSON (no markdown, no code fences) with this exact shape:
{
  "title": "a clear, human title for the document",
  "subtitle": "one-line subtitle or null",
  "source": null,
  "industry": "best-guess industry (e.g. insurance, finance, healthcare, business, general)",
  "companyName": "the company/brand name if clearly present, else null",
  "keyMetrics": [{"label":"short label","value":"the value","highlight":true}],
  "sections": [{"title":"section heading","content":"1-3 sentence summary of that section"}],
  "bulletPoints": ["the most important takeaways, 3-8 of them"],
  "additionalNotes": ["any other useful facts"],
  "contactInfo": {"phone":null,"email":null,"website":null,"address":null}
}
Rules: Only include facts that actually appear in the text. Do NOT invent numbers, names, or contact info. Pull 3-8 sections and the most important metrics. Keep summaries concise.

DOCUMENT TEXT:
${text}`

    let raw = ''
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const r = await genai.models.generateContent({ model: 'gemini-2.5-flash', contents: [{ role: 'user', parts: [{ text: prompt }] }] })
        raw = r.text?.trim() || (r.candidates?.[0]?.content?.parts ?? []).map(p => p.text || '').join('').trim()
        if (raw) break
        throw new Error('empty response')
      } catch (e) {
        console.error(`[extract-document] Gemini attempt ${attempt}/3:`, e.message?.slice(0, 120))
        if (attempt < 3) await new Promise(r => setTimeout(r, 2000 * attempt))
      }
    }
    if (!raw) throw new Error('Document analysis failed. Please try again.')

    const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')
    let data
    try { data = JSON.parse(cleaned) } catch { throw new Error('Could not structure this document. Try a different file or paste the text.') }

    // Normalize to the ExtractedData shape with safe defaults.
    const result = {
      title: data.title || fileName.replace(/\.[^.]+$/, ''),
      subtitle: data.subtitle ?? null,
      source: data.source ?? null,
      industry: data.industry || 'general',
      companyName: data.companyName ?? null,
      keyMetrics: Array.isArray(data.keyMetrics) ? data.keyMetrics : [],
      sections: Array.isArray(data.sections) ? data.sections : [],
      bulletPoints: Array.isArray(data.bulletPoints) ? data.bulletPoints : [],
      additionalNotes: Array.isArray(data.additionalNotes) ? data.additionalNotes : [],
      contactInfo: data.contactInfo || {},
      truncated: text.length >= 60000,
    }
    console.log(`[extract-document] Done: "${result.title}", ${result.sections.length} sections, ${result.bulletPoints.length} points`)
    res.json(result)
  } catch (err) {
    console.error(`[extract-document] Error:`, err.message)
    res.status(500).json({ error: err.message || 'Document extraction failed' })
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {})
  }
})

// ============================================================
// LOGO ENHANCER — rembg (U2-Net) background removal
// Requires python3 + rembg + the u2net model in the image (see
// vps/logo-enhance-deploy/Dockerfile.additions). The app calls this only when
// Sharp's flat-color knockout can't cleanly separate the logo; it falls back
// gracefully if this endpoint or rembg is absent.
// Contract: POST { imageBase64 } -> { pngBase64 } (transparent, bg removed).
// ============================================================
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

// ============================================================
// V3 RENDERER — Remotion (cinematic / infographic). The app POSTs here when the
// admin flag video_engine_v3 is ON. See vps/render-v3-deploy/ for the full
// bundle + Dockerfile (needs the baked remotion/ project + Chrome).
// ============================================================
const REMOTION_DIR = process.env.REMOTION_DIR || '/app/remotion'
const V3_LOOK = 'High-end cinematic corporate photography with a RICH, MOODY, PREMIUM grade — like a polished Apple or Bloomberg commercial. Dramatic but expensive-looking lighting, deep controlled shadows, sophisticated color, shallow depth of field, strong sense of place. Confident and modern, NOT bright flat stock photography and NOT depressing. Specific, editorial, characterful real scenes — avoid generic stock-photo clichés. Stay strictly ON TOPIC for the described subject. AVOID: cheesy stock smiles, candlelit/antique/castle/vintage settings, lone sad figures, anything melancholy or off-story. Photoreal, NOT illustration. 16:9, fills 1920x1080. ABSOLUTELY NO text, words, letters, numbers, charts, or logos.'

// Voice engine: ElevenLabs (Rachel) is PRIMARY; OpenAI TTS-HD is the FALLBACK.
// Either provider being out of quota no longer kills a render — we try the other.
const ELEVEN_API_KEY = process.env.ELEVENLABS_API_KEY
const ELEVEN_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM' // Rachel
const ELEVEN_MODEL = process.env.ELEVENLABS_MODEL || 'eleven_turbo_v2_5'

async function elevenSpeak(text) {
  if (!ELEVEN_API_KEY) throw new Error('ELEVENLABS_API_KEY not set')
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE_ID}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': ELEVEN_API_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: ELEVEN_MODEL, voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 100) throw new Error(`ElevenLabs tiny audio: ${buf.length} bytes`)
  return buf
}

// Normalize text so TTS SPEAKS symbols instead of mangling them. ElevenLabs in
// particular reads a literal "$176,204" badly (voices the "$" or drops it). We
// convert money/percent/common symbols to words BEFORE synthesis so any engine
// says "one hundred seventy-six thousand two hundred four dollars".
function speakable(text) {
  if (!text) return text
  let t = String(text)
  // Money: $1,234  $1.2M  $5K  $176,204.50 → "<spoken number> dollars"
  t = t.replace(/\$\s?([\d,]+(?:\.\d+)?)\s?(k|m|b|thousand|million|billion)?/gi, (_, num, unit) => {
    const n = num.replace(/,/g, '')
    const u = (unit || '').toLowerCase()
    const word = u === 'k' || u === 'thousand' ? ' thousand'
      : u === 'm' || u === 'million' ? ' million'
      : u === 'b' || u === 'billion' ? ' billion' : ''
    // Keep the digits (engines speak grouped numbers fine); just drop the comma
    // noise and append the unit word + "dollars".
    return `${n}${word} dollars`
  })
  // Percent: 94%  3.5 % → "94 percent"
  t = t.replace(/(\d(?:[\d,.]*\d)?)\s?%/g, '$1 percent')
  // Leftover bare symbols that read as garbage.
  t = t.replace(/\$/g, ' dollars ')
  t = t.replace(/\s&\s/g, ' and ')
  t = t.replace(/\s+/g, ' ').trim()
  // Guarantee a sentence-final punctuation + trailing pause so TTS engines
  // (esp. ElevenLabs turbo) don't clip the LAST word — any end-of-clip
  // truncation now eats the trailing silence instead of a real syllable.
  if (t && !/[.!?]$/.test(t)) t += '.'
  return t
}

async function ttsToBuffer(text, voiceId) {
  const spoken = speakable(text) || ' '
  // PRIMARY: ElevenLabs — retry once with backoff before falling back (review
  // B7: parallel scene fan-out can trip the plan's concurrency limit with a
  // transient 429; without the retry each such scene silently ships with the
  // OpenAI fallback voice → ONE video with two alternating narrators).
  if (ELEVEN_API_KEY) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try { return await elevenSpeak(spoken) }
      catch (e) {
        if (attempt === 1) {
          console.warn(`[tts] ElevenLabs attempt 1 failed (${e.message}) — retrying in 1.5s`)
          await new Promise((r) => setTimeout(r, 1500))
        } else {
          console.warn(`[tts] ElevenLabs failed twice, falling back to OpenAI: ${e.message}`)
        }
      }
    }
  }
  // FALLBACK: OpenAI TTS-HD (honors the user's selected voice).
  const OpenAI = require('openai')
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY })
  const resp = await openai.audio.speech.create({
    model: 'tts-1-hd', voice: voiceId || 'nova', input: spoken, response_format: 'mp3', speed: 0.98,
  })
  return Buffer.from(await resp.arrayBuffer())
}

async function v3Tts(text, voiceId, outPath) {
  await writeFile(outPath, await ttsToBuffer(text, voiceId))
  const dur = await probeAudioDuration(outPath)
  // Small 0.4s tail (was 0.9s) so the slide advances soon after the voice stops
  // — the longer tail read as "audio ended but the slide is still up."
  return Math.round(((dur || 3) + 0.4) * 30)
}

// Tiny concurrency limiter. TTS calls in the parallel asset fan-out go through
// a pool of 3 (review B7) so a many-scene video can't blow past ElevenLabs'
// concurrent-request limit; Gemini image calls keep full fan-out (they retry).
function makeLimiter(max) {
  let active = 0
  const queue = []
  const drain = () => { active--; if (queue.length) queue.shift()() }
  return (fn) => new Promise((resolve, reject) => {
    const run = () => { active++; fn().then((v) => { drain(); resolve(v) }, (e) => { drain(); reject(e) }) }
    if (active < max) run(); else queue.push(run)
  })
}
const ttsLimit = makeLimiter(3)

// ONE Remotion render at a time (review B9). Each render spawns Chrome at
// --concurrency=12; two overlapping client renders = 24 tabs on a box that
// crashed at 16. Jobs are already async-ACKed, so queueing is invisible to the
// app — the second job just starts when the first's Chrome fleet exits.
let renderQueueTail = Promise.resolve()
function withRenderSlot(fn) {
  const result = renderQueueTail.then(fn)
  renderQueueTail = result.then(() => {}, () => {}) // keep the chain unbroken on failure
  return result
}

// Minimum on-screen hold so a SHORT narration can't produce a flash-by slide
// (the cover read ~1.5s). Cover gets a longer floor (it's the establishing
// shot); every scene gets a readable minimum. 30fps.
const MIN_SCENE_FR = 60    // 2.0s — lower floor so a short narration doesn't hold a silent slide
const MIN_COVER_FR = 120   // 4.0s — cover is the establishing shot, keep it longer
function floorDuration(frames, isCover) {
  return Math.max(frames || 0, isCover ? MIN_COVER_FR : MIN_SCENE_FR)
}

// Art-direct each scene: ask Gemini-flash to write a SPECIFIC cinematic image
// prompt per scene (subject, setting, lighting, camera) — like a film director.
// This is what made the reference video's imagery good; deriving an image from
// the bare title produces generic/off-story results. Returns string[] aligned to
// scenes. Falls back to per-scene title prompts if the call fails.
async function artDirectScenes(scenes) {
  const fallback = scenes.map((s) => `A real, professional business scene clearly illustrating: "${(s.title || s.narration || 'business concept').slice(0, 160)}".`)
  try {
    const { GoogleGenAI } = require('@google/genai')
    const g = new GoogleGenAI({ apiKey: GEMINI_API_KEY, httpOptions: { timeout: 120000 } })
    const brief = scenes.map((s, i) => `${i}: ${s.title || ''} — ${(s.narration || '').slice(0, 160)}`).join('\n')
    const sys = `You are a cinematographer for a PREMIUM, high-end corporate explainer video with a RICH, MOODY, cinematic look (think Apple/Bloomberg commercial). For each numbered scene, write ONE specific, photographic image prompt describing a real ON-TOPIC business scene: subject, modern setting, dramatic expensive-looking lighting, deep controlled shadows, confident composition, strong sense of place. Sophisticated and modern — NOT bright flat stock photography, NOT cheesy stock smiles, NOT vintage/candlelit/sad. Be specific and editorial to avoid generic-stock clichés. No text/logos in the image. Return ONLY a JSON array of strings, one per scene, same order.`
    const r = await g.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: `${sys}\n\nSCENES:\n${brief}` }] }],
    })
    const text = (r.candidates?.[0]?.content?.parts ?? []).map((p) => p.text || '').join('')
    const arr = JSON.parse(text.slice(text.indexOf('['), text.lastIndexOf(']') + 1))
    if (Array.isArray(arr) && arr.length === scenes.length) return arr.map((x, i) => String(x || fallback[i]))
    return fallback
  } catch { return fallback }
}

/**
 * Grab a poster frame from a rendered video at ~3.2s — past the cold-open
 * (54f = 1.8s) AND the first scene's fade-in (~2.3s), so the still is a fully
 * lit, composed cover instead of the faded title (frame 0).
 *
 * `-ss` goes AFTER `-i` for an ACCURATE seek (decodes to the exact timestamp),
 * not the nearest keyframe before it — a keyframe seek could snap back into the
 * fade. Slower, but it's one frame and correctness matters here. Falls back to
 * an earlier seek, then frame 0, for very short clips.
 */
async function grabPoster(videoFile, outPath, seekSeconds = 3.2) {
  const run = (args) => new Promise((resolve) => execFile('ffmpeg', args, { timeout: 30000 }, (err) => resolve(!err)))
  const grabAt = async (t) => {
    await run(['-y', '-i', videoFile, '-ss', String(t), '-frames:v', '1', '-q:v', '2', outPath])
    try { await readFile(outPath); return true } catch { return false }
  }
  if (await grabAt(seekSeconds)) return       // ideal: clear of all intro fades
  if (await grabAt(1.9)) return               // shorter video: just past cold-open
  await run(['-y', '-i', videoFile, '-frames:v', '1', '-q:v', '2', outPath]) // last resort: frame 0
}

async function v3GeminiBg(prompt, outPath) {
  const { GoogleGenAI } = require('@google/genai')
  const g = new GoogleGenAI({ apiKey: GEMINI_API_KEY, httpOptions: { timeout: 120000 } })
  for (let a = 1; a <= 3; a++) {
    try {
      const r = await g.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: [{ role: 'user', parts: [{ text: `${prompt}\n\n${V3_LOOK}` }] }],
        config: { responseFormat: { image: { aspectRatio: '16:9', imageSize: '2K' } } },
      })
      const img = (r.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData)
      if (!img) throw new Error('no image')
      await writeFile(outPath, Buffer.from(img.inlineData.data, 'base64'))
      return true
    } catch (e) { if (a === 3) throw e; await new Promise((r) => setTimeout(r, 2500 * a)) }
  }
}

// Lighten an accent that's too dark to read on the dark V3 ground. Without this,
// a dark brand color (e.g. navy #1B365D) becomes dark-on-dark and vanishes.
function guardAccentDark(hex) {
  const h = (hex || '').replace('#', '')
  if (h.length < 6) return hex
  let r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  if (lum >= 0.42) return hex // already bright enough
  // Lighten toward white until it reads on the dark ground.
  const amt = 0.55
  r = Math.round(r + (255 - r) * amt); g = Math.round(g + (255 - g) * amt); b = Math.round(b + (255 - b) * amt)
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')
}

function v3Theme(brandAccents) {
  const base = {
    name: 'Modern Fintech', ink: '#070D1A', inkSoft: '#0C1730',
    glass: 'rgba(120,170,255,0.06)', glassEdge: 'rgba(120,170,255,0.22)',
    textPrimary: '#EAF2FF', textMuted: '#8FA6C8',
    accents: ['#3B82F6', '#22D3EE', '#8B5CF6'], mode: 'dark',
  }
  if (Array.isArray(brandAccents) && brandAccents.length) {
    // Contrast-guard each brand accent so dark brand colors stay legible.
    const g0 = guardAccentDark(brandAccents[0]) , g1 = guardAccentDark(brandAccents[1]), g2 = guardAccentDark(brandAccents[2])
    base.accents = [g0 || base.accents[0], g1 || base.accents[1], g2 || base.accents[2]]
    base.glassEdge = (g0 || '#3B82F6') + '47'
  }
  return base
}

app.post('/render-v3', authCheck, async (req, res) => {
  const { videoId, userId, voiceId, theme, brandName, brandAccents, logo, scenes, contactLine, contact, closingValue, musicUrl, musicPrompt, aiMusic, presenter, photoPlacement, frame, industry, recipient } = req.body || {}
  if (!videoId || !Array.isArray(scenes) || scenes.length === 0) {
    return res.status(400).json({ error: 'Missing videoId or scenes' })
  }
  res.json({ success: true })

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false }, realtime: { transport: WebSocket } })
  const setProgress = (pct, detail) => sb.from('videos').update({ progress_pct: pct, progress_detail: detail, progress_updated_at: new Date().toISOString() }).eq('id', videoId).then(() => {}, () => {})

  // Append a scene preview thumbnail so the UI filmstrip fills in as we build.
  // Best-effort: reads current preview_thumbs, appends, writes back.
  const previews = []
  const pushPreview = async (idx, localPath) => {
    try {
      const buf = await readFile(localPath)
      const path = `${userId}/${videoId}_preview_${idx}.png`
      await sb.storage.from('videos').upload(path, buf, { contentType: 'image/png', upsert: true })
      const url = sb.storage.from('videos').getPublicUrl(path).data.publicUrl
      previews.push({ idx, url })
      await sb.from('videos').update({ preview_thumbs: previews, progress_updated_at: new Date().toISOString() }).eq('id', videoId)
    } catch (e) { /* previews are best-effort */ }
  }

  const pub = join(REMOTION_DIR, 'public')
  let outFile = join(REMOTION_DIR, 'out', `${videoId}.mp4`)
  const isInfo = theme === 'infographic'
  // 'aurora' = the fluid look: ONE continuous code-rendered backdrop, NO per-scene
  // Gemini images (cohesive + ~$0). Still the V3Video composition.
  const isAurora = theme === 'aurora'
  const COMP = isInfo ? 'InfographicVideo' : 'V3Video'
  // PER-VIDEO props file (review B2). The old shared v3.json/infographic.json
  // meant two concurrent renders clobbered each other — video A rendered video
  // B's content — and a silent staticFile fetch failure rendered the
  // placeholder defaultProps as a "completed" video. The render now passes
  // --props explicitly (like editorial), so it never depends on that fetch.
  const PROPS = join(pub, `r3-${videoId}-props.json`)

  try {
    await mkdir(pub, { recursive: true })
    await mkdir(join(REMOTION_DIR, 'out'), { recursive: true })
    console.log(`[render-v3 ${videoId}] theme=${theme} comp=${COMP} scenes=${scenes.length}`)
    await sb.from('videos').update({ total_scenes: scenes.length, preview_thumbs: [] }).eq('id', videoId).then(() => {}, () => {})
    await setProgress(25, 'Generating narration...')

    // Infographic theme: ONE ambient background image for the whole video (not
    // per-scene). Heavily darkened behind the data so it adds depth without
    // hurting legibility. Best-effort — no image just means the gradient ground.
    let bgImage
    if (isInfo) {
      try {
        const bgName = `r3-${videoId}-bg.png`
        const topic = (brandName || scenes[0]?.title || industry || 'professional business').toString().slice(0, 120)
        await v3GeminiBg(`An abstract, premium, out-of-focus background suggesting ${topic} — soft dark tones, depth, subtle light. Atmospheric, NOT busy. Will sit DARKENED behind data and charts.`, join(pub, bgName))
        await readFile(join(pub, bgName))
        bgImage = bgName
      } catch (e) { console.error(`[render-v3 ${videoId}] bg image failed: ${e.message}`) }
    }

    // Art-direct all cinematic scenes up front (one Gemini-flash call) so each
    // image gets a bespoke, on-story prompt instead of a generic title prompt.
    // Aurora skips this entirely — it renders on the shared code backdrop, no images.
    const artPrompts = (isInfo || isAurora) ? [] : await artDirectScenes(scenes)

    // Generate the two SLOW per-scene assets — TTS narration and the cinematic
    // Gemini image — for ALL scenes IN PARALLEL up front. These were serial
    // (per-scene AND TTS-then-image within a scene), which was the bulk of the
    // pre-render wall-clock (~16s/image × N scenes, back-to-back). They're
    // independent (per-index filenames), so fan them out and pay ~max not ~sum.
    // The heavy compute stays; only the waiting overlaps. The assembly loop below
    // is unchanged CPU work that reads these pre-computed results.
    // allSettled, NOT all (review B8): with .all, one TTS rejection rejected the
    // fan-out immediately, the catch's cleanup ran, and the still-running sibling
    // promises wrote their files AFTER cleanup — orphaned assets accumulated in
    // public/ forever (slowing every future bundle). Settle everything first,
    // THEN fail if any scene failed. TTS goes through a pool of 3 (review B7).
    const settled = await Promise.allSettled(scenes.map(async (s, i) => {
      const audioName = `r3-${videoId}-${i}.mp3`
      const imgName = `r3-${videoId}-${i}.png`
      const wantImg = !isInfo && !isAurora
      const [durRaw, haveImg] = await Promise.all([
        ttsLimit(() => v3Tts(s.narration || s.title || ' ', voiceId, join(pub, audioName))),
        (async () => {
          if (!wantImg) return false
          const imgPrompt = artPrompts[i] || `A real, professional business scene clearly illustrating: "${(s.title || s.narration || 'business concept').slice(0, 180)}".`
          try { await v3GeminiBg(imgPrompt, join(pub, imgName)); await readFile(join(pub, imgName)); return true }
          catch (imgErr) { console.error(`[render-v3 ${videoId}] scene ${i} image failed: ${imgErr.message}`); return false }
        })(),
      ])
      return { audioName, imgName, durationInFrames: floorDuration(durRaw, i === 0), haveImg }
    }))
    const assetFailure = settled.find((r) => r.status === 'rejected')
    if (assetFailure) throw assetFailure.reason
    const assets = settled.map((r) => r.value)
    // Live filmstrip previews (best-effort, cheap) — after assets exist.
    for (let i = 0; i < assets.length; i++) { if (assets[i].haveImg) await pushPreview(i, join(pub, assets[i].imgName)) }
    await setProgress(70, 'Composing scenes...')

    const outScenes = []
    for (let i = 0; i < scenes.length; i++) {
      const s = scenes[i]
      const { audioName, imgName, durationInFrames, haveImg } = assets[i]
      if (isInfo) {
        outScenes.push({ title: s.title || '', body: s.bullets?.[0], metrics: s.metrics, ...(s.heroMetric && s.heroMetric.value ? { heroMetric: s.heroMetric } : {}), audio: audioName, durationInFrames })
      } else {
        const placement = (i === 0 || i === scenes.length - 1) ? 'center' : ['bottom', 'left', 'right', 'bottom'][i % 4]
        // Cinematic lower-thirds: show ALL the scene's real numbers (up to 3) so
        // important figures aren't dropped — e.g. $176k death benefit AND $10k/yr.
        const isEnd = i === 0 || i === scenes.length - 1
        const isLast = i === scenes.length - 1
        const sceneMetrics = (Array.isArray(s.metrics) ? s.metrics : []).filter((x) => x && x.label && x.value && /\d/.test(x.value)).slice(0, 3)
        // Build PowerPoint-style bullets for middle scenes: each metric becomes a
        // bullet "label: value", plus any text bullets without numbers. This is
        // what triggers the glass-panel layout and shows ALL the numbers.
        const textBullets = (Array.isArray(s.bullets) ? s.bullets : []).slice(0, 2).map((b) => ({ text: String(b) }))
        const metricBullets = sceneMetrics.map((x) => ({ text: x.label, value: x.value }))
        const bullets = !isEnd ? [...metricBullets, ...textBullets].slice(0, 4) : undefined
        // Last scene = branded CLOSING CARD: logo + company + contact + value.
        let closing
        if (isLast) {
          const hasContact = contact && (contact.phone || contact.email || contact.website)
          closing = {
            headline: s.title || 'Thank You',
            cta: s.bullets?.[0] || 'Reach out with any questions — we\'re here to help.',
            ...(closingValue ? { value: closingValue } : {}),
            ...(hasContact ? { contact } : {}),
          }
        }
        // A hero-number scene shows ONE giant figure instead of bullets/metrics.
        const heroMetric = s.heroMetric && s.heroMetric.value ? s.heroMetric : undefined
        outScenes.push({ title: s.title || '', ...(haveImg ? { image: imgName } : {}), audio: audioName, durationInFrames, placement, ...(heroMetric ? { heroMetric } : (bullets && bullets.length ? { bullets } : {})), ...(closing ? { closing } : {}) })
      }
    }

    // Logo variants arrive as REMOTE Supabase URLs, but Remotion's staticFile()
    // resolves LOCAL public/ files only — so download each into public/ and pass
    // the local filename. Best-effort: a failed download just omits that variant.
    let localLogo
    if (logo && (logo.light || logo.dark)) {
      const dl = async (url, name) => {
        if (!url) return undefined
        try {
          const r = await fetch(url, { signal: AbortSignal.timeout(15000) })
          if (!r.ok) return undefined
          await writeFile(join(pub, name), Buffer.from(await r.arrayBuffer()))
          return name
        } catch { return undefined }
      }
      const light = await dl(logo.light, `r3-${videoId}-logo-light.png`)
      const dark = await dl(logo.dark, `r3-${videoId}-logo-dark.png`)
      if (light || dark) localLogo = { light, dark }
    }

    // Presenter (Person profile): download the headshot into public/ (same reason
    // as the logo) and decide cover/closing placement. 'auto' → cinematic shows
    // the photo on both the cover and the closing card.
    let localPresenter, presenterOnCover = false, presenterOnClosing = false
    if (presenter && (presenter.name || presenter.photo)) {
      let photoName
      if (presenter.photo) {
        try {
          const r = await fetch(presenter.photo, { signal: AbortSignal.timeout(15000) })
          if (r.ok) { photoName = `r3-${videoId}-presenter.png`; await writeFile(join(pub, photoName), Buffer.from(await r.arrayBuffer())) }
        } catch { /* no photo → name/role still render */ }
      }
      localPresenter = { name: presenter.name || undefined, role: presenter.role || undefined, ...(photoName ? { photo: photoName } : {}) }
      const pref = photoPlacement || 'auto'
      if (pref === 'none') { presenterOnCover = false; presenterOnClosing = false }
      else if (pref === 'cover') { presenterOnCover = true }
      else if (pref === 'closing') { presenterOnClosing = true }
      else if (pref === 'both') { presenterOnCover = true; presenterOnClosing = true }
      else { presenterOnCover = true; presenterOnClosing = true } // auto → cinematic: both
      // Only show the photo where one exists.
      if (!photoName) { presenterOnCover = false; presenterOnClosing = false }
    }

    const props = {
      theme: v3Theme(brandAccents),
      brandName: brandName || undefined,
      ...(recipient ? { recipient } : {}),   // "Prepared for {client}" on the cover
      ...(frame ? { frame } : {}),
      ...(isAurora ? { look: 'aurora' } : {}),
      ...(localLogo ? { logo: localLogo, logoChip: !!logo.chip } : {}),
      ...(localPresenter ? { presenter: localPresenter, presenterOnCover, presenterOnClosing } : {}),
      ...(bgImage ? { bgImage } : {}),
      scenes: outScenes,
    }
    await writeFile(PROPS, JSON.stringify(props))
    await setProgress(72, 'Rendering video...')

    // Stream Remotion's frame progress so the bar moves during the long render
    // (otherwise it parks at 72% for minutes). Map rendered-frames -> 72..89%.
    // withRenderSlot: ONE render's Chrome fleet at a time (review B9).
    await withRenderSlot(() => new Promise((resolve, reject) => {
      const { spawn } = require('child_process')
      // --concurrency=12: ONE Chrome tab per worker. --concurrency=100% on the
      // 16-core box opened 16 tabs and crashed Chrome mid-render (WebSocket died /
      // exit 1) — too many concurrent browsers for the box's /dev/shm + RAM. 8 is
      // still fast on 16 cores and stays well within memory.
      // --props: pass the per-video props explicitly (review B2) — never rely on
      // the composition's staticFile fetch, which can silently fall back to the
      // "Run the generator first" placeholder defaultProps.
      // --gl=swiftshader is the reliable headless GL backend in Docker;
      // --image-format=jpeg speeds frame capture with no visible loss;
      // --disable-web-security avoids cross-origin asset stalls.
      const child = spawn('npx', ['remotion', 'render', COMP, outFile, `--props=${PROPS}`,
        '--log=info', '--concurrency=12', '--gl=swiftshader', '--image-format=jpeg'],
        { cwd: REMOTION_DIR, env: { ...process.env } })
      let stderrBuf = ''
      let lastPct = 72, lastWrite = 0
      const onChunk = (buf) => {
        const text = buf.toString()
        stderrBuf = (stderrBuf + text).slice(-2000)
        // Remotion prints "Rendered frames 1840/3527" (and an Encoding phase).
        const m = [...text.matchAll(/(\d+)\s*\/\s*(\d+)/g)].pop()
        if (m) {
          const done = parseInt(m[1], 10), total = parseInt(m[2], 10)
          if (total > 0 && done <= total) {
            const pct = 72 + Math.round((done / total) * 17) // 72 -> 89
            const now = Date.now()
            if (pct > lastPct && now - lastWrite > 1500) { // throttle DB writes
              lastPct = pct; lastWrite = now
              setProgress(pct, `Rendering — frame ${done.toLocaleString()} of ${total.toLocaleString()}`)
            }
          }
        }
      }
      child.stdout.on('data', onChunk)
      child.stderr.on('data', onChunk)
      // 60 min: a long video (9+ scenes / 16k+ frames) renders CPU-bound and was
      // hitting the old 30-min cap at ~85% (frame 13.6k/16k). Give it room.
      const killTimer = setTimeout(() => { try { child.kill('SIGKILL') } catch {} ; reject(new Error('remotion render: timeout (>60min)')) }, 60 * 60 * 1000)
      child.on('error', (e) => { clearTimeout(killTimer); reject(new Error(`remotion render: ${e.message}`)) })
      child.on('close', (code) => {
        clearTimeout(killTimer)
        code === 0 ? resolve() : reject(new Error(`remotion render exit ${code}: ${stderrBuf.slice(-300)}`))
      })
    }))

    // Background music (item 3): get a music file (provided URL or Lyria-gen),
    // then ffmpeg-mix it UNDER the narration at low volume. Best-effort — on any
    // failure we keep the music-less render rather than failing the whole video.
    if (musicUrl || aiMusic || musicPrompt) {
      try {
        await setProgress(88, 'Adding music...')
        const musicPath = join(REMOTION_DIR, 'out', `${videoId}-music.mp3`)
        let haveMusic = false
        if (musicUrl) {
          const mr = await fetch(musicUrl, { signal: AbortSignal.timeout(30000), redirect: 'follow' })
          if (mr.ok) { await writeFile(musicPath, Buffer.from(await mr.arrayBuffer())); haveMusic = true }
        } else {
          // Lyria generate — EXACT same model + call shape as the /generate
          // pipeline (lyria-3-pro-preview, contents as a string). The earlier
          // 'models/lyria-002' id was wrong → silent failure → no music.
          const { GoogleGenAI } = require('@google/genai')
          const g = new GoogleGenAI({ apiKey: GEMINI_API_KEY, httpOptions: { timeout: 120000 } })
          const mPrompt = musicPrompt || 'Create background music. Instrumental only, no vocals. Upbeat, polished, modern corporate presentation music — piano, light synth, soft percussion. Fade out at the end.'
          console.log(`[render-v3 ${videoId}] generating music (lyria-3-pro-preview)...`)
          const mr = await g.models.generateContent({ model: 'lyria-3-pro-preview', contents: mPrompt }).catch((e) => { console.error(`[render-v3 ${videoId}] lyria error: ${e.message}`); return null })
          const parts = mr ? (mr.candidates?.[0]?.content?.parts ?? []) : []
          const part = parts.find((p) => p.inlineData && (p.inlineData.mimeType?.includes('audio') || p.inlineData.mimeType?.includes('mpeg')))
          if (part) { await writeFile(musicPath, Buffer.from(part.inlineData.data, 'base64')); haveMusic = true; console.log(`[render-v3 ${videoId}] music generated`) }
          else console.warn(`[render-v3 ${videoId}] lyria returned no audio (${parts.length} parts)`)
        }
        if (haveMusic) {
          const mixedPath = join(REMOTION_DIR, 'out', `${videoId}-mixed.mp4`)
          await new Promise((resolve, reject) => {
            execFile('ffmpeg', ['-y', '-i', outFile, '-stream_loop', '-1', '-i', musicPath,
              '-filter_complex', '[0:a]volume=1.0[narr];[1:a]volume=0.024,afade=t=in:st=0:d=2[bg];[narr][bg]amix=inputs=2:duration=first:dropout_transition=3[a]',
              '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', mixedPath],
              { timeout: 120000 }, (e) => e ? reject(e) : resolve())
          })
          await rm(outFile, { force: true }).catch(() => {})
          outFile = mixedPath
          console.log(`[render-v3 ${videoId}] music mixed`)
        }
      } catch (e) { console.error(`[render-v3 ${videoId}] music skipped: ${e.message}`) }
    }

    await setProgress(90, 'Uploading...')
    const videoBuffer = await readFile(outFile)
    const videoStoragePath = `${userId}/${videoId}.mp4`
    await sb.storage.from('videos').upload(videoStoragePath, videoBuffer, { contentType: 'video/mp4', upsert: true })
    const { data: urlData } = sb.storage.from('videos').getPublicUrl(videoStoragePath)

    // Poster/thumbnail: grab a frame ~2.5s IN, past the cold-open fade-from-black,
    // so the poster is a fully-composed cover (not the half-faded title). Fall
    // back to frame 0 if the seek lands past a very short video's end.
    const thumbPath = join(REMOTION_DIR, 'out', `${videoId}-thumb.png`)
    await grabPoster(outFile, thumbPath)
    let thumbUrl = null
    try {
      const tb = await readFile(thumbPath)
      await sb.storage.from('videos').upload(`${userId}/${videoId}_thumb.png`, tb, { contentType: 'image/png', upsert: true })
      thumbUrl = sb.storage.from('videos').getPublicUrl(`${userId}/${videoId}_thumb.png`).data.publicUrl
    } catch { /* thumbnail best-effort */ }

    // Populate the SLIDES panel so viewers can jump to sections: per-scene
    // thumbnail (preview), duration (for seek timestamps), and a chapter label.
    const slideUrls = outScenes.map((_, i) => previews.find((p) => p.idx === i)?.url).filter(Boolean)
    const slideDurations = outScenes.map((s) => Math.round((s.durationInFrames || 0) / 30 * 10) / 10)
    // Labels come from the script (titles) the UI already reads — store them on
    // the script too so the panel shows chapter names per thumbnail.
    const scriptForPanel = outScenes.map((s) => ({ title: s.title || '', headline: s.title || '' }))
    await sb.from('videos').update({
      status: 'completed', video_url: urlData.publicUrl,
      ...(thumbUrl ? { thumbnail_url: thumbUrl } : {}),
      ...(slideUrls.length ? { slide_urls: slideUrls } : {}),
      slide_durations: slideDurations, script: scriptForPanel,
      progress_pct: 100, progress_detail: null, progress_updated_at: new Date().toISOString(),
    }).eq('id', videoId)
    console.log(`[render-v3 ${videoId}] DONE -> ${urlData.publicUrl}`)
  } catch (err) {
    console.error(`[render-v3 ${videoId}] error:`, err.message)
    reportError({ source: 'render-v3', videoId, userId, stage: theme, message: err.message }).catch(() => {})
    // User sees the friendly line (error_message); admins get the REAL cause in
    // progress_detail (existing column, no migration) so failures are diagnosable
    // without SSH. reportError() above also pushes it to error_logs.
    await sb.from('videos').update({ status: 'failed', error_message: 'Video rendering failed. Your credits were refunded.', progress_detail: `[fail] render-v3: ${err.message}`.slice(0, 500) }).eq('id', videoId).then(() => {}, () => {})
  } finally {
    try {
      const { readdir, unlink } = require('fs/promises')
      for (const f of await readdir(pub)) if (f.startsWith(`r3-${videoId}-`)) await unlink(join(pub, f)).catch(() => {})
      await rm(outFile, { force: true }).catch(() => {})
    } catch { /* cleanup best-effort */ }
  }
})

// ============================================================
// COMMERCIAL PIPELINE — /render-commercial. Renders a PARAMETERIZED commercial
// template (e.g. TemplateFintech) from a props payload, mirroring /render-v3:
// authCheck → async ack → stage per-video assets into public/ → write props →
// withRenderSlot(spawn remotion --props) → upload mp4 → mark completed.
//
// Payload: {
//   videoId, userId, template: 'TemplateFintech',
//   props: {...},                    // the composition props (matches the schema)
//   assets: { 'sub/path.png': 'https://...' },  // files to stage into public/<assetDir>/
// }
// The props.assetDir names the per-video public subfolder the template reads from.
// ============================================================
app.post('/render-commercial', authCheck, async (req, res) => {
  const { videoId, userId, template, props, assets } = req.body || {}
  const COMPS = new Set(['TemplateFintech', 'TemplateCommercial'])   // allow-list of parameterized templates
  if (!videoId || !template || !COMPS.has(template) || !props || !props.assetDir) {
    return res.status(400).json({ error: 'Missing/invalid videoId, template, props, or props.assetDir' })
  }
  res.json({ success: true })

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false }, realtime: { transport: WebSocket } })
  const setProgress = (pct, detail) => sb.from('videos').update({ progress_pct: pct, progress_detail: detail, progress_updated_at: new Date().toISOString() }).eq('id', videoId).then(() => {}, () => {})

  const pub = join(REMOTION_DIR, 'public')
  const assetDir = join(pub, props.assetDir)     // per-video subfolder (props.assetDir should be unique, e.g. `c-${videoId}`)
  const PROPS = join(pub, `commercial-${videoId}-props.json`)
  let outFile = join(REMOTION_DIR, 'out', `${videoId}.mp4`)

  try {
    await mkdir(assetDir, { recursive: true })
    await mkdir(join(REMOTION_DIR, 'out'), { recursive: true })
    console.log(`[render-commercial ${videoId}] template=${template} assetDir=${props.assetDir}`)
    await setProgress(20, 'Staging assets...')

    // stage each asset URL into public/<assetDir>/<subpath> (parallel, best-effort)
    const entries = Object.entries(assets || {})
    await Promise.all(entries.map(async ([sub, url]) => {
      const dest = join(assetDir, sub)
      await mkdir(dirname(dest), { recursive: true })
      const r = await fetch(url, { signal: AbortSignal.timeout(60000) })
      if (!r.ok) throw new Error(`asset fetch ${sub}: ${r.status}`)
      await writeFile(dest, Buffer.from(await r.arrayBuffer()))
    }))
    console.log(`[render-commercial ${videoId}] staged ${entries.length} assets`)

    await writeFile(PROPS, JSON.stringify(props))
    await setProgress(60, 'Rendering commercial...')

    await withRenderSlot(() => new Promise((resolve, reject) => {
      const { spawn } = require('child_process')
      const child = spawn('npx', ['remotion', 'render', template, outFile, `--props=${PROPS}`,
        '--log=info', '--concurrency=12', '--gl=swiftshader', '--image-format=jpeg'],
        { cwd: REMOTION_DIR, env: { ...process.env } })
      let stderrBuf = '', lastPct = 60, lastWrite = 0
      const onChunk = (buf) => {
        const text = buf.toString(); stderrBuf = (stderrBuf + text).slice(-2000)
        const m = [...text.matchAll(/(\d+)\s*\/\s*(\d+)/g)].pop()
        if (m) { const done = +m[1], total = +m[2]
          if (total > 0 && done <= total) { const pct = 60 + Math.round((done / total) * 30); const now = Date.now()
            if (pct > lastPct && now - lastWrite > 1500) { lastPct = pct; lastWrite = now; setProgress(pct, `Rendering — frame ${done.toLocaleString()} of ${total.toLocaleString()}`) } } }
      }
      child.stdout.on('data', onChunk); child.stderr.on('data', onChunk)
      child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`remotion exit ${code}: ${stderrBuf.slice(-400)}`)))
      child.on('error', reject)
    }))

    await setProgress(92, 'Uploading...')
    const videoBuffer = await readFile(outFile)
    const videoStoragePath = `${userId}/${videoId}.mp4`
    await sb.storage.from('videos').upload(videoStoragePath, videoBuffer, { contentType: 'video/mp4', upsert: true })
    const { data: urlData } = sb.storage.from('videos').getPublicUrl(videoStoragePath)

    const thumbPath = join(REMOTION_DIR, 'out', `${videoId}-thumb.png`)
    await grabPoster(outFile, thumbPath)
    let thumbUrl = null
    try { const tb = await readFile(thumbPath); await sb.storage.from('videos').upload(`${userId}/${videoId}_thumb.png`, tb, { contentType: 'image/png', upsert: true }); thumbUrl = sb.storage.from('videos').getPublicUrl(`${userId}/${videoId}_thumb.png`).data.publicUrl } catch {}

    await sb.from('videos').update({
      status: 'completed', video_url: urlData.publicUrl,
      ...(thumbUrl ? { thumbnail_url: thumbUrl } : {}),
      progress_pct: 100, progress_detail: null, progress_updated_at: new Date().toISOString(),
    }).eq('id', videoId)
    console.log(`[render-commercial ${videoId}] DONE -> ${urlData.publicUrl}`)
  } catch (err) {
    console.error(`[render-commercial ${videoId}] error:`, err.message)
    reportError({ source: 'render-commercial', videoId, userId, stage: template, message: err.message }).catch(() => {})
    await sb.from('videos').update({ status: 'failed', error_message: 'Commercial rendering failed. Your credits were refunded.', progress_detail: `[fail] render-commercial: ${err.message}`.slice(0, 500) }).eq('id', videoId).then(() => {}, () => {})
  } finally {
    try {
      const { rm: rmDir } = require('fs/promises')
      await rmDir(assetDir, { recursive: true, force: true }).catch(() => {})
      await rm(PROPS, { force: true }).catch(() => {})
      await rm(outFile, { force: true }).catch(() => {})
    } catch {}
  }
})

// ============================================================
// COMMERCIAL PIPELINE — /generate-commercial. URL (or text) → a fully-produced,
// brand-matched ~30-40s commercial. The FULL director runs on the VPS (which has
// ANTHROPIC_API_KEY, ElevenLabs, image gen): comprehend → DIRECT (styleId+beats)
// → per-beat VO + literal hero images → props JSON → render TemplateCommercial →
// upload. Vercel just triggers this. Reuses vps/commercial.js (ports
// scripts/director/make-commercial.ts). Requires ANTHROPIC_API_KEY on the VPS.
// ============================================================
const { generateCommercial } = require('./commercial')

app.post('/generate-commercial', authCheck, async (req, res) => {
  const { videoId, userId, url, text, brandName, music, style, musicUrl, logoUrl, goal, prospectId } = req.body || {}
  if (!videoId) return res.status(400).json({ error: 'Missing videoId' })
  if (!url && !text) return res.status(400).json({ error: 'Provide url or text' })
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured on VPS' })
  res.json({ success: true })

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false }, realtime: { transport: WebSocket } })
  // When invoked by the admin prospect pipeline, mirror progress + result into
  // the prospect_demos row too (the admin dashboard polls that table). The video
  // itself is still produced identically; this is a side-channel status mirror.
  const mirrorProspect = (fields) => prospectId
    ? sb.from('prospect_demos').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', prospectId).then(() => {}, () => {})
    : Promise.resolve()
  const setProgress = (pct, detail) => {
    mirrorProspect({ status: 'generating', progress_pct: pct, stage_detail: detail })
    return sb.from('videos').update({ progress_pct: pct, progress_detail: detail, progress_updated_at: new Date().toISOString() }).eq('id', videoId).then(() => {}, () => {})
  }
  const pub = join(REMOTION_DIR, 'public')
  let outFile = join(REMOTION_DIR, 'out', `${videoId}.mp4`)
  const staged = []
  let assetDirAbs = null, propsPath = null

  await withRenderSlot(async () => {
    try {
      await mkdir(pub, { recursive: true }); await mkdir(join(REMOTION_DIR, 'out'), { recursive: true })
      await setProgress(8, 'Studying the brand...')

      // BACKDROP IMAGE PROVIDER: prefer Cloudflare FLUX (fast, free), fall back to
      // Gemini. A failure just means that shot beat renders without a hero image.
      const { cloudflareImage: cfImg, cloudflareAvailable: cfAvail } = require('./slides')
      const imageGen = cfAvail()
        ? async (prompt, outPath) => { try { return await cfImg(prompt, outPath) } catch { return await v3GeminiBg(prompt, outPath) } }
        : (prompt, outPath) => v3GeminiBg(prompt, outPath)

      const deps = {
        geminiImage: imageGen,
        tts: (fn) => ttsLimit(fn),
        // MUSIC FALLBACK ONLY (primary is ElevenLabs Music in commercial.js).
        // If that API fails, prefer a caller-provided track, else write a short
        // SILENT mp3 so the file exists and the render never dies — we retry
        // rather than ship a generic bed on a paid commercial.
        stageMusic: async (_mood, outPath) => {
          if (musicUrl) { try { const r = await fetch(musicUrl, { signal: AbortSignal.timeout(45000) }); if (r.ok) { await writeFile(outPath, Buffer.from(await r.arrayBuffer())); return } } catch {} }
          await new Promise((resolve, reject) => execFile('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-t', '5', '-q:a', '9', outPath], { timeout: 30000 }, (e) => e ? reject(e) : resolve()))
        },
      }

      const { props, propsPath: pp, assetDir, assetNames, styleId, totalSec } = await generateCommercial({
        pub, url, text, brandName, music, forceStyle: style, logoUrl, goal, videoId, deps, log: (m) => setProgress(35, m),
      })
      // resolved company name for the prospect mirror (director's brand > caller > hostname)
      const resolvedCompany = (props.brand && props.brand.name) || brandName ||
        (url ? (() => { try { return new URL(url).hostname.replace(/^www\./, '') } catch { return null } })() : null)
      propsPath = pp
      assetDirAbs = join(pub, assetDir)
      staged.push(propsPath, ...assetNames.map((n) => join(assetDirAbs, n)))
      console.log(`[generate-commercial ${videoId}] style=${styleId} beats=${props.beats.length} ~${totalSec.toFixed(1)}s`)

      await setProgress(58, 'Rendering commercial...')
      await new Promise((resolve, reject) => {
        const { spawn } = require('child_process')
        const child = spawn('npx', ['remotion', 'render', 'TemplateCommercial', outFile, `--props=${propsPath}`, '--log=info', '--concurrency=12', '--gl=swiftshader', '--image-format=jpeg'], { cwd: REMOTION_DIR, env: { ...process.env } })
        let stderrBuf = '', lastPct = 58, lastWrite = 0
        const onChunk = (buf) => { const t = buf.toString(); stderrBuf = (stderrBuf + t).slice(-2000); const m = [...t.matchAll(/(\d+)\s*\/\s*(\d+)/g)].pop(); if (m) { const done = parseInt(m[1], 10), total = parseInt(m[2], 10); if (total > 0 && done <= total) { const pct = 58 + Math.round((done / total) * 32); const now = Date.now(); if (pct > lastPct && now - lastWrite > 1500) { lastPct = pct; lastWrite = now; setProgress(pct, `Rendering — frame ${done.toLocaleString()} of ${total.toLocaleString()}`) } } } }
        child.stdout.on('data', onChunk); child.stderr.on('data', onChunk)
        const killTimer = setTimeout(() => { try { child.kill('SIGKILL') } catch {}; reject(new Error('render timeout (>60min)')) }, 60 * 60 * 1000)
        child.on('error', (e) => { clearTimeout(killTimer); reject(new Error(`render: ${e.message}`)) })
        child.on('close', (code) => { clearTimeout(killTimer); code === 0 ? resolve() : reject(new Error(`render exit ${code}: ${stderrBuf.slice(-300)}`)) })
      })

      // ---- QA GATE: per-frame flash/flicker scan on the rendered mp4 (catches
      // the motion bug that stills miss — a transition blowing the frame to a
      // solid color, e.g. a 44→249 white flash). ROLLOUT: detect + LOG only (a
      // brand-new gate shouldn't kill real videos on false positives). Flip
      // HARD_BLOCK_FLASH once trusted.
      const HARD_BLOCK_FLASH = false
      try {
        const flashN = await new Promise((resolve) => {
          const { execFile } = require('child_process')
          execFile('ffmpeg', ['-loglevel', 'error', '-i', outFile, '-vf', 'signalstats,metadata=print:file=-', '-f', 'null', '-'], { maxBuffer: 1 << 28, timeout: 120000 }, (err, stdout) => {
            const out = (stdout || (err && err.stdout) || '').toString()
            const ys = [...out.matchAll(/lavfi\.signalstats\.YAVG=([\d.]+)/g)].map((m) => parseFloat(m[1]))
            if (ys.length < 10) return resolve(-1)
            // A real flash REVERSES (flicker) or blows near-white — a clean hard
            // CUT between a dark and bright scene that STAYS bright is not a flash
            // (avoid false-positives; BCBS: 17→78 stayed 78 = a cut).
            const SPIKE = 22, HARD = 60, NEAR_WHITE = 205, WIN = 8, RET = 0.55
            let n = 0
            for (let i = 1; i < ys.length - 1; i++) {
              const dp = ys[i] - ys[i - 1], dn = ys[i] - ys[i + 1]
              if (Math.abs(dp) > SPIKE && Math.abs(dn) > SPIKE && Math.sign(dp) === Math.sign(dn)) { n++; continue }
              if (Math.abs(dp) > HARD) {
                const from = ys[i - 1], to = ys[i]; let rev = false
                for (let j = i + 1; j <= Math.min(ys.length - 1, i + WIN); j++) { if (Math.abs(ys[j] - from) < Math.abs(to - from) * (1 - RET)) { rev = true; break } }
                if (rev || to >= NEAR_WHITE) n++
              }
            }
            resolve(n)
          })
        })
        if (flashN > 0) {
          console.warn(`[generate-commercial ${videoId}] QA: ${flashN} flash/flicker event(s) in the render`)
          if (HARD_BLOCK_FLASH) throw new Error(`QA gate: ${flashN} flash/flicker event(s) — video withheld`)
        } else if (flashN === 0) console.log(`[generate-commercial ${videoId}] QA: flash scan clean`)
      } catch (qaErr) {
        if (HARD_BLOCK_FLASH) throw qaErr
        console.warn(`[generate-commercial ${videoId}] QA scan error (non-blocking): ${qaErr.message}`)
      }

      await setProgress(92, 'Uploading...')
      const videoBuffer = await readFile(outFile)
      await sb.storage.from('videos').upload(`${userId}/${videoId}.mp4`, videoBuffer, { contentType: 'video/mp4', upsert: true })
      const { data: urlData } = sb.storage.from('videos').getPublicUrl(`${userId}/${videoId}.mp4`)

      const thumbPath = join(REMOTION_DIR, 'out', `${videoId}-thumb.png`)
      await grabPoster(outFile, thumbPath)
      let thumbUrl = null
      try { const tb = await readFile(thumbPath); await sb.storage.from('videos').upload(`${userId}/${videoId}_thumb.png`, tb, { contentType: 'image/png', upsert: true }); thumbUrl = sb.storage.from('videos').getPublicUrl(`${userId}/${videoId}_thumb.png`).data.publicUrl } catch {}
      await rm(thumbPath, { force: true }).catch(() => {})

      await sb.from('videos').update({
        status: 'completed', video_url: urlData.publicUrl,
        ...(thumbUrl ? { thumbnail_url: thumbUrl } : {}),
        progress_pct: 100, progress_detail: null, progress_updated_at: new Date().toISOString(),
      }).eq('id', videoId)
      // Mirror the finished result into prospect_demos → 'ready_for_review' (the
      // status the admin dashboard shows before an admin sends it to the lead).
      await mirrorProspect({
        status: 'ready_for_review', progress_pct: 100, stage_detail: 'Ready for review',
        video_url: urlData.publicUrl, ...(thumbUrl ? { thumbnail_url: thumbUrl } : {}),
        ...(resolvedCompany ? { company_name: resolvedCompany } : {}),
        duration: Math.round(totalSec || 0),
      })
      console.log(`[generate-commercial ${videoId}] DONE -> ${urlData.publicUrl}`)
    } catch (err) {
      console.error(`[generate-commercial ${videoId}] error:`, err.message)
      reportError({ source: 'generate-commercial', videoId, userId, stage: 'commercial', message: err.message }).catch(() => {})
      await sb.from('videos').update({ status: 'failed', error_message: 'Commercial generation failed. Your credits were refunded.', progress_detail: `[fail] generate-commercial: ${err.message}`.slice(0, 500) }).eq('id', videoId).then(() => {}, () => {})
      await mirrorProspect({ status: 'failed', stage_detail: 'Generation failed', error_message: err.message.slice(0, 500) })
    } finally {
      for (const f of staged) await rm(f, { force: true }).catch(() => {})
      if (assetDirAbs) { try { const { rm: rmDir } = require('fs/promises'); await rmDir(assetDirAbs, { recursive: true, force: true }).catch(() => {}) } catch {} }
      await rm(outFile, { force: true }).catch(() => {})
    }
  })
})

// ============================================================
// SLIDE PIPELINE — /generate-slides. The FULL slide-deck pipeline on the VPS:
// read source (doc via pdftotext/libreoffice, text direct — URL crawl TODO once
// Playwright is in the image) → comprehend + write + word-timed VO + backdrops
// (vps/slides.js) → render DirectedVideo → upload. Vercel just triggers this.
// Requires ANTHROPIC_API_KEY on the VPS.
// ============================================================
const { generateSlidePlan } = require('./slides')

// read a document's text using the same tools as /extract-document.
async function readDocText(fileBase64, fileName) {
  const workDir = join(tmpdir(), `d2v-slides-${randomUUID()}`)
  await mkdir(workDir, { recursive: true })
  const ext = (fileName.split('.').pop() || '').toLowerCase()
  const inputPath = join(workDir, `input.${ext || 'bin'}`)
  await writeFile(inputPath, Buffer.from(fileBase64, 'base64'))
  if (ext === 'txt' || ext === 'csv') return (await readFile(inputPath, 'utf-8')).slice(0, 120000)
  let pdfPath = inputPath
  if (ext !== 'pdf') {
    await new Promise((resolve, reject) => execFile('libreoffice', ['--headless', '--convert-to', 'pdf', '--outdir', workDir, inputPath], { timeout: 120000 }, (err) => err ? reject(new Error('Could not convert this file type.')) : resolve()))
    pdfPath = join(workDir, 'input.pdf')
  }
  const txtPath = join(workDir, 'out.txt')
  await new Promise((resolve, reject) => execFile('pdftotext', ['-layout', pdfPath, txtPath], { timeout: 60000 }, (err) => err ? reject(new Error('Could not read text from this document.')) : resolve()))
  return (await readFile(txtPath, 'utf-8')).slice(0, 120000)
}

app.post('/generate-slides', authCheck, async (req, res) => {
  const { videoId, userId, fileBase64, fileName, text, url, preparer, recipient, music, glass, footer, accent, logoUrl, musicUrl, presenter, photoPlacement, photos, brief } = req.body || {}
  if (!videoId) return res.status(400).json({ error: 'Missing videoId' })
  if (!fileBase64 && !text && !url) return res.status(400).json({ error: 'Provide fileBase64, text, or url' })
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured on VPS' })
  res.json({ success: true })

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false }, realtime: { transport: WebSocket } })
  const setProgress = (pct, detail) => sb.from('videos').update({ progress_pct: pct, progress_detail: detail, progress_updated_at: new Date().toISOString() }).eq('id', videoId).then(() => {}, () => {})
  const pub = join(REMOTION_DIR, 'public')
  let outFile = join(REMOTION_DIR, 'out', `${videoId}.mp4`)
  const PROPS = join(pub, `dv-${videoId}-props.json`)
  const staged = []

  await withRenderSlot(async () => {
    try {
      await mkdir(pub, { recursive: true }); await mkdir(join(REMOTION_DIR, 'out'), { recursive: true })
      await setProgress(10, 'Reading source...')
      // 1) get source text
      let source
      if (url) {
        // URL crawl needs Playwright/Chrome-navigation — not wired yet on the VPS.
        throw new Error('URL sources not yet supported on the VPS (Playwright pending); use a document or pasted text.')
      } else if (fileBase64) {
        source = { kind: 'pdf', text: await readDocText(fileBase64, fileName || 'input.pdf') }
      } else {
        source = { kind: 'text', text: String(text).slice(0, 120000) }
      }
      if (!source.text || source.text.trim().length < 60) throw new Error('Not enough readable text in the source.')

      // stage logo if provided (so the plan can reference brand-logo.png)
      if (logoUrl) { try { const r = await fetch(logoUrl, { signal: AbortSignal.timeout(30000) }); if (r.ok) { const p = join(pub, 'brand-logo.png'); await writeFile(p, Buffer.from(await r.arrayBuffer())); staged.push(p) } } catch {} }
      // stage presenter headshot if provided → brand-presenter.png (real agent photo)
      let presenterForPlan = null
      if (presenter && (presenter.photoUrl || presenter.photo) && (presenter.photoUrl || presenter.photo).startsWith('http')) {
        try { const r = await fetch(presenter.photoUrl || presenter.photo, { signal: AbortSignal.timeout(30000) }); if (r.ok) { const p = join(pub, 'brand-presenter.png'); await writeFile(p, Buffer.from(await r.arrayBuffer())); staged.push(p); presenterForPlan = { name: presenter.name, role: presenter.role, photo: 'brand-presenter.png' } } } catch {}
      }

      await setProgress(20, 'Understanding your document...')
      // 2) generate plan + assets via the ported pipeline.
      // BACKDROP IMAGE PROVIDER: prefer Cloudflare FLUX (fast ~2s, free tier,
      // reliable) when configured; fall back to Gemini. Either way, a failure is
      // caught upstream → the scene uses the animated background (never crashes).
      const { cloudflareImage, cloudflareAvailable } = require('./slides')
      const imageGen = cloudflareAvailable()
        ? async (prompt, outPath) => { try { return await cloudflareImage(prompt, outPath) } catch (e) { return await v3GeminiBg(prompt, outPath) } }
        : (prompt, outPath) => v3GeminiBg(prompt, outPath)
      const deps = {
        geminiImage: imageGen,
        tts: (fn) => ttsLimit(fn),
        // ALWAYS produce dir-music.mp3 — the renderer's beat grid uses
        // useAudioData(dir-music.mp3) and a missing file cancels the render.
        // Use the provided track if any, else synthesize a short SILENT mp3 so
        // the file exists (useBeats handles a silent/empty track gracefully).
        stageMusic: async (_mood, outPath) => {
          if (musicUrl) {
            try { const r = await fetch(musicUrl, { signal: AbortSignal.timeout(45000) }); if (r.ok) { await writeFile(outPath, Buffer.from(await r.arrayBuffer())); return } } catch {}
          }
          // silent fallback (ffmpeg is on the box): 5s of quiet, looped by the renderer.
          await new Promise((resolve, reject) => execFile('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-t', '5', '-q:a', '9', outPath], { timeout: 30000 }, (e) => e ? reject(e) : resolve()))
        },
      }
      const { plan, assetNames, sceneMeta } = await generateSlidePlan({
        pub, source, preparer: preparer || 'docs2video', recipient, music, glass, footer, forcedAccent: accent,
        shots: [], presenter: presenterForPlan, photoPlacement, photos: !!photos, brief, deps, log: (m) => setProgress(40, m),
      })
      staged.push(...assetNames.map((n) => join(pub, n)))
      await writeFile(PROPS, JSON.stringify({ plan })); staged.push(PROPS)

      await setProgress(55, 'Rendering slides...')
      await new Promise((resolve, reject) => {
        const { spawn } = require('child_process')
        const child = spawn('npx', ['remotion', 'render', 'DirectedVideo', outFile, `--props=${PROPS}`, '--log=info', '--concurrency=8', '--gl=swiftshader', '--image-format=jpeg'], { cwd: REMOTION_DIR, env: { ...process.env } })
        let stderrBuf = '', lastPct = 55, lastWrite = 0
        const onChunk = (buf) => { const t = buf.toString(); stderrBuf = (stderrBuf + t).slice(-2000); const m = [...t.matchAll(/(\d+)\s*\/\s*(\d+)/g)].pop(); if (m) { const done = parseInt(m[1], 10), total = parseInt(m[2], 10); if (total > 0 && done <= total) { const pct = 55 + Math.round((done / total) * 34); const now = Date.now(); if (pct > lastPct && now - lastWrite > 1500) { lastPct = pct; lastWrite = now; setProgress(pct, `Rendering — frame ${done.toLocaleString()} of ${total.toLocaleString()}`) } } } }
        child.stdout.on('data', onChunk); child.stderr.on('data', onChunk)
        const killTimer = setTimeout(() => { try { child.kill('SIGKILL') } catch {}; reject(new Error('render timeout (>60min)')) }, 60 * 60 * 1000)
        child.on('error', (e) => { clearTimeout(killTimer); reject(new Error(`render: ${e.message}`)) })
        child.on('close', (code) => { clearTimeout(killTimer); code === 0 ? resolve() : reject(new Error(`render exit ${code}: ${stderrBuf.slice(-300)}`)) })
      })

      await setProgress(90, 'Uploading...')
      const videoBuffer = await readFile(outFile)
      await sb.storage.from('videos').upload(`${userId}/${videoId}.mp4`, videoBuffer, { contentType: 'video/mp4', upsert: true })
      const { data: urlData } = sb.storage.from('videos').getPublicUrl(`${userId}/${videoId}.mp4`)

      // POSTER — a frame past the cover fade-in.
      const thumbPath = join(REMOTION_DIR, 'out', `${videoId}-thumb.png`)
      await grabPoster(outFile, thumbPath)
      let thumbUrl = null
      try { const tb = await readFile(thumbPath); await sb.storage.from('videos').upload(`${userId}/${videoId}_thumb.png`, tb, { contentType: 'image/png', upsert: true }); thumbUrl = sb.storage.from('videos').getPublicUrl(`${userId}/${videoId}_thumb.png`).data.publicUrl } catch {}
      await rm(thumbPath, { force: true }).catch(() => {})

      // PER-SCENE THUMBNAILS for the SLIDES panel — grab one frame per scene from
      // the finished mp4 at each scene's midpoint (no extra render). Uploads to
      // storage; slide_urls drives the clickable panel + the Fix-a-Scene picker.
      await setProgress(93, 'Building slide panel...')
      const slideUrls = []
      for (const m of (sceneMeta || [])) {
        try {
          const fp = join(REMOTION_DIR, 'out', `${videoId}-slide-${m.index}.jpg`)
          await new Promise((resolve, reject) => execFile('ffmpeg', ['-y', '-ss', String(m.midSec), '-i', outFile, '-frames:v', '1', '-q:v', '4', fp], { timeout: 30000 }, (e) => e ? reject(e) : resolve()))
          const buf = await readFile(fp)
          const path = `${userId}/${videoId}_slide_${m.index}.jpg`
          await sb.storage.from('videos').upload(path, buf, { contentType: 'image/jpeg', upsert: true })
          slideUrls[m.index] = sb.storage.from('videos').getPublicUrl(path).data.publicUrl
          await rm(fp, { force: true }).catch(() => {})
        } catch (e) { console.error(`[generate-slides ${videoId}] slide thumb ${m.index} failed: ${e.message}`) }
      }
      const slideUrlsClean = slideUrls.filter(Boolean)
      const slideDurations = (sceneMeta || []).map((m) => Math.round((m.endSec - m.startSec) * 10) / 10)
      const scriptForPanel = (sceneMeta || []).map((m) => ({ title: m.label, headline: m.label }))

      // PERSIST THE PLAN + scene index (for Fix-a-Scene: re-render one scene later
      // without redoing the whole video). Stored as a JSON asset alongside the video.
      // The per-scene VO clips (dir-vo-*.mp3) are ALSO kept so a single scene can be
      // re-recorded + spliced. slide_plan_url points the editor at the plan.
      let planUrl = null
      try {
        const planPayload = JSON.stringify({ plan, sceneMeta, starts: (sceneMeta || []).map((m) => m.startSec), voFiles: (sceneMeta || []).map((m) => m.voFile) })
        await sb.storage.from('videos').upload(`${userId}/${videoId}_plan.json`, Buffer.from(planPayload), { contentType: 'application/json', upsert: true })
        planUrl = sb.storage.from('videos').getPublicUrl(`${userId}/${videoId}_plan.json`).data.publicUrl
        // keep the per-scene VO clips in storage for later single-scene re-records
        for (const m of (sceneMeta || [])) {
          try { const vb = await readFile(join(pub, m.voFile)); await sb.storage.from('videos').upload(`${userId}/${videoId}_${m.voFile}`, vb, { contentType: 'audio/mpeg', upsert: true }) } catch {}
        }
      } catch (e) { console.error(`[generate-slides ${videoId}] plan persist failed: ${e.message}`) }

      // MAIN update: only CONFIRMED-existing columns, so a missing optional column
      // can never fail the whole completion write (a known footgun — a bad column
      // 400s the entire update, leaving the video stuck 'processing').
      await sb.from('videos').update({
        status: 'completed', video_url: urlData.publicUrl,
        ...(thumbUrl ? { thumbnail_url: thumbUrl } : {}),
        ...(slideUrlsClean.length ? { slide_urls: slideUrlsClean } : {}),
        slide_durations: slideDurations, script: scriptForPanel,
        progress_pct: 100, progress_detail: null, progress_updated_at: new Date().toISOString(),
      }).eq('id', videoId)
      // OPTIONAL columns (may not exist in this schema) — separate best-effort
      // writes so their absence never breaks the completion above.
      sb.from('videos').update({ total_scenes: (sceneMeta || []).length }).eq('id', videoId).then(() => {}, () => {})
      if (planUrl) sb.from('videos').update({ slide_plan_url: planUrl }).eq('id', videoId).then(() => {}, () => {})
      console.log(`[generate-slides ${videoId}] DONE -> ${urlData.publicUrl} (${slideUrlsClean.length} slide thumbs)`)
    } catch (err) {
      console.error(`[generate-slides ${videoId}] error:`, err.message)
      reportError({ source: 'generate-slides', videoId, userId, stage: 'slides', message: err.message }).catch(() => {})
      await sb.from('videos').update({ status: 'failed', error_message: 'Video generation failed. Your credits were refunded.', progress_detail: `[fail] generate-slides: ${err.message}`.slice(0, 500) }).eq('id', videoId).then(() => {}, () => {})
    } finally {
      for (const f of staged) await rm(f, { force: true }).catch(() => {})
      await rm(outFile, { force: true }).catch(() => {})
    }
  })
})

// ============================================================
// FIX-A-SCENE — re-record/edit ONE scene of a slide-deck video and re-render,
// WITHOUT redoing comprehension/writing/backdrops/other-scenes' VO. We reuse the
// persisted plan + all the other scenes' VO clips; only the edited scene gets a
// fresh VO. The scene re-fits to the new VO length (subsequent scenes shift), so
// we rebuild the plan's timing and re-render the whole composition — but the
// EXPENSIVE parts (Claude/Gemini/crawl + N-1 TTS calls) are skipped.
//
// Actions: 'rerecord' (same text — fixes glitches, FREE), 'edit-text' (new
// narration — content change, billed by the app), 'fix-pronunciation' (add a
// say-as hint, FREE). Optional 'preview:true' returns just the new VO clip URL
// without rendering, so the user can hear the fix before committing.
// ============================================================
app.post('/re-render-scene', authCheck, async (req, res) => {
  const { videoId, userId, sceneId, action, newText, pronounce, previewOnly } = req.body || {}
  if (!videoId || sceneId == null || !action) return res.status(400).json({ error: 'Missing videoId, sceneId, or action' })
  if (!process.env.ANTHROPIC_API_KEY && action === 'edit-text') { /* edit-text doesn't need Claude, but keep parity */ }

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false }, realtime: { transport: WebSocket } })
  const setProgress = (pct, detail) => sb.from('videos').update({ progress_pct: pct, progress_detail: detail, progress_updated_at: new Date().toISOString() }).eq('id', videoId).then(() => {}, () => {})
  const { generateSceneVO, claude, scrubSlidePlan, isRegulated } = require('./slides')

  // PREVIEW path is cheap + synchronous-ish: regen one VO, return its URL. No render.
  // (still ACK first so the caller isn't blocked on TTS.)
  res.json({ success: true, previewOnly: !!previewOnly })

  const pub = join(REMOTION_DIR, 'public')
  const staged = []
  let outFile = join(REMOTION_DIR, 'out', `${videoId}.mp4`)

  const run = async () => {
    try {
      // 1) fetch the persisted plan for this video
      const planKey = `${userId}/${videoId}_plan.json`
      const planDl = await sb.storage.from('videos').download(planKey)
      if (planDl.error || !planDl.data) throw new Error('no saved plan for this video (was it made before Fix-a-Scene?)')
      const saved = JSON.parse(Buffer.from(await planDl.data.arrayBuffer()).toString('utf8'))
      const plan = saved.plan
      const understanding = saved.understanding || plan.understanding || {}
      const scene = plan.scenes.find((s) => String(s.id) === String(sceneId))
      if (!scene) throw new Error(`scene ${sceneId} not found in plan`)

      // 2) determine the new content for the edited scene.
      // edit-text is a WORDING edit: it must update BOTH the on-screen text
      // (heading + block copy the user is looking at) AND the spoken narration —
      // not just the VO. We hand the user's new wording to Claude as an
      // instruction, grounded in the existing scene, and it rewrites the visible
      // copy + narration together. (Previously this only changed narration, so
      // the slide looked identical and users thought nothing happened.)
      let narration = scene.narration
      if (action === 'edit-text' && newText && String(newText).trim()) {
        const instruction = String(newText).slice(0, 1200)
        try {
          if (!previewOnly) await setProgress(10, 'Applying your wording edit…')
          const regulated = isRegulated(understanding) || !!plan.regulated
          // Only the editable text surfaces — keep cueFrame/type/structure intact.
          const editable = {
            heading: (scene.layout && scene.layout.heading) || '',
            kicker: (scene.layout && scene.layout.kicker) || '',
            narration: scene.narration || '',
            blocks: (scene.blocks || []).map((b, i) => {
              if (b.type === 'bullets') return { i, type: 'bullets', items: (b.items || []).map((it) => (it && it.text) || '') }
              if (b.type === 'cards') return { i, type: 'cards', cards: (b.cards || []).map((c) => ({ value: (c && c.value) || '', label: (c && c.label) || '', sub: (c && c.sub) || '' })) }
              if (b.type === 'figure' && b.figure) return { i, type: 'figure', label: b.figure.label || '', prefix: b.figure.prefix || '', value: b.figure.value || '', suffix: b.figure.suffix || '' }
              return { i, type: b.type }  // screenshot/other: no editable copy
            }),
          }
          const sys = `You are editing ONE slide of a narrated explainer video. Apply the user's wording instruction to BOTH the on-screen text and the spoken narration, then return the SAME JSON shape with only the text fields changed.
RULES:
- Return ONLY the JSON object (no markdown, no code fences, no commentary).
- Keep the exact same structure: same block "i" indexes, same block "type"s, same number of bullets/cards. Change only the words.
- Preserve every field the instruction does not ask to change.
- If the user asks to add or mention a specific word/term (e.g. an acronym like "ICHRA"), put it on the slide AND in the narration exactly as written — do NOT drop it.
- NEVER invent figures, names, or claims not in the original scene.
- Keep narration natural and spoken; keep on-screen copy tight (headings short, bullets one idea each).${regulated ? '\n- COMPLIANCE: do NOT name any insurance carrier or branded product. Dollar figures and percentages are fine and should be kept.' : ''}`
          const raw = await claude(sys, `Current scene:\n${JSON.stringify(editable, null, 2)}\n\nWording instruction: ${instruction}`, 2000)
          const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')
          const upd = JSON.parse(cleaned.slice(cleaned.indexOf('{'), cleaned.lastIndexOf('}') + 1))
          // apply back onto the real scene, keeping structure/cueFrames intact
          if (scene.layout) {
            if (typeof upd.heading === 'string' && upd.heading.trim()) scene.layout.heading = upd.heading.trim()
            if (typeof upd.kicker === 'string') scene.layout.kicker = upd.kicker
          }
          if (typeof upd.narration === 'string' && upd.narration.trim()) scene.narration = upd.narration.trim()
          for (const ub of (upd.blocks || [])) {
            const b = (scene.blocks || [])[ub.i]
            if (!b || b.type !== ub.type) continue
            if (ub.type === 'bullets' && Array.isArray(ub.items)) (b.items || []).forEach((it, k) => { if (it && typeof ub.items[k] === 'string') it.text = ub.items[k] })
            if (ub.type === 'cards' && Array.isArray(ub.cards)) (b.cards || []).forEach((c, k) => { const u = ub.cards[k]; if (c && u) { if (typeof u.value === 'string') c.value = u.value; if (typeof u.label === 'string') c.label = u.label; if (typeof u.sub === 'string') c.sub = u.sub } })
            if (ub.type === 'figure' && b.figure) { if (typeof ub.label === 'string') b.figure.label = ub.label; if (typeof ub.value === 'string') b.figure.value = ub.value; if (typeof ub.prefix === 'string') b.figure.prefix = ub.prefix; if (typeof ub.suffix === 'string') b.figure.suffix = ub.suffix }
          }
          // compliance scrub the edited scene (names only; keeps figures)
          try { scrubSlidePlan({ scenes: [scene] }, understanding) } catch {}
        } catch (e) {
          // if the rewrite fails, fall back to treating the text as raw narration
          // (old behavior) so the edit still lands SOMETHING rather than 0 change.
          console.error(`[re-render-scene ${videoId}] edit-text rewrite failed, narration-only fallback:`, e.message)
          scene.narration = instruction
        }
        narration = scene.narration
      }
      // (rerecord keeps the same text; fix-pronunciation keeps text + adds a hint)
      scene.narration = narration

      // 3) regenerate JUST this scene's VO (with word timings + pronunciation),
      // re-resolving its block cues. generateSceneVO handles speakable() +
      // optional pronunciation override.
      if (!previewOnly) await setProgress(15, 'Re-recording the scene...')
      const voName = `dir-vo-${scene.id}.mp3`
      const timed = await generateSceneVO({ pub, text: narration, outName: voName, pronounce, tts: (fn) => ttsLimit(fn) })
      staged.push(join(pub, voName))
      // re-resolve this scene's block cues against the NEW timings
      const FPS = 30, durF = Math.round(timed.durationSec * FPS)
      const { cueSec } = require('./slides')
      const toFrame = (cue) => { const s = cueSec(timed.words, cue); return s == null ? null : Math.round(s * FPS) }
      // (blocks already have baked cueFrames from the original build; only re-time
      // if we still have the original cue strings — we don't persist those, so we
      // keep the existing cueFrames but clamp them to the new duration.)
      for (const b of (scene.blocks || [])) {
        const items = b.type === 'bullets' ? b.items : b.type === 'cards' ? b.cards : null
        if (items) items.forEach((it, i) => { if (typeof it.cueFrame === 'number') it.cueFrame = Math.min(it.cueFrame, Math.max(12, durF - 20)); else it.cueFrame = Math.round(12 + (durF - 24) * (i / Math.max(1, items.length))) })
      }

      // PREVIEW: upload the clip, stash its URL for the UI, and STOP (no render).
      if (previewOnly) {
        const vb = await readFile(join(pub, voName))
        await sb.storage.from('videos').upload(`${userId}/${videoId}_preview_vo.mp3`, vb, { contentType: 'audio/mpeg', upsert: true })
        const url = sb.storage.from('videos').getPublicUrl(`${userId}/${videoId}_preview_vo.mp3`).data.publicUrl
        // stash on the row so the client can poll for it (best-effort column)
        sb.from('videos').update({ scene_preview_url: url }).eq('id', videoId).then(() => {}, () => {})
        console.log(`[re-render-scene ${videoId}] preview VO ready for scene ${sceneId}`)
        for (const f of staged) await rm(f, { force: true }).catch(() => {})
        return
      }

      // 4) COMMIT: bring down the OTHER scenes' VO + backdrops + music + logo/
      // presenter so the full render has every asset, then re-render + re-fit.
      await setProgress(30, 'Preparing assets...')
      await mkdir(pub, { recursive: true }); await mkdir(join(REMOTION_DIR, 'out'), { recursive: true })
      const pull = async (storageName, localName) => {
        try { const dl = await sb.storage.from('videos').download(`${userId}/${storageName}`); if (dl.data) { const p = join(pub, localName); await writeFile(p, Buffer.from(await dl.data.arrayBuffer())); staged.push(p); return true } } catch {} return false
      }
      // other scenes' VO clips (we persisted them as {videoId}_dir-vo-{id}.mp3)
      for (const s of plan.scenes) {
        if (String(s.id) === String(sceneId)) continue
        await pull(`${videoId}_dir-vo-${s.id}.mp3`, `dir-vo-${s.id}.mp3`)
      }
      // music (silent fallback if missing), logo, presenter, backdrops
      if (!(await pull(`${videoId}_dir-music.mp3`, 'dir-music.mp3'))) {
        const mp = join(pub, 'dir-music.mp3'); await new Promise((resolve, reject) => execFile('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-t', '5', '-q:a', '9', mp], { timeout: 30000 }, (e) => e ? reject(e) : resolve())); staged.push(mp)
      }
      if (plan.chrome && plan.chrome.logo) await pull(`${videoId}_${plan.chrome.logo}`, plan.chrome.logo)
      if (plan.presenter && plan.presenter.photo) await pull(`${videoId}_${plan.presenter.photo}`, plan.presenter.photo)
      for (const s of plan.scenes) { if (s.backdrop) await pull(`${videoId}_${s.backdrop}`, s.backdrop) }

      // 5) write the updated plan as props + re-render the whole composition
      const PROPS = join(pub, `dv-${videoId}-reedit-props.json`)
      await writeFile(PROPS, JSON.stringify({ plan })); staged.push(PROPS)
      await setProgress(45, 'Re-rendering...')
      const reOut = join(REMOTION_DIR, 'out', `${videoId}-reedit.mp4`)
      await withRenderSlot(() => new Promise((resolve, reject) => {
        const { spawn } = require('child_process')
        const child = spawn('npx', ['remotion', 'render', 'DirectedVideo', reOut, `--props=${PROPS}`, '--log=info', '--concurrency=8', '--gl=swiftshader', '--image-format=jpeg'], { cwd: REMOTION_DIR, env: { ...process.env } })
        let stderrBuf = '', lastPct = 45, lastWrite = 0
        const onChunk = (buf) => { const t = buf.toString(); stderrBuf = (stderrBuf + t).slice(-2000); const m = [...t.matchAll(/(\d+)\s*\/\s*(\d+)/g)].pop(); if (m) { const done = parseInt(m[1], 10), tot = parseInt(m[2], 10); if (tot > 0 && done <= tot) { const pct = 45 + Math.round((done / tot) * 44); const now = Date.now(); if (pct > lastPct && now - lastWrite > 1500) { lastPct = pct; lastWrite = now; setProgress(pct, `Re-rendering — frame ${done} of ${tot}`) } } } }
        child.stdout.on('data', onChunk); child.stderr.on('data', onChunk)
        const killTimer = setTimeout(() => { try { child.kill('SIGKILL') } catch {}; reject(new Error('re-render timeout')) }, 60 * 60 * 1000)
        child.on('error', (e) => { clearTimeout(killTimer); reject(new Error(`re-render: ${e.message}`)) })
        child.on('close', (code) => { clearTimeout(killTimer); code === 0 ? resolve() : reject(new Error(`re-render exit ${code}: ${stderrBuf.slice(-300)}`)) })
      }))
      staged.push(reOut)

      // 6) upload the new mp4 (overwrite), refresh the edited scene's thumbnail,
      // update the persisted plan + the edited scene's stored VO clip.
      await setProgress(92, 'Publishing...')
      const vbuf = await readFile(reOut)
      await sb.storage.from('videos').upload(`${userId}/${videoId}.mp4`, vbuf, { contentType: 'video/mp4', upsert: true })
      const { data: urlData } = sb.storage.from('videos').getPublicUrl(`${userId}/${videoId}.mp4`)
      // persist the edited scene's new VO + the updated plan
      try { const vb = await readFile(join(pub, voName)); await sb.storage.from('videos').upload(`${userId}/${videoId}_${voName}`, vb, { contentType: 'audio/mpeg', upsert: true }) } catch {}
      try { saved.plan = plan; await sb.storage.from('videos').upload(planKey, Buffer.from(JSON.stringify(saved)), { contentType: 'application/json', upsert: true }) } catch {}
      await sb.from('videos').update({ status: 'completed', video_url: urlData.publicUrl, progress_pct: 100, progress_detail: null, progress_updated_at: new Date().toISOString() }).eq('id', videoId)
      console.log(`[re-render-scene ${videoId}] scene ${sceneId} re-rendered -> ${urlData.publicUrl}`)
    } catch (err) {
      console.error(`[re-render-scene ${videoId}] error:`, err.message)
      reportError({ source: 're-render-scene', videoId, userId, stage: action, message: err.message }).catch(() => {})
      await sb.from('videos').update({ status: 'completed', progress_detail: `[fail] scene re-render: ${err.message}`.slice(0, 500) }).eq('id', videoId).then(() => {}, () => {})
    } finally {
      for (const f of staged) await rm(f, { force: true }).catch(() => {})
      await rm(outFile, { force: true }).catch(() => {})
    }
  }
  run()
})

// ============================================================
// DIRECTED (SLIDE-DECK) RENDERER — the DirectedVideo composition. Unlike the
// other endpoints, generation (comprehend → write → VO → dir-plan.json + assets)
// happens UPSTREAM on the app; the VPS only RENDERS. The caller sends the finished
// `plan` (dir-plan.json) plus `assets` (VO mp3s, backdrops, music, logo) as
// {name,url}; we download them into public/ under their EXACT plan filenames,
// write the plan to a --props file, render, and upload the mp4.
//
// Concurrency note: DirectedVideo hardcodes staticFile('dir-vo-<id>.mp3') etc.,
// so two concurrent renders would collide on those fixed names. withRenderSlot
// serializes renders (ONE Chrome fleet at a time), and we hold that slot across
// staging + render + cleanup, so fixed names are safe. Concurrency stays at 8 —
// higher crashed Chrome on this box's /dev/shm (see /render-v3 note).
// ============================================================
app.post('/render-directed', authCheck, async (req, res) => {
  const { videoId, userId, plan, assets, musicUrl } = req.body || {}
  if (!videoId || !plan || !Array.isArray(plan.scenes) || plan.scenes.length === 0) {
    return res.status(400).json({ error: 'Missing videoId or plan.scenes' })
  }
  res.json({ success: true })

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false }, realtime: { transport: WebSocket } })
  const setProgress = (pct, detail) => sb.from('videos').update({ progress_pct: pct, progress_detail: detail, progress_updated_at: new Date().toISOString() }).eq('id', videoId).then(() => {}, () => {})

  const pub = join(REMOTION_DIR, 'public')
  let outFile = join(REMOTION_DIR, 'out', `${videoId}.mp4`)
  const PROPS = join(pub, `dv-${videoId}-props.json`)
  // track everything we write so cleanup is exact (fixed names are shared across
  // videos, but renders are serialized, so we remove them right after this render).
  const staged = []

  // Everything from staging through cleanup runs INSIDE the render slot so no
  // other DirectedVideo render can touch the fixed dir-* filenames concurrently.
  await withRenderSlot(async () => {
    try {
      await mkdir(pub, { recursive: true })
      await mkdir(join(REMOTION_DIR, 'out'), { recursive: true })
      console.log(`[render-directed ${videoId}] scenes=${plan.scenes.length} assets=${(assets || []).length}`)
      await setProgress(30, 'Staging assets...')

      // Download each asset into public/ under its EXACT plan filename (dir-vo-1.mp3,
      // dir-bd-2.png, dir-music.mp3, brand-logo.png, dir-img-3.png, ...).
      for (const a of (assets || [])) {
        if (!a || !a.name || !a.url) continue
        const dest = join(pub, a.name)
        const r = await fetch(a.url, { signal: AbortSignal.timeout(45000), redirect: 'follow' })
        if (!r.ok) throw new Error(`asset ${a.name} download failed: ${r.status}`)
        await writeFile(dest, Buffer.from(await r.arrayBuffer()))
        staged.push(dest)
      }
      // A separate musicUrl (optional) overrides/fills dir-music.mp3.
      if (musicUrl) {
        const dest = join(pub, 'dir-music.mp3')
        const r = await fetch(musicUrl, { signal: AbortSignal.timeout(45000), redirect: 'follow' })
        if (r.ok) { await writeFile(dest, Buffer.from(await r.arrayBuffer())); if (!staged.includes(dest)) staged.push(dest) }
      }

      // Sanity: every scene's VO must be present (the metadata fn reads durations).
      for (const s of plan.scenes) {
        const vo = join(pub, `dir-vo-${s.id}.mp3`)
        try { await readFile(vo) } catch { throw new Error(`missing VO asset dir-vo-${s.id}.mp3 for scene ${s.id}`) }
      }

      // Write the plan as the --props payload. DirectedVideo's calculateMetadata
      // accepts { plan } via props and never falls back to the staticFile fetch.
      await writeFile(PROPS, JSON.stringify({ plan }))
      staged.push(PROPS)
      await setProgress(50, 'Rendering slides...')

      await new Promise((resolve, reject) => {
        const { spawn } = require('child_process')
        // concurrency 8 = proven-safe on this 16-core box (higher crashed Chrome
        // via /dev/shm). --props isolation: never rely on staticFile fetch.
        const child = spawn('npx', ['remotion', 'render', 'DirectedVideo', outFile, `--props=${PROPS}`,
          '--log=info', '--concurrency=8', '--gl=swiftshader', '--image-format=jpeg'],
          { cwd: REMOTION_DIR, env: { ...process.env } })
        let stderrBuf = '', lastPct = 50, lastWrite = 0
        const onChunk = (buf) => {
          const text = buf.toString(); stderrBuf = (stderrBuf + text).slice(-2000)
          const m = [...text.matchAll(/(\d+)\s*\/\s*(\d+)/g)].pop()
          if (m) {
            const done = parseInt(m[1], 10), total = parseInt(m[2], 10)
            if (total > 0 && done <= total) {
              const pct = 50 + Math.round((done / total) * 39) // 50 -> 89
              const now = Date.now()
              if (pct > lastPct && now - lastWrite > 1500) { lastPct = pct; lastWrite = now; setProgress(pct, `Rendering — frame ${done.toLocaleString()} of ${total.toLocaleString()}`) }
            }
          }
        }
        child.stdout.on('data', onChunk); child.stderr.on('data', onChunk)
        const killTimer = setTimeout(() => { try { child.kill('SIGKILL') } catch {} ; reject(new Error('remotion render: timeout (>60min)')) }, 60 * 60 * 1000)
        child.on('error', (e) => { clearTimeout(killTimer); reject(new Error(`remotion render: ${e.message}`)) })
        child.on('close', (code) => { clearTimeout(killTimer); code === 0 ? resolve() : reject(new Error(`remotion render exit ${code}: ${stderrBuf.slice(-300)}`)) })
      })

      await setProgress(90, 'Uploading...')
      const videoBuffer = await readFile(outFile)
      const videoStoragePath = `${userId}/${videoId}.mp4`
      await sb.storage.from('videos').upload(videoStoragePath, videoBuffer, { contentType: 'video/mp4', upsert: true })
      const { data: urlData } = sb.storage.from('videos').getPublicUrl(videoStoragePath)

      // Poster (past the cover fade-in).
      const thumbPath = join(REMOTION_DIR, 'out', `${videoId}-thumb.png`)
      await grabPoster(outFile, thumbPath)
      let thumbUrl = null
      try {
        const tb = await readFile(thumbPath)
        await sb.storage.from('videos').upload(`${userId}/${videoId}_thumb.png`, tb, { contentType: 'image/png', upsert: true })
        thumbUrl = sb.storage.from('videos').getPublicUrl(`${userId}/${videoId}_thumb.png`).data.publicUrl
      } catch { /* best-effort */ }
      await rm(thumbPath, { force: true }).catch(() => {})

      await sb.from('videos').update({
        status: 'completed', video_url: urlData.publicUrl,
        ...(thumbUrl ? { thumbnail_url: thumbUrl } : {}),
        progress_pct: 100, progress_detail: null, progress_updated_at: new Date().toISOString(),
      }).eq('id', videoId)
      console.log(`[render-directed ${videoId}] DONE -> ${urlData.publicUrl}`)
    } catch (err) {
      console.error(`[render-directed ${videoId}] error:`, err.message)
      reportError({ source: 'render-directed', videoId, userId, stage: 'slides', message: err.message }).catch(() => {})
      await sb.from('videos').update({ status: 'failed', error_message: 'Video rendering failed. Your credits were refunded.', progress_detail: `[fail] render-directed: ${err.message}`.slice(0, 500) }).eq('id', videoId).then(() => {}, () => {})
    } finally {
      // remove exactly what we staged (fixed dir-* names are shared, so clean now).
      for (const f of staged) await rm(f, { force: true }).catch(() => {})
      await rm(outFile, { force: true }).catch(() => {})
    }
  })
})

// ============================================================
// EDITORIAL RENDERER — EPOCH magazine style (EditorialVideo composition).
// TTS per scene + a framed Gemini image only for scenes that want one
// (cover/lede). Writes public/editorial.json, renders, uploads. Music optional.
// ============================================================
/**
 * THEME PREVIEW — render a few editorial/Time page STILLS from a script, with NO
 * Gemini images and NO TTS. Used by the wizard's theme picker so users can see
 * their real content in a style before committing. Synchronous: returns the
 * still URLs in the response. Cheap (a few single-frame renders), no AI cost.
 */
app.post('/preview-editorial', authCheck, async (req, res) => {
  const { videoId, userId, masthead, runningTitle, brandColor, variant, scenes, contactLine } = req.body || {}
  if (!videoId || !Array.isArray(scenes) || scenes.length === 0) {
    return res.status(400).json({ error: 'Missing videoId or scenes' })
  }
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false }, realtime: { transport: WebSocket } })
  const pub = join(REMOTION_DIR, 'public')
  const outDir = join(REMOTION_DIR, 'out')
  try {
    await mkdir(pub, { recursive: true }); await mkdir(outDir, { recursive: true })
    // Build scenes with a fixed duration each — NO audio, NO images (Figure shows
    // its striped placeholder, which is intentional + finished-looking).
    const FR = 120
    const out = scenes.map((s) => ({
      archetype: s.archetype, kicker: s.kicker, title: s.title || '', dek: s.dek, body: s.body,
      quote: s.quote, attribution: s.attribution, items: s.items, metrics: s.metrics,
      timeline: s.timeline, chart: s.chart, matrix: s.matrix,
      durationInFrames: FR,
    }))
    // A unique props file so we never clobber an in-flight editorial.json. The
    // composition's calculateMetadata prefers --props that carry scenes.
    const propsName = `preview-${videoId}-${variant || 'time'}.json`
    const props = { __preview: true, masthead, runningTitle, brandColor, variant: variant || 'time', contactLine, scenes: out }
    await writeFile(join(pub, propsName), JSON.stringify(props))

    // Pick representative pages: cover (0), a middle content page, and the last.
    const idxs = Array.from(new Set([0, Math.floor(out.length / 2), out.length - 1])).filter((i) => i >= 0 && i < out.length)
    const urls = []
    for (const i of idxs) {
      const midFrame = i * FR + Math.floor(FR / 2)
      const stillPath = join(outDir, `${videoId}-prev-${variant || 'time'}-${i}.png`)
      try {
        await new Promise((resolve, reject) => {
          const { spawn } = require('child_process')
          const c = spawn('npx', ['remotion', 'still', 'EditorialVideo', stillPath, `--frame=${midFrame}`, `--props=${join(pub, propsName)}`, '--gl=swiftshader', '--image-format=png'], { cwd: REMOTION_DIR, env: { ...process.env } })
          let err = ''; c.stderr.on('data', (b) => { err = (err + b.toString()).slice(-400) })
          const kt = setTimeout(() => { try { c.kill('SIGKILL') } catch {}; reject(new Error('still timeout')) }, 90000)
          c.on('error', (e) => { clearTimeout(kt); reject(e) })
          c.on('close', (code) => { clearTimeout(kt); code === 0 ? resolve() : reject(new Error(`still exit ${code}: ${err}`)) })
        })
        const buf = await readFile(stillPath)
        const path = `${userId}/${videoId}_themeprev_${variant || 'time'}_${i}.png`
        await sb.storage.from('videos').upload(path, buf, { contentType: 'image/png', upsert: true })
        urls.push(sb.storage.from('videos').getPublicUrl(path).data.publicUrl)
      } catch (e) { console.error(`[preview-editorial ${videoId}] still ${i} failed: ${e.message}`) }
    }
    await rm(join(pub, propsName), { force: true }).catch(() => {})
    return res.json({ success: true, stills: urls })
  } catch (err) {
    console.error(`[preview-editorial ${videoId}] error:`, err.message)
    return res.status(500).json({ error: err.message })
  }
})

app.post('/render-editorial', authCheck, async (req, res) => {
  const { videoId, userId, voiceId, masthead, runningTitle, brandColor, variant, scenes, musicUrl, musicPrompt, aiMusic, contactLine, presenter, photoPlacement, recipient } = req.body || {}
  if (!videoId || !Array.isArray(scenes) || scenes.length === 0) {
    return res.status(400).json({ error: 'Missing videoId or scenes' })
  }
  res.json({ success: true })

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false }, realtime: { transport: WebSocket } })
  const setProgress = (pct, detail) => sb.from('videos').update({ progress_pct: pct, progress_detail: detail, progress_updated_at: new Date().toISOString() }).eq('id', videoId).then(() => {}, () => {})
  const pub = join(REMOTION_DIR, 'public')
  let outFile = join(REMOTION_DIR, 'out', `${videoId}.mp4`)

  // Per-page preview thumbnails so the SLIDES panel fills with labeled,
  // clickable pages (same mechanism as /render-v3's pushPreview).
  const previews = []
  const pushPreview = async (idx, localPath) => {
    try {
      const buf = await readFile(localPath)
      const path = `${userId}/${videoId}_preview_${idx}.png`
      await sb.storage.from('videos').upload(path, buf, { contentType: 'image/png', upsert: true })
      const url = sb.storage.from('videos').getPublicUrl(path).data.publicUrl
      previews.push({ idx, url })
      await sb.from('videos').update({ preview_thumbs: previews, progress_updated_at: new Date().toISOString() }).eq('id', videoId)
    } catch (e) { /* previews are best-effort */ }
  }

  try {
    await mkdir(pub, { recursive: true }); await mkdir(join(REMOTION_DIR, 'out'), { recursive: true })
    console.log(`[render-editorial ${videoId}] ${scenes.length} scenes`)
    await sb.from('videos').update({ total_scenes: scenes.length, preview_thumbs: [] }).eq('id', videoId).then(() => {}, () => {})
    await setProgress(25, 'Writing your report...')

    // Build every scene's assets (TTS + optional Gemini image) IN PARALLEL.
    // These were serial per-scene AND serial-within-scene, so a 6-scene report
    // paid ~6×(TTS + ~16s Gemini) back-to-back — the bulk of the pre-render
    // wall-clock. They're independent (per-index filenames), so fan them out and
    // pay ~max instead of ~sum. Order is preserved via the indexed array.
    // allSettled, NOT all (review B8): settle every scene's assets before
    // failing so a single TTS rejection can't race the catch's cleanup and leave
    // sibling-written files orphaned in public/. TTS pooled at 3 (review B7).
    let assetsDone = 0
    const outSettled = await Promise.allSettled(scenes.map(async (s, i) => {
      const audioName = `ed-${videoId}-${i}.mp3`
      const imgName = `ed-${videoId}-${i}.png`
      const [durRaw, image] = await Promise.all([
        // TTS
        ttsLimit(() => v3Tts(s.narration || s.title || ' ', voiceId, join(pub, audioName))),
        // Optional editorial image (best-effort — failure just drops the image)
        (async () => {
          if (!s.wantsImage) return undefined
          const prompt = `A refined, editorial, professional photograph illustrating: "${(s.title || s.kicker || 'business concept').slice(0,160)}". Magazine-quality, tasteful, on-topic, NO text or logos in the image.`
          try { await v3GeminiBg(prompt, join(pub, imgName)); await readFile(join(pub, imgName)); return imgName }
          catch (e) { console.error(`[render-editorial ${videoId}] image ${i} failed: ${e.message}`); return undefined }
        })(),
      ])
      const durationInFrames = floorDuration(durRaw, i === 0)
      assetsDone++
      await setProgress(30 + Math.round((assetsDone / scenes.length) * 42), `Composing page ${assetsDone}/${scenes.length}...`)
      return {
        archetype: s.archetype, kicker: s.kicker, title: s.title || '', dek: s.dek, body: s.body,
        quote: s.quote, attribution: s.attribution, items: s.items, metrics: s.metrics,
        ...(image ? { image } : {}), audio: audioName, durationInFrames,
      }
    }))
    const edAssetFailure = outSettled.find((r) => r.status === 'rejected')
    if (edAssetFailure) throw edAssetFailure.reason
    const out = outSettled.map((r) => r.value)

    // Presenter (Person profile): download the headshot into public/ and decide
    // cover/closing placement ('auto' → editorial shows it on both).
    let edPresenter, edOnCover = false, edOnClosing = false
    if (presenter && (presenter.name || presenter.photo)) {
      let photoName
      if (presenter.photo) {
        try {
          const r = await fetch(presenter.photo, { signal: AbortSignal.timeout(15000) })
          if (r.ok) { photoName = `ed-${videoId}-presenter.png`; await writeFile(join(pub, photoName), Buffer.from(await r.arrayBuffer())) }
        } catch { /* name/role still render */ }
      }
      edPresenter = { name: presenter.name || undefined, role: presenter.role || undefined, ...(photoName ? { photo: photoName } : {}) }
      const pref = photoPlacement || 'auto'
      if (pref === 'cover') edOnCover = true
      else if (pref === 'closing') edOnClosing = true
      else if (pref === 'none') { /* neither */ }
      else { edOnCover = true; edOnClosing = true } // both | auto
      if (!photoName) { edOnCover = false; edOnClosing = false }
    }

    // PER-VIDEO props file (review B3): the old shared editorial.json was
    // clobbered by any concurrent editorial job — video A's page stills showed
    // video B's content.
    const edProps = join(pub, `ed-${videoId}-props.json`)
    await writeFile(edProps, JSON.stringify({
      masthead, runningTitle, brandColor, variant: variant || 'time', scenes: out,
      ...(contactLine ? { contactLine } : {}),
      ...(recipient ? { recipient } : {}),   // "Prepared for {client}" on the cover
      ...(edPresenter ? { presenter: edPresenter, presenterOnCover: edOnCover, presenterOnClosing: edOnClosing } : {}),
    }))
    await setProgress(72, 'Rendering...')
    // withRenderSlot: ONE render's Chrome fleet at a time (review B9).
    await withRenderSlot(() => new Promise((resolve, reject) => {
      const { spawn } = require('child_process')
      // Pass the real props explicitly so the render NEVER depends on a fragile
      // staticFile fetch inside calculateMetadata. Without this the render can
      // fall back to composition defaultProps (the "Run the editorial generator
      // first" placeholder).
      const child = spawn('npx', ['remotion', 'render', 'EditorialVideo', outFile, `--props=${edProps}`, '--log=info', '--concurrency=12', '--gl=swiftshader', '--image-format=jpeg'], { cwd: REMOTION_DIR, env: { ...process.env } })
      let err = '', lastPct = 72, lastW = 0
      const onChunk = (b) => { const x = b.toString(); err = (err + x).slice(-2000); const m = [...x.matchAll(/(\d+)\s*\/\s*(\d+)/g)].pop(); if (m) { const d = +m[1], tot = +m[2]; if (tot > 0 && d <= tot) { const p = 72 + Math.round((d / tot) * 17); const now = Date.now(); if (p > lastPct && now - lastW > 1500) { lastPct = p; lastW = now; setProgress(p, `Rendering — frame ${d.toLocaleString()} of ${tot.toLocaleString()}`) } } } }
      child.stdout.on('data', onChunk); child.stderr.on('data', onChunk)
      const kt = setTimeout(() => { try { child.kill('SIGKILL') } catch {}; reject(new Error('render timeout (>60min)')) }, 60 * 60 * 1000)
      child.on('error', (e) => { clearTimeout(kt); reject(new Error(`render: ${e.message}`)) })
      child.on('close', (c) => { clearTimeout(kt); c === 0 ? resolve() : reject(new Error(`render exit ${c}: ${err.slice(-300)}`)) })
    }))

    // Optional music mix (reuses the same Lyria + ffmpeg path as /render-v3).
    if (musicUrl || aiMusic || musicPrompt) {
      try {
        await setProgress(88, 'Adding music...')
        const musicPath = join(REMOTION_DIR, 'out', `${videoId}-music.mp3`); let have = false
        if (musicUrl) { const r = await fetch(musicUrl, { signal: AbortSignal.timeout(30000), redirect: 'follow' }); if (r.ok) { await writeFile(musicPath, Buffer.from(await r.arrayBuffer())); have = true } }
        else { const { GoogleGenAI } = require('@google/genai'); const g = new GoogleGenAI({ apiKey: GEMINI_API_KEY, httpOptions: { timeout: 120000 } }); const mr = await g.models.generateContent({ model: 'lyria-3-pro-preview', contents: musicPrompt || 'Refined, understated instrumental background music for a premium report. No vocals. Fade out.' }).catch(() => null); const part = mr && (mr.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData && (p.inlineData.mimeType?.includes('audio') || p.inlineData.mimeType?.includes('mpeg'))); if (part) { await writeFile(musicPath, Buffer.from(part.inlineData.data, 'base64')); have = true } }
        if (have) {
          const mixed = join(REMOTION_DIR, 'out', `${videoId}-mixed.mp4`)
          await new Promise((resolve, reject) => execFile('ffmpeg', ['-y', '-i', outFile, '-stream_loop', '-1', '-i', musicPath, '-filter_complex', '[0:a]volume=1.0[n];[1:a]volume=0.02,afade=t=in:st=0:d=2[b];[n][b]amix=inputs=2:duration=first:dropout_transition=3[a]', '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', mixed], { timeout: 120000 }, (e) => e ? reject(e) : resolve()))
          await rm(outFile, { force: true }).catch(() => {}); outFile = mixed
        }
      } catch (e) { console.error(`[render-editorial ${videoId}] music skipped: ${e.message}`) }
    }

    // Page thumbnails for the SLIDES panel: extract the MIDDLE frame of each
    // scene from the ALREADY-RENDERED MP4 with ffmpeg (review P2). The old
    // approach spawned `remotion still` per page — a fresh Chrome boot each
    // (90s-capped), minutes of extra wall-clock for pixel-identical images that
    // are already in the video. The music mix uses -c:v copy, so the video
    // stream (and frame timing) is unchanged — extracting from outFile is exact.
    await setProgress(89, 'Rendering page thumbnails...')
    {
      let acc = 0
      for (let i = 0; i < out.length; i++) {
        const dur = out[i].durationInFrames || 0
        const midSec = (acc + Math.floor(dur / 2)) / 30
        acc += dur
        const stillPath = join(REMOTION_DIR, 'out', `${videoId}-page-${i}.png`)
        try {
          await new Promise((resolve, reject) => execFile('ffmpeg',
            ['-y', '-ss', midSec.toFixed(3), '-i', outFile, '-frames:v', '1', '-q:v', '2', stillPath],
            { timeout: 30000 }, (e) => e ? reject(e) : resolve()))
          await pushPreview(i, stillPath)
        } catch (e) { console.error(`[render-editorial ${videoId}] page-still ${i} failed: ${e.message}`) }
      }
    }

    await setProgress(92, 'Uploading...')
    const buf = await readFile(outFile)
    const path = `${userId}/${videoId}.mp4`
    await sb.storage.from('videos').upload(path, buf, { contentType: 'video/mp4', upsert: true })
    const url = sb.storage.from('videos').getPublicUrl(path).data.publicUrl
    const thumb = join(REMOTION_DIR, 'out', `${videoId}-thumb.png`)
    await grabPoster(outFile, thumb)
    let thumbUrl = null
    try { const tb = await readFile(thumb); await sb.storage.from('videos').upload(`${userId}/${videoId}_thumb.png`, tb, { contentType: 'image/png', upsert: true }); thumbUrl = sb.storage.from('videos').getPublicUrl(`${userId}/${videoId}_thumb.png`).data.publicUrl } catch {}

    // Populate the SLIDES panel: per-page thumbnail, duration (seconds, for seek),
    // and script titles (the chapter label shown under each thumbnail).
    const slideUrls = out.map((_, i) => previews.find((p) => p.idx === i)?.url).filter(Boolean)
    const slideDurations = out.map((s) => Math.round((s.durationInFrames || 0) / 30 * 10) / 10)
    const scriptForPanel = out.map((s) => ({ title: s.title || '', headline: s.title || '' }))
    await sb.from('videos').update({
      status: 'completed', video_url: url, ...(thumbUrl ? { thumbnail_url: thumbUrl } : {}),
      ...(slideUrls.length ? { slide_urls: slideUrls } : {}),
      slide_durations: slideDurations, script: scriptForPanel,
      progress_pct: 100, progress_detail: null, progress_updated_at: new Date().toISOString(),
    }).eq('id', videoId)
    console.log(`[render-editorial ${videoId}] DONE -> ${url}`)
  } catch (err) {
    console.error(`[render-editorial ${videoId}] error:`, err.message)
    reportError({ source: 'render-editorial', videoId, userId, message: err.message }).catch(() => {})
    // Keep the diagnostic in progress_detail (same as render-v3) so failures
    // are diagnosable from the admin without SSH.
    await sb.from('videos').update({ status: 'failed', error_message: 'Video rendering failed. Your credits were refunded.', progress_detail: `[fail] render-editorial: ${err.message}`.slice(0, 500) }).eq('id', videoId).then(() => {}, () => {})
  } finally {
    try { const { readdir, unlink } = require('fs/promises'); for (const f of await readdir(pub)) if (f.startsWith(`ed-${videoId}-`)) await unlink(join(pub, f)).catch(() => {}); await rm(outFile, { force: true }).catch(() => {}) } catch {}
  }
})

// ============================================================
// FULL PIPELINE — VPS does everything (no Vercel timeout risk)
// ============================================================
app.post('/generate', authCheck, async (req, res) => {
  const { videoId, voiceId, scenes, userId, slidePrompts, logoUrl, musicPrompt, industry, brandName, brandColors } = req.body
  // Brand color fallbacks so slide compositing never throws if colors are absent.
  const safeBrandColors = brandColors || { primary: '#1B365D', secondary: '#4A90D9' }

  if (!videoId || !scenes?.length || !userId || !slidePrompts?.length) {
    return res.status(400).json({ error: 'Missing videoId, scenes, userId, or slidePrompts' })
  }

  // Read env vars at request time (not module load time) in case they were set after startup
  const sUrl = process.env.SUPABASE_URL || SUPABASE_URL
  const sKey = process.env.SUPABASE_SERVICE_KEY || SUPABASE_KEY
  if (!sUrl || !sKey) {
    return res.status(500).json({ error: 'SUPABASE_URL or SUPABASE_SERVICE_KEY not configured on VPS' })
  }

  // Respond immediately — work happens in background
  res.json({ success: true, message: 'Generation started' })

  const supabase = createClient(sUrl, sKey, {
    auth: { persistSession: false },
    realtime: { transport: WebSocket },
  })

  async function updateStatus(status, detail, pct) {
    try { await supabase.from('videos').update({ status, progress_detail: detail, progress_pct: pct }).eq('id', videoId) } catch(e) { console.error('Progress update failed:', e.message) }
  }

  try {
    console.log(`[${videoId}] FULL PIPELINE: ${scenes.length} scenes, voice=${voiceId}, ${slidePrompts.length} prompts`)

    // STAGE 1+2: Generate audio AND slides IN PARALLEL
    await updateStatus('generating_audio', 'Generating audio and slides...', 20)
    const OpenAI = require('openai')
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY })

    // Audio runs in background — updates progress per clip
    let audiosDone = 0
    // Scenes that HAD narration but produced no audio after all retries. If any
    // exist we fail the whole job rather than silently shipping a silent slide.
    const failedNarrations = []
    const audioPromise = (async () => {
      const buffers = []
      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i]
        // Intentionally silent (no narration text) — push empty, not a failure.
        if (!scene.narration?.trim()) {
          buffers.push(Buffer.alloc(0))
          audiosDone++
          continue
        }
        // Retry TTS up to 3x with backoff (was a single no-retry call).
        let buf = null
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            // ElevenLabs primary, OpenAI fallback (see ttsToBuffer).
            const b = await ttsToBuffer(scene.narration.slice(0, 4096), voiceId)
            if (b.length > 100) { buf = b; break }
            throw new Error(`TTS returned ${b.length} bytes`)
          } catch (e) {
            console.error(`[${videoId}] TTS clip ${i + 1} attempt ${attempt}/3 failed:`, e.message)
            if (attempt < 3) await new Promise(r => setTimeout(r, 2000 * attempt))
          }
        }
        if (buf) {
          buffers.push(buf)
        } else {
          buffers.push(Buffer.alloc(0))
          failedNarrations.push(i + 1)
        }
        audiosDone++
        console.log(`[${videoId}] Audio ${audiosDone}/${scenes.length}`)
      }
      console.log(`[${videoId}] Audio complete: ${buffers.length} clips${failedNarrations.length ? `, ${failedNarrations.length} FAILED` : ''}`)
      return buffers
    })()

    // Slides: OpenAI GPT Image — one at a time with per-slide progress
    await updateStatus('generating_slides', 'Preparing slide designs...', 22)

    // Fetch logo image if available (for reference in prompts)
    let logoBase64 = null
    if (logoUrl) {
      try {
        const logoRes = await fetch(logoUrl, { signal: AbortSignal.timeout(8000) })
        if (logoRes.ok) logoBase64 = Buffer.from(await logoRes.arrayBuffer()).toString('base64')
      } catch (e) { console.log(`[${videoId}] Logo fetch failed:`, e.message) }
    }

    // --- TEMPLATE REFERENCE: Download once, use for all slides ---
    let templateRefBase64 = null
    const templateRefUrl = req.body.templateRefUrl || null
    if (templateRefUrl) {
      try {
        console.log(`[${videoId}] Downloading template reference from ${templateRefUrl}`)
        const tRes = await fetch(templateRefUrl, { signal: AbortSignal.timeout(10000) })
        if (tRes.ok) {
          templateRefBase64 = Buffer.from(await tRes.arrayBuffer()).toString('base64')
          console.log(`[${videoId}] Template reference loaded (${Math.round(templateRefBase64.length / 1024)}KB)`)
        }
      } catch (e) { console.log(`[${videoId}] Template ref download failed:`, e.message) }
    }

    // --- GEMINI SLIDE GENERATION (replaces OpenAI gpt-image-1) ---
    const { GoogleGenAI: GenAISlides } = require('@google/genai')
    const geminiSlides = new GenAISlides({ apiKey: GEMINI_API_KEY })

    // Generate slides in parallel batches
    const slideBuffers = new Array(slidePrompts.length).fill(null)

    // Track slides that fell back to the plain navy card, with the reason, so we
    // can send ONE summary alert instead of one email per failed slide.
    const slideFallbacks = []
    async function generateOneSlide(idx) {
      const prompt = slidePrompts[idx]
      // Cover (first) and closing (last) are title cards — no header band on them
      // (the brand name is already the focal point of those designs).
      const isBookendSlide = idx === 0 || idx === slidePrompts.length - 1
      const parts = []
      let lastErr = null
      if (templateRefBase64) {
        parts.push({ text: 'REFERENCE DESIGN (match this EXACTLY): This image shows the visual style to follow. Replicate the same layout structure, geometric shapes, diagonal color blocks, icon circles, decorative elements, footer bar, and overall mood. Only change the DATA content and use the brand colors specified.' })
        parts.push({ inlineData: { mimeType: 'image/png', data: templateRefBase64 } })
      }
      parts.push({ text: prompt })
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const response = await geminiSlides.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: [{ role: 'user', parts }],
            config: { responseFormat: { image: { aspectRatio: '16:9', imageSize: '2K' } } },
          })
          const rParts = response.candidates?.[0]?.content?.parts ?? []
          for (const rp of rParts) {
            if (rp.inlineData) {
              let slideBuf = Buffer.from(rp.inlineData.data, 'base64')
              const sharp = require('sharp')
              const SLIDE_W = 1920, SLIDE_H = 1080
              // Band only when a LOGO will actually sit in it. Gating on
              // brandName painted a coloured strip with nothing inside it on
              // every slide of every deck that had a name but no logo.
              const showBand = !isBookendSlide && !!logoBase64
              const BAND_H = 88
              const primary = (safeBrandColors.primary || '#1B365D')

              if (showBand) {
                // The band gets its OWN dedicated strip — the slide art is fitted
                // into the area BELOW it so the band can never cover Gemini's
                // content (fixes title-cutoff). Final image is exactly 1920x1080:
                // [band strip] on top + [art] beneath.
                //
                // `cover`, NOT `contain`: the band steals 88px of height, so the
                // art box is 1920x992 — aspect 1.9355 against a 16:9 slide. Under
                // `contain` that pillarboxed every slide with 72px of white down
                // each side. `cover` trims ~4% off the top and bottom instead,
                // which the 80px prompt padding already protects against.
                const artH = SLIDE_H - BAND_H
                const artBuf = await sharp(slideBuf)
                  .resize(SLIDE_W, artH, { fit: 'cover', position: 'centre' })
                  .png().toBuffer()

                // Band overlays (band rect + name/logo), composited onto the band strip.
                const bandSvg = Buffer.from(
                  '<svg width="' + SLIDE_W + '" height="' + BAND_H + '" xmlns="http://www.w3.org/2000/svg">' +
                  '<rect width="' + SLIDE_W + '" height="' + BAND_H + '" fill="' + primary + '"/>' +
                  '<rect y="' + (BAND_H - 3) + '" width="' + SLIDE_W + '" height="3" fill="rgba(0,0,0,0.18)"/>' +
                  '</svg>'
                )
                const bandComposites = [{ input: await sharp(bandSvg).png().toBuffer(), top: 0, left: 0 }]
                if (logoBase64) {
                  const logoResized = await sharp(Buffer.from(logoBase64, 'base64'))
                    .resize(null, BAND_H - 28, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                    .png().toBuffer()
                  bandComposites.push({ input: logoResized, top: 14, left: 48 })
                } else {
                  const safeName = brandName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                  const fontSize = 34
                  const textSvg = Buffer.from(
                    '<svg width="' + (SLIDE_W - 96) + '" height="' + BAND_H + '" xmlns="http://www.w3.org/2000/svg">' +
                    '<text x="0" y="' + Math.round(BAND_H / 2 + fontSize / 3) + '" font-size="' + fontSize + '" font-weight="800" font-family="sans-serif" fill="#FFFFFF">' + safeName + '</text>' +
                    '</svg>'
                  )
                  bandComposites.push({ input: await sharp(textSvg).png().toBuffer(), top: 0, left: 48 })
                }
                const bandStrip = await sharp({ create: { width: SLIDE_W, height: BAND_H, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
                  .composite(bandComposites).png().toBuffer()

                // Stack: band strip on top, art below — onto a 1920x1080 canvas.
                slideBuf = await sharp({ create: { width: SLIDE_W, height: SLIDE_H, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
                  .composite([
                    { input: bandStrip, top: 0, left: 0 },
                    { input: artBuf, top: BAND_H, left: 0 },
                  ])
                  .png().toBuffer()
              } else {
                // No band: fill 1920x1080. The model returns 1376x768 (1.7917)
                // against a 1.7778 frame, so `cover` trims well under 1% — where
                // `contain` left thin white bars on an otherwise full-bleed slide.
                slideBuf = await sharp(slideBuf)
                  .resize(SLIDE_W, SLIDE_H, { fit: 'cover', position: 'centre' })
                  .png().toBuffer()
              }
              return slideBuf
            }
          }
          throw new Error('No image in Gemini response')
        } catch (retryErr) {
          // Log the FULL error (not truncated) under a greppable tag. Every blue
          // fallback slide is a failure in this block — this line is the only way
          // to know the real cause (sharp missing, undefined var, Gemini reject,
          // timeout, bad response shape). grep logs for 'SLIDE FAIL'.
          lastErr = retryErr
          console.error(`[${videoId}] SLIDE FAIL slide=${idx + 1} attempt=${attempt}/3:`, retryErr?.stack || retryErr?.message || retryErr)
          if (attempt < 3) await new Promise(r => setTimeout(r, 3000 * attempt))
        }
      }
      console.error(`[${videoId}] SLIDE FALLBACK slide=${idx + 1}: all 3 attempts failed, using plain navy card`)
      slideFallbacks.push({ slide: idx + 1, reason: lastErr?.message || String(lastErr) })
      return await generateFallbackSlide(scenes[idx]?.title || `Slide ${idx + 1}`, idx + 1, slidePrompts.length)
    }

    // Tell the UI how many slides to expect so the filmstrip sizes correctly.
    await supabase.from('videos').update({ total_scenes: slidePrompts.length, preview_thumbs: [] }).eq('id', videoId).then(() => {}, () => {})
    const classicPreviews = []
    const pushClassicPreview = async (idx, buf) => {
      try {
        const path = `${userId}/${videoId}_preview_${idx}.png`
        await supabase.storage.from('videos').upload(path, buf, { contentType: 'image/png', upsert: true })
        const url = supabase.storage.from('videos').getPublicUrl(path).data.publicUrl
        classicPreviews.push({ idx, url })
        await supabase.from('videos').update({ preview_thumbs: classicPreviews, progress_updated_at: new Date().toISOString() }).eq('id', videoId)
      } catch { /* best-effort */ }
    }

    const BATCH_SIZE = 2
    for (let i = 0; i < slidePrompts.length; i += BATCH_SIZE) {
      const batch = []
      for (let j = i; j < Math.min(i + BATCH_SIZE, slidePrompts.length); j++) {
        batch.push(generateOneSlide(j).then(buf => { slideBuffers[j] = buf }))
      }
      await Promise.all(batch)
      const done = Math.min(i + BATCH_SIZE, slidePrompts.length)
      // Live filmstrip: upload each newly-built slide as a preview.
      for (let j = i; j < done; j++) if (slideBuffers[j]) await pushClassicPreview(j, slideBuffers[j])
      console.log(`[${videoId}] Slides ${done}/${slidePrompts.length} done`)
      const slidePct = 22 + Math.round((done / slidePrompts.length) * 43)
      await updateStatus('generating_slides', `Designing slide ${done} of ${slidePrompts.length}... (audio ${audiosDone}/${scenes.length})`, slidePct)
    }
    console.log(`[${videoId}] Slides complete: ${slideBuffers.length}`)

    // If any slides fell back to the blank navy card, alert ops immediately —
    // this is the "blue screen" symptom and we want to know in real time.
    if (slideFallbacks.length > 0) {
      const summary = slideFallbacks.map(f => `slide ${f.slide}: ${f.reason}`).join('\n')
      console.error(`[${videoId}] ${slideFallbacks.length}/${slideBuffers.length} slides fell back to navy card`)
      reportError({
        source: 'vps/slides',
        videoId,
        userId,
        stage: 'slide-generation',
        message: `${slideFallbacks.length} of ${slideBuffers.length} slides failed Gemini generation and used the blank fallback (blue screens).`,
        detail: summary,
      })

      // Quality gate: if too many slides are blank fallbacks, the video is junk —
      // fail it (→ refund + notify via the pipeline catch) rather than shipping a
      // mostly-blue deck as "completed". A few fallbacks are tolerable; a majority
      // is a broken render.
      const FALLBACK_FAIL_RATIO = 0.3
      if (slideFallbacks.length / slideBuffers.length > FALLBACK_FAIL_RATIO) {
        throw new Error(`Slide generation degraded: ${slideFallbacks.length}/${slideBuffers.length} slides failed (>${Math.round(FALLBACK_FAIL_RATIO * 100)}%). Failing render so credits are refunded instead of shipping blank slides.`)
      }
    }

    // Wait for audio to finish (it ran in parallel with slides)
    await updateStatus('generating_slides', `Slides done, waiting for audio...`, 66)
    const audioBuffers = await audioPromise
    console.log(`[${videoId}] Audio + slides both done`)

    // Fail loudly if any slide that SHOULD have narration ended up silent after
    // all TTS retries — better to fail (and refund) than ship missing narration.
    if (failedNarrations.length > 0) {
      throw new Error(`Narration failed for slide(s) ${failedNarrations.join(', ')} after 3 attempts each`)
    }

    // STAGE 3: Assemble with FFmpeg (no Sharp overlays needed — OpenAI bakes everything in)
    await updateStatus('assembling', 'Assembling your video...', 68)
    const workDir = join(tmpdir(), `d2v-${randomUUID()}`)
    await mkdir(workDir, { recursive: true })

    // Write files
    for (let i = 0; i < slideBuffers.length; i++) {
      await writeFile(join(workDir, `slide_${i}.png`), slideBuffers[i])
      if (audioBuffers[i] && audioBuffers[i].length > 0) {
        await writeFile(join(workDir, `audio_${i}.mp3`), audioBuffers[i])
      }
    }

    const outputPath = join(workDir, 'output.mp4')
    let durations = []

    if (process.env.ASSEMBLY_V2 === 'true') {
      // ── V2: single-filtergraph assembly (one ffmpeg pass, no concat seams) ──
      await updateStatus('assembling', 'Assembling your video...', 75)
      console.log(`[${videoId}] ASSEMBLY_V2: single-filtergraph for ${slideBuffers.length} slides`)
      durations = await assembleSingleGraph({
        workDir,
        slideCount: slideBuffers.length,
        audioBuffers,
        outputPath,
      })
      console.log(`[${videoId}] ASSEMBLY_V2 done: total ${durations.reduce((s, d) => s + d, 0).toFixed(1)}s`)
    } else {
      // ── V1: per-clip encode + concat (legacy default) ──
      const clipFiles = []
      for (let i = 0; i < slideBuffers.length; i++) {
        await updateStatus('assembling', `Encoding clip ${i + 1} of ${slideBuffers.length}...`, 68 + Math.round(((i + 1) / slideBuffers.length) * 15))
        const clipPath = join(workDir, `clip_${i}.mp4`)
        const slidePath = join(workDir, `slide_${i}.png`)
        const audioPath = join(workDir, `audio_${i}.mp3`)
        const vf = 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2'

        if (audioBuffers[i] && audioBuffers[i].length > 100) {
          const realDur = await probeAudioDuration(audioPath)
          const slideDuration = realDur > 0 ? realDur + 0.8 : Math.round(audioBuffers[i].length / 16000) + 1
          await runFfmpeg(['-loop', '1', '-i', slidePath, '-i', audioPath, '-c:v', 'libx264', '-tune', 'stillimage', '-c:a', 'aac', '-b:a', '192k', '-pix_fmt', 'yuv420p', '-vf', vf, '-t', String(slideDuration), '-y', clipPath])
        } else {
          await runFfmpeg([
            '-loop', '1', '-i', slidePath,
            '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
            '-t', '5',
            '-c:v', 'libx264', '-tune', 'stillimage', '-pix_fmt', 'yuv420p', '-vf', vf,
            '-c:a', 'aac', '-b:a', '192k',
            '-y', clipPath,
          ])
        }
        clipFiles.push(clipPath)

        try {
          const dur = await new Promise((resolve) => {
            execFile('ffprobe', ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', clipPath], { timeout: 10000 }, (err, stdout) => {
              resolve(err ? 5 : parseFloat(stdout.trim()) || 5)
            })
          })
          durations.push(dur)
        } catch { durations.push(5) }
      }

      await updateStatus('assembling', 'Joining clips together...', 85)
      const concatFile = join(workDir, 'concat.txt')
      await writeFile(concatFile, clipFiles.map(f => `file '${f}'`).join('\n'))
      await runFfmpeg(['-f', 'concat', '-safe', '0', '-i', concatFile, '-c', 'copy', '-movflags', '+faststart', '-y', outputPath])
    }

    // STAGE 4: Generate background music with Lyria 3 Pro + mix
    const totalDurationEst = durations.reduce((s, d) => s + d, 0)
    let finalPath = outputPath

    // Only generate background music when the user actually asked for it. The
    // caller sends a non-empty musicPrompt when music is selected, empty when
    // declined. Previously gated only on the API key, so EVERY video got music
    // whether the user wanted it or not — the "music plays when not selected" bug.
    const musicRequested = !!(musicPrompt && musicPrompt.trim())
    if (GEMINI_API_KEY && musicRequested) {
      try {
        await updateStatus('assembling', 'Composing background music...', 88)
        const { GoogleGenAI } = require('@google/genai')
        const genai = new GoogleGenAI({ apiKey: GEMINI_API_KEY, httpOptions: { timeout: 120000 } })

        // Build music prompt based on industry/mood
        const durationMin = Math.floor(totalDurationEst / 60)
        const durationSec = Math.round(totalDurationEst % 60)
        const durationStr = durationMin > 0 ? `${durationMin} minute${durationMin > 1 ? 's' : ''} and ${durationSec} seconds` : `${durationSec} seconds`

        const industryMoods = {
          insurance: 'trustworthy, warm, reassuring',
          finance: 'confident, sophisticated, professional',
          healthcare: 'caring, hopeful, clean',
          technology: 'innovative, energetic, modern',
          education: 'inspiring, uplifting, bright',
          realestate: 'elegant, aspirational, warm',
          legal: 'authoritative, polished, dignified',
          marketing: 'dynamic, creative, upbeat',
          consulting: 'strategic, confident, forward-thinking',
          nonprofit: 'heartfelt, inspiring, community-driven',
          retail: 'fun, energetic, inviting',
          manufacturing: 'strong, reliable, progressive',
        }
        const mood = industryMoods[industry] || 'professional, upbeat, confident'
        const customPrompt = musicPrompt || ''

        const lyricaPrompt = `Create a ${durationStr} background music track. Instrumental only, absolutely no vocals or singing. ${mood} feel. Upbeat corporate presentation music with driving rhythm, modern piano, light synth accents, and soft percussion. The track should feel polished and motivating — suitable for a professional business video presentation. ${customPrompt}. Fade out naturally at the end.`

        console.log(`[${videoId}] Generating music with Lyria 3 Pro (${durationStr})...`)

        const musicResponse = await genai.models.generateContent({
          model: 'lyria-3-pro-preview',
          contents: lyricaPrompt,
        })

        // Parse Lyria response — audio can be in parts or directly on response
        const musicParts = musicResponse.candidates?.[0]?.content?.parts ?? []
        console.log(`[${videoId}] Lyria response parts: ${musicParts.length}, types: ${musicParts.map(p => p.text ? 'text' : p.inlineData ? `data(${p.inlineData.mimeType})` : 'unknown').join(', ')}`)
        let musicSaved = false
        for (const mp of musicParts) {
          if (mp.inlineData && (mp.inlineData.mimeType?.includes('audio') || mp.inlineData.mimeType?.includes('mpeg'))) {
            const musicPath = join(workDir, 'bgmusic.mp3')
            await writeFile(musicPath, Buffer.from(mp.inlineData.data, 'base64'))
            console.log(`[${videoId}] Music generated: ${(Buffer.from(mp.inlineData.data, 'base64').length / 1024 / 1024).toFixed(1)}MB`)

            // Mix music under narration
            await updateStatus('assembling', 'Mixing background music...', 91)
            const fadeOutStart = Math.max(0, totalDurationEst - 3)
            const mixedPath = join(workDir, 'output_with_music.mp4')
            await runFfmpeg([
              '-i', outputPath,
              '-stream_loop', '-1',
              '-i', musicPath,
              '-filter_complex',
              // normalize=0 stops amix from auto-ducking the narration; narration stays
              // at full volume and music sits as a quiet bed underneath at ~4%.
              `[0:a]volume=1.0[narr];[1:a]volume=0.04,afade=t=in:st=0:d=2,afade=t=out:st=${fadeOutStart}:d=3[music];[narr][music]amix=inputs=2:duration=first:normalize=0[out]`,
              '-map', '0:v',
              '-map', '[out]',
              '-c:v', 'copy',
              '-c:a', 'aac',
              '-b:a', '192k',
              '-movflags', '+faststart',
              '-y',
              mixedPath,
            ])
            finalPath = mixedPath
            musicSaved = true
            console.log(`[${videoId}] Music mixed successfully`)
            break
          }
        }
        if (!musicSaved) {
          console.log(`[${videoId}] No audio in Lyria response, continuing without music`)
        }
      } catch (musicErr) {
        console.error(`[${videoId}] Music generation failed, continuing without:`, musicErr.message)
      }
    } else {
      console.log(`[${videoId}] No GEMINI_API_KEY, skipping music generation`)
    }

    // Read and upload
    await updateStatus('assembling', 'Uploading video...', 94)
    const videoBuffer = await readFile(finalPath)
    console.log(`[${videoId}] Video: ${(videoBuffer.length / 1024 / 1024).toFixed(1)}MB`)

    const videoStoragePath = `${userId}/${videoId}.mp4`
    const { error: uploadError } = await supabase.storage.from('videos').upload(videoStoragePath, videoBuffer, { contentType: 'video/mp4', upsert: true })
    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)
    const { data: urlData } = supabase.storage.from('videos').getPublicUrl(videoStoragePath)

    // Upload thumbnail
    const thumbPath = `${userId}/${videoId}_thumb.png`
    await supabase.storage.from('videos').upload(thumbPath, slideBuffers[0], { contentType: 'image/png', upsert: true })
    const { data: thumbUrlData } = supabase.storage.from('videos').getPublicUrl(thumbPath)

    // Upload individual slides
    await updateStatus('assembling', 'Saving slides...', 96)
    const slideUrls = []
    for (let i = 0; i < slideBuffers.length; i++) {
      const sp = `${userId}/${videoId}_slide_${i}.png`
      await supabase.storage.from('videos').upload(sp, slideBuffers[i], { contentType: 'image/png', upsert: true })
      const { data: su } = supabase.storage.from('videos').getPublicUrl(sp)
      slideUrls.push(su.publicUrl)
    }

    // Mark complete — with explicit error logging
    const totalDuration = totalDurationEst
    try {
      const { error: updateError } = await supabase.from('videos').update({
        video_url: urlData.publicUrl,
        thumbnail_url: thumbUrlData.publicUrl,
        duration: Math.round(totalDuration),
        // Real per-slide clip durations (seconds), one per slide_url, in order.
        // The preview/watch pages map thumbnails to exact timestamps with these
        // instead of guessing via equal division (the slide-desync + last-
        // thumbnail bugs). Requires the slide_durations column.
        slide_durations: durations.map(d => Math.round(d * 100) / 100),
        slide_urls: slideUrls,
        status: 'completed',
        progress_detail: null,
        progress_pct: 100,
      }).eq('id', videoId)
      if (updateError) {
        console.error(`[${videoId}] DB UPDATE ERROR:`, updateError.message, updateError.details, updateError.hint)
      } else {
        console.log(`[${videoId}] Database updated to completed`)
      }
    } catch (dbErr) {
      console.error(`[${videoId}] DB UPDATE CRASHED:`, dbErr.message)
    }

    console.log(`[${videoId}] COMPLETE! ${totalDuration.toFixed(0)}s video, ${slideUrls.length} slides`)

    // Cleanup
    await rm(workDir, { recursive: true, force: true }).catch(() => {})
  } catch (err) {
    console.error(`[${videoId}] PIPELINE FAILED:`, err.message)
    reportError({ source: 'vps/generate', videoId, userId, stage: 'pipeline', message: err.message, detail: err.stack })
    try {
      await supabase.from('videos').update({
        status: 'failed',
        error_message: err.message,
        progress_detail: `Failed: ${err.message}`,
        progress_pct: 0,
      }).eq('id', videoId)
    } catch(e2) { console.error('Failed to update failure status:', e2.message) }
  }
})


// Style preview route
app.post('/style-preview', authCheck, async (req, res) => {
  try {
    const { referenceImageBase64, userId } = req.body
    if (!referenceImageBase64) return res.status(400).json({ error: 'No reference image' })
    console.log('[style-preview] Starting...')
    const OpenAI = require('openai')
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const a = await openai.chat.completions.create({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,' + referenceImageBase64 } }, { type: 'text', text: 'Describe this visual style for recreating it: colors, typography, layout, textures, mood. 2-4 sentences.' }] }], max_tokens: 300 })
    const style = (a.choices[0] && a.choices[0].message && a.choices[0].message.content) || 'Professional design'
    console.log('[style-preview] Style:', style.slice(0, 80))
    const [c, d] = await Promise.all([
      openai.images.generate({ model: 'gpt-image-2', prompt: 'Create a COVER slide in this style: ' + style + '. Title: Quarterly Business Review, subtitle: Q2 2025. 1920x1080 landscape. Fill canvas. No logos.', size: '1536x1024', quality: 'high', n: 1 }),
      openai.images.generate({ model: 'gpt-image-2', prompt: 'Create a CONTENT slide in this style: ' + style + '. KEY METRICS: Revenue 2.4M, Clients 1240, Retention 94 percent. 1920x1080 landscape. Fill canvas. No logos.', size: '1536x1024', quality: 'high', n: 1 })
    ])
    const cover = c.data[0].b64_json ? 'data:image/png;base64,' + c.data[0].b64_json : null
    const content = d.data[0].b64_json ? 'data:image/png;base64,' + d.data[0].b64_json : null
    let refUrl = null
    if (userId) {
      try {
        const rid = require('crypto').randomUUID()
        const sp = userId + '/style-refs/' + rid + '.png'
        const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
        await sb.storage.from('logos').upload(sp, Buffer.from(referenceImageBase64, 'base64'), { contentType: 'image/png', upsert: true })
        refUrl = sb.storage.from('logos').getPublicUrl(sp).data.publicUrl
      } catch(e) { console.error('[style-preview] Save failed:', e.message) }
    }
    console.log('[style-preview] Done')
    res.json({ previews: [cover, content].filter(Boolean), referenceUrl: refUrl, styleDescription: style })
  } catch (err) {
    console.error('[style-preview] Error:', err)
    res.status(500).json({ error: err.message || 'Failed' })
  }
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Video assembly service running on port ${PORT}`)
})
