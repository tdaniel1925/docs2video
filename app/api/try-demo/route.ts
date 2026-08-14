import { NextRequest, NextResponse } from 'next/server'
import { VIDEO_WORKING } from '@/app/_lib/video-status'
import { createAdminClient } from '@/app/_lib/supabase/admin'
import { scrapeBrand } from '@/app/_lib/brand-scraper'
import { checkRateLimit } from '@/app/_lib/rate-limit'
import crypto from 'crypto'

export const maxDuration = 300

function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || '127.0.0.1'
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req)
    // Durable cross-instance limit (review S6) — in-memory maps reset per serverless instance.
    // Per-IP: max 1 per 24 hours. Global cap: 10 demos per day. IP is checked
    // first so an IP-limited request doesn't burn a global slot.
    const perIp = await checkRateLimit(`try-demo:ip:${ip}`, 1, 86400)
    const global = perIp.allowed
      ? await checkRateLimit('try-demo:global:daily', 10, 86400)
      : { allowed: false }
    if (!perIp.allowed || !global.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      )
    }

    const contentType = req.headers.get('content-type') || ''

    let url: string | null = null
    let fileBuffer: Buffer | null = null
    let fileName: string | null = null
    let email: string | null = null

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const file = formData.get('file') as File | null
      if (file) {
        fileBuffer = Buffer.from(await file.arrayBuffer())
        fileName = file.name
      }
      email = (formData.get('email') as string | null) || null
    } else {
      const body = await req.json()
      url = body.url
      email = body.email || null
    }

    // Normalize/validate the optional email (lead capture for follow-up).
    if (email) {
      email = email.trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) email = null
    }

    if (!url && !fileBuffer) {
      return NextResponse.json({ error: 'URL or file required' }, { status: 400 })
    }

    const admin = createAdminClient()
    const demoId = crypto.randomUUID()

    let brandData: Awaited<ReturnType<typeof scrapeBrand>> | null = null
    let companyName = 'Your Company'

    if (url) {
      // Scrape the URL for brand info
      try {
        brandData = await scrapeBrand(url)
        companyName = brandData.companyName || companyName
      } catch (err) {
        console.error('[try-demo] Brand scrape failed:', err)
        // Continue without brand data
      }
    }

    if (fileBuffer && fileName) {
      // Upload PDF to temp storage
      const filePath = `try-demos/${demoId}/${fileName}`
      const { error: uploadError } = await admin.storage
        .from('videos')
        .upload(filePath, fileBuffer, { contentType: 'application/pdf' })

      if (uploadError) {
        console.error('[try-demo] File upload failed:', uploadError)
        return NextResponse.json({ error: 'File upload failed' }, { status: 500 })
      }

      // Capture the lead if they gave an email (best-effort; demo still works
      // if the table/columns aren't there yet).
      if (email) {
        await admin.from('try_demos').insert({
          id: demoId, source_url: null, company_name: 'PDF upload', email,
          status: 'uploaded', is_trial: true, detail_level: 'quick',
          created_at: new Date().toISOString(),
        }).then(() => {}, (e: unknown) => console.warn('[try-demo] lead insert (file) failed:', e instanceof Error ? e.message : e))
      }

      // Demo is a teaser — return the same pre-approved demo video as the URL
      // path so the PDF-upload funnel completes instead of dead-ending. (The
      // uploaded PDF is stored above for later full-pipeline use.)
      return NextResponse.json({
        videoUrl: 'https://izccljcgxsbumgsznndd.supabase.co/storage/v1/object/public/videos/site-assets/hero-video.mp4',
        id: demoId,
        status: 'uploaded',
      })
    }

    // For URL-based demos: create a lightweight demo video
    // Store the demo record
    const { error: insertError } = await admin.from('try_demos').insert({
      id: demoId,
      source_url: url,
      company_name: companyName,
      email,  // optional lead-capture for follow-up nurture
      brand_data: brandData ? {
        colors: brandData.primaryColor ? [brandData.primaryColor, brandData.secondaryColor].filter(Boolean) : [],
        logo_url: brandData.logoUrl,
        company_name: brandData.companyName,
      } : null,
      status: VIDEO_WORKING,
      is_trial: true,
      detail_level: 'quick',
      created_at: new Date().toISOString(),
    }).select().single()

    // If table doesn't exist yet, just continue (the demo still works)
    if (insertError) {
      console.warn('[try-demo] Could not insert demo record (table may not exist):', insertError.message)
    }

    // For the MVP, return the pre-approved demo video URL
    // In production, this would trigger the full pipeline
    const videoUrl = 'https://izccljcgxsbumgsznndd.supabase.co/storage/v1/object/public/videos/site-assets/hero-video.mp4'

    return NextResponse.json({
      videoUrl,
      companyName,
      demoId,
    })
  } catch (err: any) {
    // Log the real error server-side; return a generic message. Raw DB/error
    // text leaks table and column names — a schema map for an attacker — and
    // this is a PUBLIC endpoint.
    console.error('[try-demo] Error:', err)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
