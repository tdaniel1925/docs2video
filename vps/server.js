const express = require('express')
const { execFile } = require('child_process')
const { writeFile, mkdir, rm, readFile } = require('fs/promises')
const { join } = require('path')
const { randomUUID } = require('crypto')
const { tmpdir } = require('os')
const { createClient } = require('@supabase/supabase-js')
const WebSocket = require('ws')

const app = express()
app.use(express.json({ limit: '200mb' }))

const PORT = process.env.PORT || 4000
const API_SECRET = process.env.API_SECRET || 'docs2video-assembly-secret-2026'
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const GEMINI_API_KEY = process.env.GEMINI_API_KEY

// Auth middleware
function authCheck(req, res, next) {
  const token = req.headers['x-api-secret']
  if (token !== API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', ffmpeg: true })
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
            `[1:a]volume=0.07,afade=t=in:st=0:d=2,afade=t=out:st=${fadeOutStart}:d=3[music];[0:a][music]amix=inputs=2:duration=first[out]`,
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
            const resp = await openai.audio.speech.create({
              model: 'tts-1-hd', voice: voiceId || 'nova',
              input: scene.narration.slice(0, 4096), response_format: 'mp3', speed: 0.95,
            })
            const b = Buffer.from(await resp.arrayBuffer())
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

    async function generateOneSlide(idx) {
      const prompt = slidePrompts[idx]
      const parts = []
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
            config: { responseFormat: { image: { aspectRatio: '16:9', imageSize: '4K' } } },
          })
          const rParts = response.candidates?.[0]?.content?.parts ?? []
          for (const rp of rParts) {
            if (rp.inlineData) {
              let slideBuf = Buffer.from(rp.inlineData.data, 'base64')
              const sharp = require('sharp')
              slideBuf = await sharp(slideBuf).resize(1920, 1080, { fit: 'cover' }).png().toBuffer()
              if (logoBase64) {
                try {
                  const logoBuf = Buffer.from(logoBase64, 'base64')
                  const logoResized = await sharp(logoBuf).resize(200, 70, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
                  slideBuf = await sharp(slideBuf).composite([{ input: logoResized, top: 40, left: 40 }]).png().toBuffer()
                } catch (e) { console.log(`[${videoId}] Logo composite failed:`, e.message) }
              } else if (brandName) {
                try {
                  const safeName = brandName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                  const textSvg = Buffer.from('<svg width="400" height="60" xmlns="http://www.w3.org/2000/svg"><text x="0" y="42" font-size="32" font-weight="800" font-family="sans-serif" fill="' + (safeBrandColors.primary || '#1B365D') + '">' + safeName + '</text></svg>')
                  const textBuf = await sharp(textSvg).png().toBuffer()
                  slideBuf = await sharp(slideBuf).composite([{ input: textBuf, top: 40, left: 40 }]).png().toBuffer()
                } catch (e) { console.log(`[${videoId}] Brand name composite failed:`, e.message) }
              }
              return slideBuf
            }
          }
          throw new Error('No image in Gemini response')
        } catch (retryErr) {
          console.error(`[${videoId}] Slide ${idx + 1} attempt ${attempt}/3 failed:`, retryErr.message?.slice(0, 150))
          if (attempt < 3) await new Promise(r => setTimeout(r, 3000 * attempt))
        }
      }
      return await generateFallbackSlide(scenes[idx]?.title || `Slide ${idx + 1}`, idx + 1, slidePrompts.length)
    }

    const BATCH_SIZE = 2
    for (let i = 0; i < slidePrompts.length; i += BATCH_SIZE) {
      const batch = []
      for (let j = i; j < Math.min(i + BATCH_SIZE, slidePrompts.length); j++) {
        batch.push(generateOneSlide(j).then(buf => { slideBuffers[j] = buf }))
      }
      await Promise.all(batch)
      const done = Math.min(i + BATCH_SIZE, slidePrompts.length)
      console.log(`[${videoId}] Slides ${done}/${slidePrompts.length} done`)
      const slidePct = 22 + Math.round((done / slidePrompts.length) * 43)
      await updateStatus('generating_slides', `Designing slide ${done} of ${slidePrompts.length}... (audio ${audiosDone}/${scenes.length})`, slidePct)
    }
    console.log(`[${videoId}] Slides complete: ${slideBuffers.length}`)

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

    // Create clips
    const clipFiles = []
    const durations = []
    for (let i = 0; i < slideBuffers.length; i++) {
      await updateStatus('assembling', `Encoding clip ${i + 1} of ${slideBuffers.length}...`, 68 + Math.round(((i + 1) / slideBuffers.length) * 15))
      const clipPath = join(workDir, `clip_${i}.mp4`)
      const slidePath = join(workDir, `slide_${i}.png`)
      const audioPath = join(workDir, `audio_${i}.mp3`)
      const vf = 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2'

      if (audioBuffers[i] && audioBuffers[i].length > 100) {
        // Probe the real audio length and show the slide for exactly that long
        // (+0.8s tail) via -t. We deliberately do NOT use -shortest: with
        // -loop 1 + -tune stillimage's sparse keyframes, -shortest rounds to a
        // GOP boundary and can drop the clip's audio entirely (it silenced the
        // shortest narration — the closing slide).
        const realDur = await probeAudioDuration(audioPath)
        const slideDuration = realDur > 0 ? realDur + 0.8 : Math.round(audioBuffers[i].length / 16000) + 1
        await runFfmpeg(['-loop', '1', '-i', slidePath, '-i', audioPath, '-c:v', 'libx264', '-tune', 'stillimage', '-c:a', 'aac', '-b:a', '192k', '-pix_fmt', 'yuv420p', '-vf', vf, '-t', String(slideDuration), '-y', clipPath])
      } else {
        // Silent slide — but it MUST still carry an AAC audio track. The concat
        // step uses `-c copy`, which needs every segment to have the same stream
        // layout; a clip made with `-an` (no audio) makes ffmpeg drop audio for
        // every clip AFTER it (the "audio cuts out partway through" bug). So mux
        // in a generated silent track instead of using -an.
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

      // Get accurate duration
      try {
        const dur = await new Promise((resolve) => {
          execFile('ffprobe', ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', clipPath], { timeout: 10000 }, (err, stdout) => {
            resolve(err ? 5 : parseFloat(stdout.trim()) || 5)
          })
        })
        durations.push(dur)
      } catch { durations.push(5) }
    }

    // Concatenate
    await updateStatus('assembling', 'Joining clips together...', 85)
    const concatFile = join(workDir, 'concat.txt')
    await writeFile(concatFile, clipFiles.map(f => `file '${f}'`).join('\n'))
    const outputPath = join(workDir, 'output.mp4')
    await runFfmpeg(['-f', 'concat', '-safe', '0', '-i', concatFile, '-c', 'copy', '-movflags', '+faststart', '-y', outputPath])

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
        const genai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })

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
              `[1:a]volume=0.07,afade=t=in:st=0:d=2,afade=t=out:st=${fadeOutStart}:d=3[music];[0:a][music]amix=inputs=2:duration=first[out]`,
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
