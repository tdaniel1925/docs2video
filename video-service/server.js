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
const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

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
            `[1:a]volume=0.12,afade=t=in:st=0:d=2,afade=t=out:st=${fadeOutStart}:d=3[music];[0:a][music]amix=inputs=2:duration=first[out]`,
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
        duration: totalDuration,
        slide_durations: durations,
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
  const { videoId, policyData, brandId, voiceId, styleId, scenes, userId } = req.body

  if (!videoId || !scenes?.length || !userId) {
    return res.status(400).json({ error: 'Missing videoId, scenes, or userId' })
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
    console.log(`[${videoId}] FULL PIPELINE: ${scenes.length} scenes, voice=${voiceId}, style=${styleId}`)

    // STAGE 1+2: Generate audio AND slides IN PARALLEL
    await updateStatus('generating_audio', `Generating audio and slides...`, 10)
    const OpenAI = require('openai')
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY })

    // Audio runs in background
    const audioPromise = (async () => {
      const buffers = []
      for (let i = 0; i < scenes.length; i += 5) {
        const batch = scenes.slice(i, Math.min(i + 5, scenes.length))
        const results = await Promise.all(batch.map(async (scene) => {
          if (!scene.narration?.trim()) return Buffer.alloc(0)
          try {
            const resp = await openai.audio.speech.create({
              model: 'tts-1-hd', voice: voiceId || 'nova',
              input: scene.narration.slice(0, 4096), response_format: 'mp3', speed: 0.95,
            })
            return Buffer.from(await resp.arrayBuffer())
          } catch (e) {
            console.error(`[${videoId}] TTS failed:`, e.message)
            return Buffer.alloc(0)
          }
        }))
        buffers.push(...results)
        console.log(`[${videoId}] Audio ${Math.min(i + 5, scenes.length)}/${scenes.length}`)
      }
      console.log(`[${videoId}] Audio complete: ${buffers.length} clips`)
      return buffers
    })()

    // Slides run in parallel with audio
    await updateStatus('generating_slides', `Designing slides...`, 30)
    const { GoogleGenAI } = require('@google/genai')
    const genai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })
    const IMAGE_MODEL = process.env.IMAGE_MODEL || 'gemini-3-pro-image-preview'

    // Get brand data
    let brand = null
    if (brandId) {
      const { data } = await supabase.from('brands').select('*').eq('id', brandId).single()
      brand = data
    }
    const colors = {
      primary: brand?.primary_color || '#1B365D',
      secondary: brand?.secondary_color || '#4A90D9',
      accent: brand?.accent_color || '#FFB347',
      background: brand?.background_color || '#0a1628',
      text: brand?.text_color || '#FFFFFF',
    }

    // Load template reference
    const fs = require('fs')
    const path = require('path')
    let templateRefBase64 = null
    try {
      // Try to fetch from the deployed site
      const refUrl = `https://docs2video.com/style-previews/${styleId || 'executive'}.png`
      const refRes = await fetch(refUrl)
      if (refRes.ok) templateRefBase64 = Buffer.from(await refRes.arrayBuffer()).toString('base64')
    } catch {}

    const slideBuffers = []
    for (let i = 0; i < scenes.length; i += 5) {
      const batch = scenes.slice(i, Math.min(i + 5, scenes.length))
      const results = await Promise.all(batch.map(async (scene, j) => {
        const idx = i + j
        const isFirst = idx === 0
        const isLast = idx === scenes.length - 1
        try {
          const parts = []

          // Build slide prompt
          let visualContent
          if (isFirst) {
            visualContent = 'Create a beautiful DECORATIVE BACKGROUND for a cover slide. Do NOT include any text, titles, logos, or brand names. Design an elegant background with a clear central area for an overlay.'
          } else if (isLast) {
            visualContent = 'Create a beautiful DECORATIVE BACKGROUND for a closing slide. Do NOT include any text, titles, logos, or brand names.'
          } else {
            visualContent = `Create a professional CONTENT slide. The narration discusses: ${scene.slidePrompt || scene.narration?.slice(0, 200)}. Use icons and data points. Maximum 50 words of text. Keep ALL content in the top 980 pixels — bottom 100px will have a branded bar.`
          }

          const prompt = `Generate a presentation slide image. 1920x1080 pixels, landscape, 16:9.
STYLE: ${styleId || 'executive'} presentation style.
COLORS: Primary ${colors.primary}, Secondary ${colors.secondary}, Accent ${colors.accent}, Background ${colors.background}, Text ${colors.text}
CONTENT: ${visualContent}
RULES: Do NOT render any logos or brand names. Do NOT place content in the bottom 100px.`

          if (templateRefBase64) {
            parts.push({ text: 'Match the visual style of this reference image:' })
            parts.push({ inlineData: { mimeType: 'image/png', data: templateRefBase64 } })
          }
          parts.push({ text: prompt })

          const response = await genai.models.generateContent({
            model: IMAGE_MODEL,
            contents: [{ role: 'user', parts }],
            config: { responseFormat: { image: { aspectRatio: '16:9', imageSize: '4K' } } },
          })

          const respParts = response.candidates?.[0]?.content?.parts ?? []
          for (const rp of respParts) {
            if (rp.inlineData) return Buffer.from(rp.inlineData.data, 'base64')
          }
          throw new Error('No image in response')
        } catch (e) {
          console.error(`[${videoId}] Slide ${idx + 1} failed:`, e.message)
          // Return a blank slide as fallback
          return Buffer.alloc(100)
        }
      }))
      slideBuffers.push(...results)
      const done = Math.min(i + 5, scenes.length)
      console.log(`[${videoId}] Slides ${done}/${scenes.length}`)
      await updateStatus('generating_slides', `Designed ${done} of ${scenes.length} slides...`, 30 + Math.round((done / scenes.length) * 35))
    }
    console.log(`[${videoId}] Slides complete: ${slideBuffers.length}`)

    // Wait for audio to finish (it ran in parallel with slides)
    const audioBuffers = await audioPromise
    console.log(`[${videoId}] Audio + slides both done`)

    // STAGE 2.5: Sharp overlays — cover title, bottom bar with logo, closing
    await updateStatus('generating_slides', 'Adding branding...', 68)
    const sharp = require('sharp')

    // Get brand logo + contact info
    let logoBuffer = null
    const logoUrl = brand?.logo_file_url || brand?.logo_url || null
    if (logoUrl) {
      try {
        const logoRes = await fetch(logoUrl, { signal: AbortSignal.timeout(8000) })
        if (logoRes.ok) logoBuffer = Buffer.from(await logoRes.arrayBuffer())
      } catch (e) { console.log(`[${videoId}] Logo fetch failed:`, e.message) }
    }

    const brandGuide = brand?.brand_guide_data || {}
    const contactPhone = brandGuide.phone || ''
    const contactWebsite = brandGuide.website || ''
    const brandName = brand?.name || ''

    // Helper: escape XML
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

    // Generate bottom bar with logo + contact info for middle slides
    let bottomBarBuffer = null
    if (logoBuffer || brandName) {
      const barH = 100
      const w = 1920, h = 1080
      const hex = (colors.primary || '#1B365D').replace('#', '')
      const r = parseInt(hex.substring(0, 2), 16) || 20
      const g = parseInt(hex.substring(2, 4), 16) || 20
      const b = parseInt(hex.substring(4, 6), 16) || 40

      // Resize logo for bar
      let logoForBar = null
      let logoW = 0
      if (logoBuffer) {
        logoForBar = await sharp(logoBuffer).resize(140, 50, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
        const meta = await sharp(logoForBar).metadata()
        logoW = meta.width || 140
      }

      // Build bar SVG with contact info
      const contactText = [contactPhone, contactWebsite].filter(Boolean).join('  |  ')
      const barSvg = Buffer.from(`<svg width="${w}" height="${barH}" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="${w}" height="1" fill="${colors.text || '#fff'}" fill-opacity="0.15"/>
        <rect x="0" y="1" width="${w}" height="${barH - 1}" fill="rgb(${r},${g},${b})" fill-opacity="0.95"/>
        <text x="${w / 2}" y="${barH / 2 + 5}" font-family="Arial, sans-serif" font-size="14" fill="${colors.text || '#fff'}" fill-opacity="0.7" text-anchor="middle">${esc(contactText)}</text>
      </svg>`)

      const barPng = await sharp(barSvg).png().toBuffer()
      const composites = [{ input: barPng, left: 0, top: h - barH }]

      if (logoForBar) {
        composites.push({ input: logoForBar, left: 40, top: h - barH + Math.round((barH - 50) / 2) })
      }

      bottomBarBuffer = await sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite(composites).png().toBuffer()
      console.log(`[${videoId}] Bottom bar generated`)
    }

    // Generate cover overlay (logo + title)
    let coverOverlayBuffer = null
    if (logoBuffer) {
      const w = 1920, h = 1080
      const logoMaxW = 500, logoMaxH = 280
      const resizedLogo = await sharp(logoBuffer).resize(logoMaxW, logoMaxH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
      const logoMeta = await sharp(resizedLogo).metadata()
      const lw = logoMeta.width || logoMaxW, lh = logoMeta.height || logoMaxH
      const logoLeft = Math.round((w - lw) / 2), logoTop = Math.round(h * 0.18)

      const title = (policyData?.title || policyData?.policyType || 'Presentation').slice(0, 80)
      const subtitle = policyData?.subtitle || brandName || ''
      const textY = logoTop + lh + 50
      const svgText = Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
        <text x="${w / 2 + 1}" y="${textY + 2}" font-family="Arial, sans-serif" font-size="52" font-weight="bold" fill="black" fill-opacity="0.4" text-anchor="middle">${esc(title)}</text>
        <text x="${w / 2}" y="${textY}" font-family="Arial, sans-serif" font-size="52" font-weight="bold" fill="${colors.text || '#fff'}" text-anchor="middle">${esc(title)}</text>
        ${subtitle ? `<text x="${w / 2}" y="${textY + 60}" font-family="Arial, sans-serif" font-size="28" fill="${colors.text || '#fff'}" fill-opacity="0.85" text-anchor="middle">${esc(subtitle)}</text>` : ''}
      </svg>`)

      coverOverlayBuffer = await sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([
          { input: resizedLogo, left: logoLeft, top: logoTop },
          { input: svgText, left: 0, top: 0 },
        ]).png().toBuffer()
      console.log(`[${videoId}] Cover overlay generated`)
    }

    // Apply overlays to slides
    for (let i = 0; i < slideBuffers.length; i++) {
      if (slideBuffers[i].length < 200) continue // Skip failed slides
      try {
        const isFirst = i === 0
        const isLast = i === slideBuffers.length - 1
        const overlay = isFirst ? coverOverlayBuffer : (isLast ? coverOverlayBuffer : bottomBarBuffer)
        if (overlay) {
          const resized = await sharp(overlay).resize(1920, 1080, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
          slideBuffers[i] = await sharp(slideBuffers[i]).composite([{ input: resized, left: 0, top: 0 }]).png().toBuffer()
        }
      } catch (e) { console.error(`[${videoId}] Overlay failed for slide ${i}:`, e.message) }
    }
    console.log(`[${videoId}] Overlays applied`)

    // STAGE 3: Assemble with FFmpeg
    await updateStatus('assembling', 'Assembling your video...', 70)
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
      await updateStatus('assembling', `Encoding clip ${i + 1} of ${slideBuffers.length}...`, 70 + Math.round((i / slideBuffers.length) * 15))
      const clipPath = join(workDir, `clip_${i}.mp4`)
      const slidePath = join(workDir, `slide_${i}.png`)
      const audioPath = join(workDir, `audio_${i}.mp3`)
      const vf = 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2'

      if (audioBuffers[i] && audioBuffers[i].length > 100) {
        await runFfmpeg(['-loop', '1', '-i', slidePath, '-i', audioPath, '-c:v', 'libx264', '-tune', 'stillimage', '-c:a', 'aac', '-b:a', '192k', '-pix_fmt', 'yuv420p', '-vf', vf, '-shortest', '-y', clipPath])
      } else {
        await runFfmpeg(['-loop', '1', '-i', slidePath, '-t', '5', '-c:v', 'libx264', '-tune', 'stillimage', '-pix_fmt', 'yuv420p', '-vf', vf, '-an', '-y', clipPath])
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
    await updateStatus('assembling', 'Joining clips together...', 88)
    const concatFile = join(workDir, 'concat.txt')
    await writeFile(concatFile, clipFiles.map(f => `file '${f}'`).join('\n'))
    const outputPath = join(workDir, 'output.mp4')
    await runFfmpeg(['-f', 'concat', '-safe', '0', '-i', concatFile, '-c', 'copy', '-movflags', '+faststart', '-y', outputPath])

    // Read and upload
    await updateStatus('assembling', 'Uploading video...', 92)
    const videoBuffer = await readFile(outputPath)
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

    // Mark complete
    const totalDuration = durations.reduce((s, d) => s + d, 0)
    await supabase.from('videos').update({
      video_url: urlData.publicUrl,
      thumbnail_url: thumbUrlData.publicUrl,
      duration: totalDuration,
      slide_durations: durations,
      slide_urls: slideUrls,
      status: 'completed',
      progress_detail: null,
      progress_pct: 100,
    }).eq('id', videoId)

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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Video assembly service running on port ${PORT}`)
})
