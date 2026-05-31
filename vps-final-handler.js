/**
 * VPS FINAL CLEAN HANDLER
 *
 * Replaces /generate handler (lines 683 to just before STAGE 4 music).
 * Everything in one clean shot. No patches.
 *
 * Features:
 * - Gemini 3 Pro Image for all slides (no OpenAI images)
 * - Cover/closing: Gemini generates text as part of artwork (no Sharp/logo)
 * - 1 slide per scene, 1 audio per scene (perfect sync)
 * - Cover/closing detected by COVER_SLIDE:/CLOSING_SLIDE: prefix
 * - TTS: Cartesia primary, OpenAI fallback
 * - FFmpeg: -loop 1, -shortest, 1920x1080, xfade concat
 * - No logo compositing anywhere
 * - Contact bar on middle slides via FFmpeg drawbox
 */
const fs = require('fs')
const serverPath = '/app/server.js'
let c = fs.readFileSync(serverPath, 'utf8')

const handlerStart = c.indexOf("app.post('/generate'")
if (handlerStart === -1) { console.log('ERROR: /generate not found'); process.exit(1) }

const musicMarker = '// STAGE 4: Generate background music'
let musicIdx = c.indexOf(musicMarker, handlerStart)
if (musicIdx === -1) {
  musicIdx = c.indexOf('Generate background music', handlerStart)
  if (musicIdx > -1) musicIdx = c.lastIndexOf('//', musicIdx)
}
if (musicIdx === -1) { console.log('ERROR: music stage not found'); process.exit(1) }

console.log('Replacing lines', c.substring(0, handlerStart).split('\n').length, 'to', c.substring(0, musicIdx).split('\n').length)

const handler = `app.post('/generate', authCheck, async (req, res) => {
  const { videoId, voiceId, scenes, userId, slidePrompts, musicPrompt, industry, narrationStyle } = req.body
  const brandName = req.body.brandName || null
  const brandColors = req.body.brandColors || { primary: '#1B365D', secondary: '#4A90D9', text: '#FFFFFF' }
  const noContactBar = req.body.noContactBar || false
  const customBarText = req.body.barText || null
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
    try { await supabase.from('videos').update({ status, progress_detail: detail, progress_pct: pct }).eq('id', videoId) } catch(e) {}
  }

  try {
    console.log('[' + videoId + '] PIPELINE: ' + scenes.length + ' scenes, ' + slidePrompts.length + ' prompts, voice=' + voiceId)
    await updateStatus('generating_audio', 'Generating audio and slides...', 20)

    // ===== STAGE 1: TTS — 1 audio per scene =====
    let audiosDone = 0
    const audioPromise = (async () => {
      const buffers = []
      for (let i = 0; i < scenes.length; i++) {
        const narrationText = scenes[i].narration || ''
        if (!narrationText.trim()) { buffers.push(Buffer.alloc(0)); audiosDone++; continue }

        if (narrationStyle === 'podcast' && scenes[i].dialogue && scenes[i].dialogue.length > 0) {
          try {
            const dClips = []
            for (const line of scenes[i].dialogue) {
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
            try { buffers.push(await cartesiaTTS(narrationText.slice(0, 4096), voiceId || 'nova')) }
            catch { buffers.push(Buffer.alloc(0)) }
          }
        } else {
          let pushed = false
          for (let attempt = 1; attempt <= 2; attempt++) {
            try {
              buffers.push(await cartesiaTTS(narrationText.slice(0, 4096), voiceId || 'nova'))
              pushed = true
              break
            } catch (e) {
              if (attempt === 2) {
                try { buffers.push(await openaiTTS(narrationText.slice(0, 4096), voiceId || 'nova')); pushed = true }
                catch { buffers.push(Buffer.alloc(0)); pushed = true }
              } else { await new Promise(r => setTimeout(r, 2000)) }
            }
          }
          if (!pushed) buffers.push(Buffer.alloc(0))
        }
        audiosDone++
        console.log('[' + videoId + '] Audio ' + audiosDone + '/' + scenes.length)
        await updateStatus('generating_audio', 'Recording voices... (' + audiosDone + '/' + scenes.length + ')', 20 + Math.round((audiosDone / scenes.length) * 20))
      }
      console.log('[' + videoId + '] Audio complete: ' + buffers.length + ' clips')
      return buffers
    })()

    // ===== STAGE 2: Slides — Gemini 3 Pro Image =====
    await updateStatus('generating_slides', 'Preparing slide designs...', 22)

    async function generateOneSlide(idx) {
      const { GoogleGenAI } = require('@google/genai')
      const genai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })
      const prompt = typeof slidePrompts[idx] === 'string' ? slidePrompts[idx] : (Array.isArray(slidePrompts[idx]) ? slidePrompts[idx][0] : String(slidePrompts[idx]))

      // Detect cover/closing slides
      if (prompt.startsWith('COVER_SLIDE:') || prompt.startsWith('CLOSING_SLIDE:')) {
        return generateCoverSlide(prompt, genai)
      }

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const result = await genai.models.generateContent({
            model: 'gemini-3-pro-image',
            contents: 'Generate this image: ' + prompt,
            config: { responseModalities: ['IMAGE', 'TEXT'] },
          })
          for (const part of result.candidates[0].content.parts) {
            if (part.inlineData) return Buffer.from(part.inlineData.data, 'base64')
          }
          throw new Error('No image in Gemini response')
        } catch (e) {
          console.error('[' + videoId + '] Slide ' + (idx+1) + ' attempt ' + attempt + ':', (e.message || '').slice(0, 80))
          if (attempt === 2) return await generateFallbackSlide(scenes[idx]?.title || 'Slide', idx + 1, slidePrompts.length)
          await new Promise(r => setTimeout(r, 2000))
        }
      }
    }

    async function generateCoverSlide(promptStr, genai) {
      const isCover = promptStr.startsWith('COVER_SLIDE:')
      const parts = promptStr.split(':')
      const companyText = (parts[1] || brandName || videoTitle || '').trim()
      const extraInfo = parts[2] || ''

      const styleHint = slidePrompts.length > 2 ? (typeof slidePrompts[1] === 'string' ? slidePrompts[1].slice(0, 150) : '') : ''

      let coverPrompt = ''
      if (isCover) {
        coverPrompt = 'Create a premium sophisticated video title card. 1920x1080 landscape. Dynamic gradient background using brand colors primary ' + brandColors.primary + ' and secondary ' + brandColors.secondary + '. Include layered translucent shapes, glossy elements, soft glowing light effects, flowing visual accents. Display this text EXACTLY as written, large and centered: Company name: "' + companyText.toUpperCase() + '" in large bold prominent text. Below: "' + (extraInfo || videoTitle) + '" in medium text. Below: "A Personalized Video Presentation" in smaller text. Text MUST be readable and prominent. No logos. No brand marks.'
      } else {
        const contactParts = extraInfo.split('|').filter(Boolean)
        const contactStr = contactParts.join('  |  ')
        coverPrompt = 'Create a premium video closing card. 1920x1080 landscape. Dynamic gradient using brand colors primary ' + brandColors.primary + ' and secondary ' + brandColors.secondary + '. Warm inviting feel. Display EXACTLY: "THANK YOU" large bold centered. Below: "Ready to take the next step?" medium. ' + (companyText ? 'Company: "' + companyText.toUpperCase() + '" prominent. ' : '') + (contactStr ? 'Contact: "' + contactStr + '" at bottom. ' : '') + 'Beautiful typography. No logos.'
      }

      console.log('[' + videoId + '] Cover ' + (isCover ? 'OPEN' : 'CLOSE') + ': company="' + companyText + '"')

      try {
        const result = await genai.models.generateContent({
          model: 'gemini-3-pro-image',
          contents: 'Generate this image: ' + coverPrompt,
          config: { responseModalities: ['IMAGE', 'TEXT'] },
        })
        for (const part of result.candidates[0].content.parts) {
          if (part.inlineData) {
            const sharp = (await import('sharp')).default
            return sharp(Buffer.from(part.inlineData.data, 'base64')).resize(1920, 1080, { fit: 'cover' }).png().toBuffer()
          }
        }
        throw new Error('No image')
      } catch (e) {
        console.error('[' + videoId + '] Cover failed:', e.message?.slice(0, 80))
        const sharp = (await import('sharp')).default
        return sharp({ create: { width: 1920, height: 1080, channels: 3, background: brandColors.primary || '#1B365D' } }).png().toBuffer()
      }
    }

    // Generate all slides in batches
    const BATCH_SIZE = 7
    const slideBuffers = new Array(slidePrompts.length)
    for (let i = 0; i < slidePrompts.length; i += BATCH_SIZE) {
      const batch = []
      for (let j = i; j < Math.min(i + BATCH_SIZE, slidePrompts.length); j++) {
        batch.push(generateOneSlide(j).then(buf => { slideBuffers[j] = buf }))
      }
      await Promise.all(batch)
      const done = Math.min(i + BATCH_SIZE, slidePrompts.length)
      console.log('[' + videoId + '] Slides: ' + done + '/' + slidePrompts.length)
      await updateStatus('generating_slides', 'Designing slide ' + done + ' of ' + slidePrompts.length + '...', 40 + Math.round((done / slidePrompts.length) * 25))
    }

    await updateStatus('generating_slides', 'Slides done, waiting for audio...', 66)
    const audioBuffers = await audioPromise
    console.log('[' + videoId + '] Audio + slides done')

    // ===== STAGE 3: FFmpeg assembly =====
    await updateStatus('assembling', 'Assembling your video...', 68)
    const workDir = join(tmpdir(), 'd2v-' + randomUUID())
    await mkdir(workDir, { recursive: true })

    // Write files
    for (let i = 0; i < slideBuffers.length; i++) {
      const sb = slideBuffers[i]
      await writeFile(join(workDir, 'slide_' + i + '.png'), Array.isArray(sb) ? sb[0] : sb)
      if (i < audioBuffers.length && audioBuffers[i] && audioBuffers[i].length > 0) {
        await writeFile(join(workDir, 'audio_' + i + '.mp3'), audioBuffers[i])
      }
    }
    while (audioBuffers.length < slideBuffers.length) audioBuffers.push(Buffer.alloc(0))

    // Create clips
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
        // Add silent audio so xfade audio concat works (all clips need an audio stream)
        await runFfmpeg(['-loop', '1', '-i', slidePath, '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-t', '5', '-c:v', 'libx264', '-tune', 'stillimage', '-c:a', 'aac', '-b:a', '192k', '-pix_fmt', 'yuv420p', '-vf', vf, '-shortest', '-y', clipPath])
      }

      // Contact bar on middle slides only (skip cover=0, closing=last, opted-out)
      if (!noContactBar && i > 0 && i < slideBuffers.length - 1 && brandName) {
        const barText = (customBarText || [brandName, contactForClosing.website, contactForClosing.phone, contactForClosing.email].filter(Boolean).join('  |  ')).replace(/'/g, '')
        if (barText) {
          const barClip = join(workDir, 'bar_' + i + '.mp4')
          try {
            const hexColor = (brandColors.primary || '#1B365D').replace('#', '')
            const barArgs = ['-i', clipPath, '-filter_complex', "[0:v]drawbox=x=0:y=ih-80:w=iw:h=80:color=0x" + hexColor + "@0.85:t=fill,drawtext=text='" + barText + "':fontsize=20:fontcolor=white:x=(w-text_w)/2:y=h-50:fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf[v]", '-map', '[v]']
            barArgs.push('-map', '0:a', '-c:a', 'copy')
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

c = c.substring(0, handlerStart) + handler + c.substring(musicIdx)

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
console.log('FINAL CLEAN HANDLER DEPLOYED!')
console.log('Run: docker restart docs2video-service')
