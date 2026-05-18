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

  try {
    await mkdir(workDir, { recursive: true })

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

      console.log(`[${videoId}] Uploaded to Supabase`)

      res.json({
        success: true,
        videoUrl: urlData.publicUrl,
        thumbnailUrl: thumbUrlData.publicUrl,
        durations,
        totalDuration: durations.reduce((s, d) => s + d, 0),
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

    // Convert to PDF first (LibreOffice)
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

    const pdfPath = join(workDir, 'input.pdf')

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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Video assembly service running on port ${PORT}`)
})
