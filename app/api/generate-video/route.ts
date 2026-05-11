import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { generateScript } from '../../_lib/script-generator'
import { generateSlide } from '../../_lib/gemini'
import { compositeSlide } from '../../_lib/composite'
import { synthesizeSpeech } from '../../_lib/tts'
import { assembleVideo } from '../../_lib/video'
import { deductCredits } from '../../_lib/credits'
import type { Brand, ExtractedPolicyData, SlideStyleId } from '../../_lib/types'
import type { ExtractedData } from '../../_lib/extract-types'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
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

  try {
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
      console.log(`[video ${videoId}] Generating ${scenes.length} slides${logoBuffer ? ' (with logo)' : ''}${referenceSlides ? ' (with brand deck references)' : ''}...`)
      slideBuffers = []
      for (let i = 0; i < scenes.length; i++) {
        console.log(`[video ${videoId}] Slide ${i + 1} of ${scenes.length}...`)
        const guideData = brand?.brand_guide_data as Record<string, string> | null
        const contactInfo = {
          phone: guideData?.phone ?? undefined,
          website: guideData?.website ?? undefined,
        }
        let buf = await generateSlide(
          policyData, i, effectiveStyleId as any,
          brand?.name ?? null, logoUrl, colors,
          scenes[i].slidePrompt, !!photoUrl, contactInfo,
          logoBuffer, referenceSlides
        )
        // Composite real photo onto slide
        buf = await compositeSlide(buf, photoUrl, null, i === 0, i === scenes.length - 1, standingPhotoUrl)
        slideBuffers.push(buf)
      }
    }
    console.log(`[video ${videoId}] Slides done.`)
    await admin.from('videos').update({ status: 'assembling' }).eq('id', videoId)

    // STAGE 4: Assemble video
    console.log(`[video ${videoId}] Assembling video...`)
    const { videoBuffer, durations } = await assembleVideo(slideBuffers, audioBuffers, undefined, musicUrl)

    // Upload video
    const videoPath = `${user.id}/${videoId}.mp4`
    const { error: uploadError } = await admin.storage
      .from('videos')
      .upload(videoPath, videoBuffer, { contentType: 'video/mp4', upsert: true })
    if (uploadError) throw uploadError

    const { data: videoUrl } = admin.storage.from('videos').getPublicUrl(videoPath)

    // Upload thumbnail
    const thumbPath = `${user.id}/${videoId}_thumb.png`
    await admin.storage
      .from('videos')
      .upload(thumbPath, slideBuffers[0], { contentType: 'image/png', upsert: true })
    const { data: thumbUrl } = admin.storage.from('videos').getPublicUrl(thumbPath)

    // Upload all individual slides for PDF/PPTX download
    const slideUrls: string[] = []
    for (let i = 0; i < slideBuffers.length; i++) {
      const slidePath = `${user.id}/${videoId}/slide_${i}.png`
      await admin.storage.from('videos').upload(slidePath, slideBuffers[i], { contentType: 'image/png', upsert: true })
      const { data: slideUrl } = admin.storage.from('videos').getPublicUrl(slidePath)
      slideUrls.push(slideUrl.publicUrl)
    }

    const totalDuration = durations.reduce((sum, d) => sum + d, 0)

    await admin.from('videos').update({
      video_url: videoUrl.publicUrl,
      thumbnail_url: thumbUrl.publicUrl,
      duration: totalDuration,
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
      thumbnail_url: thumbUrl.publicUrl,
      file_url: videoUrl.publicUrl,
      credits_used: creditCost,
    })

    console.log(`[video ${videoId}] Complete!`)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(`[video ${videoId}] Error:`, err)
    const message = err instanceof Error ? err.message : 'Video generation failed'
    await admin.from('videos').update({ status: 'failed', error_message: message }).eq('id', videoId)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
