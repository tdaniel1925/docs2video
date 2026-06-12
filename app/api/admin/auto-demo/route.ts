import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { isAdmin , isAdminRequest } from '../../../_lib/admin'
import { scrapeBrand } from '../../../_lib/brand-scraper'
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

const EXTRACTION_PROMPT = `You are an expert content analyst. Analyze this website text and extract key information.

Return ONLY valid JSON (no markdown, no code fences):
{
  "title": "string — a clear title summarizing this company/content",
  "companyName": "string — the exact company name",
  "industry": "string or null — the company's industry",
  "description": "string — 1-2 sentence description of what the company does",
  "keyMetrics": [{ "label": "string", "value": "string", "highlight": true/false }],
  "sections": [{ "title": "string", "content": "string" }],
  "bulletPoints": ["string"]
}`

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !(await isAdminRequest(user))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { urls } = (await request.json()) as { urls: string[] }
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: 'No URLs provided' }, { status: 400 })
    }

    // Limit to 10 URLs per batch
    const validUrls = urls
      .map(u => u.trim())
      .filter(u => u.length > 0)
      .slice(0, 10)

    const admin = createAdminClient()
    const results: { url: string; videoId?: string; brandId?: string; companyName?: string; error?: string }[] = []

    for (const url of validUrls) {
      try {
        // Validate URL
        let parsedUrl: URL
        try {
          parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`)
        } catch {
          results.push({ url, error: 'Invalid URL' })
          continue
        }

        // Scrape with Firecrawl
        console.log(`[auto-demo] Scraping ${parsedUrl.toString()}...`)
        const scrapeResult = await getFirecrawl().scrape(parsedUrl.toString(), {
          formats: ['markdown', 'html'],
        }) as any

        const markdown = scrapeResult?.markdown || scrapeResult?.data?.markdown || ''
        const html = scrapeResult?.html || scrapeResult?.data?.html || ''

        if (!markdown || markdown.length < 50) {
          results.push({ url, error: 'Could not extract content' })
          continue
        }

        // Extract content with OpenAI
        const openai = getOpenAI()
        const contentResponse = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'user', content: `${EXTRACTION_PROMPT}\n\nWebsite text from ${parsedUrl.hostname}:\n\n${markdown.slice(0, 30000)}` },
          ],
          temperature: 0.3,
        })

        const raw = contentResponse.choices[0]?.message?.content?.trim() ?? ''
        const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')
        let extractedData: any
        try {
          extractedData = JSON.parse(cleaned)
        } catch {
          results.push({ url, error: 'Failed to parse extracted data' })
          continue
        }

        // Scrape brand info
        let brandId: string | null = null
        let companyName = extractedData.companyName || parsedUrl.hostname.replace('www.', '')
        try {
          const brandAnalysis = await scrapeBrand(parsedUrl.toString(), { markdown, html })
          companyName = brandAnalysis.companyName || companyName

          const { data: newBrand, error: brandError } = await admin.from('brands').insert({
            user_id: user.id,
            name: companyName,
            logo_url: brandAnalysis.logoUrl?.startsWith('data:') ? null : (brandAnalysis.logoUrl || null),
            logo_file_url: null,
            primary_color: brandAnalysis.primaryColor || '#1B365D',
            secondary_color: brandAnalysis.secondaryColor || '#4A90D9',
            accent_color: brandAnalysis.accentColor || '#FFB347',
            background_color: brandAnalysis.backgroundColor || '#0a1628',
            text_color: brandAnalysis.textColor || '#FFFFFF',
            tagline: brandAnalysis.tagline || null,
            description: brandAnalysis.description || null,
            industry: brandAnalysis.industry || null,
            tone: brandAnalysis.tone || null,
            target_audience: brandAnalysis.targetAudience || null,
            fonts: brandAnalysis.fonts || [],
            brand_values: brandAnalysis.brandValues || [],
            services: brandAnalysis.services || [],
            social_links: brandAnalysis.socialLinks || {},
            content_themes: brandAnalysis.contentThemes || [],
            competitor_notes: brandAnalysis.competitorNotes || null,
            unique_selling_points: brandAnalysis.uniqueSellingPoints || [],
            is_default: false,
          }).select('id').single()

          if (!brandError && newBrand) {
            brandId = newBrand.id
          }
        } catch (brandErr) {
          console.error(`[auto-demo] Brand scrape failed for ${url}:`, brandErr instanceof Error ? brandErr.message : 'unknown')
        }

        // Build pipeline input so the video detail page can trigger generation
        const policyData = {
          title: `${companyName} — Company Overview`,
          subtitle: extractedData.description || null,
          source: parsedUrl.toString(),
          keyMetrics: (extractedData.services || []).slice(0, 6).map((s: string) => ({ label: 'Service', value: s })),
          sections: [
            { title: 'About', content: extractedData.description || `${companyName} is a professional services company.` },
            ...(extractedData.uniqueSellingPoints || []).slice(0, 3).map((u: string) => ({ title: 'Differentiator', content: u })),
          ],
          bulletPoints: extractedData.services || [],
          additionalNotes: extractedData.uniqueSellingPoints || [],
        }

        // Create a video record with pipeline input so generation triggers automatically
        const { data: video, error: videoError } = await admin.from('videos').insert({
          user_id: user.id,
          brand_id: brandId,
          title: `Demo: ${companyName}`,
          status: 'pending',
          voice_id: 'nova',
          is_trial: true,
          progress_detail: `Auto-demo for ${parsedUrl.hostname}. Data extracted, awaiting video generation.`,
          script: {
            _pipeline_input: {
              policyData,
              brandId,
              voiceId: 'nova',
              styleId: 'corporate-clean',
              purpose: `Create a sales demo video showing what Docs2Video can do for ${companyName}`,
              isDemoVideo: true,
            },
          },
        }).select('id').single()

        if (videoError) {
          results.push({ url, brandId: brandId ?? undefined, companyName, error: `Video creation failed: ${videoError.message}` })
          continue
        }

        results.push({
          url,
          videoId: video.id,
          brandId: brandId ?? undefined,
          companyName,
        })

        console.log(`[auto-demo] Created prospect: ${companyName} (video: ${video.id}, brand: ${brandId})`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        results.push({ url, error: msg })
        console.error(`[auto-demo] Error processing ${url}:`, err)
      }
    }

    return NextResponse.json({
      message: `Processed ${validUrls.length} URLs`,
      results,
    })
  } catch (err) {
    console.error('[auto-demo] Fatal error:', err)
    return NextResponse.json(
      { error: 'Internal error', detail: err instanceof Error ? err.message : 'Unknown' },
      { status: 500 }
    )
  }
}

// DELETE: Remove a demo video
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !(await isAdminRequest(user))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { videoId } = (await request.json()) as { videoId: string }
    if (!videoId) {
      return NextResponse.json({ error: 'videoId is required' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Get video to find associated brand
    const { data: video } = await admin.from('videos').select('brand_id').eq('id', videoId).eq('is_trial', true).single()

    // Delete the video
    const { error: delError } = await admin.from('videos').delete().eq('id', videoId).eq('is_trial', true)
    if (delError) {
      return NextResponse.json({ error: delError.message }, { status: 500 })
    }

    // Also delete associated brand if it exists
    if (video?.brand_id) {
      await admin.from('brands').delete().eq('id', video.brand_id)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[auto-demo] DELETE error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// GET: List demo videos created by admin
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !(await isAdminRequest(user))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const admin = createAdminClient()
    const { data: demos } = await admin
      .from('videos')
      .select('id, title, status, brand_id, created_at, video_url, progress_detail')
      .eq('user_id', user.id)
      .eq('is_trial', true)
      .like('title', 'Demo:%')
      .order('created_at', { ascending: false })
      .limit(50)

    return NextResponse.json({ demos: demos ?? [] })
  } catch (err) {
    console.error('[auto-demo] GET error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
