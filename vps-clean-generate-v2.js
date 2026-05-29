/**
 * VPS Clean Generate Handler v2
 *
 * Only replaces the generate handler up to the concat step (lines 683-1085).
 * Keeps music generation, upload, DB update, error handling intact.
 */
const fs = require('fs')
const serverPath = '/app/server.js'
let c = fs.readFileSync(serverPath, 'utf8')

// Find boundaries
const handlerStart = c.indexOf("app.post('/generate'")
if (handlerStart === -1) { console.log('ERROR: no /generate handler'); process.exit(1) }

// Find the concat section — we replace up to (but not including) the music step
const musicMarker = '// STAGE 4: Generate background music'
let musicIdx = c.indexOf(musicMarker, handlerStart)
if (musicIdx === -1) {
  // Try alternate marker
  musicIdx = c.indexOf('Generate background music', handlerStart)
  if (musicIdx > -1) musicIdx = c.lastIndexOf('//', musicIdx)
}
if (musicIdx === -1) { console.log('ERROR: music stage not found'); process.exit(1) }

console.log('Replacing generate handler from line', c.substring(0, handlerStart).split('\n').length, 'to line', c.substring(0, musicIdx).split('\n').length)

// The new handler — everything from app.post('/generate') to just before STAGE 4
const newCode = `app.post('/generate', authCheck, async (req, res) => {
  const { videoId, voiceId, scenes, userId, slidePrompts, logoUrl, musicPrompt, industry, narrationStyle } = req.body
  const brandName = req.body.brandName || null
  const brandColors = req.body.brandColors || { primary: '#1B365D', secondary: '#4A90D9', text: '#FFFFFF' }
  const noContactBar = req.body.noContactBar || false
  const videoTitle = req.body.videoTitle || scenes[0]?.title || 'Presentation'
  const contactForClosing = req.body.contactForClosing || {}

  if (!videoId || !scenes?.length || !userId || !slidePrompts?.length) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const sUrl = process.env.SUPABASE_URL || SUPABASE_URL
  const sKey = process.env.SUPABASE_SERVICE_KEY || SUPABASE_KEY
  if (!sUrl || !sKey) return res.status(500).json({ error: 'Supabase not configured' })

  res.json({ success: true, message: 'Generation started' })

  const supabase = createClient(sUrl, sKey, { auth: { persistSession: false }, realtime: { transport: WebSocket } })
  async function updateStatus(status, detail, pct) {
    try { await supabase.from('videos').update({ status, progress_detail: detail, progress_pct: pct }).eq('id', videoId) } catch(e) { console.error('Progress update failed:', e.message) }
  }

  try {
    console.log('[' + videoId + '] PIPELINE: ' + scenes.length + ' scenes, ' + slidePrompts.length + ' slides, voice=' + voiceId)
    await updateStatus('generating_audio', 'Generating audio and slides...', 20)

    const OpenAI = require('openai')
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY })

    // ======== STAGE 1: TTS Audio — 1 per scene ========
    let audiosDone = 0
    const audioPromise = (async () => {
      const buffers = []
      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i]
        const narrationText = scene.narration || ''
        if (!narrationText.trim()) { buffers.push(Buffer.alloc(0)); audiosDone++; continue }

        if (narrationStyle === 'podcast' && scene.dialogue && scene.dialogue.length > 0) {
          try {
            const dClips = []
            for (const line of scene.dialogue) {
              dClips.push(await cartesiaTTS(line.text.slice(0, 4096), line.voice || 'coral'))
            }
            const dDir = join(tmpdir(), 'dlg-' + randomUUID())
            await mkdir(dDir, { recursive: true })
            const fList = []
            for (let d = 0; d < dClips.length; d++) {
              const fp = join(dDir, 'dlg_' + d + '.mp3')
              await writeFile(fp, dClips[d])
              fList.push("file '" + fp + "'")
            }
            await writeFile(join(dDir, 'list.txt'), fList.join('\\n'))
            const merged = join(dDir, 'merged.mp3')
            await runFfmpeg(['-f', 'concat', '-safe', '0', '-i', join(dDir, 'list.txt'), '-c', 'copy', '-y', merged])
            buffers.push(await readFile(merged))
          } catch (dErr) {
            console.error('[' + videoId + '] Podcast failed scene ' + (i+1) + ':', dErr.message?.slice(0, 80))
            buffers.push(await cartesiaTTS(narrationText.slice(0, 4096), voiceId || 'nova'))
          }
        } else {
          for (let attempt = 1; attempt <= 2; attempt++) {
            try {
              buffers.push(await cartesiaTTS(narrationText.slice(0, 4096), voiceId || 'nova'))
              break
            } catch (e) {
              if (attempt === 2) {
                try { buffers.push(await openaiTTS(narrationText.slice(0, 4096), voiceId || 'nova')) }
                catch { buffers.push(Buffer.alloc(0)) }
              } else { await new Promise(r => setTimeout(r, 2000)) }
            }
          }
        }
        audiosDone++
        console.log('[' + videoId + '] Audio ' + audiosDone + '/' + scenes.length)
        await updateStatus('generating_audio', 'Recording voices... (' + audiosDone + '/' + scenes.length + ')', 20 + Math.round((audiosDone / scenes.length) * 20))
      }
      return buffers
    })()

    // ======== STAGE 2: Slide images — 1 per scene ========
    async function generateOneSlide(idx) {
      const prompt = slidePrompts[idx]
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await openai.images.generate({
            model: 'gpt-image-2',
            prompt: typeof prompt === 'string' ? prompt : prompt[0],
            size: '1536x1024', quality: 'high', n: 1,
          })
          const imageData = response.data?.[0]
          if (!imageData?.b64_json) throw new Error('No image data')
          return Buffer.from(imageData.b64_json, 'base64')
        } catch (e) {
          console.error('[' + videoId + '] Slide ' + (idx+1) + ' attempt ' + attempt + ':', (e.message || '').slice(0, 80))
          if (attempt === 2) return await generateFallbackSlide(scenes[idx]?.title || 'Slide', idx + 1, slidePrompts.length)
          await new Promise(r => setTimeout(r, 2000))
        }
      }
    }

    // Cover/closing: AI background + Sharp white logo composite
    async function generateCover(type) {
      const sharp = (await import('sharp')).default
      const styleHint = typeof slidePrompts[0] === 'string' ? slidePrompts[0].slice(0, 200) : ''
      const bgPrompt = type === 'cover'
        ? 'Create a stunning illustrated background for a video title card. 1920x1080. ' + styleHint + ' Use brand colors: primary ' + brandColors.primary + ', secondary ' + brandColors.secondary + '. Center area should be clean/dark for logo placement. NO TEXT NO LOGOS. Pure artwork.'
        : 'Create a stunning illustrated background for a video closing card. 1920x1080. ' + styleHint + ' Use brand colors: primary ' + brandColors.primary + ', secondary ' + brandColors.secondary + '. Center area clean for logo/contact overlay. Warm, inviting. NO TEXT NO LOGOS. Pure artwork.'

      const bgRes = await openai.images.generate({ model: 'gpt-image-2', prompt: bgPrompt, size: '1536x1024', quality: 'high', n: 1 })
      let bgBuf = Buffer.from(bgRes.data[0].b64_json, 'base64')
      bgBuf = await sharp(bgBuf).resize(1920, 1080, { fit: 'cover' }).png().toBuffer()

      const composites = []
      let logoH = 0, logoTop = 340

      if (logoUrl) {
        try {
          let logoBuf = null
          if (logoUrl.startsWith('data:')) logoBuf = Buffer.from(logoUrl.split(',')[1], 'base64')
          else {
            const lr = await fetch(logoUrl, { signal: AbortSignal.timeout(10000) })
            if (lr.ok) logoBuf = Buffer.from(await lr.arrayBuffer())
          }
          if (logoBuf) {
            const resized = await sharp(logoBuf).resize(600, null, { fit: 'inside' }).ensureAlpha().png().toBuffer()
            const meta = await sharp(resized).metadata()
            const lw = meta.width || 600
            logoH = meta.height || 240
            logoTop = type === 'cover' ? Math.round((1080 - logoH) / 2) - 60 : Math.round((1080 - logoH) / 2) - 80
            // Pure white logo
            const alpha = await sharp(resized).extractChannel(3).toBuffer()
            const white = await sharp({ create: { width: lw, height: logoH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } }).png().toBuffer()
            const whiteLogo = await sharp(white).joinChannel(alpha).png().toBuffer()
            composites.push({ input: whiteLogo, top: logoTop, left: Math.round((1920 - lw) / 2) })
          }
        } catch (e) { console.log('[' + videoId + '] Logo failed:', e.message?.slice(0, 80)) }
      }

      const textY = logoUrl && logoH > 0 ? logoTop + logoH + 40 : 420
      const safeTitle = (videoTitle || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      let svgParts = ''
      if (type === 'cover') {
        svgParts = '<text x="960" y="' + textY + '" font-family="Arial,sans-serif" font-size="36" font-weight="800" fill="white" text-anchor="middle">' + safeTitle + '</text>'
      } else {
        svgParts = '<text x="960" y="' + textY + '" font-family="Arial,sans-serif" font-size="42" font-weight="800" fill="white" text-anchor="middle">Thank You</text>'
        svgParts += '<text x="960" y="' + (textY + 50) + '" font-family="Arial,sans-serif" font-size="22" font-weight="600" fill="white" opacity="0.8" text-anchor="middle">Ready to take the next step?</text>'
        const cp = [brandName, contactForClosing.website, contactForClosing.phone, contactForClosing.email].filter(Boolean)
        if (cp.length > 0) {
          const cs = cp.join('  \\u00B7  ').replace(/&/g, '&amp;').replace(/</g, '&lt;')
          svgParts += '<rect x="360" y="' + (textY + 75) + '" width="1200" height="40" rx="6" fill="rgba(255,255,255,0.1)"/>'
          svgParts += '<text x="960" y="' + (textY + 100) + '" font-family="Arial,sans-serif" font-size="16" font-weight="500" fill="white" opacity="0.7" text-anchor="middle">' + cs + '</text>'
        }
      }
      composites.push({ input: Buffer.from('<svg width="1920" height="1080">' + svgParts + '</svg>'), top: 0, left: 0 })
      return sharp(bgBuf).composite(composites).png().toBuffer()
    }

    // Generate all slides
    const BATCH_SIZE = 7
    const slideBuffers = new Array(slidePrompts.length)
    for (let i = 0; i < slidePrompts.length; i += BATCH_SIZE) {
      const batch = []
      for (let j = i; j < Math.min(i + BATCH_SIZE, slidePrompts.length); j++) {
        let promise
        if (j === 0) {
          promise = generateCover('cover').catch(err => { console.error('[' + videoId + '] Cover failed:', err.message?.slice(0, 80)); return generateOneSlide(j) })
        } else if (j === slidePrompts.length - 1) {
          promise = generateCover('closing').catch(err => { console.error('[' + videoId + '] Closing failed:', err.message?.slice(0, 80)); return generateOneSlide(j) })
        } else {
          promise = generateOneSlide(j)
        }
        batch.push(promise.then(buf => { slideBuffers[j] = buf }))
      }
      await Promise.all(batch)
      const done = Math.min(i + BATCH_SIZE, slidePrompts.length)
      console.log('[' + videoId + '] Slides: ' + done + '/' + slidePrompts.length)
      await updateStatus('generating_slides', 'Designing slide ' + done + ' of ' + slidePrompts.length + '...', 40 + Math.round((done / slidePrompts.length) * 25))
    }

    await updateStatus('generating_slides', 'Slides done, waiting for audio...', 66)
    const audioBuffers = await audioPromise
    console.log('[' + videoId + '] Audio + slides done')

    // ======== STAGE 3: FFmpeg assembly ========
    await updateStatus('assembling', 'Assembling your video...', 68)
    const workDir = join(tmpdir(), 'd2v-' + randomUUID())
    await mkdir(workDir, { recursive: true })

    for (let i = 0; i < slideBuffers.length; i++) {
      await writeFile(join(workDir, 'slide_' + i + '.png'), Array.isArray(slideBuffers[i]) ? slideBuffers[i][0] : slideBuffers[i])
      if (i < audioBuffers.length && audioBuffers[i] && audioBuffers[i].length > 0) {
        await writeFile(join(workDir, 'audio_' + i + '.mp3'), audioBuffers[i])
      }
    }
    while (audioBuffers.length < slideBuffers.length) audioBuffers.push(Buffer.alloc(0))

    const clipFiles = []
    const durations = []
    const vf = 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2'

    for (let i = 0; i < slideBuffers.length; i++) {
      await updateStatus('assembling', 'Encoding clip ' + (i+1) + '/' + slideBuffers.length + '...', 68 + Math.round(((i+1) / slideBuffers.length) * 15))
      const clipPath = join(workDir, 'clip_' + i + '.mp4')
      const slidePath = join(workDir, 'slide_' + i + '.png')
      const audioPath = join(workDir, 'audio_' + i + '.mp3')

      if (audioBuffers[i] && audioBuffers[i].length > 100) {
        await runFfmpeg(['-loop', '1', '-i', slidePath, '-i', audioPath, '-c:v', 'libx264', '-tune', 'stillimage', '-c:a', 'aac', '-b:a', '192k', '-pix_fmt', 'yuv420p', '-vf', vf, '-af', 'adelay=300|300', '-shortest', '-y', clipPath])
      } else {
        await runFfmpeg(['-loop', '1', '-i', slidePath, '-t', '5', '-c:v', 'libx264', '-tune', 'stillimage', '-pix_fmt', 'yuv420p', '-vf', vf, '-an', '-y', clipPath])
      }

      // Contact bar on middle slides
      if (!noContactBar && i > 0 && i < slideBuffers.length - 1 && brandName) {
        const barText = [brandName, contactForClosing.website, contactForClosing.phone, contactForClosing.email].filter(Boolean).join('  \\u00B7  ').replace(/'/g, '')
        if (barText) {
          const barClip = join(workDir, 'bar_' + i + '.mp4')
          try {
            const hexColor = (brandColors.primary || '#1B365D').replace('#', '')
            const barArgs = ['-i', clipPath, '-filter_complex', "[0:v]drawbox=x=0:y=ih-100:w=iw:h=100:color=0x" + hexColor + ":t=fill,drawtext=text='" + barText + "':fontsize=22:fontcolor=white:x=(w-text_w)/2:y=h-60:fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf[v]", '-map', '[v]']
            if (audioBuffers[i] && audioBuffers[i].length > 100) barArgs.push('-map', '0:a', '-c:a', 'copy')
            else barArgs.push('-an')
            barArgs.push('-c:v', 'libx264', '-preset', 'fast', '-pix_fmt', 'yuv420p', '-y', barClip)
            await runFfmpeg(barArgs)
            await require('fs').promises.rename(barClip, clipPath)
          } catch (barErr) { console.error('[' + videoId + '] Bar failed clip ' + (i+1) + ':', barErr.message?.slice(0, 80)) }
        }
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

    // Concatenate with xfade
    await updateStatus('assembling', 'Joining clips together...', 85)
    const concatFile = join(workDir, 'concat.txt')
    await writeFile(concatFile, clipFiles.map(f => "file '" + f + "'").join('\\n'))
    const outputPath = join(workDir, 'output.mp4')
    const fadeDur = 0.4

    if (clipFiles.length <= 1) {
      await runFfmpeg(['-i', clipFiles[0], '-c', 'copy', '-movflags', '+faststart', '-y', outputPath])
    } else if (clipFiles.length <= 20) {
      const xfArgs = []
      for (const cf of clipFiles) xfArgs.push('-i', cf)
      const filterParts = []
      let prevLabel = '0:v'
      for (let x = 1; x < clipFiles.length; x++) {
        const offset = durations.slice(0, x).reduce((s, d) => s + d, 0) - fadeDur * x
        const outLabel = x === clipFiles.length - 1 ? 'vout' : 'xf' + x
        filterParts.push('[' + prevLabel + '][' + x + ':v]xfade=transition=fade:duration=' + fadeDur + ':offset=' + Math.max(0, offset).toFixed(2) + '[' + outLabel + ']')
        prevLabel = outLabel
      }
      let audioConcat = ''
      for (let x = 0; x < clipFiles.length; x++) audioConcat += '[' + x + ':a]'
      audioConcat += 'concat=n=' + clipFiles.length + ':v=0:a=1[aout]'
      filterParts.push(audioConcat)
      xfArgs.push('-filter_complex', filterParts.join(';'))
      xfArgs.push('-map', '[vout]', '-map', '[aout]', '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-y', outputPath)
      try { await runFfmpeg(xfArgs) }
      catch (xfErr) {
        console.error('[' + videoId + '] xfade failed:', xfErr.message?.slice(0, 100))
        await runFfmpeg(['-f', 'concat', '-safe', '0', '-i', concatFile, '-c', 'copy', '-movflags', '+faststart', '-y', outputPath])
      }
    } else {
      await runFfmpeg(['-f', 'concat', '-safe', '0', '-i', concatFile, '-c', 'copy', '-movflags', '+faststart', '-y', outputPath])
    }

    `

// Replace from handler start to just before STAGE 4 music
c = c.substring(0, handlerStart) + newCode + c.substring(musicIdx)

// Remove old generateCoverSlide if it exists outside the handler
const oldCoverFn = c.indexOf('// --- COVER SLIDE GENERATION ---')
if (oldCoverFn > -1) {
  const oldCoverEnd = c.indexOf('// --- END COVER SLIDE GENERATION ---', oldCoverFn)
  if (oldCoverEnd > -1) {
    c = c.substring(0, oldCoverFn) + c.substring(oldCoverEnd + '// --- END COVER SLIDE GENERATION ---'.length)
    console.log('Removed old generateCoverSlide')
  }
}

fs.writeFileSync(serverPath, c)
console.log('Clean generate handler v2 deployed!')
console.log('Run: docker restart docs2video-service')
