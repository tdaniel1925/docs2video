import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { generateScript } from '../../_lib/script-generator'
import { generateSlide } from '../../_lib/gemini'
import { compositeSlide } from '../../_lib/composite'
import { generateCoverOverlay, generateLogoWatermark } from '../../_lib/cover-overlay'
import { synthesizeSpeech } from '../../_lib/tts'
// Video assembly is offloaded to the Hetzner VPS (video-service)
const VIDEO_ASSEMBLY_URL = process.env.VIDEO_ASSEMBLY_URL || 'http://5.161.215.156:4000'
const VIDEO_ASSEMBLY_SECRET = (process.env.VIDEO_ASSEMBLY_SECRET || '').trim().replace(/[\r\n]/g, '')
import { sendNotification, createJob, updateJobProgress } from '../../_lib/notify'
import { sendVideoReadyEmail } from '../../_lib/notifications'
import { generateCustomMusic, buildMusicPrompt } from '../../_lib/music-generator'
import type { Brand, ExtractedPolicyData, SlideStyleId } from '../../_lib/types'
import type { ExtractedData } from '../../_lib/extract-types'
import { isAdmin } from '../../_lib/admin'
import { rateLimit, getRateLimitKey, LIMITS } from '../../_lib/rate-limit'

export const runtime = 'nodejs'

// Timeout wrapper — prevents hanging on Gemini/TTS calls
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)),
  ])
}
export const maxDuration = 800

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const rl = rateLimit(getRateLimitKey(user.id, 'generation'), LIMITS.generation.limit, LIMITS.generation.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 })
  }

  // --- Free trial / pay-per-video gate (defense in depth — primary check is in /api/videos POST) ---
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status, referred_by, card_on_file, free_videos_remaining')
    .eq('id', user.id)
    .single()

  const subStatus = (profile?.subscription_status ?? '').toLowerCase()
  const isPaidUser = ['active', 'professional', 'pro', 'business', 'agency', 'starter'].includes(subStatus)
  const hasReferralDiscount = !!profile?.referred_by
  const cardOnFile = profile?.card_on_file ?? false
  const freeRemaining = profile?.free_videos_remaining ?? 0

  // Admins generate unlimited with no charges
  let shouldDeductFreeVideo = false
  if (!isAdmin(user.email)) {
    if (!isPaidUser && !hasReferralDiscount) {
      if (freeRemaining > 0) {
        // Will deduct AFTER successful completion
        shouldDeductFreeVideo = true
      } else if (!cardOnFile) {
        return NextResponse.json(
          { error: 'Free videos used. Please add a payment method to continue.' },
          { status: 403 }
        )
      }
      // If card on file + no free videos remaining, charge was already handled in /api/videos POST
    }
  }

  const body = await request.json()
  const { videoId, policyData, brandId, voiceId, styleId, customStylePrompt, approvedSlides, preGeneratedScenes, detailed, musicUrl, aiMusic, musicPrompt, assetUrls, purpose, uploadMode, industry } = body as {
    videoId: string
    policyData: ExtractedPolicyData | ExtractedData
    brandId: string | null
    voiceId: string
    styleId?: SlideStyleId
    customStylePrompt?: string
    approvedSlides?: string[]
    preGeneratedScenes?: any[]
    detailed?: boolean
    musicUrl?: string
    aiMusic?: boolean
    musicPrompt?: string
    assetUrls?: { url: string; tag: string }[]
    purpose?: string
    uploadMode?: string
    industry?: string
  }

  let brand: Brand | null = null
  if (brandId) {
    const { data } = await supabase.from('brands').select('*').eq('id', brandId).single()
    brand = data as Brand | null
  }

  const colors = {
    primary: brand?.primary_color ?? '#1B365D',
    secondary: brand?.secondary_color ?? '#4A90D9',
    accent: brand?.accent_color ?? '#FFB347',
    background: brand?.background_color ?? '#0a1628',
    text: brand?.text_color ?? '#FFFFFF',
  }

  const admin = createAdminClient()

  // Create a job tracker for this video
  const jobId = await createJob(admin, user.id, {
    type: 'video',
    title: `Video: ${videoId.slice(0, 8)}...`,
    metadata: { videoId },
  })

  // Download all asset images into buffers
  const assetBuffers: (Buffer | null)[] = []
  if (assetUrls && assetUrls.length > 0) {
    console.log(`[video ${videoId}] Downloading ${assetUrls.length} asset images...`)
    for (const asset of assetUrls) {
      try {
        const res = await fetch(asset.url, { signal: AbortSignal.timeout(8000) })
        if (res.ok) {
          assetBuffers.push(Buffer.from(await res.arrayBuffer()))
        } else {
          assetBuffers.push(null)
        }
      } catch {
        assetBuffers.push(null)
      }
    }
    console.log(`[video ${videoId}] Downloaded ${assetBuffers.filter(Boolean).length}/${assetUrls.length} assets`)
  }

  try {
    if (jobId) await updateJobProgress(admin, jobId, 5, 'running')

    // STAGE 1: Generate script (or reuse pre-generated scenes)
    let scenes
    if (preGeneratedScenes && preGeneratedScenes.length > 0) {
      console.log(`[video ${videoId}] Using ${preGeneratedScenes.length} pre-generated scenes.`)
      scenes = preGeneratedScenes
      await admin.from('videos').update({ script: scenes, status: 'generating_audio', progress_detail: 'Script ready', progress_pct: 15 }).eq('id', videoId)
    } else {
      console.log(`[video ${videoId}] Generating script...`)
      await admin.from('videos').update({ status: 'scripting', progress_detail: 'Writing your script...', progress_pct: 5 }).eq('id', videoId)
      const guideDataForScript = brand?.brand_guide_data as Record<string, string> | null
      const contactInfoForScript = {
        phone: guideDataForScript?.phone ?? undefined,
        email: guideDataForScript?.email ?? undefined,
        calendly: guideDataForScript?.calendly ?? undefined,
      }
      scenes = await generateScript(policyData, brand?.name ?? null, colors, detailed ?? false, assetBuffers.filter(Boolean).length, voiceId, (brand as any)?.tone ?? undefined, contactInfoForScript, purpose, uploadMode, industry)
      await admin.from('videos').update({ script: scenes, status: 'generating_audio', progress_detail: 'Script complete', progress_pct: 15 }).eq('id', videoId)
    }

    // STAGE 2: Generate audio + AI music in parallel
    console.log(`[video ${videoId}] Generating audio for ${scenes.length} scenes...`)
    await admin.from('videos').update({ status: 'generating_audio', progress_detail: `Generating narration audio... (0 of ${scenes.length})`, progress_pct: 15 }).eq('id', videoId)

    // Start AI music generation in parallel if requested OR if Gemini key is available and no music provided
    let aiMusicPromise: Promise<string | null> | null = null
    const shouldGenerateMusic = aiMusic || (!musicUrl && process.env.GEMINI_API_KEY)
    if (shouldGenerateMusic) {
      const prompt = musicPrompt || buildMusicPrompt(policyData, scenes)
      const title = (policyData as any)?.policyType ?? (policyData as any)?.title ?? 'Background Music'
      console.log(`[video ${videoId}] Starting AI music generation in parallel...`)
      aiMusicPromise = generateCustomMusic(prompt, title)
    }

    const audioBuffers: Buffer[] = []
    for (let i = 0; i < scenes.length; i++) {
      console.log(`[video ${videoId}] Audio ${i + 1}/${scenes.length}...`)
      await admin.from('videos').update({ progress_detail: `Generating narration audio... (${i + 1} of ${scenes.length})`, progress_pct: 15 + Math.round((i + 1) / scenes.length * 20) }).eq('id', videoId)
      const buf = await synthesizeSpeech(scenes[i].narration, voiceId)
      audioBuffers.push(buf)
    }
    console.log(`[video ${videoId}] Audio done — ${audioBuffers.length} clips.`)

    // Resolve AI music if it was started (max 90s wait, then give up)
    let finalMusicUrl = musicUrl
    if (aiMusicPromise) {
      console.log(`[video ${videoId}] Waiting for AI music (max 90s)...`)
      try {
        const aiMusicUrl = await Promise.race([
          aiMusicPromise,
          new Promise<null>(resolve => setTimeout(() => resolve(null), 90000)),
        ])
        if (aiMusicUrl) {
          console.log(`[video ${videoId}] AI music ready: ${aiMusicUrl}`)
          finalMusicUrl = aiMusicUrl
        } else {
          console.log(`[video ${videoId}] AI music timed out or failed — proceeding without`)
        }
      } catch {
        console.log(`[video ${videoId}] AI music error — proceeding without`)
      }
    }
    await admin.from('videos').update({ status: 'generating_slides', progress_detail: `Creating slides... (0 of ${scenes.length})`, progress_pct: 35 }).eq('id', videoId)
    if (jobId) await updateJobProgress(admin, jobId, 40, 'running')

    // Get agent photo for compositing
    const { data: agentProfile } = await admin.from('profiles').select('photo_url, photo_standing_url').eq('id', user.id).single()
    const photoUrl = agentProfile?.photo_url ?? null
    const standingPhotoUrl = agentProfile?.photo_standing_url ?? null
    // Use raw logo for GPT overlay on cover/closing slides
    const rawLogoUrl = brand?.logo_file_url ?? brand?.logo_url ?? null
    let logoUrl: string | null = rawLogoUrl
    let logoBuffer: Buffer | null = null
    if (logoUrl) {
      try {
        const logoRes = await fetch(logoUrl, { signal: AbortSignal.timeout(8000) })
        if (logoRes.ok) logoBuffer = Buffer.from(await logoRes.arrayBuffer())
      } catch {
        console.log(`[video ${videoId}] Failed to fetch logo — proceeding without`)
        logoUrl = null
      }
    }

    // Download brand reference slides if available (for visual consistency)
    const refSlideUrls = brand?.reference_slides ?? null
    let referenceSlides: Buffer[] | undefined
    if (refSlideUrls && refSlideUrls.length > 0) {
      console.log(`[video ${videoId}] Downloading ${refSlideUrls.length} reference slides...`)
      referenceSlides = []
      for (const refUrl of refSlideUrls.slice(0, 2)) { // Send max 2 references to keep prompt size manageable
        try {
          const refRes = await fetch(refUrl, { signal: AbortSignal.timeout(8000) })
          if (refRes.ok) referenceSlides.push(Buffer.from(await refRes.arrayBuffer()))
        } catch { /* skip */ }
      }
      if (referenceSlides.length === 0) referenceSlides = undefined
    }

    // Use brand's saved deck style if no style explicitly chosen
    const effectiveStyleId = styleId ?? brand?.deck_style_id ?? 'executive'

    // Load template reference image for visual consistency
    const fs = await import('fs/promises')
    const pathMod = await import('path')
    let templateRefBuffer: Buffer | null = null
    try {
      const refPath = pathMod.join(process.cwd(), 'public', 'style-previews', `${effectiveStyleId}.png`)
      templateRefBuffer = await fs.readFile(refPath)
      console.log(`[video ${videoId}] Loaded template reference image for style "${effectiveStyleId}"`)
    } catch { /* template preview not found, skip */ }

    // Generate Sharp overlays — cover/closing (logo + title) and middle (logo watermark)
    let coverOverlay: Buffer | null = null
    let closingOverlay: Buffer | null = null
    let logoWatermark: Buffer | null = null
    if (logoBuffer) {
      const isInsurance = policyData && 'policyType' in policyData
      const overlayColors = colors
      const overlayTitle = isInsurance
        ? `${(policyData as any).policyType} Policy Overview`
        : (policyData as ExtractedData).title || 'Presentation'
      const overlaySubtitle = isInsurance
        ? `Prepared for ${(policyData as any).insuredName}`
        : (policyData as ExtractedData).subtitle || undefined
      const guideData = brand?.brand_guide_data as Record<string, string> | null
      const overlayContact = {
        phone: guideData?.phone ?? undefined,
        website: guideData?.website ?? undefined,
      }

      console.log(`[video ${videoId}] Generating Sharp overlays (cover, closing, watermark)...`)
      try {
        const [coverResult, closingResult, watermarkResult] = await Promise.all([
          generateCoverOverlay({
            logoBuffer,
            title: overlayTitle,
            subtitle: overlaySubtitle,
            colors: overlayColors,
            isCover: true,
          }),
          generateCoverOverlay({
            logoBuffer,
            title: overlayTitle,
            subtitle: brand?.name ?? undefined,
            contactInfo: overlayContact,
            colors: overlayColors,
            isCover: false,
          }),
          generateLogoWatermark(logoBuffer),
        ])
        coverOverlay = coverResult
        closingOverlay = closingResult
        logoWatermark = watermarkResult
        console.log(`[video ${videoId}] Sharp overlays generated successfully`)
      } catch (err) {
        console.error(`[video ${videoId}] Overlay generation failed:`, err)
      }
    }

    // STAGE 3: Generate slides (or use pre-approved ones)
    let slideBuffers: Buffer[]
    if (approvedSlides && approvedSlides.length >= 4) {
      console.log(`[video ${videoId}] Using pre-approved slides.`)
      slideBuffers = approvedSlides.map(dataUri => {
        const base64 = dataUri.replace(/^data:image\/\w+;base64,/, '')
        return Buffer.from(base64, 'base64')
      })
    } else {
      console.log(`[video ${videoId}] Generating ${scenes.length} slides with brand consistency${logoBuffer ? ' (with logo)' : ''}...`)
      slideBuffers = []
      const guideData = brand?.brand_guide_data as Record<string, string> | null
      const contactInfo = {
        phone: guideData?.phone ?? undefined,
        website: guideData?.website ?? undefined,
      }

      // Parse [ASSET:N] tags from scene slidePrompts and map to asset buffers
      const sceneAssetMap: (Buffer | null)[] = scenes.map((scene: any) => {
        const match = scene.slidePrompt?.match(/\[ASSET:(\d+)\]/)
        if (match) {
          const idx = parseInt(match[1], 10) - 1 // 1-based to 0-based
          return assetBuffers[idx] ?? null
        }
        return null
      })

      // BRAND CONSISTENCY: Generate slide 1 first, then use it as reference for all others
      // This ensures all slides share the same visual identity
      console.log(`[video ${videoId}] Generating slide 1 (master style)...`)
      await admin.from('videos').update({ progress_detail: `Creating slides... (1 of ${scenes.length})`, progress_pct: 38 }).eq('id', videoId)
      let masterSlideBuffer: Buffer | null = null

      // Generate slide 1 (cover) — establishes the visual identity (60s timeout)
      // Logo is NOT passed to Gemini — Sharp composites it afterward
      let buf0 = await withTimeout(
        generateSlide(
          policyData, 0, effectiveStyleId as any,
          null, null, colors,
          scenes[0].slidePrompt, !!photoUrl, contactInfo,
          null, referenceSlides, scenes.length,
          customStylePrompt, undefined, undefined, templateRefBuffer,
          sceneAssetMap[0]
        ), 60000, 'Slide 1'
      )
      buf0 = await compositeSlide(buf0, photoUrl, null, true, scenes.length === 1, standingPhotoUrl, brand?.name ?? null, colors.primary, contactInfo, coverOverlay)
      slideBuffers.push(buf0)
      masterSlideBuffer = buf0
      console.log(`[video ${videoId}] Slide 1 done — using as style reference for remaining slides`)

      // Generate slides 2-N using slide 1 as reference for visual consistency
      if (scenes.length > 1) {
        const masterRef = masterSlideBuffer ? [masterSlideBuffer] : referenceSlides
        for (let i = 1; i < scenes.length; i += 3) {
          const batch = scenes.slice(i, Math.min(i + 3, scenes.length))
          console.log(`[video ${videoId}] Slide batch ${Math.floor(i / 3) + 1} (slides ${i + 1}-${Math.min(i + 3, scenes.length)})...`)
          const slidePct = 38 + Math.round((i / scenes.length) * 35)
          await admin.from('videos').update({ progress_detail: `Creating slides... (${i} of ${scenes.length})`, progress_pct: slidePct }).eq('id', videoId)
          const batchResults = await Promise.all(
            batch.map(async (scene: any, j: number) => {
              const idx = i + j
              // Logo is NOT passed to Gemini — Sharp composites it afterward
              let buf = await withTimeout(generateSlide(
                policyData, idx, effectiveStyleId as any,
                null, null, colors,
                scene.slidePrompt, !!photoUrl, contactInfo,
                null, masterRef, scenes.length,
                customStylePrompt, undefined, undefined, templateRefBuffer,
                sceneAssetMap[idx]
              ), 60000, `Slide ${idx + 1}`)
              const isLast = idx === scenes.length - 1
              // Cover/closing get full overlay, middle slides get logo watermark
              buf = await compositeSlide(buf, photoUrl, null, false, isLast, standingPhotoUrl, brand?.name ?? null, colors.primary, contactInfo, isLast ? closingOverlay : logoWatermark)
              return buf
            })
          )
          slideBuffers.push(...batchResults)
          const doneCount = Math.min(i + 3, scenes.length)
          const donePct = 38 + Math.round((doneCount / scenes.length) * 35)
          await admin.from('videos').update({ progress_detail: `Creating slides... (${doneCount} of ${scenes.length})`, progress_pct: donePct }).eq('id', videoId)
        }
      }
    }
    console.log(`[video ${videoId}] Slides done.`)
    await admin.from('videos').update({ status: 'assembling', progress_detail: 'Assembling your video...', progress_pct: 75 }).eq('id', videoId)
    if (jobId) await updateJobProgress(admin, jobId, 75, 'running')

    // STAGE 4: Assemble video via VPS
    console.log(`[video ${videoId}] Sending to VPS for assembly at ${VIDEO_ASSEMBLY_URL}...`)
    let assemblyResult: { success: boolean; videoUrl: string; thumbnailUrl: string; durations: number[]; totalDuration: number }
    try {
      // Use http module for the VPS call to avoid undici's 300s headers timeout
      const http = await import('http')
      const vpsUrl = new URL(`${VIDEO_ASSEMBLY_URL}/assemble`)
      const bodyStr = JSON.stringify({
        slides: slideBuffers.map(b => b.toString('base64')),
        audios: audioBuffers.map(b => b.toString('base64')),
        videoId,
        userId: user.id,
        musicUrl: finalMusicUrl || undefined,
        isTrial: (!cardOnFile && !isPaidUser && !hasReferralDiscount),
      })

      const vpsResult = await new Promise<{ ok: boolean; status: number; data: any }>((resolve, reject) => {
        const req = http.request({
          hostname: vpsUrl.hostname,
          port: parseInt(vpsUrl.port || '4000'),
          path: vpsUrl.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-secret': VIDEO_ASSEMBLY_SECRET,
            'Content-Length': Buffer.byteLength(bodyStr),
          },
          timeout: 660000, // 11 minutes
        }, (res) => {
          let data = ''
          res.on('data', chunk => { data += chunk })
          res.on('end', () => {
            try {
              resolve({ ok: res.statusCode === 200, status: res.statusCode ?? 500, data: JSON.parse(data) })
            } catch {
              resolve({ ok: false, status: res.statusCode ?? 500, data: { error: data } })
            }
          })
        })
        req.on('error', reject)
        req.on('timeout', () => { req.destroy(); reject(new Error('VPS request timed out after 11 minutes')) })
        req.write(bodyStr)
        req.end()
      })

      if (!vpsResult.ok) {
        throw new Error(vpsResult.data?.error || `VPS returned ${vpsResult.status}`)
      }

      assemblyResult = vpsResult.data as typeof assemblyResult
    } catch (fetchErr) {
      console.error(`[video ${videoId}] VPS fetch failed:`, fetchErr)
      throw new Error(`Could not reach video assembly server. Please try again. (${fetchErr instanceof Error ? fetchErr.message : 'connection failed'})`)
    }

    console.log(`[video ${videoId}] VPS assembly complete.`)
    await admin.from('videos').update({ progress_detail: 'Uploading final video...', progress_pct: 90 }).eq('id', videoId)

    // Upload individual slides for PDF/PPTX download
    const slideUrls: string[] = []
    for (let i = 0; i < slideBuffers.length; i++) {
      const slidePath = `${user.id}/${videoId}/slide_${i}.png`
      await admin.storage.from('videos').upload(slidePath, slideBuffers[i], { contentType: 'image/png', upsert: true })
      const { data: slideUrl } = admin.storage.from('videos').getPublicUrl(slidePath)
      slideUrls.push(slideUrl.publicUrl)
    }

    // Extract disclaimers from policy data if available
    const disclaimers = (policyData as any)?.disclaimers ?? null

    await admin.from('videos').update({
      video_url: assemblyResult.videoUrl,
      thumbnail_url: assemblyResult.thumbnailUrl,
      duration: assemblyResult.totalDuration,
      slide_durations: assemblyResult.durations ?? null,
      status: 'completed',
      slide_urls: slideUrls,
      disclaimers: disclaimers,
      progress_detail: null,
      progress_pct: 100,
    }).eq('id', videoId)

    // Log to unified creations table (non-blocking)
    const videoTitle = scenes[0]?.title ?? (policyData as any)?.title ?? (policyData as any)?.policyType ?? 'Untitled Video'
    await admin.from('creations').insert({
      user_id: user.id,
      type: 'video',
      title: videoTitle,
      thumbnail_url: assemblyResult.thumbnailUrl,
      file_url: assemblyResult.videoUrl,
    })

    // Scrape company website for chatbot context (non-blocking)
    try {
      const brandGuide = brand?.brand_guide_data as Record<string, string> | null
      const companyWebsite = brandGuide?.website ?? null
      if (companyWebsite) {
        console.log(`[video ${videoId}] Scraping company website for chatbot context...`)
        const scrapeUrl = companyWebsite.startsWith('http') ? companyWebsite : `https://${companyWebsite}`
        const webRes = await fetch(scrapeUrl, { signal: AbortSignal.timeout(10000) })
        if (webRes.ok) {
          const html = await webRes.text()
          // Strip HTML tags, scripts, styles — keep text content
          const textContent = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
            .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
            .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 8000) // Cap at 8KB

          if (textContent.length > 100) {
            await admin.from('videos').update({
              company_context: textContent,
            }).eq('id', videoId)
            console.log(`[video ${videoId}] Company context saved (${textContent.length} chars)`)
          }
        }
      }
    } catch (err) {
      console.log(`[video ${videoId}] Company scrape skipped:`, err instanceof Error ? err.message : 'failed')
    }

    // Mark job complete and send notification
    if (jobId) await updateJobProgress(admin, jobId, 100, 'completed', { result_url: `/videos/${videoId}` })
    await sendNotification(admin, user.id, {
      type: 'video_complete',
      title: 'Video ready!',
      message: `Your video "${videoTitle}" has been generated successfully.`,
      link: `/videos/${videoId}`,
    })

    // Send email notification that video is ready
    try {
      const { data: creatorProfile } = await admin.from('profiles').select('email').eq('id', user.id).single()
      if (creatorProfile?.email) {
        const videoPageUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://docs2video.com'}/videos/${videoId}`
        await sendVideoReadyEmail(creatorProfile.email, videoTitle, videoPageUrl)
      }
    } catch (emailErr) {
      console.error(`[video ${videoId}] Video ready email failed:`, emailErr)
    }

    // Deduct free video credit AFTER successful completion
    if (shouldDeductFreeVideo) {
      const admin2 = createAdminClient()
      await admin2.from('profiles').update({
        free_videos_remaining: freeRemaining - 1,
      }).eq('id', user.id)
      console.log(`[video ${videoId}] Deducted 1 free video credit (${freeRemaining - 1} remaining)`)
    }

    console.log(`[video ${videoId}] Complete!`)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(`[video ${videoId}] Error:`, err)
    const message = err instanceof Error ? err.message : 'Video generation failed'
    await admin.from('videos').update({ status: 'failed', error_message: message }).eq('id', videoId)
    if (jobId) await updateJobProgress(admin, jobId, 0, 'failed', { error_message: message })
    await sendNotification(admin, user.id, {
      type: 'video_failed',
      title: 'Video generation failed',
      message,
      link: `/videos/${videoId}`,
    })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
