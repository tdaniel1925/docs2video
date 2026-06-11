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
const API_SECRET = process.env.API_SECRET
if (!API_SECRET) {
  console.error('FATAL: API_SECRET env var is required')
  process.exit(1)
}
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY
const GEMINI_API_KEY = process.env.GEMINI_API_KEY

// Gemini slide generation — replaces gpt-image-2 (~10x cheaper at 2K, output is 1080p anyway)
async function geminiSlide(prompt, refImageB64) {
  const { GoogleGenAI } = await import('@google/genai')
  const genai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })
  const parts = [{ text: prompt }]
  if (refImageB64) parts.push({ inlineData: { mimeType: 'image/png', data: refImageB64 } })
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await genai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: [{ role: 'user', parts }],
      config: { responseFormat: { image: { aspectRatio: '16:9', imageSize: '2K' } } },
    })
    const rps = (response.candidates && response.candidates[0] && response.candidates[0].content && response.candidates[0].content.parts) || []
    for (const rp of rps) {
      if (rp.inlineData && rp.inlineData.data) return Buffer.from(rp.inlineData.data, 'base64')
    }
  }
  return null
}


// Cartesia TTS — natural-sounding voices with emotion control
async function openaiTTS(text, voiceId) {
  const voiceMap = { nova: "nova", shimmer: "shimmer", onyx: "onyx", echo: "echo", alloy: "alloy", fable: "fable", ash: "nova", coral: "shimmer" }
  const oaiVoice = voiceMap[voiceId] || "nova"
  const OpenAI = (await import("openai")).default
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const mp3 = await openai.audio.speech.create({ model: "tts-1", voice: oaiVoice, input: text })
  return Buffer.from(await mp3.arrayBuffer())
}

async function cartesiaTTS(text, voiceId, speed = 'normal') {
  const CARTESIA_VOICES = {
    'nova': 'f9fc912e-52f0-448a-8bfa-47e9ca75f25a',     // Marilyn - smooth supportive female narrator
    'shimmer': '58fbaf73-d7de-4e82-a6b3-118180e7057c',   // Janet - bright warm female
    'onyx': '8d110413-2f14-44a2-8203-2104db4340e9',      // Darren - deep friendly baritone male
    'echo': 'd46abd1d-2d02-43e8-819f-51fb652c1c61',      // Grant - reliable clear American male
    'alloy': 'cc00e582-ed66-4004-8336-0175b85c85f6',     // Dana - balanced neutral female
    'fable': 'ab109683-f31f-40d7-b264-9ec3e26fb85e',     // Russell - friendly deep mentor male
    'ash': '820a3788-2b37-4d21-847a-b65d8a68c99a',       // Tyler - direct confident male
    'coral': '829ccd10-f8b3-43cd-b8a0-4aeaa81f3b30',     // Linda - clear confident mature female
  }
  const cVoiceId = CARTESIA_VOICES[voiceId] || CARTESIA_VOICES['nova']

  const res = await fetch('https://api.cartesia.ai/tts/bytes', {
    method: 'POST',
    headers: {
      'Cartesia-Version': '2024-06-10',
      'X-API-Key': CARTESIA_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model_id: 'sonic-2',
      transcript: text,
      voice: { id: cVoiceId },
      output_format: { container: 'mp3', bit_rate: 192000, sample_rate: 44100 },
      speed: speed,
    }),
    signal: AbortSignal.timeout(30000),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => 'unknown')
    throw new Error(`Cartesia TTS failed (${res.status}): ${errText.slice(0, 200)}`)
  }

  return Buffer.from(await res.arrayBuffer())
}

// Auth middleware
function authCheck(req, res, next) {
  const token = req.headers['x-api-secret']
  if (token !== API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

// Health check

// Extract and structure document content using OpenAI
app.post("/extract-document", async (req, res) => {
  try {
    const { fileBase64, fileName, purpose, mimeType } = req.body
    if (!fileBase64) return res.status(400).json({ error: "No file data provided" })

    const OpenAI = (await import("openai")).default
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    // Upload file to OpenAI
    const buffer = Buffer.from(fileBase64, "base64")
    const file = new File([buffer], fileName || "document.pdf", { type: mimeType || "application/pdf" })
    const uploaded = await openai.files.create({ file, purpose: "assistants" })

    // Extract + structure in one call
    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_file", file_id: uploaded.id },
            {
              type: "input_text",
              text: (purpose ? "Purpose: " + purpose + "\n\n" : "") + 'Extract and structure ALL content from this document into JSON. Return ONLY valid JSON:\n{\n  "title": "Main title or document name",\n  "subtitle": "Subtitle or tagline if any",\n  "sections": [{ "title": "Section name", "content": "Full section content" }],\n  "keyMetrics": [{ "value": "stat value", "label": "stat label" }],\n  "contactInfo": { "phone": "phone or null", "email": "email or null", "website": "website or null" },\n  "companyName": "Company name or null"\n}\nInclude ALL content. Never invent contact info.'
            }
          ]
        }
      ],
      text: { format: { type: "json_object" } }
    })

    // Clean up
    await openai.files.delete(uploaded.id).catch(() => {})

    const text = response.output_text || ""
    const cleaned = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "")
    const structured = JSON.parse(cleaned)
    console.log("[extract-document] Extracted:", structured.title || "untitled", "- sections:", structured.sections?.length || 0)
    res.json(structured)
  } catch (err) {
    console.error("[extract-document] Error:", err.message)
    res.status(500).json({ error: err.message || "Extraction failed" })
  }
})

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
        const rd=0;
        const cd=Math.ceil(require('fs').statSync(audioPath).size/16000)+1;
        console.log(`[${videoId}] Slide ${i+1}: audio=${rd.toFixed(1)}s clip=${cd.toFixed(1)}s`);
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
          '-t', String(cd),
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
function probeAudioDuration(p){return new Promise(r=>{execFile('ffmpeg',['-i',p,'-f','null','-'],{timeout:10000},(_,__,se)=>{const m=se.match(/Duration: (\d+):(\d+):(\d+)\.(\d+)/);r(m?parseInt(m[1])*3600+parseInt(m[2])*60+parseInt(m[3])+parseInt(m[4])*10/1000:0)})})}

// --- COVER SLIDE GENERATION ---
async function generateCoverSlide(opts) {
  const { title, companyName, logoUrl, brandColors, stylePrompt, type, contactInfo } = opts
  const OpenAI = (await import('openai')).default
  const sharp = (await import('sharp')).default
  const oi = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const bgPrompt = type === 'cover'
    ? 'Create a stunning vibrant illustrated background for a premium video title card. 1920x1080 landscape. ' + (stylePrompt || '') + ' Use brand colors prominently: primary ' + (brandColors?.primary || '#1B365D') + ', secondary ' + (brandColors?.secondary || '#4A90D9') + '. Rich depth, layered composition, dramatic lighting. Abstract shapes and visual metaphors. The CENTER should have lighter/clearer space for a logo. NO TEXT NO LOGOS NO WORDS. Pure illustrated artwork.'
    : 'Create a stunning illustrated background for a video closing card. 1920x1080 landscape. ' + (stylePrompt || '') + ' Use brand colors: primary ' + (brandColors?.primary || '#1B365D') + ', secondary ' + (brandColors?.secondary || '#4A90D9') + '. Warm hopeful conclusion — open door with warm light, path to bright horizon. CENTER should have clear space for logo and contact info. NO TEXT NO LOGOS NO WORDS. Pure illustrated artwork.'

  let bgBuf = await geminiSlide(bgPrompt)
  if (!bgBuf) throw new Error('Cover background generation failed')
  bgBuf = await sharp(bgBuf).resize(1920, 1080, { fit: 'cover' }).png().toBuffer()

  const composites = []

  // Load logo if available
  let logoH = 0
  let logoTop = 340
  if (logoUrl) {
    try {
      let logoBuf = null
      if (logoUrl.startsWith('data:')) {
        logoBuf = Buffer.from(logoUrl.split(',')[1], 'base64')
      } else {
        const logoRes = await fetch(logoUrl, { signal: AbortSignal.timeout(10000) })
        if (logoRes.ok) logoBuf = Buffer.from(await logoRes.arrayBuffer())
      }
      if (logoBuf) {
        const resized = await sharp(logoBuf).resize(550, null, { fit: 'inside' }).png().toBuffer()
        const meta = await sharp(resized).metadata()
        const lw = meta.width || 550
        logoH = meta.height || 220
        logoTop = type === 'cover' ? Math.round((1080 - logoH) / 2) - 60 : Math.round((1080 - logoH) / 2) - 80

        // Shadow behind logo for contrast
        const shadow = Buffer.from('<svg width="' + (lw + 80) + '" height="' + (logoH + 60) + '"><defs><filter id="b"><feGaussianBlur stdDeviation="20"/></filter></defs><rect x="10" y="10" width="' + (lw + 60) + '" height="' + (logoH + 40) + '" rx="20" fill="rgba(0,0,0,0.4)" filter="url(#b)"/></svg>')
        composites.push({ input: shadow, top: logoTop - 20, left: Math.round((1920 - lw) / 2) - 40 })
        composites.push({ input: resized, top: logoTop, left: Math.round((1920 - lw) / 2) })
      }
    } catch (e) { console.log('[cover] Logo load failed:', e.message?.slice(0, 80)) }
  }

  // Title/text overlay
  const textY = logoUrl && logoH > 0 ? logoTop + logoH + 50 : 420
  const safeTitle = (title || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const safeName = (companyName || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  let svgText = ''
  if (type === 'cover') {
    svgText = '<svg width="1920" height="1080"><text x="960" y="' + textY + '" font-family="Arial,sans-serif" font-size="38" font-weight="800" fill="white" text-anchor="middle" letter-spacing="1">' + safeTitle + '</text>'
    if (companyName && !logoUrl) {
      svgText += '<text x="960" y="' + (textY + 50) + '" font-family="Arial,sans-serif" font-size="26" font-weight="600" fill="white" opacity="0.85" text-anchor="middle">' + safeName + '</text>'
    }
    svgText += '</svg>'
  } else {
    const contactParts = []
    if (companyName) contactParts.push(companyName)
    if (contactInfo?.website) contactParts.push(contactInfo.website)
    if (contactInfo?.phone) contactParts.push(contactInfo.phone)
    if (contactInfo?.email) contactParts.push(contactInfo.email)
    const contactStr = contactParts.join('  \u00B7  ').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    svgText = '<svg width="1920" height="1080"><text x="960" y="' + textY + '" font-family="Arial,sans-serif" font-size="44" font-weight="800" fill="white" text-anchor="middle">Thank You</text><text x="960" y="' + (textY + 55) + '" font-family="Arial,sans-serif" font-size="24" font-weight="700" fill="white" opacity="0.9" text-anchor="middle">Ready to take the next step?</text>'
    if (contactStr) {
      svgText += '<rect x="360" y="' + (textY + 80) + '" width="1200" height="50" rx="8" fill="rgba(0,0,0,0.3)"/><text x="960" y="' + (textY + 112) + '" font-family="Arial,sans-serif" font-size="20" font-weight="600" fill="white" opacity="0.8" text-anchor="middle">' + contactStr + '</text>'
    }
    svgText += '</svg>'
  }
  composites.push({ input: Buffer.from(svgText), top: 0, left: 0 })

  return sharp(bgBuf).composite(composites).png().toBuffer()
}
// --- END COVER SLIDE GENERATION ---


app.post('/generate', authCheck, async (req, res) => {
  const { videoId, voiceId, scenes, userId, slidePrompts, logoUrl, musicPrompt, industry, narrationStyle } = req.body

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

    const brandName = (req.body && req.body.brandName) || null;
    const brandColors = (req.body && req.body.brandColors) || {primary:"#1B365D",secondary:"#4A90D9",text:"#FFFFFF"};
    const noContactBar = (req.body && req.body.noContactBar) || false;
    const slideNarrations = (req.body && req.body.slideNarrations) || null;

    console.log(`[${videoId}] FULL PIPELINE: ${scenes.length} scenes, voice=${voiceId}, ${slidePrompts.length} prompts`)
    const coverImageBase64 = req.body.coverImageBase64 || null
    const closingImageBase64 = req.body.closingImageBase64 || null
    console.log(`[${videoId}] Flipbook check: slidePrompts[0] isArray=${Array.isArray(slidePrompts[0])}, length=${Array.isArray(slidePrompts[0]) ? slidePrompts[0].length : 'N/A'}`)

    // STAGE 1+2: Generate audio AND slides IN PARALLEL
    await updateStatus('generating_audio', 'Generating audio and slides...', 20)
    const OpenAI = require('openai')
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY })

    const podcastWorkDir = join(tmpdir(), `d2v-podcast-${randomUUID()}`)
    // Audio runs in background — updates progress per clip
    let audiosDone = 0
    const audioPromise = (async () => {
      const buffers = []
      // Use per-slide narrations if available (flat 1:1 with slidePrompts)
      const narrationSource = slideNarrations && slideNarrations.length > 0 ? slideNarrations : null
      const narrationCount = narrationSource ? narrationSource.length : scenes.length
    // Variables extracted from request body (must be before batch loop)

      for (let i = 0; i < narrationCount; i++) {
        const scene = i < scenes.length ? scenes[i] : scenes[scenes.length - 1]
        const narrationText = narrationSource ? narrationSource[i] : scene.narration
        if (!narrationText?.trim()) {
          buffers.push(Buffer.alloc(0))
          audiosDone++
          continue
        }
        if (narrationStyle === 'podcast' && scene.dialogue && scene.dialogue.length > 0) {
          try {
            const dClips = []
            for (const line of scene.dialogue) {
              const audioBuf = await cartesiaTTS(line.text.slice(0, 4096), line.voice || 'coral')
              dClips.push(audioBuf)
            }
            const dDir = join(tmpdir(), `dlg-${randomUUID()}`)
            await mkdir(dDir, { recursive: true })
            const fList = []
            for (let d = 0; d < dClips.length; d++) {
              const cp = join(dDir, `l${d}.mp3`)
              await writeFile(cp, dClips[d])
              fList.push(`file '${cp}'`)
            }
            await writeFile(join(dDir, 'list.txt'), fList.join('\n'))
            const op = join(dDir, 'out.mp3')
            await runFfmpeg(['-f', 'concat', '-safe', '0', '-i', join(dDir, 'list.txt'), '-c', 'copy', '-y', op])
            buffers.push(await readFile(op))
            await rm(dDir, { recursive: true, force: true }).catch(() => {})
          } catch (e) {
            console.error(`[${videoId}] Podcast TTS failed ${i + 1}:`, e.message)
            try {
              const audioBuf = await cartesiaTTS(narrationText.slice(0, 4096), voiceId || 'nova')
              buffers.push(audioBuf)
            } catch (e2) { buffers.push(Buffer.alloc(0)) }
          }
        } else {
          try {
            const audioBuf = await cartesiaTTS(narrationText.slice(0, 4096), voiceId || 'nova')
            buffers.push(audioBuf)
          } catch (e) {
            console.log(`[${videoId}] Cartesia failed clip ${i + 1}: ${e.message}, trying OpenAI...`)
            try {
              const fb = await openaiTTS(narrationText.slice(0, 4096), voiceId || "nova")
              buffers.push(fb)
              console.log(`[${videoId}] OpenAI fallback OK clip ${i + 1}`)
            } catch (e2) {
              console.error(`[${videoId}] All TTS failed clip ${i + 1}:`, e2.message)
              buffers.push(Buffer.alloc(0))
            }
          }
        }
        audiosDone++
        console.log(`[${videoId}] Audio ${audiosDone}/${scenes.length}`)
      }
      console.log(`[${videoId}] Audio complete: ${buffers.length} clips`)
      return buffers
    })()

    // Slides: OpenAI GPT Image — one at a time with per-slide progress
    await updateStatus('generating_slides', 'Preparing slide designs...', 22)

    // Fetch logo image if available (for reference in prompts)
    let logoBase64 = null
    if (logoUrl) {
      try {
        if (logoUrl.startsWith('data:')) {
          // Data URL — extract base64 directly, no fetch needed
          logoBase64 = logoUrl.split(',')[1]
          console.log(`[${videoId}] Logo from data URL: ${(logoBase64.length / 1024).toFixed(0)}KB`)
        } else {
          // HTTP URL — fetch from storage/web
          const logoRes = await fetch(logoUrl, { signal: AbortSignal.timeout(8000) })
          if (logoRes.ok) logoBase64 = Buffer.from(await logoRes.arrayBuffer()).toString('base64')
        }
      } catch (e) { console.log(`[${videoId}] Logo fetch failed:`, e.message) }
    }

    // Generate slides in parallel batches of 2 for speed
    const slideBuffers = new Array(slidePrompts.length).fill(null)

    // --- FLIPBOOK SUPPORT ---
    function isFlipbookMode(idx) {
      return Array.isArray(slidePrompts[idx])
    }

    async function generateFlipbookFrames(idx) {
      const frames = slidePrompts[idx]
      const fbufs = []
      for (let f = 0; f < frames.length; f++) {
        for (let att = 1; att <= 2; att++) {
          try {
            const img = await geminiSlide(frames[f])
            if (!img) throw new Error('No image')
            fbufs.push(img)
            break
          } catch (e) {
            console.error('[' + videoId + '] Flipbook frame ' + (f+1) + ' scene ' + (idx+1) + ' attempt ' + att + ': ' + (e.message||'').slice(0,80))
            if (att === 2) fbufs.push(fbufs.length > 0 ? fbufs[fbufs.length-1] : await generateFallbackSlide(scenes[idx]?.title || 'Slide', idx+1, slidePrompts.length))
            else await new Promise(r => setTimeout(r, 2000))
          }
        }
      }
      console.log('[' + videoId + '] Flipbook scene ' + (idx+1) + ': ' + fbufs.length + ' frames')
      return fbufs
    }
    // --- END FLIPBOOK SUPPORT ---

    async function generateOneSlide(idx) {
      const prompt = slidePrompts[idx]
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          // Generate slide via Gemini (no logo in prompt — Sharp composites it after)
          const geminiBuf = await geminiSlide(prompt)
          if (!geminiBuf) throw new Error('No image in response')
          let slideBuf = geminiBuf

          // Composite actual logo on top with Sharp
          if (logoBase64) {
            try {
              const sharp = require('sharp')
              const logoBuf = Buffer.from(logoBase64, 'base64')
              const logoResized = await sharp(logoBuf)
                .resize(560, 320, { fit: 'inside', withoutEnlargement: true })
                .png()
                .toBuffer()
              const logoMeta = await sharp(logoResized).metadata()
              const lw = logoMeta.width || 140
              slideBuf = await sharp(slideBuf)
                .composite([{ input: logoResized, top: 15, left: 1920 - lw - 15 }])
                .png()
                .toBuffer()
            console.log(`[${videoId}] Logo composited on slide ${idx + 1}`)
            } catch (e) { console.log(`[${videoId}] Logo composite failed on slide ${idx + 1}:`, e.message) }
          }
          return slideBuf
        } catch (retryErr) {
          console.error(`[${videoId}] Slide ${idx + 1} attempt ${attempt}/3 failed:`, retryErr.message?.slice(0, 150))
          // If logo is invalid, disable it and retry with images.generate instead
          if (retryErr.message?.includes('Invalid image') && logoBase64) {
            console.log(`[${videoId}] Logo image invalid for OpenAI, disabling logo for remaining slides`)
            logoBase64 = null
          }
          if (attempt < 3) await new Promise(r => setTimeout(r, 3000 * attempt))
        }
      }
      console.error(`[${videoId}] Slide ${idx + 1} all attempts failed, generating fallback`)
      return await generateFallbackSlide(scenes[idx]?.title || `Slide ${idx + 1}`, idx + 1, slidePrompts.length)
    }

    const BATCH_SIZE = 7
    for (let i = 0; i < slidePrompts.length; i += BATCH_SIZE) {
      const batch = []
      for (let j = i; j < Math.min(i + BATCH_SIZE, slidePrompts.length); j++) {
        batch.push(((j === 0) ? generateCoverSlide({ title: req.body.videoTitle || scenes[0]?.title || 'Presentation', companyName: brandName, logoUrl: req.body.logoUrl, brandColors, stylePrompt: slidePrompts[0]?.slice(0, 200) || '', type: 'cover' }) : (j === slidePrompts.length - 1) ? generateCoverSlide({ title: req.body.videoTitle || 'Thank You', companyName: brandName, logoUrl: req.body.logoUrl, brandColors, stylePrompt: slidePrompts[0]?.slice(0, 200) || '', type: 'closing', contactInfo: req.body.contactForClosing }) : (isFlipbookMode(j) ? generateFlipbookFrames(j) : generateOneSlide(j))).then(buf => { slideBuffers[j] = buf }))
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

    // STAGE 3: Assemble with FFmpeg (no Sharp overlays needed — OpenAI bakes everything in)
    await updateStatus('assembling', 'Assembling your video...', 68)
    const workDir = join(tmpdir(), `d2v-${randomUUID()}`)
    await mkdir(workDir, { recursive: true })

    // Write files
    for (let i = 0; i < slideBuffers.length; i++) {
      {
        const sb = slideBuffers[i]
        await writeFile(join(workDir, `slide_${i}.png`), Array.isArray(sb) ? sb[0] : sb)
      }
      if (audioBuffers[i] && audioBuffers[i].length > 0) {
        await writeFile(join(workDir, `audio_${i}.mp3`), audioBuffers[i])
      }
    }

    // Ensure every slide has audio — regenerate any missing clips
    while (audioBuffers.length < slideBuffers.length) {
      console.log(`[${videoId}] Missing audio for slide ${audioBuffers.length + 1}, generating...`)
      const missingIdx = audioBuffers.length
      const missingScene = scenes[missingIdx]
      if (missingScene?.narration?.trim()) {
        try {
          const audioBuf = await cartesiaTTS(missingScene.narration.slice(0, 4096), voiceId || 'nova')
          audioBuffers.push(audioBuf)
        } catch (e) {
          console.log(`[${videoId}] Failed to generate missing audio ${missingIdx + 1}:`, e.message)
          audioBuffers.push(Buffer.alloc(0))
        }
      } else {
        audioBuffers.push(Buffer.alloc(0))
      }
    }
    // Write any newly generated audio files
    for (let i = 0; i < audioBuffers.length; i++) {
      const audioPath = join(workDir, `audio_${i}.mp3`)
      if (audioBuffers[i] && audioBuffers[i].length > 0) {
        await writeFile(audioPath, audioBuffers[i])
      }
    }

    if(audioBuffers.length!==slideBuffers.length){console.warn(`[${videoId}] Audio-slide count mismatch: ${audioBuffers.length} audio vs ${slideBuffers.length} slides`);while(audioBuffers.length<slideBuffers.length)audioBuffers.push(Buffer.alloc(0));if(audioBuffers.length>slideBuffers.length)audioBuffers.length=slideBuffers.length;}

    // Create clips
    const clipFiles = []
    const durations = []
    for (let i = 0; i < slideBuffers.length; i++) {
      await updateStatus('assembling', `Encoding clip ${i + 1} of ${slideBuffers.length}...`, 68 + Math.round(((i + 1) / slideBuffers.length) * 15))
      const clipPath = join(workDir, `clip_${i}.mp4`)
      const slidePath = join(workDir, `slide_${i}.png`)
      const audioPath = join(workDir, `audio_${i}.mp3`)
      const vf = 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2'

      if (false && Array.isArray(slideBuffers[i]) && slideBuffers[i].length > 1) {
        // FLIPBOOK: smooth crossfade between frames
        const frames = slideBuffers[i]
        const fdir = join(workDir, 'frames_' + i)
        await mkdir(fdir, { recursive: true })
        for (let f = 0; f < frames.length; f++) {
          await writeFile(join(fdir, 'f' + f + '.png'), frames[f])
        }
        const hasAudio = audioBuffers[i] && audioBuffers[i].length > 100
        let audioDur = 5
        if (hasAudio) {
          try {
            audioDur = await new Promise((resolve) => {
              execFile('ffprobe', ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', audioPath], { timeout: 10000 }, (err, stdout) => {
                const d = parseFloat(stdout)
                resolve(err || isNaN(d) ? 10 : Math.ceil(d) + 1)
              })
            })
          } catch { audioDur = 10 }
        }
        const fadeDur = 0.4
        const frameDur = Math.max(2, (audioDur / frames.length))
        console.log('[' + videoId + '] Flipbook clip ' + (i+1) + ': ' + frames.length + ' frames, ' + audioDur + 's audio, ' + frameDur.toFixed(1) + 's/frame')

        // Build FFmpeg args with xfade crossfade between frames
        const ffArgs = []
        for (let f = 0; f < frames.length; f++) {
          ffArgs.push('-loop', '1', '-t', String(frameDur + fadeDur), '-i', join(fdir, 'f' + f + '.png'))
        }
        if (hasAudio) ffArgs.push('-i', audioPath)

        // Build filter: scale each input, then chain xfade transitions
        const vf = 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1'
        let filterParts = []
        for (let f = 0; f < frames.length; f++) {
          filterParts.push('[' + f + ':v]' + vf + '[v' + f + ']')
        }

        if (frames.length === 1) {
          // Single frame — just use it directly
          ffArgs.push('-filter_complex', filterParts[0].replace('[v0]', '[vout]'))
          ffArgs.push('-map', '[vout]')
        } else if (frames.length === 2) {
          filterParts.push('[v0][v1]xfade=transition=fade:duration=' + fadeDur + ':offset=' + (frameDur - fadeDur).toFixed(2) + '[vout]')
          ffArgs.push('-filter_complex', filterParts.join(';'))
          ffArgs.push('-map', '[vout]')
        } else {
          // 3+ frames: chain xfade
          let prevLabel = 'v0'
          for (let f = 1; f < frames.length; f++) {
            const offset = (f * frameDur - fadeDur * f).toFixed(2)
            const outLabel = f === frames.length - 1 ? 'vout' : 'xf' + f
            filterParts.push('[' + prevLabel + '][v' + f + ']xfade=transition=fade:duration=' + fadeDur + ':offset=' + offset + '[' + outLabel + ']')
            prevLabel = outLabel
          }
          ffArgs.push('-filter_complex', filterParts.join(';'))
          ffArgs.push('-map', '[vout]')
        }

        if (hasAudio) {
          ffArgs.push('-map', String(frames.length) + ':a', '-c:a', 'aac', '-b:a', '192k', '-af', 'adelay=300|300')
        } else {
          ffArgs.push('-an')
        }
        ffArgs.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '26', '-pix_fmt', 'yuv420p', '-y', clipPath)
        await runFfmpeg(ffArgs)
      } else if (audioBuffers[i] && audioBuffers[i].length > 100) {
        // LEGACY: single slide + audio
        await runFfmpeg(['-loop', '1', '-i', slidePath, '-i', audioPath, '-c:v', 'libx264', '-tune', 'stillimage', '-c:a', 'aac', '-b:a', '192k', '-pix_fmt', 'yuv420p', '-vf', vf, '-af', 'adelay=300|300', '-shortest', '-y', clipPath])
      } else {
        // LEGACY: single slide, no audio
        await runFfmpeg(['-loop', '1', '-i', slidePath, '-t', '5', '-c:v', 'libx264', '-tune', 'stillimage', '-pix_fmt', 'yuv420p', '-vf', vf, '-an', '-y', clipPath])
      }
      // Composite 100px branded bar at bottom of clip
      // Skip bar on cover, closing, or if opted out
      if (!noContactBar && i > 0 && i < slideBuffers.length - 1) {
const barColor = brandColors?.primary || '#1B365D'
      const barTextColor = brandColors?.text || '#FFFFFF'
      const contactParts = []
      if (scenes[i]?.contactInfo?.company || brandName) contactParts.push(scenes[i]?.contactInfo?.company || brandName)
      if (scenes[i]?.contactInfo?.website) contactParts.push(scenes[i]?.contactInfo?.website)
      if (scenes[i]?.contactInfo?.phone) contactParts.push(scenes[i]?.contactInfo?.phone)
      if (scenes[i]?.contactInfo?.email) contactParts.push(scenes[i]?.contactInfo?.email)
      const barText = contactParts.length > 0 ? contactParts.join('  ·  ') : ''

      if (barText) {
        const barClipPath = join(workDir, 'bar_clip_' + i + '.mp4')
        try {
          // Pad video to 1920x1080 with colored bar at bottom, add text
          const barFilter = `[0:v] '0x')},drawtext=text='${barText.replace(/'/g, "\\'")}':fontsize=22:fontcolor=${barTextColor.replace('#', '0x')}:x=(w-text_w)/2:y=h-60:fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf[v]`
          const barArgs = ['-i', clipPath, '-filter_complex', barFilter, '-map', '[v]']
          // Preserve audio if present
          const hasClipAudio = audioBuffers[i] && audioBuffers[i].length > 100
          if (hasClipAudio) barArgs.push('-map', '0:a', '-c:a', 'copy')
          else barArgs.push('-an')
          barArgs.push('-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-y', barClipPath)
          await runFfmpeg(barArgs)
          // Replace original clip with bar version
          await require('fs').promises.rename(barClipPath, clipPath)
          console.log('[' + videoId + '] Bar composited on clip ' + (i+1) + ': ' + barText)
        } catch (barErr) {
          console.error('[' + videoId + '] Bar composite failed for clip ' + (i+1) + ':', barErr.message?.slice(0, 100))
          // Continue with original clip (no bar)
        }
      }
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
    // Build xfade crossfade between clips
    const fadeDur = 0.4
    if (clipFiles.length <= 1) {
      // Single clip — just copy
      await runFfmpeg(['-i', clipFiles[0], '-c', 'copy', '-movflags', '+faststart', '-y', outputPath])
    } else if (clipFiles.length <= 20) {
      // Multiple clips — xfade crossfade between them
      const xfArgs = []
      for (const cf of clipFiles) { xfArgs.push('-i', cf) }

      // Build xfade filter chain
      const filterParts = []
      let prevLabel = '0:v'
      for (let x = 1; x < clipFiles.length; x++) {
        const offset = durations.slice(0, x).reduce((s, d) => s + d, 0) - fadeDur * x
        const outLabel = x === clipFiles.length - 1 ? 'vout' : 'xf' + x
        filterParts.push('[' + prevLabel + '][' + x + ':v]xfade=transition=fade:duration=' + fadeDur + ':offset=' + Math.max(0, offset).toFixed(2) + '[' + outLabel + ']')
        prevLabel = outLabel
      }

      // Concat all audio streams
      let audioConcat = ''
      for (let x = 0; x < clipFiles.length; x++) {
        audioConcat += '[' + x + ':a]'
      }
      audioConcat += 'concat=n=' + clipFiles.length + ':v=0:a=1[aout]'
      filterParts.push(audioConcat)

      xfArgs.push('-filter_complex', filterParts.join(';'))
      xfArgs.push('-map', '[vout]', '-map', '[aout]')
      xfArgs.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-pix_fmt', 'yuv420p')
      xfArgs.push('-c:a', 'aac', '-b:a', '192k')
      xfArgs.push('-movflags', '+faststart', '-y', outputPath)

      try {
        await runFfmpeg(xfArgs)
      } catch (xfErr) {
        console.error('[' + videoId + '] xfade failed, falling back to simple concat:', xfErr.message?.slice(0, 100))
        // Fallback to simple concat
        await runFfmpeg(['-f', 'concat', '-safe', '0', '-i', concatFile, '-c', 'copy', '-movflags', '+faststart', '-y', outputPath])
      }
    } else {
      // Too many clips for xfade — simple concat
      await runFfmpeg(['-f', 'concat', '-safe', '0', '-i', concatFile, '-c', 'copy', '-movflags', '+faststart', '-y', outputPath])
    }

    // STAGE 4: Generate background music with Lyria 3 Pro + mix
    const totalDurationEst = durations.reduce((s, d) => s + d, 0)
    let finalPath = outputPath

    let musicPublicUrl = null
    if (GEMINI_API_KEY) {
      try {
        await updateStatus('assembling', 'Composing background music...', 88)
        const { GoogleGenAI } = require('@google/genai')
        const genai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })

        // Build music prompt based on industry/mood
        const musicDuration = Math.min(totalDurationEst, 60) // Cap at 60s — Lyria fails for longer
        const durationMin = Math.floor(musicDuration / 60)
        const durationSec = Math.round(musicDuration % 60)
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

        const musicParts = musicResponse.candidates?.[0]?.content?.parts ?? []
        console.log(`[${videoId}] Lyria response parts: ${musicParts.length}, types: ${musicParts.map(p => p.text ? 'text' : p.inlineData ? `data(${p.inlineData.mimeType})` : 'unknown').join(', ')}`)
        let musicSaved = false
        for (const mp of musicParts) {
          if (mp.inlineData && (mp.inlineData.mimeType?.includes('audio') || mp.inlineData.mimeType?.includes('mpeg'))) {
            const musicPath = join(workDir, 'bgmusic.mp3')
            await writeFile(musicPath, Buffer.from(mp.inlineData.data, 'base64'))
            console.log(`[${videoId}] Music generated: ${(Buffer.from(mp.inlineData.data, 'base64').length / 1024 / 1024).toFixed(1)}MB`)

            // Upload music separately for frontend volume control
            await updateStatus('assembling', 'Uploading background music...', 91)
            const musicStoragePath = `${userId}/${videoId}_music.mp3`
            const musicBuffer = await readFile(musicPath)
            await supabase.storage.from('videos').upload(musicStoragePath, musicBuffer, { contentType: 'audio/mpeg', upsert: true })
            const { data: musicUrlData } = supabase.storage.from('videos').getPublicUrl(musicStoragePath)
            musicPublicUrl = musicUrlData.publicUrl
            musicSaved = true
            console.log(`[${videoId}] Music uploaded separately: ${musicPublicUrl}`)
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
    await supabase.storage.from('videos').upload(thumbPath, Array.isArray(slideBuffers[0]) ? slideBuffers[0][0] : slideBuffers[0], { contentType: 'image/png', upsert: true })
    const { data: thumbUrlData } = supabase.storage.from('videos').getPublicUrl(thumbPath)

    // Upload individual slides
    await updateStatus('assembling', 'Saving slides...', 96)
    const slideUrls = []
    for (let i = 0; i < slideBuffers.length; i++) {
      const sp = `${userId}/${videoId}_slide_${i}.png`
      await supabase.storage.from('videos').upload(sp, Array.isArray(slideBuffers[i]) ? slideBuffers[i][0] : slideBuffers[i], { contentType: 'image/png', upsert: true })
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
        // slide_durations: durations, // column doesn't exist in schema
        slide_urls: slideUrls,
        music_url: musicPublicUrl,
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
