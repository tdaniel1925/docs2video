import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { isAdmin , isAdminRequest } from '../../../_lib/admin'
import { generateDemoScript } from '../../../_lib/script-generator'
import { generateSlide } from '../../../_lib/gemini'
import { compositeSlide } from '../../../_lib/composite'
import { synthesizeSpeech } from '../../../_lib/tts'
import { assembleVideo } from '../../../_lib/video'
import OpenAI from 'openai'
import FirecrawlApp from '@mendable/firecrawl-js'

export const runtime = 'nodejs'
export const maxDuration = 300

let _openai: OpenAI | null = null
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  return _openai
}

let _firecrawl: InstanceType<typeof FirecrawlApp> | null = null
function getFirecrawl() {
  if (!_firecrawl) _firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY! })
  return _firecrawl
}

const EXTRACTION_PROMPT = `You are an expert company analyst. Analyze this website content and extract detailed information about the company.

Return ONLY valid JSON (no markdown, no code fences):
{
  "companyName": "string — the exact company name",
  "description": "string — 2-3 sentence description of what they do",
  "services": ["string array — their main services/products"],
  "uniqueSellingPoints": ["string array — what makes them different"],
  "tagline": "string or null — their tagline if visible",
  "industry": "string — their industry",
  "colors": {
    "primary": "#hex — main brand color from the site",
    "secondary": "#hex — secondary color",
    "accent": "#hex — accent color"
  },
  "contactEmail": "string or null — contact email if found",
  "contactName": "string or null — founder/CEO name if found"
}`

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !(await isAdminRequest(user))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { url } = (await request.json()) as { url: string }
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Validate URL
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`)
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Create prospect_demos record
    const { data: prospect, error: insertErr } = await admin
      .from('prospect_demos')
      .insert({ url: parsedUrl.href, status: 'scraping' })
      .select()
      .single()

    if (insertErr || !prospect) {
      return NextResponse.json({ error: 'Failed to create prospect record' }, { status: 500 })
    }

    const prospectId = prospect.id

    try {
      // Step 1: Scrape website with Firecrawl
      const scrapeResult = await getFirecrawl().scrape(parsedUrl.href, {
        formats: ['markdown', 'html'],
      })

      const markdown = (scrapeResult as any)?.markdown || (scrapeResult as any)?.data?.markdown || ''
      const html = (scrapeResult as any)?.html || (scrapeResult as any)?.data?.html || ''

      if (!markdown && !html) {
        throw new Error('No content scraped from website')
      }

      // Step 2: Extract company info with OpenAI
      const extractionResponse = await getOpenAI().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: EXTRACTION_PROMPT },
          { role: 'user', content: markdown.slice(0, 8000) },
        ],
        temperature: 0.3,
      })

      const extractedText = extractionResponse.choices[0]?.message?.content?.trim() ?? '{}'
      const cleaned = extractedText.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')
      let companyInfo: any
      try {
        companyInfo = JSON.parse(cleaned)
      } catch {
        companyInfo = { companyName: parsedUrl.hostname, description: 'Unknown company', services: [], uniqueSellingPoints: [], tagline: null, industry: 'general', colors: { primary: '#2563eb', secondary: '#1e40af', accent: '#3b82f6' } }
      }

      // Step 3: Download logo from website
      let logoImageUrl: string | null = null
      const logoImgMatch = html.match(/<img[^>]*(?:class=["'][^"']*logo[^"']*["']|alt=["'][^"']*logo[^"']*["']|src=["'][^"']*logo[^"']*["'])[^>]*src=["']([^"']+)["']/i)
        ?? html.match(/<img[^>]*src=["']([^"']*logo[^"']+)["']/i)
      const faviconMatch = html.match(/<link[^>]*rel=["'](?:icon|apple-touch-icon)["'][^>]*href=["']([^"']+)["']/i)
      const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)

      const rawLogoUrl = logoImgMatch?.[1] ?? ogImageMatch?.[1] ?? faviconMatch?.[1]
      if (rawLogoUrl) {
        const fullLogoUrl = rawLogoUrl.startsWith('http') ? rawLogoUrl : new URL(rawLogoUrl, parsedUrl.href).href
        try {
          const logoRes = await fetch(fullLogoUrl, { signal: AbortSignal.timeout(10000) })
          if (logoRes.ok) {
            const logoBuffer = Buffer.from(await logoRes.arrayBuffer())
            const ext = fullLogoUrl.split('.').pop()?.split('?')[0]?.split('#')[0] ?? 'png'
            const safeExt = ['png', 'jpg', 'jpeg', 'svg', 'webp', 'ico'].includes(ext) ? ext : 'png'
            const storagePath = `prospect-logos/${prospectId}.${safeExt}`
            await admin.storage.from('logos').upload(storagePath, logoBuffer, {
              contentType: logoRes.headers.get('content-type') || 'image/png',
              upsert: true,
            })
            const { data: urlData } = admin.storage.from('logos').getPublicUrl(storagePath)
            logoImageUrl = urlData.publicUrl
          }
        } catch { /* proceed without logo */ }
      }

      // Step 4: Create brand record
      const colors = {
        primary: companyInfo.colors?.primary ?? '#2563eb',
        secondary: companyInfo.colors?.secondary ?? '#1e40af',
        accent: companyInfo.colors?.accent ?? '#3b82f6',
        background: '#ffffff',
        text: '#1a1a1a',
      }

      const { data: brand } = await admin
        .from('brands')
        .insert({
          user_id: user.id,
          name: companyInfo.companyName ?? parsedUrl.hostname,
          url: parsedUrl.href,
          logo_url: logoImageUrl,
          colors,
          description: companyInfo.description,
          services: companyInfo.services ?? [],
          unique_selling_points: companyInfo.uniqueSellingPoints ?? [],
          tagline: companyInfo.tagline,
        })
        .select()
        .single()

      // Update prospect record with extracted info
      await admin.from('prospect_demos').update({
        company_name: companyInfo.companyName ?? parsedUrl.hostname,
        contact_email: companyInfo.contactEmail ?? null,
        contact_name: companyInfo.contactName ?? null,
        brand_id: brand?.id ?? null,
        logo_url: logoImageUrl,
        status: 'scripting',
        updated_at: new Date().toISOString(),
      }).eq('id', prospectId)

      // Step 5: Generate sales script
      const scenes = await generateDemoScript(
        {
          companyName: companyInfo.companyName ?? parsedUrl.hostname,
          description: companyInfo.description ?? '',
          services: companyInfo.services ?? [],
          uniqueSellingPoints: companyInfo.uniqueSellingPoints ?? [],
          tagline: companyInfo.tagline ?? null,
        },
        colors
      )

      await admin.from('prospect_demos').update({
        script: scenes,
        status: 'generating',
        updated_at: new Date().toISOString(),
      }).eq('id', prospectId)

      // Step 6: Generate slides (3-4 slides)
      const slideScenes = scenes.slice(0, 4)
      const extractedData = {
        title: `${companyInfo.companyName} - Docs2Video Demo`,
        industry: companyInfo.industry ?? 'general',
        sections: slideScenes.map((s: any) => ({ title: s.title, content: s.narration })),
        keyMetrics: [],
        bulletPoints: [],
      }

      const slideBuffers: Buffer[] = []
      for (let i = 0; i < slideScenes.length; i++) {
        const slideBuffer = await generateSlide(
          extractedData as any,
          i,
          'corporate-clean',
          companyInfo.companyName ?? null,
          null, // logo composited separately
          colors,
          slideScenes[i].slidePrompt,
          false,
          undefined,
          undefined,
          undefined,
          slideScenes.length,
        )
        // Composite logo onto slide
        const composited = await compositeSlide(
          slideBuffer,
          null, // no headshot photo
          logoImageUrl,
          i === 0, // isFirstSlide
          i === slideScenes.length - 1, // isLastSlide
        )
        slideBuffers.push(composited)
      }

      await admin.from('prospect_demos').update({
        status: 'assembling',
        updated_at: new Date().toISOString(),
      }).eq('id', prospectId)

      // Step 7: Generate audio
      const audioBuffers: Buffer[] = []
      for (const scene of slideScenes) {
        const audio = await synthesizeSpeech(scene.narration, 'nova')
        audioBuffers.push(audio)
      }

      // Step 8: Assemble video
      const { videoBuffer, durations } = await assembleVideo(slideBuffers, audioBuffers)
      const totalDuration = Math.round(durations.reduce((sum, d) => sum + d, 0))

      // Step 9: Upload video to Supabase storage
      const videoPath = `prospect-demos/${prospectId}.mp4`
      await admin.storage.from('videos').upload(videoPath, videoBuffer, {
        contentType: 'video/mp4',
        upsert: true,
      })
      const { data: videoUrlData } = admin.storage.from('videos').getPublicUrl(videoPath)

      // Upload thumbnail (first slide as PNG)
      const thumbnailPath = `prospect-demos/${prospectId}-thumb.png`
      await admin.storage.from('videos').upload(thumbnailPath, slideBuffers[0], {
        contentType: 'image/png',
        upsert: true,
      })
      const { data: thumbUrlData } = admin.storage.from('videos').getPublicUrl(thumbnailPath)

      // Step 10: Update record as ready for review
      const { data: finalRecord } = await admin.from('prospect_demos').update({
        video_url: videoUrlData.publicUrl,
        thumbnail_url: thumbUrlData.publicUrl,
        duration: totalDuration,
        status: 'ready_for_review',
        updated_at: new Date().toISOString(),
      }).eq('id', prospectId).select().single()

      return NextResponse.json(finalRecord)
    } catch (err: any) {
      // Update record as failed
      await admin.from('prospect_demos').update({
        status: 'failed',
        error_message: err?.message ?? 'Unknown error',
        updated_at: new Date().toISOString(),
      }).eq('id', prospectId)

      return NextResponse.json({
        error: err?.message ?? 'Pipeline failed',
        prospectId,
      }, { status: 500 })
    }
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !(await isAdminRequest(user))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('prospect_demos')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ prospects: data ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 })
  }
}
