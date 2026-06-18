/**
 * /render-v3 endpoint for the VPS video-service (server.js).
 * ==========================================================
 * Renders a video with the V3 Remotion engine (cinematic OR infographic theme).
 * The app's generate-video route POSTs here when the admin flag video_engine_v3
 * is ON. Contract = app/_lib/v3-render.ts buildV3Payload().
 *
 * Flow (async — ACK fast, render in background like /generate):
 *   1. ACK 200 immediately; do the work in the background.
 *   2. Per scene: OpenAI TTS narration (+probe duration). For the CINEMATIC
 *      theme also generate a Gemini full-bleed background image per scene.
 *   3. Write the composition props to the baked remotion project's public/:
 *        - infographic theme -> public/infographic.json  (comp InfographicVideo)
 *        - cinematic theme    -> public/v3.json            (comp V3Video)
 *   4. `npx remotion render <Comp> out/<videoId>.mp4` (Chrome headless).
 *   5. Upload MP4 + a thumbnail (first frame) to Supabase 'videos' bucket,
 *      update the videos row -> completed (mirrors /generate's finalize).
 *
 * REQUIRES (see Dockerfile.additions): the remotion/ project baked at
 * /app/remotion with deps installed + Chrome. REMOTION_DIR points to it.
 *
 * INSTALL: paste the marked block into server.js after authCheck. Reuses the
 * existing module-scope helpers: GoogleGenAI, GEMINI_API_KEY, OPENAI_API_KEY,
 * createClient, SUPABASE_URL/KEY, probeAudioDuration, reportError, execFile,
 * writeFile/mkdir/rm/readFile, randomUUID, join, tmpdir, WebSocket.
 */

// ---- paste from here into server.js ----
const REMOTION_DIR = process.env.REMOTION_DIR || '/app/remotion'
const OpenAI = require('openai')

// Cinematic "look bible" — keeps backgrounds filmic and text-free.
const V3_LOOK = 'Cinematic film still, 35mm anamorphic, shallow depth of field, dramatic low-key lighting with rim light and volumetric haze, muted moody grade, subtle grain, premium editorial mood. Photoreal, NOT illustration. 16:9, fills 1920x1080. ABSOLUTELY NO text, words, letters, numbers, charts, or logos.'

async function v3Tts(text, voiceId, outPath) {
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY })
  const resp = await openai.audio.speech.create({
    model: 'tts-1-hd', voice: voiceId || 'nova', input: text || ' ', response_format: 'mp3', speed: 0.98,
  })
  await writeFile(outPath, Buffer.from(await resp.arrayBuffer()))
  const dur = await probeAudioDuration(outPath)
  return Math.round(((dur || 3) + 0.9) * 30) // durationInFrames @30fps + tail
}

async function v3GeminiBg(prompt, outPath) {
  const { GoogleGenAI } = require('@google/genai')
  const g = new GoogleGenAI({ apiKey: GEMINI_API_KEY })
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

// Build the dark Modern-Fintech theme, applying brand accents if provided.
function v3Theme(brandAccents) {
  const base = {
    name: 'Modern Fintech', ink: '#070D1A', inkSoft: '#0C1730',
    glass: 'rgba(120,170,255,0.06)', glassEdge: 'rgba(120,170,255,0.22)',
    textPrimary: '#EAF2FF', textMuted: '#8FA6C8',
    accents: ['#3B82F6', '#22D3EE', '#8B5CF6'], mode: 'dark',
  }
  if (Array.isArray(brandAccents) && brandAccents.length) {
    base.accents = [brandAccents[0] || base.accents[0], brandAccents[1] || base.accents[1], brandAccents[2] || base.accents[2]]
    base.glassEdge = (brandAccents[0] || '#3B82F6') + '47' // ~0.28 alpha hex
  }
  return base
}

app.post('/render-v3', authCheck, async (req, res) => {
  const { videoId, userId, voiceId, theme, brandName, brandAccents, logo, scenes } = req.body || {}
  if (!videoId || !Array.isArray(scenes) || scenes.length === 0) {
    return res.status(400).json({ error: 'Missing videoId or scenes' })
  }
  // ACK immediately; render in the background (mirrors /generate).
  res.json({ success: true })

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false }, realtime: { transport: WebSocket } })
  const setProgress = (pct, detail) => sb.from('videos').update({ progress_pct: pct, progress_detail: detail, progress_updated_at: new Date().toISOString() }).eq('id', videoId).then(() => {}, () => {})

  const pub = join(REMOTION_DIR, 'public')
  const outFile = join(REMOTION_DIR, 'out', `${videoId}.mp4`)
  const isInfo = theme === 'infographic'
  const COMP = isInfo ? 'InfographicVideo' : 'V3Video'
  const PROPS = join(pub, isInfo ? 'infographic.json' : 'v3.json')

  try {
    await mkdir(pub, { recursive: true })
    await mkdir(join(REMOTION_DIR, 'out'), { recursive: true })
    console.log(`[render-v3 ${videoId}] theme=${theme} comp=${COMP} scenes=${scenes.length}`)
    await setProgress(25, 'Generating narration...')

    // Infographic: one darkened ambient background for the whole video.
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

    const outScenes = []
    for (let i = 0; i < scenes.length; i++) {
      const s = scenes[i]
      const audioName = `r3-${videoId}-${i}.mp3`
      const durationInFrames = await v3Tts(s.narration || s.title || ' ', voiceId, join(pub, audioName))

      if (isInfo) {
        // Infographic: data-driven, no image. Pass metrics/bullets straight through
        // (the layout-picker in the comp chooses hero/kpis/cards/etc).
        outScenes.push({
          title: s.title || '', body: s.bullets?.[0],
          metrics: s.metrics, audio: audioName, durationInFrames,
        })
      } else {
        // Cinematic: a Gemini background per scene.
        await setProgress(30 + Math.round((i / scenes.length) * 40), `Painting scene ${i + 1}/${scenes.length}...`)
        const imgName = `r3-${videoId}-${i}.png`
        const imgPrompt = s.title ? `A cinematic scene evoking: ${s.title}. ${s.narration || ''}`.slice(0, 400) : (s.narration || 'abstract corporate background').slice(0, 400)
        let haveImg = false
        try {
          await v3GeminiBg(imgPrompt, join(pub, imgName))
          await readFile(join(pub, imgName)) // confirm it landed on disk
          haveImg = true
        } catch (imgErr) {
          // Missing image must NOT 404 the whole render — scene falls back to
          // the theme ground (FullScreenScene handles an absent image).
          console.error(`[render-v3 ${videoId}] scene ${i} image failed: ${imgErr.message}`)
        }
        const placement = (i === 0 || i === scenes.length - 1) ? 'center' : ['bottom', 'left', 'right', 'bottom'][i % 4]
        const isEnd = i === 0 || i === scenes.length - 1
        const m = (Array.isArray(s.metrics) ? s.metrics : []).find((x) => x && x.label && x.value && /\d/.test(x.value))
        const metric = (!isEnd && m) ? { label: m.label, value: m.value } : undefined
        outScenes.push({ title: s.title || '', body: s.bullets?.[0], ...(haveImg ? { image: imgName } : {}), audio: audioName, durationInFrames, placement, ...(metric ? { metric } : {}) })
      }
    }

    // Logo variants arrive as REMOTE Supabase URLs; Remotion's staticFile()
    // resolves LOCAL public/ files only — download each into public/ first.
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

    const props = {
      theme: v3Theme(brandAccents),
      brandName: brandName || undefined,
      ...(localLogo ? { logo: localLogo, logoChip: !!logo.chip } : {}),
      ...(bgImage ? { bgImage } : {}),
      scenes: outScenes,
    }
    await writeFile(PROPS, JSON.stringify(props))
    await setProgress(72, 'Rendering video...')

    // Render with Remotion (Chrome headless). --props not needed: the comps
    // auto-load public/<file>.json via calculateMetadata.
    await new Promise((resolve, reject) => {
      execFile('npx', ['remotion', 'render', COMP, outFile, '--log=error', '--concurrency=50%', '--gl=swiftshader', '--image-format=jpeg'],
        { cwd: REMOTION_DIR, timeout: 30 * 60 * 1000, maxBuffer: 1024 * 1024 * 32, env: { ...process.env } },
        (err, stdout, stderr) => err ? reject(new Error(`remotion render: ${(stderr || err.message || '').slice(0, 300)}`)) : resolve())
    })

    await setProgress(90, 'Uploading...')
    const videoBuffer = await readFile(outFile)
    const videoStoragePath = `${userId}/${videoId}.mp4`
    await sb.storage.from('videos').upload(videoStoragePath, videoBuffer, { contentType: 'video/mp4', upsert: true })
    const { data: urlData } = sb.storage.from('videos').getPublicUrl(videoStoragePath)

    // Thumbnail: first frame via ffmpeg.
    const thumbPath = join(REMOTION_DIR, 'out', `${videoId}-thumb.png`)
    await new Promise((resolve) => execFile('ffmpeg', ['-y', '-i', outFile, '-vframes', '1', thumbPath], { timeout: 30000 }, () => resolve()))
    let thumbUrl = null
    try {
      const tb = await readFile(thumbPath)
      await sb.storage.from('videos').upload(`${userId}/${videoId}_thumb.png`, tb, { contentType: 'image/png', upsert: true })
      thumbUrl = sb.storage.from('videos').getPublicUrl(`${userId}/${videoId}_thumb.png`).data.publicUrl
    } catch { /* thumbnail best-effort */ }

    await sb.from('videos').update({
      status: 'completed', video_url: urlData.publicUrl,
      ...(thumbUrl ? { thumbnail_url: thumbUrl } : {}),
      progress_pct: 100, progress_detail: null, progress_updated_at: new Date().toISOString(),
    }).eq('id', videoId)
    console.log(`[render-v3 ${videoId}] DONE -> ${urlData.publicUrl}`)
  } catch (err) {
    console.error(`[render-v3 ${videoId}] error:`, err.message)
    reportError({ source: 'render-v3', videoId, userId, stage: theme, message: err.message }).catch(() => {})
    await sb.from('videos').update({ status: 'failed', error_message: 'Video rendering failed. Your credits were refunded.', progress_detail: null }).eq('id', videoId).then(() => {}, () => {})
    // The app's fix-stuck-videos cron refunds credits on failed rows.
  } finally {
    // Clean this job's per-scene assets + output (leave the project intact).
    try {
      const { readdir, unlink } = require('fs/promises')
      for (const f of await readdir(pub)) if (f.startsWith(`r3-${videoId}-`)) await unlink(join(pub, f)).catch(() => {})
      await rm(outFile, { force: true }).catch(() => {})
    } catch { /* cleanup best-effort */ }
  }
})
// ---- paste until here ----
