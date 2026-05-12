import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { generateScript } from '../../_lib/script-generator'
import { generateSlide } from '../../_lib/gemini'
import { compositeSlide } from '../../_lib/composite'
import { synthesizeSpeech } from '../../_lib/tts'
// Video assembly is offloaded to the Hetzner VPS (video-service)
const VIDEO_ASSEMBLY_URL = process.env.VIDEO_ASSEMBLY_URL || 'http://5.161.215.156:4000'
const VIDEO_ASSEMBLY_SECRET = process.env.VIDEO_ASSEMBLY_SECRET || 'docs2video-assembly-secret-2026'
import { deductCredits } from '../../_lib/credits'
import { sendNotification, createJob, updateJobProgress } from '../../_lib/notify'
import type { Brand, ExtractedPolicyData, SlideStyleId } from '../../_lib/types'
import type { ExtractedData } from '../../_lib/extract-types'

export const runtime = 'nodejs'
export const maxDuration = 800

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Pre-check credits before generation (video costs 3 credits)
  const adminForCheck = createAdminClient()
  const { data: profile } = await adminForCheck.from('profiles').select('credits_remaining').eq('id', user.id).single()
  if (!profile || profile.credits_remaining < 3) {
    return NextResponse.json({ error: 'Insufficient credits. You need at least 3 credits to generate a video.' }, { status: 403 })
  }

  const body = await request.json()
  const { videoId, policyData, brandId, voiceId, styleId, approvedSlides, preGeneratedScenes, preGeneratedAudioId, detailed, musicUrl } = body as {
    videoId: string
    policyData: ExtractedPolicyData | ExtractedData
    brandId: string | null
    voiceId: string
    styleId?: SlideStyleId
    approvedSlides?: string[]
    preGeneratedScenes?: any[]
    preGeneratedAudioId?: string
    detailed?: boolean
    musicUrl?: string
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

  try {
    if (jobId) await updateJobProgress(admin, jobId, 5, 'running')

    // STAGE 1: Generate script (or reuse pre-generated scenes)
    let scenes
    if (preGeneratedScenes && preGeneratedScenes.length > 0) {
      console.log(`[video ${videoId}] Using ${preGeneratedScenes.length} pre-generated scenes.`)
      scenes = preGeneratedScenes
      await admin.from('videos').update({ script: scenes, status: 'generating_audio' }).eq('id', videoId)
    } else {
      console.log(`[video ${videoId}] Generating script...`)
      await admin.from('videos').update({ status: 'scripting' }).eq('id', videoId)
      scenes = await generateScript(policyData, brand?.name ?? null, colors, detailed ?? false)
      await admin.from('videos').update({ script: scenes, status: 'generating_audio' }).eq('id', videoId)
    }

    // STAGE 2: Get audio (use pre-generated if available, otherwise generate)
    let audioBuffers: Buffer[]
    if (preGeneratedAudioId) {
      console.log(`[video ${videoId}] Using pre-generated audio: ${preGeneratedAudioId}`)
      await admin.from('videos').update({ status: 'generating_audio' }).eq('id', videoId)
      audioBuffers = []
      for (let i = 0; i < scenes.length; i++) {
        const path = `${user.id}/pre-audio/${preGeneratedAudioId}/clip_${i}.mp3`
        const { data } = await admin.storage.from('videos').download(path)
        if (data) {
          audioBuffers.push(Buffer.from(await data.arrayBuffer()))
        } else {
          // Fallback: regenerate this clip
          console.log(`[video ${videoId}] Pre-gen clip ${i} not found, regenerating...`)
          audioBuffers.push(await synthesizeSpeech(scenes[i].narration, voiceId))
        }
      }
      console.log(`[video ${videoId}] Audio loaded from cache.`)
    } else {
      console.log(`[video ${videoId}] Generating audio for ${scenes.length} scenes...`)
      await admin.from('videos').update({ status: 'generating_audio' }).eq('id', videoId)
      audioBuffers = await Promise.all(
        scenes.map((scene) => synthesizeSpeech(scene.narration, voiceId))
      )
      console.log(`[video ${videoId}] Audio done.`)
    }
    await admin.from('videos').update({ status: 'generating_slides' }).eq('id', videoId)
    if (jobId) await updateJobProgress(admin, jobId, 40, 'running')

    // Get agent photo for compositing
    const { data: agentProfile } = await admin.from('profiles').select('photo_url, photo_standing_url').eq('id', user.id).single()
    const photoUrl = agentProfile?.photo_url ?? null
    const standingPhotoUrl = agentProfile?.photo_standing_url ?? null
    const logoUrl = brand?.logo_file_url ?? brand?.logo_url ?? null

    // Download logo image for Gemini integration
    let logoBuffer: Buffer | null = null
    if (logoUrl) {
      try {
        const logoRes = await fetch(logoUrl, { signal: AbortSignal.timeout(8000) })
        if (logoRes.ok) logoBuffer = Buffer.from(await logoRes.arrayBuffer())
      } catch {
        console.log(`[video ${videoId}] Could not download logo, proceeding without it`)
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

    // STAGE 3: Generate slides (or use pre-approved ones)
    let slideBuffers: Buffer[]
    if (approvedSlides && approvedSlides.length >= 4) {
      console.log(`[video ${videoId}] Using pre-approved slides.`)
      slideBuffers = approvedSlides.map(dataUri => {
        const base64 = dataUri.replace(/^data:image\/\w+;base64,/, '')
        return Buffer.from(base64, 'base64')
      })
    } else {
      console.log(`[video ${videoId}] Generating ${scenes.length} slides in parallel batches${logoBuffer ? ' (with logo)' : ''}...`)
      slideBuffers = []
      const guideData = brand?.brand_guide_data as Record<string, string> | null
      const contactInfo = {
        phone: guideData?.phone ?? undefined,
        website: guideData?.website ?? undefined,
      }
      // Generate slides 3 at a time to stay within rate limits but be fast
      for (let i = 0; i < scenes.length; i += 3) {
        const batch = scenes.slice(i, i + 3)
        console.log(`[video ${videoId}] Slide batch ${Math.floor(i / 3) + 1} (${batch.length} slides)...`)
        const batchResults = await Promise.all(
          batch.map(async (scene: any, j: number) => {
            const idx = i + j
            let buf = await generateSlide(
              policyData, idx, effectiveStyleId as any,
              brand?.name ?? null, logoUrl, colors,
              scene.slidePrompt, !!photoUrl, contactInfo,
              logoBuffer, referenceSlides
            )
            buf = await compositeSlide(buf, photoUrl, logoUrl, idx === 0, idx === scenes.length - 1, standingPhotoUrl, brand?.name ?? null, colors.primary, contactInfo)
            return buf
          })
        )
        slideBuffers.push(...batchResults)
      }
    }
    console.log(`[video ${videoId}] Slides done.`)
    await admin.from('videos').update({ status: 'assembling' }).eq('id', videoId)
    if (jobId) await updateJobProgress(admin, jobId, 75, 'running')

    // STAGE 4: Assemble video via VPS
    console.log(`[video ${videoId}] Sending to VPS for assembly at ${VIDEO_ASSEMBLY_URL}...`)
    let assemblyRes: Response
    try {
      // Use http module for the VPS call to avoid undici's 300s headers timeout
      const http = await import('http')
      const vpsUrl = new URL(`${VIDEO_ASSEMBLY_URL}/assemble`)
      const bodyStr = JSON.stringify({
        slides: slideBuffers.map(b => b.toString('base64')),
        audios: audioBuffers.map(b => b.toString('base64')),
        videoId,
        userId: user.id,
        musicUrl: musicUrl || undefined,
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

      const assemblyResult = vpsResult.data as {
        success: boolean
        videoUrl: string
        thumbnailUrl: string
        durations: number[]
        totalDuration: number
      }
    } catch (fetchErr) {
      console.error(`[video ${videoId}] VPS fetch failed:`, fetchErr)
      throw new Error(`Could not reach video assembly server. Please try again. (${fetchErr instanceof Error ? fetchErr.message : 'connection failed'})`)
    }

    console.log(`[video ${videoId}] VPS assembly complete.`)

    // Upload individual slides for PDF/PPTX download
    const slideUrls: string[] = []
    for (let i = 0; i < slideBuffers.length; i++) {
      const slidePath = `${user.id}/${videoId}/slide_${i}.png`
      await admin.storage.from('videos').upload(slidePath, slideBuffers[i], { contentType: 'image/png', upsert: true })
      const { data: slideUrl } = admin.storage.from('videos').getPublicUrl(slidePath)
      slideUrls.push(slideUrl.publicUrl)
    }

    await admin.from('videos').update({
      video_url: assemblyResult.videoUrl,
      thumbnail_url: assemblyResult.thumbnailUrl,
      duration: assemblyResult.totalDuration,
      status: 'completed',
      slide_urls: slideUrls,
    }).eq('id', videoId)

    // Decrement credits (standard = 1, detailed = 2)
    const creditCost = detailed ? 2 : 1
    const deducted = await deductCredits(admin, user.id, creditCost)
    if (!deducted) {
      console.log(`[video ${videoId}] Warning: insufficient credits but video already generated`)
    }

    // Log to unified creations table (non-blocking)
    const videoTitle = scenes[0]?.slidePrompt ?? (policyData as any)?.policyType ?? 'Untitled Video'
    await admin.from('creations').insert({
      user_id: user.id,
      type: 'video',
      title: videoTitle,
      thumbnail_url: assemblyResult.thumbnailUrl,
      file_url: assemblyResult.videoUrl,
      credits_used: creditCost,
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
