import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { scrapeBrand } from '../../_lib/brand-scraper'
import { rateLimit, getRateLimitKey, LIMITS } from '../../_lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const rl = rateLimit(getRateLimitKey(user.id, 'extraction'), LIMITS.extraction.limit, LIMITS.extraction.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 })
  }

  const body = await request.json()
  const { url } = body as { url: string }

  if (!url) return NextResponse.json({ error: 'URL is required' }, { status: 400 })

  try {
    const brandData = await scrapeBrand(url)
    return NextResponse.json(brandData)
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      return NextResponse.json({ error: 'The website took too long to respond. Please try again.' }, { status: 408 })
    }
    if (err instanceof TypeError && err.message.includes('fetch')) {
      return NextResponse.json({ error: 'Could not connect to the website. Please check the URL and try again.' }, { status: 422 })
    }
    const message = err instanceof Error ? err.message : 'Failed to scrape website'
    if (message === 'MAIN_FETCH_FAILED') {
      return NextResponse.json({ error: 'Could not reach website. The site may be blocking automated requests.' }, { status: 422 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
