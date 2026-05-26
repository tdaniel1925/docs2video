import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/app/_lib/supabase/admin'
import { scrapeBrand } from '@/app/_lib/brand-scraper'
import crypto from 'crypto'

export const maxDuration = 300

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 3600000 }) // 1 hour window
    return false
  }
  if (entry.count >= 2) return true
  entry.count++
  return false
}

function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || '127.0.0.1'
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req)
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      )
    }

    const contentType = req.headers.get('content-type') || ''

    let url: string | null = null
    let fileBuffer: Buffer | null = null
    let fileName: string | null = null

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const file = formData.get('file') as File | null
      if (file) {
        fileBuffer = Buffer.from(await file.arrayBuffer())
        fileName = file.name
      }
    } else {
      const body = await req.json()
      url = body.url
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

      return NextResponse.json({ id: demoId, status: 'uploaded' })
    }

    // For URL-based demos: create a lightweight demo video
    // Store the demo record
    const { error: insertError } = await admin.from('try_demos').insert({
      id: demoId,
      source_url: url,
      company_name: companyName,
      brand_data: brandData ? {
        colors: brandData.primaryColor ? [brandData.primaryColor, brandData.secondaryColor].filter(Boolean) : [],
        logo_url: brandData.logoUrl,
        company_name: brandData.companyName,
      } : null,
      status: 'processing',
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
    console.error('[try-demo] Error:', err)
    return NextResponse.json(
      { error: err?.message || 'Server error' },
      { status: 500 }
    )
  }
}
