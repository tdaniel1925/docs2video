// @ts-nocheck — this route is disabled (returns 503), skip type checking
import { NextResponse } from 'next/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { scrapeBrand } from '../../_lib/brand-scraper'
import { generateDemoScript } from '../../_lib/script-generator'
import { generateSlide } from '../../_lib/gemini'
import { synthesizeSpeech } from '../../_lib/tts'
import { assembleVideo } from '../../_lib/video'
import { sendDemoReadyEmail, sendDemoReadySms } from '../../_lib/notifications'

export const runtime = 'nodejs'
export const maxDuration = 300

function extractDomain(url: string): string {
  let fullUrl = url.trim()
  if (!fullUrl.startsWith('http')) fullUrl = 'https://' + fullUrl
  const parsed = new URL(fullUrl)
  return parsed.hostname.replace('www.', '')
}

export async function POST(request: Request) {
  // DISABLED: This route has no auth and uses local FFmpeg which doesn't work on Vercel.
  // Will be rebuilt to use the VPS assembly pipeline with proper auth.
  return NextResponse.json({ error: 'Demo video generation is temporarily disabled. Please sign up to create videos.' }, { status: 503 })

  const body = await request.json()
  const { url, email, phone, companyName } = body as { url: string; email?: string; phone?: string; companyName?: string }

  if (!url || url.trim().length < 4) {
    return NextResponse.json({ error: 'Please enter a valid website URL' }, { status: 400 })
  }

  let domain: string
  try {
    domain = extractDomain(url)
  } catch {
    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Check cache — return existing completed demo
  const { data: existing } = await admin
    .from('demo_videos')
    .select('*')
    .eq('domain', domain)
    .eq('status', 'completed')
    .single()

  if (existing?.video_url) {
    return NextResponse.json({
      id: existing.id,
      status: 'completed',
      videoUrl: existing.video_url,
      thumbnailUrl: existing.thumbnail_url,
      brandData: existing.brand_data,
    })
  }

  // Check if one is already in progress
  const { data: inProgress } = await admin
    .from('demo_videos')
    .select('id, status')
    .eq('domain', domain)
    .in('status', ['pending', 'scraping', 'scripting', 'generating_slides', 'generating_audio', 'assembling'])
    .single()

  if (inProgress) {
    return NextResponse.json({
      id: inProgress.id,
      status: inProgress.status,
    })
  }

  // Create new demo record
  const insertData: Record<string, unknown> = { domain, status: 'scraping', brand_data: {} }
  if (email) insertData.email = email
  if (phone) insertData.phone = phone

  const { data: demo, error: insertError } = await admin
    .from('demo_videos')
    .insert(insertData)
    .select('id')
    .single()

  if (insertError || !demo) {
    console.error('[demo] Insert error:', insertError)
    return NextResponse.json({ error: 'Failed to start demo generation' }, { status: 500 })
  }

  const demoId = demo.id

  // Start the pipeline (non-blocking — respond with ID immediately, process in background)
  // We use waitUntil pattern: the route returns the ID, and the pipeline runs to completion
  const pipeline = (async () => {
    try {
      // STAGE 1: Scrape brand
      console.log(`[demo ${demoId}] Scraping ${domain}...`)
      const brandData = await scrapeBrand(url)
      // Use user-provided company name if available, otherwise fall back to scraped
      const displayName = companyName || brandData.companyName
      brandData.companyName = displayName
      await admin.from('demo_videos').update({ brand_data: brandData, status: 'scripting' }).eq('id', demoId)

      // STAGE 2: Generate short demo script
      console.log(`[demo ${demoId}] Generating demo script...`)
      const colors = {
        primary: brandData.primaryColor,
        secondary: brandData.secondaryColor,
        accent: brandData.accentColor,
        background: brandData.backgroundColor,
        text: brandData.textColor,
      }
      const scenes = await generateDemoScript(brandData, colors)
      await admin.from('demo_videos').update({ status: 'generating_slides' }).eq('id', demoId)

      // STAGE 3: Generate slides
      console.log(`[demo ${demoId}] Generating ${scenes.length} slides...`)
      const demoData = {
        title: displayName,
        subtitle: brandData.tagline,
        source: domain,
        keyMetrics: brandData.services.slice(0, 4).map(s => ({ label: 'Service', value: s, highlight: false })),
        sections: [{ title: 'About', content: brandData.description }],
        bulletPoints: brandData.uniqueSellingPoints,
        additionalNotes: [],
      }
      // Download logo if available
      let logoBuffer: Buffer | null = null
      if (brandData.logoUrl) {
        try {
          const logoRes = await fetch(brandData.logoUrl, { signal: AbortSignal.timeout(8000) })
          if (logoRes.ok) logoBuffer = Buffer.from(await logoRes.arrayBuffer())
        } catch {
          console.log(`[demo ${demoId}] Could not download logo, proceeding without it`)
        }
      }

      const demoContactInfo = { website: domain }
      const slideBuffers: Buffer[] = []
      for (let i = 0; i < scenes.length; i++) {
        const buf = await generateSlide(
          demoData, i, 'blue-steps',
          displayName, brandData.logoUrl, colors,
          scenes[i].slidePrompt, false, demoContactInfo,
          logoBuffer
        )
        slideBuffers.push(buf)
      }
      await admin.from('demo_videos').update({ status: 'generating_audio' }).eq('id', demoId)

      // STAGE 4: Generate TTS
      console.log(`[demo ${demoId}] Generating audio...`)
      const audioBuffers = await Promise.all(
        scenes.map(scene => synthesizeSpeech(scene.narration, 'Kore'))
      )
      await admin.from('demo_videos').update({ status: 'assembling' }).eq('id', demoId)

      // STAGE 5: Assemble video with watermark
      console.log(`[demo ${demoId}] Assembling video with watermark...`)
      const { videoBuffer } = await assembleVideo(slideBuffers, audioBuffers, 'Made with Docs2Video')

      // Upload video to demo-videos bucket
      const videoPath = `${domain}/demo.mp4`
      const { error: uploadError } = await admin.storage
        .from('demo-videos')
        .upload(videoPath, videoBuffer, { contentType: 'video/mp4', upsert: true })
      if (uploadError) throw uploadError

      const { data: videoUrlData } = admin.storage.from('demo-videos').getPublicUrl(videoPath)

      // Upload thumbnail
      const thumbPath = `${domain}/thumb.png`
      await admin.storage
        .from('demo-videos')
        .upload(thumbPath, slideBuffers[0], { contentType: 'image/png', upsert: true })
      const { data: thumbUrlData } = admin.storage.from('demo-videos').getPublicUrl(thumbPath)

      // Mark complete
      await admin.from('demo_videos').update({
        video_url: videoUrlData.publicUrl,
        thumbnail_url: thumbUrlData.publicUrl,
        status: 'completed',
        updated_at: new Date().toISOString(),
      }).eq('id', demoId)

      // Send notifications
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3002'
      const demoPageUrl = videoUrlData.publicUrl
      const signupUrl = `${baseUrl}/signup`
      if (email) {
        await sendDemoReadyEmail(email, displayName, demoPageUrl, signupUrl)
      }
      if (phone) {
        await sendDemoReadySms(phone, displayName, demoPageUrl)
      }

      console.log(`[demo ${demoId}] Complete!`)
    } catch (err) {
      console.error(`[demo ${demoId}] Error:`, err)
      const message = err instanceof Error ? err.message : 'Demo generation failed'
      await admin.from('demo_videos').update({
        status: 'failed',
        error_message: message,
        updated_at: new Date().toISOString(),
      }).eq('id', demoId)
    }
  })()

  // Don't await — let it run in background. The client will poll for status.
  pipeline.catch(() => {})

  return NextResponse.json({
    id: demoId,
    status: 'scraping',
  })
}
